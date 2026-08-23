import { useState } from "react";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import type { Language } from "@/lib/i18n";
import { DealCard, DEAL_DRAG_MIME } from "./deal-card";
import { PIPELINE_STAGES, PIPELINE_STAGE_KEYS, type StageValue } from "./deal-stages";

function StageColumn({
  stage,
  stageDeals,
  language,
  t,
  pendingDealId,
  isSaving,
  invoices,
  onStageChange,
  onCreateInvoice,
  className = "",
  collapsed = false,
}: {
  stage: (typeof PIPELINE_STAGES)[number];
  stageDeals: DealRecord[];
  language: Language;
  t: (key: string, values?: Record<string, string>) => string;
  pendingDealId: string | null;
  isSaving: boolean;
  invoices: InvoiceRecord[];
  onStageChange: (dealId: string, status: DealRecord["status"]) => void;
  onCreateInvoice: (dealId: string) => void;
  className?: string;
  collapsed?: boolean;
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <section
      aria-labelledby={`stage-${stage.value}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DEAL_DRAG_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes(DEAL_DRAG_MIME)) return;
        setIsDropTarget(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setIsDropTarget(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes(DEAL_DRAG_MIME)) return;
        event.preventDefault();
        setIsDropTarget(false);
        const dealId = event.dataTransfer.getData(DEAL_DRAG_MIME);
        if (dealId) onStageChange(dealId, stage.value);
      }}
      className={`rounded-md border ${collapsed ? "p-2" : "p-4"} ${isDropTarget ? "border-primary bg-primary/5" : "border-line bg-surface"} ${className}`}
    >
      <div
        className={
          collapsed
            ? "flex items-center justify-between gap-2 lg:flex-col lg:items-start lg:gap-1"
            : "mb-3 flex items-center justify-between gap-2"
        }
      >
        <h3
          id={`stage-${stage.value}`}
          className={`font-bold text-ink ${collapsed ? "text-[12px] leading-tight" : "text-[15px]"}`}
        >
          {t(PIPELINE_STAGE_KEYS[stage.value])}
        </h3>
        <span className="rounded-full bg-bg px-2 py-1 text-[12px] font-semibold text-muted">{stageDeals.length}</span>
      </div>
      {collapsed ? null : (
        <div className="flex flex-col gap-2">
          {stageDeals.length ? (
            stageDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                language={language}
                t={t}
                disabled={pendingDealId === deal.id}
                hasInvoice={invoices.some((invoice) => invoice.dealId === deal.id)}
                isSaving={isSaving}
                onStageChange={onStageChange}
                onCreateInvoice={onCreateInvoice}
              />
            ))
          ) : (
            <p className="text-[13px] text-muted">{t("dashboard.noDealsInStage")}</p>
          )}
        </div>
      )}
    </section>
  );
}

export function DealBoard({
  deals,
  invoices,
  language,
  t,
  pendingDealId,
  isSaving,
  stageFilter,
  onStageChange,
  onCreateInvoice,
}: {
  deals: DealRecord[];
  invoices: InvoiceRecord[];
  language: Language;
  t: (key: string, values?: Record<string, string>) => string;
  pendingDealId: string | null;
  isSaving: boolean;
  stageFilter: StageValue | null;
  onStageChange: (dealId: string, status: DealRecord["status"]) => void;
  onCreateInvoice: (dealId: string) => void;
}) {
  const visibleStages = stageFilter ? PIPELINE_STAGES.filter((stage) => stage.value === stageFilter) : PIPELINE_STAGES;

  return (
    <div data-testid="deal-board-rail" className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-start lg:overflow-x-auto lg:pb-2">
      {visibleStages.map((stage) => {
        const stageDeals = deals.filter((deal) => deal.status === stage.value);
        // Empty stages collapse to a compact header-only block (a narrow
        // strip on the desktop rail, a slim full-width row on mobile) on the
        // unfiltered board, so stages that actually have deals get the room
        // and empty ones stay discoverable without needing their own scan
        // space. A single filtered stage is never collapsed, even if empty.
        const collapsed = !stageFilter && stageDeals.length === 0;
        return (
          <StageColumn
            key={stage.value}
            stage={stage}
            stageDeals={stageDeals}
            language={language}
            t={t}
            pendingDealId={pendingDealId}
            isSaving={isSaving}
            invoices={invoices}
            onStageChange={onStageChange}
            onCreateInvoice={onCreateInvoice}
            collapsed={collapsed}
            className={
              stageFilter
                ? "w-full"
                : `w-full ${collapsed ? "lg:w-[72px] lg:shrink-0" : "lg:w-[220px] lg:shrink-0"}`
            }
          />
        );
      })}
    </div>
  );
}
