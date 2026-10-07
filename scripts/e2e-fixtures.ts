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
import {
  E2E_FIXTURE_PREFIX,
  E2E_OTHER_OWNER_ID,
  E2E_OTHER_OWNER_SESSION_TOKEN,
  E2E_OWNER_SESSION_TOKEN,
  E2E_OWNER_SIGNOUT_SESSION_TOKEN,
} from "../e2e/support/fixture-ids";
import { FIXTURE_FUTURE_DATE, FIXTURE_PAST_DATE } from "../src/lib/e2e-fixture-dates";
import { getJakartaCalendarDate } from "../src/lib/invoice-date-status";
import { encryptShareToken } from "../src/lib/share-token-crypto";

const action = process.argv[2];
if (!["seed", "verify", "cleanup", "legacy-due-date", "follow-up-states", "follow-up-expired-share"].includes(action ?? "")) {
  throw new Error("Usage: tsx scripts/e2e-fixtures.ts seed|verify|cleanup|legacy-due-date|follow-up-states|follow-up-expired-share");
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
// Keep the short-lived seed/verify process to one connection. The Next.js
// server already owns the app pool during E2E runs, and the disposable
// database has a deliberately small connection budget.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });

const ids = { owner: `${prefix}-owner`, otherOwner: E2E_OTHER_OWNER_ID };

// A real, database-backed Auth.js session row -- not a bypass endpoint. See
// e2e/support/auth.ts, which sets this value as the `authjs.session-token`
// cookie so Playwright authenticates through the exact mechanism production
// uses, only skipping the interactive Google OAuth click-through.
const sessionTokens = {
  owner: E2E_OWNER_SESSION_TOKEN,
  ownerSignout: E2E_OWNER_SIGNOUT_SESSION_TOKEN,
  otherOwner: E2E_OTHER_OWNER_SESSION_TOKEN,
};

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

const shareTokens = {
  active: `${prefix}-public-token-do-not-share`,
  expired: `${prefix}-public-expired-token-do-not-share`,
  invalid: `${prefix}-public-invalid-token-do-not-share`,
};

// Opt-in overlay for the follow-up / overdue / contact-repair journeys
// (applyFollowUpStates below). These rows are deliberately NOT part of the
// base seed: the base seed has an empty Beranda follow-up queue and seven
// deals, and the checked-in @visual baselines (Beranda, deal board, invoice
// list) capture exactly that. Only specs that need these states apply the
// overlay, after reseedFixtures(); the next `seed` removes them again (they
// hang off the fixture owner, so cleanupRows() cascades them away).
//
// Due dates are relative to the Asia/Jakarta calendar date at the moment the
// overlay is applied -- unlike FIXTURE_FUTURE_DATE/FIXTURE_PAST_DATE, they
// are never captured in a screenshot, and the follow-up queue's reasons
// ("Telat N hari", "Jatuh tempo hari ini", ...) only exist relative to today.
// Each offset sits on a boundary of selectAttentionInvoices()
// (src/lib/invoice-date-status.ts, DUE_SOON_WINDOW_DAYS = 7).
const followUp = {
  deals: {
    overdueStored: `${prefix}-deal-overdue-stored`,
    overdueSent: `${prefix}-deal-overdue-sent`,
    dueToday: `${prefix}-deal-due-today`,
    dueWindowEdge: `${prefix}-deal-due-window-edge`,
    dueOutsideWindow: `${prefix}-deal-due-outside-window`,
    invalidContact: `${prefix}-deal-invalid-contact`,
  },
  invoices: {
    // Stored OVERDUE: invoice detail offers only "Tandai lunas"
    // (NEXT_ACTIONS.OVERDUE in invoice-detail-client.tsx).
    overdueStored: `${prefix}-invoice-overdue-stored`,
    // Stored SENT, due yesterday: displayed as overdue purely by derivation
    // (deriveInvoiceDisplayStatus), while its actions still follow SENT.
    overdueSent: `${prefix}-invoice-overdue-sent`,
    dueToday: `${prefix}-invoice-due-today`,
    dueWindowEdge: `${prefix}-invoice-due-window-edge`,
    dueOutsideWindow: `${prefix}-invoice-due-outside-window`,
  },
  // Whole Jakarta-calendar days from "today" to each invoice's due date.
  dueOffsetDays: { overdueStored: -5, overdueSent: -1, dueToday: 0, dueWindowEdge: 7, dueOutsideWindow: 8 },
  // 8 digits that keep no 62/0/8 prefix: accepted by dealInputSchema (min 6)
  // and stored as typed, but normalizeWhatsAppNumber() rejects it (< 9
  // digits) -- the same state a person reaches by typing a short number.
  invalidContactWa: "12345678",
  // Token of the expired share that `follow-up-expired-share` puts on the
  // stored-OVERDUE invoice (FIND-05: a reminder must not send it).
  expiredShareToken: `${prefix}-follow-up-expired-token-do-not-share`,
} as const;

const followUpBrands = {
  [followUp.deals.overdueStored]: "E2E Brand Telat Tersimpan",
  [followUp.deals.overdueSent]: "E2E Brand Telat Terkirim",
  [followUp.deals.dueToday]: "E2E Brand Jatuh Tempo Hari Ini",
  [followUp.deals.dueWindowEdge]: "E2E Brand Jatuh Tempo Tujuh Hari",
  [followUp.deals.dueOutsideWindow]: "E2E Brand Jatuh Tempo Delapan Hari",
  [followUp.deals.invalidContact]: "E2E Brand Kontak Tidak Valid",
} as const;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function cleanupRows() {
  await prisma.user.deleteMany({ where: { id: { in: [ids.owner, ids.otherOwner] } } });
}

async function seed() {
  await cleanupRows();
  const now = new Date();
  // Session expiry only needs to stay ahead of whenever tests actually run
  // -- unlike FIXTURE_FUTURE_DATE/FIXTURE_PAST_DATE below (imported, not
  // computed here), it's never rendered into a checked-in screenshot, so
  // there's no reason it can't stay relative to `now`.
  const sessionExpiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  await prisma.user.create({
    data: { id: ids.owner, name: "E2E Fixture Owner", email: `${prefix}-owner@example.invalid`, language: "id" },
  });
  // Ownership-denial fixture (docs/testing/E2E-IMPROVEMENT-PLAN.md C3): a
  // genuinely different user, deliberately given none of the primary
  // owner's deals/invoices/settings -- the point of this row is to have
  // nothing of its own to see, so any test using it that DOES see the
  // primary owner's data has found a real authorization defect, not a
  // fixture artifact. See e2e/support/fixture-ids.ts for why a second
  // session for the SAME owner (E2E_OWNER_SIGNOUT_SESSION_TOKEN) can't
  // substitute for this.
  await prisma.user.create({
    data: { id: ids.otherOwner, name: "E2E Fixture Other Owner", email: `${prefix}-other-owner@example.invalid`, language: "id" },
  });
  await prisma.session.createMany({
    data: [
      { sessionToken: sessionTokens.owner, userId: ids.owner, expires: sessionExpiry },
      { sessionToken: sessionTokens.ownerSignout, userId: ids.owner, expires: sessionExpiry },
      { sessionToken: sessionTokens.otherOwner, userId: ids.otherOwner, expires: sessionExpiry },
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
      { id: invoiceIds.sent, userId: ids.owner, dealId: dealIds.invoiceSent, number: "E2E/SENT/001", subtotalIdr: 6_000_000, withholdingTaxType: WithholdingTaxType.PPH21, status: InvoiceStatus.SENT, dueDate: FIXTURE_FUTURE_DATE },
      { id: invoiceIds.paid, userId: ids.owner, dealId: dealIds.dibayar, number: "E2E/PAID/002", subtotalIdr: 7_000_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.PAID, dueDate: FIXTURE_PAST_DATE },
    ],
  });

  await prisma.invoiceShare.create({
    data: {
      id: `${prefix}-share-sent`,
      invoiceId: invoiceIds.sent,
      tokenHash: sha256(shareTokens.active),
      tokenCiphertext: encryptShareToken(shareTokens.active),
      expiresAt: FIXTURE_FUTURE_DATE,
    },
  });
  await prisma.invoiceShare.create({
    data: {
      id: `${prefix}-share-expired`,
      invoiceId: invoiceIds.paid,
      tokenHash: sha256(shareTokens.expired),
      tokenCiphertext: encryptShareToken(shareTokens.expired),
      expiresAt: FIXTURE_PAST_DATE,
    },
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
    otherOwner: { id: ids.otherOwner, sessionToken: sessionTokens.otherOwner, email: `${prefix}-other-owner@example.invalid` },
    deals: dealIds,
    brands,
    invoices: invoiceIds,
    shareTokens,
    // Only present in the database after `follow-up-states`; see followUp.
    followUp: { ...followUp, brands: followUpBrands },
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
  const otherOwner = await prisma.user.findUnique({
    where: { id: ids.otherOwner },
    select: {
      id: true,
      deals: { select: { id: true } },
      invoices: { select: { id: true } },
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
    // The other owner's whole reason for existing is to have nothing of the
    // primary owner's -- verify isolation itself, not just presence, so a
    // future reseed change that accidentally attaches fixture data to this
    // user fails loudly here instead of silently weakening the
    // ownership-denial journey.
    otherOwnerExists: otherOwner != null,
    otherOwnerHasNoDeals: otherOwner?.deals.length === 0,
    otherOwnerHasNoInvoices: otherOwner?.invoices.length === 0,
    otherOwnerSessionPresent: otherOwner?.sessions.some((session) => session.sessionToken === sessionTokens.otherOwner) === true,
  };
  if (Object.values(checks).some((value) => !value)) throw new Error(`E2E fixture verification failed: ${JSON.stringify(checks)}`);
  console.log(JSON.stringify({ action: "verify", host: normalizedHost, prefix, checks }));
}

async function cleanup() {
  await cleanupRows();
  const remaining = await prisma.user.count({ where: { id: { in: [ids.owner, ids.otherOwner] } } });
  if (remaining !== 0) throw new Error(`E2E fixture cleanup read-back failed: ${remaining} users remain`);
  await rm(manifestPath, { force: true });
  console.log(JSON.stringify({ action: "cleanup", host: normalizedHost, prefix, remainingUsers: remaining }));
}

// Writes the exact malformed value FIND-03 let through the API (year 0002)
// straight onto the seeded SENT invoice, bypassing the app, so the suite can
// prove a pre-existing bad row neither crashes nor gets silently rewritten.
// Only ever touches this fixture owner's row on the guarded disposable
// target above; the next `seed` restores the normal value.
async function legacyDueDate() {
  const result = await prisma.invoice.updateMany({
    where: { id: invoiceIds.sent, userId: ids.owner },
    data: { dueDate: new Date("0002-01-15T00:00:00.000Z") },
  });
  if (result.count !== 1) throw new Error(`E2E legacy due-date write expected 1 row, updated ${result.count}`);
  console.log(JSON.stringify({ action: "legacy-due-date", host: normalizedHost, prefix, updated: result.count }));
}

// UTC midnight of the Jakarta calendar date `offsetDays` from today -- the
// same date-only encoding the due-date field writes (Invoice.dueDate).
function jakartaDueDate(today: string, offsetDays: number): Date {
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays));
}

// Adds the follow-up overlay (see followUp above) on top of a fresh seed.
// Refuses to run unless the base seed is present and the overlay is not, so
// it can't silently stack on a half-applied state.
async function applyFollowUpStates() {
  const ownerDeals = await prisma.deal.findMany({ where: { userId: ids.owner }, select: { id: true } });
  const baseDealIds = new Set<string>(Object.values(dealIds));
  if (ownerDeals.length !== baseDealIds.size || ownerDeals.some((deal) => !baseDealIds.has(deal.id))) {
    throw new Error(`E2E follow-up overlay needs a fresh seed first (found ${ownerDeals.length} owner deals)`);
  }

  const today = getJakartaCalendarDate(new Date());
  const now = new Date();
  const d = followUp.deals;
  const dealRows = [
    { id: d.overdueStored, userId: ids.owner, brand: followUpBrands[d.overdueStored], contactWa: "628110000008", scope: "E2E fixture: invoice stored as overdue", feeIdr: 8_000_000, status: DealStatus.INVOICE },
    { id: d.overdueSent, userId: ids.owner, brand: followUpBrands[d.overdueSent], contactWa: "628110000009", scope: "E2E fixture: sent invoice due yesterday", feeIdr: 9_000_000, status: DealStatus.INVOICE },
    { id: d.dueToday, userId: ids.owner, brand: followUpBrands[d.dueToday], contactWa: "628110000010", scope: "E2E fixture: invoice due today", feeIdr: 1_100_000, status: DealStatus.INVOICE },
    { id: d.dueWindowEdge, userId: ids.owner, brand: followUpBrands[d.dueWindowEdge], contactWa: "628110000011", scope: "E2E fixture: invoice due in seven days", feeIdr: 1_200_000, status: DealStatus.INVOICE },
    { id: d.dueOutsideWindow, userId: ids.owner, brand: followUpBrands[d.dueOutsideWindow], contactWa: "628110000012", scope: "E2E fixture: invoice due in eight days", feeIdr: 1_300_000, status: DealStatus.INVOICE },
    { id: d.invalidContact, userId: ids.owner, brand: followUpBrands[d.invalidContact], contactWa: followUp.invalidContactWa, scope: "E2E fixture: WhatsApp number needs repair", feeIdr: 1_400_000, status: DealStatus.NEGO },
  ];
  await prisma.deal.createMany({ data: dealRows });
  await prisma.dealStageTransition.createMany({
    data: dealRows.map((deal) => ({ id: `${deal.id}-initial-transition`, dealId: deal.id, fromStatus: null, toStatus: deal.status, createdAt: now })),
  });

  const i = followUp.invoices;
  const offsets = followUp.dueOffsetDays;
  // No InvoiceShare rows: the reminder journeys start from "no link yet",
  // so the link in the message is the one the reminder itself created.
  await prisma.invoice.createMany({
    data: [
      { id: i.overdueStored, userId: ids.owner, dealId: d.overdueStored, number: "E2E/OVERDUE/003", subtotalIdr: 8_000_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.OVERDUE, dueDate: jakartaDueDate(today, offsets.overdueStored) },
      { id: i.overdueSent, userId: ids.owner, dealId: d.overdueSent, number: "E2E/OVERDUE/004", subtotalIdr: 9_000_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.SENT, dueDate: jakartaDueDate(today, offsets.overdueSent) },
      { id: i.dueToday, userId: ids.owner, dealId: d.dueToday, number: "E2E/DUE/005", subtotalIdr: 1_100_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.SENT, dueDate: jakartaDueDate(today, offsets.dueToday) },
      { id: i.dueWindowEdge, userId: ids.owner, dealId: d.dueWindowEdge, number: "E2E/DUE/006", subtotalIdr: 1_200_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.SENT, dueDate: jakartaDueDate(today, offsets.dueWindowEdge) },
      { id: i.dueOutsideWindow, userId: ids.owner, dealId: d.dueOutsideWindow, number: "E2E/DUE/007", subtotalIdr: 1_300_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.SENT, dueDate: jakartaDueDate(today, offsets.dueOutsideWindow) },
    ],
  });

  const applied = await prisma.invoice.count({ where: { userId: ids.owner, id: { in: Object.values(i) } } });
  if (applied !== Object.keys(i).length) throw new Error(`E2E follow-up overlay read-back expected ${Object.keys(i).length} invoices, found ${applied}`);
  console.log(JSON.stringify({ action: "follow-up-states", host: normalizedHost, prefix, jakartaToday: today, deals: dealRows.length, invoices: applied }));
}

// Gives the overlay's stored-OVERDUE invoice a share that has already
// expired, with a recoverable path -- the state a real invoice reaches 90
// days after its link was made. Written straight to the row because the app
// offers no way to backdate an expiry. Needs the overlay, and refuses to
// overwrite a share that is already there.
async function followUpExpiredShare() {
  const invoiceId = followUp.invoices.overdueStored;
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId: ids.owner }, select: { id: true, share: { select: { id: true } } } });
  if (!invoice) throw new Error("E2E expired-share overlay needs follow-up-states first");
  if (invoice.share) throw new Error("E2E expired-share overlay refuses to replace an existing share");

  await prisma.invoiceShare.create({
    data: {
      id: `${prefix}-share-follow-up-expired`,
      invoiceId,
      tokenHash: sha256(followUp.expiredShareToken),
      tokenCiphertext: encryptShareToken(followUp.expiredShareToken),
      expiresAt: FIXTURE_PAST_DATE,
    },
  });
  console.log(JSON.stringify({ action: "follow-up-expired-share", host: normalizedHost, prefix, shares: 1 }));
}

async function main() {
  try {
    if (action === "seed") await seed();
    else if (action === "verify") await verify();
    else if (action === "legacy-due-date") await legacyDueDate();
    else if (action === "follow-up-states") await applyFollowUpStates();
    else if (action === "follow-up-expired-share") await followUpExpiredShare();
    else await cleanup();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown E2E fixture error");
  process.exitCode = 1;
});
