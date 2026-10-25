// WhatsApp hand-off in a new tab, with real popup-blocker detection (FIND-04).
//
// window.open(href, "_blank", "noopener,noreferrer") returns null by spec
// whenever "noopener" is set -- even when the tab opened -- so its return
// value can't tell a blocked popup from an opened one. Instead the tab is
// opened blank, synchronously inside the click/tap (before any await, so it
// still counts as a user gesture in every engine, including WebKit), and:
//
// - null from window.open is then a real block: callers show a fallback link;
// - otherwise opener is cut immediately, before the tab ever leaves
//   about:blank, so WhatsApp gets window.opener === null exactly as with
//   "noopener";
// - once the WhatsApp URL is known, the tab is navigated by a rel=noreferrer
//   link inside its own document, so no Referer is sent (as with
//   "noreferrer"). Navigating with popup.location would send this page's
//   origin as the Referer under strict-origin-when-cross-origin.
//
// Callers must close() the tab on every path that doesn't hand it a URL, so a
// failed share/save never leaves an empty tab behind.
export type WhatsAppPopup = {
  // Sends the open tab to href. False when that wasn't possible (the person
  // already closed the tab, or its document was unreachable); the tab is then
  // closed and the caller should show the fallback link instead.
  navigate(href: string): boolean;
  close(): void;
};

export function openWhatsAppPopup(loadingText: string): WhatsAppPopup | null {
  const popup = window.open("", "_blank");
  if (!popup) return null;
  popup.opener = null;

  try {
    popup.document.title = loadingText;
    popup.document.body.textContent = loadingText;
  } catch {
    // Cosmetic only: navigate() reports whether the hand-off itself worked.
  }

  return {
    navigate(href) {
      if (popup.closed) return false;
      try {
        const link = popup.document.createElement("a");
        link.href = href;
        link.rel = "noreferrer";
        link.referrerPolicy = "no-referrer";
        popup.document.body.append(link);
        link.click();
        return true;
      } catch {
        popup.close();
        return false;
      }
    },
    close() {
      if (!popup.closed) popup.close();
    },
  };
}
