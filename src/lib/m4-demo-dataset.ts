// Synthetic M4 moderator demo dataset + target guard for
// scripts/m4-demo-data.ts. Pure (no Prisma/Node imports) so the dataset shape
// and the refuse-unless-staging guard are unit-tested without a database.
// Every name, number, and bank detail here is invented; nothing is a real
// creator, brand contact, bank account, or tax record.
// See docs/validation/M4-READINESS.md "Demo data".
import { getJakartaCalendarDate } from "./invoice-date-status";

// Neon `staging` branch (br-late-grass-aoea90yk) compute endpoint. Pooled and
// direct hostnames both start with this id; Production's endpoint does not.
export const M4_DEMO_STAGING_ENDPOINT = "ep-gentle-morning-aofsje23";
export const M4_DEMO_CONFIRM_VALUE = "staging";

export type M4DemoTargetCheck = { ok: true; host: string } | { ok: false; reason: string };

export function checkM4DemoTarget(connectionString: string | undefined, confirm: string | undefined): M4DemoTargetCheck {
  if (!connectionString) return { ok: false, reason: "DATABASE_URL is required; no database action was taken" };
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return { ok: false, reason: "DATABASE_URL is not a valid URL" };
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    return { ok: false, reason: "DATABASE_URL must use the PostgreSQL protocol" };
  }
  if (["host", "hostaddr", "port", "database", "dbname"].some((p) => url.searchParams.has(p))) {
    return { ok: false, reason: "DATABASE_URL must not contain target-override query parameters" };
  }
  const endpoint = url.hostname.split(".")[0].replace(/-pooler$/, "");
  if (endpoint !== M4_DEMO_STAGING_ENDPOINT) {
    return { ok: false, reason: `target must be the Neon staging endpoint ${M4_DEMO_STAGING_ENDPOINT}` };
  }
  if (confirm !== M4_DEMO_CONFIRM_VALUE) {
    return { ok: false, reason: `M4_DEMO_CONFIRM must equal ${M4_DEMO_CONFIRM_VALUE}` };
  }
  return { ok: true, host: endpoint };
}

type DealStage = "MASUK" | "NEGO" | "DEAL" | "KONTEN" | "INVOICE" | "DIBAYAR";
type InvoiceTarget = "DRAFT" | "SENT" | "PAID";

export type M4DemoDeal = {
  key: string;
  // Stages the deal is walked through after creation at MASUK, so its stage
  // history looks like real use rather than a single jump.
  stages: DealStage[];
  input: {
    brand: string;
    contactName: string;
    contactWa: string;
    scope: string;
    feeIdr: number;
    paymentTerms?: string;
    deadlineOffsetDays?: number;
  };
  invoice?: {
    withholdingTaxType: "NONE" | "PPH21" | "PPH23";
    dueOffsetDays: number;
    // Status path from DRAFT, using only transitions updateInvoiceStatus allows.
    statusPath: InvoiceTarget[];
  };
};

