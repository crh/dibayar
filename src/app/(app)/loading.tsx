import { Grid } from "@/components/layout/grid";
import { MonthlyIncomeSummary } from "@/components/home/monthly-income";
import { FollowUpQueue } from "@/components/home/follow-up-queue";
import { NearestDeals } from "@/components/home/nearest-deals";

// Matches BerandaClient's grid exactly so nothing shifts once real data
// replaces this skeleton (see dibayar-implementation-spec.md §3.1 Loading).
export default function BerandaLoading() {
  const now = new Date();

  return (
    <main className="mx-auto w-full px-4 py-6 min-[640px]:max-w-[720px] min-[640px]:px-6 min-[640px]:py-8 min-[1024px]:max-w-[1120px] min-[1024px]:px-8 min-[1440px]:max-w-[1280px]">
      <Grid className="gap-6">
        <div className="flex flex-col gap-6 min-[1024px]:col-start-1 min-[1024px]:col-span-8 min-[1024px]:row-start-1">
          <MonthlyIncomeSummary invoices={null} now={now} loading />
        </div>

        <div className="min-[1024px]:col-start-9 min-[1024px]:col-span-4 min-[1024px]:row-start-1 min-[1024px]:row-span-2 min-[1024px]:self-start min-[1024px]:sticky min-[1024px]:top-[88px]">
          <FollowUpQueue invoices={null} deals={null} now={now} loading />
        </div>

        <div className="flex flex-col gap-6 min-[1024px]:col-start-1 min-[1024px]:col-span-8 min-[1024px]:row-start-2">
          <NearestDeals deals={null} loading />
        </div>
      </Grid>
    </main>
  );
}
