import { describe, expect, it, vi } from "vitest";
import { createInvoiceSequenceDb, type InvoiceSequenceQueryClient } from "./invoice-sequence";

function makeClient(queryRaw: InvoiceSequenceQueryClient["$queryRaw"]): InvoiceSequenceQueryClient {
  return { $queryRaw: queryRaw };
}

describe("createInvoiceSequenceDb", () => {
  it("returns the lastSequence RETURNING from the upsert", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ lastSequence: 7 }]);
    const db = createInvoiceSequenceDb(makeClient(queryRaw));

    const result = await db.invoiceSequence.increment({ userId: "user-1", year: 2026, month: 7 });

    expect(result).toEqual({ lastSequence: 7 });
  });

  it("coerces a bigint lastSequence to a number", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ lastSequence: BigInt(3) }]);
    const db = createInvoiceSequenceDb(makeClient(queryRaw));

    const result = await db.invoiceSequence.increment({ userId: "user-1", year: 2026, month: 7 });

    expect(result).toEqual({ lastSequence: 3 });
    expect(typeof result.lastSequence).toBe("number");
  });

  it("calls $queryRaw exactly once per increment", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ lastSequence: 1 }]);
    const db = createInvoiceSequenceDb(makeClient(queryRaw));

    await db.invoiceSequence.increment({ userId: "user-1", year: 2026, month: 7 });

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("issues a single parameterized statement, not string-interpolated SQL", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ lastSequence: 1 }]);
    const db = createInvoiceSequenceDb(makeClient(queryRaw));
    const dangerousUserId = "user-1'; DROP TABLE \"InvoiceSequence\"; --";

    await db.invoiceSequence.increment({ userId: dangerousUserId, year: 2026, month: 7 });

    const [sqlArg] = queryRaw.mock.calls[0];
    expect(sqlArg.values).toContain(dangerousUserId);
    expect(sqlArg.sql).not.toContain(dangerousUserId);
    expect(sqlArg.sql).toContain("ON CONFLICT");
    expect(sqlArg.sql).toContain("RETURNING");
  });

  it("throws a clear error when the database returns no row", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const db = createInvoiceSequenceDb(makeClient(queryRaw));

    await expect(
      db.invoiceSequence.increment({ userId: "user-1", year: 2026, month: 7 }),
    ).rejects.toThrow(/no row/i);
  });

  it("propagates query failures instead of swallowing them", async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error("connection reset"));
    const db = createInvoiceSequenceDb(makeClient(queryRaw));

    await expect(
      db.invoiceSequence.increment({ userId: "user-1", year: 2026, month: 7 }),
    ).rejects.toThrow("connection reset");
  });
});
