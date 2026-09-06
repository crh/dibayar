// Deterministic data + session fixtures for the Playwright journey/E2E suite
// (e2e/**), kept deliberately separate from scripts/ux-fixtures.ts (the
// visual/detector audit fixtures under tests/ux-audit/). Same safety
// guardrails as ux-fixtures.ts (target pinning to the approved disposable
// local Postgres, an explicit non-production confirmation flag, and a
// hostname sanity check) so this can never be pointed at a real database by
// accident -- see docs/testing/E2E.md "Security safeguards".
import { createHash } from "node:crypto";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  DealStatus,
  InvoiceStatus,
  PrismaClient,
  WithholdingTaxType,
} from "../src/generated/prisma/client";
import { E2E_FIXTURE_PREFIX, E2E_OWNER_SESSION_TOKEN, E2E_OWNER_SIGNOUT_SESSION_TOKEN } from "../e2e/support/fixture-ids";

const action = process.argv[2];
if (!["seed", "verify", "cleanup"].includes(action ?? "")) {
  throw new Error("Usage: tsx scripts/e2e-fixtures.ts seed|verify|cleanup");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required; no database action was taken");
const url = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(url.protocol)) {
  throw new Error("Refusing database action: DATABASE_URL must use the PostgreSQL protocol");
}
const targetOverrideParameters = ["host", "hostaddr", "port", "database", "dbname"];
if (targetOverrideParameters.some((parameter) => url.searchParams.has(parameter))) {
  throw new Error("Refusing database action: DATABASE_URL must not contain target-override query parameters");
}
const expectedTarget = { host: "127.0.0.1", port: "55432", database: "dibayar_test" } as const;
const normalizedHost = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
const actualDatabase = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (
  normalizedHost !== expectedTarget.host
  || url.port !== expectedTarget.port
  || actualDatabase !== expectedTarget.database
) {
  throw new Error("Refusing database action: target must be 127.0.0.1:55432/dibayar_test");
}
if (process.env.E2E_FIXTURE_CONFIRM !== "non-production") {
  throw new Error("Refusing database action: E2E_FIXTURE_CONFIRM must equal non-production");
}
if (/(^|[.-])(prod|production)([.-]|$)/i.test(url.hostname)) {
  throw new Error("Refusing database action: hostname appears Production-like");
}

const prefix = E2E_FIXTURE_PREFIX;
const manifestPath = path.resolve(".hermes-runtime/e2e-fixtures/fixtures.json");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ids = { owner: `${prefix}-owner` };

// A real, database-backed Auth.js session row -- not a bypass endpoint. See
// e2e/support/auth.ts, which sets this value as the `authjs.session-token`
// cookie so Playwright authenticates through the exact mechanism production
// uses, only skipping the interactive Google OAuth click-through.
const sessionTokens = { owner: E2E_OWNER_SESSION_TOKEN, ownerSignout: E2E_OWNER_SIGNOUT_SESSION_TOKEN };

const dealIds = {
  masuk: `${prefix}-deal-masuk`,
  nego: `${prefix}-deal-nego`,
  deal: `${prefix}-deal-deal`,
  konten: `${prefix}-deal-konten`,
  invoicePending: `${prefix}-deal-invoice-pending`,
  invoiceSent: `${prefix}-deal-invoice-sent`,
  dibayar: `${prefix}-deal-dibayar`,
};

const brands = {
  [dealIds.masuk]: "E2E Brand Masuk",
  [dealIds.nego]: "E2E Brand Nego",
  [dealIds.deal]: "E2E Brand Deal",
  [dealIds.konten]: "E2E Brand Konten",
  [dealIds.invoicePending]: "E2E Brand Invoice Pending",
  [dealIds.invoiceSent]: "E2E Brand Invoice Terkirim",
  [dealIds.dibayar]: "E2E Brand Dibayar",
} as const;

