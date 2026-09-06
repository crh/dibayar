import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Source_Serif_4 } from "next/font/google";
import { getPublicInvoiceDocumentByToken, type PublicInvoiceDocumentLookupDb } from "@/lib/invoice-share";
import { publicInvoicePageRateLimiter } from "@/lib/rate-limit";
import { bestEffortClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";
import { buildInvoiceDocumentModel } from "@/components/documents/invoice-document/model";
import { InvoiceDocumentHtml } from "@/components/documents/invoice-document/html";

const sourceSerif = Source_Serif_4({ subsets: ["latin"], display: "swap", weight: ["500", "600"], variable: "--font-source-serif" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const db = prisma as unknown as PublicInvoiceDocumentLookupDb;

type PublicInvoicePageProps = {
  params: Promise<{ token: string }>;
};

// T-23: server-rendered, single canonical document (T-22) -- no client-side
// re-fetch, so the page has exactly one data-fetch path instead of one for
// the notFound() gate and a second, redundant one in a client component.
export default async function PublicInvoicePage({ params }: PublicInvoicePageProps) {
  const { token } = await params;

  // Keyed by client IP only, never by the bearer token, so a prober can't use
  // rate-limit state to distinguish real tokens from guesses. A denied request
  // uses the same notFound() as an unknown/revoked/malformed token, before any
  // database lookup, so it produces no distinguishable public response.
  const requestHeaders = await headers();
  const pageLimit = publicInvoicePageRateLimiter.check(`page:${bestEffortClientIp(requestHeaders)}`);
  if (!pageLimit.allowed) notFound();

  const lookup = await getPublicInvoiceDocumentByToken(db, token);

  // "invalid" gets the exact same notFound() as the rate-limit branch above
  // and as a malformed token -- deliberately indistinguishable, so probing
  // gains no signal. "expired" is the one case that can only ever be
  // observed by someone who already holds a real, previously valid link, so
  // it gets its own honest, typed state instead.
  if (lookup.kind === "invalid") notFound();

  if (lookup.kind === "expired") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-2 px-5 py-8 text-center">
        <p role="alert" className="text-[17px] font-semibold text-ink">Tautan ini sudah tidak berlaku.</p>
        <p className="text-[14px] text-muted">Hubungi pengirim untuk mendapatkan tautan baru.</p>
      </main>
    );
  }

  const model = buildInvoiceDocumentModel(lookup.input);

  return (
    <main className={`public-invoice ${sourceSerif.variable} mx-auto min-h-dvh w-full px-5 py-8 sm:px-8 print:px-0 print:py-0`}>
      <InvoiceDocumentHtml model={model} />
      <div className="mx-auto mt-6 flex w-full max-w-[720px] justify-center print:hidden">
        <a
          href={`/api/public/invoices/${token}/pdf`}
          className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
        >
          Unduh PDF
        </a>
      </div>
    </main>
  );
}
