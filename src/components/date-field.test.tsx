import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DateField } from "./date-field";

const baseProps = {
  id: "invoice-due-date",
  label: "Tanggal jatuh tempo",
  lang: "id-ID",
  min: "2000-01-01",
  max: "2099-12-31",
  emptyLabel: "Belum ditentukan",
  clearLabel: "Kosongkan",
  savingLabel: "Menyimpan…",
  savedLabel: "Tersimpan",
  errorLabel: "Tanggal jatuh tempo belum bisa diperbarui. Coba lagi.",
  invalidInputLabel: "Tanggal belum lengkap atau di luar rentang.",
  invalidStoredLabel: "Tanggal tidak valid",
  invalidStoredHint: "Tanggal jatuh tempo yang tersimpan tidak valid.",
};

function input() {
  return screen.getByLabelText("Tanggal jatuh tempo") as HTMLInputElement;
}

// What a person typing into a native date segment produces: a keydown on
// the input, then the input's new value.
function typeSegment(key: string, nextValue: string) {
  fireEvent.keyDown(input(), { key });
  fireEvent.change(input(), { target: { value: nextValue } });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("DateField", () => {
  it("gives the native input both id and name, sets lang to match the selected locale, and carries min/max", () => {
    render(<DateField {...baseProps} value="" onCommit={async () => ({ ok: true })} />);

    expect(input().id).toBe("invoice-due-date");
    expect(input().name).toBe("invoice-due-date");
    expect(input().type).toBe("date");
    expect(input().getAttribute("lang")).toBe("id-ID");
    expect(input().min).toBe("2000-01-01");
    expect(input().max).toBe("2099-12-31");
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

    fireEvent.change(input(), { target: { value: "2026-08-15" } });

    expect(onCommit).toHaveBeenCalledWith("2026-08-15");
    expect(await screen.findByText("Menyimpan…")).toBeDefined();

    resolveCommit?.({ ok: true });
    expect(await screen.findByText("Tersimpan")).toBeDefined();
  });

  it("commits a native clear from the picker (no keyboard) as null", () => {
    const onCommit = vi.fn(async () => ({ ok: true }));
    render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

    fireEvent.change(input(), { target: { value: "" } });

    expect(onCommit).toHaveBeenCalledWith(null);
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

  it("keeps the input enabled and focusable while a commit is in flight, marking it aria-busy", async () => {
    const onCommit = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

    fireEvent.click(screen.getByRole("button", { name: "Kosongkan" }));

    await waitFor(() => expect(input().getAttribute("aria-busy")).toBe("true"));
    expect(input().disabled).toBe(false);
  });

  it("serializes commits: a pick made while one is in flight is sent after it resolves, and only the newest", async () => {
    const resolvers: Array<(result: { ok: boolean }) => void> = [];
    const onCommit = vi.fn(() => new Promise<{ ok: boolean }>((resolve) => { resolvers.push(resolve); }));
    render(<DateField {...baseProps} value="" onCommit={onCommit} />);

    fireEvent.change(input(), { target: { value: "2026-08-01" } });
    fireEvent.change(input(), { target: { value: "2026-08-02" } });
    fireEvent.change(input(), { target: { value: "2026-08-03" } });
    expect(onCommit).toHaveBeenCalledTimes(1);

    await act(async () => resolvers[0]({ ok: true }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2));
    expect(onCommit).toHaveBeenLastCalledWith("2026-08-03");

    await act(async () => resolvers[1]({ ok: true }));
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  describe("keyboard entry (FIND-03)", () => {
    it("never commits while typing, even when the input briefly holds year 0002, and commits once on Enter", async () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="" onCommit={onCommit} />);

      typeSegment("2", "0002-01-15");
      typeSegment("0", "0020-01-15");
      typeSegment("3", "0203-01-15");
      typeSegment("0", "2030-01-15");
      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByText("15 Jan 2030")).toBeDefined();

      await act(async () => {
        fireEvent.keyDown(input(), { key: "Enter" });
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith("2030-01-15");

      fireEvent.blur(input());
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("commits a completed typed date when focus leaves the field", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="" onCommit={onCommit} />);

      typeSegment("0", "2030-01-15");
      fireEvent.blur(input());

      expect(onCommit).toHaveBeenCalledWith("2030-01-15");
    });

    it.each([
      ["below the minimum", "0002-01-15"],
      ["just below the minimum", "1999-12-31"],
      ["above the maximum", "2100-01-01"],
    ])("refuses a typed date %s on blur: nothing sent, hint shown, aria-invalid", (_case, typed) => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="" onCommit={onCommit} />);

      typeSegment("2", typed);
      fireEvent.blur(input());

      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByText("Tanggal belum lengkap atau di luar rentang.")).toBeDefined();
      expect(input().getAttribute("aria-invalid")).toBe("true");
      expect(input().getAttribute("aria-describedby")).toBe("invoice-due-date-hint");
    });

    it("accepts both inclusive range boundaries", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      const { unmount } = render(<DateField {...baseProps} value="" onCommit={onCommit} />);
      typeSegment("1", "2000-01-01");
      fireEvent.blur(input());
      expect(onCommit).toHaveBeenLastCalledWith("2000-01-01");
      unmount();

      render(<DateField {...baseProps} value="" onCommit={onCommit} />);
      typeSegment("9", "2099-12-31");
      fireEvent.blur(input());
      expect(onCommit).toHaveBeenLastCalledWith("2099-12-31");
    });

    it("never treats a partly typed date (native badInput) as a clear", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

      typeSegment("0", "");
      Object.defineProperty(input(), "validity", { configurable: true, value: { badInput: true } });
      fireEvent.blur(input());

      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByText("Tanggal belum lengkap atau di luar rentang.")).toBeDefined();
    });

    it("treats a fully emptied input (every segment deleted) as a deliberate clear on blur", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

      typeSegment("Backspace", "");
      fireEvent.blur(input());

      expect(onCommit).toHaveBeenCalledWith(null);
    });

    it("Escape drops an uncommitted keyboard draft and restores the saved date", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

      typeSegment("1", "2026-01-24");
      expect(screen.getByText("24 Jan 2026")).toBeDefined();
      fireEvent.keyDown(input(), { key: "Escape" });
      fireEvent.blur(input());

      expect(input().value).toBe("2026-07-24");
      expect(screen.getByText("24 Jul 2026")).toBeDefined();
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("does not overwrite an in-progress draft when the saved value changes underneath it", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      const { rerender } = render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

      typeSegment("1", "2026-01-24");
      rerender(<DateField {...baseProps} value="2026-07-25" onCommit={onCommit} />);

      expect(input().value).toBe("2026-01-24");
    });

    it("adopts a newly saved value when nothing is being typed", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      const { rerender } = render(<DateField {...baseProps} value="2026-07-24" onCommit={onCommit} />);

      rerender(<DateField {...baseProps} value="2026-07-25" onCommit={onCommit} />);

      expect(input().value).toBe("2026-07-25");
      expect(screen.getByText("25 Jul 2026")).toBeDefined();
    });
  });

  describe("visible-field activation (FIND-02)", () => {
    it("asks the browser to open the picker when the field is clicked", () => {
      render(<DateField {...baseProps} value="" onCommit={async () => ({ ok: true })} />);
      const showPicker = vi.fn();
      Object.defineProperty(input(), "showPicker", { configurable: true, value: showPicker });

      fireEvent.click(input());

      expect(showPicker).toHaveBeenCalledTimes(1);
    });

    it("falls back to native behavior when showPicker is missing or refuses", () => {
      render(<DateField {...baseProps} value="" onCommit={async () => ({ ok: true })} />);
      Object.defineProperty(input(), "showPicker", { configurable: true, value: undefined });
      expect(() => fireEvent.click(input())).not.toThrow();

      Object.defineProperty(input(), "showPicker", {
        configurable: true,
        value: () => {
          throw new DOMException("already open", "InvalidStateError");
        },
      });
      expect(() => fireEvent.click(input())).not.toThrow();
    });

    it("a picker choice made after typing commits immediately again", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="" onCommit={onCommit} />);
      Object.defineProperty(input(), "showPicker", { configurable: true, value: vi.fn() });

      typeSegment("2", "0002-01-15");
      fireEvent.click(input());
      fireEvent.change(input(), { target: { value: "2026-08-15" } });

      expect(onCommit).toHaveBeenCalledWith("2026-08-15");
    });
  });

  describe("an unusable stored value (legacy year-0002 row)", () => {
    it("says the saved date is invalid instead of showing it as unset, and offers Kosongkan", () => {
      render(<DateField {...baseProps} value="" invalidStored onCommit={async () => ({ ok: true })} />);

      expect(screen.getByText("Tanggal tidak valid")).toBeDefined();
      expect(screen.queryByText("Belum ditentukan")).toBeNull();
      expect(screen.getByText("Tanggal jatuh tempo yang tersimpan tidak valid.")).toBeDefined();
      expect(input().getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByRole("button", { name: "Kosongkan" })).toBeDefined();
    });

    it("sends null when Kosongkan is clicked, even though the field's value is empty", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="" invalidStored onCommit={onCommit} />);

      fireEvent.click(screen.getByRole("button", { name: "Kosongkan" }));

      expect(onCommit).toHaveBeenCalledWith(null);
    });

    it("can be corrected with a picker choice", () => {
      const onCommit = vi.fn(async () => ({ ok: true }));
      render(<DateField {...baseProps} value="" invalidStored onCommit={onCommit} />);

      fireEvent.change(input(), { target: { value: "2026-08-15" } });

      expect(onCommit).toHaveBeenCalledWith("2026-08-15");
    });
  });

  it("stacks the date display and Kosongkan button full-width below 360px (T-26)", () => {
    render(<DateField {...baseProps} value="2026-07-24" onCommit={async () => ({ ok: true })} />);

    const row = screen.getByRole("button", { name: "Kosongkan" }).closest("div")!;
    expect(row.className).toMatch(/flex-col/);
    expect(row.className).toMatch(/min-\[360px\]:flex-row/);
  });
});