// WhatsApp numbers are syntactically valid (the wa.me demo needs that) but
// invented: moderators demonstrate the prefilled message and never press Send.
export const M4_DEMO_DEALS: readonly M4DemoDeal[] = [
  {
    key: "nego",
    stages: ["NEGO"],
    input: {
      brand: "Kopi Lereng Merapi",
      contactName: "Mbak Sinta",
      contactWa: "081200000101",
      scope: "1 Reels + 3 Story review kopi susu kemasan",
      feeIdr: 3_500_000,
      paymentTerms: "Masih nego: brand tawar 2,5 juta, minta 50% di muka",
    },
  },
  {
    key: "konten",
    stages: ["NEGO", "DEAL", "KONTEN"],
    input: {
      brand: "Serum Daun Kelor",
      contactName: "Kak Dimas",
      contactWa: "081200000102",
      scope: "2 video TikTok pemakaian 14 hari, draft dikirim sebelum tayang",
      feeIdr: 3_000_000,
      paymentTerms: "Transfer 14 hari setelah konten tayang",
      deadlineOffsetDays: 5,
    },
    invoice: { withholdingTaxType: "NONE", dueOffsetDays: 19, statusPath: ["DRAFT"] },
  },
  {
    key: "due-soon",
    stages: ["NEGO", "DEAL", "KONTEN", "INVOICE"],
    input: {
      brand: "Dompet Rapi",
      contactName: "Pak Arief",
      contactWa: "081200000103",
      scope: "1 video YouTube Shorts tutorial fitur tabungan",
      feeIdr: 4_000_000,
      paymentTerms: "NET 14, dipotong PPh 23",
    },
    invoice: { withholdingTaxType: "PPH23", dueOffsetDays: 3, statusPath: ["DRAFT", "SENT"] },
  },
  {
    key: "overdue",
    stages: ["NEGO", "DEAL", "KONTEN", "INVOICE"],
    input: {
      brand: "Teh Tarik Nusantara",
      contactName: "Bu Lestari",
      contactWa: "081200000104",
      scope: "3 Story + 1 feed post promo menu baru",
      feeIdr: 2_500_000,
      paymentTerms: "NET 7, dipotong PPh 21",
    },
    // Stored SENT: overdue is never set by hand. Due 4 days ago, so the app
    // shows it as Terlambat and Beranda lists it for chasing.
    invoice: { withholdingTaxType: "PPH21", dueOffsetDays: -4, statusPath: ["DRAFT", "SENT"] },
  },
  {
    key: "paid",
    stages: ["NEGO", "DEAL", "KONTEN", "INVOICE", "DIBAYAR"],
    input: {
      brand: "Batik Sekar Ayu",
      contactName: "Mas Bayu",
      contactWa: "081200000105",
      scope: "Lookbook 5 foto feed koleksi batik tulis",
      feeIdr: 1_750_000,
      paymentTerms: "Lunas setelah posting",
    },
    invoice: { withholdingTaxType: "NONE", dueOffsetDays: -2, statusPath: ["DRAFT", "SENT", "PAID"] },
  },
];

// Invented issuer persona so the invoice document renders complete issuer and
// bank blocks. Overwrites the demo owner's staging settings on seed.
export const M4_DEMO_SETTINGS = {
  issuerName: "Nadia Putri (contoh)",
  issuerAddress: "Jl. Contoh Kreatif No. 12, Yogyakarta",
  issuerWhatsapp: "081200000100",
  issuerEmail: "nadia.contoh@example.invalid",
  bankName: "Bank Contoh",
  bankAccountNumber: "0000123456",
  bankAccountHolder: "Nadia Putri",
};

// A date-only business date for "Jakarta today + offset", stored as UTC
// midnight like the app's own date inputs (see getDueDateCalendarDate).
export function jakartaDateOffset(now: Date, offsetDays: number): Date {
  const [year, month, day] = getJakartaCalendarDate(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays));
}

// The same Jakarta calendar day as a yyyy-mm-dd string: the only form the
// invoice due-date contract accepts (src/lib/due-date.ts). Read back from the
// UTC-midnight Date, so it names exactly the day jakartaDateOffset stores.
export function jakartaDateOnlyOffset(now: Date, offsetDays: number): string {
  return jakartaDateOffset(now, offsetDays).toISOString().slice(0, 10);
}

// The createInvoice payload scripts/m4-demo-data.ts sends for a demo deal. It
// goes through the same strict invoiceCreateSchema as the public API, so the
// due date is a yyyy-mm-dd string, never a Date.
export function buildM4DemoInvoiceInput(dealId: string, invoice: NonNullable<M4DemoDeal["invoice"]>, now: Date) {
  return {
    dealId,
    withholdingTaxType: invoice.withholdingTaxType,
    dueDate: jakartaDateOnlyOffset(now, invoice.dueOffsetDays),
  };
}
