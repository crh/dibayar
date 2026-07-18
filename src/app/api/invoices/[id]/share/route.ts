import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createOrRegenerateShare,
  getShareState,
  revokeShare,
  type InvoiceShareDb,
} from "@/lib/invoice-share";
import { prisma } from "@/lib/prisma";

const db = prisma as unknown as InvoiceShareDb;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

function json(body: unknown, status?: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

// Compares the Origin header against the request's own URL rather than any
// forwarded/host header, since only the Origin header reflects the caller's
// actual browser origin and can't be spoofed by an unauthenticated attacker.
function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return json({ error: "Kamu harus masuk terlebih dahulu." }, 401);
    }

    const { id } = await context.params;
    const result = await getShareState(db, id, session.user.id);
    if (result.kind === "not-found") {
      return json({ error: "Invoice tidak ditemukan." }, 404);
    }

    return json({ active: result.active });
  } catch {
    return json({ error: "Status berbagi belum bisa dimuat. Coba lagi." }, 500);
  }
}

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
    const result = await createOrRegenerateShare(db, id, session.user.id);
    if (result.kind === "not-found") {
      return json({ error: "Invoice tidak ditemukan." }, 404);
    }

    return json({ active: true, path: result.path });
  } catch {
    return json({ error: "Tautan berbagi belum bisa dibuat. Coba lagi." }, 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return json({ error: "Kamu harus masuk terlebih dahulu." }, 401);
    }
    if (!isSameOriginRequest(request)) {
      return json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, 403);
    }

    const { id } = await context.params;
    const result = await revokeShare(db, id, session.user.id);
    if (result.kind === "not-found") {
      return json({ error: "Invoice tidak ditemukan." }, 404);
    }

    return json({ active: false });
  } catch {
    return json({ error: "Tautan berbagi belum bisa dicabut. Coba lagi." }, 500);
  }
}
