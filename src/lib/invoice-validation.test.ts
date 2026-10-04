import { describe, expect, it } from "vitest";
import { invoiceCreateSchema, invoiceDueDateUpdateSchema } from "./invoice-validation";

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

describe("invoice due-date schemas (FIND-03)", () => {
  it("parses a supported yyyy-mm-dd into UTC midnight", () => {
    expect(invoiceDueDateUpdateSchema.parse({ dueDate: "2030-01-15" }).dueDate?.toISOString()).toBe("2030-01-15T00:00:00.000Z");
  });

  it("keeps explicit null for clearing", () => {
    expect(invoiceDueDateUpdateSchema.parse({ dueDate: null }).dueDate).toBeNull();
  });

  it.each(["0002-01-15", "1999-12-31", "2100-01-01", "2026-02-30", "2030-01-15T00:00:00.000Z", "", 1_900_000_000_000])(
    "rejects %j on both the update and create schemas",
    (dueDate) => {
      expect(invoiceDueDateUpdateSchema.safeParse({ dueDate }).success).toBe(false);
      expect(invoiceCreateSchema.safeParse({ dealId: "deal-1", dueDate }).success).toBe(false);
    },
  );

  it("requires the dueDate key on the update schema (absent is not the same as clear)", () => {
    expect(invoiceDueDateUpdateSchema.safeParse({}).success).toBe(false);
  });
});
