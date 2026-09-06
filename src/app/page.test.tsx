import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

// The landing page's own content/structure (order, deleted "coming soon"
// copy, bilingual rendering, sign-in link, etc.) is covered by
// landing-client.test.tsx. This file only owns the server page's own job:
// reading the language cookie and passing the right language through.
describe("Home (landing page)", () => {
  it("does not leak the default English create-next-app copy", async () => {
    const { container } = render(await Home());
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/create next app/i);
    expect(text).not.toMatch(/get started by editing/i);
  });

  it("defaults to Indonesian when no language cookie is set", async () => {
    render(await Home());

    expect(screen.getByRole("heading", { name: "Kelola deal brand, invoice, dan pembayaran di satu tempat" })).toBeDefined();
  });

  it("renders Indonesian content when the language cookie is id", async () => {
    cookies.mockResolvedValue(cookieJar("id"));

    render(await Home());

    expect(screen.getByRole("heading", { name: "Kelola deal brand, invoice, dan pembayaran di satu tempat" })).toBeDefined();
  });

  it("renders English content when the language cookie is en", async () => {
    cookies.mockResolvedValue(cookieJar("en"));

    render(await Home());

    expect(screen.getByRole("heading", { name: "Manage brand deals, invoices, and payments in one place" })).toBeDefined();
  });
});
