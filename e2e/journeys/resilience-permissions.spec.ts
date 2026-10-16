// Long journey B3: what happens to work in progress when access ends.
//
// Two ways access ends, in one sitting:
//
// - The owner's session expires while a deal is open and half edited. The
//   save and the stage move they then try are refused and say so, the app's
//   own links, Back, Forward and a reload all end at sign-in without showing
//   their data, the same session token (by then deleted by Auth.js, as an
//   expired one is) is refused from another browser, and
//   nothing they tried was stored. A different signed-in user still sees
//   none of it.
// - The brand's invoice link is revoked by the owner while the brand has the
//   invoice open. The brand's reload, Back and Forward never show the invoice
//   again, its PDF is gone, and an expired link stays an honest "expired".
//
// AUTH-07 (auth/session-expiry.spec.ts) covers expiry on invoice detail and
// PUB-* (public/invoice.spec.ts) cover a revoked link's reload; this journey
// is the deal-editing side, the reused token, the second user, and the
// brand's browser history, tied into one sequence.
//
// Checkpoints, in order (each is a test.step):
//   1. Beranda -> Deal -> a deal's detail page; a contact name is entered
//   2. the session expires (the page stays open)
//   3. Simpan and Lanjut ke Deal are refused (401), each with a visible error
//   4. a link in the app, Back, Forward and a reload end at sign-in, no data
//   5. the same session token is refused from a fresh browser, page and API
//   6. the owner's valid session shows the deal exactly as it was
//   7. a different signed-in user sees neither the board card nor the deal
//   8. the brand: an expired link, then the valid one, which the owner revokes
//   9. the brand's reload, Back, Forward and PDF after the revoke
//
// Preconditions come from the base seed (scripts/e2e-fixtures.ts): the Nego
// fixture deal, the sent invoice with its active share link, the paid
// invoice's already-expired link, the owner's disposable session and the
// second user. The one thing done outside the UI is the expiry itself:
// expireDisposableOwnerSession() moves the disposable session's `expires`
// into the past on the guarded test database, which is how a real session
// ends. The 401s are the server's own answers; nothing is stubbed, and no
// authentication code is involved in making this testable.
import type { Browser, BrowserContext, Cookie, Page } from "@playwright/test";
import { expect } from "../support/test";
import { disposableOwnerSessionCookie, otherOwnerSessionCookie, ownerSessionCookie } from "../support/auth";
import { E2E_FIXTURE_PREFIX } from "../support/fixture-ids";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { expireDisposableOwnerSession, reseedFixtures } from "../support/reseed";
import { expectRecipientGetsNotFound, expectRecipientSeesExpired, expectRecipientSeesInvoice, shareTest as test } from "../support/share-links";
import { expectNoOwnerControls, press, responseTo, rupiah, watchPageHealth } from "../support/journey";

const NEGO_DEAL_ID = `${E2E_FIXTURE_PREFIX}-deal-nego`;
const TYPED_CONTACT_NAME = "Kontak Yang Tidak Tersimpan";
const SESSION_EXPIRED = "Belum tersimpan karena sesi kamu sudah berakhir. Muat ulang halaman untuk masuk lagi.";
const SENT_INVOICE_NUMBER = "E2E/SENT/001";
const PAID_INVOICE_NUMBER = "E2E/PAID/002";

type DeviceOptions = Parameters<Browser["newContext"]>[0];

// Another browser with this project's device emulation and exactly the
// given cookies.
async function newBrowser(browser: Browser, device: DeviceOptions, cookies: Cookie[]): Promise<BrowserContext> {
  return browser.newContext({ ...device, storageState: { cookies, origins: [] } });
}

// Sign-in, and nothing of the owner's on it.
async function expectSignInWithoutOwnerData(page: Page) {
  const { owner, brands, deals } = loadFixtureManifest();
  await expect(page).toHaveURL(/\/api\/auth\/signin/);
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  for (const text of [owner.email, brands[deals.nego], brands[deals.masuk], brands[deals.invoiceSent], TYPED_CONTACT_NAME, SENT_INVOICE_NUMBER, rupiah(2_000_000)]) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
}

