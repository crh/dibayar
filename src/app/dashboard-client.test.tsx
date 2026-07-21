import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardClient from "./dashboard-client";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";

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

  it("exposes accessible disclosure state on the Add deal / Close toggle", async () => {
    const user = userEvent.setup();
    render(<DashboardClient initialDeals={[kopiDeal]} userName="Chris" />);

    const toggle = screen.getByRole("button", { name: "+ Tambah deal" });
    expect(toggle).toHaveProperty("ariaExpanded", "false");
    const controlsId = toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).toBeNull();

    await user.click(toggle);

    const closeToggle = screen.getByRole("button", { name: "Tutup" });
    expect(closeToggle.getAttribute("aria-controls")).toBe(controlsId);
    expect(closeToggle).toHaveProperty("ariaExpanded", "true");
    expect(document.getElementById(controlsId!)).toBe(screen.getByRole("textbox", { name: "Nama brand" }).closest("form"));
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

  describe("attention section", () => {
    const NOW = new Date("2026-07-19T10:00:00.000Z"); // Jakarta 2026-07-19T17:00

    function baseInvoice(overrides: Partial<InvoiceRecord>): InvoiceRecord {
      return {
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
        ...overrides,
      };
    }

    it("shows a reassuring empty state and appears before the pipeline when nothing needs attention", () => {
      render(<DashboardClient initialDeals={[]} initialInvoices={[]} userName="Chris" now={NOW} />);

      expect(screen.getByText("Tidak ada invoice yang perlu dikejar saat ini.")).toBeDefined();
      const body = document.body.textContent ?? "";
      expect(body.indexOf("Perlu dikejar")).toBeLessThan(body.indexOf("Pipeline deal"));
    });

    it("lists an overdue invoice with its number, amount, status, and due date, linking to the invoice", () => {
      const overdue = baseInvoice({
        id: "invoice-late",
        number: "INV/2026/07/002",
        subtotalIdr: 2_000_000,
        status: "SENT",
        dueDate: new Date("2026-07-10T00:00:00.000Z"),
      });
      render(<DashboardClient initialDeals={[]} initialInvoices={[overdue]} userName="Chris" now={NOW} />);

      const attention = screen.getByRole("region", { name: "Perlu dikejar" });
      expect(within(attention).getByText("Terlambat (1) · Rp2.000.000")).toBeDefined();
      expect(within(attention).getByText("INV/2026/07/002")).toBeDefined();
      expect(within(attention).getByText("Rp2.000.000")).toBeDefined();
      expect(within(attention).getByText("Terlambat")).toBeDefined();
      expect(within(attention).getByRole("link", { name: /INV\/2026\/07\/002/ }).getAttribute("href")).toBe(
        "/dashboard/invoices/invoice-late",
      );
    });

    it("lists a due-soon invoice (within 7 days) separately from overdue, keeping its stored status label", () => {
      const dueSoon = baseInvoice({
        id: "invoice-soon",
        number: "INV/2026/07/003",
        status: "DUE",
        dueDate: new Date("2026-07-22T00:00:00.000Z"),
      });
      render(<DashboardClient initialDeals={[]} initialInvoices={[dueSoon]} userName="Chris" now={NOW} />);

      const attention = screen.getByRole("region", { name: "Perlu dikejar" });
      expect(within(attention).getByText("INV/2026/07/003")).toBeDefined();
      expect(within(attention).getByText("Jatuh tempo")).toBeDefined();
    });

    it("excludes DRAFT and PAID invoices, and an invoice more than 7 days out, from the attention section", () => {
      const draft = baseInvoice({ id: "invoice-draft", number: "INV/2026/07/004", status: "DRAFT", dueDate: new Date("2026-07-01T00:00:00.000Z") });
      const paid = baseInvoice({ id: "invoice-paid", number: "INV/2026/07/005", status: "PAID", dueDate: new Date("2026-07-01T00:00:00.000Z") });
      const farOut = baseInvoice({ id: "invoice-far", number: "INV/2026/07/006", status: "SENT", dueDate: new Date("2026-08-15T00:00:00.000Z") });
      render(<DashboardClient initialDeals={[]} initialInvoices={[draft, paid, farOut]} userName="Chris" now={NOW} />);

      expect(screen.getByText("Tidak ada invoice yang perlu dikejar saat ini.")).toBeDefined();
    });

    it("derives OVERDUE consistently between the attention section and the main invoice list for a past-due SENT invoice", () => {
      const overdue = baseInvoice({
        id: "invoice-late",
        number: "INV/2026/07/002",
        status: "SENT",
        dueDate: new Date("2026-07-10T00:00:00.000Z"),
      });
      render(<DashboardClient initialDeals={[]} initialInvoices={[overdue]} userName="Chris" now={NOW} />);

      const invoiceList = screen.getByRole("heading", { name: "Invoice saya" }).closest("section")!;
      expect(within(invoiceList).getByText("Terlambat")).toBeDefined();
      expect(within(invoiceList).queryByText("Terkirim")).toBeNull();
    });
  });
});
