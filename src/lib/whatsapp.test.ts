import { describe, expect, it } from "vitest";
import {
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

  it("encodes the message in a wa.me URL", () => {
    const url = buildWhatsAppShareUrl("6281234567890", "Halo invoice INV/1 & detail");
    expect(url).toBe("https://wa.me/6281234567890?text=Halo%20invoice%20INV%2F1%20%26%20detail");
  });
});
