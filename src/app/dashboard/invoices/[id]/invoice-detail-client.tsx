"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { InvoiceRecord } from "@/lib/invoices";
import { deriveInvoiceDisplayStatus, getDueDateCalendarDate } from "@/lib/invoice-date-status";
import { buildWhatsAppReminder, buildWhatsAppShare, normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { useLanguage } from "@/components/language-switcher";
import { MoneyDisplay, StatusChip, Button, fieldClassName } from "@/components/design-system";
import { ShareLinkField } from "@/components/invoices/share-link-field";
import type { Language } from "@/lib/i18n";
import { triggerPaidHaptic } from "@/lib/haptics";
import { fetchWithTimeout } from "@/lib/http";
import { PPH_RATES } from "@/lib/income-summary";
import { formatMoney } from "@/lib/format/money";
import { formatDate as formatDateCentral } from "@/lib/format/date";

// Fetch responses round-trip dueDate through JSON (a string), while the
// server-rendered initial invoice carries a real Date; normalize both to a
// Date before any date-math so derivation never sees an unparsed string.
function normalizeDueDate(value: InvoiceRecord["dueDate"]): Date | null {
  return value ? new Date(value) : null;
}

const NEXT_ACTIONS: Record<InvoiceRecord["status"], Array<{ status: InvoiceRecord["status"]; labelKey: string }>> = {
  DRAFT: [{ status: "SENT", labelKey: "invoice.markSent" }],
  SENT: [
    { status: "DUE", labelKey: "invoice.markDue" },
    { status: "PAID", labelKey: "invoice.markPaid" },
  ],
  DUE: [
    { status: "OVERDUE", labelKey: "invoice.markOverdue" },
    { status: "PAID", labelKey: "invoice.markPaid" },
  ],
  OVERDUE: [{ status: "PAID", labelKey: "invoice.markPaid" }],
  PAID: [],
};

// dueDate is a date-only business date stored as UTC midnight; the
// centralized formatDate always reads it in UTC so the shown day never
// shifts on a non-UTC server clock. Always Indonesian short form
// regardless of uiLanguage (see SPEC_RECONCILIATION.md T-01) — only the
// empty-state label is translated chrome copy.
function formatDate(value: Date | null, emptyLabel: string) {
  if (!value) return emptyLabel;
  return formatDateCentral(value);
}

// Mirrors MoneyDisplay's own formatting so the "{amount} diterima" sentence
// interpolates the same centralized, language-independent string.
function formatMoneySentence(value: number) {
  return formatMoney(value);
}

const SHARE_LOAD_ERROR = "invoice.shareLoadError";
const SHARE_CREATE_ERROR = "invoice.shareCreateError";
const SHARE_REVOKE_ERROR = "invoice.shareRevokeError";

const SHARE_PATH_PATTERN = /^\/i\/[A-Za-z0-9_-]+$/;

// The server only ever stores a hash of the share token, so the plaintext
// path is never recoverable from the API after a reload. We keep a
// best-effort copy in sessionStorage (scoped to this tab, keyed by invoice
// id) purely so the owner doesn't lose Copy/WhatsApp access to a link they
// just created in this session. It's read-and-validate-only: never used to
// fabricate a link for a share this browser didn't create.
function shareCacheKey(invoiceId: string) {
  return `dibayar-share-path:${invoiceId}`;
}

function readCachedSharePath(invoiceId: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(shareCacheKey(invoiceId));
    return raw && SHARE_PATH_PATTERN.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeCachedSharePath(invoiceId: string, path: string) {
  try {
    window.sessionStorage.setItem(shareCacheKey(invoiceId), path);
  } catch {
    // Storage may be unavailable (private mode, quota); the cache is best-effort.
  }
}

function clearCachedSharePath(invoiceId: string) {
  try {
    window.sessionStorage.removeItem(shareCacheKey(invoiceId));
  } catch {
    // Storage may be unavailable; nothing to clean up in that case.
  }
}

type ShareState =
  | { kind: "loading" }
  | { kind: "load-error"; message: string }
  | { kind: "inactive"; error: string | null }
  | { kind: "active"; link: string | null; expiresAt: string | null; error: string | null };

function isValidExpiry(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));
}

