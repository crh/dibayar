import { afterEach, describe, expect, it, vi } from "vitest";
import { openWhatsAppPopup } from "./whatsapp-popup";

function fakeTab() {
  const tab = {
    opener: window as Window | null,
    closed: false,
    document: document.implementation.createHTMLDocument(""),
    close: vi.fn(() => {
      tab.closed = true;
    }),
  };
  return tab;
}

const HREF = "https://wa.me/6281234567890?text=Halo";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openWhatsAppPopup", () => {
  it("returns null, so callers show the fallback, when the browser blocks the tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    expect(openWhatsAppPopup("Membuka WhatsApp…")).toBeNull();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("opens a blank tab without noopener (so the handle is real) and cuts opener before anything else", () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockImplementation(() => tab as unknown as Window);

    const popup = openWhatsAppPopup("Membuka WhatsApp…");

    expect(popup).not.toBeNull();
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    expect(tab.document.title).toBe("Membuka WhatsApp…");
    expect(tab.document.body.textContent).toBe("Membuka WhatsApp…");
    // Nothing is navigated until the caller knows the URL.
    expect(tab.document.querySelector("a")).toBeNull();
  });

  it("navigates through a no-referrer link inside the tab's own document", () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockImplementation(() => tab as unknown as Window);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

    expect(openWhatsAppPopup("…")!.navigate(HREF)).toBe(true);

    const link = tab.document.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(HREF);
    expect(link.rel).toBe("noreferrer");
    expect(link.referrerPolicy).toBe("no-referrer");
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.contexts[0]).toBe(link);
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("reports failure without navigating when the person already closed the tab", () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockImplementation(() => tab as unknown as Window);
    const popup = openWhatsAppPopup("…")!;
    tab.closed = true;

    expect(popup.navigate(HREF)).toBe(false);
    expect(tab.document.querySelector("a")).toBeNull();
  });

  it("closes the tab and reports failure when its document can't be reached", () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockImplementation(() => tab as unknown as Window);
    const popup = openWhatsAppPopup("…")!;
    Object.defineProperty(tab, "document", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });

    expect(popup.navigate(HREF)).toBe(false);
    expect(tab.close).toHaveBeenCalledTimes(1);
  });

  it("close() closes an open tab once and ignores one that is already closed", () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockImplementation(() => tab as unknown as Window);
    const popup = openWhatsAppPopup("…")!;

    popup.close();
    popup.close();
    expect(tab.close).toHaveBeenCalledTimes(1);
  });
});
