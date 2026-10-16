import { fetchWithTimeout } from "@/lib/http";

// What a write to the app's own API came to, as far as the page can tell
// (#53):
//
// - "ok": a JSON 2xx answer;
// - "rejected": a 4xx answer. The route refused before anything was stored
//   (a ZodError, auth, Origin, a reused key), or, without JSON, something in
//   front of it refused the request before it reached the app;
// - "unknown": no answer in time, a dropped connection, or any 5xx. A 5xx
//   may come from a gateway that gave up while the app was still storing
//   the request, and JSON alone does not prove it came from the app, so the
//   request may still have been stored. A create is therefore repeated with
//   the same Idempotency-Key (see src/lib/idempotency.ts), never a new one.
export type MutationResult =
  | { kind: "ok"; status: number; body: unknown }
  | { kind: "rejected"; status: number; body: unknown }
  | { kind: "unknown" };

export async function sendMutation(input: string, init: RequestInit, timeoutMs?: number): Promise<MutationResult> {
  let response: Response;
  try {
    response = await fetchWithTimeout(input, init, timeoutMs);
  } catch {
    return { kind: "unknown" };
  }

  if (response.status >= 500) return { kind: "unknown" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Not the API's own answer. A 4xx without JSON was still refused before
    // reaching a write; a 2xx or 3xx without it is not known.
    return response.status >= 400 ? { kind: "rejected", status: response.status, body: null } : { kind: "unknown" };
  }
  return response.ok ? { kind: "ok", status: response.status, body } : { kind: "rejected", status: response.status, body };
}

// Server side: src/lib/idempotency.ts (which imports Prisma, so the page
// takes the header name from here).
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

// A key for one submission of a create. randomUUID needs a secure context
// (HTTPS or localhost), which every deployment is; the fallback only keeps
// a plain-HTTP dev setup working.
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// The key for a create of `body`: the pending one when the same content is
// sent again after an unknown outcome, so the server can return what the
// first attempt stored; a new one when the content changed.
export function idempotencyKeyFor(pending: { key: string; body: string } | null, body: string): string {
  return pending && pending.body === body ? pending.key : newIdempotencyKey();
}

// The message for a refused or unknown write. A refusal the person can do
// something specific about (sign in again, reload, wait) says so; every
// other refusal keeps the action's own message (`fallbackKey`), which is
// never the server's raw text.
export function mutationErrorKey(result: Exclude<MutationResult, { kind: "ok" }>, fallbackKey: string): string {
  if (result.kind === "unknown") return "error.connection";
  if (result.status === 401) return "error.sessionExpired";
  if (result.status === 403) return "error.originRejected";
  if (result.status === 429) return "error.rateLimited";
  return fallbackKey;
}

export function bodyField<T>(body: unknown, field: string): T | undefined {
  return body && typeof body === "object" && field in body ? ((body as Record<string, unknown>)[field] as T) : undefined;
}
