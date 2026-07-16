import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { getOwnedDeal, type DealDb } from "@/lib/deals";
import { getOwnedInvoice, type InvoiceReadDb } from "@/lib/invoices";
import { InvoicePdf } from "@/lib/invoice-pdf";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const invoiceDb = prisma as unknown as InvoiceReadDb;
const dealDb = prisma as unknown as DealDb;

type PdfRouteContext = { params: Promise<{ id: string }> };

function safeFileName(invoiceNumber: string) {
  return invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-");
}

export async function GET(_request: Request, context: PdfRouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
  }

  const { id } = await context.params;
  const invoice = await getOwnedInvoice(invoiceDb, id, session.user.id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const deal = await getOwnedDeal(dealDb, invoice.dealId, session.user.id);
  const document = createElement(InvoicePdf, { invoice, deal }) as unknown as ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(document);
  const pdfBytes = new Uint8Array(pdf.length);
  pdfBytes.set(pdf);
  const fileName = `${safeFileName(invoice.number)}.pdf`;

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
