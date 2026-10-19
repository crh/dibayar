import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/components/language-switcher";
import BerandaError from "./error";

function renderError(props: { retry: () => void; reset?: () => void }) {
  // Next passes both; the boundary must use retry (FIND-12).
  const allProps = { error: new Error("boom"), reset: vi.fn(), ...props } as unknown as Parameters<typeof BerandaError>[0];
  return render(
    <LanguageProvider initialLanguage="id">
      <BerandaError {...allProps} />
    </LanguageProvider>,
  );
}

describe("(app) route error boundary", () => {
  it("shows the error and a retry button", () => {
    renderError({ retry: vi.fn() });

    expect(screen.getByRole("alert").textContent).toBe("Gagal memuat.");
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("asks the server again on Coba lagi instead of re-rendering the failed result", async () => {
    const retry = vi.fn();
    const reset = vi.fn();
    renderError({ retry, reset });

    await userEvent.click(screen.getByRole("button", { name: "Coba lagi" }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
});
