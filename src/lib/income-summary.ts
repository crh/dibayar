import type { InvoiceRecord } from "./invoices";
import { formatMonthYearLabel, getCalendarYearMonth } from "./format/date";

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export const PPH_RATES = {
  NONE: 0,
  PPH21: 0.05,
  PPH23: 0.02,
} as const;

export type MonthlyIncomeSummary = {
  year: number;
  month: number;
  label: string;
  invoiceCount: number;
  grossIdr: number;
  withholdingIdr: number;
  netIdr: number;
};

export function getJakartaMonthBounds(now: Date) {
  const { year, month } = getCalendarYearMonth(now, JAKARTA_TIME_ZONE);
  const startUtc = Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000;
  const endUtc = Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000;
  return { year, month, start: new Date(startUtc), end: new Date(endUtc) };
}

// Provisional (M4 pre-validation): the month basis is Invoice.createdAt in
// Asia/Jakarta -- there is no separate issue-date column -- and every
// non-DRAFT status (SENT/DUE/OVERDUE/PAID) is counted, paid or not. So this is
// a "net invoiced this month" view (subtotal minus estimated PPh), not cash
// received; an invoice created on Aug 31 and paid in September stays in
// August. Not yet ratified by Chris or
// validated with creators; see docs/validation/M4-READINESS.md. Pinned by
// income-summary.test.ts so a change here is deliberate.
export function summarizeMonthlyIncome(invoices: InvoiceRecord[], now: Date): MonthlyIncomeSummary {
  const bounds = getJakartaMonthBounds(now);
  const included = invoices.filter((invoice) => invoice.status !== "DRAFT" && invoice.createdAt >= bounds.start && invoice.createdAt < bounds.end);
  const grossIdr = included.reduce((sum, invoice) => sum + invoice.subtotalIdr, 0);
  const withholdingIdr = included.reduce((sum, invoice) => sum + Math.round(invoice.subtotalIdr * PPH_RATES[invoice.withholdingTaxType]), 0);
  const label = formatMonthYearLabel(new Date(Date.UTC(bounds.year, bounds.month - 1, 15)), JAKARTA_TIME_ZONE);
  return { year: bounds.year, month: bounds.month, label, invoiceCount: included.length, grossIdr, withholdingIdr, netIdr: grossIdr - withholdingIdr };
}
