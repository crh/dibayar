import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { cookies, auth } = vi.hoisted(() => ({ cookies: vi.fn(), auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/auth", () => ({ auth }));

import AccessRestrictedPage from "./page";

function cookieJar(value?: string) {
  return {
    get: (name: string) => (name === "dibayar-language" && value !== undefined ? { name, value } : undefined),
  };
}

async function renderPage(params: Record<string, string> = {}) {
  return render(await AccessRestrictedPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  cookies.mockReset();
  cookies.mockResolvedValue(cookieJar());
  auth.mockReset();
  auth.mockResolvedValue(null);
});

describe("/akses-terbatas", () => {
  it("explains invite-only access after Auth.js AccessDenied, with a sign-in link and no sign-out", async () => {
    await renderPage({ error: "AccessDenied" });

    expect(screen.getByRole("heading", { level: 1, name: "Akses khusus kreator yang diundang" })).toBeDefined();
    expect(screen.getByText(/belum terdaftar untuk pilot Dibayar/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Masuk dengan akun lain" }).getAttribute("href")).toBe("/api/auth/signin?callbackUrl=%2Fdashboard");
    expect(screen.queryByRole("link", { name: "Keluar dari akun ini" })).toBeNull();
  });

  it("offers sign-out for an existing session denied by the gate", async () => {
    auth.mockResolvedValue({ expires: "2099-01-01T00:00:00.000Z", pilotAccessDenied: true });

    await renderPage();

    expect(screen.getByRole("link", { name: "Keluar dari akun ini" }).getAttribute("href")).toBe("/api/auth/signout?callbackUrl=%2Fmasuk");
    expect(screen.getByText(/belum terdaftar untuk pilot Dibayar/)).toBeDefined();
  });

  it("shows a generic retry message for other Auth.js errors", async () => {
    await renderPage({ error: "Configuration" });

    expect(screen.getByText("Masuk belum berhasil. Coba lagi beberapa saat lagi.")).toBeDefined();
    expect(screen.queryByText(/belum terdaftar/)).toBeNull();
  });

  it("never shows the account's email, even when the error query carries one", async () => {
    const { container } = await renderPage({ error: "stranger@example.invalid" });

    expect(container.textContent).not.toContain("stranger@example.invalid");
  });

  it("renders English when the language cookie is en", async () => {
    cookies.mockResolvedValue(cookieJar("en"));

    await renderPage({ error: "AccessDenied" });

    expect(screen.getByRole("heading", { level: 1, name: "Access is for invited creators only" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to the home page" }).getAttribute("href")).toBe("/masuk");
  });
});
