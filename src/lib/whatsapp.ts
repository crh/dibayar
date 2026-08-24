import { formatMoney } from "./format/money";
import { formatDate } from "./format/date";

export type WhatsAppReminderKind = "due-soon" | "overdue";

export function normalizeWhatsAppNumber(raw: string): string | null {
  const digits = raw.trim().replace(/\D/g, "");
  if (!digits) return null;

  const normalized = digits.startsWith("0")
    ? `62${digits.slice(1)}`
    : digits.startsWith("62")
      ? digits
      : digits.startsWith("8")
        ? `62${digits}`
        : null;

  return normalized && /^628\d{7,11}$/.test(normalized) ? normalized : null;
}

export function formatWhatsAppDate(value: Date | string): string {
  return formatDate(value);
}

export function buildWhatsAppReminderMessage(input: {
  kind: WhatsAppReminderKind;
  invoiceNumber: string;
  totalIdr: number;
  dueDate: Date | string;
  shareUrl: string;
}): string {
  const amount = formatMoney(input.totalIdr);
  const dueDate = formatWhatsAppDate(input.dueDate);
  const opening = input.kind === "overdue"
    ? `Halo, ini pengingat invoice ${input.invoiceNumber} sebesar ${amount} yang sudah melewati jatuh tempo ${dueDate}.`
    : `Halo, ini pengingat invoice ${input.invoiceNumber} sebesar ${amount} yang jatuh tempo pada ${dueDate}.`;

  return `${opening}\nDetail invoice: ${input.shareUrl}\nTerima kasih.`;
}

export function buildWhatsAppShareUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

// T-21: substitutes the settings-editable template tokens
// ({brand}/{jumlah}/{jatuh_tempo}/{nomor_invoice}/{tautan}, see
// dibayar-implementation-spec.md §4.7). A null jatuh_tempo drops every line
// containing that token entirely (checked before substitution, so it works
// for any template text, not just the shipped defaults) rather than
// substituting an empty string in place, which would leave a dangling
// "Jatuh tempo ." fragment on the line.
export function resolveWhatsAppTemplate(
  template: string,
  tokens: { brand: string; jumlah: string; jatuh_tempo: string | null; nomor_invoice: string; tautan: string },
): string {
  const lines = template.split("\n");
  const kept = tokens.jatuh_tempo === null ? lines.filter((line) => !line.includes("{jatuh_tempo}")) : lines;

  return kept
    .join("\n")
    .replaceAll("{brand}", tokens.brand)
    .replaceAll("{jumlah}", tokens.jumlah)
    .replaceAll("{jatuh_tempo}", tokens.jatuh_tempo ?? "")
    .replaceAll("{nomor_invoice}", tokens.nomor_invoice)
    .replaceAll("{tautan}", tokens.tautan);
}

export type InvoiceWhatsAppResult = { kind: "ok"; href: string } | { kind: "no-contact" } | { kind: "no-share" };

// T-21: the invoice detail page's single WhatsApp composer, driven by the
// owner's own Settings template (send or chase, chosen by the caller) rather
// than a hardcoded message. Never blocks on a missing due date -- an empty
// one just drops that line from the template (see resolveWhatsAppTemplate)
// -- so this stays usable for invoices that never had one.
export function buildInvoiceWhatsApp(input: {
  contactWa: string | null;
  shareUrl: string | null;
  template: string;
  brand: string;
  invoiceNumber: string;
  totalIdr: number;
  dueDate: Date | string | null;
}): InvoiceWhatsAppResult {
  const normalizedNumber = input.contactWa ? normalizeWhatsAppNumber(input.contactWa) : null;
  if (!normalizedNumber) return { kind: "no-contact" };
  if (!input.shareUrl) return { kind: "no-share" };

  const message = resolveWhatsAppTemplate(input.template, {
    brand: input.brand,
    jumlah: formatMoney(input.totalIdr),
    jatuh_tempo: input.dueDate ? formatWhatsAppDate(input.dueDate) : null,
    nomor_invoice: input.invoiceNumber,
    tautan: input.shareUrl,
  });
  return { kind: "ok", href: buildWhatsAppShareUrl(normalizedNumber, message) };
}

// T-18: the deal-contact follow-up action, distinct from the invoice-share/
// reminder messages above -- no invoice, amount, or due date exists yet at
// deal stage, just the brand and (optionally) who to ask for.
export function buildDealWhatsAppMessage(input: { brand: string; contactName: string | null }): string {
  const greeting = input.contactName ? `Halo ${input.contactName}` : "Halo";
  return `${greeting}, saya ingin follow up terkait deal dengan ${input.brand}. Terima kasih.`;
}

export type DealWhatsAppResult = { kind: "ok"; href: string } | { kind: "invalid-number" };

// The caller is responsible for offering a way to correct contactWa when
// this returns "invalid-number" -- see the repair form in deal-detail-client.
export function buildDealWhatsApp(input: {
  contactWa: string;
  brand: string;
  contactName: string | null;
}): DealWhatsAppResult {
  const normalizedNumber = normalizeWhatsAppNumber(input.contactWa);
  if (!normalizedNumber) return { kind: "invalid-number" };

  const message = buildDealWhatsAppMessage({ brand: input.brand, contactName: input.contactName });
  return { kind: "ok", href: buildWhatsAppShareUrl(normalizedNumber, message) };
}
