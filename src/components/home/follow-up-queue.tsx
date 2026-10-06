"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language-switcher";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { selectAttentionInvoices, type AttentionInvoice } from "@/lib/invoice-date-status";
import { MoneyDisplay } from "@/components/design-system";
import { formatDate } from "@/lib/format/date";
import { fetchWithTimeout } from "@/lib/http";
import { buildWhatsAppReminderMessage, buildWhatsAppShareUrl, normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { openWhatsAppPopup, type WhatsAppPopup } from "@/lib/whatsapp-popup";

type QueueInvoice = AttentionInvoice<InvoiceRecord>;

type RowState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "blocked"; href: string }
  | { kind: "error" }
  | { kind: "repair"; value: string; saving: boolean; error: boolean };

const IDLE: RowState = { kind: "idle" };

function ReminderIcon({ spinning }: { spinning: boolean }) {
  if (spinning) {
    return <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-surface border-t-transparent" />;
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l16-8L4 4l3 7-3 9z" />
    </svg>
  );
}

function urgencyLabel(invoice: QueueInvoice, t: (key: string, values?: Record<string, string>) => string): string {
  if (invoice.displayStatus === "OVERDUE") {
    return t("home.overdueBy", { days: String(Math.abs(invoice.daysUntilDue ?? 0)) });
  }
  if ((invoice.daysUntilDue ?? 0) === 0) return t("home.dueToday");
  return t("home.dueIn", { days: String(invoice.daysUntilDue ?? 0) });
}

