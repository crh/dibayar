// Helpers for the journeys that run on the follow-up overlay
// (applyFollowUpStates() in ./reseed.ts): Jakarta-calendar date math, the
// Beranda follow-up queue, and keeping WhatsApp hand-offs local.
//
// Date formatting is re-derived here from a fixed month table rather than
// imported from src/lib/format/date.ts, so a regression in the app's own
// formatter can't make the expected value agree with it.
import type { BrowserContext, Locator, Page } from "@playwright/test";
import { expect } from "./test";

const ID_SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Asia/Jakarta calendar date (YYYY-MM-DD) right now.
export function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addCalendarDays(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// "2026-10-04" -> "4 Okt 2026", the app's short Indonesian date.
export function shortIdDate(calendarDate: string): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return `${day} ${ID_SHORT_MONTHS[month - 1]} ${year}`;
}

// The overlay's due dates and the page's "today" are both Jakarta-relative.
// A run that crosses Jakarta midnight between applying the overlay and the
// last assertion would compare against a shifted day; fail with that
// explanation instead of a confusing label mismatch.
export function expectSameJakartaDay(startedOn: string): void {
  expect(jakartaToday(), "test crossed Asia/Jakarta midnight; the overlay's relative due dates no longer match").toBe(startedOn);
}

// The Beranda "Perlu dikejar" section and one row in it, by brand.
export function followUpQueue(page: Page): Locator {
  return page.getByRole("region", { name: "Perlu dikejar" });
}

export function followUpRow(page: Page, brand: string): Locator {
  return followUpQueue(page).getByRole("listitem").filter({ hasText: brand });
}

// The row's own link to the invoice (named by its brand, so a "Buka
// WhatsApp" fallback link in the same row is never picked up instead).
export function followUpRowLink(page: Page, brand: string): Locator {
  return followUpRow(page, brand).getByRole("link", { name: new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) });
}

// WhatsApp links (wa.me, and the api.whatsapp.com page it redirects to)
// must never leave this machine: answer them with a local stub, so the
// popup's URL is still the exact link the app built but nothing reaches
// WhatsApp or a third party. Routed on the context so it covers popups.
export async function keepWhatsAppLocal(context: BrowserContext): Promise<void> {
  const stub = { status: 200, contentType: "text/html", body: "<!doctype html><title>WhatsApp stub</title><p>E2E stub: no message was sent.</p>" };
  await context.route(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//, (route) => route.fulfill(stub));
}

// Parses a wa.me link into the number and the prefilled message.
export function parseWhatsAppLink(href: string): { number: string; text: string | null } {
  const url = new URL(href);
  expect(url.origin).toBe("https://wa.me");
  return { number: url.pathname.replace(/^\//, ""), text: url.searchParams.get("text") };
}
