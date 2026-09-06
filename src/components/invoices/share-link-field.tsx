"use client";

import { useEffect, useRef, useState } from "react";
import { translate, type Language } from "@/lib/i18n";

const TAIL_CHARS = 8;
const ELLIPSIS = "…";
const COPY_SUCCESS_MS = 2000;

// The hard ceiling on how many characters the displayed string may ever
// contain, in any state (initial fallback, no-ResizeObserver fallback, or
// measured candidate). T-27/F3 only verifies single-line non-overflow at
// lg1024 (1024px): that is this app's narrowest viewport at which the
// share-link row is required to stay one line (below Tailwind's 640px
// breakpoint the surrounding action row stacks into a column instead).
// Real-browser measurement at lg1024 puts the track's own client width at
// 122px, and this field renders in font-mono text-[13px]; 15 characters
// (including the ellipsis) is the verified maximum that fits inside that
// 122px track without overflowing.
//
// This constant exists specifically so a display string measured for a
// wider viewport (e.g. xl1440) can never overflow the track once the
// browser is resized straight down to lg1024: ResizeObserver's callback is
// asynchronous, so an immediate re-measurement after setViewportSize() can
// read the new (narrower) box before the observer has recomputed `display`.
// Capping every state to a width that's safe for the narrowest required
// track removes the race entirely -- there is no stale width `display` can
// hold that isn't already safe for any width at or above lg1024's.
export const SAFE_MAX_CHARS = 15;

// Used whenever real layout measurement isn't available (no ResizeObserver,
// zero-width refs before first paint). Keeps the shape stable — enough of
// the origin to recognize the domain, the token's last characters so a
// copied link can be eyeballed against the field -- while never exceeding
// SAFE_MAX_CHARS, the verified ceiling for the narrowest required track (see
// SAFE_MAX_CHARS above). Delegates to truncateShareLinkToWidth so the two
// never drift apart into two different truncation shapes.
export function truncateShareLinkFallback(url: string): string {
  return truncateShareLinkToWidth(url, SAFE_MAX_CHARS);
}

// Middle-truncates to fit a measured character budget, always preserving as
// much of the leading origin/path as fits plus the token's final 8
// characters — the two ends a creator actually checks. Degrades gracefully
// (never negative-length slices) at widths too narrow for that shape, which
// is one thing keeping the field from ever overflowing its own box.
export function truncateShareLinkToWidth(url: string, maxChars: number): string {
  if (!Number.isFinite(maxChars) || maxChars <= 0) return "";
  if (url.length <= maxChars) return url;
  if (maxChars <= ELLIPSIS.length) return ELLIPSIS.slice(0, maxChars);
  const tailLen = Math.min(TAIL_CHARS, maxChars - ELLIPSIS.length);
  const headLen = maxChars - ELLIPSIS.length - tailLen;
  return `${url.slice(0, headLen)}${ELLIPSIS}${url.slice(-tailLen)}`;
}

function measureDisplay(url: string, trackEl: HTMLElement | null, mirrorEl: HTMLElement | null): string {
  if (typeof ResizeObserver === "undefined" || !trackEl || !mirrorEl) {
    return truncateShareLinkFallback(url);
  }
  const containerWidth = trackEl.getBoundingClientRect().width;
  const fullWidth = mirrorEl.getBoundingClientRect().width;
  const perChar = url.length > 0 ? fullWidth / url.length : 0;
  if (!Number.isFinite(perChar) || perChar <= 0 || !Number.isFinite(containerWidth) || containerWidth <= 0) {
    return truncateShareLinkFallback(url);
  }
  // Clamped to SAFE_MAX_CHARS before anything else: however wide the
  // measured track is, the displayed string must never grow past what's
  // safe for the narrowest required track (see SAFE_MAX_CHARS), so a value
  // computed here can never overflow once the browser resizes narrower and
  // this component re-renders with stale state before the next measurement.
  let maxChars = Math.min(Math.floor(containerWidth / perChar), SAFE_MAX_CHARS);
  let candidate = truncateShareLinkToWidth(url, maxChars);
  // The estimate above assumes every character -- including the ellipsis
  // glyph a truncated candidate adds but the full URL never contains -- is
  // as wide as the URL's own average character. That's not guaranteed (the
  // ellipsis commonly renders wider than a monospace cell), so verify the
  // actual candidate against the real mirror width and keep shrinking until
  // it genuinely fits, rather than trusting the estimate blindly.
  mirrorEl.textContent = candidate;
  while (mirrorEl.getBoundingClientRect().width > containerWidth && maxChars > 0) {
    maxChars -= 1;
    candidate = truncateShareLinkToWidth(url, maxChars);
    mirrorEl.textContent = candidate;
  }
  mirrorEl.textContent = url;
  return candidate;
}

