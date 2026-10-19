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
import { createOrRegenerateShare, getShareState, type InvoiceShareDb } from "../src/lib/invoice-share";

const action = process.argv[2];
if (!['seed', 'verify', 'cleanup', 'restore-invalid-contact'].includes(action ?? '')) {
  throw new Error('Usage: npm run ux:fixtures -- seed|verify|cleanup|restore-invalid-contact');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required; no database action was taken');
const url = new URL(connectionString);
if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('Refusing database action: DATABASE_URL must use the PostgreSQL protocol');
}
const targetOverrideParameters = ['host', 'hostaddr', 'port', 'database', 'dbname'];
if (targetOverrideParameters.some((parameter) => url.searchParams.has(parameter))) {
  throw new Error('Refusing database action: DATABASE_URL must not contain target-override query parameters');
}
const expectedTarget = { host: '127.0.0.1', port: '55432', database: 'dibayar_test' } as const;
const normalizedHost = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;
const actualDatabase = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (
  normalizedHost !== expectedTarget.host
  || url.port !== expectedTarget.port
  || actualDatabase !== expectedTarget.database
) {
  throw new Error('Refusing database action: target must be 127.0.0.1:55432/dibayar_test');
}
if (process.env.UX_FIXTURE_CONFIRM !== 'non-production') {
  throw new Error('Refusing database action: UX_FIXTURE_CONFIRM must equal non-production');
}
if (/(^|[.-])(prod|production)([.-]|$)/i.test(url.hostname)) {
  throw new Error('Refusing database action: hostname appears Production-like');
}

const prefix = 'ux-t00';
const manifestPath = path.resolve('.hermes-runtime/ux-fixtures/fixtures.json');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ids = {
  owner: `${prefix}-owner`,
  other: `${prefix}-other`,
  zero: `${prefix}-zero`,
  // "nothing-needs-chasing": has real deal/invoice activity (distinct from
  // `zero`'s "no data at all" -- see docs/testing/UX_AUDIT.md), but none of
  // it currently qualifies as overdue or due-soon, so the FollowUpQueue
  // empty state below must be reached through real business logic, not
  // merely by having nothing to look at.
  quiet: `${prefix}-quiet`,
};

const sessionTokens = {
  owner: `${prefix}-session-owner-do-not-share`,
  other: `${prefix}-session-other-do-not-share`,
  zero: `${prefix}-session-zero-do-not-share`,
  quiet: `${prefix}-session-quiet-do-not-share`,
};

