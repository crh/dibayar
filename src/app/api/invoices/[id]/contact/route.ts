import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOwnedInvoiceContact, type InvoiceContactDb } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";

const db = prisma as unknown as InvoiceContactDb;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });

    const { id } = await context.params;
    const result = await getOwnedInvoiceContact(db, id, session.user.id);
    if (!result) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });

    return NextResponse.json(
      { contactWa: result.deal.contactWa, brand: result.deal.brand },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Kontak invoice belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}
