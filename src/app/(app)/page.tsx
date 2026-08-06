import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LanguageProvider } from "@/components/language-switcher";
import { listDeals, type DealDb } from "@/lib/deals";
import { listInvoices, type InvoiceReadDb } from "@/lib/invoices";
import { getUserLanguage, type UserLanguageDb } from "@/lib/user-language";
import { prisma } from "@/lib/prisma";
import DashboardClient from "../dashboard-client";

export const dynamic = "force-dynamic";

const db = prisma as unknown as DealDb;
const invoiceDb = prisma as unknown as InvoiceReadDb;
const languageDb = prisma as unknown as UserLanguageDb;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdashboard");
  }

  const [deals, invoices, language] = await Promise.all([
    listDeals(db, session.user.id),
    listInvoices(invoiceDb, session.user.id),
    getUserLanguage(languageDb, session.user.id),
  ]);
  return (
    <LanguageProvider initialLanguage={language} authenticated>
      <DashboardClient initialDeals={deals} initialInvoices={invoices} userName={session.user.name} />
    </LanguageProvider>
  );
}
