"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { deriveInvoiceDisplayStatus, DUE_SOON_WINDOW_DAYS, selectAttentionInvoices } from "@/lib/invoice-date-status";
import { useLanguage } from "@/components/language-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";
import { summarizeMonthlyIncome } from "@/lib/income-summary";
import type { Language } from "@/lib/i18n";
import { StatusChip, MoneyDisplay, EmptyState, fieldClassName } from "@/components/design-system";

const PIPELINE_STAGES = [
  { value: "MASUK", label: "Masuk" },
  { value: "NEGO", label: "Nego" },
  { value: "DEAL", label: "Deal" },
  { value: "KONTEN", label: "Konten" },
  { value: "INVOICE", label: "Invoice" },
  { value: "DIBAYAR", label: "Dibayar" },
] as const;

function formatIncomeLabel(year: number, month: number, language: Language) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

const PIPELINE_STAGE_KEYS: Record<string, string> = {
  MASUK: "stage.inbox",
  NEGO: "stage.negotiation",
  DEAL: "stage.deal",
  KONTEN: "stage.content",
  INVOICE: "stage.invoice",
  DIBAYAR: "stage.paid",
};
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

function formatIdr(value: number, language: Language) {
  const formatter = new Intl.NumberFormat(language === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 0 });
  return language === "en" ? `IDR ${formatter.format(value)}` : `Rp${formatter.format(value)}`;
}

