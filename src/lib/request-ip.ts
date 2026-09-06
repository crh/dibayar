// Vercel's edge network documents that it always overwrites x-forwarded-for,
// setting the first entry to the connecting client's address, so reading that
// first entry is meaningful on this deployment target. It is still only a
// best-effort identifier, not a verified/authenticated one: anyone who can
// reach the origin directly (bypassing Vercel) can forge this header, so it
// must never be used as an authorization or security boundary — only for
// coarse, best-effort purposes like rate-limit bucketing.
// Accepts any Headers-like object so both Route Handlers (`request.headers`) and
// Server Components (`await headers()` from `next/headers`) can share this helper.
export function bestEffortClientIp(headers: Pick<Headers, "get">): string {
  const forwardedFor = headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown-client";
}
