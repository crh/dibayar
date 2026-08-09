import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { auth } from "@/auth";
import { listDeals, type DealRecord } from "@/lib/deals";
import { listInvoices } from "@/lib/invoices";
import DealPage from "./page";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/deals", async () => {
  const actual = await vi.importActual<typeof import("@/lib/deals")>("@/lib/deals");
  return { ...actual, listDeals: vi.fn() };
});

vi.mock("@/lib/invoices", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invoices")>("@/lib/invoices");
  return { ...actual, listInvoices: vi.fn() };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const mockedAuth = vi.mocked(auth);
const mockedListDeals = vi.mocked(listDeals);
const mockedListInvoices = vi.mocked(listInvoices);

const dealFixture: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Acme",
  contactWa: "6281234567890",
  scope: "Video promosi",
  feeIdr: 1500000,
  deadline: null,
  paymentTerms: null,
  status: "MASUK",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("/deal route", () => {
  it("redirects unauthenticated visitors to sign-in with a callback to /deal", async () => {
    mockedAuth.mockResolvedValue(null as never);

    await expect(DealPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/api/auth/signin?callbackUrl=%2Fdeal",
    );
    expect(mockedListDeals).not.toHaveBeenCalled();
  });

  it("renders the deal board for an authenticated user with no stage filter applied", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", name: "Chris", email: "chris@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedListDeals.mockResolvedValue([dealFixture]);
    mockedListInvoices.mockResolvedValue([]);

    const page = await DealPage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText("Acme")).toBeDefined();
    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("falls back to no stage filter when tahap is not a valid stage value", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", name: "Chris", email: "chris@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedListDeals.mockResolvedValue([dealFixture]);
    mockedListInvoices.mockResolvedValue([]);

    const page = await DealPage({ searchParams: Promise.resolve({ tahap: "BUKAN_TAHAP" }) });
    render(page);

    expect(screen.getByRole("button", { name: "Semua" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("region")).toHaveLength(6);
  });
});
