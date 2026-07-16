import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import InvoiceDetailClient from "./invoice-detail-client";

const draftInvoice = {
  id: "invoice-1",
  userId: "user-1",
  dealId: "deal-1",
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxType: "PPH23" as const,
  status: "DRAFT" as const,
  dueDate: new Date("2026-07-31T00:00:00.000Z"),
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  updatedAt: new Date("2026-07-15T00:00:00.000Z"),
};

describe("InvoiceDetailClient", () => {
  it("renders invoice detail and only the legal next action for a draft", () => {
    render(<InvoiceDetailClient initialInvoice={draftInvoice} />);

    expect(screen.getByRole("heading", { name: "Rp1.500.000" })).toBeDefined();
    expect(screen.getAllByText("INV/2026/07/001")).toHaveLength(2);
    expect(screen.getByText("PPh 23")).toBeDefined();
    expect(screen.getByRole("button", { name: "Tandai sudah dikirim" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Tandai lunas" })).toBeNull();
  });

  it("shows no further transition control for a paid invoice", () => {
    render(<InvoiceDetailClient initialInvoice={{ ...draftInvoice, status: "PAID" }} />);

    expect(screen.getByText("Invoice ini sudah lunas.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Tandai sudah dikirim" })).toBeNull();
  });
});
