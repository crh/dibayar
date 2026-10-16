import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { createInvoiceOnce, listInvoices, type InvoiceCreateOnceDb, type InvoiceReadDb } from "@/lib/invoices";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";
import { IdempotencyConflictError, readIdempotencyKey } from "@/lib/idempotency";

const db = prisma as unknown as InvoiceCreateOnceDb;
const readDb = prisma as unknown as InvoiceReadDb;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }

    const invoices = await listInvoices(readDb, session.user.id);
    return NextResponse.json({ invoices });
  } catch {
    return NextResponse.json({ error: "Invoice belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, { status: 403 });
    }

    const idempotency = readIdempotencyKey(request);
    if (!idempotency.ok) {
      return NextResponse.json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, { status: 400 });
    }

    const created = await createInvoiceOnce(db, session.user.id, await request.json(), idempotency.key);
    if (!created) {
      return NextResponse.json({ error: "Deal tidak ditemukan." }, { status: 404 });
    }
    // A repeat of a stored create (same key) answers 200 with that invoice.
    return NextResponse.json({ invoice: created.record }, { status: created.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Periksa kembali data invoice kamu.", fields: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: "Permintaan ini bentrok dengan permintaan sebelumnya. Muat ulang halaman lalu coba lagi." },
        { status: 409 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Periksa kembali data invoice kamu." }, { status: 400 });
    }

    return NextResponse.json({ error: "Invoice belum bisa dibuat. Coba lagi." }, { status: 500 });
  }
}
