"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement) {
  return container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
}

export function AddDealDialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Capture the trigger so focus can return to it on close, and move focus
  // into the dialog so keyboard/screen-reader users land inside it rather
  // than on the now-hidden trigger.
  //
  // Unless focus is already inside it. A dialog the server rendered open
  // (/deal?tambah=1) can be in use before this effect first runs: someone
  // typing in a field would have the keyboard moved to the close button in
  // the middle of a word, where the next space or Enter closes the dialog and
  // discards what they typed (FIND-13).
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const [firstFocusable] = getFocusableElements(panel);
      firstFocusable?.focus();
    }
    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;

        const focusableElements = getFocusableElements(panel);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface p-5 min-[640px]:inset-auto min-[640px]:left-1/2 min-[640px]:top-1/2 min-[640px]:h-auto min-[640px]:max-h-[85vh] min-[640px]:w-[min(560px,calc(100vw-32px))] min-[640px]:-translate-x-1/2 min-[640px]:-translate-y-1/2 min-[640px]:rounded-lg min-[640px]:border min-[640px]:border-line min-[640px]:shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="ds-h2 text-ink">{title}</h2>
            {description ? <p className="mt-1 ds-small text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] text-ink outline-none hover:bg-bg focus-visible:ring-2 focus-visible:ring-primary"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
