import { describe, expect, it, vi } from "vitest";
import {
  invoiceNumberPrefix,
  invoiceYearMonth,
  isValidInvoiceNumber,
  nextInvoiceNumber,
  parseInvoiceNumber,
  type InvoiceSequenceDb,
} from "./invoice-number";

/**
 * In-memory fake of the atomic `increment` contract: each call bumps the
 * counter for (userId, year, month) by exactly one and returns the new
 * value, matching what a Postgres `INSERT ... ON CONFLICT ... DO UPDATE
 * ... RETURNING` round-trip guarantees in production (see the contract
 * doc on `InvoiceSequenceDb` in invoice-number.ts).
 */
function makeSequenceDb(seed: Record<string, number> = {}): InvoiceSequenceDb {
  const counters = new Map(Object.entries(seed));
  return {
    invoiceSequence: {
      increment: vi.fn(async ({ userId, year, month }: { userId: string; year: number; month: number }) => {
        const key = `${userId}:${year}-${month}`;
        const lastSequence = (counters.get(key) ?? 0) + 1;
        counters.set(key, lastSequence);
        return { lastSequence };
      }),
    },
  };
}

describe("invoiceNumberPrefix", () => {
  it("formats the year/month prefix with zero-padded month", () => {
    expect(invoiceNumberPrefix(new Date("2026-07-15T00:00:00.000Z"))).toBe("INV/2026/07/");
    expect(invoiceNumberPrefix(new Date("2026-01-01T00:00:00.000Z"))).toBe("INV/2026/01/");
  });

  it("uses the Jakarta calendar day by default, not UTC", () => {
    // 2026-07-31T18:00:00Z is already 2026-08-01T01:00:00 in Asia/Jakarta (UTC+7).
    expect(invoiceNumberPrefix(new Date("2026-07-31T18:00:00.000Z"))).toBe("INV/2026/08/");
  });

  it("accepts an explicit timeZone override", () => {
    expect(invoiceNumberPrefix(new Date("2026-07-31T18:00:00.000Z"), "UTC")).toBe("INV/2026/07/");
  });
});

describe("invoiceYearMonth", () => {
  it("returns numeric year and month for the Jakarta calendar", () => {
    expect(invoiceYearMonth(new Date("2026-07-31T18:00:00.000Z"))).toEqual({ year: 2026, month: 8 });
  });
});

describe("nextInvoiceNumber", () => {
  it("starts a user's monthly sequence at 001", async () => {
    const db = makeSequenceDb();

    const number = await nextInvoiceNumber(db, "user-1", new Date("2026-07-15T00:00:00.000Z"));

    expect(number).toBe("INV/2026/07/001");
    expect(db.invoiceSequence.increment).toHaveBeenCalledWith({ userId: "user-1", year: 2026, month: 7 });
  });

  it("increments from the existing sequence for that user and month", async () => {
    const db = makeSequenceDb({ "user-1:2026-7": 4 });

    const number = await nextInvoiceNumber(db, "user-1", new Date("2026-07-15T00:00:00.000Z"));

    expect(number).toBe("INV/2026/07/005");
  });

  it("keeps sequences independent per user", async () => {
    const db = makeSequenceDb({ "user-1:2026-7": 4 });

    expect(await nextInvoiceNumber(db, "user-1", new Date("2026-07-15T00:00:00.000Z"))).toBe(
      "INV/2026/07/005",
    );
    expect(await nextInvoiceNumber(db, "user-2", new Date("2026-07-15T00:00:00.000Z"))).toBe(
      "INV/2026/07/001",
    );
  });

  it("resets the sequence for a new month", async () => {
    const db = makeSequenceDb({ "user-1:2026-6": 12 });

    const number = await nextInvoiceNumber(db, "user-1", new Date("2026-07-01T00:00:00.000Z"));

    expect(number).toBe("INV/2026/07/001");
  });

  it("uses the Jakarta month, not UTC, when the counter is keyed and incremented", async () => {
    const db = makeSequenceDb();

    // 2026-07-31T18:00:00Z is already August 1st in Asia/Jakarta.
    const number = await nextInvoiceNumber(db, "user-1", new Date("2026-07-31T18:00:00.000Z"));

    expect(number).toBe("INV/2026/08/001");
    expect(db.invoiceSequence.increment).toHaveBeenCalledWith({ userId: "user-1", year: 2026, month: 8 });
  });

  it("pads beyond three digits without truncating", async () => {
    const db = makeSequenceDb({ "user-1:2026-7": 999 });

    const number = await nextInvoiceNumber(db, "user-1", new Date("2026-07-15T00:00:00.000Z"));

    expect(number).toBe("INV/2026/07/1000");
  });

  it("sequence/counter contract: every call increments by exactly one and returns unique numbers", async () => {
    const db = makeSequenceDb();
    const now = new Date("2026-07-15T00:00:00.000Z");

    const numbers = await Promise.all(
      Array.from({ length: 5 }, () => nextInvoiceNumber(db, "user-1", now)),
    );

    expect(new Set(numbers).size).toBe(5);
    expect(numbers.slice().sort()).toEqual([
      "INV/2026/07/001",
      "INV/2026/07/002",
      "INV/2026/07/003",
      "INV/2026/07/004",
      "INV/2026/07/005",
    ]);
    expect(db.invoiceSequence.increment).toHaveBeenCalledTimes(5);
  });
});

describe("isValidInvoiceNumber", () => {
  it("accepts a well-formed number", () => {
    expect(isValidInvoiceNumber("INV/2026/07/001")).toBe(true);
  });

  it.each([
    "INV/2026/13/001",
    "INV/2026/00/001",
    "INV/26/07/001",
    "inv/2026/07/001",
    "INV/2026/07/01",
    "INV/2026/07/",
    "random",
  ])("rejects malformed input: %s", (value) => {
    expect(isValidInvoiceNumber(value)).toBe(false);
  });
});

describe("parseInvoiceNumber", () => {
  it("extracts year, month, and sequence", () => {
    expect(parseInvoiceNumber("INV/2026/07/005")).toEqual({ year: 2026, month: 7, sequence: 5 });
  });

  it("returns null for an invalid number", () => {
    expect(parseInvoiceNumber("INV/2026/13/005")).toBeNull();
  });
});
