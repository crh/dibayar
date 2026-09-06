import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { auth } from "@/auth";
import { listInvoicesWithDealBrand, type InvoiceWithDealBrand } from "@/lib/invoices";
import InvoicePage from "./page";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/invoices", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invoices")>("@/lib/invoices");
  return { ...actual, listInvoicesWithDealBrand: vi.fn() };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const mockedAuth = vi.mocked(auth);
const mockedListInvoicesWithDealBrand = vi.mocked(listInvoicesWithDealBrand);

const invoiceFixture: InvoiceWithDealBrand = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxType: "NONE",
  status: "SENT",
  dueDate: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  deal: { brand: "Acme" },
};

describe("/invoice route", () => {
  it("redirects unauthenticated visitors to sign-in with a callback to /invoice", async () => {
    mockedAuth.mockResolvedValue(null as never);

    await expect(InvoicePage()).rejects.toThrow("REDIRECT:/api/auth/signin?callbackUrl=%2Finvoice");
    expect(mockedListInvoicesWithDealBrand).not.toHaveBeenCalled();
  });

  it("renders the owner-scoped invoice list for an authenticated user", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", name: "Chris", email: "chris@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedListInvoicesWithDealBrand.mockResolvedValue([invoiceFixture]);

    const page = await InvoicePage();
    render(page);

    expect(screen.getByRole("heading", { name: "Invoice", level: 1 })).toBeDefined();
    expect(screen.getByText("Acme")).toBeDefined();
    expect(mockedListInvoicesWithDealBrand).toHaveBeenCalledWith(expect.anything(), "user-1");
  });
});
