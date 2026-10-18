"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { InvoiceRecord } from "@/lib/invoices";
import { deriveInvoiceDisplayStatus } from "@/lib/invoice-date-status";
import { DUE_DATE_MAX, DUE_DATE_MIN, storedDueDateToInputValue } from "@/lib/due-date";
import { buildInvoiceWhatsApp, normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { openWhatsAppPopup, type WhatsAppPopup } from "@/lib/whatsapp-popup";
import { useLanguage } from "@/components/language-switcher";
import { MoneyDisplay, StatusChip, Button, fieldClassName } from "@/components/design-system";
import { ShareLinkField } from "@/components/invoices/share-link-field";
import { DateField, type DateFieldCommitResult } from "@/components/date-field";
import type { Language } from "@/lib/i18n";
import { triggerPaidHaptic } from "@/lib/haptics";
import { fetchWithTimeout } from "@/lib/http";
import { bodyField, mutationErrorKey, sendMutation } from "@/lib/mutation";
import { PPH_RATES } from "@/lib/income-summary";
import { formatMoney } from "@/lib/format/money";
import { formatDate as formatDateCentral } from "@/lib/format/date";
import { DEFAULT_TEMPLATE_SEND, DEFAULT_TEMPLATE_CHASE } from "@/lib/user-settings-validation";

// Fetch responses round-trip dueDate through JSON (a string), while the
// server-rendered initial invoice carries a real Date; normalize both to a
// Date before any date-math so derivation never sees an unparsed string.
function normalizeDueDate(value: InvoiceRecord["dueDate"]): Date | null {
  return value ? new Date(value) : null;
}

type NextAction = { status: InvoiceRecord["status"]; labelKey: string; variant?: "primary" | "secondary" };

const NEXT_ACTIONS: Record<InvoiceRecord["status"], NextAction[]> = {
  DRAFT: [{ status: "SENT", labelKey: "invoice.markSent" }],
  SENT: [
    { status: "DUE", labelKey: "invoice.markDue" },
    { status: "PAID", labelKey: "invoice.markPaid" },
  ],
  // No action leads to OVERDUE: it is derived from the due date, never set
  // by hand (FIND-01; the server rejects it too, see ALLOWED_STATUS_TRANSITIONS).
  DUE: [{ status: "PAID", labelKey: "invoice.markPaid" }],
  OVERDUE: [{ status: "PAID", labelKey: "invoice.markPaid" }],
  // T-19: undo, not a forward step -- kept visually distinct (secondary
  // variant) so it doesn't read as just another "mark as..." action.
  PAID: [{ status: "SENT", labelKey: "invoice.undoMarkPaid", variant: "secondary" }],
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

// The server can recover an active share's plaintext path itself now (see
// share-token-crypto.ts / getShareState) by decrypting a stored ciphertext --
// it's still only ever verified via tokenHash on the public /i/[token] path,
// the ciphertext exists solely for this authenticated recovery. This
// sessionStorage copy (scoped to this tab, keyed by invoice id) remains as a
// fast local fallback for a share created before that column existed, or if
// decryption ever fails; both cases degrade to exactly the pre-encryption
// behavior. It's read-and-validate-only: never used to fabricate a link for a
// share this browser didn't create.
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
  // The link is dead and is neither shown nor sent (FIND-07); only the date
  // it ended is kept, to say so.
  | { kind: "expired"; expiresAt: string; error: string | null }
  // `linkRecoverable` is false when the server couldn't recover the path and
  // `link`, if any, came from this tab's sessionStorage cache.
  | { kind: "active"; link: string | null; linkRecoverable: boolean; expiresAt: string | null; error: string | null };

function isValidExpiry(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));
}

function isValidGetPayload(
  payload: unknown,
): payload is { active: boolean; expired?: boolean; path?: string | null; expiresAt?: string | null } {
  if (typeof payload !== "object" || payload === null) return false;
  const { active, expired, path, expiresAt } = payload as { active?: unknown; expired?: unknown; path?: unknown; expiresAt?: unknown };
  const validPath = path === undefined || path === null || (typeof path === "string" && SHARE_PATH_PATTERN.test(path));
  // An expired share is never also active, and always says when it ended.
  const validExpired = expired === undefined || expired === false || (expired === true && active === false && typeof expiresAt === "string");
  return typeof active === "boolean" && validPath && validExpired && isValidExpiry(expiresAt);
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
  if (prev.kind === "active" || prev.kind === "expired") return { ...prev, error: message };
  return { kind: "load-error", message };
}

