import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { auth } from "@/auth";
import AppLayout from "./layout";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const mockedAuth = vi.mocked(auth);

describe("(app) layout auth guard", () => {
  it("redirects to sign-in when there is no session", async () => {
    mockedAuth.mockResolvedValue(null as never);

    await expect(
      AppLayout({ children: <div>secret</div> }),
    ).rejects.toThrow("REDIRECT:/api/auth/signin?callbackUrl=%2F");
  });

  it("renders children when a session exists", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);

    render(await AppLayout({ children: <div>secret content</div> }));

    expect(screen.getByText("secret content")).toBeDefined();
  });
});