type FollowUpQueueProps = {
  invoices: InvoiceRecord[] | null;
  deals: DealRecord[] | null;
  now: Date;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

export function FollowUpQueue({ invoices, deals, now, loading = false, error = false, onRetry }: FollowUpQueueProps) {
  const { language, t } = useLanguage();
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [numberOverrides, setNumberOverrides] = useState<Record<string, string>>({});

  const { overdue, dueSoon } = selectAttentionInvoices(invoices ?? [], now);
  const queue: QueueInvoice[] = [...overdue, ...dueSoon];

  function setRowState(invoiceId: string, state: RowState) {
    setRowStates((current) => ({ ...current, [invoiceId]: state }));
  }

  // `popup` was opened by the tap itself (openWhatsAppPopup); null means the
  // browser blocked it, so the row offers a direct link instead.
  async function openReminder(invoice: QueueInvoice, number: string, popup: WhatsAppPopup | null) {
    setRowState(invoice.id, { kind: "sending" });
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoice.id}/share`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || typeof payload.path !== "string") throw new Error("share-failed");

      const shareUrl = `${window.location.origin}${payload.path}`;
      const message = buildWhatsAppReminderMessage({
        kind: invoice.displayStatus === "OVERDUE" ? "overdue" : "due-soon",
        invoiceNumber: invoice.number,
        totalIdr: invoice.subtotalIdr,
        dueDate: invoice.dueDate ?? new Date(),
        shareUrl,
      });
      const href = buildWhatsAppShareUrl(number, message);
      setRowState(invoice.id, popup?.navigate(href) ? IDLE : { kind: "blocked", href });
    } catch {
      popup?.close();
      setRowState(invoice.id, { kind: "error" });
    }
  }

  function handleSendReminder(invoice: QueueInvoice) {
    const current = rowStates[invoice.id];
    if (current?.kind === "sending") return;

    const deal = deals?.find((candidate) => candidate.id === invoice.dealId);
    const rawNumber = numberOverrides[invoice.id] ?? deal?.contactWa ?? "";
    const normalized = normalizeWhatsAppNumber(rawNumber);
    if (!normalized) {
      setRowState(invoice.id, { kind: "repair", value: rawNumber, saving: false, error: false });
      return;
    }
    void openReminder(invoice, normalized, openWhatsAppPopup(t("whatsapp.opening")));
  }

  async function handleSaveAndSend(invoice: QueueInvoice, value: string) {
    const deal = deals?.find((candidate) => candidate.id === invoice.dealId);
    if (!deal) {
      setRowState(invoice.id, { kind: "repair", value, saving: false, error: true });
      return;
    }

    // Opened now, while the tap still counts as a user gesture; a number that
    // can't work even before saving never opens a tab at all.
    const popup = normalizeWhatsAppNumber(value) ? openWhatsAppPopup(t("whatsapp.opening")) : null;
    let handedOff = false;
    setRowState(invoice.id, { kind: "repair", value, saving: true, error: false });
    try {
      const response = await fetchWithTimeout(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactWa: value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("save-failed");

      const savedNumber: string = payload.deal.contactWa;
      setNumberOverrides((current) => ({ ...current, [invoice.id]: savedNumber }));
      const normalized = normalizeWhatsAppNumber(savedNumber);
      if (!normalized) {
        setRowState(invoice.id, { kind: "repair", value: savedNumber, saving: false, error: true });
        return;
      }
      handedOff = true;
      await openReminder(invoice, normalized, popup);
    } catch {
      setRowState(invoice.id, { kind: "repair", value, saving: false, error: true });
    } finally {
      if (!handedOff) popup?.close();
    }
  }

  return (
    <section aria-labelledby="home-perlu-dikejar" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-perlu-dikejar" className="text-[16px] font-semibold text-ink">{t("home.chaseQueue")}</h2>
        {!loading && !error ? (
          <Link href="/invoice" className="ds-tap-target inline-flex h-11 items-center text-[13px] font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {t("action.seeAll")}
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} data-testid="home-chase-queue-skeleton" className="h-16 animate-pulse rounded-xl bg-line/40" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[13px] text-overdue">{t("home.loadError")}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("action.retry")}
          </button>
        </div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-line bg-surface p-4">
          <p className="text-[13px] text-muted">{t("home.chaseEmpty")}</p>
          <p className="text-[12px] text-muted">{t("home.chaseEmptyHint")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.map((invoice) => {
            const deal = deals?.find((candidate) => candidate.id === invoice.dealId);
            const brand = deal?.brand ?? invoice.number;
            const rowState = rowStates[invoice.id] ?? IDLE;
            const sending = rowState.kind === "sending";

            return (
              <li key={invoice.id} className="flex flex-col gap-2">
                <div className="flex items-stretch gap-2">
                  <Link
                    href={`/invoice/${invoice.id}`}
                    className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">{brand}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {invoice.dueDate ? formatDate(invoice.dueDate) : t("invoice.notSet")} · {urgencyLabel(invoice, t)}
                      </p>
                    </div>
                    <MoneyDisplay value={invoice.subtotalIdr} language={language} size="card" tone={invoice.displayStatus === "OVERDUE" ? "negative" : "default"} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleSendReminder(invoice)}
                    aria-describedby={rowState.kind === "error" ? `home-reminder-error-${invoice.id}` : undefined}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-surface outline-none transition-colors hover:bg-primary-d focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <ReminderIcon spinning={sending} />
                    <span className="sr-only">
                      {sending ? t("home.reminderSendingStatus") : t("home.sendReminder")}
                    </span>
                  </button>
                </div>

                {rowState.kind === "error" ? (
                  <p id={`home-reminder-error-${invoice.id}`} role="alert" className="text-[13px] text-overdue">
                    {t("whatsapp.openError")}
                  </p>
                ) : null}

                {rowState.kind === "blocked" ? (
                  <a
                    href={rowState.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start text-[13px] font-semibold text-primary underline outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {t("whatsapp.openFallback")}
                  </a>
                ) : null}

                {rowState.kind === "repair" ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-bg p-3">
                    <p role="alert" className="text-[13px] text-overdue">{t("whatsapp.invalidNumber")}</p>
                    <label className="sr-only" htmlFor={`home-reminder-number-${invoice.id}`}>
                      {t("whatsapp.numberFieldLabel")}
                    </label>
                    <input
                      id={`home-reminder-number-${invoice.id}`}
                      type="tel"
                      inputMode="tel"
                      autoFocus
                      value={rowState.value}
                      onChange={(event) => setRowState(invoice.id, { ...rowState, value: event.target.value, error: false })}
                      className="h-11 rounded-lg border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-primary"
                    />
                    {rowState.error ? <p role="alert" className="text-[13px] text-overdue">{t("whatsapp.saveError")}</p> : null}
                    <button
                      type="button"
                      onClick={() => handleSaveAndSend(invoice, rowState.value)}
                      className="inline-flex h-11 w-fit items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface outline-none disabled:cursor-wait disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary"
                      disabled={rowState.saving}
                    >
                      {rowState.saving ? t("dashboard.saving") : t("whatsapp.saveAndSend")}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
