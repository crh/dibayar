import type { WithholdingTaxType } from "@/lib/invoices";
import { withholdingTaxLabel } from "@/lib/invoice-share";
import { formatMoney } from "@/lib/format/money";
import { formatDateLong } from "@/lib/format/date";

// T-22: the single canonical field list/order for the invoice document (see
// dibayar-implementation-spec.md §5.3). This module is deliberately
// framework-agnostic (no React/DOM/react-pdf import) so both the HTML
// adapter (html.tsx, T-22) and the eventual PDF adapter (T-24) can consume
// exactly the same derived model -- optional-field decisions live here
// exactly once, not duplicated per renderer.

export type InvoiceDocumentSettings = {
  issuerName: string;
  issuerAddress: string;
  issuerWhatsapp: string;
  issuerEmail: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
};

export type InvoiceDocumentInput = {
  invoice: {
    id: string;
    number: string;
    subtotalIdr: number;
    withholdingTaxType: WithholdingTaxType;
    dueDate: Date | string | null;
    createdAt: Date | string;
  };
  deal: {
    brand: string;
    contactName: string | null;
    scope: string;
    paymentTerms: string | null;
  };
  settings: InvoiceDocumentSettings;
};

export type InvoiceDocumentModel = {
  header: { title: "INVOICE"; number: string; issueDateLabel: string };
  issuer: {
    name: string; // "—" when missing, per spec -- never omitted
    address: string | null; // line omitted when null
    whatsapp: string | null;
    email: string | null;
  };
  client: {
    brand: string;
    contactName: string | null; // line omitted when null
  };
  scope: { description: string; amountLabel: string };
  total: { amountLabel: string };
  tax: { label: string };
  // Terms empty -> the whole block is omitted (not just the terms line);
  // dueDateLabel null -> only that one line is omitted, block still renders.
  terms: { text: string; dueDateLabel: string | null } | null;
  bank: {
    bankName: string; // "—" when missing
    accountNumber: string;
    accountHolder: string;
    incomplete: boolean; // true if any of the three above was missing
  };
  footer: { text: string };
};

const EMPTY_DASH = "—";
const DEFAULT_SCOPE_DESCRIPTION = "Jasa kerja sama konten";
const FOOTER_TEXT = "Dokumen ini dibuat otomatis. Hubungi pengirim untuk pertanyaan.";

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function formatDueDate(value: Date | string | null): string | null {
  if (!value) return null;
  return formatDateLong(value);
}

export function buildInvoiceDocumentModel(input: InvoiceDocumentInput): InvoiceDocumentModel {
  const { invoice, deal, settings } = input;
  const amountLabel = formatMoney(invoice.subtotalIdr);
  const paymentTerms = deal.paymentTerms?.trim() || "";
  const dueDateLabel = formatDueDate(invoice.dueDate);

  const bankName = settings.bankName.trim();
  const accountNumber = settings.bankAccountNumber.trim();
  const accountHolder = settings.bankAccountHolder.trim();
  const bankIncomplete = !bankName || !accountNumber || !accountHolder;

  return {
    header: {
      title: "INVOICE",
      number: invoice.number || `INV-${invoice.id}`,
      issueDateLabel: formatDateLong(invoice.createdAt),
    },
    issuer: {
      name: settings.issuerName.trim() || EMPTY_DASH,
      address: orNull(settings.issuerAddress),
      whatsapp: orNull(settings.issuerWhatsapp),
      email: orNull(settings.issuerEmail),
    },
    client: {
      brand: deal.brand,
      contactName: deal.contactName?.trim() || null,
    },
    scope: {
      description: deal.scope.trim() || DEFAULT_SCOPE_DESCRIPTION,
      amountLabel,
    },
    total: { amountLabel },
    tax: { label: withholdingTaxLabel(invoice.withholdingTaxType) },
    terms: paymentTerms ? { text: paymentTerms, dueDateLabel } : null,
    bank: {
      bankName: bankName || EMPTY_DASH,
      accountNumber: accountNumber || EMPTY_DASH,
      accountHolder: accountHolder || EMPTY_DASH,
      incomplete: bankIncomplete,
    },
    footer: { text: FOOTER_TEXT },
  };
}
