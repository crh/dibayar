import { describe, expect, it } from "vitest";
import {
  daysUntilDue,
  deriveInvoiceDisplayStatus,
  DUE_SOON_WINDOW_DAYS,
  getDueDateCalendarDate,
  getJakartaCalendarDate,
  isOverdueByDueDate,
  selectAttentionInvoices,
} from "./invoice-date-status";
import type { InvoiceRecord } from "./invoices";

// Due date stored as UTC midnight for the business date 2026-07-19 (from an HTML date input).
const DUE_DATE = new Date("2026-07-19T00:00:00.000Z");

function invoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "invoice-1",
    userId: "user-1",
    dealId: "deal-1",
    number: "INV/2026/07/001",
    subtotalIdr: 1_500_000,
    withholdingTaxType: "NONE",
    status: "SENT",
    dueDate: DUE_DATE,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("getJakartaCalendarDate", () => {
  it("extracts the Asia/Jakarta calendar date from a UTC instant, not the server/UTC day", () => {
    // 2026-07-18T17:01:00Z is 2026-07-19T00:01 in Jakarta (UTC+7) — the *next* UTC calendar day's start.
    expect(getJakartaCalendarDate(new Date("2026-07-18T17:01:00.000Z"))).toBe("2026-07-19");
  });
});

describe("getDueDateCalendarDate", () => {
  it("reads the stored UTC-midnight due date as its own calendar date, ignoring Jakarta offset", () => {
    expect(getDueDateCalendarDate(DUE_DATE)).toBe("2026-07-19");
  });
});

describe("isOverdueByDueDate — Asia/Jakarta boundary", () => {
  it("is not overdue with no due date", () => {
    expect(isOverdueByDueDate(null, new Date("2026-08-01T00:00:00.000Z"))).toBe(false);
  });

  it("is not overdue at 23:59 Jakarta on the due date itself", () => {
    // 2026-07-19T16:59:00Z = 2026-07-19T23:59 Jakarta.
    expect(isOverdueByDueDate(DUE_DATE, new Date("2026-07-19T16:59:00.000Z"))).toBe(false);
  });

  it("is not overdue at 00:01 Jakarta on the due date, even though server/UTC clock still reads the previous day", () => {
    // 2026-07-18T17:01:00Z = 2026-07-19T00:01 Jakarta. Naive UTC-day comparison would see "18", not "19".
    expect(isOverdueByDueDate(DUE_DATE, new Date("2026-07-18T17:01:00.000Z"))).toBe(false);
  });

  it("is not overdue on the previous Jakarta calendar date", () => {
    // 2026-07-18T16:59:00Z = 2026-07-18T23:59 Jakarta — still the day before the due date.
    expect(isOverdueByDueDate(DUE_DATE, new Date("2026-07-18T16:59:00.000Z"))).toBe(false);
  });

  it("is overdue at 00:01 Jakarta on the day after the due date, even though the UTC calendar date is unchanged", () => {
    // 2026-07-19T17:01:00Z = 2026-07-20T00:01 Jakarta. UTC day is still "19", same as the due date.
    expect(isOverdueByDueDate(DUE_DATE, new Date("2026-07-19T17:01:00.000Z"))).toBe(true);
  });
});

describe("daysUntilDue", () => {
  it("is 0 on the Jakarta due date, negative after, positive before", () => {
    expect(daysUntilDue(DUE_DATE, new Date("2026-07-19T10:00:00.000Z"))).toBe(0);
    expect(daysUntilDue(DUE_DATE, new Date("2026-07-19T17:01:00.000Z"))).toBe(-1);
    expect(daysUntilDue(DUE_DATE, new Date("2026-07-12T00:00:00.000Z"))).toBe(7);
  });
});

describe("deriveInvoiceDisplayStatus", () => {
  it("preserves DRAFT regardless of due date", () => {
    const draft = invoice({ status: "DRAFT", dueDate: new Date("2020-01-01T00:00:00.000Z") });
    expect(deriveInvoiceDisplayStatus(draft, new Date("2026-07-19T17:01:00.000Z"))).toBe("DRAFT");
  });

  it("preserves PAID regardless of due date", () => {
    const paid = invoice({ status: "PAID", dueDate: new Date("2020-01-01T00:00:00.000Z") });
    expect(deriveInvoiceDisplayStatus(paid, new Date("2026-07-19T17:01:00.000Z"))).toBe("PAID");
  });

  it("derives OVERDUE for a SENT invoice once the Jakarta due date has passed", () => {
    const sent = invoice({ status: "SENT" });
    expect(deriveInvoiceDisplayStatus(sent, new Date("2026-07-19T17:01:00.000Z"))).toBe("OVERDUE");
  });

  it("derives OVERDUE for a DUE invoice once the Jakarta due date has passed", () => {
    const due = invoice({ status: "DUE" });
    expect(deriveInvoiceDisplayStatus(due, new Date("2026-07-19T17:01:00.000Z"))).toBe("OVERDUE");
  });

  it("keeps the stored nonterminal status when the due date has not passed", () => {
    const due = invoice({ status: "DUE" });
    expect(deriveInvoiceDisplayStatus(due, new Date("2026-07-19T16:59:00.000Z"))).toBe("DUE");
  });

  it("keeps a stored OVERDUE as OVERDUE when its due date really is past", () => {
    const overdue = invoice({ status: "OVERDUE", dueDate: new Date("2026-07-18T00:00:00.000Z") });
    expect(deriveInvoiceDisplayStatus(overdue, new Date("2026-07-19T00:00:00.000Z"))).toBe("OVERDUE");
  });

  it("falls back to SENT if stored OVERDUE no longer holds against the due date", () => {
    const stale = invoice({ status: "OVERDUE", dueDate: new Date("2026-08-01T00:00:00.000Z") });
    expect(deriveInvoiceDisplayStatus(stale, new Date("2026-07-19T00:00:00.000Z"))).toBe("SENT");
  });

  it("keeps the stored status when there is no due date to derive from", () => {
    const noDueDate = invoice({ status: "SENT", dueDate: null });
    expect(deriveInvoiceDisplayStatus(noDueDate, new Date("2026-07-19T00:00:00.000Z"))).toBe("SENT");
  });

});

