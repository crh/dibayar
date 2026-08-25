import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { LanguageProvider, useLanguage } from "./language-switcher";

const STORAGE_KEY = "dibayar-language";

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1];
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function Harness() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="label">{t("account.menu")}</span>
      <button onClick={() => setLanguage("id")}>set-id</button>
      <button onClick={() => setLanguage("en")}>set-en</button>
    </div>
  );
}

async function hydrateHarness(initialLanguage: "en" | "id") {
  const html = renderToString(
    <LanguageProvider initialLanguage={initialLanguage}>
      <Harness />
    </LanguageProvider>,
  );
  const container = document.createElement("div");
  container.innerHTML = html;

  await act(async () => {
    hydrateRoot(
      container,
      <LanguageProvider initialLanguage={initialLanguage}>
        <Harness />
      </LanguageProvider>,
    );
  });

  return container;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  clearCookie(STORAGE_KEY);
  vi.unstubAllGlobals();
});

describe("useLanguage / LanguageProvider", () => {
  it("uses the provider's initialLanguage when no client preference is stored", () => {
    render(
      <LanguageProvider initialLanguage="en">
        <Harness />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("language").textContent).toBe("en");
  });

  it("does not overwrite an existing client preference on mount when unauthenticated", () => {
    window.localStorage.setItem(STORAGE_KEY, "id");

    render(
      <LanguageProvider initialLanguage="en">
        <Harness />
      </LanguageProvider>,
    );

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("id");
  });

  it("keeps the server cookie-derived initialLanguage authoritative on the initial client render, even with a stale localStorage value, across real hydration", async () => {
    window.localStorage.setItem(STORAGE_KEY, "id");

    const container = await hydrateHarness("en");

    expect(container.querySelector('[data-testid="language"]')?.textContent).toBe("en");
  });

  it("renders Indonesian on hydration when initialLanguage is id", async () => {
    const container = await hydrateHarness("id");

    expect(container.querySelector('[data-testid="language"]')?.textContent).toBe("id");
  });

  it("resets a stale cached language to the authoritative server/DB value on an authenticated mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "id");

    render(
      <LanguageProvider initialLanguage="en" authenticated>
        <Harness />
      </LanguageProvider>,
    );

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("en");
    expect(readCookie(STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("persists a language change to localStorage, the cookie, and document.lang", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider initialLanguage="en">
        <Harness />
      </LanguageProvider>,
    );

    await user.click(screen.getByRole("button", { name: "set-id" }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("id");
    expect(readCookie(STORAGE_KEY)).toBe("id");
    expect(document.documentElement.lang).toBe("id");
    expect(screen.getByTestId("label").textContent).toBe("Menu akun");
  });

  it("does not call the persistence API for an unauthenticated switch", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LanguageProvider initialLanguage="en">
        <Harness />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole("button", { name: "set-id" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fires a fire-and-forget PATCH to persist the choice cross-device once authenticated", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LanguageProvider initialLanguage="en" authenticated>
        <Harness />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole("button", { name: "set-id" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/language",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "id" }),
      }),
    );
  });

  it("tolerates a failed persistence PATCH without throwing", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));

    render(
      <LanguageProvider initialLanguage="en" authenticated>
        <Harness />
      </LanguageProvider>,
    );

    await expect(user.click(screen.getByRole("button", { name: "set-id" }))).resolves.not.toThrow();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("id");
  });
});
