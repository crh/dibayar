export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly options: RateLimitOptions) {}

  check(key: string, now = Date.now()): RateLimitResult {
    const current = this.buckets.get(key);
    const bucket = !current || now >= current.resetAt
      ? { count: 0, resetAt: now + this.options.windowMs }
      : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    const allowed = bucket.count <= this.options.limit;
    return {
      allowed,
      remaining: Math.max(0, this.options.limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }
}

export const authRateLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
});

// In-memory and per-instance: on multi-instance Vercel deployment this limits
// each instance independently rather than the client globally. Acceptable for
// current scale; a shared store (e.g. Redis) is required before that changes.
export const publicInvoiceJsonRateLimiter = new RateLimiter({
  limit: 30,
  windowMs: 60_000,
});

export const publicInvoicePdfRateLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
});

// Gates the recipient HTML page (`/i/[token]`) itself, ahead of its server-side
// database lookup. Same per-instance caveat as the limiters above; a denied page
// request must still resolve to the uniform notFound() response, never a
// distinguishable one, so it doesn't leak whether a token would otherwise exist.
export const publicInvoicePageRateLimiter = new RateLimiter({
  limit: 30,
  windowMs: 60_000,
});

// Keyed by session user id (not IP): PATCH /api/me/language is authenticated,
// so the session id is a stable, spoof-resistant key that also can't
// false-positive multiple users behind the same NAT/IP.
export const userLanguageRateLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
});

// Same per-session-id rationale as userLanguageRateLimiter, for PATCH/GET
// /api/me/settings.
export const userSettingsRateLimiter = new RateLimiter({
  limit: 20,
  windowMs: 60_000,
});
