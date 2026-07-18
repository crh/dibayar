import { describe, expect, it } from "vitest";
import { bestEffortClientIp } from "./request-ip";

function headersWithForwardedFor(value: string | null) {
  const headers = new Headers();
  if (value !== null) headers.set("x-forwarded-for", value);
  return headers;
}

describe("bestEffortClientIp", () => {
  it("takes the first address when there is a proxy chain", () => {
    expect(bestEffortClientIp(headersWithForwardedFor("203.0.113.5, 10.0.0.1"))).toBe("203.0.113.5");
  });

  it("trims surrounding whitespace", () => {
    expect(bestEffortClientIp(headersWithForwardedFor("  203.0.113.5  , 10.0.0.1"))).toBe("203.0.113.5");
  });

  it("falls back safely when the header is missing", () => {
    expect(bestEffortClientIp(headersWithForwardedFor(null))).toBe("unknown-client");
  });

  it("falls back safely when the header is empty", () => {
    expect(bestEffortClientIp(headersWithForwardedFor(""))).toBe("unknown-client");
  });

  it("works from a plain Request's headers, the Route Handler call site", () => {
    const request = new Request("http://localhost/x", { headers: headersWithForwardedFor("203.0.113.9") });
    expect(bestEffortClientIp(request.headers)).toBe("203.0.113.9");
  });

  it("intentionally keeps only the first entry, not the last, since Vercel overwrites x-forwarded-for at its edge", () => {
    expect(bestEffortClientIp(headersWithForwardedFor("203.0.113.5, 198.51.100.7, 10.0.0.1"))).toBe("203.0.113.5");
  });
});
