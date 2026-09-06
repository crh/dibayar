import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getPublicInvoiceDocumentByToken, type PublicInvoiceDocumentLookupDb } from "@/lib/invoice-share";
import { buildInvoiceDocumentModel } from "@/components/documents/invoice-document/model";
import { InvoiceDocumentPdf } from "@/components/documents/invoice-document/pdf";
import { publicInvoicePdfRateLimiter } from "@/lib/rate-limit";
import { bestEffortClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const db = prisma as unknown as PublicInvoiceDocumentLookupDb;

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
    const lookup = await getPublicInvoiceDocumentByToken(db, token);
    // Both "invalid" and "expired" return the same 404 here (unlike the
    // page, which gives "expired" its own typed state) -- this is a JSON
    // API response, not a UI, and the two cases have identical practical
    // meaning to a caller: no PDF is available for this token right now.
    if (lookup.kind !== "ok") {
      return jsonError("Invoice tidak ditemukan.", 404);
    }

    const model = buildInvoiceDocumentModel(lookup.input);
    const document = createElement(InvoiceDocumentPdf, { model }) as unknown as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    const pdfBytes = new Uint8Array(pdf.length);
    pdfBytes.set(pdf);
    const fileName = `${safeFileName(model.header.number)}.pdf`;

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
