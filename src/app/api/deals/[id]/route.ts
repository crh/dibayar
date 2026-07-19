import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import {
  deleteDeal,
  getOwnedDeal,
  updateDeal,
  type DealDb,
} from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

const db = prisma as unknown as DealDb;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }

    const { id } = await context.params;
    const deal = await getOwnedDeal(db, id, session.user.id);
    if (!deal) return NextResponse.json({ error: "Deal tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ deal });
  } catch {
    return NextResponse.json({ error: "Deal belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, { status: 403 });
    }

    const { id } = await context.params;
    const deal = await updateDeal(db, id, session.user.id, await request.json());
    if (!deal) return NextResponse.json({ error: "Deal tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ deal });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Periksa kembali data deal kamu.", fields: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Periksa kembali data deal kamu." }, { status: 400 });
    }

    return NextResponse.json({ error: "Deal belum bisa diperbarui. Coba lagi." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, { status: 403 });
    }

    const { id } = await context.params;
    const result = await deleteDeal(db, id, session.user.id);
    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Deal tidak ditemukan." }, { status: 404 });
    }
    if (result.kind === "has-invoices") {
      return NextResponse.json(
        { error: "Deal ini punya invoice, jadi belum bisa dihapus." },
        { status: 409 },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Deal belum bisa dihapus. Coba lagi." }, { status: 500 });
  }
}
