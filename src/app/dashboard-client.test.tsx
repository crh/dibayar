import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardClient from "./dashboard-client";
import type { DealRecord } from "@/lib/deals";

const kopiDeal: DealRecord = {
  id: "deal-1",
  userId: "user-1",
  brand: "Kopi Nusantara",
  contactWa: "6281212345678",
  scope: "3 video TikTok",
  feeIdr: 1500000,
  deadline: null,
  paymentTerms: null,
  status: "NEGO",
  createdAt: new Date("2026-07-13T00:00:00.000Z"),
  updatedAt: new Date("2026-07-13T00:00:00.000Z"),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardClient", () => {
  it("shows the six pipeline stages and a fast deal capture form", () => {
    render(<DashboardClient initialDeals={[]} userName="Chris" />);

    for (const stage of ["Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"]) {
      expect(screen.getByRole("heading", { name: stage })).toBeDefined();
    }
    expect(screen.getByRole("textbox", { name: "Nama brand" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Kontak WhatsApp" })).toBeDefined();
    expect(screen.getByRole("spinbutton", { name: "Fee (Rp)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Simpan deal" })).toBeDefined();
  });

  it("renders an existing deal in its pipeline stage", async () => {
    render(
      <DashboardClient
        userName="Chris"
        initialDeals={[
          {
            id: "deal-1",
            userId: "user-1",
            brand: "Kopi Nusantara",
            contactWa: "6281212345678",
            scope: "3 video TikTok",
            feeIdr: 1500000,
            deadline: null,
            paymentTerms: null,
            status: "NEGO",
            createdAt: new Date("2026-07-13T00:00:00.000Z"),
            updatedAt: new Date("2026-07-13T00:00:00.000Z"),
          },
        ]}
      />,
    );

    expect(screen.getByText("Kopi Nusantara")).toBeDefined();
    expect(screen.getByText("Rp1.500.000")).toBeDefined();
    const negoStage = screen.getByRole("region", { name: "Nego" });
    expect(negoStage.textContent).toContain("Kopi Nusantara");
  });

  it("shows a stage select for each deal, named after the brand and preset to its current status", () => {
    render(<DashboardClient userName="Chris" initialDeals={[kopiDeal]} />);

    const select = screen.getByRole("combobox", { name: "Tahap deal Kopi Nusantara" });
    expect((select as HTMLSelectElement).value).toBe("NEGO");
    const options = within(select).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"]);
  });

  it("gives the stage select a touch target at least 44px tall", () => {
    render(<DashboardClient userName="Chris" initialDeals={[kopiDeal]} />);

    const select = screen.getByRole("combobox", { name: "Tahap deal Kopi Nusantara" });
    expect(select.className).toContain("h-11");
  });

  it("moves a deal to Invoice on stage selection, sends the exact PATCH payload, and reveals Buat invoice", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ deal: { ...kopiDeal, status: "INVOICE" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardClient userName="Chris" initialDeals={[kopiDeal]} />);

    const select = screen.getByRole("combobox", { name: "Tahap deal Kopi Nusantara" });
    await user.selectOptions(select, "INVOICE");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/deals/deal-1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INVOICE" }),
      }),
    );

    const invoiceStage = screen.getByRole("region", { name: "Invoice" });
    expect(await within(invoiceStage).findByRole("button", { name: "Buat invoice" })).toBeDefined();
  });

  it("keeps the deal in its old stage and shows a controlled error when the PATCH fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "Deal belum bisa diperbarui. Coba lagi." }),
      })),
    );

    render(<DashboardClient userName="Chris" initialDeals={[kopiDeal]} />);

    const select = screen.getByRole("combobox", { name: "Tahap deal Kopi Nusantara" });
    await user.selectOptions(select, "INVOICE");

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Deal belum bisa diperbarui. Coba lagi.");
    const negoStage = screen.getByRole("region", { name: "Nego" });
    expect(negoStage.textContent).toContain("Kopi Nusantara");
    expect(screen.queryByRole("button", { name: "Buat invoice" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "Tahap deal Kopi Nusantara" }) as HTMLSelectElement).value).toBe("NEGO");
  });

  it("renders an invoice card with its number, amount, and status", () => {
    render(
      <DashboardClient
        initialDeals={[]}
        initialInvoices={[
          {
            id: "invoice-1",
            userId: "user-1",
            dealId: "deal-1",
            number: "INV/2026/07/001",
            subtotalIdr: 1500000,
            withholdingTaxType: "PPH23",
            status: "DRAFT",
            dueDate: new Date("2026-07-31T00:00:00.000Z"),
            createdAt: new Date("2026-07-15T00:00:00.000Z"),
            updatedAt: new Date("2026-07-15T00:00:00.000Z"),
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Invoice saya" })).toBeDefined();
    expect(screen.getByText("INV/2026/07/001")).toBeDefined();
    expect(screen.getByText("Draft")).toBeDefined();
    expect(screen.getByRole("link", { name: /INV\/2026\/07\/001/ }).getAttribute("href")).toBe("/dashboard/invoices/invoice-1");
  });
});
