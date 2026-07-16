"use client";

import { useState } from "react";
import Link from "next/link";
import type { InvoiceRecord } from "@/lib/invoices";

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

const STATUS_LABEL: Record<InvoiceRecord["status"], string> = {
  DRAFT: "Draft",
  SENT: "Terkirim",
  DUE: "Jatuh tempo",
  OVERDUE: "Terlambat",
  PAID: "Lunas",
};

const NEXT_ACTIONS: Record<InvoiceRecord["status"], Array<{ status: InvoiceRecord["status"]; label: string }>> = {
  DRAFT: [{ status: "SENT", label: "Tandai sudah dikirim" }],
  SENT: [
    { status: "DUE", label: "Tandai jatuh tempo" },
    { status: "PAID", label: "Tandai lunas" },
  ],
  DUE: [
    { status: "OVERDUE", label: "Tandai terlambat" },
    { status: "PAID", label: "Tandai lunas" },
  ],
  OVERDUE: [{ status: "PAID", label: "Tandai lunas" }],
  PAID: [],
};

function formatIdr(value: number) {
  return `Rp${idr.format(value)}`;
}

function formatDate(value: Date | null) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export default function InvoiceDetailClient({ initialInvoice }: { initialInvoice: InvoiceRecord }) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function updateStatus(status: InvoiceRecord["status"]) {
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Status invoice belum bisa diperbarui.");
      setInvoice(payload.invoice);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Status invoice belum bisa diperbarui.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8 sm:px-8">
      <Link href="/dashboard" className="inline-flex w-fit text-[14px] font-semibold text-primary">
        ← Kembali ke dashboard
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-[13px] font-semibold text-muted">{invoice.number}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold tabular-nums text-ink">{formatIdr(invoice.subtotalIdr)}</h1>
          <span className="rounded-full bg-bg px-3 py-1 text-[13px] font-semibold text-ink">{STATUS_LABEL[invoice.status]}</span>
        </div>
        <p className="mt-3 text-[14px] text-muted">Jatuh tempo: {formatDate(invoice.dueDate)}</p>
      </header>

      <section aria-labelledby="rincian-invoice" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="rincian-invoice" className="text-[18px] font-bold text-ink">Rincian invoice</h2>
        <dl className="mt-4 grid gap-3 text-[15px]">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Nomor invoice</dt>
            <dd className="font-semibold text-ink">{invoice.number}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Pajak potong</dt>
            <dd className="font-semibold text-ink">{invoice.withholdingTaxType === "NONE" ? "Tidak ada" : invoice.withholdingTaxType.replace("PPH", "PPh ")}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Nilai invoice</dt>
            <dd className="font-bold tabular-nums text-ink">{formatIdr(invoice.subtotalIdr)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="status-invoice" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="status-invoice" className="text-[18px] font-bold text-ink">Status pembayaran</h2>
        <p className="mt-1 text-[13px] text-muted">Pilih tahap berikutnya setelah invoice benar-benar bergerak.</p>
        {error ? <p role="alert" className="mt-3 text-[13px] text-overdue">{error}</p> : null}
        {NEXT_ACTIONS[invoice.status].length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {NEXT_ACTIONS[invoice.status].map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={isSaving}
                onClick={() => updateStatus(action.status)}
                className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Menyimpan…" : action.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-paid/10 px-3 py-2 text-[14px] font-semibold text-paid">Invoice ini sudah lunas.</p>
        )}
      </section>
    </main>
  );
}
