import { fetchWithTimeout } from "@/lib/http";

// What a write to the app's own API came to, as far as the page can tell
// (#53):
//
// - "ok": a JSON 2xx answer;
// - "rejected": a non-408 4xx answer (validation, auth, Origin, conflict,
//   rate limit), including a non-JSON response rejected by an intermediary;
// - "unknown": no answer in time, a dropped connection, HTTP 408 or any 5xx.
//   A gateway can time out after forwarding a write; even a JSON body does
//   not prove it failed before storage. Retrying a create must keep its
//   Idempotency-Key (see src/lib/idempotency.ts), never allocate a new one.
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

  // HTTP 408 is also an uncertain timeout: the write could still commit
  // after an intermediary gives up, even if its response is valid JSON.
  if (response.status === 408 || response.status >= 500) return { kind: "unknown" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Not the API's own answer. A non-408 4xx without JSON is treated as
    // rejected; a 2xx/3xx with no JSON remains unknown.
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
