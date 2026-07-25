import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { updateUserLanguage, type UserLanguageDb } from "@/lib/user-language";
import { userLanguageUpdateSchema } from "@/lib/user-language-validation";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";
import { userLanguageRateLimiter } from "@/lib/rate-limit";

const db = prisma as unknown as UserLanguageDb;

// Persists the signed-in creator's language preference to the DB so it
// follows them across devices. Never trusts a client-supplied user id — the
// update is always scoped to the authenticated session's own id.
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Permintaan ditolak. Muat ulang halaman lalu coba lagi." }, { status: 403 });
    }

    const limit = userLanguageRateLimiter.check(session.user.id);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body = await request.json();
    const { language } = userLanguageUpdateSchema.parse(body);
    await updateUserLanguage(db, session.user.id, language);

    return NextResponse.json({ language }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Bahasa tidak valid." }, { status: 400 });
    }
    return NextResponse.json({ error: "Preferensi bahasa belum bisa disimpan. Coba lagi." }, { status: 500 });
  }
}
