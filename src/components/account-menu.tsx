"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { getLanguage, translate, type Language } from "@/lib/i18n";

export function AccountMenu({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const initial = translate(language, "language.label").slice(0, 1);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-primary-tint text-[15px] font-bold text-primary-d outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span aria-hidden="true">{initial}</span>
        <span className="sr-only">{translate(language, "account.menu")}</span>
      </button>

      {isOpen ? (
        <>
          <div
            id={menuId}
            role="menu"
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-1 rounded-t-lg border border-line bg-surface p-3 shadow-md lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-[calc(100%+8px)] lg:w-64 lg:rounded-md"
          >
            <div className="flex items-center gap-1 rounded-full border border-line bg-bg p-1">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={language === "id"}
                onClick={() => onChange(getLanguage("id"))}
                className={`h-11 flex-1 rounded-full text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${language === "id" ? "bg-primary text-surface" : "text-ink"}`}
              >
                {translate(language, "language.indonesian")}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={language === "en"}
                onClick={() => onChange(getLanguage("en"))}
                className={`h-11 flex-1 rounded-full text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${language === "en" ? "bg-primary text-surface" : "text-ink"}`}
              >
                {translate(language, "language.english")}
              </button>
            </div>
            <Link
              href="/api/auth/signout?callbackUrl=/"
              role="menuitem"
              className="mt-1 inline-flex h-11 items-center rounded-md px-3 text-[15px] font-semibold text-overdue outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {translate(language, "dashboard.signOut")}
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
