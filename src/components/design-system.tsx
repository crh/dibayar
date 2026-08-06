import type { ReactNode } from "react";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";
import { translate, type Language } from "@/lib/i18n";
import { formatMoney } from "@/lib/format/money";

export type PipelineStage = DealRecord["status"];
export type InvoiceStatus = InvoiceRecord["status"];

type ButtonVariant = "primary" | "secondary" | "destructive";

export function Button({
  children,
  variant = "primary",
  loading = false,
  loadingLabel = "Menyimpan…",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: ReactNode;
}) {
  return (
    <button
      {...props}
      className={`ds-button ds-button-${variant} inline-flex items-center justify-center px-5 ${className}`}
      aria-busy={loading || undefined}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

const PIPELINE_CHIP: Record<PipelineStage, { key: string; className: string }> = {
  MASUK: { key: "stage.inbox", className: "border-line bg-line text-muted" },
  NEGO: { key: "stage.negotiation", className: "border-primary-tint bg-primary-tint text-primary-d" },
  DEAL: { key: "stage.deal", className: "border-primary-tint bg-primary-tint text-primary-d" },
  KONTEN: { key: "stage.content", className: "border-due bg-due-tint text-ink" },
  INVOICE: { key: "stage.invoice", className: "border-due bg-due text-ink" },
  DIBAYAR: { key: "stage.paid", className: "border-paid bg-paid text-surface" },
};

const INVOICE_CHIP: Record<InvoiceStatus, { key: string; className: string }> = {
  DRAFT: { key: "invoice.draft", className: "border-line bg-line text-muted" },
  SENT: { key: "invoice.sent", className: "border-primary-tint bg-primary-tint text-primary-d" },
  DUE: { key: "invoice.due", className: "border-due bg-due-tint text-ink" },
  OVERDUE: { key: "invoice.overdue", className: "border-overdue bg-overdue text-surface" },
  PAID: { key: "invoice.paid", className: "border-paid bg-paid text-surface" },
};

export function StatusChip({ status, language = "id" }: { status: PipelineStage | InvoiceStatus; language?: Language }) {
  const item = status in PIPELINE_CHIP ? PIPELINE_CHIP[status as PipelineStage] : INVOICE_CHIP[status as InvoiceStatus];
  const label = translate(language, item.key);
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-[11px] font-bold uppercase tracking-wide ${item.className}`}>{label}{status === "DIBAYAR" || status === "PAID" ? " ✓" : ""}</span>;
}

// `language` stays in the prop API for call-site compatibility, but money is
// always the centralized formatMoney output — never IDR/comma grouping, even
// under an English UI (see SPEC_RECONCILIATION.md T-01).
export function MoneyDisplay({ value, tone = "default", size = "card" }: { value: number; language?: "id" | "en"; tone?: "default" | "paid" | "negative" | "primary"; size?: "card" | "hero" }) {
  const toneClass = tone === "paid" ? "text-paid" : tone === "negative" ? "text-overdue" : tone === "primary" ? "text-primary" : "text-ink";
  return <span className={`ds-money ${size === "hero" ? "ds-display" : "text-[20px] font-bold"} ${toneClass}`}>{formatMoney(value)}</span>;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="rounded-md border border-dashed border-line bg-surface p-5 text-center ds-small text-muted"><p>{children}</p>{action ? <div className="mt-3">{action}</div> : null}</div>;
}

export function Field({ label, error, className = "", children }: { label: string; error?: string; className?: string; children: ReactNode }) {
  return <label className={`flex flex-col gap-1.5 ds-small font-semibold text-ink ${className}`}>{label}{children}{error ? <span className="text-overdue">{error}</span> : null}</label>;
}

export const fieldClassName = "min-h-12 rounded-sm border border-line bg-surface px-3 text-[15px] font-normal text-ink outline-none transition-colors placeholder:text-muted";
