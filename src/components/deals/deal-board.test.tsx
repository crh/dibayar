import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { translate } from "@/lib/i18n";
import type { DealRecord } from "@/lib/deals";
import { DEAL_DRAG_MIME } from "./deal-card";
import { DealBoard } from "./deal-board";

const t = (key: string, values?: Record<string, string>) => translate("id", key, values);

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: "deal-1",
    userId: "user-1",
    brand: "Kopi Nusantara",
    contactWa: "+6281234567890",
    contactName: null,
    scope: "1 Reel + 2 Story",
    feeIdr: 2_500_000,
    deadline: null,
    paymentTerms: null,
    status: "NEGO",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function dataTransferFor(dealId: string) {
  return { types: [DEAL_DRAG_MIME], getData: () => dealId, setData: vi.fn(), dropEffect: "" };
}

function renderBoard(deals: DealRecord[] = [makeDeal()]) {
  const onStageChange = vi.fn();
  const onCreateInvoice = vi.fn();
  render(
    <DealBoard
      deals={deals}
      invoices={[]}
      language="id"
      t={t}
      pendingDealId={null}
      isSaving={false}
      stageFilter={null}
      onStageChange={onStageChange}
      onCreateInvoice={onCreateInvoice}
      onEdit={vi.fn()}
    />,
  );
  return { onStageChange, onCreateInvoice };
}

describe("DealBoard drag-and-drop (T-15)", () => {
  it("moves a deal to the stage its card is dropped on", () => {
    const { onStageChange } = renderBoard();
    const dealColumn = screen.getByRole("region", { name: "Deal" });

    fireEvent.drop(dealColumn, { dataTransfer: dataTransferFor("deal-1") });

    expect(onStageChange).toHaveBeenCalledWith("deal-1", "DEAL");
  });

  it("ignores a drop that doesn't carry the app's own drag data (e.g. a stray file drop)", () => {
    const { onStageChange } = renderBoard();
    const dealColumn = screen.getByRole("region", { name: "Deal" });

    fireEvent.drop(dealColumn, { dataTransfer: { types: ["Files"], getData: () => "", setData: vi.fn() } });

    expect(onStageChange).not.toHaveBeenCalled();
  });

  it("allows dropping by calling preventDefault on dragover for a recognized drag", () => {
    renderBoard();
    const dealColumn = screen.getByRole("region", { name: "Deal" });

    const event = fireEvent.dragOver(dealColumn, { dataTransfer: dataTransferFor("deal-1") });

    // fireEvent returns false when preventDefault() was called.
    expect(event).toBe(false);
  });

  it("a collapsed (empty) stage is still a valid drop target", () => {
    const { onStageChange } = renderBoard();
    const invoiceColumn = screen.getByRole("region", { name: "Invoice" });

    fireEvent.drop(invoiceColumn, { dataTransfer: dataTransferFor("deal-1") });

    expect(onStageChange).toHaveBeenCalledWith("deal-1", "INVOICE");
  });
});

describe("DealBoard empty-stage collapse (T-16)", () => {
  it("collapses empty stages on the unfiltered board: no placeholder text, count still visible", () => {
    renderBoard(); // single deal at NEGO; the other 5 stages are empty
    const invoiceColumn = screen.getByRole("region", { name: "Invoice" });

    expect(invoiceColumn.textContent).not.toContain("Belum ada deal");
    expect(invoiceColumn.querySelector("h3")?.textContent).toBe("Invoice");
    expect(invoiceColumn.querySelector("span")?.textContent).toBe("0");
  });

  it("does not collapse the stage that actually has deals", () => {
    renderBoard();
    const negoColumn = screen.getByRole("region", { name: "Nego" });

    expect(screen.getByText("Kopi Nusantara")).toBeDefined();
    expect(negoColumn.textContent).not.toContain("Belum ada deal");
  });

  it("does not collapse a filtered empty stage: placeholder text still shows", () => {
    const onStageChange = vi.fn();
    const onCreateInvoice = vi.fn();
    render(
      <DealBoard
        deals={[]}
        invoices={[]}
        language="id"
        t={t}
        pendingDealId={null}
        isSaving={false}
        stageFilter="DIBAYAR"
        onStageChange={onStageChange}
        onCreateInvoice={onCreateInvoice}
      onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "Dibayar" }).textContent).toContain("Belum ada deal");
  });
});
