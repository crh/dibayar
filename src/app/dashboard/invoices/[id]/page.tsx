import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOwnedInvoice, type InvoiceReadDb } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import InvoiceDetailClient from "./invoice-detail-client";

export const dynamic = "force-dynamic";

const db = prisma as unknown as InvoiceReadDb;

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdashboard");
  }

  const { id } = await params;
  const invoice = await getOwnedInvoice(db, id, session.user.id);
  if (!invoice) notFound();

  return <InvoiceDetailClient initialInvoice={invoice} />;
}
