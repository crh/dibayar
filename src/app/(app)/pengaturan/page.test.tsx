import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { auth } from "@/auth";
import { getUserLanguage } from "@/lib/user-language";
import { getUserSettings } from "@/lib/user-settings";
import { DEFAULT_TEMPLATE_CHASE, DEFAULT_TEMPLATE_SEND } from "@/lib/user-settings-validation";
import AppLayout from "../layout";
import PengaturanPage from "./page";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/user-language", () => ({
  getUserLanguage: vi.fn(),
}));

vi.mock("@/lib/user-settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-settings")>("@/lib/user-settings");
  return { ...actual, getUserSettings: vi.fn() };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  usePathname: () => "/pengaturan",
}));

const mockedAuth = vi.mocked(auth);
const mockedGetUserLanguage = vi.mocked(getUserLanguage);
const mockedGetUserSettings = vi.mocked(getUserSettings);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/pengaturan", () => {
  it("renders the settings form under the shared shell for a signed-in user", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", name: "Chris", email: "chris@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    } as never);
    mockedGetUserLanguage.mockResolvedValue("id");
    mockedGetUserSettings.mockResolvedValue({
      issuerName: "Kenji Creator",
      issuerAddress: "",
      issuerWhatsapp: "",
      issuerEmail: "",
      bankName: "Bank Central",
      bankAccountNumber: "1234567890",
      bankAccountHolder: "Kenji Creator",
      templateSend: DEFAULT_TEMPLATE_SEND,
      templateChase: DEFAULT_TEMPLATE_CHASE,
      updatedAt: null,
    });

    const pageContent = await PengaturanPage();
    render(await AppLayout({ children: pageContent }));

    expect(screen.getByRole("heading", { name: "Pengaturan", level: 1 })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Identitas penerbit" })).toBeDefined();
    expect(screen.getByLabelText("Nama / nama usaha")).toHaveProperty("value", "Kenji Creator");
    expect(screen.getByRole("button", { name: "Keluar" })).toBeDefined();
  });

  it("redirects to sign-in when there is no authenticated session", async () => {
    mockedAuth.mockResolvedValue(null as never);

    await expect(PengaturanPage()).rejects.toThrow("REDIRECT:/api/auth/signin?callbackUrl=%2Fpengaturan");
    expect(mockedGetUserSettings).not.toHaveBeenCalled();
  });
});
