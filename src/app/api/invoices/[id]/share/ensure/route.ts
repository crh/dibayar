import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureShare, type InvoiceShareDb } from "@/lib/invoice-share";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

const db = prisma as unknown as InvoiceShareDb;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

function json(body: unknown, status?: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

type RouteContext = { params: Promise<{ id: string }> };

// "Give me a link I can send": reuses the invoice's usable share link and
// only issues a new one when there is none (ensureShare). Separate from
// POST ../share, which always rotates and stays the explicit "Buat ulang
// tautan" operation. A POST because it may create a share.
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return json({ error: "Kamu harus masuk terlebih dahulu." }, 401);
    }
    if (!isSameOriginRequest(request)) {
      return json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, 403);
    }

    const { id } = await context.params;
    const result = await ensureShare(db, id, session.user.id);
    if (result.kind === "not-found") {
      return json({ error: "Invoice tidak ditemukan." }, 404);
    }

    return json({ active: true, path: result.path, expiresAt: result.expiresAt });
  } catch {
    return json({ error: "Tautan berbagi belum bisa dibuat. Coba lagi." }, 500);
  }
}
