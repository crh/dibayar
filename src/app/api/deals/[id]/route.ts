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

const db = prisma as unknown as DealDb;
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
  }

  const { id } = await context.params;
  const deal = await getOwnedDeal(db, id, session.user.id);
  if (!deal) return NextResponse.json({ error: "Deal tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ deal });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
  }

  const { id } = await context.params;
  try {
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

    return NextResponse.json({ error: "Deal belum bisa diperbarui. Coba lagi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deleteDeal(db, id, session.user.id);
  if (!deleted) return NextResponse.json({ error: "Deal tidak ditemukan." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
