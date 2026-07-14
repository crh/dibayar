"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { DealRecord } from "@/lib/deals";

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
  userName?: string | null;
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
  }).format(new Date(value));
}

export default function DashboardClient({ initialDeals, userName }: DashboardClientProps) {
  const [deals, setDeals] = useState(initialDeals);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    </main>
  );
}
