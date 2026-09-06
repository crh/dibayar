import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats a positive amount with dot grouping and a non-breaking space", () => {
    expect(formatMoney(100000000)).toBe("Rp 100.000.000");
  });

  it("formats zero without a sign", () => {
    expect(formatMoney(0)).toBe("Rp 0");
  });

  it("formats a negative amount with a true minus sign before Rp", () => {
    expect(formatMoney(-1000000)).toBe("−Rp 1.000.000");
  });

  it("rounds fractional input to the nearest integer", () => {
    expect(formatMoney(1500.6)).toBe("Rp 1.501");
  });

  it("never negates when rounding lands on negative zero", () => {
    expect(formatMoney(-0.4)).toBe("Rp 0");
  });
});
