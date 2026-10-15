// What the deal board says when the server cannot answer a save (#53).
//
// Each test breaks exactly one request, in one way:
//
// - a gateway error page (502, HTML, not the API's JSON) or a dropped
//   connection (route.abort): the request never reached the app, so nothing
//   was stored -- but the page cannot know that, and must not claim either;
// - no answer at all: the page gives up after its bounded wait
//   (fetchWithTimeout) instead of spinning forever;
// - stored, but the answer never arrived (route.fetch() lets the request
//   reach the real server, then the answer is withheld): the page checks
//   what the server holds and shows the saved deal or invoice instead of
//   offering a second save that would duplicate it;
// - a real 403 from the server's own Origin check (the request reaches the
//   app with a foreign Origin header; nothing is stubbed).
//
// What is stored is always read with page.request, which page.route does not
// intercept. The answers the server really gives to invalid input (400) are
// covered by deal-crud.spec.ts and create-validation.spec.ts; a real expired
// session (401) by e2e/auth/session-expiry.spec.ts.
import type { Page, Route } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";
import { E2E_FIXTURE_PREFIX } from "../support/fixture-ids";

const SAVE_UNKNOWN = "deal ini belum pasti tersimpan";
const INVOICE_UNKNOWN = "invoice ini belum pasti dibuat";
const CONNECTION = "belum pasti tersimpan";
const ORIGIN_REJECTED = "Muat ulang halaman, lalu coba lagi.";
// The Masuk fixture deal (scripts/e2e-fixtures.ts). test.use() runs while the
// tests are listed, before global setup writes the manifest.
const MASUK_DEAL_PATCH = { method: "PATCH", pathname: `/api/deals/${E2E_FIXTURE_PREFIX}-deal-masuk` };

type Failure = "gateway-html" | "network" | "no-answer" | "stored-no-answer";

// Answers the next matching request with `failure`; later ones go to the
// server untouched. Returns how many matching requests the page sent.
async function failNext(page: Page, method: string, pathname: string, failure: Failure) {
  const sent = { count: 0 };
  let armed = true;
  await page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      if (route.request().method() !== method) return route.fallback();
      sent.count += 1;
      if (!armed) return route.fallback();
      armed = false;
      if (failure === "gateway-html") {
        return route.fulfill({ status: 502, contentType: "text/html", body: "<html><body>Bad Gateway</body></html>" });
      }
      if (failure === "network") return route.abort("internetdisconnected");
      // The real server handles it; its answer is never passed on.
      if (failure === "stored-no-answer") await route.fetch();
      // Left unanswered: the page's own timeout ends the request.
    },
  );
  return sent;
}

// The page's own alerts; Next's route announcer also has role=alert.
function board(page: Page) {
  return page.getByRole("main").getByRole("alert");
}

async function storedDealsNamed(page: Page, brand: string) {
  const response = await page.request.get("/api/deals");
  expect(response.ok()).toBe(true);
  const { deals } = (await response.json()) as { deals: Array<{ brand: string }> };
  return deals.filter((deal) => deal.brand === brand).length;
}

async function storedInvoicesForDeal(page: Page, dealId: string) {
  const response = await page.request.get("/api/invoices");
  expect(response.ok()).toBe(true);
  const { invoices } = (await response.json()) as { invoices: Array<{ dealId: string }> };
  return invoices.filter((invoice) => invoice.dealId === dealId).length;
}

async function storedDealStatus(page: Page, dealId: string) {
  const response = await page.request.get(`/api/deals/${dealId}`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { deal: { status: string } }).deal.status;
}

