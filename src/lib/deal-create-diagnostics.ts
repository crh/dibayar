import type { ZodError } from "zod";

// TEMPORARY (issue #50): a deal save that fails shows one generic message
// whatever went wrong, and Vercel's request log records only the status. This
// names the failure without recording anything the person typed: field
// paths and Zod issue codes, never values; a device family, never the full
// user agent; no user id, cookie, session or request body. Remove once #50
// is closed.

export type DealCreateFailureCode =
  | "UNAUTHENTICATED"
  | "ORIGIN_REJECTED"
  | "INVALID_JSON"
  | "INVALID_INPUT"
  | "SERVER_ERROR";

export type DealCreateIssue = { path: string; code: string };

export function summarizeIssues(error: ZodError): DealCreateIssue[] {
  return error.issues.map((issue) => ({ path: issue.path.join(".") || "(body)", code: issue.code }));
}

export function deviceFamily(userAgent: string | null): "ios" | "android" | "other" {
  if (!userAgent) return "other";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "other";
}

// Prisma's own error codes (P2002 and so on) are safe to record; nothing else
// from an unexpected error is.
export function safeErrorName(error: unknown): string {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^P\d{4}$/.test(code)) return code;
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && /^[A-Za-z]{1,64}$/.test(name)) return name;
  }
  return typeof error;
}

export function newFailureRef(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function logDealCreateFailure(entry: {
  ref: string;
  status: number;
  code: DealCreateFailureCode;
  device: ReturnType<typeof deviceFamily>;
  issues?: DealCreateIssue[];
  errorName?: string;
}) {
  console.warn(`[deal-create-failed] ${JSON.stringify(entry)}`);
}
