"use client";

import { useLanguage } from "@/components/language-switcher";
import type { InvoiceRecord } from "@/lib/invoices";
import { summarizeMonthlyIncome, getJakartaMonthBounds } from "@/lib/income-summary";
import { MoneyDisplay } from "@/components/design-system";

type MonthlyIncomeSummaryProps = {
  invoices: InvoiceRecord[] | null;
  now: Date;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

function paidThisMonthCount(invoices: InvoiceRecord[], now: Date): number {
  const bounds = getJakartaMonthBounds(now);
  return invoices.filter(
    (invoice) => invoice.status === "PAID" && invoice.createdAt >= bounds.start && invoice.createdAt < bounds.end,
  ).length;
}

export function MonthlyIncomeSummary({ invoices, now, loading = false, error = false, onRetry }: MonthlyIncomeSummaryProps) {
  const { language, t } = useLanguage();

  return (
    <section aria-labelledby="home-net-bulan-ini" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-net-bulan-ini" className="text-[16px] font-semibold text-ink">{t("home.netThisMonth")}</h2>
      </div>

      {loading ? (
        <div data-testid="home-income-skeleton" className="h-24 animate-pulse rounded-2xl bg-line/40" aria-hidden="true" />
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
      ) : (
        (() => {
          const summary = summarizeMonthlyIncome(invoices ?? [], now);
          const paidCount = paidThisMonthCount(invoices ?? [], now);
          return (
            <div className="flex min-h-24 flex-col gap-1 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <MoneyDisplay value={summary.netIdr} language={language} tone="primary" size="hero" />
              <p className="text-[13px] text-muted">
                {summary.label} · {t("home.paidCount", { count: String(paidCount) })}
              </p>
            </div>
          );
        })()
      )}
    </section>
  );
}
