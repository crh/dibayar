import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "@/components/language-switcher";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { FollowUpQueue } from "./follow-up-queue";

const NOW = new Date("2026-07-19T10:00:00.000Z"); // Jakarta 2026-07-19T17:00

// getByText's default normalizer collapses the DOM's real NBSP (U+00A0) money
// separator into a plain space before comparing, so the query string must use
// a plain space too, not formatMoney's raw NBSP output.
function normalizedMoney(value: number): string {
  return formatMoney(value).replace(/ /gi, " ");
}

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: "deal-1",
    userId: "user-1",
    brand: "Brand",
    contactWa: "+6281234567890",
    contactName: null,
    scope: "1 video Reels",
    feeIdr: 1_000_000,
    deadline: null,
    paymentTerms: null,
    status: "INVOICE",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "invoice-1",
    userId: "user-1",
    dealId: "deal-1",
    number: "INV/2026/07/001",
    subtotalIdr: 500_000,
    withholdingTaxType: "NONE",
    status: "SENT",
    dueDate: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function renderQueue(invoices: InvoiceRecord[] | null, deals: DealRecord[] | null) {
  return render(
    <LanguageProvider initialLanguage="id">
      <FollowUpQueue invoices={invoices} deals={deals} now={NOW} />
    </LanguageProvider>,
  );
}

describe("FollowUpQueue — selection and rendering", () => {
  it("includes overdue and due-within-7-days invoices, excludes DRAFT/PAID/far-future, and shows brand/amount/date/urgency with invoice links", () => {
    const dealA = makeDeal({ id: "deal-a", brand: "Kopi Nusantara" });
    const dealB = makeDeal({ id: "deal-b", brand: "Skin Glow" });

    const overdueInvoice = makeInvoice({
      id: "invoice-overdue",
      dealId: "deal-a",
      number: "INV/2026/07/010",
      subtotalIdr: 500_000,
      status: "SENT",
      dueDate: new Date("2026-07-14T00:00:00.000Z"), // 5 days overdue at NOW
    });
    const dueSoonInvoice = makeInvoice({
      id: "invoice-due-soon",
      dealId: "deal-b",
      number: "INV/2026/07/011",
      subtotalIdr: 750_000,
      status: "SENT",
      dueDate: new Date("2026-07-22T00:00:00.000Z"), // 3 days out at NOW
    });
    const draftInvoice = makeInvoice({
      id: "invoice-draft",
      dealId: "deal-a",
      number: "INV/2026/07/012",
      status: "DRAFT",
      dueDate: new Date("2026-07-10T00:00:00.000Z"),
    });
    const paidInvoice = makeInvoice({
      id: "invoice-paid",
      dealId: "deal-a",
      number: "INV/2026/07/013",
      status: "PAID",
      dueDate: new Date("2026-07-10T00:00:00.000Z"),
    });
    const farFutureInvoice = makeInvoice({
      id: "invoice-far-future",
      dealId: "deal-b",
      number: "INV/2026/07/014",
      status: "SENT",
      dueDate: new Date("2026-08-15T00:00:00.000Z"),
    });

    renderQueue(
      [overdueInvoice, dueSoonInvoice, draftInvoice, paidInvoice, farFutureInvoice],
      [dealA, dealB],
    );

    const section = screen.getByRole("region", { name: "Perlu dikejar" });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const invoiceLinks = within(section)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/invoice/"));
    expect(invoiceLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/invoice/invoice-overdue",
      "/invoice/invoice-due-soon",
    ]);

    expect(within(section).getByText("Kopi Nusantara")).toBeDefined();
    expect(within(section).getByText("Skin Glow")).toBeDefined();
    expect(within(section).getByText(normalizedMoney(overdueInvoice.subtotalIdr))).toBeDefined();
    expect(within(section).getByText(normalizedMoney(dueSoonInvoice.subtotalIdr))).toBeDefined();
    expect(within(section).getByText(new RegExp(formatDate(overdueInvoice.dueDate as Date)))).toBeDefined();
    expect(within(section).getByText(new RegExp(formatDate(dueSoonInvoice.dueDate as Date)))).toBeDefined();
    expect(within(section).getByText(/Telat 5 hari/)).toBeDefined();
    expect(within(section).getByText(/Jatuh tempo 3 hari lagi/)).toBeDefined();

    // Excluded invoices never reach the DOM.
    expect(within(section).queryByText("INV/2026/07/012")).toBeNull();
    expect(within(section).queryByText("INV/2026/07/013")).toBeNull();
    expect(within(section).queryByText("INV/2026/07/014")).toBeNull();
  });

  it("renders the Indonesian empty-state copy and no list when nothing needs chasing", () => {
    renderQueue([], []);

    expect(screen.getByText("Tidak ada yang perlu dikejar.")).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