async function openFilledDialog(page: Page, brand: string) {
  await page.goto("/deal?tambah=1");
  const dialog = page.getByRole("dialog", { name: "Tambah deal" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nama brand").fill(brand);
  await dialog.getByLabel("Kontak WhatsApp").fill("0812 3456 7890");
  await dialog.getByLabel("Scope pekerjaan").fill("E2E server-error check");
  await dialog.getByLabel("Fee (Rp)").fill("1750000");
  return dialog;
}

test.describe("add deal when the server cannot answer", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.use({
    expectedErrorResponses: [{ method: "POST", pathname: "/api/deals", status: 502 }],
    expectedFailedRequests: [{ method: "POST", pathname: "/api/deals" }],
  });

  for (const failure of ["gateway-html", "network", "no-answer"] as const) {
    test(`a save that gets ${failure === "gateway-html" ? "a 502 HTML page" : failure === "network" ? "no connection" : "no answer in time"} says it may not be saved, keeps the form, and Simpan deal again saves exactly one deal`, async ({ page }) => {
      const brand = `E2E Gagal ${failure} ${Date.now()}`;
      const dialog = await openFilledDialog(page, brand);
      const posts = await failNext(page, "POST", "/api/deals", failure);
      const save = dialog.getByRole("button", { name: "Simpan deal" });
      await save.click();

      // Bounded: the alert comes within the page's own wait, not never.
      await expect(dialog.getByRole("alert")).toContainText(SAVE_UNKNOWN, { timeout: 15_000 });
      await expect(page.getByRole("status")).toHaveCount(0);
      await expect(dialog.getByLabel("Nama brand")).toHaveValue(brand);
      await expect(dialog.getByLabel("Fee (Rp)")).toHaveValue("1750000");
      await expect(save).toBeEnabled();
      expect(await storedDealsNamed(page, brand)).toBe(0);

      await save.click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("status")).toHaveText("Deal disimpan");
      await expect(page.getByText(brand, { exact: true })).toBeVisible();
      expect(posts.count).toBe(2);
      expect(await storedDealsNamed(page, brand)).toBe(1);
    });
  }

  test("a save the server stored but never answered is shown as saved, and is not sent twice", async ({ page }) => {
    const brand = `E2E Tersimpan Tanpa Jawaban ${Date.now()}`;
    const dialog = await openFilledDialog(page, brand);
    const posts = await failNext(page, "POST", "/api/deals", "stored-no-answer");
    await dialog.getByRole("button", { name: "Simpan deal" }).click();

    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");
    await expect(page.getByText(brand, { exact: true })).toBeVisible();
    await expect(board(page)).toHaveCount(0);
    expect(posts.count).toBe(1);
    expect(await storedDealsNamed(page, brand)).toBe(1);

    await page.reload();
    await expect(page.getByText(brand, { exact: true })).toHaveCount(1);
  });
});

test.describe("add deal refused by the server's Origin check", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.use({ expectedErrorResponses: [{ method: "POST", pathname: "/api/deals", status: 403 }] });

  test("a real 403 says to reload, keeps the form, stores nothing, and a second try saves", async ({ page }) => {
    const brand = `E2E Origin Ditolak ${Date.now()}`;
    const dialog = await openFilledDialog(page, brand);
    let armed = true;
    await page.route(
      (url) => url.pathname === "/api/deals",
      async (route) => {
        if (!armed || route.request().method() !== "POST") return route.fallback();
        armed = false;
        // Sent to the real server with a foreign Origin, which it refuses
        // itself; its answer is passed on as is. (A browser does not let an
        // intercepted request's Origin be rewritten, hence route.fetch.)
        const response = await route.fetch({ headers: { ...route.request().headers(), origin: "https://other-site.invalid" } });
        await route.fulfill({ response });
      },
    );
    const refused = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals");
    const save = dialog.getByRole("button", { name: "Simpan deal" });
    await save.click();
    expect((await refused).status()).toBe(403);
    expect(armed).toBe(false);

    await expect(dialog.getByRole("alert")).toContainText(ORIGIN_REJECTED);
    await expect(dialog.getByLabel("Nama brand")).toHaveValue(brand);
    await expect(save).toBeEnabled();
    expect(await storedDealsNamed(page, brand)).toBe(0);

    await save.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");
    expect(await storedDealsNamed(page, brand)).toBe(1);
  });
});

