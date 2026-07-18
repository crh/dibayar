import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PublicInvoiceClient from "./public-invoice-client";

const safeInvoice = {
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxLabel: "PPh 23",
  status: "SENT" as const,
  dueDate: "2026-07-31T00:00:00.000Z",
  brand: "Brand Kopi",
  scope: "1 reel + 2 story",
  issuerName: "Kenji",
};

function mockFetchOnce(response: { status: number; body?: unknown }) {
  const fetchMock = vi.fn(async () => ({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: async () => response.body ?? {},
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("PublicInvoiceClient", () => {
  it("shows a loading status before the fetch resolves", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    render(<PublicInvoiceClient token="token-abc" />);

    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders only the safe recipient fields once loaded", async () => {
    mockFetchOnce({ status: 200, body: { invoice: safeInvoice } });

    render(<PublicInvoiceClient token="token-abc" />);

    await waitFor(() => expect(screen.getAllByText("INV/2026/07/001").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Rp1.500.000").length).toBeGreaterThan(0);
    expect(screen.getByText(/Brand Kopi/)).toBeDefined();
    expect(screen.getByText("PPh 23")).toBeDefined();
    expect(screen.getByText(/Kenji/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Unduh PDF" }).getAttribute("href")).toBe(
      "/api/public/invoices/token-abc/pdf",
    );
  });

  it("shows a not-found message for an invalid or revoked token, without a generic error label", async () => {
    mockFetchOnce({ status: 404, body: { error: "Invoice tidak ditemukan." } });

    render(<PublicInvoiceClient token="bad-token" />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/tidak ditemukan/i)).toBeDefined();
  });

  it("shows a generic error message on an unexpected failure", async () => {
    mockFetchOnce({ status: 500, body: { error: "Invoice belum bisa dimuat. Coba lagi." } });

    render(<PublicInvoiceClient token="token-abc" />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/belum bisa dimuat/i)).toBeDefined();
  });

  it("shows a generic error message when the network request itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    render(<PublicInvoiceClient token="token-abc" />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  });
});
