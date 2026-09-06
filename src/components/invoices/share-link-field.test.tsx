import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SAFE_MAX_CHARS,
  ShareLinkField,
  truncateShareLinkFallback,
  truncateShareLinkToWidth,
} from "./share-link-field";

const LONG_URL = "https://dibayar.app/i/deterministic-share-token-abcdef123456";

type ObserveCall = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: ObserveCall;
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ObserveCall) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

// Simulates a monospace font: every character (including any ellipsis
// already baked into the mirror's current textContent) advances by
// `charWidth`, plus `ellipsisExtraWidth` for each ellipsis glyph -- modeling
// browsers where "…" renders wider than a single monospace cell. The mirror
// width is derived from its live textContent (not a fixed constant) since
// measureDisplay re-measures it after each shrink attempt.
function stubWidths(containerWidth: number, charWidth: number, ellipsisExtraWidth = 0) {
  const track = screen.getByTestId("share-link-track");
  const mirror = screen.getByTestId("share-link-mirror");
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue({ width: containerWidth } as DOMRect);
  vi.spyOn(mirror, "getBoundingClientRect").mockImplementation(() => {
    const text = mirror.textContent ?? "";
    const ellipsisCount = (text.match(/…/g) ?? []).length;
    return { width: text.length * charWidth + ellipsisCount * ellipsisExtraWidth } as DOMRect;
  });
}

describe("truncateShareLinkFallback", () => {
  it("keeps short URLs untouched", () => {
    expect(truncateShareLinkFallback("https://a.io")).toBe("https://a.io");
  });

  it("keeps the first 6 characters and the final 8, joined by an ellipsis, for long URLs -- exactly SAFE_MAX_CHARS long", () => {
    const result = truncateShareLinkFallback(LONG_URL);
    expect(result).toHaveLength(SAFE_MAX_CHARS);
    expect(result).toBe(`${LONG_URL.slice(0, 6)}…${LONG_URL.slice(-8)}`);
  });
});

describe("truncateShareLinkToWidth", () => {
  it("returns the full URL when it already fits the budget", () => {
    expect(truncateShareLinkToWidth("https://short.link", 40)).toBe("https://short.link");
  });

  it("middle-truncates to the exact character budget, preserving the final 8 characters", () => {
    const result = truncateShareLinkToWidth(LONG_URL, 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith(LONG_URL.slice(-8))).toBe(true);
    expect(result.startsWith(LONG_URL.slice(0, 11))).toBe(true);
  });

  it("degrades gracefully instead of producing negative-length slices at very narrow budgets", () => {
    expect(truncateShareLinkToWidth(LONG_URL, 4)).toBe(`…${LONG_URL.slice(-3)}`);
    expect(truncateShareLinkToWidth(LONG_URL, 0)).toBe("");
  });
});

