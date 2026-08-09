import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/components/language-switcher";
import { DEFAULT_TEMPLATE_CHASE, DEFAULT_TEMPLATE_SEND } from "@/lib/user-settings-validation";
import type { UserSettingsView } from "@/lib/user-settings";
import type { Language } from "@/lib/i18n";
import { SettingsForm } from "./settings-form";

const baseSettings: UserSettingsView = {
  issuerName: "Kenji Creator",
  issuerAddress: "",
  issuerWhatsapp: "",
  issuerEmail: "",
  bankName: "Bank Central",
  bankAccountNumber: "1234567890",
  bankAccountHolder: "Kenji Creator",
  templateSend: DEFAULT_TEMPLATE_SEND,
  templateChase: DEFAULT_TEMPLATE_CHASE,
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

// Mirrors the form's PATCH payload shape, which omits updatedAt (a read-only,
// server-derived field the form never tracks or sends back).
function toWritablePayload(settings: UserSettingsView) {
  return {
    issuerName: settings.issuerName,
    issuerAddress: settings.issuerAddress,
    issuerWhatsapp: settings.issuerWhatsapp,
    issuerEmail: settings.issuerEmail,
    bankName: settings.bankName,
    bankAccountNumber: settings.bankAccountNumber,
    bankAccountHolder: settings.bankAccountHolder,
    templateSend: settings.templateSend,
    templateChase: settings.templateChase,
  };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function makeFetchMock(settingsPatchResponses: Array<{ status: number; body: unknown }> = []) {
  const queue = [...settingsPatchResponses];
  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url === "/api/me/language" && method === "PATCH") return jsonResponse(200, {});
    if (url === "/api/me/settings" && method === "PATCH") {
      const next = queue.length > 1 ? queue.shift()! : queue[0];
      if (!next) throw new Error("unexpected PATCH /api/me/settings call");
      return jsonResponse(next.status, next.body);
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  });
}

