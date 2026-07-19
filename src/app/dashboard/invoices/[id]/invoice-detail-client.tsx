"use client";

import { useEffect, useState } from "react";
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

const SHARE_LOAD_ERROR = "Status berbagi belum bisa dimuat. Coba lagi.";
const SHARE_CREATE_ERROR = "Tautan berbagi belum bisa dibuat. Coba lagi.";
const SHARE_REVOKE_ERROR = "Tautan berbagi belum bisa dicabut. Coba lagi.";
const COPY_LINK_ERROR = "Tautan tidak bisa disalin otomatis. Salin secara manual.";

const SHARE_PATH_PATTERN = /^\/i\/[A-Za-z0-9_-]+$/;

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

function formatShareExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Tautan aktif tanpa batas waktu.";
  const date = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(expiresAt));
  return `Tautan aktif sampai ${date}.`;
}

type ShareConfirm = "regenerate" | "revoke" | null;

type CopyFeedback = { kind: "success" | "error"; message: string };

function ShareSection({ invoiceId }: { invoiceId: string }) {
  const [share, setShare] = useState<ShareState>({ kind: "loading" });
  const [confirm, setConfirm] = useState<ShareConfirm>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/share`);
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok || !isValidGetPayload(payload)) {
          setShare({ kind: "load-error", message: SHARE_LOAD_ERROR });
          return;
        }
        setShare(payload.active
          ? { kind: "active", link: null, expiresAt: payload.expiresAt ?? null, error: null }
          : { kind: "inactive", error: null });
      } catch {
        if (!cancelled) setShare({ kind: "load-error", message: SHARE_LOAD_ERROR });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  async function createOrRegenerate() {
    setConfirm(null);
    setCopyFeedback(null);
    setIsBusy(true);
    setShare((prev) => clearMutationError(prev));
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/share`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !isValidCreatePayload(payload)) {
        const message = typeof payload?.error === "string" ? payload.error : SHARE_CREATE_ERROR;
        setShare((prev) => withMutationError(prev, message));
        return;
      }
      setShare({
        kind: "active",
        link: `${window.location.origin}${payload.path}`,
        expiresAt: payload.expiresAt ?? null,
        error: null,
      });
    } catch {
      setShare((prev) => withMutationError(prev, SHARE_CREATE_ERROR));
    } finally {
      setIsBusy(false);
    }
  }

  async function revoke() {
    setConfirm(null);
    setCopyFeedback(null);
    setIsBusy(true);
    setShare((prev) => clearMutationError(prev));
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/share`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !isValidRevokePayload(payload)) {
        const message = typeof payload?.error === "string" ? payload.error : SHARE_REVOKE_ERROR;
        setShare((prev) => withMutationError(prev, message));
        return;
      }
      setShare({ kind: "inactive", error: null });
    } catch {
      setShare((prev) => withMutationError(prev, SHARE_REVOKE_ERROR));
    } finally {
      setIsBusy(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFeedback({ kind: "success", message: "Tautan disalin." });
    } catch {
      setCopyFeedback({ kind: "error", message: COPY_LINK_ERROR });
    }
  }

  return (
    <section aria-labelledby="bagikan-invoice" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="bagikan-invoice" className="text-[18px] font-bold text-ink">Bagikan invoice</h2>
      <p className="mt-1 text-[13px] text-muted">Buat tautan agar penerima bisa melihat invoice ini tanpa masuk akun.</p>

      {share.kind === "loading" ? <p className="mt-3 text-[14px] text-muted">Memuat status berbagi…</p> : null}
      {share.kind === "load-error" ? <p role="alert" className="mt-3 text-[13px] text-overdue">{share.message}</p> : null}

      {share.kind === "inactive" ? (
        <>
          {share.error ? <p role="alert" className="mt-3 text-[13px] text-overdue">{share.error}</p> : null}
          <p className="mt-3 text-[14px] text-muted">Belum ada tautan berbagi untuk invoice ini.</p>
          <button
            type="button"
            disabled={isBusy}
            onClick={createOrRegenerate}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
          >
            {isBusy ? "Membuat…" : "Buat tautan berbagi"}
          </button>
        </>
      ) : null}

      {share.kind === "active" ? (
        <>
          {share.error ? <p role="alert" className="mt-3 text-[13px] text-overdue">{share.error}</p> : null}
          <p className="mt-3 text-[14px] font-semibold text-paid">Tautan berbagi aktif.</p>
          <p className="mt-1 text-[13px] text-muted">{formatShareExpiry(share.expiresAt)}</p>
          {share.link ? (
            <>
              <p className="mt-2 break-all text-[13px] text-muted">{share.link}</p>
              <button
                type="button"
                onClick={() => copyLink(share.link!)}
                className="mt-3 inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
              >
                Salin tautan
              </button>
              {copyFeedback ? (
                <p
                  role={copyFeedback.kind === "error" ? "alert" : "status"}
                  className={`mt-2 text-[13px] font-semibold ${copyFeedback.kind === "error" ? "text-overdue" : "text-paid"}`}
                >
                  {copyFeedback.message}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirm("regenerate")}
              className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
            >
              Buat ulang tautan
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirm("revoke")}
              className="inline-flex h-11 items-center rounded-full border border-overdue px-4 text-[14px] font-semibold text-overdue disabled:cursor-wait disabled:opacity-60"
            >
              Cabut tautan
            </button>
          </div>

          {confirm === "regenerate" ? (
            <div className="mt-3 rounded-xl bg-bg p-3">
              <p className="text-[13px] font-semibold text-overdue">
                Tautan lama akan langsung berhenti berfungsi. Lanjutkan buat tautan baru?
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={createOrRegenerate}
                  className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
                >
                  Ya, buat tautan baru
                </button>
              </div>
            </div>
          ) : null}

          {confirm === "revoke" ? (
            <div className="mt-3 rounded-xl bg-bg p-3">
              <p className="text-[13px] font-semibold text-overdue">
                Penerima tidak akan bisa membuka invoice ini lagi. Lanjutkan cabut tautan?
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="inline-flex h-11 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={revoke}
                  className="inline-flex h-11 items-center rounded-full bg-overdue px-4 text-[14px] font-semibold text-surface disabled:cursor-wait disabled:opacity-60"
                >
                  Ya, cabut tautan
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
        <a
          href={`/api/invoices/${invoice.id}/pdf`}
          className="mt-4 inline-flex h-10 items-center rounded-full border border-line px-4 text-[14px] font-semibold text-ink"
        >
          Unduh PDF
        </a>
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

      <ShareSection invoiceId={invoice.id} />
    </main>
  );
}
