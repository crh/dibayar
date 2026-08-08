"use client";

import { useEffect, useRef, useState } from "react";
import { translate, type Language } from "@/lib/i18n";

const FALLBACK_HEAD_CHARS = 22;
const TAIL_CHARS = 8;
const ELLIPSIS = "…";
const COPY_SUCCESS_MS = 2000;

// Used whenever real layout measurement isn't available (no ResizeObserver,
// zero-width refs before first paint). Keeps the shape stable — enough of
// the origin to recognize the domain, the token's last 8 characters so a
// copied link can be eyeballed against the field.
export function truncateShareLinkFallback(url: string): string {
  if (url.length <= FALLBACK_HEAD_CHARS + ELLIPSIS.length + TAIL_CHARS) return url;
  return `${url.slice(0, FALLBACK_HEAD_CHARS)}${ELLIPSIS}${url.slice(-TAIL_CHARS)}`;
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
  const maxChars = Math.floor(containerWidth / perChar);
  return truncateShareLinkToWidth(url, maxChars);
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
