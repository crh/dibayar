import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { auth } from "@/auth";
import { listDeals } from "@/lib/deals";
import { listInvoices } from "@/lib/invoices";
import { getUserLanguage } from "@/lib/user-language";
import AppLayout from "./layout";
import DashboardPage from "./page";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/deals", async () => {
  const actual = await vi.importActual<typeof import("@/lib/deals")>("@/lib/deals");
  return { ...actual, listDeals: vi.fn() };
});

vi.mock("@/lib/invoices", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invoices")>("@/lib/invoices");
  return { ...actual, listInvoices: vi.fn() };
});

vi.mock("@/lib/user-language", () => ({
  getUserLanguage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  usePathname: () => "/",
}));

const mockedAuth = vi.mocked(auth);
const mockedListDeals = vi.mocked(listDeals);
const mockedListInvoices = vi.mocked(listInvoices);
const mockedGetUserLanguage = vi.mocked(getUserLanguage);

describe("root protected page + shell integration", () => {
  it("renders the dashboard under the layout's single LanguageProvider and the shell's own account menu", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", name: "Chris", email: "chris@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedGetUserLanguage.mockResolvedValue("id");
    mockedListDeals.mockResolvedValue([]);
    mockedListInvoices.mockResolvedValue([]);

    const pageContent = await DashboardPage();
    render(await AppLayout({ children: pageContent }));

    const sideNav = screen.getByTestId("side-nav");
    expect(within(sideNav).getByText("Beranda")).toBeDefined();

    // The dashboard page no longer renders a page-local account menu, so
    // the shell's copy is the only one that reaches the DOM.
    expect(screen.getAllByRole("button", { name: "Menu akun" })).toHaveLength(1);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    expect(screen.getByRole("menuitem", { name: "Pengaturan" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Keluar" })).toBeDefined();
  });
});
