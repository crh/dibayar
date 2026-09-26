import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/components/language-switcher";
import type { InvoiceRecord } from "@/lib/invoices";
import { formatMoney } from "@/lib/format/money";
import { MonthlyIncomeSummary } from "./monthly-income";

const NOW = new Date("2026-07-19T10:00:00.000Z");

function normalizedMoney(value: number): string {
  return formatMoney(value).replace(/ /g, " ");
}

function makeInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "invoice-1",
    userId: "user-1",
    dealId: "deal-1",
    number: "INV/2026/07/001",
    subtotalIdr: 1_000_000,
    withholdingTaxType: "NONE",
    status: "PAID",
    dueDate: new Date("2026-07-22T00:00:00.000Z"),
    createdAt: new Date("2026-07-10T00:00:00.000Z"),
    updatedAt: new Date("2026-07-10T00:00:00.000Z"),
    ...overrides,
  };
}

function renderSummary(props: Partial<React.ComponentProps<typeof MonthlyIncomeSummary>> = {}) {
  return render(
    <LanguageProvider initialLanguage="id">
      <MonthlyIncomeSummary invoices={props.invoices ?? []} now={props.now ?? NOW} loading={props.loading} error={props.error} onRetry={props.onRetry} />
    </LanguageProvider>,
  );
}

describe("MonthlyIncomeSummary — populated", () => {
  it("renders the net figure and paid-invoice count for the current Jakarta month, excluding DRAFT and other months", () => {
    const paidThisMonth = makeInvoice({
      id: "invoice-paid",
      subtotalIdr: 1_000_000,
      withholdingTaxType: "PPH21",
      status: "PAID",
      createdAt: new Date("2026-07-10T00:00:00.000Z"),
    });
    const sentThisMonth = makeInvoice({
      id: "invoice-sent",
      subtotalIdr: 500_000,
      withholdingTaxType: "NONE",
      status: "SENT",
      createdAt: new Date("2026-07-05T00:00:00.000Z"),
    });
    const paidLastMonth = makeInvoice({
      id: "invoice-old",
      subtotalIdr: 2_000_000,
      status: "PAID",
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
    });
    const draftThisMonth = makeInvoice({
      id: "invoice-draft",
      subtotalIdr: 900_000,
      status: "DRAFT",
      createdAt: new Date("2026-07-12T00:00:00.000Z"),
    });

    renderSummary({ invoices: [paidThisMonth, sentThisMonth, paidLastMonth, draftThisMonth] });

    expect(screen.getByRole("heading", { level: 2, name: "Ditagihkan bulan ini" })).toBeDefined();
    // Net = (1,000,000 - 50,000 PPh21) + 500,000 = 1,450,000; only the two current-month, non-DRAFT invoices count.
    expect(screen.getByText(normalizedMoney(1_450_000))).toBeDefined();
    expect(screen.getByText(/1 invoice lunas/)).toBeDefined();
  });
});

describe("MonthlyIncomeSummary XS band (T-26)", () => {
  it("uses 16px card padding below 360px on the net-income figure card", () => {
    renderSummary({ invoices: [makeInvoice()] });

    const card = screen.getByText(/invoice lunas|invoices paid/i).closest("div")!;
    expect(card.className).toMatch(/\bp-4\b/);
    expect(card.className).toMatch(/min-\[360px\]:p-5/);
  });
});

describe("MonthlyIncomeSummary — isolated loading and error states", () => {
  it("renders a skeleton and no figure while loading", () => {
    renderSummary({ invoices: null, loading: true });

    expect(screen.getByTestId("home-income-skeleton")).toBeDefined();
    expect(screen.queryByText(/Rp/)).toBeNull();
  });

  it("renders an alert with a working retry action on error, and no figure", () => {
    const onRetry = vi.fn();
    renderSummary({ invoices: null, error: true, onRetry });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Gagal memuat.");
    expect(screen.queryByText(/Rp/)).toBeNull();

    screen.getByRole("button", { name: "Coba lagi" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
