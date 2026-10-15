// Real-interaction coverage for a session that expires while the app is open
// (docs/testing/journey-coverage.json: AUTH-07; the "Expired session" row of
// the permissions table in docs/testing/JOURNEY-GRAPHS.md).
//
// Each test opens a page on the owner's disposable session, then makes that
// session expire the way a real one does: its row stays, its `expires` moves
// into the past (expireDisposableOwnerSession(), on the guarded test database
// only), and Auth.js rejects it on the next request. The page that is already
// open still shows what it loaded; what matters is everything after that:
//
// - a reload, a link in the app, and the browser's back button must all end
//   on sign-in without showing the owner's data and without a 5xx;
// - a change sent from the stale page must be refused, say so, and store
//   nothing -- checked afterwards through the shared, still valid session.
//
// The browser-health guard (e2e/support/test.ts) fails any of these on a page
// exception, an unexplained console error, a failed request or a 5xx.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { disposableOwnerSessionCookie, ownerSessionCookie } from "../support/auth";
import { E2E_FIXTURE_PREFIX } from "../support/fixture-ids";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { expireDisposableOwnerSession, reseedFixtures } from "../support/reseed";

const NBSP = " ";
const SENT_INVOICE_NUMBER = "E2E/SENT/001";
const SENT_INVOICE_AMOUNT = `Rp${NBSP}6.000.000`;
// What a change refused for an expired session says (#53): not "try again",
// which cannot work, but how to get signed in again.
const SESSION_EXPIRED = "Belum tersimpan karena sesi kamu sudah berakhir. Muat ulang halaman untuk masuk lagi.";

// Sign-in, and nothing of the owner's on it.
async function expectSignInWithoutOwnerData(page: Page) {
  const { owner, brands, deals } = loadFixtureManifest();
  await expect(page).toHaveURL(/\/api\/auth\/signin/);
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  for (const text of [owner.email, SENT_INVOICE_NUMBER, SENT_INVOICE_AMOUNT, brands[deals.invoiceSent], brands[deals.masuk]]) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
}

async function openSentInvoice(page: Page) {
  const { invoices, brands, deals } = loadFixtureManifest();
  await page.goto("/invoice");
  await page.getByRole("link", { name: new RegExp(brands[deals.invoiceSent]) }).click();
  await expect(page).toHaveURL(new RegExp(`/invoice/${invoices.sent}$`));
  await expect(page.getByRole("heading", { name: SENT_INVOICE_AMOUNT })).toBeVisible();
  // The page's own contact/share fetches have settled (the WhatsApp action
  // is enabled only then), so nothing is in flight when the session expires.
  await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
}

