import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { auth } from "@/auth";
import { getUserLanguage } from "@/lib/user-language";
import AppLayout from "./layout";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

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
const mockedGetUserLanguage = vi.mocked(getUserLanguage);

describe("(app) layout auth guard", () => {
  it("redirects to sign-in when there is no session", async () => {
    mockedAuth.mockResolvedValue(null as never);

    await expect(
      AppLayout({ children: <div>secret</div> }),
    ).rejects.toThrow("REDIRECT:/api/auth/signin?callbackUrl=%2F");
  });

  it("sends a session denied by the pilot gate to the access page, not into the app", async () => {
    mockedAuth.mockResolvedValue({ expires: "2099-01-01T00:00:00.000Z", pilotAccessDenied: true } as never);

    await expect(AppLayout({ children: <div>secret</div> })).rejects.toThrow("REDIRECT:/akses-terbatas");
    expect(mockedGetUserLanguage).not.toHaveBeenCalled();
  });

  it("renders children inside the app shell when a session exists", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedGetUserLanguage.mockResolvedValue("id");

    render(await AppLayout({ children: <div>secret content</div> }));

    expect(screen.getByText("secret content")).toBeDefined();
    expect(screen.getByTestId("top-bar")).toBeDefined();
    expect(screen.getByTestId("side-nav")).toBeDefined();
    expect(screen.getByTestId("bottom-nav")).toBeDefined();
  });

  it("fetches the authenticated user's stored language for the shell/nav translations", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedGetUserLanguage.mockResolvedValue("en");

    render(await AppLayout({ children: <div>secret content</div> }));

    expect(mockedGetUserLanguage).toHaveBeenCalledWith(expect.anything(), "user-1");
    expect(within(screen.getByTestId("side-nav")).getByText("Home")).toBeDefined();
  });

  it("renders exactly one account menu, owned by the shell rather than the page", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", email: "chris@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedGetUserLanguage.mockResolvedValue("id");

    render(
      await AppLayout({
        children: <div>secret content</div>,
      }),
    );

    expect(screen.getAllByRole("button", { name: "Menu akun" })).toHaveLength(1);
  });

  it("passes the authenticated session's email to the shell's account menu", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", email: "chris@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedGetUserLanguage.mockResolvedValue("id");

    const user = userEvent.setup();
    render(
      await AppLayout({
        children: <div>secret content</div>,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Menu akun" }));
    expect(screen.getByText("chris@example.com")).toBeDefined();
  });
});
