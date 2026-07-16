import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOwnedInvoice, type InvoiceReadDb } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";

const db = prisma as unknown as InvoiceReadDb;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
  }

  const { id } = await context.params;
  const invoice = await getOwnedInvoice(db, id, session.user.id);
  if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ invoice });
}
