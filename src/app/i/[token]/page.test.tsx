import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicInvoiceByToken } from "@/lib/invoice-share";
import { publicInvoicePageRateLimiter } from "@/lib/rate-limit";

vi.mock("@/lib/invoice-share", () => ({
  getPublicInvoiceByToken: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  publicInvoicePageRateLimiter: { check: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

const { headers } = vi.hoisted(() => ({
  headers: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers }));

vi.mock("./public-invoice-client", () => ({
  default: ({ token }: { token: string }) => <div data-testid="public-invoice-client">{token}</div>,
}));

import PublicInvoicePage, { metadata } from "./page";

const mockedLookup = vi.mocked(getPublicInvoiceByToken);
const mockedCheck = vi.mocked(publicInvoicePageRateLimiter.check);

function requestHeaders(forwardedFor?: string) {
  const h = new Headers();
  if (forwardedFor) h.set("x-forwarded-for", forwardedFor);
  return h;
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

function makeProps(token: string) {
  return { params: Promise.resolve({ token }) };
}

beforeEach(() => {
  mockedLookup.mockReset();
  mockedCheck.mockReset();
  notFound.mockClear();
  headers.mockReset();
  headers.mockResolvedValue(requestHeaders());
  mockedCheck.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 });
});

describe("public invoice page metadata", () => {
  it("tells search engines and crawlers not to index or follow the recipient link", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("PublicInvoicePage server validation", () => {
  it("renders the recipient client for a valid token", async () => {
    mockedLookup.mockResolvedValue(safeView);

    const element = await PublicInvoicePage(makeProps("valid-token"));

    expect(mockedLookup).toHaveBeenCalledWith(expect.anything(), "valid-token");
    expect(element.props.token).toBe("valid-token");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound for an unknown token instead of rendering a 200 client shell", async () => {
    mockedLookup.mockResolvedValue(null);

    await expect(PublicInvoicePage(makeProps("unknown-token"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledOnce();
  });

  it("calls notFound for a revoked token", async () => {
    mockedLookup.mockResolvedValue(null);

    await expect(PublicInvoicePage(makeProps("revoked-token"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledOnce();
  });

  it("calls notFound for a malformed token, identically to an unknown or revoked one", async () => {
    mockedLookup.mockResolvedValue(null);

    await expect(PublicInvoicePage(makeProps("!!!not-a-real-token%%%"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockedLookup).toHaveBeenCalledWith(expect.anything(), "!!!not-a-real-token%%%");
    expect(notFound).toHaveBeenCalledOnce();
  });
});

describe("PublicInvoicePage rate limiting", () => {
  it("performs the database lookup when the page request is allowed", async () => {
    mockedLookup.mockResolvedValue(safeView);

    await PublicInvoicePage(makeProps("valid-token"));

    expect(mockedCheck).toHaveBeenCalledOnce();
    expect(mockedLookup).toHaveBeenCalledWith(expect.anything(), "valid-token");
  });

  it("keys the limiter by client IP only, never by the bearer token", async () => {
    headers.mockResolvedValue(requestHeaders("203.0.113.7, 10.0.0.1"));
    mockedLookup.mockResolvedValue(safeView);

    await PublicInvoicePage(makeProps("valid-token"));

    expect(mockedCheck).toHaveBeenCalledWith("page:203.0.113.7");
  });

  it("calls notFound and skips the database lookup entirely when over the limit", async () => {
    mockedCheck.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 42_000 });

    await expect(PublicInvoicePage(makeProps("valid-token"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("produces the identical notFound response whether over-limit or the token is simply unknown", async () => {
    mockedCheck.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 42_000 });
    await expect(PublicInvoicePage(makeProps("valid-token"))).rejects.toThrow("NEXT_NOT_FOUND");
    const overLimitCalls = notFound.mock.calls.length;

    notFound.mockClear();
    mockedCheck.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 });
    mockedLookup.mockResolvedValue(null);
    await expect(PublicInvoicePage(makeProps("unknown-token"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound.mock.calls.length).toBe(overLimitCalls);
  });
});
