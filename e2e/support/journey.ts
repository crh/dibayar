// Helpers shared by the long cross-page journeys in e2e/journeys/. They only
// wrap what a person does (tap or click, type) and what the network answered;
// nothing here reads or writes application state.
import type { Locator, Page, Response } from "@playwright/test";
import { expect } from "./test";

// Money uses a non-breaking space after "Rp" (CLAUDE.md IDR rule).
export const NBSP = " ";

// 2500000 -> "Rp 2.500.000" with the app's non-breaking space, built by hand
// rather than with the app's formatter.
export function rupiah(value: number): string {
  const digits = String(value);
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return `Rp${NBSP}${groups.join(".")}`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A tap on the phone project, a click on desktop.
export async function press(target: Locator, isMobile: boolean): Promise<void> {
  if (isMobile) await target.tap();
  else await target.click();
}

// Typing into a plain text field: on the phone project the field is tapped
// and the keys go through the keyboard; on desktop fill() (which requires a
// visible, enabled, editable field and focuses it).
export async function typeInto(page: Page, field: Locator, value: string, isMobile: boolean): Promise<void> {
  if (!isMobile) {
    await field.fill(value);
    return;
  }
  await field.tap();
  await expect(field).toBeFocused();
  await page.keyboard.type(value);
}

export function isRequestTo(method: string, pathname: string) {
  return (response: Response) => response.request().method() === method && new URL(response.url()).pathname === pathname;
}

// Runs `action` and returns the response it caused for `method pathname`.
export async function responseTo(page: Page, method: string, pathname: string, action: () => Promise<void>): Promise<Response> {
  const [response] = await Promise.all([page.waitForResponse(isRequestTo(method, pathname)), action()]);
  return response;
}

// The browser-health guard (e2e/support/test.ts) watches only the test's own
// `page`. The journeys also drive a recipient and other signed-in browsers;
// this records what must never happen on those pages either -- an uncaught
// page exception or an HTTP 5xx -- and the returned function fails the test
// if either was seen. Expected 4xx answers (a revoked link's 404, a refused
// token's 401) are not recorded.
export function watchPageHealth(page: Page, label: string): () => void {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`${label}: page error: ${error.message}`));
  page.on("response", (response) => {
    // Pathname only: a public invoice URL carries its bearer token.
    if (response.status() >= 500) problems.push(`${label}: HTTP ${response.status()} ${new URL(response.url()).pathname.replace(/\/i\/[^/]+/, "/i/<token>").replace(/\/invoices\/[^/]+\/pdf$/, "/invoices/<token>/pdf")}`);
  });
  return () => expect(problems, `no page error or 5xx on ${label}`).toEqual([]);
}

// Nothing an owner uses to run the app is on the page: no app navigation, no
// account menu, no status, share or settings controls.
export async function expectNoOwnerControls(page: Page): Promise<void> {
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu akun" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "+ Deal", exact: true })).toHaveCount(0);
  for (const name of [
    "Tandai sudah dikirim",
    "Tandai jatuh tempo",
    "Tandai lunas",
    "Batalkan status lunas",
    "Kirim lewat WhatsApp",
    "Kirim pengingat",
    "Buat tautan berbagi",
    "Buat ulang tautan",
    "Cabut tautan",
    "Kosongkan",
    "Simpan pengaturan",
  ]) {
    await expect(page.getByRole("button", { name, exact: true }), `"${name}" must not be offered here`).toHaveCount(0);
  }
  await expect(page.getByLabel("Tanggal jatuh tempo")).toHaveCount(0);
}
