import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LanguageProvider } from "@/components/language-switcher";
import type { InvoiceStatus, InvoiceWithDealBrand } from "@/lib/invoices";
import { InvoiceList } from "./invoice-list";

function makeInvoice(overrides: Partial<InvoiceWithDealBrand> = {}): InvoiceWithDealBrand {
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
    deal: { brand: "Acme" },
    ...overrides,
  };
}

// 19 Jul 2026, 10:00 in Jakarta.
const NOW = new Date("2026-07-19T03:00:00.000Z");
const YESTERDAY = new Date("2026-07-18T00:00:00.000Z");
const TODAY = new Date("2026-07-19T00:00:00.000Z");
const TOMORROW = new Date("2026-07-20T00:00:00.000Z");

function renderList(invoices: InvoiceWithDealBrand[], language: "id" | "en" = "id") {
  return render(
    <LanguageProvider initialLanguage={language}>
      <InvoiceList invoices={invoices} now={NOW} />
    </LanguageProvider>,
  );
}

function section(name: string) {
  return screen.getByRole("heading", { level: 2, name }).closest("section")!;
}

describe("InvoiceList — grouping", () => {
  it("groups every status into its semantic section, folding DUE into Sent, in Overdue/Sent/Draft/Paid order", () => {
    const invoices: InvoiceWithDealBrand[] = [
      makeInvoice({ id: "i-draft", status: "DRAFT", deal: { brand: "Draf Brand" } }),
      makeInvoice({ id: "i-sent", status: "SENT", deal: { brand: "Sent Brand" } }),
      makeInvoice({ id: "i-due", status: "DUE", deal: { brand: "Due Brand" } }),
      makeInvoice({ id: "i-overdue", status: "OVERDUE", dueDate: YESTERDAY, deal: { brand: "Overdue Brand" } }),
      makeInvoice({ id: "i-paid", status: "PAID", deal: { brand: "Paid Brand" } }),
    ];

    renderList(invoices);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Terlambat", "Terkirim", "Draf", "Lunas"]);

    const sentSection = screen.getByRole("heading", { name: "Terkirim" }).closest("section")!;
    expect(within(sentSection).getByText("Sent Brand")).toBeDefined();
    expect(within(sentSection).getByText("Due Brand")).toBeDefined();
    expect(within(sentSection).queryByText("Draf Brand")).toBeNull();

    const overdueSection = screen.getByRole("heading", { name: "Terlambat" }).closest("section")!;
    expect(within(overdueSection).getByText("Overdue Brand")).toBeDefined();

    const draftSection = screen.getByRole("heading", { name: "Draf" }).closest("section")!;
    expect(within(draftSection).getByText("Draf Brand")).toBeDefined();

    const paidSection = screen.getByRole("heading", { name: "Lunas" }).closest("section")!;
    expect(within(paidSection).getByText("Paid Brand")).toBeDefined();
  });

  it.each<InvoiceStatus>(["DRAFT", "SENT", "DUE", "OVERDUE", "PAID"])(
    "renders exactly one group heading for a lone %s invoice",
    (status) => {
      renderList([makeInvoice({ status, dueDate: YESTERDAY })]);

      const headings = screen.getAllByRole("heading", { level: 2 });
      expect(headings).toHaveLength(1);

      const section = headings[0].closest("section")!;
      expect(within(section).getAllByRole("link")).toHaveLength(1);
    },
  );

  it("omits empty status groups from the DOM entirely", () => {
    renderList([makeInvoice({ status: "PAID" })]);

    expect(screen.queryByRole("heading", { name: "Terlambat" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Terkirim" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Draf" })).toBeNull();

    const paidSection = screen.getByRole("heading", { name: "Lunas" }).closest("section")!;
    expect(within(paidSection).getByText("1")).toBeDefined();
  });

  it("shows the whole-list empty state when there are no invoices at all", () => {
    renderList([]);

    expect(screen.getByText("Belum ada invoice. Pindahkan deal ke tahap Invoice, lalu buat drafnya dari kartu deal.")).toBeDefined();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});

// FIND-06: the list uses the same displayed status as Beranda and invoice
// detail (deriveInvoiceDisplayStatus), for the group and for the chip.
describe("InvoiceList — displayed status, not stored status", () => {
  it.each<InvoiceStatus>(["SENT", "DUE", "OVERDUE"])("puts a stored %s invoice due yesterday under Terlambat with the Terlambat chip", (status) => {
    renderList([makeInvoice({ status, dueDate: YESTERDAY })]);

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Terlambat"]);
    const row = within(section("Terlambat")).getByRole("link", { name: /Acme/ });
    // The heading says Terlambat once; the second one is the row's chip.
    expect(within(row).getByText("Terlambat")).toBeDefined();
    expect(within(row).queryByText("Terkirim")).toBeNull();
    expect(within(row).queryByText("Jatuh tempo")).toBeNull();
  });

  it.each([
    ["due today", TODAY],
    ["due tomorrow", TOMORROW],
    ["with no due date", null],
  ])("keeps a stored SENT invoice %s under Terkirim", (_label, dueDate) => {
    renderList([makeInvoice({ status: "SENT", dueDate })]);

    expect(screen.queryByRole("heading", { name: "Terlambat" })).toBeNull();
    expect(within(within(section("Terkirim")).getByRole("link", { name: /Acme/ })).getByText("Terkirim")).toBeDefined();
  });

  it("keeps a stored DUE invoice that is not past due under Terkirim with its Jatuh tempo chip", () => {
    renderList([makeInvoice({ status: "DUE", dueDate: TODAY })]);

    expect(screen.queryByRole("heading", { name: "Terlambat" })).toBeNull();
    expect(within(within(section("Terkirim")).getByRole("link", { name: /Acme/ })).getByText("Jatuh tempo")).toBeDefined();
  });

  it.each([
    ["a future due date", TOMORROW],
    ["no due date", null],
  ])("shows a legacy stored OVERDUE invoice with %s as Terkirim, not Terlambat", (_label, dueDate) => {
    renderList([makeInvoice({ status: "OVERDUE", dueDate })]);

    expect(screen.queryByRole("heading", { name: "Terlambat" })).toBeNull();
    expect(within(within(section("Terkirim")).getByRole("link", { name: /Acme/ })).getByText("Terkirim")).toBeDefined();
  });

  it.each([
    ["DRAFT", "Draf", "Draf"],
    ["PAID", "Lunas", "Lunas ✓"],
  ] as const)("leaves a %s invoice with a past due date in its own group", (status, heading, chip) => {
    renderList([makeInvoice({ status, dueDate: YESTERDAY })]);

    expect(screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent)).toEqual([heading]);
    expect(within(within(section(heading)).getByRole("link", { name: /Acme/ })).getByText(chip)).toBeDefined();
  });

  it("uses the Jakarta calendar day: due 18 Jul is not overdue at 23:59 on the 18th in Jakarta, and is at 00:01 on the 19th", () => {
    const invoices = [makeInvoice({ status: "SENT", dueDate: YESTERDAY })];
    const { unmount } = render(
      <LanguageProvider initialLanguage="id">
        <InvoiceList invoices={invoices} now={new Date("2026-07-18T16:59:00.000Z")} />
      </LanguageProvider>,
    );
    expect(screen.queryByRole("heading", { name: "Terlambat" })).toBeNull();
    unmount();

    render(
      <LanguageProvider initialLanguage="id">
        <InvoiceList invoices={invoices} now={new Date("2026-07-18T17:01:00.000Z")} />
      </LanguageProvider>,
    );
    expect(screen.getByRole("heading", { name: "Terlambat" })).toBeDefined();
  });

  it("groups and labels the same way in English", () => {
    renderList([makeInvoice({ status: "SENT", dueDate: YESTERDAY })], "en");

    expect(within(within(section("Overdue")).getByRole("link", { name: /Acme/ })).getByText("Overdue")).toBeDefined();
  });
});

describe("InvoiceList — row links", () => {
  it("links each row to its invoice detail route", () => {
    renderList([makeInvoice({ id: "invoice-42", status: "SENT" })]);

    const link = screen.getByRole("link", { name: /Acme/ });
    expect(link.getAttribute("href")).toBe("/invoice/invoice-42");
  });
});

describe("InvoiceList — typography and touch-target floor", () => {
  it("keeps the row link at least 44px tall and every text node at or above the 12px design-system floor", () => {
    const { container } = renderList([makeInvoice({ status: "SENT" })]);

    const link = screen.getByRole("link", { name: /Acme/ });
    expect(link.className).toContain("min-h-16");

    const sizedNodes = container.querySelectorAll<HTMLElement>('[class*="text-\\["]');
    expect(sizedNodes.length).toBeGreaterThan(0);
    sizedNodes.forEach((node) => {
      const match = node.className.match(/text-\[(\d+)px\]/);
      expect(match).not.toBeNull();
      expect(Number(match![1])).toBeGreaterThanOrEqual(12);
    });
  });
});