test.describe("session expiry while the app is open", { tag: "@critical" }, () => {
  test.use({
    storageState: async ({ baseURL }, provide) => {
      await provide({ cookies: [disposableOwnerSessionCookie(baseURL!)], origins: [] });
    },
  });
  test.beforeEach(reseedFixtures);
  // Auth.js deletes the expired row when it sees it; put it back.
  test.afterEach(reseedFixtures);

  test("reloading an open invoice after the session expired goes to sign-in, and Back shows no data", async ({ page }) => {
    await openSentInvoice(page);
    await expect(page.getByText(SENT_INVOICE_NUMBER).first()).toBeVisible();

    expireDisposableOwnerSession();
    await page.reload();
    await expectSignInWithoutOwnerData(page);

    // Back does not bring the invoice back from a cache.
    await page.goBack();
    await expectSignInWithoutOwnerData(page);
  });

  test("following a link in the app after the session expired goes to sign-in", async ({ page }) => {
    const { brands, deals } = loadFixtureManifest();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();
    await expect(page.getByRole("region", { name: "3 deal terdekat" }).getByText(brands[deals.masuk])).toBeVisible();

    expireDisposableOwnerSession();
    await primaryNav(page).getByRole("link", { name: "Invoice" }).click();
    await expectSignInWithoutOwnerData(page);
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toHaveCount(0);
  });

  test.describe("a change sent after expiry", () => {
    test.use({ expectedErrorResponses: [{ method: "PATCH", pathname: `/api/invoices/${E2E_FIXTURE_PREFIX}-invoice-sent` }] });

    test("Tandai lunas after the session expired is refused, says so, and stores nothing", async ({ page, browser, baseURL }) => {
      const { invoices } = loadFixtureManifest();
      await openSentInvoice(page);
      const header = page.getByRole("main").locator("header").first();
      await expect(header.getByText("Terkirim", { exact: true })).toBeVisible();

      expireDisposableOwnerSession();
      const patch = page.waitForResponse(
        (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${invoices.sent}`,
      );
      await page.getByRole("button", { name: "Tandai lunas" }).click();
      expect((await patch).status()).toBe(401);

      // The page says the change did not happen, why, and what to do next,
      // and keeps the old status.
      await expect(page.getByRole("alert").filter({ hasText: SESSION_EXPIRED })).toBeVisible();
      await expect(header.getByText("Terkirim", { exact: true })).toBeVisible();
      await expect(header.getByText("Lunas", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Tandai lunas" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Batalkan status lunas" })).toHaveCount(0);

      // Nothing was stored: the owner's valid session still sees it as sent.
      const valid = await browser.newContext({
        baseURL,
        storageState: { cookies: [ownerSessionCookie(baseURL!)], origins: [] },
      });
      try {
        const validPage = await valid.newPage();
        await validPage.goto(`/invoice/${invoices.sent}`);
        const validHeader = validPage.getByRole("main").locator("header").first();
        await expect(validHeader.getByText("Terkirim", { exact: true })).toBeVisible();
        await expect(validPage.getByRole("button", { name: "Tandai lunas" })).toBeVisible();
      } finally {
        await valid.close();
      }

      // And the stale page, once reloaded, is at sign-in like any other.
      await page.reload();
      await expectSignInWithoutOwnerData(page);
    });
  });
  test.describe("a new deal saved after expiry", () => {
    test.use({ expectedErrorResponses: [{ method: "POST", pathname: "/api/deals" }] });

    test("Simpan deal after the session expired is refused, says to sign in again, keeps the form, and stores nothing", async ({ page, browser, baseURL }) => {
      await page.goto("/deal?tambah=1");
      const dialog = page.getByRole("dialog", { name: "Tambah deal" });
      await expect(dialog).toBeVisible();
      const brand = `E2E Sesi Habis ${Date.now()}`;
      await dialog.getByLabel("Nama brand").fill(brand);
      await dialog.getByLabel("Kontak WhatsApp").fill("0812 3456 7890");
      await dialog.getByLabel("Scope pekerjaan").fill("E2E session-expiry check");
      await dialog.getByLabel("Fee (Rp)").fill("1250000");

      expireDisposableOwnerSession();
      const post = page.waitForResponse(
        (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals",
      );
      const save = dialog.getByRole("button", { name: "Simpan deal" });
      await save.click();
      expect((await post).status()).toBe(401);

      await expect(dialog.getByRole("alert")).toHaveText(SESSION_EXPIRED);
      await expect(dialog.getByLabel("Nama brand")).toHaveValue(brand);
      await expect(save).toBeEnabled();
      await expect(page.getByRole("status")).toHaveCount(0);

      const valid = await browser.newContext({
        baseURL,
        storageState: { cookies: [ownerSessionCookie(baseURL!)], origins: [] },
      });
      try {
        const { deals } = (await (await valid.request.get("/api/deals")).json()) as { deals: Array<{ brand: string }> };
        expect(deals.filter((deal) => deal.brand === brand)).toHaveLength(0);
      } finally {
        await valid.close();
      }

      // Reloading, as the message says, leads to sign-in.
      await page.reload();
      await expectSignInWithoutOwnerData(page);
    });
  });
});
