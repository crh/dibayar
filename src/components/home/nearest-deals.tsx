"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-switcher";
import type { DealRecord } from "@/lib/deals";
import { StatusChip } from "@/components/design-system";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { isOverdueByDueDate, daysUntilDue } from "@/lib/invoice-date-status";

const FINAL_STAGE: DealRecord["status"] = "DIBAYAR";

function selectNearestDeals(deals: DealRecord[]): DealRecord[] {
  return deals
    .filter((deal) => deal.status !== FINAL_STAGE)
    .slice()
    .sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    })
    .slice(0, 3);
}

type NearestDealsProps = {
  deals: DealRecord[] | null;
  now: Date;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

export function NearestDeals({ deals, now, loading = false, error = false, onRetry }: NearestDealsProps) {
  const { language, t } = useLanguage();
  const nearest = deals ? selectNearestDeals(deals) : [];

  return (
    <section aria-labelledby="home-deal-terdekat" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-deal-terdekat" className="text-[16px] font-semibold text-ink">{t("home.nearestDeals")}</h2>
        {!loading && !error ? (
          <Link href="/deal" className="ds-tap-target inline-flex h-11 items-center text-[13px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {t("action.seeAll")}
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} data-testid="home-nearest-deals-skeleton" className="h-16 animate-pulse rounded-xl bg-line/40" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[13px] text-overdue">{t("home.loadError")}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("action.retry")}
          </button>
        </div>
      ) : nearest.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-4 text-[13px] text-muted">
          {t("home.nearestDealsEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {nearest.map((deal) => {
            const overdue = isOverdueByDueDate(deal.deadline, now);
            return (
              <li key={deal.id}>
                <Link
                  href={`/deal/${deal.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">{deal.brand}</p>
                    <p className={`mt-0.5 text-[13px] ${overdue ? "font-semibold text-overdue" : "text-muted"}`}>
                      {deal.deadline
                        ? overdue
                          ? t("home.overdueBy", { days: String(Math.abs(daysUntilDue(deal.deadline, now))) })
                          : formatDate(deal.deadline)
                        : t("invoice.notSet")}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <p className="text-[15px] font-bold tabular-nums text-ink">{formatMoney(deal.feeIdr)}</p>
                    <StatusChip status={deal.status} language={language} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
