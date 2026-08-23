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
});
