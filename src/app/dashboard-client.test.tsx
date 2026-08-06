import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardClient from "./dashboard-client";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";

// The app now defaults to English (see src/lib/i18n.ts). This suite exercises
// Dibayar's Indonesian-language behavior in depth, so it seeds an explicit
// "id" preference by default; the English-default behavior itself is covered
// by the dedicated test below.
beforeEach(() => {
  window.localStorage.setItem("dibayar-language", "id");
});

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
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("DashboardClient", () => {
  it("shows the six pipeline stages (via the persistent count strip) and a fast deal capture form", () => {
    render(<DashboardClient initialDeals={[]} userName="Chris" />);

    const countStrip = screen.getByTestId("pipeline-stage-count-strip");
    for (const stage of ["Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"]) {
      expect(within(countStrip).getByText(stage)).toBeDefined();
    }
    expect(screen.getByRole("textbox", { name: "Nama brand" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Kontak WhatsApp" })).toBeDefined();
    expect(screen.getByRole("spinbutton", { name: "Fee (Rp)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Simpan deal" })).toBeDefined();
  });

  it("defaults to English when no language preference is stored", () => {
    window.localStorage.clear();
    render(<DashboardClient initialDeals={[]} userName="Chris" />);

    expect(screen.getByRole("button", { name: "Account menu" })).toBeDefined();
    expect(screen.getByText("Start here")).toBeDefined();
    expect(screen.queryByText("Mulai dari sini")).toBeNull();
  });

  it("localizes the first-run microcopy and empty invoice guidance in English", async () => {
    const user = userEvent.setup();
    render(<DashboardClient initialDeals={[]} userName="Chris" />);

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    await user.click(screen.getByRole("menuitemradio", { name: "English" }));

    expect(screen.getByText("Start here")).toBeDefined();
    expect(screen.getByText("No invoices yet. Move a deal to the Invoice stage, then create a draft from its deal card.")).toBeDefined();
    expect(screen.queryByText("Mulai dari sini")).toBeNull();
    expect(screen.queryByText("Belum ada invoice. Pindahkan deal ke tahap Invoice, lalu buat drafnya dari kartu deal.")).toBeNull();
  });

  it("keeps deal controls and API failure feedback fully English when English is selected", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("dibayar-language", "en");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "Deal belum bisa diperbarui. Coba lagi." }),
      })),
    );

    render(<DashboardClient initialDeals={[kopiDeal]} userName="Chris" />);

    const stageSelect = screen.getByRole("combobox", { name: "Deal stage for Kopi Nusantara" });
    await user.selectOptions(stageSelect, "INVOICE");

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "The deal could not be updated. Try again.",
    );
    expect(screen.queryByText(/deal belum bisa diperbarui/i)).toBeNull();
    expect(screen.queryByRole("combobox", { name: /tahap deal/i })).toBeNull();
  });

  it("shows a live-formatted IDR preview under the fee input without changing the underlying numeric value", async () => {
    const user = userEvent.setup();
    render(<DashboardClient initialDeals={[]} userName="Chris" />);

    const feeInput = screen.getByRole("spinbutton", { name: "Fee (Rp)" });
    await user.type(feeInput, "1500000");

    expect((feeInput as HTMLInputElement).value).toBe("1500000");
    expect(screen.getByText("≈ Rp1.500.000")).toBeDefined();
  });

  it("shows a bounded success confirmation after a deal is saved", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => ({ deal: { ...kopiDeal, id: "deal-2", brand: "Baru" } }),
      })),
    );

    render(<DashboardClient initialDeals={[]} userName="Chris" />);

    await user.type(screen.getByRole("textbox", { name: "Nama brand" }), "Baru");
    await user.type(screen.getByRole("textbox", { name: "Kontak WhatsApp" }), "081234567890");
    await user.type(screen.getByRole("textbox", { name: "Scope pekerjaan" }), "1 post Instagram");
    await user.type(screen.getByRole("spinbutton", { name: "Fee (Rp)" }), "1000000");
    await user.click(screen.getByRole("button", { name: "Simpan deal" }));

    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Deal disimpan");
  }, 10_000);

  it("shows a bounded success confirmation after an invoice is created from a deal card", async () => {
    const user = userEvent.setup();
    const invoiceDeal: DealRecord = { ...kopiDeal, id: "deal-3", status: "INVOICE" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 201,
        json: async () => ({
          invoice: {
            id: "invoice-9",
            userId: "user-1",
            dealId: "deal-3",
            number: "INV/2026/07/009",
            subtotalIdr: invoiceDeal.feeIdr,
            withholdingTaxType: "NONE",
            status: "DRAFT",
            dueDate: null,
            createdAt: new Date("2026-07-15T00:00:00.000Z"),
            updatedAt: new Date("2026-07-15T00:00:00.000Z"),
          },
        }),
      })),
    );

    render(<DashboardClient userName="Chris" initialDeals={[invoiceDeal]} />);

    const invoiceStage = screen.getByRole("region", { name: "Invoice" });
    await user.click(within(invoiceStage).getByRole("button", { name: "Buat invoice" }));

    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Invoice dibuat");
  });

  it("exposes accessible disclosure state on the Add deal / Close toggle", async () => {
    const user = userEvent.setup();
    render(<DashboardClient initialDeals={[kopiDeal]} userName="Chris" />);

    const toggle = screen.getByRole("button", { name: "+ Deal" });
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
    expect(screen.getByText("Draf")).toBeDefined();
    expect(screen.getByRole("link", { name: /INV\/2026\/07\/001/ }).getAttribute("href")).toBe("/dashboard/invoices/invoice-1");
  });

  it("still renders the English Draft label for a draft invoice when English is selected", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    await user.click(screen.getByRole("menuitemradio", { name: "English" }));

    expect(screen.getByText("Draft")).toBeDefined();
    expect(screen.queryByText("Draf")).toBeNull();
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

  describe("state-aware quick action", () => {
    it("shows the onboarding card with zero deals", () => {
      render(<DashboardClient initialDeals={[]} userName="Chris" />);

      expect(screen.getByText("Mulai dari sini")).toBeDefined();
      expect(screen.getByRole("heading", { name: "Tambah deal pertama kamu" })).toBeDefined();
      expect(screen.queryByRole("button", { name: "+ Buat invoice" })).toBeNull();
      expect(screen.queryByRole("link", { name: "+ Buat invoice" })).toBeNull();
      expect(screen.queryByRole("button", { name: "+ Deal" })).toBeNull();
    });

    it("shows the two-pill quick action row instead of the onboarding heading once a deal exists", () => {
      render(<DashboardClient initialDeals={[kopiDeal]} userName="Chris" />);

      expect(screen.queryByText("Mulai dari sini")).toBeNull();
      expect(screen.queryByRole("heading", { name: "Tambah deal pertama kamu" })).toBeNull();
      expect(screen.getByRole("link", { name: "+ Buat invoice" })).toBeDefined();
      expect(screen.getByRole("button", { name: "+ Deal" })).toBeDefined();
    });

    it("opens the add-deal form from the secondary + Deal pill", async () => {
      const user = userEvent.setup();
      render(<DashboardClient initialDeals={[kopiDeal]} userName="Chris" />);

      expect(screen.queryByRole("textbox", { name: "Nama brand" })).toBeNull();

      await user.click(screen.getByRole("button", { name: "+ Deal" }));

      expect(screen.getByRole("textbox", { name: "Nama brand" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Tutup" })).toBeDefined();
    });

    it("routes + Buat invoice directly to the single deal that's ready to invoice", async () => {
      const user = userEvent.setup();
      const invoiceDeal: DealRecord = { ...kopiDeal, id: "deal-3", status: "INVOICE" };
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          status: 201,
          json: async () => ({
            invoice: {
              id: "invoice-9",
              userId: "user-1",
              dealId: "deal-3",
              number: "INV/2026/07/009",
              subtotalIdr: invoiceDeal.feeIdr,
              withholdingTaxType: "NONE",
              status: "DRAFT",
              dueDate: null,
              createdAt: new Date("2026-07-15T00:00:00.000Z"),
              updatedAt: new Date("2026-07-15T00:00:00.000Z"),
            },
          }),
        })),
      );

      render(<DashboardClient initialDeals={[invoiceDeal]} userName="Chris" />);

      await user.click(screen.getByRole("button", { name: "+ Buat invoice" }));

      expect(await screen.findByRole("status")).toHaveProperty("textContent", "Invoice dibuat");
    });

    it("falls back to a #pipeline anchor for + Buat invoice when there's no single deal ready to invoice", () => {
      render(<DashboardClient initialDeals={[kopiDeal]} userName="Chris" />);

      const link = screen.getByRole("link", { name: "+ Buat invoice" });
      expect(link.getAttribute("href")).toBe("#pipeline");
    });
  });

  describe("labeled pipeline summary", () => {
    it("renders active deal count, stage-group legend counts, and a link to #pipeline", () => {
      const deals: DealRecord[] = [
        { ...kopiDeal, id: "d1", status: "MASUK" },
        { ...kopiDeal, id: "d2", status: "NEGO" },
        { ...kopiDeal, id: "d3", status: "KONTEN" },
        { ...kopiDeal, id: "d4", status: "DIBAYAR" },
      ];
      const invoices: InvoiceRecord[] = [
        {
          id: "inv-1",
          userId: "user-1",
          dealId: "d3",
          number: "INV/2026/07/010",
          subtotalIdr: 1_000_000,
          withholdingTaxType: "NONE",
          status: "SENT",
          dueDate: new Date("2026-07-01T00:00:00.000Z"),
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      ];
      const now = new Date("2026-07-19T10:00:00.000Z");

      render(<DashboardClient initialDeals={deals} initialInvoices={invoices} userName="Chris" now={now} />);

      expect(screen.getByText("Pipeline · 4 deal aktif")).toBeDefined();
      const link = screen.getByRole("link", { name: /Pipeline · 4 deal aktif/ });
      expect(link.getAttribute("href")).toBe("#pipeline");
      expect(screen.getByText("2 Masuk/Nego")).toBeDefined();
      expect(screen.getByText("1 siap ditagih")).toBeDefined();
      const overdueLegend = screen.getByText("1 terlambat");
      expect(overdueLegend.className).toContain("text-overdue");
      const paidLegend = screen.getByText("1 dibayar");
      expect(paidLegend.className).toContain("text-paid");
    });

    it("shows a zeroed legend when there are no deals or invoices", () => {
      render(<DashboardClient initialDeals={[]} userName="Chris" />);

      expect(screen.getByText("Pipeline · 0 deal aktif")).toBeDefined();
      expect(screen.getByText("0 Masuk/Nego")).toBeDefined();
      expect(screen.getByText("0 siap ditagih")).toBeDefined();
      expect(screen.getByText("0 terlambat")).toBeDefined();
      expect(screen.getByText("0 dibayar")).toBeDefined();
    });
  });

  describe("Gross → PPh → Net income summary with basis notes", () => {
    const NOW = new Date("2026-07-19T10:00:00.000Z"); // Jakarta 2026-07-19T17:00, month = July 2026

    function incomeInvoice(overrides: Partial<InvoiceRecord>): InvoiceRecord {
      return {
        id: "invoice-1",
        userId: "user-1",
        dealId: "deal-1",
        number: "INV/2026/07/001",
        subtotalIdr: 1_000_000,
        withholdingTaxType: "NONE",
        status: "PAID",
        dueDate: new Date("2026-07-10T00:00:00.000Z"),
        createdAt: new Date("2026-07-05T00:00:00.000Z"),
        updatedAt: new Date("2026-07-05T00:00:00.000Z"),
        ...overrides,
      };
    }

    it("renders Net as the hero figure with Gross and withheld PPh as smaller supporting figures", () => {
      const invoices = [incomeInvoice({ subtotalIdr: 1_000_000, withholdingTaxType: "PPH23", status: "PAID" })];
      render(<DashboardClient initialDeals={[]} initialInvoices={invoices} userName="Chris" now={NOW} />);

      const income = screen.getByRole("heading", { name: "Ringkasan pendapatan" }).closest("section")!;
      // Net (980.000) is the hero-sized figure.
      const hero = within(income).getByText("Rp980.000");
      expect(hero.className).toContain("ds-display");
      expect(within(income).getByText("Rp1.000.000")).toBeDefined();
      expect(within(income).getByText("-Rp20.000")).toBeDefined();
    });

    it("states that unpaid/overdue invoices are included in the 'issued this month' basis, with an accurate count", () => {
      const invoices = [
        incomeInvoice({ id: "inv-paid", status: "PAID" }),
        incomeInvoice({ id: "inv-sent", status: "SENT", number: "INV/2026/07/002" }),
        incomeInvoice({ id: "inv-overdue", status: "OVERDUE", number: "INV/2026/07/003", dueDate: new Date("2026-07-01T00:00:00.000Z") }),
      ];
      render(<DashboardClient initialDeals={[]} initialInvoices={invoices} userName="Chris" now={NOW} />);

      expect(screen.getByText("Termasuk 2 invoice belum dibayar (belum masuk rekening).")).toBeDefined();
    });

    it("does not show an unpaid-invoice note when every included invoice is already paid", () => {
      const invoices = [incomeInvoice({ status: "PAID" })];
      render(<DashboardClient initialDeals={[]} initialInvoices={invoices} userName="Chris" now={NOW} />);

      expect(screen.queryByText(/Termasuk \d+ invoice belum dibayar/)).toBeNull();
    });

    it("explains a zero withholding total truthfully when included invoices have no withholding, without inventing an NPWP reason", () => {
      const invoices = [incomeInvoice({ withholdingTaxType: "NONE", status: "PAID" })];
      render(<DashboardClient initialDeals={[]} initialInvoices={invoices} userName="Chris" now={NOW} />);

      expect(screen.getByText("PPh 0 karena invoice bulan ini tidak memakai potongan pajak (PPh: Tidak ada).")).toBeDefined();
      expect(screen.queryByText(/NPWP/)).toBeNull();
    });

    it("explains a zero withholding total when there are no invoices this month at all", () => {
      render(<DashboardClient initialDeals={[]} initialInvoices={[]} userName="Chris" now={NOW} />);

      expect(screen.getByText("PPh 0 karena belum ada invoice bulan ini.")).toBeDefined();
    });

    it("names the applicable rate when withholding is non-zero from a single tax type", () => {
      const invoices = [incomeInvoice({ withholdingTaxType: "PPH23", status: "PAID" })];
      render(<DashboardClient initialDeals={[]} initialInvoices={invoices} userName="Chris" now={NOW} />);

      expect(screen.getByText("Dihitung dari PPh 23 (2%).")).toBeDefined();
    });

    it("says rates vary per invoice when included invoices mix different withholding types", () => {
      const invoices = [
        incomeInvoice({ id: "inv-1", withholdingTaxType: "PPH21", status: "PAID" }),
        incomeInvoice({ id: "inv-2", withholdingTaxType: "PPH23", status: "PAID", number: "INV/2026/07/002" }),
      ];
      render(<DashboardClient initialDeals={[]} initialInvoices={invoices} userName="Chris" now={NOW} />);

      expect(screen.getByText("Dihitung dari beberapa tarif PPh berbeda (bervariasi per invoice).")).toBeDefined();
    });

    it("localizes the income basis notes in English", () => {
      window.localStorage.setItem("dibayar-language", "en");
      const invoices = [
        incomeInvoice({ id: "inv-paid", status: "PAID" }),
        incomeInvoice({ id: "inv-sent", status: "SENT", number: "INV/2026/07/002", withholdingTaxType: "PPH23" }),
      ];
      render(<DashboardClient initialDeals={[]} initialInvoices={invoices} userName="Chris" now={NOW} />);

      expect(screen.getByText("Includes 1 unpaid invoice(s) (not yet received).")).toBeDefined();
      expect(screen.getByText("Calculated from PPh 23 (2%).")).toBeDefined();
    });
  });

  describe("responsive pipeline board", () => {
    const STAGE_NAMES = ["Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"];

    function dealFor(status: DealRecord["status"], id: string): DealRecord {
      return { ...kopiDeal, id, status };
    }

    function railChildren() {
      return Array.from(screen.getByTestId("pipeline-rail").children) as HTMLElement[];
    }

    function classTokens(element: HTMLElement) {
      return element.className.split(/\s+/);
    }

    function expectHiddenBelowLgVisibleAtLg(emptyStage: HTMLElement) {
      // Below lg an empty stage's lane is `hidden` (no board-height contribution);
      // at lg: it's restored (`lg:block`) as its own distinct desktop kanban lane.
      expect(classTokens(emptyStage)).toContain("hidden");
      expect(classTokens(emptyStage)).toContain("lg:block");
      expect(emptyStage.textContent).toContain("Belum ada deal");
    }

    function expectStackedBelowLgFixedWidthAtLg(stageColumn: HTMLElement) {
      // Below lg the stage column is a full-width stacked section (no fixed
      // lane width, no horizontal scroll); at lg: it's a fixed-width kanban column.
      expect(classTokens(stageColumn)).toContain("w-full");
      expect(classTokens(stageColumn)).not.toContain("hidden");
      expect(stageColumn.className).toContain("lg:w-[calc(16.6667%-10px)]");
    }

    // Asserts the board always renders exactly six distinct lanes, one per
    // pipeline stage in natural order, regardless of how sparse the deals
    // are — this is the desktop (lg+) contract: no aggregation of empty
    // stages into a shared placeholder, ever.
    function expectSixDistinctLanesInNaturalOrder(children: HTMLElement[]) {
      expect(children).toHaveLength(6);
      children.forEach((child, index) => {
        expect(within(child).getByRole("heading", { name: STAGE_NAMES[index] })).toBeDefined();
      });
    }

    it("renders six distinct lanes for a sparse desktop pipeline (only Invoice populated), not an aggregated empty run", () => {
      render(<DashboardClient userName="Chris" initialDeals={[dealFor("INVOICE", "d1")]} />);

      const children = railChildren();
      expectSixDistinctLanesInNaturalOrder(children);

      const [masuk, nego, deal, konten, invoice, dibayar] = children;
      expectHiddenBelowLgVisibleAtLg(masuk);
      expectHiddenBelowLgVisibleAtLg(nego);
      expectHiddenBelowLgVisibleAtLg(deal);
      expectHiddenBelowLgVisibleAtLg(konten);
      expectStackedBelowLgFixedWidthAtLg(invoice);
      expectHiddenBelowLgVisibleAtLg(dibayar);

      // No stage lane ever shows a joined multi-stage placeholder like "Deal · Konten".
      children.forEach((child) => expect(child.textContent).not.toContain(" · "));
    });

    it("renders six distinct lanes for an all-empty desktop pipeline, while the count strip still lists all six stages", () => {
      render(<DashboardClient userName="Chris" initialDeals={[]} />);

      const children = railChildren();
      expectSixDistinctLanesInNaturalOrder(children);
      children.forEach((child) => {
        expectHiddenBelowLgVisibleAtLg(child);
        expect(child.textContent).not.toContain(" · ");
      });

      const countStrip = screen.getByTestId("pipeline-stage-count-strip");
      for (const stage of STAGE_NAMES) {
        expect(within(countStrip).getByText(stage)).toBeDefined();
      }
    });

    it("puts a populated first stage directly first, with every other stage still rendered as its own hidden-below-lg lane", () => {
      render(<DashboardClient userName="Chris" initialDeals={[dealFor("MASUK", "d1")]} />);

      const children = railChildren();
      expectSixDistinctLanesInNaturalOrder(children);
      expectStackedBelowLgFixedWidthAtLg(children[0]);
      for (const emptyChild of children.slice(1)) expectHiddenBelowLgVisibleAtLg(emptyChild);
    });

    it("stacks only the populated Nego and Dibayar stages below lg, while both empty runs between them stay individually hidden", () => {
      render(
        <DashboardClient
          userName="Chris"
          initialDeals={[dealFor("NEGO", "d1"), dealFor("DIBAYAR", "d2")]}
        />,
      );

      const children = railChildren();
      expectSixDistinctLanesInNaturalOrder(children);

      const [masuk, nego, deal, konten, invoice, dibayar] = children;
      expectHiddenBelowLgVisibleAtLg(masuk);
      expectStackedBelowLgFixedWidthAtLg(nego);
      expectHiddenBelowLgVisibleAtLg(deal);
      expectHiddenBelowLgVisibleAtLg(konten);
      expectHiddenBelowLgVisibleAtLg(invoice);
      expectStackedBelowLgFixedWidthAtLg(dibayar);
    });

    it("gives the desktop board container a non-scrolling reflow (row + wrap) at lg, stacked (column) below lg", () => {
      render(<DashboardClient userName="Chris" initialDeals={[dealFor("INVOICE", "d1")]} />);

      const board = screen.getByTestId("pipeline-rail");
      expect(board.className).toContain("flex-col");
      expect(board.className).toContain("lg:flex-row");
      expect(board.className).toContain("lg:flex-wrap");
      expect(board.className).not.toContain("overflow-x-auto");
      expect(board.className).not.toContain("snap-x");
    });

    it("preserves the full six-stage kanban and natural stage order at lg, with every populated stage always rendered (never board-hidden)", () => {
      const deals = [
        dealFor("MASUK", "d1"),
        dealFor("NEGO", "d2"),
        dealFor("DEAL", "d3"),
        dealFor("KONTEN", "d4"),
        dealFor("INVOICE", "d5"),
        dealFor("DIBAYAR", "d6"),
      ];
      render(<DashboardClient userName="Chris" initialDeals={deals} />);

      const children = railChildren();
      expectSixDistinctLanesInNaturalOrder(children);
      children.forEach((child) => {
        expect(classTokens(child)).not.toContain("hidden");
      });
    });

    it("shows breakpoint-neutral pipeline hint copy in Indonesian and English", () => {
      render(<DashboardClient userName="Chris" initialDeals={[]} />);
      expect(screen.getByText("Setiap tahap pipeline ditampilkan di bawah ini.")).toBeDefined();

      window.localStorage.setItem("dibayar-language", "en");
      render(<DashboardClient userName="Chris" initialDeals={[]} />);
      expect(screen.getByText("Every pipeline stage is shown below.")).toBeDefined();
    });
  });
});
