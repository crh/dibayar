"use client";

import Link from "next/link";
import type { InvoiceStatus, InvoiceWithDealBrand } from "@/lib/invoices";
import { useLanguage } from "@/components/language-switcher";
import { StatusChip, MoneyDisplay, EmptyState } from "@/components/design-system";
import { formatDate } from "@/lib/format/date";

type InvoiceGroupKey = "overdue" | "sent" | "draft" | "paid";

// Fixed display order, independent of the DB orderBy: Overdue, Sent (DUE
// folded in), Draft, Paid. DUE is a distinct stored status but has no
// section of its own — it reads as "sent, and now also due".
const INVOICE_GROUPS: ReadonlyArray<{ key: InvoiceGroupKey; statuses: readonly InvoiceStatus[]; titleKey: string }> = [
  { key: "overdue", statuses: ["OVERDUE"], titleKey: "invoice.overdue" },
  { key: "sent", statuses: ["SENT", "DUE"], titleKey: "invoice.sent" },
  { key: "draft", statuses: ["DRAFT"], titleKey: "invoice.draft" },
  { key: "paid", statuses: ["PAID"], titleKey: "invoice.paid" },
];

type InvoiceListProps = {
  invoices: InvoiceWithDealBrand[];
};

export function InvoiceList({ invoices }: InvoiceListProps) {
  const { language, t } = useLanguage();

  if (invoices.length === 0) {
    return <EmptyState>{t("dashboard.noInvoices")}</EmptyState>;
  }

  const groups = INVOICE_GROUPS.map((group) => ({
    ...group,
    invoices: invoices.filter((invoice) => group.statuses.includes(invoice.status)),
  })).filter((group) => group.invoices.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`invoice-group-${group.key}`} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id={`invoice-group-${group.key}`} className="text-[16px] font-bold text-ink">
              {t(group.titleKey)}
            </h2>
            <span className="rounded-full bg-bg px-2 py-1 text-[12px] font-semibold text-muted">
              {group.invoices.length}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {group.invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/invoice/${invoice.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">{invoice.deal.brand}</p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {invoice.number} · {invoice.dueDate ? formatDate(invoice.dueDate) : t("invoice.notSet")}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <MoneyDisplay value={invoice.subtotalIdr} language={language} size="card" />
                    <StatusChip status={invoice.status} language={language} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