test.describe("journey: resilience and permissions", { tag: "@critical" }, () => {
  // The owner's page runs on the disposable session; the shared one, which
  // every other test's cookie relies on, is only ever read here.
  test.use({
    storageState: async ({ baseURL }, provide) => {
      await provide({ cookies: [disposableOwnerSessionCookie(baseURL!)], origins: [] });
    },
    // The two changes the owner tries after the session expired.
    expectedErrorResponses: [{ method: "PATCH", pathname: `/api/deals/${NEGO_DEAL_ID}` }],
  });
  test.beforeEach(reseedFixtures);
  // Auth.js deletes the expired session row and the journey revokes a share.
  test.afterEach(reseedFixtures);

  test("an expired session and a revoked link stop every further read and write, and nothing attempted is stored", async ({ page, recipient, browser, baseURL, viewport, isMobile, hasTouch, userAgent, locale, timezoneId }) => {
    test.setTimeout(120_000);
    const manifest = loadFixtureManifest();
    const device: DeviceOptions = { baseURL, viewport, isMobile, hasTouch, userAgent, locale, timezoneId };
    const dealId = manifest.deals.nego;
    expect(dealId).toBe(NEGO_DEAL_ID);
    const brand = manifest.brands[dealId];
    const contactName = page.getByLabel("Nama kontak", { exact: true });
    // The guard in support/test.ts watches `page` only; most of this journey
    // happens in other browsers.
    const healthChecks = [watchPageHealth(recipient, "the recipient's page")];

    await test.step("Beranda -> Deal -> deal detail, and a contact name is entered but not yet saved", async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();
      await press(primaryNav(page).getByRole("link", { name: "Deal", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/deal$/);
      const card = page.locator("article", { hasText: brand });
      await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
      await press(page.getByRole("menuitem", { name: "Lihat detail" }), isMobile);
      await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
      await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
      await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();
      await expect(contactName).toHaveValue("");
      await contactName.fill(TYPED_CONTACT_NAME);
    });

    await test.step("the session expires while the page is open", () => {
      expireDisposableOwnerSession();
    });

    await test.step("Simpan and Lanjut ke Deal are refused, and each says so", async () => {
      const save = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("button", { name: "Simpan", exact: true }), isMobile));
      expect(save.status()).toBe(401);
      // Not "try again", which cannot work, but how to sign in again (#53).
      await expect(page.getByRole("alert").filter({ hasText: SESSION_EXPIRED })).toHaveCount(1);
      await expect(page.getByRole("status").filter({ hasText: "Nama kontak disimpan" })).toHaveCount(0);
      // What was entered is still in the field, to try again after signing in.
      await expect(contactName).toHaveValue(TYPED_CONTACT_NAME);

      const move = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("button", { name: "Lanjut ke Deal", exact: true }), isMobile));
      expect(move.status()).toBe(401);
      // The contact-name message stays; the move adds its own.
      await expect(page.getByRole("alert").filter({ hasText: SESSION_EXPIRED })).toHaveCount(2);
      await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();
      await expect(page.getByText("Tahap saat ini: Deal")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Lanjut ke Deal", exact: true })).toBeVisible();
    });

    await test.step("a link in the app, Back, Forward and a reload all end at sign-in without the owner's data", async () => {
      await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
      await expectSignInWithoutOwnerData(page);
      await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toHaveCount(0);

      await page.goBack();
      await expectSignInWithoutOwnerData(page);
      await page.goForward();
      await expectSignInWithoutOwnerData(page);
      await page.reload();
      await expectSignInWithoutOwnerData(page);
    });

    await test.step("the same session token is refused from a fresh browser, as a page and through the API", async () => {
      const reused = await newBrowser(browser, device, [disposableOwnerSessionCookie(baseURL!)]);
      try {
        const reusedPage = await reused.newPage();
        healthChecks.push(watchPageHealth(reusedPage, "the reused-token browser"));
        await reusedPage.goto(`/deal/${dealId}`);
        await expectSignInWithoutOwnerData(reusedPage);
        expect((await reused.request.get(`/api/deals/${dealId}`)).status()).toBe(401);
        expect((await reused.request.get("/api/me/settings")).status()).toBe(401);
      } finally {
        await reused.close();
      }
    });

    await test.step("the owner's valid session shows the deal exactly as it was", async () => {
      const valid = await newBrowser(browser, device, [ownerSessionCookie(baseURL!)]);
      try {
        const validPage = await valid.newPage();
        healthChecks.push(watchPageHealth(validPage, "the valid owner's browser"));
        await validPage.goto(`/deal/${dealId}`);
        await expect(validPage.getByRole("heading", { level: 1, name: brand })).toBeVisible();
        await expect(validPage.getByText("Tahap saat ini: Nego")).toBeVisible();
        await expect(validPage.getByLabel("Nama kontak", { exact: true })).toHaveValue("");
        // One history entry: its creation. No move was recorded.
        const history = validPage.locator("div", { has: validPage.getByRole("heading", { name: "Riwayat tahap" }) }).last().getByRole("listitem");
        await expect(history).toHaveCount(1);
        await expect(history).toContainText("Deal dibuat langsung di tahap Nego");
        await expect(validPage.getByText("Nego → Deal")).toHaveCount(0);
      } finally {
        await valid.close();
      }
    });

    await test.step("a different signed-in user sees neither the card nor the deal (reads only; writes are INV-OWN-01's own spec)", async () => {
      const other = await newBrowser(browser, device, [otherOwnerSessionCookie(baseURL!)]);
      try {
        const otherPage = await other.newPage();
        healthChecks.push(watchPageHealth(otherPage, "the second user's browser"));
        await otherPage.goto("/deal");
        // Their own board: every stage is there, and every stage is empty.
        await expect(otherPage.getByRole("group", { name: /filter tahap deal/i })).toBeVisible();
        await expect(otherPage.getByRole("region", { name: "Nego" })).toBeVisible();
        await expect(otherPage.locator("article")).toHaveCount(0);
        for (const owned of Object.values(manifest.brands)) await expect(otherPage.getByText(owned)).toHaveCount(0);
        await otherPage.goto(`/deal/${dealId}`);
        await expect(otherPage.getByText("This page could not be found.")).toBeVisible();
        await expect(otherPage.getByText(brand)).toHaveCount(0);
        expect((await other.request.get(`/api/deals/${dealId}`)).status()).toBe(404);
      } finally {
        await other.close();
      }
    });

    const activeLink = `/i/${manifest.shareTokens.active}`;
    const expiredLink = `/i/${manifest.shareTokens.expired}`;
    await test.step("the brand opens an expired link, then a valid one, which the owner then revokes", async () => {
      await expectRecipientSeesExpired(recipient, expiredLink, PAID_INVOICE_NUMBER);
      await expectNoOwnerControls(recipient);
      await expectRecipientSeesInvoice(recipient, activeLink, SENT_INVOICE_NUMBER, rupiah(6_000_000));
      await expectNoOwnerControls(recipient);

      const valid = await newBrowser(browser, device, [ownerSessionCookie(baseURL!)]);
      try {
        const ownerPage = await valid.newPage();
        healthChecks.push(watchPageHealth(ownerPage, "the owner's browser while revoking"));
        await ownerPage.goto("/invoice");
        await press(ownerPage.getByRole("link", { name: new RegExp(manifest.brands[manifest.deals.invoiceSent]) }), isMobile);
        await expect(ownerPage).toHaveURL(new RegExp(`/invoice/${manifest.invoices.sent}$`));
        await press(ownerPage.getByRole("button", { name: "Cabut tautan" }), isMobile);
        const revoked = await responseTo(ownerPage, "DELETE", `/api/invoices/${manifest.invoices.sent}/share`, () => press(ownerPage.getByRole("button", { name: "Ya, cabut tautan" }), isMobile));
        expect(revoked.ok()).toBe(true);
        await expect(ownerPage.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
      } finally {
        await valid.close();
      }
    });

    await test.step("the brand's reload, Back, Forward and PDF never show the revoked invoice again", async () => {
      const reloaded = await recipient.reload();
      expect(reloaded?.status()).toBe(404);
      const alert = recipient.locator('p[role="alert"]');
      await expect(alert).toHaveText("Tautan ini tidak ditemukan.");
      await expect(recipient.getByText(SENT_INVOICE_NUMBER)).toHaveCount(0);

      // Back is the expired link's page, still honest and still empty.
      await recipient.goBack();
      await expect(recipient).toHaveURL(new RegExp(`${expiredLink}$`));
      await expect(alert).toHaveText("Tautan ini sudah tidak berlaku.");
      await expect(recipient.getByText(PAID_INVOICE_NUMBER)).toHaveCount(0);

      // Forward fetches the link again and is refused again. (Playwright's
      // Chromium runs without the back/forward cache, so this does not show
      // what a browser that restores pages from that cache would display.)
      await recipient.goForward();
      await expect(recipient).toHaveURL(new RegExp(`${activeLink}$`));
      await expect(alert).toHaveText("Tautan ini tidak ditemukan.");
      await expect(recipient.getByText(SENT_INVOICE_NUMBER)).toHaveCount(0);
      await expect(recipient.getByText(rupiah(6_000_000))).toHaveCount(0);
      await expect(recipient.getByRole("link", { name: "Unduh PDF" })).toHaveCount(0);

      const pdf = await recipient.request.get(`/api/public/invoices/${manifest.shareTokens.active}/pdf`);
      expect(pdf.status()).toBe(404);
      await expectRecipientGetsNotFound(recipient, activeLink, SENT_INVOICE_NUMBER);
      // A token that never existed gets the same answer as the revoked one.
      await expectRecipientGetsNotFound(recipient, `/i/${manifest.shareTokens.invalid}`, SENT_INVOICE_NUMBER);
    });
    for (const check of healthChecks) check();
  });
});
