"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fieldClassName } from "@/components/design-system";
import { useLanguage } from "@/components/language-switcher";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import type { DealRecord, DealStageTransitionRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { isOverdueByDueDate, daysUntilDue } from "@/lib/invoice-date-status";
import { PIPELINE_STAGES, PIPELINE_STAGE_KEYS } from "@/components/deals/deal-stages";
import { buildDealWhatsApp } from "@/lib/whatsapp";
import { formatPhone } from "@/lib/format/phone";

export default function DealDetailClient({
  initialDeal,
  history,
  initialInvoice = null,
  now,
}: {
  initialDeal: DealRecord;
  history: DealStageTransitionRecord[];
  initialInvoice?: InvoiceRecord | null;
  now?: Date;
}) {
  const { t } = useLanguage();
  const referenceNow = now ?? new Date();
  const [deal, setDeal] = useState(initialDeal);
  const [invoice, setInvoice] = useState(initialInvoice);
  const [contactName, setContactName] = useState(deal.contactName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isChangingStage, setIsChangingStage] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [nextActionMessage, setNextActionMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const stageIndex = PIPELINE_STAGES.findIndex((stage) => stage.value === deal.status);
  const previousStage = stageIndex > 0 ? PIPELINE_STAGES[stageIndex - 1] : null;
  const nextStage = stageIndex < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIndex + 1] : null;
  const canCreateInvoice = deal.status === "INVOICE" && !invoice;
  const isDeadlineOverdue = deal.status !== "DIBAYAR" && isOverdueByDueDate(deal.deadline, referenceNow);

  async function handleStageChange(status: DealRecord["status"]) {
    setIsChangingStage(true);
    setNextActionMessage(null);
    try {
      const response = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("dashboard.dealError");
      setDeal(payload.deal);
    } catch {
      setNextActionMessage({ kind: "error", text: t("dashboard.dealError") });
    } finally {
      setIsChangingStage(false);
    }
  }

  async function handleCreateInvoice() {
    setIsCreatingInvoice(true);
    setNextActionMessage(null);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: deal.id, withholdingTaxType: "NONE" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("dashboard.invoiceError");
      setInvoice(payload.invoice);
      setNextActionMessage({ kind: "success", text: t("deal.detailInvoiceCreatedLinkPrefix") });
    } catch {
      setNextActionMessage({ kind: "error", text: t("dashboard.invoiceError") });
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  const [contactWaDraft, setContactWaDraft] = useState(deal.contactWa);
  const [isSavingContactWa, setIsSavingContactWa] = useState(false);
  const [contactWaMessage, setContactWaMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [showContactRepair, setShowContactRepair] = useState(false);
  const contactWaInputRef = useRef<HTMLInputElement>(null);
  const whatsapp = buildDealWhatsApp({ contactWa: deal.contactWa });
  const displayContactWa = formatPhone(deal.contactWa) || deal.contactWa;

  useEffect(() => {
    if (showContactRepair && whatsapp.kind === "invalid-number") contactWaInputRef.current?.focus();
  }, [showContactRepair, whatsapp.kind]);

  async function handleSaveContactName() {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName: contactName || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("deal.detailContactNameError");
      setDeal(payload.deal);
      setContactName(payload.deal.contactName ?? "");
      setMessage({ kind: "success", text: t("deal.detailContactNameSaved") });
    } catch {
      setMessage({ kind: "error", text: t("deal.detailContactNameError") });
    } finally {
      setIsSaving(false);
    }
  }

  // Repairing the number never opens WhatsApp itself -- it only unblocks the
  // separate "Buka WhatsApp" button above, which the user still has to click.
  async function handleSaveContactWa() {
    setIsSavingContactWa(true);
    setContactWaMessage(null);

    try {
      const response = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactWa: contactWaDraft }),
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.deal?.contactWa !== "string") throw new Error("deal.detailWhatsAppNumberError");
      const readBackResponse = await fetch(`/api/deals/${deal.id}`, { cache: "no-store" });
      const readBackPayload = await readBackResponse.json();
      if (
        !readBackResponse.ok ||
        readBackPayload.deal?.id !== deal.id ||
        readBackPayload.deal?.contactWa !== payload.deal.contactWa
      ) throw new Error("deal.detailWhatsAppNumberError");
      setDeal(readBackPayload.deal);
      setContactWaDraft(readBackPayload.deal.contactWa);
      setContactWaMessage({ kind: "success", text: t("deal.detailWhatsAppNumberSaved") });
    } catch {
      setContactWaMessage({ kind: "error", text: t("deal.detailWhatsAppNumberError") });
    } finally {
      setIsSavingContactWa(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-5 py-6 min-[640px]:px-8 min-[640px]:py-8">
      <Link href="/deal" className="ds-tap-target inline-flex w-fit text-[13px] font-semibold text-primary">
        ← {t("deal.detailBack")}
      </Link>

      <div className="rounded-xl border border-line bg-bg p-4">
        <h1 className="text-xl font-bold text-ink">{deal.brand}</h1>
        <p className="mt-1 text-[13px] font-semibold text-muted">
          {t("deal.detailStatus")}: {t(PIPELINE_STAGE_KEYS[deal.status])}
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailFee")}</dt>
            <dd className="text-[15px] font-bold tabular-nums text-primary">{formatMoney(deal.feeIdr)}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailDeadline")}</dt>
            <dd className={`text-[14px] ${isDeadlineOverdue ? "font-semibold text-overdue" : "text-ink"}`}>
              {deal.deadline
                ? isDeadlineOverdue
                  ? t("deal.detailDeadlineOverdue", {
                      date: formatDate(deal.deadline),
                      days: String(Math.abs(daysUntilDue(deal.deadline, referenceNow))),
                    })
                  : formatDate(deal.deadline)
                : t("deal.detailDeadlineEmpty")}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailContactWa")}</dt>
            <dd className="text-[14px] text-ink">{displayContactWa}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailPaymentTerms")}</dt>
            <dd className="break-words text-[14px] text-ink">{deal.paymentTerms || t("deal.detailPaymentTermsEmpty")}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailScope")}</dt>
            <dd className="whitespace-pre-wrap break-words text-[14px] text-ink">{deal.scope}</dd>
          </div>
        </dl>

        {previousStage || nextStage || canCreateInvoice || invoice ? (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[13px] font-semibold text-ink">{t("deal.detailNextActionTitle")}</p>
            <div className="mt-2 flex flex-col items-start gap-2 min-[360px]:flex-row min-[360px]:flex-wrap min-[360px]:items-center">
              {previousStage ? (
                <button
                  type="button"
                  disabled={isChangingStage}
                  onClick={() => handleStageChange(previousStage.value)}
                  className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[13px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
                >
                  {t("dashboard.moveToPreviousStage", { stage: t(PIPELINE_STAGE_KEYS[previousStage.value]) })}
                </button>
              ) : null}
              {nextStage ? (
                <button
                  type="button"
                  disabled={isChangingStage}
                  onClick={() => handleStageChange(nextStage.value)}
                  className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[13px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
                >
                  {t("dashboard.moveToNextStage", { stage: t(PIPELINE_STAGE_KEYS[nextStage.value]) })}
                </button>
              ) : null}
              {canCreateInvoice ? (
                <button
                  type="button"
                  disabled={isCreatingInvoice}
                  onClick={handleCreateInvoice}
                  className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface hover:bg-primary-d disabled:cursor-wait disabled:opacity-60"
                >
                  {isCreatingInvoice ? t("dashboard.saving") : t("dashboard.createInvoice")}
                </button>
              ) : null}
              {invoice ? (
                <Link
                  href={`/invoice/${invoice.id}`}
                  className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface hover:bg-primary-d"
                >
                  {t("deal.detailViewInvoice", { number: invoice.number })}
                </Link>
              ) : null}
            </div>
            {nextActionMessage ? (
              <p
                role={nextActionMessage.kind === "error" ? "alert" : "status"}
                className={`mt-2 text-[13px] ${nextActionMessage.kind === "error" ? "text-overdue" : "text-paid"}`}
              >
                {nextActionMessage.text}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 border-t border-line pt-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink" htmlFor="contactName">
            {t("deal.detailContactName")}
          </label>
          <div className="mt-1.5 flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center">
            <input
              id="contactName"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder={t("deal.detailContactNameEmpty")}
              className={`${fieldClassName} w-full min-[360px]:min-w-0 min-[360px]:flex-1`}
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveContactName}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface hover:bg-primary-d disabled:cursor-wait disabled:opacity-60 min-[360px]:w-auto"
            >
              {isSaving ? t("dashboard.saving") : t("deal.detailContactNameSave")}
            </button>
          </div>
          {message ? (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className={`mt-2 text-[13px] ${message.kind === "error" ? "text-overdue" : "text-paid"}`}
            >
              {message.text}
            </p>
          ) : null}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[13px] font-semibold text-ink">{t("deal.detailWhatsAppTitle")}</p>

          {whatsapp.kind === "ok" ? (
            <button
              type="button"
              onClick={() => window.open(whatsapp.href, "_blank", "noopener,noreferrer")}
              className="mt-2 inline-flex h-11 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface hover:bg-primary-d"
            >
              {t("deal.detailWhatsAppOpen")}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowContactRepair(true)}
                className="mt-2 inline-flex h-11 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface hover:bg-primary-d"
              >
                {t("deal.detailWhatsAppOpen")}
              </button>
              {showContactRepair ? (
                <div className="mt-3 rounded-xl bg-bg p-3">
                  <p role="alert" className="text-[13px] text-overdue">
                    {t("whatsapp.invalidNumber")}
                  </p>
                  <label className="mt-2 flex flex-col gap-1.5 text-[13px] font-semibold text-ink" htmlFor="contactWa">
                    {t("deal.detailWhatsAppRepairLabel")}
                  </label>
                  <div data-ux-action-row="deal-contact-repair" className="mt-1.5 flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center">
                    <input
                      ref={contactWaInputRef}
                      id="contactWa"
                      inputMode="tel"
                      value={contactWaDraft}
                      onChange={(event) => setContactWaDraft(event.target.value)}
                      className={`${fieldClassName} w-full min-[360px]:min-w-0 min-[360px]:flex-1`}
                    />
                    <button
                      type="button"
                      disabled={isSavingContactWa}
                      onClick={handleSaveContactWa}
                      className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface hover:bg-primary-d disabled:cursor-wait disabled:opacity-60 min-[360px]:w-auto"
                    >
                      {isSavingContactWa ? t("dashboard.saving") : t("deal.detailWhatsAppRepairSave")}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
          {/* Rendered regardless of which branch is currently active: a
              successful repair flips `whatsapp.kind` to "ok" on the same
              render that sets this message, and the repair form (which
              this used to live inside) would otherwise unmount right as
              the message appears, hiding it before anyone could read it. */}
          {contactWaMessage ? (
            <p
              role={contactWaMessage.kind === "error" ? "alert" : "status"}
              className={`mt-2 text-[13px] ${contactWaMessage.kind === "error" ? "text-overdue" : "text-paid"}`}
            >
              {contactWaMessage.text}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-bg p-4">
        <h2 className="text-[15px] font-bold text-ink">{t("deal.detailHistoryTitle")}</h2>
        {history.length ? (
          <ol className="mt-3 flex flex-col gap-2">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="text-ink">
                  {entry.fromStatus === null
                    ? t("deal.detailHistoryCreated", { stage: t(PIPELINE_STAGE_KEYS[entry.toStatus]) })
                    : t("deal.detailHistoryMoved", {
                        from: t(PIPELINE_STAGE_KEYS[entry.fromStatus]),
                        to: t(PIPELINE_STAGE_KEYS[entry.toStatus]),
                      })}
                </span>
                <span className="shrink-0 text-muted">{formatDate(entry.createdAt)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[13px] text-muted">{t("deal.detailHistoryEmpty")}</p>
        )}
      </div>
    </main>
  );
}
