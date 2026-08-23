"use client";

import { useState } from "react";
import Link from "next/link";
import { fieldClassName } from "@/components/design-system";
import { useLanguage } from "@/components/language-switcher";
import { formatMoney } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import type { DealRecord, DealStageTransitionRecord } from "@/lib/deals";
import { PIPELINE_STAGE_KEYS } from "@/components/deals/deal-stages";
import { buildDealWhatsApp } from "@/lib/whatsapp";

export default function DealDetailClient({
  initialDeal,
  history,
}: {
  initialDeal: DealRecord;
  history: DealStageTransitionRecord[];
}) {
  const { t } = useLanguage();
  const [deal, setDeal] = useState(initialDeal);
  const [contactName, setContactName] = useState(deal.contactName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [contactWaDraft, setContactWaDraft] = useState(deal.contactWa);
  const [isSavingContactWa, setIsSavingContactWa] = useState(false);
  const [contactWaMessage, setContactWaMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const whatsapp = buildDealWhatsApp({ contactWa: deal.contactWa, brand: deal.brand, contactName: deal.contactName });

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
      if (!response.ok) throw new Error("deal.detailWhatsAppNumberError");
      setDeal(payload.deal);
      setContactWaDraft(payload.deal.contactWa);
      setContactWaMessage({ kind: "success", text: t("deal.detailWhatsAppNumberSaved") });
    } catch {
      setContactWaMessage({ kind: "error", text: t("deal.detailWhatsAppNumberError") });
    } finally {
      setIsSavingContactWa(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-5 py-6 min-[640px]:px-8 min-[640px]:py-8">
      <Link href="/deal" className="text-[13px] font-semibold text-primary">
        ← {t("deal.detailBack")}
      </Link>

      <div className="rounded-xl border border-line bg-bg p-4">
        <h1 className="text-xl font-bold text-ink">{deal.brand}</h1>
        <p className="mt-1 text-[13px] font-semibold text-muted">
          {t("deal.detailStatus")}: {t(PIPELINE_STAGE_KEYS[deal.status])}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailFee")}</dt>
            <dd className="text-[15px] font-bold tabular-nums text-primary">{formatMoney(deal.feeIdr)}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailDeadline")}</dt>
            <dd className="text-[14px] text-ink">
              {deal.deadline ? formatDate(deal.deadline) : t("deal.detailDeadlineEmpty")}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailContactWa")}</dt>
            <dd className="text-[14px] text-ink">{deal.contactWa}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailPaymentTerms")}</dt>
            <dd className="text-[14px] text-ink">{deal.paymentTerms || t("deal.detailPaymentTermsEmpty")}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[12px] font-semibold text-muted">{t("deal.detailScope")}</dt>
            <dd className="whitespace-pre-wrap text-[14px] text-ink">{deal.scope}</dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-line pt-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink" htmlFor="contactName">
            {t("deal.detailContactName")}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="contactName"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder={t("deal.detailContactNameEmpty")}
              className={fieldClassName}
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveContactName}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface hover:bg-primary-d disabled:cursor-wait disabled:opacity-60"
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
              <p role="alert" className="mt-1 text-[13px] text-overdue">
                {t("deal.detailWhatsAppInvalid")}
              </p>
              <label className="mt-2 flex flex-col gap-1.5 text-[13px] font-semibold text-ink" htmlFor="contactWa">
                {t("deal.detailWhatsAppRepairLabel")}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="contactWa"
                  inputMode="tel"
                  value={contactWaDraft}
                  onChange={(event) => setContactWaDraft(event.target.value)}
                  className={fieldClassName}
                />
                <button
                  type="button"
                  disabled={isSavingContactWa}
                  onClick={handleSaveContactWa}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-semibold text-surface hover:bg-primary-d disabled:cursor-wait disabled:opacity-60"
                >
                  {isSavingContactWa ? t("dashboard.saving") : t("deal.detailWhatsAppRepairSave")}
                </button>
              </div>
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
