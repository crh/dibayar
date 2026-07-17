import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { createDeal, listDeals, type DealDb } from "@/lib/deals";
import { prisma } from "@/lib/prisma";

const db = prisma as unknown as DealDb;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }

    const deals = await listDeals(db, session.user.id);
    return NextResponse.json({ deals });
  } catch {
    return NextResponse.json({ error: "Deal belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }

    const deal = await createDeal(db, session.user.id, await request.json());
    return NextResponse.json({ deal }, { status: 201 });
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

    return NextResponse.json({ error: "Deal belum bisa disimpan. Coba lagi." }, { status: 500 });
  }
}
