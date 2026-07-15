const INVOICE_NUMBER_PATTERN = /^INV\/(\d{4})\/(0[1-9]|1[0-2])\/(\d{3,})$/;

const DEFAULT_INVOICE_TIME_ZONE = "Asia/Jakarta";

/**
 * Production-facing counter for a single (userId, year, month) row. The
 * implementation backing this MUST perform the increment-and-read as one
 * atomic database statement, e.g. a Postgres
 *   INSERT INTO "InvoiceSequence" ("userId", "year", "month", "lastSequence", ...)
 *   VALUES ($1, $2, $3, 1, ...)
 *   ON CONFLICT ("userId", "year", "month")
 *   DO UPDATE SET "lastSequence" = "InvoiceSequence"."lastSequence" + 1
 *   RETURNING "lastSequence"
 * so concurrent callers for the same user/month serialize on that row's
 * lock and each gets a distinct, gap-free sequence value. A read-then-write
 * (a `count`/`findUnique` followed by a separate `update`) is NOT a valid
 * implementation: two concurrent invoice creations could read the same
 * prior value and mint the same invoice number.
 */
export type InvoiceSequenceDb = {
  invoiceSequence: {
    increment(args: { userId: string; year: number; month: number }): Promise<{ lastSequence: number }>;
  };
};

export function invoiceYearMonth(
  date: Date,
  timeZone: string = DEFAULT_INVOICE_TIME_ZONE,
): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, month };
}

export function invoiceNumberPrefix(
  date: Date,
  timeZone: string = DEFAULT_INVOICE_TIME_ZONE,
): string {
  const { year, month } = invoiceYearMonth(date, timeZone);
  return `INV/${year}/${String(month).padStart(2, "0")}/`;
}

/**
 * Generates the next sequential invoice number for a user within the given
 * month, e.g. INV/2026/07/001. The sequence resets each calendar month and
 * is scoped per user, so two users can share the same number. The month
 * boundary is evaluated in `timeZone` (Asia/Jakarta by default) since the
 * product is Indonesia-first, not the server's UTC clock.
 *
 * Relies entirely on `db.invoiceSequence.increment` for uniqueness — see
 * the atomicity contract on `InvoiceSequenceDb`. This function does not
 * retry or lock; it trusts the single atomic increment call.
 */
export async function nextInvoiceNumber(
  db: InvoiceSequenceDb,
  userId: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_INVOICE_TIME_ZONE,
): Promise<string> {
  const { year, month } = invoiceYearMonth(now, timeZone);
  const prefix = invoiceNumberPrefix(now, timeZone);
  const { lastSequence } = await db.invoiceSequence.increment({ userId, year, month });
  return `${prefix}${String(lastSequence).padStart(3, "0")}`;
}

export function isValidInvoiceNumber(value: string): boolean {
  return INVOICE_NUMBER_PATTERN.test(value);
}

export function parseInvoiceNumber(
  value: string,
): { year: number; month: number; sequence: number } | null {
  const match = INVOICE_NUMBER_PATTERN.exec(value);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    sequence: Number(match[3]),
  };
}
