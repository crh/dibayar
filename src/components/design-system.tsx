import type { ReactNode } from "react";
import type { DealRecord } from "@/lib/deals";
import type { InvoiceRecord } from "@/lib/invoices";

export type PipelineStage = DealRecord["status"];
export type InvoiceStatus = InvoiceRecord["status"];

type ButtonVariant = "primary" | "secondary" | "destructive";

export function Button({
  children,
  variant = "primary",
  loading = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={`ds-button ds-button-${variant} inline-flex items-center justify-center px-5 ${className}`}
      aria-busy={loading || undefined}
    >
      {loading ? "Menyimpan…" : children}
    </button>
  );
}

const PIPELINE_CHIP: Record<PipelineStage, { label: string; className: string }> = {
  MASUK: { label: "Masuk", className: "border-line bg-line text-muted" },
  NEGO: { label: "Nego", className: "border-primary-tint bg-primary-tint text-primary-d" },
  DEAL: { label: "Deal", className: "border-primary-tint bg-primary-tint text-primary-d" },
  KONTEN: { label: "Konten", className: "border-due bg-due-tint text-ink" },
  INVOICE: { label: "Invoice", className: "border-due bg-due text-ink" },
  DIBAYAR: { label: "Dibayar", className: "border-paid bg-paid text-surface" },
};

const INVOICE_CHIP: Record<InvoiceStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "border-line bg-line text-muted" },
  SENT: { label: "Terkirim", className: "border-primary-tint bg-primary-tint text-primary-d" },
  DUE: { label: "Jatuh tempo", className: "border-due bg-due-tint text-ink" },
  OVERDUE: { label: "Terlambat", className: "border-overdue bg-overdue text-surface" },
  PAID: { label: "Lunas", className: "border-paid bg-paid text-surface" },
};

export function StatusChip({ status, language = "id" }: { status: PipelineStage | InvoiceStatus; language?: "id" | "en" }) {
  const item = status in PIPELINE_CHIP ? PIPELINE_CHIP[status as PipelineStage] : INVOICE_CHIP[status as InvoiceStatus];
  const labels: Record<string, string> = {
    Masuk: "Inbox", Nego: "Negotiation", Deal: "Deal", Konten: "Content", Invoice: "Invoice", Dibayar: "Paid",
    Draft: "Draft", Terkirim: "Sent", "Jatuh tempo": "Due", Terlambat: "Overdue", Lunas: "Paid",
  };
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-[11px] font-bold uppercase tracking-wide ${item.className}`}>{language === "en" ? labels[item.label] : item.label}{status === "DIBAYAR" || status === "PAID" ? " ✓" : ""}</span>;
}

export function MoneyDisplay({ value, language = "id", tone = "default", size = "card" }: { value: number; language?: "id" | "en"; tone?: "default" | "paid" | "negative" | "primary"; size?: "card" | "hero" }) {
  const formatted = new Intl.NumberFormat(language === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 0 }).format(value);
  const prefix = language === "en" ? "IDR " : "Rp";
  const toneClass = tone === "paid" ? "text-paid" : tone === "negative" ? "text-overdue" : tone === "primary" ? "text-primary" : "text-ink";
  return <span className={`ds-money ${size === "hero" ? "ds-display" : "text-[20px] font-bold"} ${toneClass}`}>{prefix}{formatted}</span>;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="rounded-md border border-dashed border-line bg-surface p-5 text-center ds-small text-muted"><p>{children}</p>{action ? <div className="mt-3">{action}</div> : null}</div>;
}

export function Field({ label, error, className = "", children }: { label: string; error?: string; className?: string; children: ReactNode }) {
  return <label className={`flex flex-col gap-1.5 ds-small font-semibold text-ink ${className}`}>{label}{children}{error ? <span className="text-overdue">{error}</span> : null}</label>;
}

export const fieldClassName = "min-h-12 rounded-sm border border-line bg-surface px-3 text-[15px] font-normal text-ink outline-none transition-colors placeholder:text-muted";
