import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { getOwnedInvoice, type InvoiceReadDb } from "@/lib/invoices";
import { resolveOwnerInvoiceDocument, type InvoiceDocumentDb } from "@/lib/invoice-snapshot";
import { buildInvoiceDocumentModel } from "@/components/documents/invoice-document/model";
import { InvoiceDocumentPdf } from "@/components/documents/invoice-document/pdf";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const invoiceDb = prisma as unknown as InvoiceReadDb;
const documentDb = prisma as unknown as InvoiceDocumentDb;

type PdfRouteContext = { params: Promise<{ id: string }> };

function safeFileName(invoiceNumber: string) {
  return invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-");
}

export async function GET(_request: Request, context: PdfRouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Kamu harus masuk terlebih dahulu." }, { status: 401 });
    }

    const { id } = await context.params;
    const invoice = await getOwnedInvoice(invoiceDb, id, session.user.id);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    }

    // A sent or shared invoice renders its Decision A snapshot; only a
    // never-exposed Draft follows the deal and Settings. The FK is ON DELETE
    // RESTRICT (see prisma/schema.prisma), so a deal missing for an existing
    // invoice shouldn't happen in practice -- but it stays a controlled 404
    // rather than a crash if it ever did.
    const document = await resolveOwnerInvoiceDocument(documentDb, invoice);
    if (!document) {
      return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    }

    const model = buildInvoiceDocumentModel(document.input);
    const pdfDocument = createElement(InvoiceDocumentPdf, { model }) as unknown as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(pdfDocument);
    const pdfBytes = new Uint8Array(pdf.length);
    pdfBytes.set(pdf);
    const fileName = `${safeFileName(model.header.number)}.pdf`;

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF invoice belum bisa dibuat. Coba lagi." }, { status: 500 });
  }
}
