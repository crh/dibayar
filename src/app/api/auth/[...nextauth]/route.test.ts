import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match NextRequest handlers
const handlersGet = vi.fn(async (_request: NextRequest) => NextResponse.json({ ok: "get" }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match NextRequest handlers
const handlersPost = vi.fn(async (_request: NextRequest) => NextResponse.json({ ok: "post" }));

vi.mock("@/auth", () => ({
  handlers: {
    GET: (request: NextRequest) => handlersGet(request),
    POST: (request: NextRequest) => handlersPost(request),
  },
}));

const checkMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  authRateLimiter: { check: (...args: unknown[]) => checkMock(...args) },
}));

const { GET, POST } = await import("./route");

function request(method: "GET" | "POST", path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"), { method });
}

describe("auth route rate limiting", () => {
  beforeEach(() => {
    checkMock.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
  });

  afterEach(() => {
    handlersGet.mockClear();
    handlersPost.mockClear();
    checkMock.mockClear();
  });

  it("does not consume the limiter when the sign-in page is only rendered (GET)", async () => {
    await GET(request("GET", "/api/auth/signin"));

    expect(checkMock).not.toHaveBeenCalled();
    expect(handlersGet).toHaveBeenCalledOnce();
  });

  it("consumes the limiter for an actual sign-in POST attempt", async () => {
    await POST(request("POST", "/api/auth/signin/google"));

    expect(checkMock).toHaveBeenCalledOnce();
    expect(handlersPost).toHaveBeenCalledOnce();
  });

  it("blocks a sign-in POST once the limiter reports the bucket is exhausted", async () => {
    checkMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 });

    const response = await POST(request("POST", "/api/auth/signin/google"));

    expect(response.status).toBe(429);
    expect(handlersPost).not.toHaveBeenCalled();
  });

  it("bypasses the limiter for the OAuth callback (GET) so a successful provider return is never blocked", async () => {
    checkMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 });

    const response = await GET(request("GET", "/api/auth/callback/google"));

    expect(checkMock).not.toHaveBeenCalled();
    expect(response.status).not.toBe(429);
    expect(handlersGet).toHaveBeenCalledOnce();
  });

  it("bypasses the limiter for the OAuth callback (POST) so a successful provider return is never blocked", async () => {
    checkMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 });

    const response = await POST(request("POST", "/api/auth/callback/google"));

    expect(checkMock).not.toHaveBeenCalled();
    expect(response.status).not.toBe(429);
    expect(handlersPost).toHaveBeenCalledOnce();
  });
});
