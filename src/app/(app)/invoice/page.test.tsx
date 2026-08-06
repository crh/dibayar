import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import InvoicePage from "./page";

describe("/invoice placeholder", () => {
  it("renders an accessible heading with no AppShell", () => {
    render(<InvoicePage />);

    expect(screen.getByRole("heading", { name: "Invoice" })).toBeDefined();
  });
});
