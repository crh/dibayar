import type { InvoiceStatus } from "./invoices";

export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

// Provisional (M3 Task 1): 7 days is a starting guess for "due soon", not yet
// validated with creators. Revisit once real usage/feedback is available.
export const DUE_SOON_WINDOW_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const jakartaCalendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const utcCalendarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Asia/Jakarta calendar date (YYYY-MM-DD) for a real instant, e.g. "now".
export function getJakartaCalendarDate(instant: Date): string {
  return jakartaCalendarFormatter.format(instant);
}

// dueDate is a date-only business date stored as UTC midnight (from an HTML
// date input, see prisma/schema.prisma Invoice.dueDate). Reading it back via
// the UTC calendar fields recovers the exact date the user picked, regardless
// of server timezone.
export function getDueDateCalendarDate(dueDate: Date): string {
  return utcCalendarFormatter.format(dueDate);
}

function calendarDateToUtcMs(calendarDate: string): number {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

// Whole Jakarta-calendar days from "now" to the due date: 0 on the due date,
// negative once it's past, positive while it's still ahead.
export function daysUntilDue(dueDate: Date, now: Date): number {
  const todayMs = calendarDateToUtcMs(getJakartaCalendarDate(now));
  const dueMs = calendarDateToUtcMs(getDueDateCalendarDate(dueDate));
  return Math.round((dueMs - todayMs) / MS_PER_DAY);
}

export function isOverdueByDueDate(dueDate: Date | null, now: Date): boolean {
  if (!dueDate) return false;
  return daysUntilDue(dueDate, now) < 0;
}

const TERMINAL_STATUSES: ReadonlySet<InvoiceStatus> = new Set(["DRAFT", "PAID"]);

// The single source of truth for "what status should this invoice show right
// now". DRAFT/PAID are terminal and always shown as stored. Every other
// status is re-derived against dueDate: OVERDUE always reflects the Jakarta
// due date rather than trusting a possibly-stale stored OVERDUE, and a stored
// OVERDUE whose due date turns out not to be past falls back to SENT.
export function deriveInvoiceDisplayStatus(
  invoice: { status: InvoiceStatus; dueDate: Date | null },
  now: Date,
): InvoiceStatus {
  if (TERMINAL_STATUSES.has(invoice.status)) return invoice.status;
  if (isOverdueByDueDate(invoice.dueDate, now)) return "OVERDUE";
  return invoice.status === "OVERDUE" ? "SENT" : invoice.status;
}

export type AttentionInvoice<T> = T & {
  displayStatus: InvoiceStatus;
  daysUntilDue: number | null;
};

export type AttentionInvoiceSelection<T> = {
  overdue: Array<AttentionInvoice<T>>;
  dueSoon: Array<AttentionInvoice<T>>;
};

// Overdue first (soonest-overdue first), then due-soon within the window
// (nearest-due first). DRAFT/PAID never appear; an already-overdue invoice
// never also appears in dueSoon.
export function selectAttentionInvoices<T extends { status: InvoiceStatus; dueDate: Date | null }>(
  invoices: readonly T[],
  now: Date,
  dueSoonWindowDays: number = DUE_SOON_WINDOW_DAYS,
): AttentionInvoiceSelection<T> {
  const overdue: Array<AttentionInvoice<T>> = [];
  const dueSoon: Array<AttentionInvoice<T>> = [];

  for (const record of invoices) {
    if (record.status === "DRAFT" || record.status === "PAID") continue;

    const displayStatus = deriveInvoiceDisplayStatus(record, now);
    const days = record.dueDate ? daysUntilDue(record.dueDate, now) : null;

    if (displayStatus === "OVERDUE") {
      overdue.push({ ...record, displayStatus, daysUntilDue: days });
      continue;
    }

    if (days !== null && days >= 0 && days <= dueSoonWindowDays) {
      dueSoon.push({ ...record, displayStatus, daysUntilDue: days });
    }
  }

  overdue.sort((a, b) => (b.daysUntilDue ?? 0) - (a.daysUntilDue ?? 0));
  dueSoon.sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));

  return { overdue, dueSoon };
}
