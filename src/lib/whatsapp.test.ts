import { describe, expect, it } from "vitest";
import {
  buildDealWhatsApp,
  buildDealWhatsAppMessage,
  buildInvoiceWhatsApp,
  buildWhatsAppReminderMessage,
  buildWhatsAppShareUrl,
  normalizeWhatsAppNumber,
  resolveWhatsAppTemplate,
} from "./whatsapp";

// Message bodies are raw strings (not DOM), so the money formatter's real
// NBSP (U+00A0) separator is checked byte-for-byte here, not normalized.
const NBSP = String.fromCharCode(0x00a0);

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
    expect(message).toContain(`Rp${NBSP}5.000.000`);
    expect(message).toContain("19 Jul 2026");
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

describe("resolveWhatsAppTemplate (T-21)", () => {
  const defaultSend =
    "Halo {brand}, berikut invoice {nomor_invoice} sebesar {jumlah}.\n" +
    "Jatuh tempo {jatuh_tempo}.\n" +
    "Detail dan unduh PDF: {tautan}\n" +
    "Terima kasih!";

  const tokens = {
    brand: "Kopi Nusantara",
    jumlah: `Rp${NBSP}5.000.000`,
    jatuh_tempo: "19 Jul 2026",
    nomor_invoice: "INV/2026/07/004",
    tautan: "https://dibayar.example/i/token-abc",
  };

  it("substitutes every token", () => {
    const message = resolveWhatsAppTemplate(defaultSend, tokens);
    expect(message).toBe(
      "Halo Kopi Nusantara, berikut invoice INV/2026/07/004 sebesar Rp 5.000.000.\n" +
        "Jatuh tempo 19 Jul 2026.\n" +
        "Detail dan unduh PDF: https://dibayar.example/i/token-abc\n" +
        "Terima kasih!",
    );
  });

  it("drops the whole due-date line, not just the token, when jatuh_tempo is null", () => {
    const message = resolveWhatsAppTemplate(defaultSend, { ...tokens, jatuh_tempo: null });
    expect(message).not.toContain("Jatuh tempo");
    expect(message).not.toContain("Jatuh tempo .");
  });

  it("drops a due-date line anywhere in a custom template, not just the default layout", () => {
    const custom = "Halo {brand}!\nSilakan bayar sebelum {jatuh_tempo} ya.\nLink: {tautan}";
    const message = resolveWhatsAppTemplate(custom, { ...tokens, jatuh_tempo: null });
    expect(message).toBe("Halo Kopi Nusantara!\nLink: https://dibayar.example/i/token-abc");
  });

  it("leaves a template with no jatuh_tempo token untouched by the empty-due-date rule", () => {
    const custom = "Halo {brand}, invoice {nomor_invoice} sudah siap: {tautan}";
    const message = resolveWhatsAppTemplate(custom, { ...tokens, jatuh_tempo: null });
    expect(message).toBe("Halo Kopi Nusantara, invoice INV/2026/07/004 sudah siap: https://dibayar.example/i/token-abc");
  });
});

describe("buildInvoiceWhatsApp (T-21)", () => {
  const base = {
    contactWa: "0812-3456-7890",
    shareUrl: "https://dibayar.example/i/token-abc",
    template: "Halo {brand}, invoice {nomor_invoice} sebesar {jumlah}. Jatuh tempo {jatuh_tempo}. Link: {tautan}",
    brand: "Kopi Nusantara",
    invoiceNumber: "INV/2026/07/004",
    totalIdr: 5000000,
    dueDate: "2026-07-19T00:00:00.000Z" as Date | string | null,
  };

  it("builds a ready wa.me href with the normalized number and resolved template", () => {
    const result = buildInvoiceWhatsApp(base);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    const decoded = decodeURIComponent(result.href.split("?text=")[1]);
    expect(decoded).toContain("Kopi Nusantara");
    expect(decoded).toContain("INV/2026/07/004");
    expect(decoded).toContain(`Rp${NBSP}5.000.000`);
    expect(decoded).toContain("19 Jul 2026");
    expect(decoded).toContain(base.shareUrl);
  });

  it("stays usable, dropping the due-date line, when the invoice has no due date", () => {
    const result = buildInvoiceWhatsApp({ ...base, dueDate: null });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(decodeURIComponent(result.href)).not.toContain("Jatuh tempo");
  });

  it("reports no-contact distinctly when the contact number is missing or unusable", () => {
    expect(buildInvoiceWhatsApp({ ...base, contactWa: null })).toEqual({ kind: "no-contact" });
    expect(buildInvoiceWhatsApp({ ...base, contactWa: "not-a-phone" })).toEqual({ kind: "no-contact" });
  });

  it("reports no-share distinctly when there is no active share link, even with a valid contact", () => {
    expect(buildInvoiceWhatsApp({ ...base, shareUrl: null })).toEqual({ kind: "no-share" });
  });
});

describe("buildDealWhatsAppMessage (T-18)", () => {
  it("greets the contact by name when one is set", () => {
    const message = buildDealWhatsAppMessage({ brand: "Kopi Nusantara", contactName: "Budi" });
    expect(message).toBe("Halo Budi, saya ingin follow up terkait deal dengan Kopi Nusantara. Terima kasih.");
  });

  it("falls back to a plain greeting when there is no contact name", () => {
    const message = buildDealWhatsAppMessage({ brand: "Kopi Nusantara", contactName: null });
    expect(message).toBe("Halo, saya ingin follow up terkait deal dengan Kopi Nusantara. Terima kasih.");
  });
});

describe("buildDealWhatsApp (T-18)", () => {
  it("builds a ready wa.me href for a valid contact number", () => {
    const result = buildDealWhatsApp({ contactWa: "+62 812-3456-7890", brand: "Kopi Nusantara", contactName: null });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(decodeURIComponent(result.href)).toContain("Kopi Nusantara");
  });

  it("reports invalid-number for an unusable phone number, never throwing or auto-sending anything", () => {
    expect(buildDealWhatsApp({ contactWa: "not-a-phone", brand: "Kopi Nusantara", contactName: null })).toEqual({
      kind: "invalid-number",
    });
    expect(buildDealWhatsApp({ contactWa: "", brand: "Kopi Nusantara", contactName: null })).toEqual({
      kind: "invalid-number",
    });
  });
});
