"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/format/date";

const SAVED_DISPLAY_MS = 2000;

export type DateFieldCommitResult = { ok: boolean };

// Formatted display + hidden native <input type="date"> picker (see
// dibayar-implementation-spec.md T-20): the field always shows the app's own
// "24 Jul 2026" format, never the browser's own date-input rendering, while
// a real native <input> underneath still supplies the tap/click picker and
// keyboard/screen-reader semantics. `value` is the last-committed
// yyyy-mm-dd (or "") -- there is no separate unsaved draft state, since a
// picker change commits immediately.
export function DateField({
  id,
  label,
  value,
  lang,
  emptyLabel,
  clearLabel,
  savingLabel,
  savedLabel,
  errorLabel,
  disabled = false,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  lang: string;
  emptyLabel: string;
  clearLabel: string;
  savingLabel: string;
  savedLabel: string;
  errorLabel: string;
  disabled?: boolean;
  onCommit: (nextValue: string | null) => Promise<DateFieldCommitResult>;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  async function commit(nextValue: string | null) {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    setStatus("saving");
    const result = await onCommit(nextValue);
    if (result.ok) {
      setStatus("saved");
      savedTimeoutRef.current = setTimeout(() => setStatus("idle"), SAVED_DISPLAY_MS);
    } else {
      setStatus("error");
    }
  }

  const isBusy = status === "saving";
  const displayText = value ? formatDate(value) : emptyLabel;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center">
        <div className="relative inline-flex h-11 w-full min-w-[160px] items-center min-[360px]:w-auto">
          {/* The real control: kept in the DOM and focusable so tap (390)
              and click (1440) both open the native picker and keyboard/AT
              users get normal input semantics, but visually invisible so
              its own locale-dependent rendering is never shown on the page. */}
          <input
            id={id}
            name={id}
            type="date"
            lang={lang}
            value={value}
            disabled={disabled || isBusy}
            onChange={(event) => commit(event.target.value || null)}
            aria-label={label}
            className="peer absolute inset-0 h-11 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-flex h-11 w-full items-center rounded-sm border border-line bg-surface px-3 text-[15px] font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${value ? "text-ink" : "text-muted"} ${disabled || isBusy ? "opacity-60" : ""}`}
          >
            {displayText}
          </span>
        </div>
        {value ? (
          <button
            type="button"
            disabled={disabled || isBusy}
            onClick={() => commit(null)}
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60 min-[360px]:w-auto"
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className="min-h-[1em] text-[12px] text-muted">
        {status === "saving" ? savingLabel : status === "saved" ? savedLabel : ""}
      </p>
      {status === "error" ? (
        <p role="alert" className="text-[13px] text-overdue">
          {errorLabel}
        </p>
      ) : null}
    </div>
  );
}
