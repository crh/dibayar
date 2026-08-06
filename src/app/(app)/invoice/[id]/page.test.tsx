import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import InvoiceDetailPage from "./page";

describe("/invoice/:id placeholder", () => {
  it("resolves and renders the id from route params", async () => {
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: "invoice-456" }) }));

    expect(screen.getByRole("heading", { name: "Detail invoice" })).toBeDefined();
    expect(screen.getByText("invoice-456")).toBeDefined();
  });

  it("renders unsafe-looking id values as plain text, not markup", async () => {
    const unsafeId = "<img src=x onerror=alert(1)>";
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: unsafeId }) }));

    expect(screen.getByText(unsafeId)).toBeDefined();
  });
});
