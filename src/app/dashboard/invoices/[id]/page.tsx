import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { LanguageProvider } from "@/components/language-switcher";
import { getOwnedInvoice, type InvoiceReadDb } from "@/lib/invoices";
import { getUserLanguage, type UserLanguageDb } from "@/lib/user-language";
import { prisma } from "@/lib/prisma";
import InvoiceDetailClient from "./invoice-detail-client";

export const dynamic = "force-dynamic";

const db = prisma as unknown as InvoiceReadDb;
const languageDb = prisma as unknown as UserLanguageDb;

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdashboard");
  }

  const { id } = await params;
  const [invoice, language] = await Promise.all([
    getOwnedInvoice(db, id, session.user.id),
    getUserLanguage(languageDb, session.user.id),
  ]);
  if (!invoice) notFound();

  return (
    <LanguageProvider initialLanguage={language} authenticated>
      <InvoiceDetailClient initialInvoice={invoice} />
    </LanguageProvider>
  );
}
