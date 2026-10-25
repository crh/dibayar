import { isValidDateOnlyString } from "./format/date";

// The one due-date contract shared by the DateField, the API schemas, and
// the invoice read path. A due date is a date-only business date, sent as a
// strict yyyy-mm-dd string and stored as UTC midnight (see
// prisma/schema.prisma Invoice.dueDate).
//
// Supported range, inclusive. There is no business rule for invoice due
// dates beyond "a real, near-term calendar day", so the bounds are chosen to
// be far wider than any real invoice while still rejecting what broken input
// produces: a native date input emits complete-but-wrong values on every
// intermediate year digit while someone types (0002-, 0020-, 0202-, then
// 2026-), and a stray extra digit can yield a 5-digit year. Every such value
// falls outside 2000-2099, and every in-range value keeps a 4-digit year so
// all formatters and the strict yyyy-mm-dd parser handle it.
export const DUE_DATE_MIN = "2000-01-01";
export const DUE_DATE_MAX = "2099-12-31";

export type DueDateInputCheck =
  | { kind: "valid"; value: string }
  | { kind: "empty" }
  | { kind: "malformed" }
  | { kind: "out-of-range" };

// Classifies a raw yyyy-mm-dd string exactly as given: no trimming, no
// timestamp acceptance, no coercion of impossible days (2026-02-30).
export function checkDueDateInput(value: string): DueDateInputCheck {
  if (value === "") return { kind: "empty" };
  if (!isValidDateOnlyString(value)) return { kind: "malformed" };
  // Lexicographic comparison is exact for zero-padded 4-digit years.
  if (value < DUE_DATE_MIN || value > DUE_DATE_MAX) return { kind: "out-of-range" };
  return { kind: "valid", value };
}

export function dueDateInputToStoredDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// Read-path guard for a value already stored (a Date from Prisma, or the ISO
// string it becomes after a JSON round-trip). Returns the supported
// yyyy-mm-dd calendar date, or null when the stored value is unparseable or
// outside the supported range -- e.g. a legacy year-0002 row saved before the
// API enforced this contract. Never throws, so a bad row can't take down a
// page that renders it.
export function storedDueDateToInputValue(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // toISOString() gives "+010000-..." for years past 9999, which the check
  // below then rejects as malformed.
  const calendarDate = date.toISOString().slice(0, 10);
  return checkDueDateInput(calendarDate).kind === "valid" ? calendarDate : null;
}

export function isSupportedStoredDueDate(value: Date | string): boolean {
  return storedDueDateToInputValue(value) !== null;
}