describe("selectAttentionInvoices", () => {
  const now = new Date("2026-07-19T10:00:00.000Z"); // Jakarta 2026-07-19T17:00

  it("excludes DRAFT and PAID from both buckets", () => {
    const invoices = [
      invoice({ id: "draft", status: "DRAFT", dueDate: new Date("2026-07-01T00:00:00.000Z") }),
      invoice({ id: "paid", status: "PAID", dueDate: new Date("2026-07-01T00:00:00.000Z") }),
    ];
    const result = selectAttentionInvoices(invoices, now);
    expect(result.overdue).toHaveLength(0);
    expect(result.dueSoon).toHaveLength(0);
  });

  it("buckets a past-due invoice as overdue, not due-soon", () => {
    const invoices = [invoice({ id: "late", status: "SENT", dueDate: new Date("2026-07-10T00:00:00.000Z") })];
    const result = selectAttentionInvoices(invoices, now);
    expect(result.overdue.map((entry) => entry.id)).toEqual(["late"]);
    expect(result.dueSoon).toHaveLength(0);
  });

  it("buckets an invoice due today, and one due exactly at the 7-day edge, as due-soon", () => {
    const invoices = [
      invoice({ id: "today", status: "SENT", dueDate: new Date("2026-07-19T00:00:00.000Z") }),
      invoice({ id: "edge", status: "SENT", dueDate: new Date("2026-07-26T00:00:00.000Z") }),
    ];
    const result = selectAttentionInvoices(invoices, now, DUE_SOON_WINDOW_DAYS);
    expect(result.overdue).toHaveLength(0);
    expect(result.dueSoon.map((entry) => entry.id)).toEqual(["today", "edge"]);
  });

  it("excludes an invoice due 8 days out from the provisional 7-day window", () => {
    const invoices = [invoice({ id: "far", status: "SENT", dueDate: new Date("2026-07-27T00:00:00.000Z") })];
    const result = selectAttentionInvoices(invoices, now, DUE_SOON_WINDOW_DAYS);
    expect(result.dueSoon).toHaveLength(0);
    expect(result.overdue).toHaveLength(0);
  });

  it("excludes a manually-marked OVERDUE invoice that has no due date (nothing to chase it against)", () => {
    // deriveInvoiceDisplayStatus treats a dueDate-less stored OVERDUE as
    // stale and re-derives it to SENT (see invoice-date-status.test.ts's
    // "keeps the stored status..." case plus invoice-detail-client.test.tsx's
    // "shows the derived SENT chip, not the stale raw OVERDUE" test) -- with
    // no due date there's also no day count for dueSoon, so it's correctly
    // invisible to both buckets, not a bug.
    const invoices = [invoice({ id: "manual-overdue", status: "OVERDUE", dueDate: null })];
    const result = selectAttentionInvoices(invoices, now);
    expect(result.overdue).toHaveLength(0);
    expect(result.dueSoon).toHaveLength(0);
  });

  it("orders overdue by soonest-overdue-first and due-soon by nearest-due-first", () => {
    const invoices = [
      invoice({ id: "overdue-5d", status: "SENT", dueDate: new Date("2026-07-14T00:00:00.000Z") }),
      invoice({ id: "overdue-1d", status: "SENT", dueDate: new Date("2026-07-18T00:00:00.000Z") }),
      invoice({ id: "soon-3d", status: "SENT", dueDate: new Date("2026-07-22T00:00:00.000Z") }),
      invoice({ id: "soon-1d", status: "SENT", dueDate: new Date("2026-07-20T00:00:00.000Z") }),
    ];
    const result = selectAttentionInvoices(invoices, now);
    expect(result.overdue.map((entry) => entry.id)).toEqual(["overdue-1d", "overdue-5d"]);
    expect(result.dueSoon.map((entry) => entry.id)).toEqual(["soon-1d", "soon-3d"]);
  });
});
