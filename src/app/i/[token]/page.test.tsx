import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getPublicInvoiceDocumentByToken } from "@/lib/invoice-share";
import { publicInvoicePageRateLimiter } from "@/lib/rate-limit";

vi.mock("@/lib/invoice-share", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/invoice-share")>();
  return { ...actual, getPublicInvoiceDocumentByToken: vi.fn() };
});

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

import PublicInvoicePage, { metadata } from "./page";

const mockedLookup = vi.mocked(getPublicInvoiceDocumentByToken);
const mockedCheck = vi.mocked(publicInvoicePageRateLimiter.check);

function requestHeaders(forwardedFor?: string) {
  const h = new Headers();
  if (forwardedFor) h.set("x-forwarded-for", forwardedFor);
  return h;
}

const okLookup = {
  kind: "ok" as const,
  input: {
    invoice: {
      id: "invoice-1",
      number: "INV/2026/07/001",
      subtotalIdr: 1_500_000,
      withholdingTaxType: "PPH23" as const,
      dueDate: new Date("2026-07-31T00:00:00.000Z"),
      createdAt: new Date("2026-07-15T00:00:00.000Z"),
    },
    deal: { brand: "Brand Kopi", contactName: "Budi", scope: "1 reel + 2 story", paymentTerms: "Lunas di muka" },
    settings: {
      issuerName: "Kenji",
      issuerAddress: "",
      issuerWhatsapp: "",
      issuerEmail: "",
      bankName: "BCA",
      bankAccountNumber: "123",
      bankAccountHolder: "Kenji",
    },
  },
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

describe("PublicInvoicePage server rendering", () => {
  it("server-renders the canonical document directly for a valid token, no client re-fetch", async () => {
    mockedLookup.mockResolvedValue(okLookup);

    const element = await PublicInvoicePage(makeProps("valid-token"));
    render(element);

    expect(mockedLookup).toHaveBeenCalledWith(expect.anything(), "valid-token");
    expect(notFound).not.toHaveBeenCalled();
    expect(screen.getByText("INV/2026/07/001")).toBeDefined();
    expect(screen.getByText("Brand Kopi")).toBeDefined();
  });

  it("renders exactly one PDF action, pointed at the token-scoped PDF route", async () => {
    mockedLookup.mockResolvedValue(okLookup);

    render(await PublicInvoicePage(makeProps("valid-token")));

    const pdfLinks = screen.getAllByRole("link", { name: "Unduh PDF" });
    expect(pdfLinks).toHaveLength(1);
    expect(pdfLinks[0].getAttribute("href")).toBe("/api/public/invoices/valid-token/pdf");
  });

  it("calls notFound for an unknown token instead of rendering a 200 page", async () => {
    mockedLookup.mockResolvedValue({ kind: "invalid" });

    await expect(PublicInvoicePage(makeProps("unknown-token"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledOnce();
  });

  it("calls the identical notFound for a malformed token as for an unknown one", async () => {
    mockedLookup.mockResolvedValue({ kind: "invalid" });

    await expect(PublicInvoicePage(makeProps("!!!not-a-real-token%%%"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockedLookup).toHaveBeenCalledWith(expect.anything(), "!!!not-a-real-token%%%");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders a distinct, honest expired state instead of notFound, with no invoice data leaked", async () => {
    mockedLookup.mockResolvedValue({ kind: "expired" });

    const element = await PublicInvoicePage(makeProps("expired-token"));
    render(element);

    expect(notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("sudah tidak berlaku");
    expect(screen.queryByRole("link", { name: "Unduh PDF" })).toBeNull();
  });

  it("never throws for invalid, expired, or an invoice with incomplete issuer settings (no-500 across all three)", async () => {
    mockedLookup.mockResolvedValueOnce({ kind: "invalid" });
    await expect(PublicInvoicePage(makeProps("a"))).rejects.toThrow("NEXT_NOT_FOUND"); // notFound() is a controlled Next.js flow, not a crash

    mockedLookup.mockResolvedValueOnce({ kind: "expired" });
    await expect(PublicInvoicePage(makeProps("b"))).resolves.toBeDefined();

    mockedLookup.mockResolvedValueOnce({
      ...okLookup,
      input: {
        ...okLookup.input,
        settings: {
          issuerName: "",
          issuerAddress: "",
          issuerWhatsapp: "",
          issuerEmail: "",
          bankName: "",
          bankAccountNumber: "",
          bankAccountHolder: "",
        },
      },
    });
    await expect(PublicInvoicePage(makeProps("c"))).resolves.toBeDefined();
  });

  it("shows the incomplete-account notice inline in the document when the issuer never saved bank details", async () => {
    mockedLookup.mockResolvedValue({
      ...okLookup,
      input: { ...okLookup.input, settings: { ...okLookup.input.settings, bankAccountNumber: "" } },
    });

    render(await PublicInvoicePage(makeProps("valid-token")));

    expect(screen.getByRole("alert").textContent).toBe("Detail rekening belum lengkap.");
  });
});

describe("PublicInvoicePage rate limiting", () => {
  it("performs the database lookup when the page request is allowed", async () => {
    mockedLookup.mockResolvedValue(okLookup);

    await PublicInvoicePage(makeProps("valid-token"));

    expect(mockedCheck).toHaveBeenCalledOnce();
    expect(mockedLookup).toHaveBeenCalledWith(expect.anything(), "valid-token");
  });

  it("keys the limiter by client IP only, never by the bearer token", async () => {
    headers.mockResolvedValue(requestHeaders("203.0.113.7, 10.0.0.1"));
    mockedLookup.mockResolvedValue(okLookup);

    await PublicInvoicePage(makeProps("valid-token"));

    expect(mockedCheck).toHaveBeenCalledWith("page:203.0.113.7");
  });

  it("calls notFound and skips the database lookup entirely when over the limit", async () => {
    mockedCheck.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 42_000 });

    await expect(PublicInvoicePage(makeProps("valid-token"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockedLookup).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("produces the identical notFound response whether over-limit or the token is simply invalid", async () => {
    mockedCheck.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 42_000 });
    await expect(PublicInvoicePage(makeProps("valid-token"))).rejects.toThrow("NEXT_NOT_FOUND");
    const overLimitCalls = notFound.mock.calls.length;

    notFound.mockClear();
    mockedCheck.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 });
    mockedLookup.mockResolvedValue({ kind: "invalid" });
    await expect(PublicInvoicePage(makeProps("unknown-token"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound.mock.calls.length).toBe(overLimitCalls);
  });
});
