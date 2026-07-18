import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicInvoicePdfDataByToken } from "@/lib/invoice-share";
import { publicInvoicePdfRateLimiter } from "@/lib/rate-limit";
import { renderToBuffer } from "@react-pdf/renderer";
import { GET } from "./route";

vi.mock("@/lib/invoice-share", () => ({
  getPublicInvoicePdfDataByToken: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  publicInvoicePdfRateLimiter: { check: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...actual, renderToBuffer: vi.fn() };
});

const mockedLookup = vi.mocked(getPublicInvoicePdfDataByToken);
const mockedCheck = vi.mocked(publicInvoicePdfRateLimiter.check);
const mockedRenderToBuffer = vi.mocked(renderToBuffer);

function makeContext(token: string) {
  return { params: Promise.resolve({ token }) };
}

function req(token: string, forwardedFor?: string) {
  const headers = new Headers();
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  return new Request(`http://localhost/api/public/invoices/${token}/pdf`, { headers });
}

const pdfData = {
  invoice: {
    number: "INV/2026/07/001",
    subtotalIdr: 1_500_000,
    withholdingTaxType: "PPH23" as const,
    status: "SENT" as const,
    dueDate: new Date("2026-07-31T00:00:00.000Z"),
  },
  deal: { brand: "Brand Kopi", scope: "1 reel + 2 story" },
};

beforeEach(() => {
  mockedLookup.mockReset();
  mockedCheck.mockReset();
  mockedRenderToBuffer.mockReset();
  mockedCheck.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
});

describe("GET /api/public/invoices/[token]/pdf", () => {
  it("streams the PDF for a valid token without requiring authentication", async () => {
    mockedLookup.mockResolvedValue(pdfData);
    mockedRenderToBuffer.mockResolvedValue(Buffer.from("%PDF-1.7 test"));

    const response = await GET(req("valid-token"), makeContext("valid-token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain('filename="INV-2026-07-001.pdf"');
    expect(await response.text()).toBe("%PDF-1.7 test");
  });

  it("applies recipient-safe headers on a successful response", async () => {
    mockedLookup.mockResolvedValue(pdfData);
    mockedRenderToBuffer.mockResolvedValue(Buffer.from("%PDF-1.7 test"));

    const response = await GET(req("valid-token"), makeContext("valid-token"));

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("returns 404 for an unknown token", async () => {
    mockedLookup.mockResolvedValue(null);

    const response = await GET(req("unknown-token"), makeContext("unknown-token"));

    expect(response.status).toBe(404);
    expect(mockedRenderToBuffer).not.toHaveBeenCalled();
  });

  it("keys the rate limiter by endpoint plus the first trusted x-forwarded-for address", async () => {
    mockedLookup.mockResolvedValue(pdfData);
    mockedRenderToBuffer.mockResolvedValue(Buffer.from("%PDF"));

    await GET(req("valid-token", "203.0.113.7, 10.0.0.1"), makeContext("valid-token"));

    expect(mockedCheck).toHaveBeenCalledWith("pdf:203.0.113.7");
  });

  it("returns 429 with Retry-After when the limiter rejects the request, before any lookup", async () => {
    mockedCheck.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 15_000 });

    const response = await GET(req("valid-token"), makeContext("valid-token"));

    expect(response.status).toBe(429);
    expect(response.headers.has("Retry-After")).toBe(true);
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it("returns a controlled 500 when PDF rendering fails, without leaking details", async () => {
    mockedLookup.mockResolvedValue(pdfData);
    mockedRenderToBuffer.mockRejectedValue(new Error("renderer details must not leak"));

    const response = await GET(req("valid-token"), makeContext("valid-token"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "PDF invoice belum bisa dibuat. Coba lagi." });
  });
});
