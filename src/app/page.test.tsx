import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { cookies } = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock("next/headers", () => ({ cookies }));

import Home from "./masuk/page";

function cookieJar(value?: string) {
  return {
    get: (name: string) => (name === "dibayar-language" && value !== undefined ? { name, value } : undefined),
  };
}

beforeEach(() => {
  cookies.mockReset();
  cookies.mockResolvedValue(cookieJar());
  window.localStorage.clear();
});

describe("Home (landing page)", () => {
  it("shows the Dibayar coming-soon message in Indonesian by default", async () => {
    render(await Home());

    expect(screen.getByText("Segera hadir")).toBeDefined();
    expect(
      screen.getByText("Kelola deal brand, invoice, dan pembayaran di satu tempat"),
    ).toBeDefined();
  });

  it("does not leak the default English create-next-app copy", async () => {
    const { container } = render(await Home());
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/create next app/i);
    expect(text).not.toMatch(/get started by editing/i);
  });

  it("renders the brand-deal pipeline stages in order", async () => {
    render(await Home());
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

  it("uses an explicit Indonesian action label instead of a generic submit button", async () => {
    render(await Home());

    expect(screen.getByRole("link", { name: "Lihat cara kerja" })).toBeDefined();
    expect(screen.queryByText(/^submit$/i)).toBeNull();
  });

  it("offers Google sign-in for the private dashboard", async () => {
    render(await Home());

    expect(
      screen.getByRole("link", { name: "Masuk dengan Google" }).getAttribute("href"),
    ).toBe("/api/auth/signin?callbackUrl=%2Fdashboard");
  });

  it("renders Indonesian content when the language cookie is id", async () => {
    cookies.mockResolvedValue(cookieJar("id"));

    render(await Home());

    expect(screen.getByText("Segera hadir")).toBeDefined();
    expect(
      screen.getByText("Kelola deal brand, invoice, dan pembayaran di satu tempat"),
    ).toBeDefined();
  });

  it("renders English content when the language cookie is en", async () => {
    cookies.mockResolvedValue(cookieJar("en"));

    render(await Home());

    expect(screen.getByText("Coming soon")).toBeDefined();
    expect(
      screen.getByText("Manage brand deals, invoices, and payments in one place"),
    ).toBeDefined();
  });

  it("exposes a working language switcher that renders English on toggle", async () => {
    const user = userEvent.setup();
    render(await Home());

    await user.selectOptions(screen.getByRole("combobox", { name: "Bahasa" }), "en");

    expect(screen.getByText("Coming soon")).toBeDefined();
    expect(screen.queryByText("Segera hadir")).toBeNull();
  });
});