const invoiceIds = {
  sent: `${prefix}-invoice-sent`,
  paid: `${prefix}-invoice-paid`,
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function cleanupRows() {
  await prisma.user.deleteMany({ where: { id: ids.owner } });
}

async function seed() {
  await cleanupRows();
  const now = new Date();
  const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  await prisma.user.create({
    data: { id: ids.owner, name: "E2E Fixture Owner", email: `${prefix}-owner@example.invalid`, language: "id" },
  });
  await prisma.session.createMany({
    data: [
      { sessionToken: sessionTokens.owner, userId: ids.owner, expires: future },
      { sessionToken: sessionTokens.ownerSignout, userId: ids.owner, expires: future },
    ],
  });

  const dealRows = [
    { id: dealIds.masuk, userId: ids.owner, brand: brands[dealIds.masuk], contactWa: "628110000001", scope: "E2E fixture: negotiation not started", feeIdr: 1_000_000, status: DealStatus.MASUK },
    { id: dealIds.nego, userId: ids.owner, brand: brands[dealIds.nego], contactWa: "628110000002", scope: "E2E fixture: one short-form video", feeIdr: 2_000_000, status: DealStatus.NEGO },
    { id: dealIds.deal, userId: ids.owner, brand: brands[dealIds.deal], contactWa: "628110000003", scope: "E2E fixture: deal agreed", feeIdr: 3_000_000, status: DealStatus.DEAL },
    { id: dealIds.konten, userId: ids.owner, brand: brands[dealIds.konten], contactWa: "628110000004", scope: "E2E fixture: content in production", feeIdr: 4_000_000, status: DealStatus.KONTEN },
    { id: dealIds.invoicePending, userId: ids.owner, brand: brands[dealIds.invoicePending], contactWa: "628110000005", scope: "E2E fixture: ready to invoice, none created yet", feeIdr: 5_000_000, status: DealStatus.INVOICE },
    { id: dealIds.invoiceSent, userId: ids.owner, brand: brands[dealIds.invoiceSent], contactWa: "628110000006", scope: "E2E fixture: invoice already sent", feeIdr: 6_000_000, status: DealStatus.INVOICE, paymentTerms: "30 hari setelah invoice diterima" },
    { id: dealIds.dibayar, userId: ids.owner, brand: brands[dealIds.dibayar], contactWa: "628110000007", scope: "E2E fixture: paid", feeIdr: 7_000_000, status: DealStatus.DIBAYAR },
  ];
  await prisma.deal.createMany({ data: dealRows });

  // Mirrors production's createDeal(), which always writes an initial
  // DealStageTransition in the same transaction as the Deal row -- deal
  // detail's stage-history list expects one per deal. createMany() above
  // bypasses that path, so it's added explicitly here.
  await prisma.dealStageTransition.createMany({
    data: dealRows.map((deal) => ({
      id: `${deal.id}-initial-transition`,
      dealId: deal.id,
      fromStatus: null,
      toStatus: deal.status,
      createdAt: now,
    })),
  });

  await prisma.invoice.createMany({
    data: [
      { id: invoiceIds.sent, userId: ids.owner, dealId: dealIds.invoiceSent, number: "E2E/SENT/001", subtotalIdr: 6_000_000, withholdingTaxType: WithholdingTaxType.PPH21, status: InvoiceStatus.SENT, dueDate: future },
      { id: invoiceIds.paid, userId: ids.owner, dealId: dealIds.dibayar, number: "E2E/PAID/002", subtotalIdr: 7_000_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.PAID, dueDate: past },
    ],
  });

  await prisma.invoiceShare.create({
    data: { id: `${prefix}-share-sent`, invoiceId: invoiceIds.sent, tokenHash: sha256(`${prefix}-public-token-do-not-share`), expiresAt: future },
  });

  await prisma.userSettings.create({
    data: {
      userId: ids.owner,
      issuerName: "E2E Fixture Owner",
      issuerAddress: "Jl. Fixture E2E No. 1, Jakarta",
      issuerWhatsapp: "628199999999",
      issuerEmail: `${prefix}-owner@example.invalid`,
      bankName: "Bank E2E Fixture",
      bankAccountNumber: "1234509876",
      bankAccountHolder: "E2E Fixture Owner",
    },
  });

  const manifest = {
    schemaVersion: 1,
    prefix,
    host: normalizedHost,
    port: url.port,
    database: actualDatabase,
    owner: { id: ids.owner, sessionToken: sessionTokens.owner, email: `${prefix}-owner@example.invalid` },
    deals: dealIds,
    brands,
    invoices: invoiceIds,
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(manifestPath, 0o600);
  await verify();
  console.log(JSON.stringify({ action: "seed", host: normalizedHost, prefix, deals: dealRows.length, invoices: 2 }));
}

async function verify() {
  const owner = await prisma.user.findUnique({
    where: { id: ids.owner },
    select: {
      id: true,
      deals: { select: { id: true, status: true } },
      invoices: { select: { id: true, status: true } },
      settings: { select: { issuerName: true, bankName: true, bankAccountNumber: true, bankAccountHolder: true } },
      sessions: { select: { sessionToken: true } },
    },
  });
  const dealStages = new Set(owner?.deals.map((deal) => deal.status));
  const checks = {
    ownerExists: owner != null,
    sevenDeals: owner?.deals.length === 7,
    allStagesPresent: [DealStatus.MASUK, DealStatus.NEGO, DealStatus.DEAL, DealStatus.KONTEN, DealStatus.INVOICE, DealStatus.DIBAYAR].every((status) => dealStages.has(status)),
    twoInvoices: owner?.invoices.length === 2,
    settingsComplete: owner?.settings != null
      && ["issuerName", "bankName", "bankAccountNumber", "bankAccountHolder"].every((field) => (owner.settings as Record<string, string | null>)[field]),
    sessionPresent: owner?.sessions.some((session) => session.sessionToken === sessionTokens.owner) === true,
    signoutSessionPresent: owner?.sessions.some((session) => session.sessionToken === sessionTokens.ownerSignout) === true,
  };
  if (Object.values(checks).some((value) => !value)) throw new Error(`E2E fixture verification failed: ${JSON.stringify(checks)}`);
  console.log(JSON.stringify({ action: "verify", host: normalizedHost, prefix, checks }));
}

async function cleanup() {
  await cleanupRows();
  const remaining = await prisma.user.count({ where: { id: ids.owner } });
  if (remaining !== 0) throw new Error(`E2E fixture cleanup read-back failed: ${remaining} users remain`);
  await rm(manifestPath, { force: true });
  console.log(JSON.stringify({ action: "cleanup", host: normalizedHost, prefix, remainingUsers: remaining }));
}

async function main() {
  try {
    if (action === "seed") await seed();
    else if (action === "verify") await verify();
    else await cleanup();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown E2E fixture error");
  process.exitCode = 1;
});
