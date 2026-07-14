import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listDeals, type DealDb } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import DashboardClient from "../dashboard-client";

export const dynamic = "force-dynamic";

const db = prisma as unknown as DealDb;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdashboard");
  }

  const deals = await listDeals(db, session.user.id);
  return <DashboardClient initialDeals={deals} userName={session.user.name} />;
}
