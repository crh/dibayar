"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { InvoiceRecord } from "@/lib/invoices";
import { buildWhatsAppReminder } from "@/lib/whatsapp";
import { useLanguage, LanguageSwitcher } from "@/components/language-switcher";
import { MoneyDisplay, StatusChip, Button } from "@/components/design-system";
import { triggerPaidHaptic } from "@/lib/haptics";
import { fetchWithTimeout } from "@/lib/http";
import type { Language } from "@/lib/i18n";

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

function formatDate(value: Date | null, language: Language, emptyLabel: string) {
  if (!value) return emptyLabel;
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

const SHARE_LOAD_ERROR = "invoice.shareLoadError";
const SHARE_CREATE_ERROR = "invoice.shareCreateError";
const SHARE_REVOKE_ERROR = "invoice.shareRevokeError";
const COPY_LINK_ERROR = "invoice.copyError";

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

function formatShareExpiry(expiresAt: string | null, language: Language, t: (key: string, values?: Record<string, string>) => string): string {
  if (!expiresAt) return t("invoice.activeNoExpiry");
  const date = new Intl.DateTimeFormat(language === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(expiresAt));
  return t("invoice.activeUntil", { date });
}

type ShareConfirm = "regenerate" | "revoke" | null;

type CopyFeedback = { kind: "success" | "error"; message: string };

function ShareSection({ invoiceId, invoice, contactWa, t, language }: {
  invoiceId: string;
  invoice: InvoiceRecord;
  contactWa: string | null;
  t: (key: string, values?: Record<string, string>) => string;
  language: Language;
}) {
  const [share, setShare] = useState<ShareState>({ kind: "loading" });
  const [confirm, setConfirm] = useState<ShareConfirm>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "revoke" | null>(null);
  const isBusy = pendingAction !== null;
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
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

  async function createOrRegenerate() {
    setConfirm(null);
    setCopyFeedback(null);
    setPendingAction("create");
    setShare((prev) => clearMutationError(prev));
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoiceId}/share`, { method: "POST" });
      const payload = await response.json();
      if (!mountedRef.current) return;
      if (!response.ok || !isValidCreatePayload(payload)) {
        setShare((prev) => withMutationError(prev, SHARE_CREATE_ERROR));
        return;
      }
      writeCachedSharePath(invoiceId, payload.path);
      setShare({
        kind: "active",
        link: `${window.location.origin}${payload.path}`,
        expiresAt: payload.expiresAt ?? null,
        error: null,
      });
    } catch {
      if (mountedRef.current) setShare((prev) => withMutationError(prev, SHARE_CREATE_ERROR));
    } finally {
      if (mountedRef.current) setPendingAction(null);
    }
  }

  async function revoke() {
    setConfirm(null);
    setCopyFeedback(null);
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
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFeedback({ kind: "success", message: "invoice.copySuccess" });
    } catch {
      setCopyFeedback({ kind: "error", message: COPY_LINK_ERROR });
    }
  }

  const reminder = buildWhatsAppReminder({
    contactWa,
    shareUrl: share.kind === "active" ? share.link : null,
    invoiceNumber: invoice.number,
    totalIdr: invoice.subtotalIdr,
    dueDate: invoice.dueDate,
    isOverdue: invoice.status === "OVERDUE",
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
            onClick={createOrRegenerate}
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
          <p className="mt-1 text-[13px] text-muted">{formatShareExpiry(share.expiresAt, language, t)}</p>
          {share.link ? (
            <>
              <p className="mt-2 break-all text-[13px] text-muted">{share.link}</p>
              <button
                type="button"
                onClick={() => copyLink(share.link!)}
                className="mt-3 inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
              >
                {t("invoice.copy")}
              </button>
              {copyFeedback ? (
                <p
                  role={copyFeedback.kind === "error" ? "alert" : "status"}
                  className={`mt-2 text-[13px] font-semibold ${copyFeedback.kind === "error" ? "text-overdue" : "text-paid"}`}
                >
                  {t(copyFeedback.message)}
                </p>
              ) : null}
            </>
          ) : null}
          <div className="mt-3 rounded-xl bg-bg p-3">
            <p className="text-[13px] font-semibold text-ink">{t("invoice.whatsapp")}</p>
            <p className="mt-1 text-[13px] text-muted">
              {reminder.kind === "no-contact"
                ? t("invoice.noContact")
                : reminder.kind === "no-share"
                  ? t("invoice.shareLinkUnavailable")
                  : reminder.kind === "no-duedate"
                    ? t("invoice.needDueDate")
                    : t("invoice.bahasaReady")}
            </p>
            <button
              type="button"
              disabled={!whatsappHref}
              onClick={() => whatsappHref && window.open(whatsappHref, "_blank", "noopener,noreferrer")}
              className="mt-3 inline-flex h-11 items-center rounded-full bg-[#25D366] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                  onClick={createOrRegenerate}
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
                  onClick={revoke}
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

export default function InvoiceDetailClient({ initialInvoice }: { initialInvoice: InvoiceRecord }) {
  const { language, setLanguage, t } = useLanguage();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [contactWa, setContactWa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [paidMoment, setPaidMoment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchWithTimeout(`/api/invoices/${initialInvoice.id}/contact`)
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!cancelled && response.ok && typeof payload.contactWa === "string") setContactWa(payload.contactWa);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialInvoice.id]);

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

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 py-8 sm:px-8">
      <Link href="/dashboard" className="inline-flex w-fit text-[14px] font-semibold text-primary">
        ← {t("invoice.back")}
      </Link>

      <header className="flex items-center justify-end">
        <LanguageSwitcher language={language} onChange={setLanguage} compact />
      </header>

      {paidMoment ? <div role="status" aria-live="polite" className="rounded-md border border-paid/30 bg-paid-tint px-4 py-3 text-[14px] font-semibold text-paid">{t("invoice.paidMoment")}</div> : null}

      <header className="rounded-md border border-line border-t-[3px] border-t-primary bg-surface p-6 shadow-md">
        <p className="text-[13px] font-semibold text-muted">{invoice.number}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1><MoneyDisplay value={invoice.subtotalIdr} language={language} size="hero" /></h1>
          <StatusChip status={invoice.status} language={language} />
        </div>
        <p className="mt-3 text-[14px] text-muted">{t("invoice.dueLabel", { date: formatDate(invoice.dueDate, language, t("invoice.notSet")) })}</p>
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          className="mt-4 inline-flex h-10 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
        >
          {t("invoice.downloadPdf")}
        </a>
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
            <dd className="font-semibold text-ink">{invoice.withholdingTaxType === "NONE" ? t("invoice.none") : invoice.withholdingTaxType.replace("PPH", "PPh ")}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">{t("invoice.amount")}</dt>
            <dd><MoneyDisplay value={invoice.subtotalIdr} language={language} size="card" /></dd>
          </div>
        </dl>
      </section>

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

      <ShareSection invoiceId={invoice.id} invoice={invoice} contactWa={contactWa} t={t} language={language} />
    </main>
  );
}