const publicTokens = {
  active: `${prefix}-public-active-do-not-share`,
  expired: `${prefix}-public-expired-do-not-share`,
  invalid: `${prefix}-public-invalid-do-not-share`,
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function cleanupRows() {
  await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
}

async function seed() {
  await cleanupRows();
  const now = new Date();
  const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  await prisma.user.createMany({
    data: [
      { id: ids.owner, name: 'UX Fixture Owner', email: `${prefix}-owner@example.invalid`, language: 'id' },
      { id: ids.other, name: 'UX Fixture Other', email: `${prefix}-other@example.invalid`, language: 'en' },
      { id: ids.zero, name: 'UX Fixture Zero', email: `${prefix}-zero@example.invalid`, language: 'id' },
      { id: ids.quiet, name: 'UX Fixture Quiet', email: `${prefix}-quiet@example.invalid`, language: 'id' },
    ],
  });
  await prisma.session.createMany({ data: [
    { sessionToken: sessionTokens.owner, userId: ids.owner, expires: future },
    { sessionToken: sessionTokens.other, userId: ids.other, expires: future },
    { sessionToken: sessionTokens.zero, userId: ids.zero, expires: future },
    { sessionToken: sessionTokens.quiet, userId: ids.quiet, expires: future },
  ] });

  const dealRows = [
    { id: `${prefix}-deal-masuk`, userId: ids.owner, brand: 'Brand Masuk', contactWa: 'not-a-phone', scope: 'Invalid phone repair fixture', feeIdr: 1_250_000, status: DealStatus.MASUK, deadline: future },
    { id: `${prefix}-deal-nego`, userId: ids.owner, brand: 'Brand Negosiasi', contactWa: '628111111111', scope: 'Satu video pendek', feeIdr: 2_500_000, status: DealStatus.NEGO, paymentTerms: '14 hari setelah konten tayang' },
    { id: `${prefix}-deal-deal`, userId: ids.owner, brand: 'Brand Deal', contactWa: '628122222222', scope: 'Dua video dan tiga story', feeIdr: 3_750_000, status: DealStatus.DEAL },
    { id: `${prefix}-deal-konten`, userId: ids.owner, brand: 'Brand Konten', contactWa: '6591234567', scope: 'International phone fixture', feeIdr: 4_000_000, status: DealStatus.KONTEN },
    { id: `${prefix}-deal-invoice`, userId: ids.owner, brand: 'Brand dengan nama sangat panjang untuk menguji pemotongan aman tanpa merusak dokumen', contactWa: '628133333333', scope: 'Long text fixture: deliver a campaign recap, links, captions, and final exported assets without clipping.', feeIdr: 12_345_678, status: DealStatus.INVOICE, paymentTerms: 'Pembayaran 30 hari setelah invoice diterima. Referensi: https://example.invalid/a/very/long/path/for/layout/testing' },
    { id: `${prefix}-deal-paid`, userId: ids.owner, brand: 'Brand Dibayar', contactWa: '628144444444', scope: 'Paid fixture', feeIdr: 5_000_000, status: DealStatus.DIBAYAR },
    { id: `${prefix}-deal-other`, userId: ids.other, brand: 'Other Owner Secret Brand', contactWa: '628155555555', scope: 'Ownership isolation fixture', feeIdr: 9_999_999, status: DealStatus.INVOICE },
    // UX-audit "many-deals" density fixture: several additional cards spread
    // across the earlier pipeline stages (not INVOICE/DIBAYAR, which already
    // have their own single-card fixtures above) so the deals__desktop
    // capture and the Deals-desktop-scroll regression exercise a board with
    // more than one card per column, including a mix of short and long
    // Indonesian brand names -- not just the single long-name card above.
    { id: `${prefix}-deal-many-masuk-1`, userId: ids.owner, brand: 'Kopi Senja Nusantara', contactWa: '628160000001', scope: 'Ulasan produk kopi kemasan', feeIdr: 800_000, status: DealStatus.MASUK },
    { id: `${prefix}-deal-many-masuk-2`, userId: ids.owner, brand: 'Klinik Kecantikan Radiant Glow Indonesia', contactWa: '628160000002', scope: 'Konten sebelum dan sesudah perawatan wajah', feeIdr: 1_500_000, status: DealStatus.MASUK },
    { id: `${prefix}-deal-many-masuk-3`, userId: ids.owner, brand: 'Toko Sepatu Lokal', contactWa: '628160000003', scope: 'Video unboxing sepatu edisi terbatas', feeIdr: 950_000, status: DealStatus.MASUK },
    { id: `${prefix}-deal-many-nego-1`, userId: ids.owner, brand: 'Aplikasi Keuangan Digital Sejahtera', contactWa: '628160000004', scope: 'Tutorial penggunaan fitur baru aplikasi', feeIdr: 2_200_000, status: DealStatus.NEGO },
    { id: `${prefix}-deal-many-nego-2`, userId: ids.owner, brand: 'Warung Makan Ibu Sari', contactWa: '628160000005', scope: 'Review menu andalan warung', feeIdr: 600_000, status: DealStatus.NEGO },
    { id: `${prefix}-deal-many-deal-1`, userId: ids.owner, brand: 'Merek Skincare Herbal Alami Indonesia', contactWa: '628160000006', scope: 'Rangkaian konten pemakaian rutin 30 hari', feeIdr: 3_100_000, status: DealStatus.DEAL },
    { id: `${prefix}-deal-many-deal-2`, userId: ids.owner, brand: 'Brand Fashion Lokal', contactWa: '628160000007', scope: 'Lookbook koleksi musim ini', feeIdr: 1_800_000, status: DealStatus.DEAL },
    // UX-audit "overdue-deliverable" fixture: deadline already in the past,
    // but pre-INVOICE (no invoice exists yet) -- distinct from the
    // "overdue-invoice" fixture above, which is a payment-due-date overdue.
    { id: `${prefix}-deal-overdue-deliverable`, userId: ids.owner, brand: 'Brand Konten Terlambat', contactWa: '628160000008', scope: 'Konten deadline sudah lewat, belum dikirim', feeIdr: 1_100_000, status: DealStatus.KONTEN, deadline: past },
    // UX-audit "nothing-needs-chasing" fixture: real, completed activity for
    // a separate user (`quiet`) whose only invoice is PAID (terminal --
    // never re-derived as OVERDUE/due-soon regardless of its due date, see
    // deriveInvoiceDisplayStatus), so its FollowUpQueue empty state is
    // reached through real business logic rather than having no data at all
    // (that's the `zero` user's "fresh-user" fixture instead).
    { id: `${prefix}-deal-quiet`, userId: ids.quiet, brand: 'Brand Tenang', contactWa: '628170000000', scope: 'Proyek selesai, sudah dibayar lunas', feeIdr: 2_000_000, status: DealStatus.DIBAYAR },
  ];
  await prisma.deal.createMany({ data: dealRows });

  // Production's createDeal() always writes an initial DealStageTransition
  // (fromStatus null, toStatus the deal's starting status) inside the same
  // transaction as the Deal row -- see recordDealStageTransition in
  // src/lib/deals.ts. prisma.deal.createMany() above bypasses that path
  // entirely, so every seeded deal needs its initial transition inserted
  // here to match what real deal creation would have produced. Cleanup needs
  // no extra step: DealStageTransition cascades from Deal, which cascades
  // from User (see cleanupRows).
  await prisma.dealStageTransition.createMany({
    data: dealRows.map((deal) => ({
      id: `${deal.id}-initial-transition`,
      dealId: deal.id,
      fromStatus: null,
      toStatus: deal.status,
      createdAt: now,
    })),
  });

  const invoiceRows = [
    { id: `${prefix}-invoice-draft`, userId: ids.owner, dealId: `${prefix}-deal-masuk`, number: 'UX/DRAFT/001', subtotalIdr: 1_250_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.DRAFT, dueDate: null },
    { id: `${prefix}-invoice-sent`, userId: ids.owner, dealId: `${prefix}-deal-deal`, number: 'UX/SENT/002', subtotalIdr: 3_750_000, withholdingTaxType: WithholdingTaxType.PPH21, status: InvoiceStatus.SENT, dueDate: future },
    { id: `${prefix}-invoice-due`, userId: ids.owner, dealId: `${prefix}-deal-konten`, number: 'UX/DUE/003', subtotalIdr: 4_000_000, withholdingTaxType: WithholdingTaxType.PPH23, status: InvoiceStatus.DUE, dueDate: now },
    { id: `${prefix}-invoice-overdue`, userId: ids.owner, dealId: `${prefix}-deal-invoice`, number: 'UX/OVERDUE/004', subtotalIdr: 12_345_678, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.OVERDUE, dueDate: past },
    { id: `${prefix}-invoice-paid`, userId: ids.owner, dealId: `${prefix}-deal-paid`, number: 'UX/PAID/005', subtotalIdr: 5_000_000, withholdingTaxType: WithholdingTaxType.PPH23, status: InvoiceStatus.PAID, dueDate: past },
    { id: `${prefix}-invoice-other`, userId: ids.other, dealId: `${prefix}-deal-other`, number: 'UX/OTHER/001', subtotalIdr: 9_999_999, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.SENT, dueDate: future },
    { id: `${prefix}-invoice-quiet`, userId: ids.quiet, dealId: `${prefix}-deal-quiet`, number: 'UX/QUIET/001', subtotalIdr: 2_000_000, withholdingTaxType: WithholdingTaxType.NONE, status: InvoiceStatus.PAID, dueDate: past },
  ];
  await prisma.invoice.createMany({ data: invoiceRows });
  await prisma.invoiceShare.createMany({ data: [
    { id: `${prefix}-share-expired`, invoiceId: `${prefix}-invoice-paid`, tokenHash: sha256(publicTokens.expired), expiresAt: past },
  ] });
  // invoices.overdue gets its share created through the application's own
  // createOrRegenerateShare() (not a raw createMany row) so it carries a real
  // tokenCiphertext, matching what production always produces. A row seeded
  // directly with only a tokenHash (the prior approach) can be looked up
  // publicly but can never be recovered by the owner's own UI -- getShareState
  // treats a present-but-undecryptable share as "active but stale" and
  // disables the primary WhatsApp button, which made J21 have to revoke and
  // recreate the share before it could exercise the real send-reminder flow.
  // Passing a fixed tokenFactory keeps publicTokens.active's value stable for
  // the other suites (tests/ux-audit) that depend on it resolving to this
  // invoice.
  await createOrRegenerateShare(
    prisma as unknown as InvoiceShareDb,
    `${prefix}-invoice-overdue`,
    ids.owner,
    () => publicTokens.active,
    () => now,
  );

  // Owner gets a fully populated UserSettings row: F7/F8 public-document
  // evidence needs a real issuer identity and bank account to render (not
  // the "Detail rekening belum lengkap." fallback), and the main /pengaturan
  // "populated" capture is supposed to show a *complete* settings page. The
  // "zero" user deliberately gets no UserSettings row at all, so the
  // "incomplete-issuer-bank" capture state has a guaranteed, guarded reason
  // to show the "Lengkapi identitas dan rekening..." notice rather than
  // relying on it being incomplete by accident.
  await prisma.userSettings.create({
    data: {
      userId: ids.owner,
      issuerName: 'UX Fixture Owner',
      issuerAddress: 'Jl. Fixture Raya No. 1, Jakarta',
      issuerWhatsapp: '628199999999',
      issuerEmail: `${prefix}-owner@example.invalid`,
      bankName: 'Bank Fixture',
      bankAccountNumber: '1234567890',
      bankAccountHolder: 'UX Fixture Owner',
    },
  });

  const manifest = {
    schemaVersion: 1,
    prefix,
    host: normalizedHost,
    port: url.port,
    database: actualDatabase,
    users: ids,
    sessions: sessionTokens,
    quiet: { deal: `${prefix}-deal-quiet`, invoice: `${prefix}-invoice-quiet` },
    deals: {
      masuk: `${prefix}-deal-masuk`,
      nego: `${prefix}-deal-nego`,
      deal: `${prefix}-deal-deal`,
      konten: `${prefix}-deal-konten`,
      invoice: `${prefix}-deal-invoice`,
      dibayar: `${prefix}-deal-paid`,
      other: `${prefix}-deal-other`,
      many: [
        `${prefix}-deal-many-masuk-1`,
        `${prefix}-deal-many-masuk-2`,
        `${prefix}-deal-many-masuk-3`,
        `${prefix}-deal-many-nego-1`,
        `${prefix}-deal-many-nego-2`,
        `${prefix}-deal-many-deal-1`,
        `${prefix}-deal-many-deal-2`,
      ],
      overdueDeliverable: `${prefix}-deal-overdue-deliverable`,
    },
    invoices: {
      draft: `${prefix}-invoice-draft`,
      sent: `${prefix}-invoice-sent`,
      due: `${prefix}-invoice-due`,
      overdue: `${prefix}-invoice-overdue`,
      paid: `${prefix}-invoice-paid`,
      other: `${prefix}-invoice-other`,
    },
    publicTokens,
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(manifestPath, 0o600);
  await verify();
  console.log(JSON.stringify({ action: 'seed', host: normalizedHost, prefix, users: Object.keys(ids).length, deals: dealRows.length, invoices: invoiceRows.length, manifestMode: '0600' }));
}

async function verify() {
  const users = await prisma.user.findMany({
    where: { id: { in: Object.values(ids) } },
    select: {
      id: true,
      deals: {
        select: {
          id: true,
          status: true,
          contactWa: true,
          stageTransitions: { select: { fromStatus: true, toStatus: true, createdAt: true } },
        },
      },
      invoices: { select: { status: true, dueDate: true, withholdingTaxType: true, deal: { select: { id: true } } } },
      settings: {
        select: {
          issuerName: true,
          bankName: true,
          bankAccountNumber: true,
          bankAccountHolder: true,
        },
      },
    },
  });
  const owner = users.find((user) => user.id === ids.owner);
  const other = users.find((user) => user.id === ids.other);
  const zero = users.find((user) => user.id === ids.zero);
  const quiet = users.find((user) => user.id === ids.quiet);
  const ownerStages = new Set(owner?.deals.map((deal) => deal.status));
  const ownerStatuses = new Set(owner?.invoices.map((invoice) => invoice.status));
  const ownerSettingsRequiredFields = ['issuerName', 'bankName', 'bankAccountNumber', 'bankAccountHolder'] as const;
  // Guards the invoices.overdue share fix: the share must be recoverable by
  // the owner's own UI (a real tokenCiphertext that decrypts), not merely
  // present as a row -- see the createOrRegenerateShare() call in seed().
  const overdueShareState = await getShareState(prisma as unknown as InvoiceShareDb, `${prefix}-invoice-overdue`, ids.owner);
  const checks = {
    fourUsers: users.length === 4,
    ownerAllStages: Object.values(DealStatus).every((status) => ownerStages.has(status)),
    ownerAllInvoiceStatuses: Object.values(InvoiceStatus).every((status) => ownerStatuses.has(status)),
    secondOwnerIsolated: other?.deals.length === 1 && other.invoices.length === 1,
    zeroDeals: zero?.deals.length === 0 && zero.invoices.length === 0,
    invalidPhone: owner?.deals.some((deal) => deal.contactWa === 'not-a-phone') === true,
    emptyDueDate: owner?.invoices.some((invoice) => invoice.dueDate === null) === true,
    taxAndNoTax: owner?.invoices.some((invoice) => invoice.withholdingTaxType === WithholdingTaxType.NONE) === true
      && owner?.invoices.some((invoice) => invoice.withholdingTaxType !== WithholdingTaxType.NONE) === true,
    allParentsPresent: owner?.invoices.every((invoice) => Boolean(invoice.deal?.id)) === true,
    // Guards the F11 stage-history evidence: production createDeal() always
    // writes an initial DealStageTransition (fromStatus null, toStatus the
    // deal's starting status), but the seed above uses deal.createMany(),
    // which bypasses that path -- so this proves the fixture's own
    // dealStageTransition.createMany() call actually landed one initial row
    // per owner deal, not merely that deals exist.
    ownerDealsHaveInitialTransition: (owner?.deals.length ?? 0) > 0
      && owner!.deals.every((deal) =>
        deal.stageTransitions.some((transition) =>
          transition.fromStatus === null
          && transition.toStatus === deal.status
          && transition.createdAt instanceof Date
          && !Number.isNaN(transition.createdAt.getTime())
        )
      ),
    // Guards the F7/F8/"populated settings" evidence: the owner fixture must
    // actually have every field the settings form treats as required, and
    // the "zero" fixture must have no settings row at all, so the
    // incomplete-issuer-bank capture state is guaranteed rather than
    // incidental.
    ownerSettingsComplete: owner?.settings != null
      && ownerSettingsRequiredFields.every((field) => (owner.settings?.[field] ?? '').trim() !== ''),
    zeroSettingsMissing: zero?.settings == null,
    overdueShareRecoverable: overdueShareState.kind === 'state' && overdueShareState.status === 'active' && overdueShareState.path !== null,
    // UX-audit "many-deals" fixture: at least 4 cards in MASUK (1 original +
    // 3 many-fixture) so the desktop board actually renders a dense column,
    // not just one card per stage.
    manyDealsInMasuk: (owner?.deals.filter((deal) => deal.status === DealStatus.MASUK).length ?? 0) >= 4,
    // UX-audit "overdue-deliverable" fixture: a pre-INVOICE deal whose
    // deadline is already in the past (distinct from the invoice-overdue
    // fixture, which is a payment due-date overdue on an existing invoice).
    overdueDeliverablePresent: owner?.deals.some((deal) =>
      deal.id === `${prefix}-deal-overdue-deliverable`
      && deal.status !== DealStatus.INVOICE
      && deal.status !== DealStatus.DIBAYAR
    ) === true,
    // UX-audit "nothing-needs-chasing": `quiet` has real activity (unlike
    // `zero`) but its only invoice is PAID -- a terminal status that must
    // never surface in the FollowUpQueue regardless of due date.
    quietHasActivityButOnlyPaidInvoices: (quiet?.deals.length ?? 0) > 0
      && (quiet?.invoices.length ?? 0) > 0
      && quiet!.invoices.every((invoice) => invoice.status === InvoiceStatus.PAID),
  };
  if (Object.values(checks).some((value) => !value)) throw new Error(`Fixture verification failed: ${JSON.stringify(checks)}`);
  console.log(JSON.stringify({ action: 'verify', host: normalizedHost, prefix, checks }));
}

// Puts the invalid-phone fixture's number ('not-a-phone') back on its deal
// after tests/ux-audit/t27.verification.spec.ts repairs it through the UI.
// Written straight to the row: since #50 the API refuses a number WhatsApp
// can't open, so it can no longer be restored through PATCH /api/deals/:id.
async function restoreInvalidContact() {
  const result = await prisma.deal.updateMany({
    where: { id: `${prefix}-deal-masuk`, userId: ids.owner },
    data: { contactWa: 'not-a-phone' },
  });
  if (result.count !== 1) throw new Error(`Invalid-contact restore expected 1 row, updated ${result.count}`);
  console.log(JSON.stringify({ action: 'restore-invalid-contact', host: normalizedHost, prefix, updated: result.count }));
}

async function cleanup() {
  await cleanupRows();
  const remaining = await prisma.user.count({ where: { id: { in: Object.values(ids) } } });
  if (remaining !== 0) throw new Error(`Fixture cleanup read-back failed: ${remaining} users remain`);
  await rm(manifestPath, { force: true });
  console.log(JSON.stringify({ action: 'cleanup', host: normalizedHost, prefix, remainingUsers: remaining }));
}

async function main() {
  try {
    if (action === 'seed') await seed();
    else if (action === 'verify') await verify();
    else if (action === 'restore-invalid-contact') await restoreInvalidContact();
    else await cleanup();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown fixture error');
  process.exitCode = 1;
});
