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
