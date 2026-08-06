import { describe, expect, it } from "vitest";
import { formatPhone } from "./phone";

describe("formatPhone", () => {
  it("formats a normalized Indonesian mobile number in 3-4-4 groups", () => {
    expect(formatPhone("6281234567890")).toBe("+62 812-3456-7890");
  });

  it("retains a leading plus with best-effort grouping for non-Indonesian digits", () => {
    expect(formatPhone("12025550179")).toBe("+120-255-501-79");
  });

  it("returns an empty string for empty input", () => {
    expect(formatPhone("")).toBe("");
  });

  it("strips non-digit characters defensively before grouping", () => {
    expect(formatPhone("+62 812 3456 7890")).toBe("+62 812-3456-7890");
  });
});