test.describe("board stage move when the server cannot answer", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  async function openCardMenu(page: Page, dealId: string) {
    const brand = loadFixtureManifest().brands[dealId];
    await page.goto("/deal?tahap=MASUK");
    const card = page.locator("article", { hasText: brand });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    return card;
  }

  test.describe("not stored", () => {
    test.use({ expectedFailedRequests: [MASUK_DEAL_PATCH] });

    test("a move that gets no answer in time ends, puts the card back, says so, and a second try moves it", async ({ page }) => {
      const dealId = loadFixtureManifest().deals.masuk;
      const card = await openCardMenu(page, dealId);
      const patches = await failNext(page, "PATCH", `/api/deals/${dealId}`, "no-answer");
      await page.getByRole("menuitem", { name: "Lanjut ke Nego" }).click();

      await expect(board(page)).toContainText(CONNECTION, { timeout: 15_000 });
      await expect(card).toBeVisible();
      expect(await storedDealStatus(page, dealId)).toBe("MASUK");

      await card.getByRole("button", { name: /^Aksi lain untuk deal/ }).click();
      // The card leaves the Masuk column at once (optimistic); wait for the answer.
      const moved = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/deals/${dealId}`);
      await page.getByRole("menuitem", { name: "Lanjut ke Nego" }).click();
      expect((await moved).ok()).toBe(true);
      await expect(card).toHaveCount(0);
      await expect(board(page)).toHaveCount(0);
      expect(patches.count).toBe(2);
      expect(await storedDealStatus(page, dealId)).toBe("NEGO");
    });
  });

  test.describe("stored", () => {
    test.use({ expectedFailedRequests: [MASUK_DEAL_PATCH] });

    test("a move the server stored but never answered shows the stored stage, with no error", async ({ page }) => {
      const dealId = loadFixtureManifest().deals.masuk;
      const card = await openCardMenu(page, dealId);
      await failNext(page, "PATCH", `/api/deals/${dealId}`, "stored-no-answer");
      await page.getByRole("menuitem", { name: "Lanjut ke Nego" }).click();

      // Optimistic move first; after the wait the server's own record keeps it there.
      await expect(card).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Simpan deal" })).toHaveCount(0);
      await expect.poll(() => storedDealStatus(page, dealId)).toBe("NEGO");
      await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Nego", exact: true }).click();
      const moved = page.locator("article", { hasText: loadFixtureManifest().brands[dealId] });
      // Not pending any more: its menu is usable once the page has its answer.
      await expect(moved.getByRole("button", { name: /^Aksi lain untuk deal/ })).toBeEnabled({ timeout: 15_000 });
      await expect(board(page)).toHaveCount(0);
    });
  });
});

test.describe("board Buat invoice when the server cannot answer", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.use({
    expectedErrorResponses: [{ method: "POST", pathname: "/api/invoices", status: 502 }],
    expectedFailedRequests: [{ method: "POST", pathname: "/api/invoices" }],
  });

  async function openInvoiceMenu(page: Page) {
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoicePending];
    await page.goto("/deal?tahap=INVOICE");
    const card = page.locator("article", { hasText: brand });
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    return card;
  }

  test("a create that gets a 502 HTML page says it may not be created, and Buat invoice again creates exactly one", async ({ page }) => {
    const dealId = loadFixtureManifest().deals.invoicePending;
    const card = await openInvoiceMenu(page);
    const posts = await failNext(page, "POST", "/api/invoices", "gateway-html");
    await page.getByRole("menuitem", { name: "Buat invoice" }).click();

    await expect(board(page)).toContainText(INVOICE_UNKNOWN);
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(await storedInvoicesForDeal(page, dealId)).toBe(0);

    await card.getByRole("button", { name: /^Aksi lain untuk deal/ }).click();
    await page.getByRole("menuitem", { name: "Buat invoice" }).click();
    await expect(page.getByRole("status")).toHaveText("Invoice dibuat");
    await expect(board(page)).toHaveCount(0);
    expect(posts.count).toBe(2);
    expect(await storedInvoicesForDeal(page, dealId)).toBe(1);
  });

  test("a create the server stored but never answered is shown as created, and Buat invoice is not offered again", async ({ page }) => {
    const dealId = loadFixtureManifest().deals.invoicePending;
    const card = await openInvoiceMenu(page);
    const posts = await failNext(page, "POST", "/api/invoices", "stored-no-answer");
    await page.getByRole("menuitem", { name: "Buat invoice" }).click();

    await expect(page.getByRole("status")).toHaveText("Invoice dibuat", { timeout: 15_000 });
    await expect(board(page)).toHaveCount(0);
    await card.getByRole("button", { name: /^Aksi lain untuk deal/ }).click();
    await expect(page.getByRole("menuitem", { name: "Buat invoice" })).toHaveCount(0);
    expect(posts.count).toBe(1);
    expect(await storedInvoicesForDeal(page, dealId)).toBe(1);
  });
});
