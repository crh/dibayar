import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getPublicInvoicePdfDataByToken, type PublicInvoiceLookupDb } from "@/lib/invoice-share";
import { InvoicePdf } from "@/lib/invoice-pdf";
import { publicInvoicePdfRateLimiter } from "@/lib/rate-limit";
import { bestEffortClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const db = prisma as unknown as PublicInvoiceLookupDb;

const RECIPIENT_SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
} as const;

function safeFileName(invoiceNumber: string) {
  return invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-");
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: RECIPIENT_SAFE_HEADERS });
}

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  const key = `pdf:${bestEffortClientIp(request.headers)}`;
  const limit = publicInvoicePdfRateLimiter.check(key);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      {
        status: 429,
        headers: {
          ...RECIPIENT_SAFE_HEADERS,
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  try {
    const { token } = await context.params;
    const data = await getPublicInvoicePdfDataByToken(db, token);
    if (!data) {
      return jsonError("Invoice tidak ditemukan.", 404);
    }

    const document = createElement(InvoicePdf, data) as unknown as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    const pdfBytes = new Uint8Array(pdf.length);
    pdfBytes.set(pdf);
    const fileName = `${safeFileName(data.invoice.number)}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        ...RECIPIENT_SAFE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return jsonError("PDF invoice belum bisa dibuat. Coba lagi.", 500);
  }
}
