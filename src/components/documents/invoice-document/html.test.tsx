import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceDocumentHtml } from "./html";
import { buildInvoiceDocumentModel, type InvoiceDocumentInput } from "./model";

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

function renderDoc(input: InvoiceDocumentInput = fullInput) {
  const model = buildInvoiceDocumentModel(input);
  render(<InvoiceDocumentHtml model={model} />);
}

describe("InvoiceDocumentHtml", () => {
  it("renders every field from a fully populated invoice, in the spec §5.3 order", () => {
    renderDoc();

    const article = screen.getByText("INVOICE").closest("article")!;
    const order = [
      "INVOICE",
      "Nomor invoice:",
      "Tanggal terbit:",
      "Dari",
      "Ditagihkan kepada",
      "Deskripsi",
      "Jumlah",
      "Total",
      "Pajak potong",
      "Syarat pembayaran",
      "Jatuh tempo:",
      "Pembayaran ke",
      "Bank:",
      "Nomor rekening:",
      "Atas nama:",
      "Dokumen ini dibuat otomatis",
    ];
    const text = article.textContent!;
    const positions = order.map((needle) => text.indexOf(needle));
    expect(positions.every((p) => p !== -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    expect(screen.getByText("INV/2026/08/001")).toBeDefined();
    expect(screen.getByText("1 Agustus 2026")).toBeDefined();
    expect(screen.getAllByText("Aulia Rahma").length).toBe(2); // issuer name + bank account holder
    expect(screen.getByText("Jl. Melati No. 5, Bandung")).toBeDefined();
    expect(screen.getByText("0812-3456-7890")).toBeDefined();
    expect(screen.getByText("aulia@example.com")).toBeDefined();
    expect(screen.getByText("Warung Kopi Senja")).toBeDefined();
    expect(screen.getByText("Budi")).toBeDefined();
    expect(screen.getByText("1 Reel + 2 Story")).toBeDefined();
    expect(screen.getAllByText("Rp 3.200.000").length).toBeGreaterThan(0);
    expect(screen.getByText("PPh 23")).toBeDefined();
    expect(screen.getByText("Pembayaran penuh di muka")).toBeDefined();
    expect(screen.getByText("15 Oktober 2026")).toBeDefined();
    expect(screen.getByText("BCA")).toBeDefined();
    expect(screen.getByText("1234567890")).toBeDefined();
    expect(screen.getByText("Dokumen ini dibuat otomatis. Hubungi pengirim untuk pertanyaan.")).toBeDefined();
  });

  it("contains zero app navigation, status language, or buttons", () => {
    renderDoc();

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("navigation")).toHaveLength(0);
    for (const leaked of ["DRAFT", "SENT", "OVERDUE", "PAID", "Draf", "Terkirim", "Lunas", "Terlambat"]) {
      expect(document.body.textContent).not.toContain(leaked);
    }
  });

  it("renders no issuer address line at all (not a blank line) when missing", () => {
    renderDoc({ ...fullInput, settings: { ...fullInput.settings, issuerAddress: "" } });
    expect(screen.queryByText("Jl. Melati No. 5, Bandung")).toBeNull();
  });

  it("renders the issuer name as an em dash, never blank, when missing", () => {
    renderDoc({ ...fullInput, settings: { ...fullInput.settings, issuerName: "" } });
    expect(screen.getByText("—")).toBeDefined();
  });

  it("omits the contact-name line while keeping the brand when the deal has no contact name", () => {
    renderDoc({ ...fullInput, deal: { ...fullInput.deal, contactName: null } });
    expect(screen.getByText("Warung Kopi Senja")).toBeDefined();
    expect(screen.queryByText("Budi")).toBeNull();
  });

  it("falls back to the canonical scope description when the deal scope is empty", () => {
    renderDoc({ ...fullInput, deal: { ...fullInput.deal, scope: "" } });
    expect(screen.getByText("Jasa kerja sama konten")).toBeDefined();
  });

  it("omits the entire terms block when payment terms are empty, even with a due date set", () => {
    renderDoc({ ...fullInput, deal: { ...fullInput.deal, paymentTerms: null } });
    expect(screen.queryByText("Syarat pembayaran")).toBeNull();
    expect(screen.queryByText(/Jatuh tempo/)).toBeNull();
  });

  it("keeps the terms block but omits only the due-date line when the due date is missing", () => {
    renderDoc({ ...fullInput, invoice: { ...fullInput.invoice, dueDate: null } });
    expect(screen.getByText("Syarat pembayaran")).toBeDefined();
    expect(screen.getByText("Pembayaran penuh di muka")).toBeDefined();
    expect(screen.queryByText(/Jatuh tempo/)).toBeNull();
  });

  it("shows the visible incomplete-account notice, with em dashes for missing fields, when any bank field is missing", () => {
    renderDoc({ ...fullInput, settings: { ...fullInput.settings, bankAccountNumber: "" } });
    expect(screen.getByRole("alert")).toHaveProperty("textContent", "Detail rekening belum lengkap.");
    expect(screen.getByText("BCA")).toBeDefined();
  });

  it("does not show the incomplete-account notice when all bank fields are present", () => {
    renderDoc();
    expect(screen.queryByText("Detail rekening belum lengkap.")).toBeNull();
  });

  it("uses serif styling for every currency figure", () => {
    renderDoc();
    const amounts = screen.getAllByText("Rp 3.200.000");
    expect(amounts.length).toBeGreaterThanOrEqual(2);
    for (const amount of amounts) {
      expect(amount.className).toMatch(/font-serif/);
    }
  });
});
