import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows requests up to the limit and rejects the next request", () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 60_000 });

    expect(limiter.check("user-1", 1_000).allowed).toBe(true);
    expect(limiter.check("user-1", 1_001).allowed).toBe(true);
    expect(limiter.check("user-1", 1_002).allowed).toBe(false);
  });

  it("keeps separate counters for separate keys", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check("ip-a", 1_000).allowed).toBe(true);
    expect(limiter.check("ip-b", 1_000).allowed).toBe(true);
    expect(limiter.check("ip-a", 1_001).allowed).toBe(false);
  });

  it("starts a new window after the current window expires", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.check("ip-a", 1_000).allowed).toBe(true);
    expect(limiter.check("ip-a", 1_999).allowed).toBe(false);
    expect(limiter.check("ip-a", 2_000).allowed).toBe(true);
  });
});
