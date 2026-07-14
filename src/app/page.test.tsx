import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home (coming-soon page)", () => {
  it("shows the Dibayar coming-soon message in Bahasa Indonesia", () => {
    render(<Home />);

    expect(screen.getByText("Segera hadir")).toBeDefined();
    expect(
      screen.getByText(
        "Kelola deal brand, invoice, dan pembayaran di satu tempat",
      ),
    ).toBeDefined();
  });

  it("does not leak the default English create-next-app copy", () => {
    const { container } = render(<Home />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/create next app/i);
    expect(text).not.toMatch(/get started by editing/i);
  });

  it("renders the brand-deal pipeline stages in order", () => {
    render(<Home />);
    const pipeline = screen.getByRole("list", {
      name: "Alur kerja deal brand kamu",
    });
    const text = pipeline.textContent ?? "";

    const stages = ["Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"];
    let lastIndex = -1;
    for (const stage of stages) {
      const index = text.indexOf(stage);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("uses an explicit Bahasa action label instead of a generic submit button", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: "Lihat cara kerja" }),
    ).toBeDefined();
    expect(screen.queryByText(/^submit$/i)).toBeNull();
  });

  it("offers Google sign-in for the private dashboard", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: "Masuk dengan Google" }).getAttribute("href"),
    ).toBe("/api/auth/signin/google?callbackUrl=%2Fdashboard");
  });
});
