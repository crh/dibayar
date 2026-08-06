import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DealDetailPage from "./page";

describe("/deal/:id placeholder", () => {
  it("resolves and renders the id from route params", async () => {
    render(await DealDetailPage({ params: Promise.resolve({ id: "deal-123" }) }));

    expect(screen.getByRole("heading", { name: "Detail deal" })).toBeDefined();
    expect(screen.getByText("deal-123")).toBeDefined();
  });

  it("renders unsafe-looking id values as plain text, not markup", async () => {
    const unsafeId = "<img src=x onerror=alert(1)>";
    render(await DealDetailPage({ params: Promise.resolve({ id: unsafeId }) }));

    expect(screen.getByText(unsafeId)).toBeDefined();
  });
});
