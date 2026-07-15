import { describe, expect, it } from "vitest";
import { invoiceCreateSchema } from "./invoice-validation";

describe("invoiceCreateSchema", () => {
  it("accepts a minimal payload and defaults withholdingTaxType to NONE", () => {
    const result = invoiceCreateSchema.parse({ dealId: "deal-1" });

    expect(result.dealId).toBe("deal-1");
    expect(result.withholdingTaxType).toBe("NONE");
    expect(result.dueDate).toBeUndefined();
  });

  it("accepts an explicit withholding tax type and due date", () => {
    const result = invoiceCreateSchema.parse({
      dealId: "deal-1",
      dueDate: "2026-08-01",
      withholdingTaxType: "PPH23",
    });

    expect(result.withholdingTaxType).toBe("PPH23");
    expect(result.dueDate).toBeInstanceOf(Date);
  });

  it("rejects a missing dealId", () => {
    const result = invoiceCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an unknown withholding tax type", () => {
    const result = invoiceCreateSchema.safeParse({ dealId: "deal-1", withholdingTaxType: "PPH99" });
    expect(result.success).toBe(false);
  });
});
