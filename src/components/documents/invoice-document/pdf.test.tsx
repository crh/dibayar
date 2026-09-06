import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocumentPdf } from "./pdf";
import { buildInvoiceDocumentModel, type InvoiceDocumentInput } from "./model";

// Walks the raw React element tree (no DOM/PDF renderer needed) so string
// leaves can be asserted on directly. Mirrors the pattern the old
// invoice-pdf.test.tsx used for the same reason: InvoiceDocumentPdf takes
// only `model` -- no language prop exists to thread a UI language into a
// recipient-facing PDF, so this also pins that contract down.
const NBSP = String.fromCharCode(0x00a0);

function collectText(node: ReactNode, out: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  if (typeof node === "object" && "props" in node) {
    collectText((node as { props: { children?: ReactNode } }).props.children, out);
  }
  return out;
}

const fullInput: InvoiceDocumentInput = {
  invoice: {
    id: "invoice-1",
    number: "INV/2026/08/001",
    subtotalIdr: 3_200_000,
    withholdingTaxType: "PPH23",
    dueDate: "2026-10-15T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  deal: {
    brand: "Warung Kopi Senja",
    contactName: "Budi",
    scope: "1 Reel + 2 Story",
    paymentTerms: "Pembayaran penuh di muka",
  },
  settings: {
    issuerName: "Aulia Rahma",
    issuerAddress: "Jl. Melati No. 5, Bandung",
    issuerWhatsapp: "0812-3456-7890",
    issuerEmail: "aulia@example.com",
    bankName: "BCA",
    bankAccountNumber: "1234567890",
    bankAccountHolder: "Aulia Rahma",
  },
};

function renderTree(input: InvoiceDocumentInput = fullInput) {
  const model = buildInvoiceDocumentModel(input);
  return collectText(InvoiceDocumentPdf({ model })).join(" ");
}

describe("InvoiceDocumentPdf", () => {
  it("renders every field from a fully populated invoice, matching the HTML adapter's content", () => {
    const text = renderTree();

    expect(text).toContain("INVOICE");
    expect(text).toContain("INV/2026/08/001");
    expect(text).toContain("1 Agustus 2026");
    expect(text).toContain("Aulia Rahma");
    expect(text).toContain("Jl. Melati No. 5, Bandung");
    expect(text).toContain("0812-3456-7890");
    expect(text).toContain("aulia@example.com");
    expect(text).toContain("Warung Kopi Senja");
    expect(text).toContain("Budi");
    expect(text).toContain("1 Reel + 2 Story");
    expect(text).toContain(`Rp${NBSP}3.200.000`);
    expect(text).toContain("PPh 23");
    expect(text).toContain("Pembayaran penuh di muka");
    expect(text).toContain("15 Oktober 2026");
    expect(text).toContain("BCA");
    expect(text).toContain("1234567890");
    expect(text).toContain("Dokumen ini dibuat otomatis. Hubungi pengirim untuk pertanyaan.");
  });

  it("has no language prop available to change the output away from Indonesian", () => {
    const text = renderTree();
    expect(text).not.toMatch(/billed to|due date|withholding|invoice amount|thank you/i);
  });

  it("renders the issuer name as an em dash, never blank, when Settings has no issuer name", () => {
    const text = renderTree({ ...fullInput, settings: { ...fullInput.settings, issuerName: "" } });
    expect(text).toContain("—");
  });

  it("omits the issuer address/WhatsApp/email lines when missing, without leaving blanks", () => {
    const text = renderTree({
      ...fullInput,
      settings: { ...fullInput.settings, issuerAddress: "", issuerWhatsapp: "", issuerEmail: "" },
    });
    expect(text).not.toContain("Jl. Melati No. 5, Bandung");
    expect(text).not.toContain("0812-3456-7890");
    expect(text).not.toContain("aulia@example.com");
  });

  it("omits the contact-name line but keeps the brand when the deal has no contact name", () => {
    const text = renderTree({ ...fullInput, deal: { ...fullInput.deal, contactName: null } });
    expect(text).toContain("Warung Kopi Senja");
    expect(text).not.toContain("Budi");
  });

  it("falls back to the canonical scope description when the deal scope is empty", () => {
    const text = renderTree({ ...fullInput, deal: { ...fullInput.deal, scope: "" } });
    expect(text).toContain("Jasa kerja sama konten");
  });

  it("omits the entire terms block when payment terms are empty, even with a due date set", () => {
    const text = renderTree({ ...fullInput, deal: { ...fullInput.deal, paymentTerms: null } });
    expect(text).not.toContain("Syarat pembayaran");
    expect(text).not.toContain("Jatuh tempo");
  });

  it("keeps the terms block but omits only the due-date line when the due date is missing", () => {
    const text = renderTree({ ...fullInput, invoice: { ...fullInput.invoice, dueDate: null } });
    expect(text).toContain("Syarat pembayaran");
    expect(text).toContain("Pembayaran penuh di muka");
    expect(text).not.toContain("Jatuh tempo");
  });

  it("shows the visible incomplete-account notice when any bank field is missing", () => {
    const text = renderTree({ ...fullInput, settings: { ...fullInput.settings, bankAccountNumber: "" } });
    expect(text).toContain("Detail rekening belum lengkap.");
  });

  it("generates a real, non-empty PDF buffer when every optional field is empty (T-24 acceptance)", async () => {
    const model = buildInvoiceDocumentModel({
      invoice: {
        id: "invoice-1",
        number: "INV/2026/08/002",
        subtotalIdr: 500_000,
        withholdingTaxType: "NONE",
        dueDate: null,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
      deal: { brand: "Brand Kosong", contactName: null, scope: "", paymentTerms: null },
      settings: {
        issuerName: "",
        issuerAddress: "",
        issuerWhatsapp: "",
        issuerEmail: "",
        bankName: "",
        bankAccountNumber: "",
        bankAccountHolder: "",
      },
    });

    const buffer = await renderToBuffer(<InvoiceDocumentPdf model={model} />);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
