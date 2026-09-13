"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DealRecord } from "@/lib/deals";
import type { Language } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { PIPELINE_STAGES, PIPELINE_STAGE_KEYS } from "./deal-stages";

export const DEAL_DRAG_MIME = "application/x-dibayar-deal-id";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const canCreateInvoice = deal.status === "INVOICE" && !hasInvoice;
  const stageIndex = PIPELINE_STAGES.findIndex((stage) => stage.value === deal.status);
  const previousStage = stageIndex > 0 ? PIPELINE_STAGES[stageIndex - 1] : null;
  const nextStage = stageIndex < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIndex + 1] : null;

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
    <article
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData(DEAL_DRAG_MIME, deal.id);
        event.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`rounded-xl border border-line bg-bg p-3 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-ink">{deal.brand}</h4>
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label={t("dashboard.dealActions", { brand: deal.brand })}
            disabled={disabled}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
          >
            <span aria-hidden="true" className="text-[20px] leading-none">
              &#8942;
            </span>
          </button>
          {menuOpen ? (
            <>
              {/* Dims the board so it's unambiguous which card an open menu
                  belongs to, even when columns stack cards tightly enough
                  for the menu to visually reach the card below (see
                  OBSERVATIONS.md). Mirrors add-deal-dialog.tsx's backdrop
                  contract (fixed, aria-hidden, dismiss-on-click) so it's
                  also recognized as an active-overlay backdrop by the UX
                  audit detectors. */}
              <div
                data-testid="deal-card-menu-backdrop"
                className="fixed inset-0 z-40 bg-black/20"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-line bg-surface p-1 shadow-md"
              >
                {previousStage ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isSaving}
                    onClick={() => {
                      setMenuOpen(false);
                      onStageChange(deal.id, previousStage.value);
                    }}
                    className="flex h-11 w-full items-center rounded-md px-3 text-left text-[13px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
                  >
                    {t("dashboard.moveToPreviousStage", { stage: t(PIPELINE_STAGE_KEYS[previousStage.value]) })}
                  </button>
                ) : null}
                {nextStage ? (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isSaving}
                    onClick={() => {
                      setMenuOpen(false);
                      onStageChange(deal.id, nextStage.value);
                    }}
                    className="flex h-11 w-full items-center rounded-md px-3 text-left text-[13px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
                  >
                    {t("dashboard.moveToNextStage", { stage: t(PIPELINE_STAGE_KEYS[nextStage.value]) })}
                  </button>
                ) : null}
                {canCreateInvoice ? (
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
                ) : null}
                <Link
                  href={`/deal/${deal.id}`}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 w-full items-center rounded-md px-3 text-left text-[13px] font-semibold text-ink"
                >
                  {t("dashboard.viewDetail")}
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-[15px] font-bold tabular-nums text-primary">{formatMoney(deal.feeIdr)}</p>
      <p className="mt-1 text-[12px] text-muted">{formatDeadline(deal.deadline, language)}</p>
    </article>
  );
}
