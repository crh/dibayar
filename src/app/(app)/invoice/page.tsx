import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listInvoicesWithDealBrand, type InvoiceListDb } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import { InvoiceList } from "@/components/invoices/invoice-list";

export const dynamic = "force-dynamic";

const db = prisma as unknown as InvoiceListDb;

export default async function InvoicePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Finvoice");
  }

  const invoices = await listInvoicesWithDealBrand(db, session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 py-8 sm:px-8">
      <h1 className="text-[26px] font-bold text-ink">Invoice</h1>
      <InvoiceList invoices={invoices} />
    </main>
  );
}
