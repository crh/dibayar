import { describe, expect, it } from "vitest";
import {
  buildWhatsAppReminder,
  buildWhatsAppReminderMessage,
  buildWhatsAppShareUrl,
  normalizeWhatsAppNumber,
} from "./whatsapp";

describe("normalizeWhatsAppNumber", () => {
  it.each([
    ["0812 3456 7890", "6281234567890"],
    ["+62 812-3456-7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    ["81234567890", "6281234567890"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeWhatsAppNumber(input)).toBe(expected);
  });

  it.each(["", "12345", "0215551234", "+1 415 555 2671", "6281234", "abc"]) (
    "rejects unusable number %s",
    (input) => expect(normalizeWhatsAppNumber(input)).toBeNull(),
  );
});

describe("WhatsApp reminders", () => {
  const base = {
    invoiceNumber: "INV/2026/07/004",
    totalIdr: 5000000,
    dueDate: "2026-07-19T00:00:00.000Z",
    shareUrl: "https://dibayar.example/i/token-abc",
  };

  it("builds an Indonesian due-soon message with required fields", () => {
    const message = buildWhatsAppReminderMessage({ ...base, kind: "due-soon" });
    expect(message).toContain("INV/2026/07/004");
    expect(message).toContain("Rp5.000.000");
    expect(message).toContain("19 Juli 2026");
    expect(message).toContain(base.shareUrl);
  });

  it("builds an overdue message", () => {
    expect(buildWhatsAppReminderMessage({ ...base, kind: "overdue" })).toContain("sudah melewati jatuh tempo");
  });

  it("keeps due-soon and overdue messages Indonesian-only, with no English equivalents", () => {
    const dueSoon = buildWhatsAppReminderMessage({ ...base, kind: "due-soon" });
    const overdue = buildWhatsAppReminderMessage({ ...base, kind: "overdue" });

    expect(dueSoon).not.toMatch(/reminder|overdue|thank you|due date/i);
    expect(overdue).not.toMatch(/reminder|overdue|thank you|due date/i);
  });

  it("encodes the message in a wa.me URL", () => {
    const url = buildWhatsAppShareUrl("6281234567890", "Halo invoice INV/1 & detail");
    expect(url).toBe("https://wa.me/6281234567890?text=Halo%20invoice%20INV%2F1%20%26%20detail");
  });
});

describe("buildWhatsAppReminder", () => {
  const base = {
    contactWa: "0812-3456-7890",
    shareUrl: "https://dibayar.example/i/token-abc",
    invoiceNumber: "INV/2026/07/004",
    totalIdr: 5000000,
    dueDate: "2026-07-19T00:00:00.000Z" as Date | string | null,
    isOverdue: false,
  };

  it("builds a ready wa.me href with the normalized number, invoice number, amount, due date, and share URL", () => {
    const result = buildWhatsAppReminder(base);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    const decoded = decodeURIComponent(result.href.split("?text=")[1]);
    expect(decoded).toContain("INV/2026/07/004");
    expect(decoded).toContain("Rp5.000.000");
    expect(decoded).toContain("19 Juli 2026");
    expect(decoded).toContain(base.shareUrl);
  });

  it("selects the overdue opening line when isOverdue is true", () => {
    const result = buildWhatsAppReminder({ ...base, isOverdue: true });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(decodeURIComponent(result.href)).toContain("sudah melewati jatuh tempo");
  });

  it("reports no-contact distinctly when the contact number is missing or unusable", () => {
    expect(buildWhatsAppReminder({ ...base, contactWa: null })).toEqual({ kind: "no-contact" });
    expect(buildWhatsAppReminder({ ...base, contactWa: "not-a-phone" })).toEqual({ kind: "no-contact" });
  });

  it("reports no-share distinctly when there is no active share link, even with a valid contact and due date", () => {
    expect(buildWhatsAppReminder({ ...base, shareUrl: null })).toEqual({ kind: "no-share" });
  });

  it("reports no-duedate distinctly when the due date is missing, even with a valid contact and share link", () => {
    expect(buildWhatsAppReminder({ ...base, dueDate: null })).toEqual({ kind: "no-duedate" });
  });
});
