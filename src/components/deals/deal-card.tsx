"use client";

import { useEffect, useRef, useState } from "react";
import type { DealRecord } from "@/lib/deals";
import type { Language } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";

function formatDeadline(value: Date | null, language: Language) {
  if (!value) return language === "en" ? "No deadline" : "Tanpa tenggat";
  return formatDate(value);
}

export function DealCard({
  deal,
  language,
  t,
  disabled,
  hasInvoice,
  isSaving,
  onStageChange,
  onCreateInvoice,
}: {
  deal: DealRecord;
  language: Language;
  t: (key: string, values?: Record<string, string>) => string;
  disabled: boolean;
  hasInvoice: boolean;
  isSaving: boolean;
  onStageChange: (dealId: string, status: DealRecord["status"]) => void;
  onCreateInvoice: (dealId: string) => void;
}) {
  void onStageChange; // reserved for the T-15 adjacent-stage move menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canCreateInvoice = deal.status === "INVOICE" && !hasInvoice;

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <article className="rounded-xl border border-line bg-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-ink">{deal.brand}</h4>
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup={canCreateInvoice ? "true" : undefined}
            aria-expanded={canCreateInvoice ? menuOpen : undefined}
            aria-label={t("dashboard.dealActions", { brand: deal.brand })}
            disabled={disabled}
            onClick={canCreateInvoice ? () => setMenuOpen((open) => !open) : undefined}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
          >
            <span aria-hidden="true" className="text-[20px] leading-none">
              &#8942;
            </span>
          </button>
          {canCreateInvoice && menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-lg border border-line bg-surface p-1 shadow-md"
            >
              <button
                type="button"
                role="menuitem"
                disabled={isSaving}
                onClick={() => {
                  setMenuOpen(false);
                  onCreateInvoice(deal.id);
                }}
                className="flex h-11 w-full items-center rounded-md px-3 text-left text-[13px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? t("dashboard.saving") : t("dashboard.createInvoice")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-[15px] font-bold tabular-nums text-primary">{formatMoney(deal.feeIdr)}</p>
      <p className="mt-1 text-[12px] text-muted">{formatDeadline(deal.deadline, language)}</p>
    </article>
  );
}
