import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { LanguageProvider } from "@/components/language-switcher";
import { getOwnedInvoice, type InvoiceReadDb } from "@/lib/invoices";
import { getUserLanguage, type UserLanguageDb } from "@/lib/user-language";
import { getUserSettings, type UserSettingsDb } from "@/lib/user-settings";
import { isIssuerIncomplete, resolveOwnerInvoiceDocument, type InvoiceDocumentDb } from "@/lib/invoice-snapshot";
import { prisma } from "@/lib/prisma";
import InvoiceDetailClient from "./invoice-detail-client";

export const dynamic = "force-dynamic";

const db = prisma as unknown as InvoiceReadDb;
const languageDb = prisma as unknown as UserLanguageDb;
const settingsDb = prisma as unknown as UserSettingsDb;
const documentDb = prisma as unknown as InvoiceDocumentDb;

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Finvoice");
  }

  const { id } = await params;
  const [invoice, language, settings] = await Promise.all([
    getOwnedInvoice(db, id, session.user.id),
    getUserLanguage(languageDb, session.user.id),
    getUserSettings(settingsDb, session.user.id),
  ]);
  if (!invoice) notFound();

  // The notice describes the document as the brand gets it: a sent or
  // shared invoice keeps the issuer and bank details it was frozen with
  // (Decision A), so saving Pengaturan no longer completes it.
  const document = await resolveOwnerInvoiceDocument(documentDb, invoice);
  const documentFrozen = document?.frozen ?? false;
  const hasIncompleteIssuer = document ? isIssuerIncomplete(document.input.settings) : false;

  return (
    <LanguageProvider initialLanguage={language} authenticated>
      <InvoiceDetailClient
        initialInvoice={invoice}
        hasIncompleteIssuer={hasIncompleteIssuer}
        documentFrozen={documentFrozen}
        templateSend={settings.templateSend}
        templateChase={settings.templateChase}
      />
    </LanguageProvider>
  );
}
