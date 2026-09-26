import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "@/components/language-switcher";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import BerandaClient from "./beranda-client";

const NOW = new Date("2026-07-19T10:00:00.000Z");

// getByText's default normalizer collapses the DOM's real NBSP (U+00A0) money
// separator into a plain space before comparing, so the query string must use
// a plain space too, not formatMoney's raw NBSP output.
function normalizedMoney(value: number): string {
  return formatMoney(value).replace(/ /g, " ");
}

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: "deal-1",
    userId: "user-1",
    brand: "Kopi Nusantara",
    contactWa: "+6281234567890",
    contactName: null,
    scope: "1 video Reels",
    feeIdr: 1_500_000,
    deadline: new Date("2026-07-25T00:00:00.000Z"),
    paymentTerms: null,
    status: "NEGO",
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
    subtotalIdr: 750_000,
    withholdingTaxType: "NONE",
    status: "SENT",
    dueDate: new Date("2026-07-22T00:00:00.000Z"),
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

function renderBeranda(props: Partial<React.ComponentProps<typeof BerandaClient>>, language: "id" | "en" = "id") {
  return render(
    <LanguageProvider initialLanguage={language}>
      <BerandaClient
        deals={props.deals ?? [makeDeal()]}
        dealsError={props.dealsError ?? false}
        invoices={props.invoices ?? []}
        invoicesError={props.invoicesError ?? false}
        now={props.now ?? NOW}
      />
    </LanguageProvider>,
  );
}

describe("BerandaClient — populated root", () => {
  it("renders exactly three section landmarks in order and no board/invoice-list/add-deal-form content", () => {
    const { container } = renderBeranda({
      deals: [makeDeal({ id: "deal-1", brand: "Kopi Nusantara" })],
      invoices: [makeInvoice({ id: "invoice-1", dealId: "deal-1" })],
    });

    const regions = screen.getAllByRole("region");
    expect(regions).toHaveLength(3);
    const headingTexts = regions.map((region) => within(region).getByRole("heading", { level: 2 }).textContent);
    expect(headingTexts).toEqual(["Net ditagihkan bulan ini", "Perlu dikejar", "3 deal terdekat"]);

    // No leftover board/invoice-list/add-deal-form landmarks from the old dashboard-client.
    expect(container.querySelector("[data-testid='pipeline-rail']")).toBeNull();
    expect(container.querySelector("[data-testid='pipeline-stage-count-strip']")).toBeNull();
    expect(container.querySelector("#pipeline")).toBeNull();
    expect(container.querySelector("#invoice-saya")).toBeNull();
    expect(container.querySelector("#tambah-deal")).toBeNull();
    expect(screen.queryByText("Invoice saya")).toBeNull();
    expect(screen.queryByText("Tambah deal pertama kamu")).toBeNull();
  });
});

describe("BerandaClient — empty root", () => {
  it("renders the exact Indonesian empty copy with no section headings when there are zero deals", () => {
    renderBeranda({ deals: [], invoices: [] }, "id");

    expect(screen.getByRole("heading", { level: 1, name: "Belum ada deal" })).toBeDefined();
    expect(screen.getByText("Catat deal pertama untuk mulai melacak pemasukan.")).toBeDefined();
    expect(screen.getByRole("link", { name: "+ Deal" })).toHaveProperty("href", expect.stringContaining("/deal"));
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    expect(screen.queryAllByRole("region")).toHaveLength(0);
  });

  it("renders the exact English empty copy with no section headings when there are zero deals", () => {
    renderBeranda({ deals: [], invoices: [] }, "en");

    expect(screen.getByRole("heading", { level: 1, name: "No deals yet" })).toBeDefined();
    expect(screen.getByText("Log your first deal to start tracking income.")).toBeDefined();
    expect(screen.getByRole("link", { name: "+ Deal" })).toHaveProperty("href", expect.stringContaining("/deal"));
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    expect(screen.queryAllByRole("region")).toHaveLength(0);
  });
});

describe("BerandaClient — §4.1 copy and Indonesian money/date formatting", () => {
  it("renders translated ID copy with no raw translation-key leakage, and Indonesian money/date", () => {
    const deal = makeDeal({ id: "deal-1", brand: "Kopi Nusantara" });
    const invoice = makeInvoice({ id: "invoice-1", dealId: "deal-1", subtotalIdr: 500_000 });
    const { container } = renderBeranda({ deals: [deal], invoices: [invoice] }, "id");

    expect(screen.getByText("Net ditagihkan bulan ini")).toBeDefined();
    expect(screen.getByText("Perlu dikejar")).toBeDefined();
    expect(screen.getByText("3 deal terdekat")).toBeDefined();
    expect(screen.getAllByText(normalizedMoney(deal.feeIdr)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatDate(deal.deadline as Date)).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/\b(home|whatsapp|action)\.[a-zA-Z]+/);
  });

  it("renders translated EN copy with no raw translation-key leakage, and money/date stay Indonesian", () => {
    const deal = makeDeal({ id: "deal-1", brand: "Kopi Nusantara" });
    const invoice = makeInvoice({ id: "invoice-1", dealId: "deal-1", subtotalIdr: 500_000 });
    const { container } = renderBeranda({ deals: [deal], invoices: [invoice] }, "en");

    expect(screen.getByText("Net invoiced this month")).toBeDefined();
    expect(screen.getByText("Needs chasing")).toBeDefined();
    expect(screen.getByText("3 nearest deals")).toBeDefined();
    // Money/date formatting must never switch to English grouping/format.
    expect(screen.getAllByText(normalizedMoney(deal.feeIdr)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(formatDate(deal.deadline as Date)).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/\b(home|whatsapp|action)\.[a-zA-Z]+/);
  });
});

describe("BerandaClient — responsive class contracts", () => {
  it("lays the follow-up queue inline below 1024px and pins it to a sticky right rail at 1024px+", () => {
    renderBeranda({
      deals: [makeDeal({ id: "deal-1" })],
      invoices: [makeInvoice({ id: "invoice-1", dealId: "deal-1" })],
    });

    const chaseHeading = screen.getByRole("heading", { level: 2, name: "Perlu dikejar" });
    const chaseWrapper = chaseHeading.closest("section")?.parentElement;
    expect(chaseWrapper).not.toBeNull();
    // Below 1024px there is no column/positioning override, so it lays out inline in source order.
    expect(chaseWrapper?.className).not.toMatch(/(^|\s)sticky(\s|$)/);
    expect(chaseWrapper?.className).toContain("min-[1024px]:col-start-9");
    expect(chaseWrapper?.className).toContain("min-[1024px]:sticky");
    expect(chaseWrapper?.className).toContain("min-[1024px]:top-[88px]");

    const incomeHeading = screen.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" });
    const incomeWrapper = incomeHeading.closest("section")?.parentElement;
    expect(incomeWrapper?.className).not.toContain("sticky");

    const nearestHeading = screen.getByRole("heading", { level: 2, name: "3 deal terdekat" });
    const nearestWrapper = nearestHeading.closest("section")?.parentElement;
    expect(nearestWrapper?.className).not.toContain("sticky");
  });
});
