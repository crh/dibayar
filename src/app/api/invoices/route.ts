import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { createInvoice, listInvoices, type InvoiceCreateDb, type InvoiceReadDb } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";

const db = prisma as unknown as InvoiceCreateDb;
const readDb = prisma as unknown as InvoiceReadDb;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
  }

  const invoices = await listInvoices(readDb, session.user.id);
  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
  }

  try {
    const invoice = await createInvoice(db, session.user.id, await request.json());
    if (!invoice) {
      return NextResponse.json({ error: "Deal tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Periksa kembali data invoice kamu.", fields: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Invoice belum bisa dibuat. Coba lagi." }, { status: 500 });
  }
}
