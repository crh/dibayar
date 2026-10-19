import { describe, expect, it } from "vitest";
import { formatDate, formatDateLong, formatMonthYearLabel, getCalendarDate, getCalendarYearMonth, isValidDateOnlyString } from "./date";

describe("formatDate", () => {
  it("formats an August date with the Indonesian short month", () => {
    expect(formatDate("2026-08-01")).toBe("1 Agu 2026");
  });

  it("formats a December date with the Indonesian short month", () => {
    expect(formatDate("2026-12-24")).toBe("24 Des 2026");
  });

  it("preserves the last day of a month without shifting", () => {
    expect(formatDate("2026-01-31")).toBe("31 Jan 2026");
  });

  it("accepts a Date object, reading its UTC calendar date", () => {
    expect(formatDate(new Date("2026-08-01T00:00:00.000Z"))).toBe("1 Agu 2026");
  });

  it("accepts a full ISO instant string, reading only its date component", () => {
    expect(formatDate("2026-08-01T23:45:00.000Z")).toBe("1 Agu 2026");
  });

  it("throws on a malformed date string", () => {
    expect(() => formatDate("not-a-date")).toThrow();
  });

  it("throws on an invalid Date object", () => {
    expect(() => formatDate(new Date("invalid"))).toThrow();
  });

  it("throws on an impossible calendar date (day exceeds days in month)", () => {
    expect(() => formatDate("2026-02-30")).toThrow();
  });

  it("throws on an impossible calendar date (month out of range)", () => {
    expect(() => formatDate("2026-13-01")).toThrow();
  });

  it("throws on trailing junk after a valid date-only string", () => {
    expect(() => formatDate("2026-08-01garbage")).toThrow();
  });

  it("throws on an ISO timestamp with an out-of-range hour/minute/second", () => {
    expect(() => formatDate("2026-08-01T99:99:99Z")).toThrow();
  });

  it("throws on an ISO timestamp with an out-of-range timezone offset", () => {
    expect(() => formatDate("2026-08-01T12:00:00+99:99")).toThrow();
  });

  it("throws on an ISO timestamp with a 60-second value", () => {
    expect(() => formatDate("2026-08-01T12:00:60Z")).toThrow();
  });

  it("throws on malformed trailing content after a full ISO timestamp", () => {
    expect(() => formatDate("2026-08-01T12:00:00Zgarbage")).toThrow();
  });
});

describe("formatDateLong", () => {
  it("formats the full Indonesian month name", () => {
    expect(formatDateLong("2026-08-01")).toBe("1 Agustus 2026");
  });

  it("formats a December date with the full Indonesian month name", () => {
    expect(formatDateLong("2026-12-24")).toBe("24 Desember 2026");
  });

  it("accepts a Date object, reading its UTC calendar date", () => {
    expect(formatDateLong(new Date("2026-08-01T00:00:00.000Z"))).toBe("1 Agustus 2026");
  });

  it("throws on an invalid Date object", () => {
    expect(() => formatDateLong(new Date("invalid"))).toThrow();
  });
});

describe("formatMonthYearLabel", () => {
  it("formats the Indonesian long month name and year in an explicit timezone", () => {
    expect(formatMonthYearLabel(new Date(Date.UTC(2026, 7, 15)), "Asia/Jakarta")).toBe("Agustus 2026");
  });

  it("defaults to the Asia/Jakarta timezone when none is given", () => {
    expect(formatMonthYearLabel(new Date(Date.UTC(2026, 7, 15)))).toBe("Agustus 2026");
  });

  it("throws on an invalid Date object", () => {
    expect(() => formatMonthYearLabel(new Date("invalid"))).toThrow();
  });

  it("throws on an impossible calendar date string (day exceeds days in month)", () => {
    expect(() => formatMonthYearLabel("2026-02-30")).toThrow();
  });

  it("throws on a malformed ISO timestamp string (out-of-range hour/minute/second)", () => {
    expect(() => formatMonthYearLabel("2026-08-01T99:99:99Z")).toThrow();
  });
});

describe("getCalendarDate", () => {
  it("extracts the Asia/Jakarta calendar date from a UTC instant, not the server/UTC day", () => {
    // 2026-07-18T17:01:00Z is 2026-07-19T00:01 in Jakarta (UTC+7) — the *next* UTC calendar day's start.
    expect(getCalendarDate(new Date("2026-07-18T17:01:00.000Z"), "Asia/Jakarta")).toBe("2026-07-19");
  });

  it("reads a stored UTC-midnight due date as its own calendar date in the UTC timezone", () => {
    expect(getCalendarDate(new Date("2026-07-19T00:00:00.000Z"), "UTC")).toBe("2026-07-19");
  });

  it("throws on an invalid Date object", () => {
    expect(() => getCalendarDate(new Date("invalid"), "UTC")).toThrow();
  });

  it("throws on an impossible calendar date string (day exceeds days in month)", () => {
    expect(() => getCalendarDate("2026-02-30", "UTC")).toThrow();
  });

  it("throws on a malformed ISO timestamp string (out-of-range hour/minute/second)", () => {
    expect(() => getCalendarDate("2026-08-01T99:99:99Z", "UTC")).toThrow();
  });
});

describe("year-below-1000 values (FIND-03 legacy rows)", () => {
  it("zero-pads the calendar year so it round-trips through the strict parser", () => {
    const legacy = new Date("0002-01-15T00:00:00.000Z");
    expect(getCalendarDate(legacy, "UTC")).toBe("0002-01-15");
    expect(() => formatDate(getCalendarDate(legacy, "UTC"))).not.toThrow();
  });

  it("formats a year-0002 date as year 2, never as 1902 (Date.UTC's two-digit-year quirk)", () => {
    expect(formatDate("0002-01-15")).not.toContain("1902");
    expect(formatDate(new Date("0002-01-15T00:00:00.000Z"))).not.toContain("1902");
  });
});

describe("isValidDateOnlyString", () => {
  it.each(["2026-08-01", "2028-02-29", "0002-01-15"])("accepts the real calendar date %s", (value) => {
    expect(isValidDateOnlyString(value)).toBe(true);
  });

  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-5", "2026-08-01T00:00:00.000Z", " 2026-08-01", "", "not-a-date"])(
    "rejects %j without throwing",
    (value) => {
      expect(isValidDateOnlyString(value)).toBe(false);
    },
  );
});

describe("getCalendarYearMonth", () => {
  it("uses the Jakarta calendar month, not UTC, at the month boundary", () => {
    // 2026-07-31T18:00:00Z is already 2026-08-01T01:00:00 in Asia/Jakarta (UTC+7).
    expect(getCalendarYearMonth(new Date("2026-07-31T18:00:00.000Z"), "Asia/Jakarta")).toEqual({ year: 2026, month: 8 });
  });

  it("accepts an explicit UTC timezone", () => {
    expect(getCalendarYearMonth(new Date("2026-07-31T18:00:00.000Z"), "UTC")).toEqual({ year: 2026, month: 7 });
  });

  it("throws on an invalid Date object", () => {
    expect(() => getCalendarYearMonth(new Date("invalid"), "UTC")).toThrow();
  });

  it("throws on an impossible calendar date string (day exceeds days in month)", () => {
    expect(() => getCalendarYearMonth("2026-02-30", "UTC")).toThrow();
  });

  it("throws on a malformed ISO timestamp string (out-of-range hour/minute/second)", () => {
    expect(() => getCalendarYearMonth("2026-08-01T99:99:99Z", "UTC")).toThrow();
  });
});
