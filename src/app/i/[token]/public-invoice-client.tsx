"use client";

import { useEffect, useState } from "react";

type PublicInvoiceStatus = "DRAFT" | "SENT" | "DUE" | "OVERDUE" | "PAID";

type PublicInvoiceView = {
  number: string;
  subtotalIdr: number;
  withholdingTaxLabel: string;
  status: PublicInvoiceStatus;
  dueDate: string | null;
  brand: string;
  scope: string;
  issuerName: string | null;
};

type LoadState = "loading" | "ready" | "not-found" | "error";

const STATUS_LABEL: Record<PublicInvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Terkirim",
  DUE: "Jatuh tempo",
  OVERDUE: "Terlambat",
  PAID: "Lunas",
};

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function formatIdr(value: number) {
  return `Rp${idr.format(value)}`;
}

function formatDate(value: string | null) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export default function PublicInvoiceClient({ token, publicFontClass = "" }: { token: string; publicFontClass?: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [invoice, setInvoice] = useState<PublicInvoiceView | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/public/invoices/${token}`);
        if (response.status === 404) {
          if (!cancelled) setState("not-found");
          return;
        }
        if (!response.ok) {
          if (!cancelled) setState("error");
          return;
        }
        const payload = await response.json();
        if (!cancelled) {
          setInvoice(payload.invoice);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-5 py-8 text-center">
        <p role="status" className="text-[15px] text-muted">Memuat invoice…</p>
      </main>
    );
  }

  if (state === "not-found") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-2 px-5 py-8 text-center">
        <p role="alert" className="text-[17px] font-semibold text-ink">Invoice tidak ditemukan.</p>
        <p className="text-[14px] text-muted">Tautan ini mungkin sudah tidak berlaku atau salah salin.</p>
      </main>
    );
  }

  if (state === "error" || !invoice) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-2 px-5 py-8 text-center">
        <p role="alert" className="text-[17px] font-semibold text-ink">Invoice belum bisa dimuat. Coba lagi.</p>
      </main>
    );
  }

  return (
    <main className={`public-invoice ${publicFontClass} mx-auto flex min-h-dvh w-full max-w-[640px] flex-col gap-6 px-5 py-8 sm:px-8`}>
      <header className="rounded-md border border-line border-t-[3px] border-t-primary bg-surface p-6 shadow-md">
        <p className="text-[13px] font-semibold text-muted">{invoice.number}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-[38px] font-semibold leading-tight tabular-nums text-ink">{formatIdr(invoice.subtotalIdr)}</h1>
          <span className="rounded-full bg-bg px-3 py-1 text-[13px] font-semibold text-ink">{STATUS_LABEL[invoice.status]}</span>
        </div>
        <p className="mt-3 text-[14px] text-muted">Ditagihkan kepada {invoice.brand}</p>
        <p className="mt-1 text-[14px] text-muted">Jatuh tempo: {formatDate(invoice.dueDate)}</p>
        <a
          href={`/api/public/invoices/${token}/pdf`}
          className="mt-4 inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
        >
          Unduh PDF
        </a>
      </header>

      <section aria-labelledby="rincian-invoice" className="rounded-md border border-line bg-surface p-6">
        <h2 id="rincian-invoice" className="text-[18px] font-bold text-ink">Rincian invoice</h2>
        <dl className="mt-4 grid gap-3 text-[15px]">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Nomor invoice</dt>
            <dd className="font-semibold text-ink">{invoice.number}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Cakupan kerja</dt>
            <dd className="text-right font-semibold text-ink">{invoice.scope}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Pajak potong</dt>
            <dd className="font-semibold text-ink">{invoice.withholdingTaxLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Nilai invoice</dt>
            <dd className="font-bold tabular-nums text-ink">{formatIdr(invoice.subtotalIdr)}</dd>
          </div>
        </dl>
      </section>

      {invoice.issuerName ? (
        <p className="text-center text-[13px] text-muted">Dikirim oleh {invoice.issuerName} melalui Dibayar.</p>
      ) : null}
    </main>
  );
}
