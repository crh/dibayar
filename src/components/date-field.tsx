"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatDate, isValidDateOnlyString } from "@/lib/format/date";
import { checkDueDateInput } from "@/lib/due-date";

const SAVED_DISPLAY_MS = 2000;

export type DateFieldCommitResult = { ok: boolean };

// Keys that edit a native date input's segments in place. A change event that
// follows one of these is in-progress typing, never a finished choice: a
// native date input emits a complete-looking value on every intermediate
// year digit ("0002-01-15", "0020-01-15", ... "2030-01-15"), so committing
// each change saved year 0002 (FIND-03).
function isSegmentEditKey(key: string): boolean {
  return /^\d$/.test(key) || key === "ArrowUp" || key === "ArrowDown" || key === "Backspace" || key === "Delete";
}

// Formatted display + hidden native <input type="date"> picker (see
// dibayar-implementation-spec.md T-20): the field always shows the app's own
// "24 Jul 2026" format, never the browser's own date-input rendering, while
// a real native <input> on top still supplies the picker and keyboard /
// screen-reader semantics.
//
// `value` is the last-persisted yyyy-mm-dd (or ""). `draft` is what the native
// input currently holds. They differ only while someone is typing: a picker
// choice (or the native clear) commits at once, whereas keyboard segment edits
// commit only on an intentional completion -- Enter or leaving the field --
// and only when the draft is a complete date inside [min, max]. Escape drops
// an uncommitted keyboard draft. Commits are serialized: one request in
// flight at a time, and only the newest pending intent is sent after it.
export function DateField({
  id,
  label,
  value,
  lang,
  min,
  max,
  emptyLabel,
  clearLabel,
  savingLabel,
  savedLabel,
  errorLabel,
  invalidInputLabel,
  invalidStored = false,
  invalidStoredLabel,
  invalidStoredHint,
  disabled = false,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  lang: string;
  min: string;
  max: string;
  emptyLabel: string;
  clearLabel: string;
  savingLabel: string;
  savedLabel: string;
  errorLabel: string;
  // Shown (never saved) when a typed date is incomplete or outside [min, max].
  invalidInputLabel: string;
  // The persisted value exists but is unusable (e.g. a legacy year-0002 row):
  // `value` is "" and the field says so instead of pretending it's unset.
  invalidStored?: boolean;
  invalidStoredLabel: string;
  invalidStoredHint: string;
  disabled?: boolean;
  onCommit: (nextValue: string | null) => Promise<DateFieldCommitResult>;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draft, setDraft] = useState(value);
  const [isDirty, setIsDirty] = useState(false);
  const [hasInvalidInput, setHasInvalidInput] = useState(false);
  // Adopt a newly persisted value (a save resolving, or a parent refresh)
  // unless the person is mid-way through typing a different one -- set during
  // render rather than in an effect, so the input never flashes stale.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (!isDirty) setDraft(value);
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef(false);
  const inFlightRef = useRef(false);
  const queuedRef = useRef<{ next: string | null } | null>(null);
  // The value most recently sent or queued while a request is in flight, so a
  // repeated intent (Enter then blur, two identical picks) isn't sent twice.
  const requestedRef = useRef<string | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  async function commit(next: string | null) {
    if (inFlightRef.current) {
      if (next === requestedRef.current) return;
      requestedRef.current = next;
      queuedRef.current = { next };
      return;
    }
    // Already persisted (e.g. blur right after a picker commit landed) --
    // unless the persisted value is an unusable legacy one being replaced.
    if (next === (value || null) && !invalidStored) return;
    requestedRef.current = next;
    inFlightRef.current = true;
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    setStatus("saving");
    let pending: string | null = next;
    let ok = false;
    for (;;) {
      ok = (await onCommit(pending)).ok;
      const queued = queuedRef.current;
      queuedRef.current = null;
      if (!queued) break;
      pending = queued.next;
    }
    inFlightRef.current = false;
    if (ok) {
      setStatus("saved");
      savedTimeoutRef.current = setTimeout(() => setStatus("idle"), SAVED_DISPLAY_MS);
    } else {
      setStatus("error");
    }
  }

  // The single intentional-completion path for keyboard edits.
  function finishTyping() {
    typingRef.current = false;
    const input = inputRef.current;
    if (!input || !isDirty) return;
    const current = input.value;
    if (current === "") {
      // A fully emptied input is a deliberate clear; a partly filled one
      // (validity.badInput) is not, and is never sent.
      if (input.validity.badInput) {
        setHasInvalidInput(true);
        return;
      }
      setIsDirty(false);
      setHasInvalidInput(false);
      void commit(null);
      return;
    }
    const check = checkDueDateInput(current);
    if (check.kind !== "valid" || current < min || current > max) {
      setHasInvalidInput(true);
      return;
    }
    setIsDirty(false);
    setHasInvalidInput(false);
    void commit(current);
  }

  function handleChange(next: string) {
    setDraft(next);
    if (typingRef.current) {
      setIsDirty(true);
      setHasInvalidInput(false);
      return;
    }
    // Not preceded by a segment-edit key: a picker choice or the native
    // clear. Commit at once if it's a usable value.
    if (next === "" || (checkDueDateInput(next).kind === "valid" && next >= min && next <= max)) {
      setIsDirty(false);
      setHasInvalidInput(false);
      void commit(next || null);
    } else {
      setIsDirty(true);
      setHasInvalidInput(true);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isSegmentEditKey(event.key)) {
      typingRef.current = true;
    } else if (event.key === "Enter") {
      event.preventDefault();
      finishTyping();
    } else if (event.key === "Escape" && isDirty) {
      typingRef.current = false;
      setDraft(value);
      setIsDirty(false);
      setHasInvalidInput(false);
    }
  }

  // FIND-02: the input covers the whole visible field, but Chromium only
  // opens its picker from the (invisible) calendar-icon edge. A click or tap
  // anywhere on the field is a real user gesture, so ask for the picker
  // explicitly. showPicker() is feature-detected and may still throw (e.g.
  // picker already open, or an engine that refuses it); the input then keeps
  // its native click behavior and stays keyboard-editable.
  function handleClick() {
    typingRef.current = false;
    const input = inputRef.current;
    if (!input || typeof input.showPicker !== "function") return;
    try {
      input.showPicker();
    } catch {
      // Native behavior is the fallback.
    }
  }

  const isBusy = status === "saving";
  const showInvalidStored = invalidStored && !isDirty && draft === "";
  const displayText = draft && isValidDateOnlyString(draft)
    ? formatDate(draft)
    : showInvalidStored
      ? invalidStoredLabel
      : emptyLabel;
  const hintId = `${id}-hint`;
  const hint = hasInvalidInput ? invalidInputLabel : showInvalidStored ? invalidStoredHint : null;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center">
        <div className="relative inline-flex h-11 w-full min-w-[160px] items-center min-[360px]:w-auto">
          {/* The real control: kept in the DOM and focusable so it receives
              the click/tap and keyboard/AT users get normal input semantics,
              but visually invisible so its own locale-dependent rendering is
              never shown on the page. It stays enabled while saving so a
              keyboard user never loses focus mid-edit. */}
          <input
            ref={inputRef}
            id={id}
            name={id}
            type="date"
            lang={lang}
            min={min}
            max={max}
            value={draft}
            disabled={disabled}
            aria-busy={isBusy}
            aria-invalid={hasInvalidInput || showInvalidStored}
            aria-describedby={hint ? hintId : undefined}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={finishTyping}
            onClick={handleClick}
            aria-label={label}
            className="peer absolute inset-0 h-11 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-flex h-11 w-full items-center rounded-sm border bg-surface px-3 text-[15px] font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${hasInvalidInput || showInvalidStored ? "border-overdue" : "border-line"} ${draft ? "text-ink" : showInvalidStored ? "text-overdue" : "text-muted"} ${disabled ? "opacity-60" : ""}`}
          >
            {displayText}
          </span>
        </div>
        {value || invalidStored ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsDirty(false);
              setHasInvalidInput(false);
              setDraft("");
              void commit(null);
            }}
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60 min-[360px]:w-auto"
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-[13px] text-overdue">
          {hint}
        </p>
      ) : null}
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
