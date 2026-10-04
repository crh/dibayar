import { NUMBER_DATE_LOCALE } from "@/lib/locale";

export type DateInput = Date | string;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Date.UTC() maps years 0-99 to 1900-1999, so a year-0002 value would format
// as 1902; setUTCFullYear() takes the year literally.
function utcCalendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

interface ParsedDateString {
  year: number;
  month: number;
  day: number;
  // The validated instant: UTC midnight for a date-only string, or the
  // actual parsed instant for a full ISO timestamp (preserving its time
  // and offset, needed so calendar helpers can resolve the correct
  // Asia/Jakarta/UTC calendar day).
  instant: Date;
}

// The single strict string parser every exported date helper routes
// through for string inputs. Rejects impossible calendar dates (e.g.
// 2026-02-30), out-of-range time components, out-of-range timezone
// offsets, and trailing junk instead of letting the permissive `new
// Date(string)` constructor silently normalize or accept them.
function parseDateString(value: string): ParsedDateString {
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(value);
  const timestampMatch = dateOnlyMatch ? null : ISO_TIMESTAMP_PATTERN.exec(value);
  const match = dateOnlyMatch ?? timestampMatch;
  if (!match) {
    throw new Error(`Expected an ISO yyyy-mm-dd date, received: ${value}`);
  }
  const [, yearText, monthText, dayText] = match;
  const [year, month, day] = [Number(yearText), Number(monthText), Number(dayText)];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid calendar date, received: ${value}`);
  }
  if (!timestampMatch) {
    return { year, month, day, instant: utcCalendarDate(year, month, day) };
  }
  const [, , , , hourText, minuteText, secondText, offset] = timestampMatch;
  if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) {
    throw new Error(`Invalid time component, received: ${value}`);
  }
  if (offset && offset !== "Z") {
    const [offsetHour, offsetMinute] = offset.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) {
      throw new Error(`Invalid timezone offset, received: ${value}`);
    }
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid date input: ${value}`);
  }
  return { year, month, day, instant };
}

// True only for a strict yyyy-mm-dd string naming a real calendar day (no
// timestamp, no trailing junk, no 2026-02-30). Never throws.
export function isValidDateOnlyString(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  try {
    parseDateString(value);
    return true;
  } catch {
    return false;
  }
}

function toDate(value: DateInput): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid date input: ${String(value)}`);
    }
    return value;
  }
  return parseDateString(value).instant;
}

// Parses only the date components and builds a UTC instant so a date-only
// value like "2026-08-01" (or a real Date already at UTC midnight) never
// shifts to the previous/next day under a non-UTC process timezone, and so
// a full ISO timestamp's time-of-day/offset never shifts its reported day.
function toUtcDate(value: DateInput): Date {
  if (value instanceof Date) {
    const date = toDate(value);
    return utcCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const { year, month, day } = parseDateString(value);
  return utcCalendarDate(year, month, day);
}

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(NUMBER_DATE_LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat(NUMBER_DATE_LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// Indonesian short display, e.g. "24 Jul 2026". Language-independent: never
// varies with uiLanguage (see SPEC_RECONCILIATION.md T-01).
export function formatDate(value: DateInput): string {
  return SHORT_DATE_FORMATTER.format(toUtcDate(value));
}

// Indonesian long document display, e.g. "24 Juli 2026".
export function formatDateLong(value: DateInput): string {
  return LONG_DATE_FORMATTER.format(toUtcDate(value));
}

// Indonesian month + year label, e.g. "Agustus 2026", read in an explicit
// timezone (defaults to Asia/Jakarta, the only zone this label is used for today).
export function formatMonthYearLabel(value: DateInput, timeZone: string = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat(NUMBER_DATE_LOCALE, { month: "long", year: "numeric", timeZone }).format(toDate(value));
}

function calendarParts(value: DateInput, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toDate(value));
  const byType = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day", number>;
  return byType;
}

// Calendar YYYY-MM-DD for an instant, read in an explicit timezone (e.g. the
// Asia/Jakarta "today", or the UTC calendar date of a UTC-midnight-stored
// date-only value). No default: callers must be explicit about which
// timezone's calendar they mean. The year is zero-padded to four digits so a
// year below 1000 still round-trips through the strict yyyy-mm-dd parser
// (an unpadded "2-01-15" used to throw on render, FIND-03).
export function getCalendarDate(value: DateInput, timeZone: string): string {
  const { year, month, day } = calendarParts(value, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Year/month extraction for an instant, read in an explicit timezone.
export function getCalendarYearMonth(value: DateInput, timeZone: string): { year: number; month: number } {
  const { year, month } = calendarParts(value, timeZone);
  return { year, month };
}
