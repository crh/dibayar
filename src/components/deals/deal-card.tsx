import type { DealRecord } from "@/lib/deals";
import type { Language } from "@/lib/i18n";
import { StatusChip } from "@/components/design-system";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { PIPELINE_STAGES, PIPELINE_STAGE_KEYS } from "./deal-stages";

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
  return (
    <article className="rounded-xl border border-line bg-bg p-3">
      <h4 className="font-semibold text-ink">{deal.brand}</h4>
      <div className="mt-2">
        <StatusChip status={deal.status} language={language} />
      </div>
      <p className="mt-1 text-[15px] font-bold tabular-nums text-primary">{formatMoney(deal.feeIdr)}</p>
      <p className="mt-1 text-[12px] text-muted">{formatDeadline(deal.deadline, language)}</p>
      <label className="sr-only" htmlFor={`stage-select-${deal.id}`}>
        {t("dashboard.stageLabel", { brand: deal.brand })}
      </label>
      <select
        id={`stage-select-${deal.id}`}
        value={deal.status}
        disabled={disabled}
        onChange={(event) => onStageChange(deal.id, event.target.value as DealRecord["status"])}
        className="mt-2 h-11 w-full rounded-lg border border-line bg-surface px-2 text-[13px] font-semibold text-ink outline-none focus:border-primary disabled:cursor-wait disabled:opacity-60"
      >
        {PIPELINE_STAGES.map((option) => (
          <option key={option.value} value={option.value}>
            {t(PIPELINE_STAGE_KEYS[option.value])}
          </option>
        ))}
      </select>
      {deal.status === "INVOICE" && !hasInvoice ? (
        <button
          type="button"
          disabled={isSaving}
          onClick={() => onCreateInvoice(deal.id)}
          className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-3 text-[13px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? t("dashboard.saving") : t("dashboard.createInvoice")}
        </button>
      ) : null}
    </article>
  );
}
