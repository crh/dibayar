import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicInvoiceByToken } from "@/lib/invoice-share";
import { publicInvoiceJsonRateLimiter } from "@/lib/rate-limit";
import { GET } from "./route";

vi.mock("@/lib/invoice-share", () => ({
  getPublicInvoiceByToken: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  publicInvoiceJsonRateLimiter: { check: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const mockedLookup = vi.mocked(getPublicInvoiceByToken);
const mockedCheck = vi.mocked(publicInvoiceJsonRateLimiter.check);

function makeContext(token: string) {
  return { params: Promise.resolve({ token }) };
}

function req(token: string, forwardedFor?: string) {
  const headers = new Headers();
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  return new Request(`http://localhost/api/public/invoices/${token}`, { headers });
}

const safeView = {
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxLabel: "PPh 23",
  status: "SENT" as const,
  dueDate: new Date("2026-07-31T00:00:00.000Z"),
  brand: "Brand Kopi",
  scope: "1 reel + 2 story",
  issuerName: "Kenji",
};

beforeEach(() => {
  mockedLookup.mockReset();
  mockedCheck.mockReset();
  mockedCheck.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 });
});

describe("GET /api/public/invoices/[token]", () => {
  it("returns the safe projection for a valid token with recipient-safe headers", async () => {
    mockedLookup.mockResolvedValue(safeView);

    const response = await GET(req("valid-token"), makeContext("valid-token"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ invoice: expect.objectContaining({ number: "INV/2026/07/001" }) });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("never exposes internal identifiers in the safe projection", async () => {
    mockedLookup.mockResolvedValue(safeView);

    const response = await GET(req("valid-token"), makeContext("valid-token"));
    const body = await response.json();

    expect(body.invoice).not.toHaveProperty("id");
    expect(body.invoice).not.toHaveProperty("userId");
    expect(body.invoice).not.toHaveProperty("dealId");
    expect(body.invoice).not.toHaveProperty("tokenHash");
  });

  it("returns 404 for an unknown token", async () => {
    mockedLookup.mockResolvedValue(null);

    const response = await GET(req("unknown-token"), makeContext("unknown-token"));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Invoice tidak ditemukan.");
  });

  it("returns the identical 404 for an expired token", async () => {
    mockedLookup.mockResolvedValue(null);

    const response = await GET(req("expired-token"), makeContext("expired-token"));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Invoice tidak ditemukan.");
  });

  it("returns the identical 404 body for a malformed token as for an unknown one", async () => {
    mockedLookup.mockResolvedValue(null);

    const response = await GET(req("!!!not-a-real-token%%%"), makeContext("!!!not-a-real-token%%%"));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Invoice tidak ditemukan.");
  });

  it("applies recipient-safe headers even on a 404", async () => {
    mockedLookup.mockResolvedValue(null);

    const response = await GET(req("unknown-token"), makeContext("unknown-token"));

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });

  it("keys the rate limiter by endpoint plus the first trusted x-forwarded-for address", async () => {
    mockedLookup.mockResolvedValue(safeView);

    await GET(req("valid-token", "203.0.113.7, 10.0.0.1"), makeContext("valid-token"));

    expect(mockedCheck).toHaveBeenCalledWith("json:203.0.113.7");
  });

  it("falls back to a safe key when x-forwarded-for is absent", async () => {
    mockedLookup.mockResolvedValue(safeView);

    await GET(req("valid-token"), makeContext("valid-token"));

    expect(mockedCheck).toHaveBeenCalledWith("json:unknown-client");
  });

  it("returns 429 with Retry-After when the limiter rejects the request, before any lookup", async () => {
    mockedCheck.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 42_000 });

    const response = await GET(req("valid-token"), makeContext("valid-token"));

    expect(response.status).toBe(429);
    expect(response.headers.has("Retry-After")).toBe(true);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("returns a controlled 500 without leaking database details", async () => {
    mockedLookup.mockRejectedValue(new Error("db details must not leak"));

    const response = await GET(req("valid-token"), makeContext("valid-token"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Invoice belum bisa dimuat. Coba lagi." });
  });
});
