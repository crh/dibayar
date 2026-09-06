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

  it("calculates gross, PPh withholding, and net while excluding drafts", () => {
    const summary = summarizeMonthlyIncome([
      invoice({ subtotalIdr: 1_000_000, withholdingTaxType: "PPH23" }),
      invoice({ id: "invoice-2", subtotalIdr: 2_000_001, withholdingTaxType: "PPH21" }),
      invoice({ id: "invoice-3", status: "DRAFT", subtotalIdr: 9_000_000 }),
    ], new Date("2026-08-01T00:00:00.000Z"));
    expect(summary.invoiceCount).toBe(0);
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
