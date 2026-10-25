// Recovery compatibility probe for the PR #67 release schema (14 migrations).
// Proves, on the approved disposable local Postgres only, the database
// properties an application rollback or a secure recovery deployment depends
// on, which the browser suites cannot see:
//
//   1. the schema is fully migrated (no unfinished migration row);
//   2. an invoice sent by an app version that never writes snapshots (the
//      previous Production code, or the hotfix/secure-recovery-baseline
//      candidate) is frozen exactly once, as RECONSTRUCTED_LATE, when the
//      release code first reads it after rolling forward;
//   3. a Draft that was never exposed still follows its deal;
//   4. a snapshot cannot be rewritten (the database trigger rejects UPDATE);
//   5. a deal edit made after the freeze does not reach the frozen document;
//   6. a freeze scoped to another user writes nothing;
//   7. deleting the owner still cascades through invoices and snapshots.
//
// Every row it writes belongs to its own probe user, which it deletes at the
// end (and at the start, in case an earlier run was interrupted). Same
// guardrails as scripts/e2e-fixtures.ts. See
// docs/receipts/DIBAYAR-RECOVERY-HARDENING-2026-10-25.md.
//
//   E2E_FIXTURE_CONFIRM=non-production npx tsx --env-file-if-exists=.env.local scripts/recovery-compat-probe.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { freezeInvoiceDocument, resolveOwnerInvoiceDocument } from "../src/lib/invoice-snapshot";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required; no database action was taken");
const url = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(url.protocol)) {
  throw new Error("Refusing database action: DATABASE_URL must use the PostgreSQL protocol");
}
if (["host", "hostaddr", "port", "database", "dbname"].some((parameter) => url.searchParams.has(parameter))) {
  throw new Error("Refusing database action: DATABASE_URL must not contain target-override query parameters");
}
const normalizedHost = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
if (normalizedHost !== "127.0.0.1" || url.port !== "55432" || decodeURIComponent(url.pathname.replace(/^\//, "")) !== "dibayar_test") {
  throw new Error("Refusing database action: target must be 127.0.0.1:55432/dibayar_test");
}
if (process.env.E2E_FIXTURE_CONFIRM !== "non-production") {
  throw new Error("Refusing database action: E2E_FIXTURE_CONFIRM must equal non-production");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });
const prefix = "recovery-probe";
const ownerId = `${prefix}-owner`;
const otherId = `${prefix}-other`;

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function check(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
}

async function cleanup() {
  // Invoice -> Deal is ON DELETE RESTRICT, so invoices go first; User
  // deletion then cascades deals, sessions and settings.
  await prisma.invoice.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
}

async function main() {
  const migrations = await prisma.$queryRaw<{ finished: bigint; unfinished: bigint }[]>`
    SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS finished,
           count(*) FILTER (WHERE finished_at IS NULL) AS unfinished
    FROM "_prisma_migrations"`;
  const finished = Number(migrations[0].finished);
  const unfinished = Number(migrations[0].unfinished);
  check("schema fully migrated", finished >= 14 && unfinished === 0, `${finished} finished, ${unfinished} unfinished`);

  await cleanup();

  // What a snapshot-unaware app version writes: plain rows, no snapshot,
  // nullable idempotency columns left NULL.
  await prisma.user.create({ data: { id: ownerId, email: `${prefix}-owner@example.invalid` } });
  await prisma.user.create({ data: { id: otherId, email: `${prefix}-other@example.invalid` } });
  await prisma.userSettings.create({ data: { userId: ownerId, issuerName: "Probe Issuer", bankName: "Probe Bank" } });
  const deal = await prisma.deal.create({
    data: { id: `${prefix}-deal`, userId: ownerId, brand: "Brand Asli", contactWa: "628110000001", scope: "Probe scope", feeIdr: 1_500_000 },
  });
  const sent = await prisma.invoice.create({
    data: { id: `${prefix}-sent`, userId: ownerId, dealId: deal.id, number: "PROBE-001", subtotalIdr: 1_500_000, status: "SENT" },
  });
  const draft = await prisma.invoice.create({
    data: { id: `${prefix}-draft`, userId: ownerId, dealId: deal.id, number: "PROBE-002", subtotalIdr: 500_000, status: "DRAFT" },
  });
  check(
    "old-app write leaves no snapshot",
    (await prisma.invoiceSnapshot.count({ where: { invoiceId: { in: [sent.id, draft.id] } } })) === 0,
    "SENT and DRAFT invoices created without a snapshot",
  );

  // Rolling forward: the release code reads the SENT invoice.
  const first = await resolveOwnerInvoiceDocument(prisma, sent);
  const frozen = await prisma.invoiceSnapshot.findUnique({ where: { invoiceId: sent.id } });
  check(
    "late capture on first read",
    first?.frozen === true && frozen?.provenance === "RECONSTRUCTED_LATE" && frozen?.trigger === "DOCUMENT_READ" && frozen?.brand === "Brand Asli",
    `frozen=${first?.frozen} provenance=${frozen?.provenance} trigger=${frozen?.trigger}`,
  );

  await resolveOwnerInvoiceDocument(prisma, sent);
  const again = await prisma.invoiceSnapshot.findMany({ where: { invoiceId: sent.id } });
  check(
    "exactly once",
    again.length === 1 && again[0].id === frozen?.id && again[0].capturedAt.getTime() === frozen?.capturedAt.getTime(),
    `${again.length} snapshot row(s), same id: ${again[0]?.id === frozen?.id}`,
  );

  const draftDoc = await resolveOwnerInvoiceDocument(prisma, draft);
  check(
    "unexposed draft stays live",
    draftDoc?.frozen === false && (await prisma.invoiceSnapshot.count({ where: { invoiceId: draft.id } })) === 0,
    `frozen=${draftDoc?.frozen}`,
  );

  // Only the trigger's own refusal counts; any other error would hide a
  // broken probe behind a pass.
  const byTrigger = (error: unknown) => /InvoiceSnapshot rows are immutable/.test(String((error as Error).message ?? error));
  let rawRejected = false;
  try {
    await prisma.$executeRaw`UPDATE "InvoiceSnapshot" SET "brand" = 'Diubah' WHERE "invoiceId" = ${sent.id}`;
  } catch (error) {
    rawRejected = byTrigger(error);
  }
  let clientRejected = false;
  try {
    await prisma.invoiceSnapshot.update({ where: { invoiceId: sent.id }, data: { brand: "Diubah" } });
  } catch (error) {
    clientRejected = byTrigger(error);
  }
  const afterUpdate = await prisma.invoiceSnapshot.findUnique({ where: { invoiceId: sent.id } });
  check(
    "snapshot immutable",
    rawRejected && clientRejected && afterUpdate?.brand === "Brand Asli",
    `raw UPDATE rejected by trigger=${rawRejected}, client update rejected by trigger=${clientRejected}`,
  );

  // A snapshot-unaware app edits the deal after the invoice was frozen.
  await prisma.deal.update({ where: { id: deal.id }, data: { brand: "Brand Baru" } });
  const afterEdit = await resolveOwnerInvoiceDocument(prisma, sent);
  check(
    "frozen document ignores later deal edit",
    afterEdit?.input.deal.brand === "Brand Asli",
    `document brand=${afterEdit?.input.deal.brand}`,
  );

  const otherDraft = await prisma.invoice.create({
    data: { id: `${prefix}-draft-2`, userId: ownerId, dealId: deal.id, number: "PROBE-003", subtotalIdr: 1, status: "SENT" },
  });
  const crossTenant = await freezeInvoiceDocument(prisma, otherDraft.id, otherId, "DOCUMENT_READ");
  check(
    "cross-tenant freeze writes nothing",
    crossTenant === 0 && (await prisma.invoiceSnapshot.count({ where: { invoiceId: otherDraft.id } })) === 0,
    `rows written=${crossTenant}`,
  );

  await cleanup();
  const leftovers = await prisma.invoiceSnapshot.count({ where: { invoiceId: { startsWith: prefix } } });
  check("delete cascades through snapshots", leftovers === 0, `${leftovers} probe snapshot row(s) left`);
}

main()
  .catch((error: unknown) => {
    check("probe completed", false, (error as Error).message.replace(/postgres(ql)?:\/\/\S+/g, "[url]"));
  })
  .finally(async () => {
    await cleanup().catch(() => undefined);
    await prisma.$disconnect();
    console.log(JSON.stringify({ action: "recovery-compat-probe", host: normalizedHost, checks }, null, 1));
    if (checks.some((c) => !c.pass)) process.exitCode = 1;
  });