describe("ShareLinkField", () => {
  const originalResizeObserver = global.ResizeObserver;

  beforeEach(() => {
    FakeResizeObserver.instances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    global.ResizeObserver = originalResizeObserver;
  });

  it("falls back to the head/tail truncation when ResizeObserver is unavailable", () => {
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;

    render(<ShareLinkField url={LONG_URL} language="id" />);

    expect(screen.getByText(truncateShareLinkFallback(LONG_URL))).toBeDefined();
  });

  it("measures the track and mirror widths via ResizeObserver and renders the resulting middle-truncated text without wrapping", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver as unknown as typeof ResizeObserver);

    render(<ShareLinkField url={LONG_URL} language="id" />);
    stubWidths(200, 10);

    await act(async () => {
      FakeResizeObserver.instances[0]?.trigger();
    });

    const expectedMaxChars = Math.min(Math.floor(200 / 10), SAFE_MAX_CHARS);
    const expected = truncateShareLinkToWidth(LONG_URL, expectedMaxChars);

    const displayed = screen.getByTitle(LONG_URL);
    expect(displayed.textContent).toBe(expected);
    expect(displayed.className).toMatch(/overflow-hidden/);
    expect(displayed.className).toMatch(/whitespace-nowrap/);
    expect(displayed.className).toMatch(/min-w-0/);
  });

  it("shrinks further than the naive per-character estimate when the truncated candidate's ellipsis renders wider than an average character, so the displayed text never overflows its track", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver as unknown as typeof ResizeObserver);

    render(<ShareLinkField url={LONG_URL} language="id" />);
    const charWidth = 8;
    // Kept below SAFE_MAX_CHARS's own pixel budget (charWidth * SAFE_MAX_CHARS)
    // so this exercises the ellipsis-overflow shrink loop itself, not the
    // separate SAFE_MAX_CHARS clamp covered by the dedicated test below.
    const containerWidth = 100;
    const ellipsisExtraWidth = 5;
    stubWidths(containerWidth, charWidth, ellipsisExtraWidth);

    await act(async () => {
      FakeResizeObserver.instances[0]?.trigger();
    });

    const naiveMaxChars = Math.floor(containerWidth / charWidth);
    const naiveCandidate = truncateShareLinkToWidth(LONG_URL, naiveMaxChars);
    const naiveWidth = naiveCandidate.length * charWidth + ellipsisExtraWidth;
    // Confirms this scenario actually exercises the correction loop: the
    // naive per-character estimate alone would overflow once its ellipsis's
    // extra width is counted.
    expect(naiveWidth).toBeGreaterThan(containerWidth);

    const displayed = screen.getByTitle(LONG_URL);
    const displayedText = displayed.textContent ?? "";
    expect(displayedText).not.toBe(naiveCandidate);
    expect(displayedText.length).toBeLessThan(naiveCandidate.length);

    const finalWidth = displayedText.length * charWidth + ellipsisExtraWidth;
    expect(finalWidth).toBeLessThanOrEqual(containerWidth);
  });

  it("recomputes the truncated text when ResizeObserver reports a new width", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver as unknown as typeof ResizeObserver);

    render(<ShareLinkField url={LONG_URL} language="id" />);
    stubWidths(200, 10);
    await act(async () => {
      FakeResizeObserver.instances[0]?.trigger();
    });
    const wide = screen.getByTitle(LONG_URL).textContent;

    stubWidths(80, 10);
    await act(async () => {
      FakeResizeObserver.instances[0]?.trigger();
    });
    const narrow = screen.getByTitle(LONG_URL).textContent;

    expect(narrow).not.toBe(wide);
    expect((narrow ?? "").length).toBeLessThan((wide ?? "").length);
  });

  it("computes a display at a wide (e.g. xl1440) width that can never exceed SAFE_MAX_CHARS, so it remains safe if the track narrows to the lg1024 minimum before ResizeObserver's async callback fires", async () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver as unknown as typeof ResizeObserver);

    render(<ShareLinkField url={LONG_URL} language="id" />);
    // A generously wide track -- the naive per-character estimate here
    // (1000 / 8 = 125 chars) would badly overflow the real lg1024 track if
    // it weren't clamped.
    const charWidth = 8;
    stubWidths(1000, charWidth);

    await act(async () => {
      FakeResizeObserver.instances[0]?.trigger();
    });

    const wideDisplay = screen.getByTitle(LONG_URL).textContent ?? "";
    expect(wideDisplay.length).toBeLessThanOrEqual(SAFE_MAX_CHARS);

    // The real, verified narrowest required track: lg1024's client width
    // (122px) at this field's font-mono text-[13px]. Because `display` is
    // already capped to SAFE_MAX_CHARS regardless of how wide the track was
    // when it was computed, it fits here too -- without needing the
    // ResizeObserver to have fired again for this width yet.
    const LG1024_TRACK_WIDTH_PX = 122;
    expect(wideDisplay.length * charWidth).toBeLessThanOrEqual(LG1024_TRACK_WIDTH_PX);
  });

  it("always keeps the full URL in the title attribute regardless of the truncated display text", () => {
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;
    render(<ShareLinkField url={LONG_URL} language="id" />);

    expect(screen.getByTitle(LONG_URL)).toBeDefined();
  });

  it("copies the full URL to the clipboard, not the truncated display text", async () => {
    const user = userEvent.setup();
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<ShareLinkField url={LONG_URL} language="id" />);
    await user.click(screen.getByRole("button", { name: "Salin tautan invoice" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(LONG_URL);
  });

  it("shows the copied label after a successful copy, then reverts after 2 seconds", async () => {
    vi.useFakeTimers();
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<ShareLinkField url={LONG_URL} language="id" />);
    const button = screen.getByRole("button", { name: "Salin tautan invoice" });

    // fireEvent + advanceTimersByTimeAsync (rather than userEvent.click,
    // whose internal pointer-event delays don't reliably resolve under full
    // fake timers) flushes the mocked clipboard promise deterministically.
    await act(async () => {
      fireEvent.click(button);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(button.textContent).toBe("Tersalin");
    expect(button.getAttribute("aria-label")).toBe("Salin tautan invoice");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(button.textContent).toBe("Salin");
  });

  it("shows the exact Bahasa failure message, keeps the clipped display element as the scrollWidth-measured node, and adds a separate visible control for manually selecting the full URL when copying fails", async () => {
    const user = userEvent.setup();
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    render(<ShareLinkField url={LONG_URL} language="id" />);
    await user.click(screen.getByRole("button", { name: "Salin tautan invoice" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Gagal menyalin. Tekan lama untuk salin manual.",
    );

    // The element carrying the full URL as its `title` is what the browser
    // acceptance script measures for scrollWidth<=clientWidth. In real
    // Chromium, ANY element whose own rendered content is the full,
    // un-truncated URL reports scrollWidth > clientWidth once it overflows
    // its box — regardless of tag (span/div/input) or CSS (overflow-hidden,
    // text-overflow: ellipsis) — because scrollWidth measures true content
    // extent, not visual clipping. So this node must stay the same
    // already-truncated display used in every other state, not swap to a
    // raw-value input.
    const display = screen.getByTitle(LONG_URL);
    expect(display.tagName).toBe("SPAN");
    expect(display.className).toMatch(/overflow-hidden/);
    expect(display.className).toMatch(/whitespace-nowrap/);
    expect(display.scrollWidth).toBeLessThanOrEqual(display.clientWidth);

    // A separate, visible, native input carries the full URL so the user
    // can still manually select/copy it ("Tekan lama untuk salin manual"),
    // without that selection control being the element the acceptance
    // check measures.
    const manualCopyInput = screen.getByTestId("share-link-manual-copy") as HTMLInputElement;
    expect(manualCopyInput.tagName).toBe("INPUT");
    expect(manualCopyInput.value).toBe(LONG_URL);
    expect(manualCopyInput.readOnly).toBe(true);
    expect(manualCopyInput.className).toMatch(/select-all/);
    expect(manualCopyInput).not.toBe(display);

    // The manual-copy input must live inside the existing 44px field/track
    // (not below it as a second row), so the failure state never grows the
    // field past its fixed single-row height.
    expect(manualCopyInput.closest('[data-testid="share-link-track"]')).not.toBeNull();
    const field = screen.getByTestId("share-link-track").closest(".rounded-\\[8px\\]") as HTMLElement;
    expect(field.className).toMatch(/h-11/);
    expect(field.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });

  it("uses Indonesian copy labels and aria-label in Indonesian", () => {
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;
    render(<ShareLinkField url={LONG_URL} language="id" />);

    const button = screen.getByRole("button", { name: "Salin tautan invoice" });
    expect(button.textContent).toBe("Salin");
  });

  it("uses English copy labels and aria-label in English", () => {
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;
    render(<ShareLinkField url={LONG_URL} language="en" />);

    const button = screen.getByRole("button", { name: "Copy invoice link" });
    expect(button.textContent).toBe("Copy");
  });

  it("shows the English failure message when copying fails in English", async () => {
    const user = userEvent.setup();
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    render(<ShareLinkField url={LONG_URL} language="en" />);
    await user.click(screen.getByRole("button", { name: "Copy invoice link" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Couldn't copy. Long-press to copy manually.",
    );
  });

  it("keeps the copy button at a touch target of at least 44px and the field a single fixed 44px row", () => {
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete global.ResizeObserver;
    render(<ShareLinkField url={LONG_URL} language="id" />);

    const button = screen.getByRole("button", { name: "Salin tautan invoice" });
    expect(button.className).toMatch(/h-11/);
    expect(button.className).toMatch(/min-w-11/);
    expect(button.closest(".rounded-\\[8px\\]")?.className).toMatch(/h-11/);
  });
});