function isValidGetPayload(payload: unknown): payload is { active: boolean; expiresAt?: string | null } {
  if (typeof payload !== "object" || payload === null) return false;
  const { active, expiresAt } = payload as { active?: unknown; expiresAt?: unknown };
  return typeof active === "boolean" && isValidExpiry(expiresAt);
}

function isValidCreatePayload(payload: unknown): payload is { active: true; path: string; expiresAt?: string | null } {
  if (typeof payload !== "object" || payload === null) return false;
  const { active, path, expiresAt } = payload as { active?: unknown; path?: unknown; expiresAt?: unknown };
  return active === true && typeof path === "string" && SHARE_PATH_PATTERN.test(path) && isValidExpiry(expiresAt);
}

function isValidRevokePayload(payload: unknown): payload is { active: false } {
  return typeof payload === "object" && payload !== null && (payload as { active?: unknown }).active === false;
}

function withMutationError(prev: ShareState, message: string): ShareState {
  if (prev.kind === "inactive") return { kind: "inactive", error: message };
  if (prev.kind === "active") return { ...prev, error: message };
  return { kind: "load-error", message };
}

function clearMutationError(prev: ShareState): ShareState {
  if (prev.kind === "inactive") return { kind: "inactive", error: null };
  if (prev.kind === "active") return { ...prev, error: null };
  return prev;
}

function formatShareExpiry(expiresAt: string | null, t: (key: string, values?: Record<string, string>) => string): string {
  if (!expiresAt) return t("invoice.activeNoExpiry");
  return t("invoice.activeUntil", { date: formatDateCentral(expiresAt) });
}

type ShareConfirm = "regenerate" | "revoke" | null;

type ContactStatus = "loading" | "loaded" | "error";

