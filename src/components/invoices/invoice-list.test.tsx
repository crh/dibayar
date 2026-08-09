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

function renderList(invoices: InvoiceWithDealBrand[]) {
  return render(
    <LanguageProvider initialLanguage="id">
      <InvoiceList invoices={invoices} />
    </LanguageProvider>,
  );
}

describe("InvoiceList — grouping", () => {
  it("groups every status into its semantic section, folding DUE into Sent, in Overdue/Sent/Draft/Paid order", () => {
    const invoices: InvoiceWithDealBrand[] = [
      makeInvoice({ id: "i-draft", status: "DRAFT", deal: { brand: "Draf Brand" } }),
      makeInvoice({ id: "i-sent", status: "SENT", deal: { brand: "Sent Brand" } }),
      makeInvoice({ id: "i-due", status: "DUE", deal: { brand: "Due Brand" } }),
      makeInvoice({ id: "i-overdue", status: "OVERDUE", deal: { brand: "Overdue Brand" } }),
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
      renderList([makeInvoice({ status })]);

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