function clearMutationError(prev: ShareState): ShareState {
  if (prev.kind === "inactive") return { kind: "inactive", error: null };
  if (prev.kind === "active" || prev.kind === "expired") return { ...prev, error: null };
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
// promoted into the top invoice card and the full share detail section
// below it, without either owning a duplicate copy of the state.
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
        setShare(
          payload.expired && payload.expiresAt
            ? { kind: "expired", expiresAt: payload.expiresAt, error: null }
            : { kind: "inactive", error: null },
        );
        return;
      }
      // Prefer the server's own decrypted path -- it's authoritative and
      // survives a reload/new tab/session on its own. The sessionStorage
      // cache is only consulted as a fallback for a share created before
      // tokenCiphertext existed (or one whose ciphertext failed to decrypt),
      // and is refreshed here so it stays consistent with the server either way.
      const resolvedPath = payload.path ?? readCachedSharePath(invoiceId);
      if (payload.path) writeCachedSharePath(invoiceId, payload.path);
      setShare({
        kind: "active",
        link: resolvedPath ? `${window.location.origin}${resolvedPath}` : null,
        linkRecoverable: Boolean(payload.path),
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

  // Both link-issuing requests answer in the same shape and leave the page
  // in the same state: an active share showing the returned link.
  const requestLink = useCallback(async (endpoint: "share" | "share/ensure") => {
    setPendingAction("create");
    setShare((prev) => clearMutationError(prev));
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoiceId}/${endpoint}`, { method: "POST" });
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
        linkRecoverable: true,
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

  // The explicit, destructive operation: always a new token, so a link
  // already sent stops working ("Buat tautan berbagi" / "Buat ulang tautan").
  const createOrRegenerate = useCallback(() => requestLink("share"), [requestLink]);

  // A link to send: the server reuses the invoice's usable link and issues a
  // new one only when there is none or it has expired (ensureShare, the same
  // contract as the Beranda reminder). The server decides, so an expired link
  // is never sent, even from a page that loaded before it expired.
  const ensureLink = useCallback(() => requestLink("share/ensure"), [requestLink]);

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

  return { share, setShare, isBusy, pendingAction, retryLoad, createOrRegenerate, ensureLink, revoke };
}

// §4.5 item 3: just the link field + copy/regenerate/revoke management. The
// per-share WhatsApp button that used to live here is gone -- the header's
// primary action (Kirim lewat WhatsApp / Kirim pengingat) now owns that job
// for both the plain-share and overdue-reminder cases, so this section never
// duplicates it.
function ShareSection({
  share,
  isBusy,
  pendingAction,
  retryLoad,
  createOrRegenerate,
  revoke,
  language,
  t,
}: {
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

  return (
    <section aria-labelledby="bagikan-invoice" className="rounded-2xl border border-line bg-surface p-4 min-[360px]:p-5">
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

      {share.kind === "expired" ? (
        <>
          {share.error ? <p role="alert" className="mt-3 text-[13px] text-overdue">{t(share.error)}</p> : null}
          <p className="mt-3 text-[14px] font-semibold text-overdue">{t("invoice.shareExpired")}</p>
          <p className="mt-1 text-[13px] text-muted">{t("invoice.shareExpiredOn", { date: formatDateCentral(share.expiresAt) })}</p>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleCreateOrRegenerate}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
          >
            {isBusy ? t("invoice.creating") : t("invoice.createNew")}
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

          <div className="mt-3 flex flex-col gap-2 min-[360px]:flex-row min-[360px]:flex-wrap">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirm("regenerate")}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60 min-[360px]:w-auto"
            >
              {t("invoice.regenerate")}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirm("revoke")}
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-overdue px-4 text-[14px] font-semibold text-overdue disabled:cursor-wait disabled:opacity-60 min-[360px]:w-auto"
            >
              {t("invoice.revoke")}
            </button>
          </div>

          {confirm === "regenerate" ? (
            <div className="mt-3 rounded-xl bg-bg p-3">
              <p className="text-[13px] font-semibold text-overdue">
                {t("invoice.regenerateWarning")}
              </p>
              <div className="mt-3 flex flex-col gap-2 min-[360px]:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink min-[360px]:w-auto"
                >
                  {t("invoice.cancel")}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleCreateOrRegenerate}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60 min-[360px]:w-auto"
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
              <div className="mt-3 flex flex-col gap-2 min-[360px]:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink min-[360px]:w-auto"
                >
                  {t("invoice.cancel")}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleRevoke}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-overdue px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60 min-[360px]:w-auto"
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
  documentFrozen = false,
  templateSend = DEFAULT_TEMPLATE_SEND,
  templateChase = DEFAULT_TEMPLATE_CHASE,
}: {
  initialInvoice: InvoiceRecord;
  now?: Date;
  hasIncompleteIssuer?: boolean;
  // Decision A: the document was sent or shared and no longer follows the
  // deal or Settings.
  documentFrozen?: boolean;
  templateSend?: string;
  templateChase?: string;
}) {
  const { language, t } = useLanguage();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [contactWa, setContactWa] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  // The brand the invoice document names (its snapshot once frozen), used
  // in the WhatsApp message so it matches the linked invoice.
  const [documentBrand, setDocumentBrand] = useState<string | null>(null);
  const [contactStatus, setContactStatus] = useState<ContactStatus>("loading");
  const [contactWaDraft, setContactWaDraft] = useState("");
  const [isSavingContactWa, setIsSavingContactWa] = useState(false);
  const [contactWaMessage, setContactWaMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [showContactRepair, setShowContactRepair] = useState(false);
  const [whatsAppBlockedHref, setWhatsAppBlockedHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [paidMoment, setPaidMoment] = useState(false);

  const referenceNow = now ?? new Date();
  const normalizedDueDate = normalizeDueDate(invoice.dueDate);
  // A stored due date outside the supported contract (e.g. a legacy year-0002
  // row from before the API enforced it) renders as an explicit, correctable
  // problem in the field rather than crashing the page or posing as a date.
  const storedDueDateValue = invoice.dueDate ? storedDueDateToInputValue(invoice.dueDate) : null;
  const hasInvalidStoredDueDate = invoice.dueDate !== null && storedDueDateValue === null;
  const dueDateRange = { min: formatDateCentral(DUE_DATE_MIN), max: formatDateCentral(DUE_DATE_MAX) };
  const displayStatus = deriveInvoiceDisplayStatus({ status: invoice.status, dueDate: normalizedDueDate }, referenceNow);
  const isOverdue = displayStatus === "OVERDUE";
  // Actions follow the stored status (what the server will accept), minus
  // "mark due" on an invoice already shown as overdue.
  const nextActions = NEXT_ACTIONS[invoice.status].filter((action) => !(isOverdue && action.status === "DUE"));
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
        if (typeof payload.brand === "string") setBrand(payload.brand);
        if (typeof payload.documentBrand === "string") setDocumentBrand(payload.documentBrand);
        if (response.ok && typeof payload.contactWa === "string") {
          setContactWa(payload.contactWa);
          setContactWaDraft(payload.contactWa);
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

  // F15: the invoice's contact IS the deal's contact, there is no separate
  // copy, so repairing it here writes back to the deal (mirroring
  // deal-detail-client's own repair flow). A valid save goes straight into
  // sendWhatsApp so the fix and the send happen in one step, rather than
  // making the owner close the repair panel and press the primary button
  // again.
  async function handleSaveContactWa() {
    // Opened by the tap itself, before the save's awaits, so it is not
    // blocked for lacking a user gesture (see openWhatsAppPopup). A draft that
    // can't be a WhatsApp number even before saving never opens a tab.
    // A number WhatsApp can't open is refused by the server too; say what is
    // wrong with it rather than "try again", and send nothing (#50).
    if (!normalizeWhatsAppNumber(contactWaDraft)) {
      setContactWaMessage({ kind: "error", text: t("dealForm.error.contactWa") });
      return;
    }
    const popup = openWhatsAppPopup(t("whatsapp.opening"));
    let handedOff = false;
    setIsSavingContactWa(true);
    setContactWaMessage(null);
    try {
      const response = await fetchWithTimeout(`/api/deals/${invoice.dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactWa: contactWaDraft }),
      });
      const payload = await response.json();
      if (response.status === 400) {
        setContactWaMessage({ kind: "error", text: t("dealForm.error.contactWa") });
        return;
      }
      if (!response.ok || typeof payload.deal?.contactWa !== "string") throw new Error("invoice.contactRepairError");
      const readBackResponse = await fetchWithTimeout(`/api/deals/${invoice.dealId}`);
      const readBackPayload = await readBackResponse.json();
      if (
        !readBackResponse.ok ||
        readBackPayload.deal?.id !== invoice.dealId ||
        readBackPayload.deal?.contactWa !== payload.deal.contactWa
      ) throw new Error("invoice.contactRepairError");
      const savedNumber: string = readBackPayload.deal.contactWa;
      setContactWa(savedNumber);
      setContactWaDraft(savedNumber);
      if (normalizeWhatsAppNumber(savedNumber)) {
        setShowContactRepair(false);
        setContactWaMessage({ kind: "success", text: t("invoice.contactRepairSaved") });
        handedOff = true;
        await sendWhatsApp(savedNumber, popup);
      } else {
        setContactWaMessage({ kind: "error", text: t("invoice.contactRepairError") });
      }
    } catch {
      setContactWaMessage({ kind: "error", text: t("invoice.contactRepairError") });
    } finally {
      if (!handedOff) popup?.close();
      setIsSavingContactWa(false);
    }
  }

  async function updateStatus(status: InvoiceRecord["status"]) {
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // A 5xx may be a gateway that gave up while the change was being
      // stored: read it back below, as for no answer at all.
      if (response.status >= 500) throw new Error("invoice.statusUpdateUnknown");
      const payload = await response.json();
      if (!response.ok) {
        setError(mutationErrorKey({ kind: "rejected", status: response.status, body: payload }, "invoice.statusUpdateError"));
        return;
      }
      setInvoice(payload.invoice);
      if (status === "PAID" && invoice.status !== "PAID") {
        triggerPaidHaptic();
        setPaidMoment(true);
        window.setTimeout(() => setPaidMoment(false), 2600);
      }
    } catch {
      // No answer, a dropped connection, a gateway page or a 5xx: it may
      // have been stored, so show what the server holds rather than guess (#53).
      const check = await sendMutation(`/api/invoices/${invoice.id}`, { cache: "no-store" });
      const stored = check.kind === "ok" ? bodyField<InvoiceRecord>(check.body, "invoice") : undefined;
      if (stored) setInvoice(stored);
      if (stored?.status !== status) setError("error.connection");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDueDate(nextValue: string | null): Promise<DateFieldCommitResult> {
    try {
      const response = await fetchWithTimeout(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: nextValue }),
      });
      const payload = await response.json();
      if (!response.ok) return { ok: false };
      setInvoice(payload.invoice);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  // The owner's own Settings template (templateSend normally, templateChase
  // once the invoice is overdue -- T-21), resolved with the real
  // invoice/deal tokens. Asks the server for a link to send first
  // (ensureLink: the existing usable link, or a new one when there is none or
  // it has expired -- FIND-07), so this is always usable as the entry point
  // to the invoice's public link -- it never duplicates the share management
  // state in ShareSection below, it just drives the same hook. `popup` was opened by
  // the click itself (openWhatsAppPopup); null means the browser blocked it
  // (F15), and a direct link then takes its place instead of failing
  // silently. FIND-04: the old window.open(href, ..., "noopener") returned
  // null even when WhatsApp opened, so that link always appeared.
  async function sendWhatsApp(number: string, popup: WhatsAppPopup | null) {
    setWhatsAppBlockedHref(null);
    setIsSharingToWhatsApp(true);
    let handedOff = false;
    try {
      // One exception: a link the server can't recover (a share older than
      // tokenCiphertext) that this tab still remembers. The server could only
      // answer by replacing it, so send the remembered one, as before.
      const { share } = shareState;
      const link = share.kind === "active" && share.link && !share.linkRecoverable
        ? share.link
        : await shareState.ensureLink();
      if (!link) return;

      const result = buildInvoiceWhatsApp({
        contactWa: number,
        shareUrl: link,
        template: isOverdue ? templateChase : templateSend,
        brand: documentBrand ?? brand ?? "",
        invoiceNumber: invoice.number,
        totalIdr: invoice.subtotalIdr,
        // An unusable legacy date is left out of the message rather than
        // sent to the brand as "15 Jan 2".
        dueDate: hasInvalidStoredDueDate ? null : invoice.dueDate,
      });
      if (result.kind === "ok") {
        handedOff = popup?.navigate(result.href) ?? false;
        if (!handedOff) setWhatsAppBlockedHref(result.href);
      }
    } finally {
      if (!handedOff) popup?.close();
      setIsSharingToWhatsApp(false);
    }
  }

  // The header's single primary action (§4.5 item 2). F15: the button is
  // never disabled for an invalid contact -- activating it reveals the
  // repair panel instead of silently doing nothing, rather than gating the
  // button itself behind contact validity.
  async function handlePrimaryWhatsApp() {
    if (!normalizeWhatsAppNumber(contactWa ?? "")) {
      setContactWaMessage(null);
      setWhatsAppBlockedHref(null);
      setShowContactRepair(true);
      return;
    }
    setShowContactRepair(false);
    await sendWhatsApp(contactWa ?? "", openWhatsAppPopup(t("whatsapp.opening")));
  }

  const isContactUnusable = contactStatus === "loaded" && !normalizeWhatsAppNumber(contactWa ?? "");
  const isShareLinkStale = shareState.share.kind === "active" && !shareState.share.link;
  const canShareViaWhatsApp =
    contactStatus === "loaded" &&
    shareState.share.kind !== "loading" &&
    !isShareLinkStale;

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 py-8 sm:px-8 lg:max-w-[1120px]">
      <Link href="/dashboard" className="ds-tap-target inline-flex w-fit text-[14px] font-semibold text-primary">
        ← {t("invoice.back")}
      </Link>

      {paidMoment ?<div role="status" aria-live="polite" className="rounded-md border border-paid/30 bg-paid-tint px-4 py-3 text-[14px] font-semibold text-paid">{t("invoice.paidMoment")}</div> : null}

      {/* §4.5 content order (F9): 1 header, 2 primary actions, 3 share
          (right rail at LG/XL, inline after 2 below that), 4 details
          (including the due-date field), 5 PDF download. Grid placement is
          purely visual (see globals.css .ds-grid, single column below the
          1024 LG breakpoint) -- DOM order always stays 1/2/3/4/5, which is
          also the order interactive elements receive focus in. */}
      <div className="ds-grid gap-6">
        <header className="lg:col-start-1 lg:col-end-9 lg:row-start-1 rounded-md border border-line border-t-[3px] border-t-primary bg-surface p-4 shadow-md min-[360px]:p-6">
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
            <p className="mt-3 text-[14px] text-muted">{t("invoice.dueLabel", { date: hasInvalidStoredDueDate ? t("invoice.dueDateInvalidStored") : formatDate(normalizedDueDate, t("invoice.notSet")) })}</p>
          )}
        </header>

        <section
          aria-labelledby="status-invoice"
          className="lg:col-start-1 lg:col-end-9 lg:row-start-2 rounded-2xl border border-line bg-surface p-4 min-[360px]:p-5"
        >
          <h2 id="status-invoice" className="text-[18px] font-bold text-ink">{t("invoice.paymentStatus")}</h2>
          <p className="mt-1 text-[13px] text-muted">{t("invoice.paymentStatusHint")}</p>
          {error ? <p role="alert" className="mt-3 text-[13px] text-overdue">{t(error)}</p> : null}
          {contactStatus === "error" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p role="alert" className="text-[13px] text-overdue">{t("invoice.contactLoadError")}</p>
              <button
                type="button"
                onClick={retryContact}
                className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
              >
                {t("invoice.retry")}
              </button>
            </div>
          ) : null}
          <div data-ux-action-row="invoice-primary-actions" className="mt-4 flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:gap-2">
            <Button
              type="button"
              disabled={!canShareViaWhatsApp || isSharingToWhatsApp || shareState.isBusy}
              loading={isSharingToWhatsApp}
              loadingLabel={t("invoice.creating")}
              onClick={handlePrimaryWhatsApp}
              className="w-full lg:w-auto lg:px-3"
            >
              {isOverdue ? t("invoice.sendReminder") : t("invoice.shareViaWhatsApp")}
            </Button>
            {nextActions.map((action) => (
              <Button
                key={action.status}
                type="button"
                variant={action.variant}
                disabled={isSaving}
                loading={isSaving}
                loadingLabel={t("invoice.saving")}
                onClick={() => updateStatus(action.status)}
                className="w-full lg:w-auto lg:px-3"
              >
                {t(action.labelKey)}
              </Button>
            ))}
          </div>
          {contactStatus === "loaded" && isShareLinkStale ? (
            <p className="mt-2 text-[12px] text-muted">{t("invoice.shareLinkUnavailable")}</p>
          ) : null}
          {/* F15: the button above is never disabled for an invalid contact
              -- this panel only appears once the owner activates it (or a
              save attempt leaves the number still invalid), it does not
              render itself just because the number is unusable. */}
          {showContactRepair && isContactUnusable ? (
            <div className="mt-3 rounded-xl bg-bg p-3">
              <p role="alert" className="text-[13px] text-overdue">{t("whatsapp.invalidNumber")}</p>
              <p className="mt-1 text-[13px] text-ink">{t("invoice.contactSavedOnDeal", { brand: brand ?? "" })}</p>
              <label className="mt-2 flex flex-col gap-1.5 text-[13px] font-semibold text-ink" htmlFor="invoice-contact-wa">
                {t("invoice.contactRepairLabel")}
              </label>
              <div className="mt-1.5 flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center">
                <input
                  id="invoice-contact-wa"
                  name="invoice-contact-wa"
                  type="tel"
                  autoFocus
                  value={contactWaDraft}
                  onChange={(event) => setContactWaDraft(event.target.value)}
                  className={`${fieldClassName} w-full min-[360px]:min-w-0 min-[360px]:flex-1`}
                />
                <Button
                  type="button"
                  disabled={isSavingContactWa}
                  loading={isSavingContactWa}
                  loadingLabel={t("invoice.saving")}
                  onClick={handleSaveContactWa}
                  className="w-full min-[360px]:w-auto"
                >
                  {t("whatsapp.saveAndSend")}
                </Button>
              </div>
            </div>
          ) : null}
          {/* F15 fallback: rendered whenever the most recent send attempt's
              popup came back blocked, whether that attempt came
              from the primary button directly or from a repair save --
              independent of showContactRepair so it still surfaces after
              the repair panel above closes on a successful save. */}
          {whatsAppBlockedHref ? (
            <p className="mt-2 text-[13px]">
              <a
                href={whatsAppBlockedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline"
              >
                {t("whatsapp.openFallback")}
              </a>
            </p>
          ) : null}
          {/* Rendered regardless of the repair block above: a successful
              repair flips isContactUnusable to false on the same render
              that sets this message, and the repair block (which this used
              to live inside) would otherwise unmount right as the message
              appears, hiding it before anyone could read it. */}
          {contactWaMessage ? (
            <p
              role={contactWaMessage.kind === "error" ? "alert" : "status"}
              className={`mt-2 text-[13px] ${contactWaMessage.kind === "error" ? "text-overdue" : "text-paid"}`}
            >
              {contactWaMessage.text}
            </p>
          ) : null}
        </section>

        <div className="lg:col-start-9 lg:col-end-13 lg:row-start-1 lg:row-end-5">
          <ShareSection
            share={shareState.share}
            isBusy={shareState.isBusy}
            pendingAction={shareState.pendingAction}
            retryLoad={shareState.retryLoad}
            createOrRegenerate={shareState.createOrRegenerate}
            revoke={shareState.revoke}
            language={language}
            t={t}
          />
        </div>

        <section
          aria-labelledby="rincian-invoice"
          className="lg:col-start-1 lg:col-end-9 lg:row-start-3 rounded-2xl border border-line bg-surface p-4 min-[360px]:p-5"
        >
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

          <div className="mt-4 border-t border-line pt-4">
            <DateField
              id="invoice-due-date"
              label={t("invoice.dueDateFieldLabel")}
              value={storedDueDateValue ?? ""}
              lang={language === "id" ? "id-ID" : "en-US"}
              min={DUE_DATE_MIN}
              max={DUE_DATE_MAX}
              emptyLabel={t("invoice.notSet")}
              clearLabel={t("invoice.dueDateClear")}
              savingLabel={t("invoice.saving")}
              savedLabel={t("invoice.dueDateSaved")}
              errorLabel={t("invoice.dueDateUpdateError")}
              invalidInputLabel={t("invoice.dueDateInvalidInput", dueDateRange)}
              invalidStored={hasInvalidStoredDueDate}
              invalidStoredLabel={t("invoice.dueDateInvalidStored")}
              invalidStoredHint={t("invoice.dueDateInvalidStoredHint", dueDateRange)}
              onCommit={saveDueDate}
            />
          </div>

          {hasIncompleteIssuer ? (
            <div role="status" className="mt-4 rounded-md border border-due bg-due-tint px-4 py-3 text-[14px] text-ink">
              {t(documentFrozen ? "invoice.settingsFrozenNotice" : "invoice.settingsDependencyNotice")}
            </div>
          ) : null}
        </section>

        <div className="lg:col-start-1 lg:col-end-9 lg:row-start-4">
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
          >
            {t("invoice.downloadPdf")}
          </a>
        </div>
      </div>
    </main>
  );
}