// Extracted so the share state machine (load/create/regenerate/revoke) is
// owned in exactly one place, but can drive both the primary WhatsApp action
// promoted into the top invoice card (Task 2) and the full share detail
// section below it, without either owning a duplicate copy of the state.
function useShareState(invoiceId: string) {
  const [share, setShare] = useState<ShareState>({ kind: "loading" });
  const [pendingAction, setPendingAction] = useState<"create" | "revoke" | null>(null);
  const isBusy = pendingAction !== null;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadShareState = useCallback(async () => {
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoiceId}/share`);
      const payload = await response.json();
      if (!mountedRef.current) return;
      if (!response.ok || !isValidGetPayload(payload)) {
        setShare({ kind: "load-error", message: SHARE_LOAD_ERROR });
        return;
      }
      if (!payload.active) {
        clearCachedSharePath(invoiceId);
        setShare({ kind: "inactive", error: null });
        return;
      }
      const cachedPath = readCachedSharePath(invoiceId);
      setShare({
        kind: "active",
        link: cachedPath ? `${window.location.origin}${cachedPath}` : null,
        expiresAt: payload.expiresAt ?? null,
        error: null,
      });
    } catch {
      if (mountedRef.current) setShare({ kind: "load-error", message: SHARE_LOAD_ERROR });
    }
  }, [invoiceId]);

  useEffect(() => {
    // Defer to a microtask so the effect body doesn't synchronously invoke a
    // state-setting loader (react-hooks/set-state-in-effect); the loader's
    // own mountedRef check still guards against post-unmount updates.
    queueMicrotask(() => {
      loadShareState();
    });
  }, [loadShareState]);

  const retryLoad = useCallback(() => {
    setShare({ kind: "loading" });
    loadShareState();
  }, [loadShareState]);

  const createOrRegenerate = useCallback(async () => {
    setPendingAction("create");
    setShare((prev) => clearMutationError(prev));
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoiceId}/share`, { method: "POST" });
      const payload = await response.json();
      if (!mountedRef.current) return null;
      if (!response.ok || !isValidCreatePayload(payload)) {
        setShare((prev) => withMutationError(prev, SHARE_CREATE_ERROR));
        return null;
      }
      writeCachedSharePath(invoiceId, payload.path);
      const link = `${window.location.origin}${payload.path}`;
      setShare({
        kind: "active",
        link,
        expiresAt: payload.expiresAt ?? null,
        error: null,
      });
      return link;
    } catch {
      if (mountedRef.current) setShare((prev) => withMutationError(prev, SHARE_CREATE_ERROR));
      return null;
    } finally {
      if (mountedRef.current) setPendingAction(null);
    }
  }, [invoiceId]);

  const revoke = useCallback(async () => {
    setPendingAction("revoke");
    setShare((prev) => clearMutationError(prev));
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoiceId}/share`, { method: "DELETE" });
      const payload = await response.json();
      if (!mountedRef.current) return;
      if (!response.ok || !isValidRevokePayload(payload)) {
        setShare((prev) => withMutationError(prev, SHARE_REVOKE_ERROR));
        return;
      }
      clearCachedSharePath(invoiceId);
      setShare({ kind: "inactive", error: null });
    } catch {
      if (mountedRef.current) setShare((prev) => withMutationError(prev, SHARE_REVOKE_ERROR));
    } finally {
      if (mountedRef.current) setPendingAction(null);
    }
  }, [invoiceId]);

  return { share, setShare, isBusy, pendingAction, retryLoad, createOrRegenerate, revoke };
}

function ShareSection({
  invoice,
  displayStatus,
  contactWa,
  contactStatus,
  onRetryContact,
  share,
  isBusy,
  pendingAction,
  retryLoad,
  createOrRegenerate,
  revoke,
  language,
  t,
}: {
  invoice: InvoiceRecord;
  displayStatus: InvoiceRecord["status"];
  contactWa: string | null;
  contactStatus: ContactStatus;
  onRetryContact: () => void;
  share: ShareState;
  isBusy: boolean;
  pendingAction: "create" | "revoke" | null;
  retryLoad: () => void;
  createOrRegenerate: () => Promise<string | null>;
  revoke: () => Promise<void>;
  language: Language;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const [confirm, setConfirm] = useState<ShareConfirm>(null);

  async function handleCreateOrRegenerate() {
    setConfirm(null);
    await createOrRegenerate();
  }

  async function handleRevoke() {
    setConfirm(null);
    await revoke();
  }

  const reminder = buildWhatsAppReminder({
    contactWa,
    shareUrl: share.kind === "active" ? share.link : null,
    invoiceNumber: invoice.number,
    totalIdr: invoice.subtotalIdr,
    dueDate: invoice.dueDate,
    isOverdue: displayStatus === "OVERDUE",
  });
  const whatsappHref = reminder.kind === "ok" ? reminder.href : null;

  return (
    <section aria-labelledby="bagikan-invoice" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="bagikan-invoice" className="text-[18px] font-bold text-ink">{t("invoice.share")}</h2>
      <p className="mt-1 text-[13px] text-muted">{t("invoice.shareHint")}</p>

      {share.kind === "loading" ? <p className="mt-3 text-[14px] text-muted">{t("invoice.loading")}</p> : null}
      {share.kind === "load-error" ? (
        <>
          <p role="alert" className="mt-3 text-[13px] text-overdue">{t(share.message)}</p>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-3 inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
          >
            {t("invoice.retry")}
          </button>
        </>
      ) : null}

      {share.kind === "inactive" ? (
        <>
          {share.error ? <p role="alert" className="mt-3 text-[13px] text-overdue">{t(share.error)}</p> : null}
          <p className="mt-3 text-[14px] text-muted">{t("invoice.inactive")}</p>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleCreateOrRegenerate}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
          >
            {isBusy ? t("invoice.creating") : t("invoice.create")}
          </button>
        </>
      ) : null}

      {share.kind === "active" ? (
        <>
          {share.error ? <p role="alert" className="mt-3 text-[13px] text-overdue">{t(share.error)}</p> : null}
          <p className="mt-3 text-[14px] font-semibold text-paid">{t("invoice.active")}</p>
          <p className="mt-1 text-[13px] text-muted">{formatShareExpiry(share.expiresAt, t)}</p>
          {share.link ? (
            <div className="mt-3">
              <ShareLinkField url={share.link} language={language} />
            </div>
          ) : null}
          <div className="mt-3 rounded-xl bg-bg p-3">
            <p className="text-[13px] font-semibold text-ink">{t("invoice.whatsapp")}</p>
            {contactStatus === "error" ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p role="alert" className="text-[13px] text-overdue">{t("invoice.contactLoadError")}</p>
                <button
                  type="button"
                  onClick={onRetryContact}
                  className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
                >
                  {t("invoice.retry")}
                </button>
              </div>
            ) : (
              <p className="mt-1 text-[13px] text-muted">
                {reminder.kind === "no-contact"
                  ? t("invoice.noContact")
                  : reminder.kind === "no-share"
                    ? t("invoice.shareLinkUnavailable")
                    : reminder.kind === "no-duedate"
                      ? t("invoice.needDueDate")
                      : t("invoice.bahasaReady")}
              </p>
            )}
            <button
              type="button"
              disabled={!whatsappHref}
              onClick={() => whatsappHref && window.open(whatsappHref, "_blank", "noopener,noreferrer")}
              className="mt-3 inline-flex h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("invoice.openWhatsApp")}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirm("regenerate")}
              className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
            >
              {t("invoice.regenerate")}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirm("revoke")}
              className="inline-flex h-11 items-center rounded-full border border-overdue px-4 text-[14px] font-semibold text-overdue disabled:cursor-wait disabled:opacity-60"
            >
              {t("invoice.revoke")}
            </button>
          </div>

          {confirm === "regenerate" ? (
            <div className="mt-3 rounded-xl bg-bg p-3">
              <p className="text-[13px] font-semibold text-overdue">
                {t("invoice.regenerateWarning")}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
                >
                  {t("invoice.cancel")}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleCreateOrRegenerate}
                  className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
                >
                  {pendingAction === "create" ? t("invoice.creating") : t("invoice.confirmRegenerate")}
                </button>
              </div>
            </div>
          ) : null}

          {confirm === "revoke" ? (
            <div className="mt-3 rounded-xl bg-bg p-3">
              <p className="text-[13px] font-semibold text-overdue">
                {t("invoice.revokeWarning")}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
                >
                  {t("invoice.cancel")}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleRevoke}
                  className="inline-flex h-11 items-center rounded-full bg-overdue px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
                >
                  {pendingAction === "revoke" ? t("invoice.revoking") : t("invoice.confirmRevoke")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default function InvoiceDetailClient({
  initialInvoice,
  now,
  hasIncompleteIssuer = false,
}: {
  initialInvoice: InvoiceRecord;
  now?: Date;
  hasIncompleteIssuer?: boolean;
}) {
  const { language, t } = useLanguage();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [contactWa, setContactWa] = useState<string | null>(null);
  const [contactStatus, setContactStatus] = useState<ContactStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [paidMoment, setPaidMoment] = useState(false);
  const [dueDateInput, setDueDateInput] = useState(() => {
    const normalized = normalizeDueDate(initialInvoice.dueDate);
    return normalized ? getDueDateCalendarDate(normalized) : "";
  });
  const [dueDateError, setDueDateError] = useState<string | null>(null);
  const [isSavingDueDate, setIsSavingDueDate] = useState(false);

  const referenceNow = now ?? new Date();
  const normalizedDueDate = normalizeDueDate(invoice.dueDate);
  const displayStatus = deriveInvoiceDisplayStatus({ status: invoice.status, dueDate: normalizedDueDate }, referenceNow);
  const shareState = useShareState(invoice.id);
  const [isSharingToWhatsApp, setIsSharingToWhatsApp] = useState(false);

  // Split from the retry trigger below so the effect only ever invokes a
  // function that sets state from within a promise callback, never
  // synchronously during the effect body itself (react-hooks/set-state-in-effect).
  // The initial "loading" state comes from useState; only an explicit retry
  // needs to reset it back to "loading" before refetching.
  const fetchContact = useCallback(() => {
    let cancelled = false;
    fetchWithTimeout(`/api/invoices/${invoice.id}/contact`)
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (response.ok && typeof payload.contactWa === "string") {
          setContactWa(payload.contactWa);
          setContactStatus("loaded");
        } else if (response.ok) {
          // No contact on the deal is a legitimate loaded state, not an error.
          setContactStatus("loaded");
        } else {
          setContactStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setContactStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  useEffect(() => {
    return fetchContact();
  }, [fetchContact]);

  const retryContact = useCallback(() => {
    setContactStatus("loading");
    fetchContact();
  }, [fetchContact]);

  async function updateStatus(status: InvoiceRecord["status"]) {
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("invoice.statusUpdateError");
      setInvoice(payload.invoice);
      if (status === "PAID" && invoice.status !== "PAID") {
        triggerPaidHaptic();
        setPaidMoment(true);
        window.setTimeout(() => setPaidMoment(false), 2600);
      }
    } catch {
      setError("invoice.statusUpdateError");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDueDate(nextValue: string | null) {
    setDueDateError(null);
    setIsSavingDueDate(true);
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: nextValue }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("invoice.dueDateUpdateError");
      setInvoice(payload.invoice);
      setDueDateInput(nextValue ?? "");
    } catch {
      setDueDateError("invoice.dueDateUpdateError");
    } finally {
      setIsSavingDueDate(false);
    }
  }

  // Primary top-card action: a plain "here's my invoice" share, distinct
  // from the overdue-reminder composer in ShareSection below. It never
  // fabricates a due date, payment status, or tax detail, so it stays
  // available even before the invoice has a due date set.
  function openWhatsAppShare(shareUrl: string) {
    const share = buildWhatsAppShare({
      contactWa,
      shareUrl,
      invoiceNumber: invoice.number,
      totalIdr: invoice.subtotalIdr,
    });
    if (share.kind === "ok") {
      window.open(share.href, "_blank", "noopener,noreferrer");
    }
  }

  // When a link is already active and usable, share immediately; otherwise
  // create one first, then share. This never duplicates the ShareSection
  // state machine — it drives the same useShareState hook the section below
  // renders from.
  async function handleShareViaWhatsApp() {
    setIsSharingToWhatsApp(true);
    try {
      if (shareState.share.kind === "active" && shareState.share.link) {
        openWhatsAppShare(shareState.share.link);
        return;
      }
      const link = await shareState.createOrRegenerate();
      if (link) openWhatsAppShare(link);
    } finally {
      setIsSharingToWhatsApp(false);
    }
  }

  const canShareViaWhatsApp =
    shareState.share.kind !== "loading" &&
    !(shareState.share.kind === "active" && !shareState.share.link) &&
    Boolean(normalizeWhatsAppNumber(contactWa ?? ""));

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 py-8 sm:px-8">
      <Link href="/dashboard" className="inline-flex w-fit text-[14px] font-semibold text-primary">
        ← {t("invoice.back")}
      </Link>

      {paidMoment ?<div role="status" aria-live="polite" className="rounded-md border border-paid/30 bg-paid-tint px-4 py-3 text-[14px] font-semibold text-paid">{t("invoice.paidMoment")}</div> : null}

      <header className="rounded-md border border-line border-t-[3px] border-t-primary bg-surface p-6 shadow-md">
        <p className="text-[13px] font-semibold text-muted">{invoice.number}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1><MoneyDisplay value={invoice.subtotalIdr} language={language} size="hero" /></h1>
          <StatusChip status={displayStatus} language={language} />
        </div>

        {displayStatus === "PAID" ? (
          <div className="mt-3 rounded-xl bg-paid-tint p-4">
            <p className="text-[14px] font-semibold text-paid">
              {t("invoice.paidStatusNote")}
            </p>
            <p className="mt-2 text-[15px] font-semibold text-paid">
              {t("invoice.amountReceived", { amount: formatMoneySentence(invoice.subtotalIdr) })}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-3 text-[14px] text-muted">{t("invoice.dueLabel", { date: formatDate(normalizedDueDate, t("invoice.notSet")) })}</p>

            <div className="mt-3">
              <label htmlFor="invoice-due-date" className="text-[13px] font-semibold text-ink">
                {t("invoice.dueDateFieldLabel")}
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  id="invoice-due-date"
                  name="invoice-due-date"
                  type="date"
                  lang={language === "id" ? "id-ID" : "en-US"}
                  value={dueDateInput}
                  onChange={(event) => setDueDateInput(event.target.value)}
                  className={fieldClassName}
                />
                <Button
                  type="button"
                  disabled={isSavingDueDate || !dueDateInput}
                  loading={isSavingDueDate}
                  loadingLabel={t("invoice.saving")}
                  onClick={() => saveDueDate(dueDateInput)}
                >
                  {t("invoice.dueDateSave")}
                </Button>
                {invoice.dueDate ? (
                  <button
                    type="button"
                    disabled={isSavingDueDate}
                    onClick={() => saveDueDate(null)}
                    className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
                  >
                    {t("invoice.dueDateClear")}
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-[12px] text-muted">{t("invoice.dueDateFormatHint")}</p>
              {dueDateError ? <p role="alert" className="mt-2 text-[13px] text-overdue">{t(dueDateError)}</p> : null}
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canShareViaWhatsApp || isSharingToWhatsApp || shareState.isBusy}
            aria-busy={isSharingToWhatsApp || undefined}
            onClick={handleShareViaWhatsApp}
            className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSharingToWhatsApp ? t("invoice.creating") : t("invoice.shareViaWhatsApp")}
          </button>
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
          >
            {t("invoice.downloadPdf")}
          </a>
        </div>
      </header>

      <section aria-labelledby="rincian-invoice" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="rincian-invoice" className="text-[18px] font-bold text-ink">{t("invoice.details")}</h2>
        <dl className="mt-4 grid gap-3 text-[15px]">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">{t("invoice.number")}</dt>
            <dd className="font-semibold text-ink">{invoice.number}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">{t("invoice.withholdingTax")}</dt>
            <dd className="font-semibold text-ink">
              {invoice.withholdingTaxType === "NONE"
                ? t("invoice.none")
                : `${invoice.withholdingTaxType.replace("PPH", "PPh ")} ${t("invoice.withholdingRate", { rate: `${PPH_RATES[invoice.withholdingTaxType] * 100}%` })}`}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">{t("invoice.amount")}</dt>
            <dd><MoneyDisplay value={invoice.subtotalIdr} language={language} size="card" /></dd>
          </div>
        </dl>
        {invoice.withholdingTaxType === "NONE" ? (
          <p className="mt-3 text-[12px] text-muted">{t("invoice.withholdingNone")}</p>
        ) : null}
      </section>

      {displayStatus !== "PAID" ? (
        <section aria-labelledby="status-invoice" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="status-invoice" className="text-[18px] font-bold text-ink">{t("invoice.paymentStatus")}</h2>
          <p className="mt-1 text-[13px] text-muted">{t("invoice.paymentStatusHint")}</p>
          {error ? <p role="alert" className="mt-3 text-[13px] text-overdue">{t(error)}</p> : null}
          {NEXT_ACTIONS[invoice.status].length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {NEXT_ACTIONS[invoice.status].map((action) => (
                <Button
                  key={action.status}
                  type="button"
                  disabled={isSaving}
                  loading={isSaving}
                  loadingLabel={t("invoice.saving")}
                  onClick={() => updateStatus(action.status)}
                >
                  {t(action.labelKey)}
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-paid/10 px-3 py-2 text-[14px] font-semibold text-paid">{t("invoice.alreadyPaid")}</p>
          )}
        </section>
      ) : null}

      {hasIncompleteIssuer ? (
        <div role="status" className="rounded-md border border-due bg-due-tint px-4 py-3 text-[14px] text-ink">
          {t("invoice.settingsDependencyNotice")}
        </div>
      ) : null}

      <ShareSection
        invoice={invoice}
        displayStatus={displayStatus}
        contactWa={contactWa}
        contactStatus={contactStatus}
        onRetryContact={retryContact}
        share={shareState.share}
        isBusy={shareState.isBusy}
        pendingAction={shareState.pendingAction}
        retryLoad={shareState.retryLoad}
        createOrRegenerate={shareState.createOrRegenerate}
        revoke={shareState.revoke}
        language={language}
        t={t}
      />
    </main>
  );
}
