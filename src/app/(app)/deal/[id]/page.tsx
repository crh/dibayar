import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOwnedDeal, listDealStageTransitions, type DealDb } from "@/lib/deals";
import { findInvoiceByDealId, type InvoiceByDealDb } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import DealDetailClient from "./deal-detail-client";

export const dynamic = "force-dynamic";

const db = prisma as unknown as DealDb;
const invoiceDb = prisma as unknown as InvoiceByDealDb;

type DealDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdeal");
  }

  const { id } = await params;
  const deal = await getOwnedDeal(db, id, session.user.id);
  if (!deal) notFound();

  const [history, invoice] = await Promise.all([
    listDealStageTransitions(db, id),
    findInvoiceByDealId(invoiceDb, id, session.user.id),
  ]);

  return <DealDetailClient initialDeal={deal} history={history} initialInvoice={invoice} now={new Date()} />;
}
