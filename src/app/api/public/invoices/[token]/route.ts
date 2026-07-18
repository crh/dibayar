import { NextResponse } from "next/server";
import { getPublicInvoiceByToken, type PublicInvoiceLookupDb } from "@/lib/invoice-share";
import { publicInvoiceJsonRateLimiter } from "@/lib/rate-limit";
import { bestEffortClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";

const db = prisma as unknown as PublicInvoiceLookupDb;

const RECIPIENT_SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
} as const;

function json(body: unknown, init: { status?: number; headers?: HeadersInit } = {}) {
  return NextResponse.json(body, {
    status: init.status,
    headers: { ...RECIPIENT_SAFE_HEADERS, ...init.headers },
  });
}

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  const key = `json:${bestEffortClientIp(request.headers)}`;
  const limit = publicInvoiceJsonRateLimiter.check(key);
  if (!limit.allowed) {
    return json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    const { token } = await context.params;
    const invoice = await getPublicInvoiceByToken(db, token);
    if (!invoice) {
      return json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    }

    return json({ invoice });
  } catch {
    return json({ error: "Invoice belum bisa dimuat. Coba lagi." }, { status: 500 });
  }
}
