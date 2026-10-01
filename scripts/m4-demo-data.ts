// M4 moderator demo data for the long-lived Neon `staging` branch only.
// Unlike scripts/ux-fixtures.ts and scripts/e2e-fixtures.ts (pinned to the
// disposable local Postgres), this writes to hosted staging so a moderator can
// sign in to https://dibayar-git-staging-kenji-iwakura.vercel.app with their
// own Google account and see a realistic, fully synthetic creator workspace.
//
// Safety: refuses unless DATABASE_URL's endpoint is the Neon staging endpoint
// and M4_DEMO_CONFIRM=staging (see checkM4DemoTarget). Owner-scoped: it only
// touches rows belonging to the user whose email is M4_DEMO_OWNER_EMAIL, and
// never prints that email, the connection string, or any token.
//
// Data goes through the app's own createDeal/updateDeal/createInvoice/
// updateInvoiceStatus/saveUserSettings, so stage history, invoice numbers, and
// status transitions match real use. Share links are NOT seeded: they are
// encrypted with the deployment's key, so the moderator creates one in the UI.
//
//   seed   reset, then create the dataset (dates relative to "now", Jakarta)
//   verify read back and print aggregate checks
//   reset  delete ALL of the demo owner's deals/invoices/invoice sequences
//          (including deals created live during a session); keeps the
//          user, Google account link, sessions, and settings
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createDeal, updateDeal, type DealDb } from "../src/lib/deals";
import { summarizeMonthlyIncome } from "../src/lib/income-summary";
import { selectAttentionInvoices } from "../src/lib/invoice-date-status";
import {
  createInvoice,
  updateInvoiceStatus,
  type InvoiceCreateDb,
  type InvoiceRecord,
  type InvoiceStatusDb,
} from "../src/lib/invoices";
import { M4_DEMO_DEALS, M4_DEMO_SETTINGS, checkM4DemoTarget, jakartaDateOffset } from "../src/lib/m4-demo-dataset";
import { saveUserSettings, type UserSettingsDb } from "../src/lib/user-settings";

const action = process.argv[2];
if (!["seed", "verify", "reset"].includes(action ?? "")) {
  throw new Error("Usage: tsx scripts/m4-demo-data.ts seed|verify|reset");
}

const target = checkM4DemoTarget(process.env.DATABASE_URL, process.env.M4_DEMO_CONFIRM);
if (!target.ok) throw new Error(`Refusing database action: ${target.reason}`);
const ownerEmail = process.env.M4_DEMO_OWNER_EMAIL?.trim();
if (!ownerEmail) throw new Error("M4_DEMO_OWNER_EMAIL is required (the moderator's staging sign-in email)");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });

async function resolveOwnerId() {
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error("Demo owner not found on staging: sign in once on the staging URL first");
  return owner.id;
}

async function reset(userId: string) {
  // Invoice -> Deal is onDelete: Restrict, so invoices go first; shares cascade.
  const invoices = await prisma.invoice.deleteMany({ where: { userId } });
  const deals = await prisma.deal.deleteMany({ where: { userId } });
  await prisma.invoiceSequence.deleteMany({ where: { userId } });
  return { deletedInvoices: invoices.count, deletedDeals: deals.count };
}

async function seed(userId: string) {
  const resetResult = await reset(userId);
  const now = new Date();
  await saveUserSettings(prisma as unknown as UserSettingsDb, userId, M4_DEMO_SETTINGS);

  for (const demo of M4_DEMO_DEALS) {
    const { deadlineOffsetDays, ...input } = demo.input;
    const deal = await createDeal(prisma as unknown as DealDb, userId, {
      ...input,
      status: "MASUK",
      deadline: deadlineOffsetDays === undefined ? undefined : jakartaDateOffset(now, deadlineOffsetDays),
    });
    for (const stage of demo.stages) {
      await updateDeal(prisma as unknown as DealDb, deal.id, userId, { status: stage });
    }
    if (!demo.invoice) continue;
    const invoice = await createInvoice(prisma as unknown as InvoiceCreateDb, userId, {
      dealId: deal.id,
      withholdingTaxType: demo.invoice.withholdingTaxType,
      dueDate: jakartaDateOffset(now, demo.invoice.dueOffsetDays),
    });
    if (!invoice) throw new Error(`Invoice creation failed for demo deal ${demo.key}`);
    for (const status of demo.invoice.statusPath.slice(1)) {
      const result = await updateInvoiceStatus(prisma as unknown as InvoiceStatusDb, invoice.id, userId, status);
      if (result.kind !== "updated") throw new Error(`Invoice transition to ${status} failed for ${demo.key}: ${result.kind}`);
    }
  }
  console.log(JSON.stringify({ action: "seed", target: target.ok ? target.host : null, ...resetResult }));
  await verify(userId);
}

async function verify(userId: string) {
  const now = new Date();
  const deals = await prisma.deal.findMany({ where: { userId }, select: { brand: true, status: true } });
  const invoices = (await prisma.invoice.findMany({ where: { userId } })) as InvoiceRecord[];
  const shares = await prisma.invoiceShare.count({ where: { invoice: { userId } } });
  const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { issuerName: true, bankName: true } });
  const summary = summarizeMonthlyIncome(invoices, now);
  const attention = selectAttentionInvoices(invoices, now);
  const demoBrands = new Set(M4_DEMO_DEALS.map((deal) => deal.input.brand));
  const checks = {
    allDemoDealsPresent: M4_DEMO_DEALS.every((demo) => deals.some((deal) => deal.brand === demo.input.brand)),
    onlyDemoDeals: deals.every((deal) => demoBrands.has(deal.brand)),
    syntheticSettings: settings?.issuerName === M4_DEMO_SETTINGS.issuerName && settings.bankName === M4_DEMO_SETTINGS.bankName,
    draftPresent: invoices.some((invoice) => invoice.status === "DRAFT"),
    oneOverdue: attention.overdue.length === 1,
    oneDueSoon: attention.dueSoon.length === 1,
  };
  console.log(JSON.stringify({
    action: "verify",
    target: target.ok ? target.host : null,
    jakartaMonth: summary.label,
    deals: deals.length,
    dealStages: deals.map((deal) => deal.status).sort(),
    invoices: invoices.map((invoice) => ({ number: invoice.number, status: invoice.status, pph: invoice.withholdingTaxType })),
    shares,
    summary: { invoiceCount: summary.invoiceCount, grossIdr: summary.grossIdr, withholdingIdr: summary.withholdingIdr, netIdr: summary.netIdr },
    followUp: { overdue: attention.overdue.length, dueSoon: attention.dueSoon.map((invoice) => invoice.daysUntilDue) },
    checks,
  }));
  // onlyDemoDeals is informational after a session (live-created deals are
  // expected); the rest must hold right after seed.
  const required = Object.entries(checks).filter(([name]) => name !== "onlyDemoDeals");
  if (required.some(([, value]) => !value)) process.exitCode = 1;
}

async function main() {
  try {
    const userId = await resolveOwnerId();
    if (action === "seed") await seed(userId);
    else if (action === "verify") await verify(userId);
    else console.log(JSON.stringify({ action: "reset", target: target.ok ? target.host : null, ...(await reset(userId)) }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown demo-data error");
  process.exitCode = 1;
});