function formatDeadline(value: Date | null, language: Language) {
  if (!value) return language === "en" ? "No deadline" : "Tanpa tenggat";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function statusClass(status: InvoiceRecord["status"]) {
  if (status === "PAID") return "bg-paid/15 text-paid";
  if (status === "OVERDUE") return "bg-overdue/10 text-overdue";
  if (status === "DUE") return "bg-due/20 text-ink";
  return "bg-bg text-muted";
}

function AttentionInvoiceCard({ invoice, language, t }: {
  invoice: InvoiceRecord & { displayStatus: InvoiceRecord["status"] };
  language: Language;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  return (
    <Link
      href={`/dashboard/invoices/${invoice.id}`}
      className="rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-muted">{invoice.number}</p>
          <MoneyDisplay value={invoice.subtotalIdr} language={language} size="card" />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClass(invoice.displayStatus)}`}>
          {invoice.displayStatus === "OVERDUE" ? t("dashboard.overdue") : t("dashboard.dueSoon")}
        </span>
      </div>
      <p className="mt-3 text-[13px] text-muted">{t("dashboard.dueDate", { date: formatDeadline(invoice.dueDate, language) })}</p>
    </Link>
  );
}

export default function DashboardClient({ initialDeals, initialInvoices = [], userName, now }: DashboardClientProps) {
  const { language, setLanguage, t } = useLanguage();
  const [deals, setDeals] = useState(initialDeals);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);
  const [isAddDealOpen, setIsAddDealOpen] = useState(initialDeals.length === 0);
  const referenceNow = now ?? new Date();
  const { overdue, dueSoon } = selectAttentionInvoices(invoices, referenceNow);
  const overdueTotal = overdue.reduce((total, invoice) => total + invoice.subtotalIdr, 0);
  const dueSoonTotal = dueSoon.reduce((total, invoice) => total + invoice.subtotalIdr, 0);
  const incomeSummary = summarizeMonthlyIncome(invoices, referenceNow);

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
      if (!response.ok) throw new Error(payload.error ?? t("dashboard.invoiceError"));
      setInvoices((current) => [payload.invoice, ...current]);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("dashboard.invoiceError"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-5 py-8 sm:px-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-primary">Dibayar</p>
          <h1 className="text-[26px] font-bold text-ink">{t("dashboard.greeting", { name: userName ?? "" })}</h1>
          <p className="text-[15px] text-muted">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher language={language} onChange={setLanguage} compact />
          <Link
            href="/api/auth/signout?callbackUrl=/"
            className="inline-flex h-11 w-fit items-center rounded-full border border-line bg-surface px-4 text-[15px] font-semibold text-ink"
          >
            {t("dashboard.signOut")}
          </Link>
        </div>
      </header>

      <div aria-label={language === "en" ? "Deal progress" : "Progress deal"} className="flex h-2 overflow-hidden rounded-full bg-line">
        {PIPELINE_STAGES.map((stage) => <div key={stage.value} className={`flex-1 ${stage.value === "DIBAYAR" ? "bg-paid" : stage.value === "INVOICE" ? "bg-due" : stage.value === "KONTEN" ? "bg-due-tint" : stage.value === "MASUK" ? "bg-line" : "bg-primary-tint"}`} />)}
      </div>

      <section aria-labelledby="tambah-deal" className={`${initialDeals.length ? "rounded-lg border border-line bg-surface p-4" : "rounded-lg border border-primary-tint bg-primary-tint p-5 shadow-sm"}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="ds-micro text-primary">{initialDeals.length ? "Quick action" : "Mulai dari sini"}</p>
            <h2 id="tambah-deal" className="ds-h2 text-ink">{t("dashboard.addDeal")}</h2>
            <p className="mt-1 ds-small text-muted">{t("dashboard.addDealHint")}</p>
          </div>
          {initialDeals.length ? (
            <button
              type="button"
              onClick={() => setIsAddDealOpen((open) => !open)}
              aria-expanded={isAddDealOpen}
              aria-controls="tambah-deal-form"
              className="ds-button ds-button-primary min-h-11 px-4 text-[13px]"
            >
              {isAddDealOpen ? (language === "en" ? "Close" : "Tutup") : (language === "en" ? "+ Add deal" : "+ Tambah deal")}
            </button>
          ) : null}
        </div>
        {isAddDealOpen ? (
        <form id="tambah-deal-form" className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            {t("dashboard.brand")}
            <input
              required
              name="brand"
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value })}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            {t("dashboard.whatsapp")}
            <input
              required
              name="contactWa"
              inputMode="tel"
              value={form.contactWa}
              onChange={(event) => setForm({ ...form, contactWa: event.target.value })}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink sm:col-span-2">
            {t("dashboard.scope")}
            <textarea
              required
              name="scope"
              value={form.scope}
              onChange={(event) => setForm({ ...form, scope: event.target.value })}
              className="min-h-20 rounded-xl border border-line bg-bg px-3 py-2 text-[15px] font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            {t("dashboard.fee")}
            <input
              required
              min="0"
              name="feeIdr"
              type="number"
              inputMode="numeric"
              value={form.feeIdr}
              onChange={(event) => setForm({ ...form, feeIdr: event.target.value })}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            {t("dashboard.deadline")}
            <input
              name="deadline"
              type="date"
              value={form.deadline}
              onChange={(event) => setForm({ ...form, deadline: event.target.value })}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink sm:col-span-2">
            {t("dashboard.paymentTerms")}
            <input
              name="paymentTerms"
              value={form.paymentTerms}
              onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })}
              className={fieldClassName}
            />
          </label>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-surface hover:bg-primary-d disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:w-fit"
          >
            {isSaving ? t("dashboard.saving") : t("dashboard.saveDeal")}
          </button>
        </form>
        ) : null}
        {error ? <p role="alert" className="mt-3 ds-small text-overdue">{error}</p> : null}
      </section>

      <section aria-labelledby="perlu-dikejar" className="flex flex-col gap-4">
              <div>
                <h2 id="perlu-dikejar" className="text-[20px] font-bold text-ink">{t("dashboard.attention")}</h2>
                <p className="text-[13px] text-muted">{language === "en" ? `Overdue invoices and those due within ${DUE_SOON_WINDOW_DAYS} days.` : `Invoice terlambat dan yang jatuh tempo dalam ${DUE_SOON_WINDOW_DAYS} hari.`}</p>
              </div>
              {overdue.length || dueSoon.length ? (
                <div className="flex flex-col gap-4">
                  {overdue.length ? (
                    <div>
                      <h3 className="text-[15px] font-bold text-overdue">{t("dashboard.overdue")} ({overdue.length}) · {formatIdr(overdueTotal, language)}</h3>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {overdue.map((invoice) => (
                          <AttentionInvoiceCard key={invoice.id} invoice={invoice} language={language} t={t} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {dueSoon.length ? (
                    <div>
                      <h3 className="text-[15px] font-bold text-ink">{language === "en" ? `Due within ${DUE_SOON_WINDOW_DAYS} days` : `Jatuh tempo dalam ${DUE_SOON_WINDOW_DAYS} hari`} ({dueSoon.length}) · {formatIdr(dueSoonTotal, language)}</h3>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {dueSoon.map((invoice) => (
                          <AttentionInvoiceCard key={invoice.id} invoice={invoice} language={language} t={t} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState>{t("dashboard.noAttention")}</EmptyState>
              )}
            </section>

      <section aria-labelledby="ringkasan-pendapatan" className="flex flex-col gap-4">
        <div>
          <h2 id="ringkasan-pendapatan" className="text-[20px] font-bold text-ink">{t("dashboard.income")}</h2>
          <p className="text-[13px] text-muted">{t("dashboard.issued")} · {formatIncomeLabel(incomeSummary.year, incomeSummary.month, language)} · {incomeSummary.invoiceCount}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-[13px] text-muted">{t("dashboard.gross")}</p>
            <p className="mt-1 text-[20px] font-bold tabular-nums text-ink">{formatIdr(incomeSummary.grossIdr, language)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-[13px] text-muted">{t("dashboard.withholding")}</p>
            <p className="mt-1 text-[20px] font-bold tabular-nums text-overdue">-{formatIdr(incomeSummary.withholdingIdr, language)}</p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-[13px] text-muted">{t("dashboard.estimated")}</p>
            <p className="mt-1 text-[20px] font-bold tabular-nums text-primary">{formatIdr(incomeSummary.netIdr, language)}</p>
          </div>
        </div>
        <p className="text-[12px] text-muted">{t("dashboard.taxNote")}</p>
      </section>

      <section aria-labelledby="pipeline" className="flex flex-col gap-4">
        <div>
          <h2 id="pipeline" className="text-[20px] font-bold text-ink">{t("dashboard.pipeline")}</h2>
          <p className="text-[13px] text-muted">{language === "en" ? "Swipe sideways to see every stage." : "Geser ke samping untuk melihat semua tahap."}</p>
        </div>
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {PIPELINE_STAGES.map((stage) => {
            const stageDeals = deals.filter((deal) => deal.status === stage.value);
            return (
              <section key={stage.value} aria-labelledby={`stage-${stage.value}`} className="min-w-[260px] snap-start rounded-md border border-line bg-surface p-4 lg:min-w-0">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 id={`stage-${stage.value}`} className="text-[15px] font-bold text-ink">{t(PIPELINE_STAGE_KEYS[stage.value])}</h3>
                  <span className="rounded-full bg-bg px-2 py-1 text-[12px] font-semibold text-muted">{stageDeals.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {stageDeals.length ? stageDeals.map((deal) => (
                    <article key={deal.id} className="rounded-xl border border-line bg-bg p-3">
                      <h4 className="font-semibold text-ink">{deal.brand}</h4>
                      <div className="mt-2"><StatusChip status={deal.status} language={language} /></div>
                      <p className="mt-1 text-[15px] font-bold tabular-nums text-primary">{formatIdr(deal.feeIdr, language)}</p>
                      <p className="mt-1 text-[12px] text-muted">{formatDeadline(deal.deadline, language)}</p>
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
                            {t(PIPELINE_STAGE_KEYS[stage.value])}
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
                          {isSaving ? t("dashboard.saving") : t("dashboard.createInvoice")}
                        </button>
                      ) : null}
                    </article>
                  )) : (
                    <p className="text-[13px] text-muted">{language === "en" ? "No deals in this stage." : "Belum ada deal"}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="invoice-saya" className="flex flex-col gap-4">
        <div>
          <h2 id="invoice-saya" className="text-[20px] font-bold text-ink">{language === "en" ? "My invoices" : "Invoice saya"}</h2>
          <p className="text-[13px] text-muted">{language === "en" ? "Create invoices from the Invoice stage and track them until paid." : "Buat dari deal tahap Invoice, lalu pantau sampai lunas."}</p>
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
                      <MoneyDisplay value={invoice.subtotalIdr} language={language} size="card" />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClass(displayStatus)}`}>
                      {displayStatus === "PAID" ? t("invoice.paid") : displayStatus === "SENT" ? t("invoice.sent") : displayStatus === "DUE" ? t("invoice.due") : displayStatus === "OVERDUE" ? t("invoice.overdue") : t("invoice.draft")}
                    </span>
                  </div>
                  <p className="mt-3 text-[13px] text-muted">{formatDeadline(invoice.dueDate, language)}</p>
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
