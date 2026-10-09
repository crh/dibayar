import { describe, expect, it } from "vitest";
import { buildInvoiceDocumentModel, type InvoiceDocumentInput } from "./model";
import { withholdingTaxLabel } from "@/lib/invoice-share";

const NBSP = String.fromCharCode(0x00a0);

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

describe("buildInvoiceDocumentModel", () => {
  it("renders every field in the spec order for a fully populated invoice", () => {
    const model = buildInvoiceDocumentModel(fullInput);

    expect(model.header).toEqual({ title: "INVOICE", number: "INV/2026/08/001", issueDateLabel: "1 Agustus 2026" });
    expect(model.issuer).toEqual({
      name: "Aulia Rahma",
      address: "Jl. Melati No. 5, Bandung",
      whatsapp: "0812-3456-7890",
      email: "aulia@example.com",
    });
    expect(model.client).toEqual({ brand: "Warung Kopi Senja", contactName: "Budi" });
    expect(model.scope).toEqual({ description: "1 Reel + 2 Story", amountLabel: `Rp${NBSP}3.200.000` });
    expect(model.total).toEqual({ amountLabel: `Rp${NBSP}3.200.000` });
    expect(model.terms).toEqual({ text: "Pembayaran penuh di muka", dueDateLabel: "15 Oktober 2026" });
    expect(model.bank).toEqual({
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "Aulia Rahma",
      incomplete: false,
    });
    expect(model.footer.text).toBe("Dokumen ini dibuat otomatis. Hubungi pengirim untuk pertanyaan.");
  });

  it("falls back to INV-{id} when the invoice number is somehow empty [ASSUMPTION]", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      invoice: { ...fullInput.invoice, number: "" },
    });

    expect(model.header.number).toBe("INV-invoice-1");
  });

  it("renders the issuer name as an em dash, never omitted, when Settings has no issuer name", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      settings: { ...fullInput.settings, issuerName: "" },
    });

    expect(model.issuer.name).toBe("—");
  });

  it("omits the issuer address line (does not render a blank line) when address is missing", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      settings: { ...fullInput.settings, issuerAddress: "" },
    });

    expect(model.issuer.address).toBeNull();
  });

  it("omits the issuer WhatsApp and email lines independently when either is missing", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      settings: { ...fullInput.settings, issuerWhatsapp: "", issuerEmail: "" },
    });

    expect(model.issuer.whatsapp).toBeNull();
    expect(model.issuer.email).toBeNull();
  });

  it("omits the contact-name line when the deal has no contact name, while keeping brand", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      deal: { ...fullInput.deal, contactName: null },
    });

    expect(model.client).toEqual({ brand: "Warung Kopi Senja", contactName: null });
  });

  it("falls back to the canonical scope description when the deal scope is empty", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      deal: { ...fullInput.deal, scope: "" },
    });

    expect(model.scope.description).toBe("Jasa kerja sama konten");
  });

  // FIND-08: payment terms and the due date are independent. A due date is
  // shown to the recipient whenever it exists, with or without payment terms.
  it.each([
    { name: "terms and due date", paymentTerms: "Pembayaran penuh di muka", dueDate: "2026-10-15T00:00:00.000Z", terms: { text: "Pembayaran penuh di muka", dueDateLabel: "15 Oktober 2026" } },
    { name: "terms only", paymentTerms: "Pembayaran penuh di muka", dueDate: null, terms: { text: "Pembayaran penuh di muka", dueDateLabel: null } },
    { name: "due date only", paymentTerms: null, dueDate: "2026-10-15T00:00:00.000Z", terms: { text: null, dueDateLabel: "15 Oktober 2026" } },
    { name: "neither", paymentTerms: null, dueDate: null, terms: null },
  ])("terms block for $name", ({ paymentTerms, dueDate, terms }) => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      invoice: { ...fullInput.invoice, dueDate },
      deal: { ...fullInput.deal, paymentTerms },
    });

    expect(model.terms).toEqual(terms);
  });

  it.each(["", "   "])("treats blank payment terms (%j) as absent and still keeps the due date", (paymentTerms) => {
    const model = buildInvoiceDocumentModel({ ...fullInput, deal: { ...fullInput.deal, paymentTerms } });

    expect(model.terms).toEqual({ text: null, dueDateLabel: "15 Oktober 2026" });
  });

  it("formats a due date stored as UTC midnight as that calendar date", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      invoice: { ...fullInput.invoice, dueDate: new Date("2026-12-31T00:00:00.000Z") },
      deal: { ...fullInput.deal, paymentTerms: null },
    });

    expect(model.terms?.dueDateLabel).toBe("31 Desember 2026");
  });

  it("shows an em dash per missing bank field and flags incomplete when any one of the three is missing", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      settings: { ...fullInput.settings, bankAccountNumber: "" },
    });

    expect(model.bank).toEqual({
      bankName: "BCA",
      accountNumber: "—",
      accountHolder: "Aulia Rahma",
      incomplete: true,
    });
  });

  it("flags bank incomplete when every bank field is missing", () => {
    const model = buildInvoiceDocumentModel({
      ...fullInput,
      settings: { ...fullInput.settings, bankName: "", bankAccountNumber: "", bankAccountHolder: "" },
    });

    expect(model.bank).toEqual({
      bankName: "—",
      accountNumber: "—",
      accountHolder: "—",
      incomplete: true,
    });
  });

  it("does not flag bank incomplete when all three fields are present", () => {
    const model = buildInvoiceDocumentModel(fullInput);
    expect(model.bank.incomplete).toBe(false);
  });

  it.each(["NONE", "PPH21", "PPH23"] as const)(
    "matches the existing public-share tax label exactly for %s (byte-identical parity)",
    (type) => {
      const model = buildInvoiceDocumentModel({
        ...fullInput,
        invoice: { ...fullInput.invoice, withholdingTaxType: type },
      });

      expect(model.tax.label).toBe(withholdingTaxLabel(type));
    },
  );
});
