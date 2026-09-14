"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-switcher";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { Grid } from "@/components/layout/grid";
import { MonthlyIncomeSummary } from "@/components/home/monthly-income";
import { FollowUpQueue } from "@/components/home/follow-up-queue";
import { NearestDeals } from "@/components/home/nearest-deals";

type BerandaClientProps = {
  deals: DealRecord[] | null;
  dealsError: boolean;
  invoices: InvoiceRecord[] | null;
  invoicesError: boolean;
  // Injectable for deterministic tests; defaults to the real current time.
  now?: Date;
};

export default function BerandaClient({ deals, dealsError, invoices, invoicesError, now }: BerandaClientProps) {
  const { t } = useLanguage();
  const referenceNow = now ?? new Date();
  // A plain reload re-runs the server fetch in page.tsx; no client-side
  // duplicate of listDeals/listInvoices is needed for the retry path.
  const retry = () => window.location.reload();

  if (!dealsError && deals !== null && deals.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center min-[640px]:px-6">
        <h1 className="text-[20px] font-bold text-ink">{t("home.emptyTitle")}</h1>
        <p className="max-w-sm text-[14px] text-muted">{t("home.emptySubtitle")}</p>
        <Link href="/deal" className="ds-button ds-button-primary mt-2 inline-flex items-center justify-center px-5">
          {t("action.newDeal")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full px-4 py-6 min-[640px]:max-w-[720px] min-[640px]:px-6 min-[640px]:py-8 min-[1024px]:max-w-[1120px] min-[1024px]:px-8 min-[1440px]:max-w-[1280px]">
      <Grid className="gap-6">
        <div className="flex flex-col gap-6 min-[1024px]:col-start-1 min-[1024px]:col-span-8 min-[1024px]:row-start-1">
          <MonthlyIncomeSummary invoices={invoices} now={referenceNow} loading={false} error={invoicesError} onRetry={retry} />
        </div>

        <div className="min-[1024px]:col-start-9 min-[1024px]:col-span-4 min-[1024px]:row-start-1 min-[1024px]:row-span-2 min-[1024px]:self-start min-[1024px]:sticky min-[1024px]:top-[88px]">
          <FollowUpQueue
            invoices={invoices}
            deals={deals}
            now={referenceNow}
            loading={false}
            error={invoicesError}
            onRetry={retry}
          />
        </div>

        <div className="flex flex-col gap-6 min-[1024px]:col-start-1 min-[1024px]:col-span-8 min-[1024px]:row-start-2">
          <NearestDeals deals={deals} now={referenceNow} loading={false} error={dealsError} onRetry={retry} />
        </div>
      </Grid>
    </main>
  );
}
