import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DealPage from "./page";

describe("/deal placeholder", () => {
  it("renders an accessible heading with no AppShell", () => {
    render(<DealPage />);

    expect(screen.getByRole("heading", { name: "Deal" })).toBeDefined();
  });
});
