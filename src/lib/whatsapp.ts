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
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function buildWhatsAppReminderMessage(input: {
  kind: WhatsAppReminderKind;
  invoiceNumber: string;
  totalIdr: number;
  dueDate: Date | string;
  shareUrl: string;
}): string {
  const amount = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(input.totalIdr);
  const dueDate = formatWhatsAppDate(input.dueDate);
  const opening = input.kind === "overdue"
    ? `Halo, ini pengingat invoice ${input.invoiceNumber} sebesar Rp${amount} yang sudah melewati jatuh tempo ${dueDate}.`
    : `Halo, ini pengingat invoice ${input.invoiceNumber} sebesar Rp${amount} yang jatuh tempo pada ${dueDate}.`;

  return `${opening}\nDetail invoice: ${input.shareUrl}\nTerima kasih.`;
}

export function buildWhatsAppShareUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export type WhatsAppReminderResult =
  | { kind: "ok"; href: string }
  | { kind: "no-contact" }
  | { kind: "no-share" }
  | { kind: "no-duedate" };

// Pure composition of the pieces above, with each blocked precondition kept
// distinguishable (missing contact vs missing share link vs missing due date)
// so the UI can explain the specific gap instead of a single generic disable.
export function buildWhatsAppReminder(input: {
  contactWa: string | null;
  shareUrl: string | null;
  invoiceNumber: string;
  totalIdr: number;
  dueDate: Date | string | null;
  isOverdue: boolean;
}): WhatsAppReminderResult {
  const normalizedNumber = input.contactWa ? normalizeWhatsAppNumber(input.contactWa) : null;
  if (!normalizedNumber) return { kind: "no-contact" };
  if (!input.shareUrl) return { kind: "no-share" };
  if (!input.dueDate) return { kind: "no-duedate" };

  const message = buildWhatsAppReminderMessage({
    kind: input.isOverdue ? "overdue" : "due-soon",
    invoiceNumber: input.invoiceNumber,
    totalIdr: input.totalIdr,
    dueDate: input.dueDate,
    shareUrl: input.shareUrl,
  });
  return { kind: "ok", href: buildWhatsAppShareUrl(normalizedNumber, message) };
}
