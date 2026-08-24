import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { auth } from "@/auth";
import { getOwnedInvoice, type InvoiceRecord } from "@/lib/invoices";
import { getUserLanguage } from "@/lib/user-language";
import { getUserSettings } from "@/lib/user-settings";
import InvoiceDetailPage from "./page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/invoices", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invoices")>("@/lib/invoices");
  return { ...actual, getOwnedInvoice: vi.fn() };
});

vi.mock("@/lib/user-language", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-language")>("@/lib/user-language");
  return { ...actual, getUserLanguage: vi.fn() };
});

vi.mock("@/lib/user-settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-settings")>("@/lib/user-settings");
  return { ...actual, getUserSettings: vi.fn() };
});

const { notFound, redirect } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ notFound, redirect }));

vi.mock("./invoice-detail-client", () => ({
  default: ({
    initialInvoice,
    hasIncompleteIssuer,
    templateSend,
    templateChase,
  }: {
    initialInvoice: InvoiceRecord;
    hasIncompleteIssuer: boolean;
    templateSend: string;
    templateChase: string;
  }) => (
    <div data-testid="invoice-detail-client">
      {initialInvoice.number} · {String(hasIncompleteIssuer)} · {templateSend} · {templateChase}
    </div>
  ),
}));

const mockedAuth = vi.mocked(auth);
const mockedGetOwnedInvoice = vi.mocked(getOwnedInvoice);
const mockedGetUserLanguage = vi.mocked(getUserLanguage);
const mockedGetUserSettings = vi.mocked(getUserSettings);

const invoiceFixture: InvoiceRecord = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV-2026-001",
  subtotalIdr: 2_500_000,
  withholdingTaxType: "NONE",
  status: "SENT",
  dueDate: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

const completeSettings = {
  issuerName: "Aulia Rahma",
  issuerAddress: "",
  issuerWhatsapp: "",
  issuerEmail: "",
  bankName: "BCA",
  bankAccountNumber: "1234567890",
  bankAccountHolder: "Aulia Rahma",
  templateSend: "Halo {brand}, invoice terlampir.",
  templateChase: "Halo {brand}, mohon dicek invoicenya.",
  updatedAt: null,
};

beforeEach(() => {
  notFound.mockClear();
  redirect.mockClear();
  mockedGetUserLanguage.mockResolvedValue("id");
  mockedGetUserSettings.mockResolvedValue(completeSettings);
});

describe("/invoice/:id", () => {
  it("redirects unauthenticated visitors to sign-in", async () => {
    mockedAuth.mockResolvedValue(null as never);

    await expect(InvoiceDetailPage({ params: Promise.resolve({ id: "invoice-1" }) })).rejects.toThrow(
      "REDIRECT:/api/auth/signin?callbackUrl=%2Finvoice",
    );
    expect(mockedGetOwnedInvoice).not.toHaveBeenCalled();
  });

  it("renders 404 for an invoice that doesn't exist or belongs to another user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" } as never);
    mockedGetOwnedInvoice.mockResolvedValue(null);

    await expect(InvoiceDetailPage({ params: Promise.resolve({ id: "invoice-1" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mockedGetOwnedInvoice).toHaveBeenCalledWith(expect.anything(), "invoice-1", "user-1");
  });

  it("renders the invoice for the owning user", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" } as never);
    mockedGetOwnedInvoice.mockResolvedValue(invoiceFixture);

    const page = await InvoiceDetailPage({ params: Promise.resolve({ id: "invoice-1" }) });
    render(page);

    expect(screen.getByTestId("invoice-detail-client").textContent).toBe(
      "INV-2026-001 · false · Halo {brand}, invoice terlampir. · Halo {brand}, mohon dicek invoicenya.",
    );
  });

  it("flags an incomplete issuer profile so the client can warn before sending", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" } as never);
    mockedGetOwnedInvoice.mockResolvedValue(invoiceFixture);
    mockedGetUserSettings.mockResolvedValue({ ...completeSettings, bankAccountNumber: "" });

    const page = await InvoiceDetailPage({ params: Promise.resolve({ id: "invoice-1" }) });
    render(page);

    expect(screen.getByTestId("invoice-detail-client").textContent).toBe(
      "INV-2026-001 · true · Halo {brand}, invoice terlampir. · Halo {brand}, mohon dicek invoicenya.",
    );
  });
});
