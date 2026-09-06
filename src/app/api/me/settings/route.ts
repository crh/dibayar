import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { getUserSettings, saveUserSettings, type UserSettingsDb } from "@/lib/user-settings";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";
import { userSettingsRateLimiter } from "@/lib/rate-limit";

const db = prisma as unknown as UserSettingsDb;

// Never logs the request body or the resolved settings view: both can carry
// bank/account and issuer contact details (see CLAUDE.md redaction rule).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }

    const settings = await getUserSettings(db, session.user.id);
    return NextResponse.json({ settings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Pengaturan belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, { status: 403 });
    }

    const limit = userSettingsRateLimiter.check(session.user.id);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
      );
    }

    const settings = await saveUserSettings(db, session.user.id, await request.json());
    return NextResponse.json({ settings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Periksa kembali data pengaturan kamu.", fields: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Periksa kembali data pengaturan kamu." }, { status: 400 });
    }

    return NextResponse.json({ error: "Pengaturan belum bisa disimpan. Coba lagi." }, { status: 500 });
  }
}
