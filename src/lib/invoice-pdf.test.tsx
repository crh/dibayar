import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { InvoicePdf } from "./invoice-pdf";

// InvoicePdf takes no language input at all (see the InvoicePdfInvoice /
// InvoicePdfDeal prop types) — this suite pins that contract down so a future
// change can't quietly thread the creator's UI language into the recipient's
// PDF. Walk the returned React element tree directly (no DOM/renderer needed)
// and collect every string leaf to assert on the actual rendered text.
function collectText(node: ReactNode, out: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  if (typeof node === "object" && "props" in node) {
    collectText((node as { props: { children?: ReactNode } }).props.children, out);
  }
  return out;
}

const invoice = {
  number: "INV/2026/07/001",
  subtotalIdr: 1_500_000,
  withholdingTaxType: "PPH23" as const,
  status: "SENT" as const,
  dueDate: new Date("2026-07-31T00:00:00.000Z"),
};

const deal = { brand: "Kopi Nusantara", scope: "Video kampanye" };

describe("InvoicePdf", () => {
  it("renders only Indonesian text, with no language prop available to change it", () => {
    const text = collectText(InvoicePdf({ invoice, deal })).join(" ");

    expect(text).toContain("Invoice kolaborasi brand");
    expect(text).toContain("Ditagihkan kepada");
    expect(text).toContain("Jatuh tempo");
    expect(text).toContain("Jasa kolaborasi");
    expect(text).toContain("Pajak potong");
    expect(text).toContain("Total invoice");
    expect(text).toContain("Rp1.500.000");
    expect(text).not.toMatch(/billed to|due date|withholding|total invoice amount|thank you/i);
  });

  it("stays Indonesian regardless of due date presence or withholding tax type", () => {
    const text = collectText(
      InvoicePdf({ invoice: { ...invoice, dueDate: null, withholdingTaxType: "NONE" }, deal: null }),
    ).join(" ");

    expect(text).toContain("Belum ditentukan");
    expect(text).toContain("Tidak ada");
    expect(text).not.toMatch(/not set|none\b/i);
  });
});
