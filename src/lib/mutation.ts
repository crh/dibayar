import { fetchWithTimeout } from "@/lib/http";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

// What a write to the app's own API came to, as far as the page can tell
// (#53). The API answers every request it handles with JSON, so:
//
// - "ok": a JSON 2xx answer;
// - "rejected": a JSON error answer. The route refused or failed before
//   anything was stored (a ZodError, auth, Origin or a thrown write all end
//   in its catch, with the transaction rolled back), so nothing changed;
// - "unknown": no answer in time, a dropped connection, or something that is
//   not the API's JSON (a gateway's 502/504 page). The request may still
//   have been stored, so a create must be checked before it is sent again.
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

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Not the API's own answer. A 4xx without JSON was still refused before
    // reaching a write; anything else is not known.
    return response.status >= 400 && response.status < 500 ? { kind: "rejected", status: response.status, body: null } : { kind: "unknown" };
  }
  return response.ok ? { kind: "ok", status: response.status, body } : { kind: "rejected", status: response.status, body };
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

type DealLike = { id: string; brand: string; contactWa: string; scope: string; feeIdr: number };

// After a create whose outcome is unknown: the deal the server holds that
// this page did not know about and that has exactly what was sent, if any.
// Compared the way the server stores it (trimmed, number normalized).
export function findCreatedDeal<T extends DealLike>(
  serverDeals: T[],
  knownIds: ReadonlySet<string>,
  sent: { brand: string; contactWa: string; scope: string; feeIdr: number },
): T | null {
  const contactWa = normalizeWhatsAppNumber(sent.contactWa) ?? sent.contactWa.trim();
  return (
    serverDeals.find(
      (deal) =>
        !knownIds.has(deal.id) &&
        deal.brand === sent.brand.trim() &&
        deal.scope === sent.scope.trim() &&
        deal.feeIdr === sent.feeIdr &&
        deal.contactWa === contactWa,
    ) ?? null
  );
}

// The app makes one invoice per deal (the create action is only offered
// while the deal has none), so any invoice for the deal is the one created.
export function findCreatedInvoice<T extends { dealId: string }>(serverInvoices: T[], dealId: string): T | null {
  return serverInvoices.find((invoice) => invoice.dealId === dealId) ?? null;
}

// Reads a list from the API to check what an unknown write did. null means
// the check itself failed, so the outcome is still unknown.
export async function readList<T>(input: string, field: string): Promise<T[] | null> {
  const result = await sendMutation(input, { cache: "no-store" });
  if (result.kind !== "ok") return null;
  const list = bodyField<T[]>(result.body, field);
  return Array.isArray(list) ? list : null;
}
