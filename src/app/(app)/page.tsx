import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listDeals, type DealDb, type DealRecord } from "@/lib/deals";
import { listInvoices, type InvoiceReadDb, type InvoiceRecord } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import BerandaClient from "./beranda-client";

export const dynamic = "force-dynamic";

const db = prisma as unknown as DealDb;
const invoiceDb = prisma as unknown as InvoiceReadDb;

function settledValue<T>(result: PromiseSettledResult<T>): { value: T | null; error: boolean } {
  return result.status === "fulfilled" ? { value: result.value, error: false } : { value: null, error: true };
}

export default async function BerandaPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2F");
  }

  const [dealsResult, invoicesResult] = await Promise.allSettled([
    listDeals(db, session.user.id),
    listInvoices(invoiceDb, session.user.id),
  ]);
  const deals = settledValue<DealRecord[]>(dealsResult);
  const invoices = settledValue<InvoiceRecord[]>(invoicesResult);

  return (
    <BerandaClient
      deals={deals.value}
      dealsError={deals.error}
      invoices={invoices.value}
      invoicesError={invoices.error}
    />
  );
}