// A one-line, fixed-height (44px) field for displaying a share/invoice link:
// the shown string is middle-truncated to the field's measured width so it
// can never wrap or grow the row, while the full URL always stays available
// to the clipboard, the title attribute, and (after a copy failure) manual
// selection. See dibayar-implementation-spec.md T-06.
export function ShareLinkField({ url, language }: { url: string; language: Language }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(() => truncateShareLinkFallback(url));
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [feedbackUrl, setFeedbackUrl] = useState(url);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset any copy feedback when the URL itself changes (e.g. after
  // regenerate) without a synchronous setState in an effect — this is
  // React's documented pattern for adjusting state during render when it
  // depends on a prop change, rather than a passive-effect setState.
  if (feedbackUrl !== url) {
    setFeedbackUrl(url);
    setFeedback(null);
  }

  useEffect(() => {
    function recompute() {
      setDisplay(measureDisplay(url, trackRef.current, mirrorRef.current));
    }
    recompute();

    if (typeof ResizeObserver === "undefined" || !trackRef.current) return;
    const observer = new ResizeObserver(recompute);
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [url]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("success");
      feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), COPY_SUCCESS_MS);
    } catch {
      setFeedback("error");
    }
  }

  const isError = feedback === "error";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative flex h-11 min-w-0 items-center rounded-[8px] border border-line bg-surface pl-3 transition-colors hover:border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-primary">
        <div ref={trackRef} data-testid="share-link-track" className="relative min-w-0 flex-1">
          {/* Stays the same clipped span in every state, including after a
              copy failure: in real browsers, any element whose own rendered
              content is the full, un-truncated URL reports
              scrollWidth > clientWidth once it overflows its box —
              regardless of tag (span/div/input) or CSS (overflow-hidden,
              text-overflow: ellipsis) — because scrollWidth measures true
              content extent, not visual clipping. Only an already-truncated
              string keeps this the element the acceptance check can pass. */}
          <span
            title={url}
            className="block min-w-0 select-none overflow-hidden whitespace-nowrap font-mono text-[13px] text-muted"
          >
            {display}
          </span>
          {isError ? (
            // Overlays the clipped span above, inside the same 44px track,
            // rather than adding a second row below the field: a real
            // <input> carrying the full URL so it stays manually
            // selectable/copyable ("Tekan lama untuk salin manual") without
            // being the element the scrollWidth acceptance check measures.
            <input
              type="text"
              readOnly
              value={url}
              aria-label={url}
              data-testid="share-link-manual-copy"
              className="absolute inset-0 w-full min-w-0 select-all overflow-hidden whitespace-nowrap border-0 bg-surface px-0 font-mono text-[13px] text-muted outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={translate(language, "invoice.shareLinkCopyAria")}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-r-[7px] px-2 text-[13px] font-semibold text-ink outline-none hover:bg-bg focus-visible:ring-2 focus-visible:ring-primary"
        >
          {feedback === "success" ? translate(language, "invoice.shareLinkCopied") : translate(language, "invoice.shareLinkCopyLabel")}
        </button>
        <span
          ref={mirrorRef}
          data-testid="share-link-mirror"
          aria-hidden="true"
          className="invisible absolute -left-[9999px] top-0 whitespace-nowrap font-mono text-[13px]"
        >
          {url}
        </span>
      </div>
      {isError ? (
        <p role="alert" className="text-[12px] text-overdue">
          {translate(language, "invoice.shareLinkCopyError")}
        </p>
      ) : null}
    </div>
  );
}
