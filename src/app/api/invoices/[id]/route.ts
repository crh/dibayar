import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import {
  getOwnedInvoice,
  updateInvoiceStatus,
  type InvoiceReadDb,
  type InvoiceStatusDb,
} from "@/lib/invoices";
import { invoiceStatusUpdateSchema } from "@/lib/invoice-validation";
import { prisma } from "@/lib/prisma";

const readDb = prisma as unknown as InvoiceReadDb;
const statusDb = prisma as unknown as InvoiceStatusDb;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }

    const { id } = await context.params;
    const invoice = await getOwnedInvoice(readDb, id, session.user.id);
    if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch {
    return NextResponse.json({ error: "Invoice belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
  }

  try {
    const { status } = invoiceStatusUpdateSchema.parse(await request.json());
    const { id } = await context.params;
    const result = await updateInvoiceStatus(statusDb, id, session.user.id, status);

    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    }
    if (result.kind === "invalid-transition") {
      return NextResponse.json({ error: "Status invoice tidak bisa diubah seperti itu." }, { status: 409 });
    }

    return NextResponse.json({ invoice: result.invoice });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Status invoice tidak valid." }, { status: 400 });
    }
    return NextResponse.json({ error: "Status invoice belum bisa diperbarui. Coba lagi." }, { status: 500 });
  }
}
