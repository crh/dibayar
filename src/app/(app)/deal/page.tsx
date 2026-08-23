import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listDeals, type DealDb } from "@/lib/deals";
import { listInvoices, type InvoiceReadDb } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import DealClient from "./deal-client";

export const dynamic = "force-dynamic";

const db = prisma as unknown as DealDb;
const invoiceDb = prisma as unknown as InvoiceReadDb;

type DealPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DealPage({ searchParams }: DealPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdeal");
  }

  const params = await searchParams;
  const tambahParam = Array.isArray(params.tambah) ? params.tambah[0] : params.tambah;

  const [deals, invoices] = await Promise.all([
    listDeals(db, session.user.id),
    listInvoices(invoiceDb, session.user.id),
  ]);

  return (
    <DealClient
      initialDeals={deals}
      initialInvoices={invoices}
      initialDialogOpen={tambahParam === "1"}
    />
  );
}
