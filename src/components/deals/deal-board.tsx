import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import type { Language } from "@/lib/i18n";
import { DealCard } from "./deal-card";
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
}) {
  return (
    <section aria-labelledby={`stage-${stage.value}`} className={`rounded-md border border-line bg-surface p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id={`stage-${stage.value}`} className="text-[15px] font-bold text-ink">{t(PIPELINE_STAGE_KEYS[stage.value])}</h3>
        <span className="rounded-full bg-bg px-2 py-1 text-[12px] font-semibold text-muted">{stageDeals.length}</span>
      </div>
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
    <div data-testid="deal-board-rail" className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
      {visibleStages.map((stage) => {
        const stageDeals = deals.filter((deal) => deal.status === stage.value);
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
            className={
              stageFilter
                ? "w-full"
                : `lg:w-[calc(16.6667%-10px)] lg:max-w-none ${stageDeals.length ? "w-full" : "hidden lg:block"}`
            }
          />
        );
      })}
    </div>
  );
}
