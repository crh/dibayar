import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoneyDisplay } from "./design-system";

// getByText's default normalizer collapses the DOM's real NBSP (U+00A0)
// separator into a plain space before comparing, so the query string here
// must use a plain space, not NBSP, to match.
const SPACE = String.fromCharCode(0x0020);
const MINUS = String.fromCharCode(0x2212);

describe("MoneyDisplay", () => {
  it("renders the exact centralized formatMoney output regardless of the language prop", () => {
    const expected = `Rp${SPACE}1.500.000`;
    const { unmount } = render(<MoneyDisplay value={1500000} language="id" />);
    expect(screen.getByText(expected)).toBeDefined();
    unmount();

    render(<MoneyDisplay value={1500000} language="en" />);
    expect(screen.getByText(expected)).toBeDefined();
  });

  it("never renders an IDR prefix or comma grouping under the English language prop", () => {
    render(<MoneyDisplay value={1500000} language="en" />);
    expect(screen.queryByText(/IDR/)).toBeNull();
    expect(screen.queryByText(/1,500,000/)).toBeNull();
  });

  it("renders a true minus sign before Rp for a negative amount", () => {
    render(<MoneyDisplay value={-20000} language="en" />);
    expect(screen.getByText(`${MINUS}Rp${SPACE}20.000`)).toBeDefined();
  });
});
