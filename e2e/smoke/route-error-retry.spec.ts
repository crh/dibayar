// Real-interaction coverage for the route error boundary, and the regression
// for FIND-12 (docs/testing/journey-coverage.json: NAV-08).
//
// When a page's server component throws, the app keeps its shell and shows
// "Gagal memuat." with a Coba lagi button (src/app/(app)/error.tsx). FIND-12:
// that button called reset(), which only re-renders what the browser already
// holds -- the failure -- so it never recovered, even once the cause was
// gone. It now calls retry(), which asks the server again.
//
// The failure here is real. For the length of the "outage" the Invoice table
// of the disposable test database is not where the app looks for it
// (scripts/e2e-fixtures.ts invoiceTableOutage: a rename, nothing deleted), so
// the invoice list's own query fails and its server component throws. No
// request is intercepted and no application code knows about the test. The
// outage is ended by the test, by afterEach, and by every other fixture
// action.
//
// What the journey checks:
//   1. Beranda is open and fine; the outage starts; the Invoice nav link
//      shows the error card, with the navigation still usable
//   2. Coba lagi during the outage asks the server again and stays on the card
//   3. the outage ends; Coba lagi now shows the invoice list
//   4. the same after a reload during an outage (the error on first load)
//   5. another page was never affected, and Back/Forward work around the card
//
// The one console error a thrown server component produces (React's own
// report, and in production builds only its minified code) is the opt-in
// below; any other console error, page error, failed request or 5xx still
// fails the test.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { endInvoiceTableOutage, reseedFixtures, startInvoiceTableOutage } from "../support/reseed";
import { press } from "../support/journey";

function errorCard(page: Page) {
  return page.getByRole("main").getByRole("alert").filter({ hasText: "Gagal memuat." });
}

function retryButton(page: Page) {
  return page.getByRole("button", { name: "Coba lagi", exact: true });
}

// The error card, in place of the invoice list, inside the working app shell.
async function expectErrorCard(page: Page) {
  await expect(errorCard(page)).toBeVisible();
  await expect(retryButton(page)).toBeVisible();
  await expect(page).toHaveURL(/\/invoice$/);
  await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toHaveCount(0);
  await expect(primaryNav(page).getByRole("link", { name: "Beranda", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu akun" })).toBeVisible();
}

async function expectInvoiceList(page: Page) {
  const { brands, deals } = loadFixtureManifest();
  await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(brands[deals.invoiceSent]) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(brands[deals.dibayar]) })).toBeVisible();
  await expect(errorCard(page)).toHaveCount(0);
  await expect(retryButton(page)).toHaveCount(0);
}

// Clicks Coba lagi and waits for the server's answer to the retry.
async function retryAndWaitForServer(page: Page, isMobile: boolean) {
  const answered = page.waitForResponse((response) => new URL(response.url()).pathname === "/invoice" && response.request().method() === "GET");
  await press(retryButton(page), isMobile);
  await answered;
}

test.describe("route error boundary", { tag: "@critical" }, () => {
  // React logs the thrown server error as an Error object. Chromium and
  // WebKit print its message; Firefox prints only the word "Error".
  test.use({ expectedConsoleError: /^Error(: Minified React error #441;[\s\S]*)?$/ });
  test.beforeEach(reseedFixtures);
  test.afterEach(() => {
    endInvoiceTableOutage();
    reseedFixtures();
  });

  test("a page whose data fails shows Gagal memuat. inside the app, and Coba lagi recovers once the data is back", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();

    try {
      startInvoiceTableOutage();
      await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
      await expectErrorCard(page);

      // Still failing: the retry reaches the server and the card stays.
      await retryAndWaitForServer(page, isMobile);
      await expectErrorCard(page);

      // A page that does not read invoices is not affected, and coming back
      // (Back to Pengaturan, Forward to the invoice list) is the card again.
      await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/pengaturan$/);
      await expect(page.getByRole("heading", { level: 1, name: "Pengaturan" })).toBeVisible();
      await expect(errorCard(page)).toHaveCount(0);
      await page.goBack();
      await expectErrorCard(page);
    } finally {
      endInvoiceTableOutage();
    }

    // The data is back. Coba lagi replaces the card with the list.
    await retryAndWaitForServer(page, isMobile);
    await expectInvoiceList(page);
    // And it is the real page: a reload and a link into an invoice work.
    await page.reload();
    await expectInvoiceList(page);
    const { brands, deals, invoices } = loadFixtureManifest();
    await press(page.getByRole("link", { name: new RegExp(brands[deals.invoiceSent]) }), isMobile);
    await expect(page).toHaveURL(new RegExp(`/invoice/${invoices.sent}$`));
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
  });

  test("a page that fails on first load shows the same card, and Coba lagi recovers it", async ({ page, isMobile }) => {
    await page.goto("/");
    await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
    await expectInvoiceList(page);

    try {
      startInvoiceTableOutage();
      // The whole document is requested again and its server render fails.
      await page.reload();
      await expectErrorCard(page);
    } finally {
      endInvoiceTableOutage();
    }

    await retryAndWaitForServer(page, isMobile);
    await expectInvoiceList(page);
  });
});
