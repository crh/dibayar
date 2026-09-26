import { describe, expect, it } from "vitest";
import type { InvoiceRecord } from "./invoices";
import { getJakartaMonthBounds, summarizeMonthlyIncome } from "./income-summary";

const invoice = (overrides: Partial<InvoiceRecord> = {}): InvoiceRecord => ({
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/07/001",
  subtotalIdr: 1_000_000,
  withholdingTaxType: "NONE",
  status: "SENT",
  dueDate: null,
  createdAt: new Date("2026-07-31T16:00:00.000Z"),
  updatedAt: new Date("2026-07-31T16:00:00.000Z"),
  ...overrides,
});

describe("Jakarta monthly income summary", () => {
  it("uses the Jakarta month at UTC boundaries", () => {
    const before = getJakartaMonthBounds(new Date("2026-07-31T16:59:59.999Z"));
    const after = getJakartaMonthBounds(new Date("2026-07-31T17:00:00.000Z"));
    expect(before.month).toBe(7);
    expect(after.month).toBe(8);
    expect(after.start.toISOString()).toBe("2026-07-31T17:00:00.000Z");
  });

  it("excludes an invoice created just before the Jakarta month boundary from the next month", () => {
    const summary = summarizeMonthlyIncome([
      invoice({ subtotalIdr: 1_000_000, withholdingTaxType: "PPH23" }),
      invoice({ id: "invoice-2", subtotalIdr: 2_000_001, withholdingTaxType: "PPH21" }),
    ], new Date("2026-08-01T00:00:00.000Z"));
    expect(summary.invoiceCount).toBe(0);
  });

  it("excludes drafts from the summary", () => {
    const summary = summarizeMonthlyIncome([
      invoice({ subtotalIdr: 1_000_000 }),
      invoice({ id: "invoice-draft", status: "DRAFT", subtotalIdr: 9_000_000 }),
    ], new Date("2026-07-31T16:00:00.000Z"));
    expect(summary.invoiceCount).toBe(1);
    expect(summary.grossIdr).toBe(1_000_000);
  });

  // The next two tests pin the PROVISIONAL "invoiced this month" basis (see the
  // comment on summarizeMonthlyIncome). If the basis is changed on purpose,
  // these should change with it -- they are not asserting a ratified rule.
  it("counts every non-draft status, paid or unpaid, by creation month", () => {
    const now = new Date("2026-07-31T16:00:00.000Z");
    const summary = summarizeMonthlyIncome(
      (["SENT", "DUE", "OVERDUE", "PAID"] as const).map((status, index) =>
        invoice({ id: `invoice-${status}`, status, subtotalIdr: 1_000_000 * (index + 1) }),
      ),
      now,
    );
    expect(summary.invoiceCount).toBe(4);
    expect(summary.grossIdr).toBe(10_000_000);
  });

  it("keeps an invoice in its creation month even if it is updated (e.g. paid) later", () => {
    const paidLater = invoice({
      status: "PAID",
      createdAt: new Date("2026-08-31T10:00:00.000Z"),
      updatedAt: new Date("2026-09-15T10:00:00.000Z"),
    });
    expect(summarizeMonthlyIncome([paidLater], new Date("2026-08-20T00:00:00.000Z")).invoiceCount).toBe(1);
    expect(summarizeMonthlyIncome([paidLater], new Date("2026-09-20T00:00:00.000Z")).invoiceCount).toBe(0);
  });

  it("includes invoices issued during the selected Jakarta month", () => {
    const summary = summarizeMonthlyIncome([
      invoice({ subtotalIdr: 1_000_000, withholdingTaxType: "PPH23" }),
      invoice({ id: "invoice-2", subtotalIdr: 2_000_001, withholdingTaxType: "PPH21" }),
    ], new Date("2026-07-31T16:00:00.000Z"));
    expect(summary.invoiceCount).toBe(2);
    expect(summary.grossIdr).toBe(3_000_001);
    expect(summary.withholdingIdr).toBe(120_000);
    expect(summary.netIdr).toBe(2_880_001);
  });
});
