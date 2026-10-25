import { describe, expect, it } from "vitest";
import {
  DUE_DATE_MAX,
  DUE_DATE_MIN,
  checkDueDateInput,
  dueDateInputToStoredDate,
  isSupportedStoredDueDate,
  storedDueDateToInputValue,
} from "./due-date";

describe("due-date contract", () => {
  it("supports 2000-01-01 through 2099-12-31 inclusive", () => {
    expect(DUE_DATE_MIN).toBe("2000-01-01");
    expect(DUE_DATE_MAX).toBe("2099-12-31");
  });

  describe("checkDueDateInput", () => {
    it.each(["2000-01-01", "2026-08-01", "2028-02-29", "2099-12-31"])("accepts %s", (value) => {
      expect(checkDueDateInput(value)).toEqual({ kind: "valid", value });
    });

    it("classifies an empty string as empty, not as a date", () => {
      expect(checkDueDateInput("")).toEqual({ kind: "empty" });
    });

    // Every intermediate value a native date input emits while a year is
    // typed digit by digit, before the last digit lands.
    it.each(["0002-01-15", "0020-01-15", "0203-01-15", "1999-12-31", "2100-01-01"])(
      "rejects %s as out of range",
      (value) => {
        expect(checkDueDateInput(value)).toEqual({ kind: "out-of-range" });
      },
    );

    it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "2026-1-5", "20301-01-15", "2030-01-15T00:00:00.000Z", " 2030-01-15", "2030-01-15 ", "garbage"])(
      "rejects %j as malformed without coercing it",
      (value) => {
        expect(checkDueDateInput(value)).toEqual({ kind: "malformed" });
      },
    );
  });

  it("stores a valid input as UTC midnight of that calendar day", () => {
    expect(dueDateInputToStoredDate("2030-01-15").toISOString()).toBe("2030-01-15T00:00:00.000Z");
  });

  describe("storedDueDateToInputValue (read path)", () => {
    it("returns the calendar date for a supported stored Date or its JSON string", () => {
      expect(storedDueDateToInputValue(new Date("2099-12-31T00:00:00.000Z"))).toBe("2099-12-31");
      expect(storedDueDateToInputValue("2030-01-15T00:00:00.000Z")).toBe("2030-01-15");
    });

    it.each([
      ["a legacy year-0002 Date", new Date("0002-01-15T00:00:00.000Z")],
      ["a legacy year-0002 JSON string", "0002-01-15T00:00:00.000Z"],
      ["a 5-digit-year Date", new Date(Date.UTC(20301, 0, 15))],
      ["a pre-range Date", new Date("1899-12-31T00:00:00.000Z")],
      ["an invalid Date", new Date(Number.NaN)],
      ["an unparseable string", "not-a-date"],
    ])("returns null, without throwing, for %s", (_case, value) => {
      expect(storedDueDateToInputValue(value)).toBeNull();
      expect(isSupportedStoredDueDate(value)).toBe(false);
    });
  });
});
