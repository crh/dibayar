import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicInvoiceByToken, type PublicInvoiceLookupDb } from "@/lib/invoice-share";
import { publicInvoicePageRateLimiter } from "@/lib/rate-limit";
import { bestEffortClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";
import PublicInvoiceClient from "./public-invoice-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const db = prisma as unknown as PublicInvoiceLookupDb;

type PublicInvoicePageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicInvoicePage({ params }: PublicInvoicePageProps) {
  const { token } = await params;

  // Keyed by client IP only, never by the bearer token, so a prober can't use
  // rate-limit state to distinguish real tokens from guesses. A denied request
  // uses the same notFound() as an unknown/revoked/malformed token, before any
  // database lookup, so it produces no distinguishable public response.
  const requestHeaders = await headers();
  const pageLimit = publicInvoicePageRateLimiter.check(`page:${bestEffortClientIp(requestHeaders)}`);
  if (!pageLimit.allowed) notFound();

  const invoice = await getPublicInvoiceByToken(db, token);
  if (!invoice) notFound();

  return <PublicInvoiceClient token={token} />;
}
