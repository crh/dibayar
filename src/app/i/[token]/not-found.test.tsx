import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PublicInvoiceNotFound from "./not-found";

// This segment's not-found.tsx is what Next renders for every notFound()
// call in page.tsx (unknown token, malformed token, rate-limited) --
// page.test.tsx mocks next/navigation's notFound() to just throw, so it
// never actually exercises this component. See OBSERVATIONS.md: before
// this remediation there was no not-found.tsx here at all, so an invalid
// token fell through to Next's unstyled default 404.
describe("PublicInvoiceNotFound", () => {
  it("renders the Dibayar wordmark and a generic not-found message, with no invoice data", () => {
    render(<PublicInvoiceNotFound />);

    expect(screen.getByText("Dibayar")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("tidak ditemukan");
  });

  it("does not imply which failure reason occurred (no distinguishing copy)", () => {
    render(<PublicInvoiceNotFound />);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/kedaluwarsa|expired|batas|limit/i);
  });
});
