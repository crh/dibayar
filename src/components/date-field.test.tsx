import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DateField } from "./date-field";

const baseProps = {
  id: "invoice-due-date",
  label: "Tanggal jatuh tempo",
  lang: "id-ID",
  emptyLabel: "Belum ditentukan",
  clearLabel: "Kosongkan",
  savingLabel: "Menyimpan…",
  savedLabel: "Tersimpan",
  errorLabel: "Tanggal jatuh tempo belum bisa diperbarui. Coba lagi.",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("DateField", () => {
  it("gives the native input both id and name, and sets lang to match the selected locale", () => {
    render(<DateField {...baseProps} value="" onCommit={async () => ({ ok: true })} />);

    const input = screen.getByLabelText("Tanggal jatuh tempo") as HTMLInputElement;
    expect(input.id).toBe("invoice-due-date");
    expect(input.name).toBe("invoice-due-date");
    expect(input.type).toBe("date");
    expect(input.getAttribute("lang")).toBe("id-ID");
  });

  it("shows the formatted 24 Jul 2026 display, never the native input's own rendering", () => {
    render(<DateField {...baseProps} value="2026-07-24" onCommit={async () => ({ ok: true })} />);

    expect(screen.getByText("24 Jul 2026")).toBeDefined();
  });

  it("shows the empty label when there is no value, with no Clear control", () => {
    render(<DateField {...baseProps} value="" onCommit={async () => ({ ok: true })} />);

    expect(screen.getByText("Belum ditentukan")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Kosongkan" })).toBeNull();
  });

  it("commits a picker change immediately, with no separate Save button, showing Menyimpan… then Tersimpan", async () => {
    let resolveCommit: ((result: { ok: boolean }) => void) | undefined;
    const onCommit = vi.fn(() => new Promise<{ ok: boolean }>((resolve) => { resolveCommit = resolve; }));

    render(<DateField {...baseProps} value="" onCommit={onCommit} />);
    expect(screen.queryByRole("button", { name: /simpan/i })).toBeNull();

    const input = screen.getByLabelText("Tanggal jatuh tempo");
    fireEvent.change(input, { target: { value: "2026-08-15" } });

    expect(onCommit).toHaveBeenCalledWith("2026-08-15");
    expect(await screen.findByText("Menyimpan…")).toBeDefined();

    resolveCommit?.({ ok: true });
    expect(await screen.findByText("Tersimpan")).toBeDefined();
  });

  it("clears the saved indicator back to idle after the display window", async () => {
    vi.useFakeTimers();
    const onCommit = vi.fn(async () => ({ ok: true }));
    render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kosongkan" }));
    });
    expect(screen.getByText("Tersimpan")).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001);
    });
    expect(screen.queryByText("Tersimpan")).toBeNull();
  });

  it("sends null when Kosongkan is clicked, and shows an alert on failure", async () => {
    const onCommit = vi.fn(async () => ({ ok: false }));
    render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

    fireEvent.click(screen.getByRole("button", { name: "Kosongkan" }));

    expect(onCommit).toHaveBeenCalledWith(null);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Tanggal jatuh tempo belum bisa diperbarui. Coba lagi.",
    );
  });

  it("disables the control while a commit is in flight", async () => {
    const onCommit = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

    fireEvent.click(screen.getByRole("button", { name: "Kosongkan" }));

    await waitFor(() => expect(screen.getByLabelText("Tanggal jatuh tempo")).toHaveProperty("disabled", true));
  });

  it("stacks the date display and Kosongkan button full-width below 360px (T-26)", () => {
    render(<DateField {...baseProps} value="2026-07-24" onCommit={async () => ({ ok: true })} />);

    const row = screen.getByRole("button", { name: "Kosongkan" }).closest("div")!;
    expect(row.className).toMatch(/flex-col/);
    expect(row.className).toMatch(/min-\[360px\]:flex-row/);
  });
});
