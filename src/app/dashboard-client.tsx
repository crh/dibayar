"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { deriveInvoiceDisplayStatus, DUE_SOON_WINDOW_DAYS, selectAttentionInvoices } from "@/lib/invoice-date-status";

const PIPELINE_STAGES = [
  { value: "MASUK", label: "Masuk" },
  { value: "NEGO", label: "Nego" },
  { value: "DEAL", label: "Deal" },
  { value: "KONTEN", label: "Konten" },
  { value: "INVOICE", label: "Invoice" },
  { value: "DIBAYAR", label: "Dibayar" },
] as const;

type DashboardClientProps = {
  initialDeals: DealRecord[];
  initialInvoices?: InvoiceRecord[];
  userName?: string | null;
  // Injectable for deterministic tests; defaults to the real current time.
  now?: Date;
};

type FormState = {
  brand: string;
  contactWa: string;
  scope: string;
  feeIdr: string;
  deadline: string;
  paymentTerms: string;
};

const EMPTY_FORM: FormState = {
  brand: "",
  contactWa: "",
  scope: "",
  feeIdr: "",
  deadline: "",
  paymentTerms: "",
};

const idr = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function formatIdr(value: number) {
  return `Rp${idr.format(value)}`;
}

function formatDeadline(value: Date | null) {
  if (!value) return "Tanpa tenggat";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

const INVOICE_STATUS_LABEL: Record<InvoiceRecord["status"], string> = {
  DRAFT: "Draft",
  SENT: "Terkirim",
  DUE: "Jatuh tempo",
  OVERDUE: "Terlambat",
  PAID: "Lunas",
};

function statusClass(status: InvoiceRecord["status"]) {
  if (status === "PAID") return "bg-paid/15 text-paid";
  if (status === "OVERDUE") return "bg-overdue/10 text-overdue";
  if (status === "DUE") return "bg-due/20 text-ink";
  return "bg-bg text-muted";
}

function AttentionInvoiceCard({ invoice }: { invoice: InvoiceRecord & { displayStatus: InvoiceRecord["status"] } }) {
  return (
    <Link
      href={`/dashboard/invoices/${invoice.id}`}
      className="rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-muted">{invoice.number}</p>
          <p className="mt-1 text-[18px] font-bold tabular-nums text-ink">{formatIdr(invoice.subtotalIdr)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClass(invoice.displayStatus)}`}>
          {INVOICE_STATUS_LABEL[invoice.displayStatus]}
        </span>
      </div>
      <p className="mt-3 text-[13px] text-muted">Jatuh tempo: {formatDeadline(invoice.dueDate)}</p>
    </Link>
  );
}

export default function DashboardClient({ initialDeals, initialInvoices = [], userName, now }: DashboardClientProps) {
  const [deals, setDeals] = useState(initialDeals);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);
  const referenceNow = now ?? new Date();
  const { overdue, dueSoon } = selectAttentionInvoices(invoices, referenceNow);
  const overdueTotal = overdue.reduce((total, invoice) => total + invoice.subtotalIdr, 0);
  const dueSoonTotal = dueSoon.reduce((total, invoice) => total + invoice.subtotalIdr, 0);

  async function handleStageChange(dealId: string, status: DealRecord["status"]) {
    setError(null);
    setPendingDealId(dealId);

    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Deal belum bisa diperbarui. Coba lagi.");
      setDeals((current) => current.map((deal) => (deal.id === dealId ? payload.deal : deal)));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Deal belum bisa diperbarui. Coba lagi.");
    } finally {
      setPendingDealId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          feeIdr: Number(form.feeIdr),
          deadline: form.deadline || undefined,
          paymentTerms: form.paymentTerms || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Deal belum bisa disimpan.");
      setDeals((current) => [payload.deal, ...current]);
      setForm(EMPTY_FORM);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Deal belum bisa disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateInvoice(dealId: string) {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, withholdingTaxType: "NONE" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Invoice belum bisa dibuat.");
      setInvoices((current) => [payload.invoice, ...current]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Invoice belum bisa dibuat.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">Dibayar</p>
          <h1 className="text-[26px] font-bold text-ink">Halo{userName ? `, ${userName}` : ""}</h1>
          <p className="text-[15px] text-muted">Pantau deal brand kamu sampai dibayar.</p>
        </div>
        <Link
          href="/api/auth/signout?callbackUrl=/"
          className="inline-flex h-11 w-fit items-center rounded-full border border-line bg-surface px-4 text-[15px] font-semibold text-ink"
        >
          Keluar
        </Link>
      </header>

      <section aria-labelledby="tambah-deal" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="mb-5">
          <h2 id="tambah-deal" className="text-[20px] font-bold text-ink">Tambah deal pertama kamu</h2>
          <p className="mt-1 text-[13px] text-muted">Isi yang penting dulu. Detail lain bisa kamu lengkapi nanti.</p>
        </div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            Nama brand
            <input
              required
              name="brand"
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
              className="h-11 rounded-xl border border-line bg-bg px-3 text-[15px] font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            Kontak WhatsApp
            <input
              required
              name="contactWa"
              inputMode="tel"
              value={form.contactWa}
              onChange={(event) => setForm({ ...form, contactWa: event.target.value })}
              className="h-11 rounded-xl border border-line bg-bg px-3 text-[15px] font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink sm:col-span-2">
            Scope pekerjaan
            <textarea
              required
              name="scope"
              value={form.scope}
              onChange={(event) => setForm({ ...form, scope: event.target.value })}
              className="min-h-20 rounded-xl border border-line bg-bg px-3 py-2 text-[15px] font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            Fee (Rp)
            <input
              required
              min="0"
              name="feeIdr"
              type="number"
              inputMode="numeric"
              value={form.feeIdr}
              onChange={(event) => setForm({ ...form, feeIdr: event.target.value })}
              className="h-11 rounded-xl border border-line bg-bg px-3 text-[15px] font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            Tenggat
            <input
              name="deadline"
              type="date"
              value={form.deadline}
              onChange={(event) => setForm({ ...form, deadline: event.target.value })}
              className="h-11 rounded-xl border border-line bg-bg px-3 text-[15px] font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink sm:col-span-2">
            Syarat pembayaran (opsional)
            <input
              name="paymentTerms"
              value={form.paymentTerms}
              onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })}
              className="h-11 rounded-xl border border-line bg-bg px-3 text-[15px] font-normal outline-none focus:border-primary"
            />
          </label>
          {error ? <p role="alert" className="text-[13px] text-overdue sm:col-span-2">{error}</p> : null}
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface hover:bg-primary-d disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:w-fit"
          >
            {isSaving ? "Menyimpan…" : "Simpan deal"}
          </button>
        </form>
      </section>

      <section aria-labelledby="perlu-dikejar" className="flex flex-col gap-4">
        <div>
          <h2 id="perlu-dikejar" className="text-[20px] font-bold text-ink">Perlu dikejar</h2>
          <p className="text-[13px] text-muted">Invoice terlambat dan yang jatuh tempo dalam 7 hari.</p>
        </div>
        {overdue.length || dueSoon.length ? (
          <div className="flex flex-col gap-4">
            {overdue.length ? (
              <div>
                <h3 className="text-[15px] font-bold text-overdue">Terlambat ({overdue.length}) · {formatIdr(overdueTotal)}</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {overdue.map((invoice) => (
                    <AttentionInvoiceCard key={invoice.id} invoice={invoice} />
                  ))}
                </div>
              </div>
            ) : null}
            {dueSoon.length ? (
              <div>
                <h3 className="text-[15px] font-bold text-ink">Jatuh tempo dalam {DUE_SOON_WINDOW_DAYS} hari ({dueSoon.length}) · {formatIdr(dueSoonTotal)}</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {dueSoon.map((invoice) => (
                    <AttentionInvoiceCard key={invoice.id} invoice={invoice} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-4 text-[13px] text-muted">
            Tidak ada invoice yang perlu dikejar saat ini.
          </p>
        )}
      </section>

      <section aria-labelledby="pipeline" className="flex flex-col gap-4">
        <div>
          <h2 id="pipeline" className="text-[20px] font-bold text-ink">Pipeline deal</h2>
          <p className="text-[13px] text-muted">Geser ke samping untuk melihat semua tahap.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {PIPELINE_STAGES.map((stage) => {
            const stageDeals = deals.filter((deal) => deal.status === stage.value);
            return (
              <section key={stage.value} aria-labelledby={`stage-${stage.value}`} className="min-w-0 rounded-2xl border border-line bg-surface p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 id={`stage-${stage.value}`} className="text-[15px] font-bold text-ink">{stage.label}</h3>
                  <span className="rounded-full bg-bg px-2 py-1 text-[12px] font-semibold text-muted">{stageDeals.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {stageDeals.length ? stageDeals.map((deal) => (
                    <article key={deal.id} className="rounded-xl border border-line bg-bg p-3">
                      <h4 className="font-semibold text-ink">{deal.brand}</h4>
                      <p className="mt-1 text-[15px] font-bold tabular-nums text-primary">{formatIdr(deal.feeIdr)}</p>
                      <p className="mt-1 text-[12px] text-muted">{formatDeadline(deal.deadline)}</p>
                      <label className="sr-only" htmlFor={`stage-select-${deal.id}`}>
                        {`Tahap deal ${deal.brand}`}
                      </label>
                      <select
                        id={`stage-select-${deal.id}`}
                        value={deal.status}
                        disabled={pendingDealId === deal.id}
                        onChange={(event) => handleStageChange(deal.id, event.target.value as DealRecord["status"])}
                        className="mt-2 h-11 w-full rounded-lg border border-line bg-surface px-2 text-[13px] font-semibold text-ink outline-none focus:border-primary disabled:cursor-wait disabled:opacity-60"
                      >
                        {PIPELINE_STAGES.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                      {deal.status === "INVOICE" && !invoices.some((invoice) => invoice.dealId === deal.id) ? (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleCreateInvoice(deal.id)}
                          className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-3 text-[13px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
                        >
                          {isSaving ? "Membuat…" : "Buat invoice"}
                        </button>
                      ) : null}
                    </article>
                  )) : (
                    <p className="text-[13px] text-muted">Belum ada deal</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="invoice-saya" className="flex flex-col gap-4">
        <div>
          <h2 id="invoice-saya" className="text-[20px] font-bold text-ink">Invoice saya</h2>
          <p className="text-[13px] text-muted">Buat dari deal tahap Invoice, lalu pantau sampai lunas.</p>
        </div>
        {invoices.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {invoices.map((invoice) => {
              const displayStatus = deriveInvoiceDisplayStatus(invoice, referenceNow);
              return (
                <Link
                  key={invoice.id}
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-primary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-muted">{invoice.number}</p>
                      <p className="mt-1 text-[18px] font-bold tabular-nums text-ink">{formatIdr(invoice.subtotalIdr)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClass(displayStatus)}`}>
                      {INVOICE_STATUS_LABEL[displayStatus]}
                    </span>
                  </div>
                  <p className="mt-3 text-[13px] text-muted">{formatDeadline(invoice.dueDate)}</p>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-4 text-[13px] text-muted">
            Belum ada invoice. Pindahkan deal ke tahap Invoice, lalu buat drafnya dari kartu deal.
          </p>
        )}
      </section>
    </main>
  );
}
