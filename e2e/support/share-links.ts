// Helpers for the share-link journeys (FIND-05, FIND-07): a session-less
// recipient, the link inside a WhatsApp reminder, the link invoice detail
// shows, and the share requests a page sends.
//
// Share links are bearer tokens. Compare them as booleans
// (`expect(a === b, "...").toBe(true)`) and never interpolate one into a
// message, so a failing assertion can't print a token.
import type { Locator, Page } from "@playwright/test";
import { expect, test as base } from "./test";
import { parseWhatsAppLink } from "./follow-up";

// `recipient`: a page in its own context with no session and no storage --
// the brand opening the link on their own device.
export const shareTest = base.extend<{ recipient: Page }>({
  recipient: async ({ browser, baseURL, viewport, isMobile, hasTouch, userAgent, locale, timezoneId }, provide) => {
    const context = await browser.newContext({
      baseURL, viewport, isMobile, hasTouch, userAgent, locale, timezoneId,
      storageState: { cookies: [], origins: [] },
    });
    try {
      await provide(await context.newPage());
    } finally {
      await context.close();
    }
  },
});

export async function expectRecipientSeesInvoice(recipient: Page, link: string, invoiceNumber: string, amount: string) {
  const response = await recipient.goto(link);
  expect(response?.status()).toBe(200);
  await expect(recipient.getByText(invoiceNumber).first()).toBeVisible();
  await expect(recipient.getByText(amount).first()).toBeVisible();
  await expect(recipient.locator('p[role="alert"]')).toHaveCount(0);
}

export async function expectRecipientGetsNotFound(recipient: Page, link: string, invoiceNumber: string) {
  const response = await recipient.goto(link);
  expect(response?.status()).toBe(404);
  await expect(recipient.locator('p[role="alert"]')).toHaveText("Tautan ini tidak ditemukan.");
  await expect(recipient.getByText(invoiceNumber)).toHaveCount(0);
}

// The honest expired page: the link is real but its share has lapsed.
export async function expectRecipientSeesExpired(recipient: Page, link: string, invoiceNumber: string) {
  const response = await recipient.goto(link);
  expect(response?.status()).toBe(200);
  await expect(recipient.locator('p[role="alert"]')).toHaveText("Tautan ini sudah tidak berlaku.");
  await expect(recipient.getByText(invoiceNumber)).toHaveCount(0);
}

// Every share mutation the page sends for this invoice, as "METHOD /suffix"
// (no tokens: the request carries none).
export function trackShareMutations(page: Page, invoiceId: string): string[] {
  const prefix = `/api/invoices/${invoiceId}`;
  const mutations: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (request.method() !== "GET" && pathname.startsWith(`${prefix}/share`)) {
      mutations.push(`${request.method()} ${pathname.slice(prefix.length)}`);
    }
  });
  return mutations;
}

// Clicks the visible Kirim pengingat inside `scope` (a Beranda queue row, or
// the invoice detail page) and returns the public invoice link inside the
// WhatsApp message it opened. Needs keepWhatsAppLocal().
export async function sendReminder(page: Page, scope: Locator | Page, invoiceNumber: string): Promise<string> {
  const button = scope.getByRole("button", { name: "Kirim pengingat" });
  const [popup] = await Promise.all([page.waitForEvent("popup"), button.click()]);
  await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  const { text } = parseWhatsAppLink(popup.url());
  await popup.close();
  // The send finished cleanly: no blocked-popup fallback (FIND-04).
  await expect(button).toBeEnabled();
  await expect(scope.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0);

  expect(text).toContain(invoiceNumber);
  const origin = new URL(page.url()).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const links = text?.match(new RegExp(`${origin}/i/[A-Za-z0-9_-]{40,}`, "g")) ?? [];
  expect(links.length, "the reminder carries exactly one public invoice link").toBe(1);
  return links[0]!;
}

// The link invoice detail shows for the active share.
export async function shownShareLink(page: Page): Promise<string> {
  const shown = page.getByTestId("share-link-track").locator("span[title]");
  await expect(shown).toBeVisible();
  return (await shown.getAttribute("title"))!;
}
