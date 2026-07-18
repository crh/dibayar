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

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return json({ error: "Kamu harus masuk terlebih dahulu." }, 401);
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return json({ error: "Kamu harus masuk terlebih dahulu." }, 401);
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
