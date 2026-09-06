import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import {
  getOwnedInvoice,
  updateInvoiceDueDate,
  updateInvoiceStatus,
  type InvoiceDueDateDb,
  type InvoiceReadDb,
  type InvoiceStatusDb,
} from "@/lib/invoices";
import { invoiceDueDateUpdateSchema, invoiceStatusUpdateSchema } from "@/lib/invoice-validation";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

const readDb = prisma as unknown as InvoiceReadDb;
const statusDb = prisma as unknown as InvoiceStatusDb;
const dueDateDb = prisma as unknown as InvoiceDueDateDb;
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

// The body shape decides which single field this PATCH updates: a `dueDate`
// key (including explicit null, to clear it) targets the due date; otherwise
// it's treated as the original `{ status }` transition request.
export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, { status: 403 });
    }

    body = await request.json();
    const { id } = await context.params;

    if (typeof body === "object" && body !== null && "dueDate" in body) {
      const { dueDate } = invoiceDueDateUpdateSchema.parse(body);
      const result = await updateInvoiceDueDate(dueDateDb, id, session.user.id, dueDate);

      if (result.kind === "not-found") {
        return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
      }
      return NextResponse.json({ invoice: result.invoice });
    }

    const { status } = invoiceStatusUpdateSchema.parse(body);
    const result = await updateInvoiceStatus(statusDb, id, session.user.id, status);

    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    }
    if (result.kind === "invalid-transition") {
      return NextResponse.json({ error: "Status invoice tidak bisa diubah seperti itu." }, { status: 409 });
    }

    return NextResponse.json({ invoice: result.invoice });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      const isDueDateAttempt = typeof body === "object" && body !== null && "dueDate" in body;
      const message = isDueDateAttempt ? "Tanggal jatuh tempo tidak valid." : "Status invoice tidak valid.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Status invoice belum bisa diperbarui. Coba lagi." }, { status: 500 });
  }
}