function renderForm(settings: UserSettingsView = baseSettings, language: Language = "id") {
  return render(
    <LanguageProvider initialLanguage={language} authenticated>
      <SettingsForm initialSettings={settings} email="chris@example.com" />
    </LanguageProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("SettingsForm — render and order", () => {
  it("renders sections in spec order: language, issuer, bank, templates, sign out", () => {
    vi.stubGlobal("fetch", makeFetchMock());
    renderForm();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual([
      "Bahasa antarmuka",
      "Identitas penerbit",
      "Rekening pembayaran",
      "Template WhatsAppID-ONLY",
      "Keluar",
    ]);
    expect(screen.getByRole("button", { name: "Keluar" })).toBeDefined();
  });

  it("shows the token chips and the ID-only helper under each template field", () => {
    vi.stubGlobal("fetch", makeFetchMock());
    renderForm();

    const tokenGroups = screen.getAllByLabelText("Token yang tersedia");
    expect(tokenGroups).toHaveLength(2);
    for (const group of tokenGroups) {
      expect(within(group).getByText("{brand}")).toBeDefined();
      expect(within(group).getByText("{jumlah}")).toBeDefined();
      expect(within(group).getByText("{jatuh_tempo}")).toBeDefined();
      expect(within(group).getByText("{nomor_invoice}")).toBeDefined();
      expect(within(group).getByText("{tautan}")).toBeDefined();
    }
    expect(screen.getByText("Pesan selalu dalam Bahasa Indonesia.")).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Kembalikan ke bawaan" })).toHaveLength(2);
  });
});

describe("SettingsForm — dependency notice", () => {
  it("shows the persistent notice when a required field is empty", () => {
    vi.stubGlobal("fetch", makeFetchMock());
    renderForm({ ...baseSettings, issuerName: "" });

    expect(
      screen.getByText("Lengkapi identitas dan rekening agar invoice bisa dibagikan."),
    ).toBeDefined();
  });

  it("hides the notice when identity and bank details are complete", () => {
    vi.stubGlobal("fetch", makeFetchMock());
    renderForm();

    expect(
      screen.queryByText("Lengkapi identitas dan rekening agar invoice bisa dibagikan."),
    ).toBeNull();
  });
});

describe("SettingsForm — interface language", () => {
  it("switches heading text immediately and persists via the language API, without reload", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    expect(screen.getByRole("heading", { name: "Bahasa antarmuka" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { name: "Interface language" })).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/language",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ language: "en" }) }),
    );
  });

  it("reflects the active language via aria-pressed on the segmented control", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchMock());
    renderForm();

    const idButton = screen.getByRole("button", { name: "Indonesia" });
    const enButton = screen.getByRole("button", { name: "English" });
    expect(idButton.getAttribute("aria-pressed")).toBe("true");
    expect(enButton.getAttribute("aria-pressed")).toBe("false");

    await user.click(enButton);

    expect(idButton.getAttribute("aria-pressed")).toBe("false");
    expect(enButton.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("SettingsForm — required validation", () => {
  it("blocks the save and shows inline required errors when a required field is emptied", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    const nameInput = screen.getByLabelText("Nama / nama usaha");
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: "Simpan pengaturan" }));

    expect(await screen.findByText("Wajib diisi.")).toBeDefined();
    expect(nameInput.getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/me/settings", expect.anything());
  });

  it("rejects an invalid email format without saving", async () => {
    const user = userEvent.setup();
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Simpan pengaturan" }));

    expect(await screen.findByText("Email tidak valid.")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/me/settings", expect.anything());
  });
});

describe("SettingsForm — save lifecycle", () => {
  it("shows saving then saved, and the saved indicator clears after 2s", async () => {
    const fetchMock = makeFetchMock([{ status: 200, body: { settings: baseSettings } }]);
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Simpan pengaturan" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Tersimpan")).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.queryByText("Tersimpan")).toBeNull();
    vi.useRealTimers();
  });

  it("shows an inline error, not a route crash, when the API call fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      makeFetchMock([{ status: 500, body: { error: "Pengaturan belum bisa disimpan. Coba lagi." } }]),
    );
    renderForm();

    await user.click(screen.getByRole("button", { name: "Simpan pengaturan" }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Gagal menyimpan. Coba lagi.");
    expect(screen.getByRole("heading", { name: "Identitas penerbit" })).toBeDefined();
  });

  it("PATCHes the exact form payload and adopts the server-returned view on success", async () => {
    const user = userEvent.setup();
    const updated = { ...baseSettings, issuerAddress: "Jl. Melati 1" };
    const fetchMock = makeFetchMock([{ status: 200, body: { settings: updated } }]);
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    await user.type(screen.getByLabelText("Alamat"), "Jl. Melati 1");
    await user.click(screen.getByRole("button", { name: "Simpan pengaturan" }));

    await screen.findByText("Tersimpan");

    const expectedPayload = toWritablePayload({ ...baseSettings, issuerAddress: "Jl. Melati 1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/settings",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expectedPayload),
      }),
    );
    expect((screen.getByLabelText("Alamat") as HTMLTextAreaElement).value).toBe("Jl. Melati 1");
  });
});

describe("SettingsForm — reset to default", () => {
  it("resets a customized template through the API and shows the default text back", async () => {
    const user = userEvent.setup();
    const customized = { ...baseSettings, templateSend: "Custom send template" };
    const resetResult = { ...baseSettings, templateSend: DEFAULT_TEMPLATE_SEND };
    const fetchMock = makeFetchMock([{ status: 200, body: { settings: resetResult } }]);
    vi.stubGlobal("fetch", fetchMock);
    renderForm(customized);

    const [resetSendButton] = screen.getAllByRole("button", { name: "Kembalikan ke bawaan" });
    await user.click(resetSendButton);

    await screen.findByText("Tersimpan");

    const expectedPayload = toWritablePayload({ ...customized, templateSend: "" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(expectedPayload),
      }),
    );
    expect((screen.getByLabelText("Pesan kirim invoice") as HTMLTextAreaElement).value).toBe(DEFAULT_TEMPLATE_SEND);
  });
});

describe("SettingsForm — sign out", () => {
  it("requires an explicit confirm before exposing the sign-out link", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchMock());
    renderForm();

    expect(screen.queryByRole("link", { name: "Ya, keluar" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Keluar" }));

    expect(screen.getByText("Yakin ingin keluar?")).toBeDefined();
    const signOutLink = screen.getByRole("link", { name: "Ya, keluar" });
    expect(signOutLink.getAttribute("href")).toBe("/api/auth/signout?callbackUrl=/");

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("link", { name: "Ya, keluar" })).toBeNull();
  });
});
