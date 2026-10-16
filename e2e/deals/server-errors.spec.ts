// What the deal board says when the server cannot answer a save (#53).
//
// Each test breaks exactly one request, in one way:
//
// - a gateway error page (502, HTML or JSON) or a dropped connection
//   (route.abort): the request never reached the app, so nothing was stored
//   -- but the page cannot know that, and must not claim either;
// - no answer at all: the page gives up after its bounded wait
//   (fetchWithTimeout) instead of spinning forever;
// - stored, but the answer never arrived or was a gateway's JSON 504
//   (route.fetch() lets the request reach the real server, then its answer
//   is withheld or replaced): the page says it may not be saved, and the next
//   press sends the same Idempotency-Key, so the server returns the stored
//   deal or invoice instead of writing a second one;
// - a real 403 from the server's own Origin check (the request reaches the
//   app with a foreign Origin header; nothing is stubbed).
//
// The key itself is checked against the real database below: repeats sent
// at the same time, and an original that reaches the server only after its
// retry was stored (the case a point-in-time read cannot cover), each leave
// exactly one row.
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

type Failure = "gateway-html" | "gateway-json" | "network" | "no-answer" | "stored-no-answer" | "stored-gateway-json" | "stored-gateway-408-json";

type SentRequest = { key: string | undefined; body: string | null };

// Answers the next matching request with `failure`; later ones go to the
// server untouched. Returns every matching request the page sent, with its
// Idempotency-Key and body.
async function failNext(page: Page, method: string, pathname: string, failure: Failure) {
  const sent: SentRequest[] = [];
  let armed = true;
  await page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      const request = route.request();
      if (request.method() !== method) return route.fallback();
      sent.push({ key: request.headers()["idempotency-key"], body: request.postData() });
      if (!armed) return route.fallback();
      armed = false;
      if (failure === "gateway-html") {
        return route.fulfill({ status: 502, contentType: "text/html", body: "<html><body>Bad Gateway</body></html>" });
      }
      if (failure === "gateway-json") {
        return route.fulfill({ status: 502, json: { message: "Bad Gateway" } });
      }
      if (failure === "network") return route.abort("internetdisconnected");
      if (failure === "stored-gateway-json") {
        // Stored by the real server; a gateway's own JSON answer replaces its reply.
        await route.fetch();
        return route.fulfill({ status: 504, json: { message: "Gateway Timeout" } });
      }
      if (failure === "stored-gateway-408-json") {
        // The real API already stored the deal, but the gateway answers 408.
        // The UI must reuse the same key so a retry reads that deal.
        await route.fetch();
        return route.fulfill({ status: 408, json: { message: "Request Timeout" } });
      }
      // The real server handles it; its answer is never passed on.
      if (failure === "stored-no-answer") await route.fetch();
      // Left unanswered: the page's own timeout ends the request.
    },
  );
  return sent;
}

// The same request again, straight to the real server (page.request is not
// routed): what a slow original or a repeat would deliver.
async function resend(page: Page, pathname: string, request: SentRequest) {
  expect(request.key).toBeTruthy();
  return page.request.post(pathname, {
    headers: { "Content-Type": "application/json", "Idempotency-Key": request.key!, Origin: new URL(page.url()).origin },
    data: request.body ?? "",
  });
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

  const FAILURE_NAMES = {
    "gateway-html": "a 502 HTML page",
    "gateway-json": "a JSON 502 from a gateway",
    network: "no connection",
    "no-answer": "no answer in time",
  } as const;

  for (const failure of ["gateway-html", "gateway-json", "network", "no-answer"] as const) {
    test(`a save that gets ${FAILURE_NAMES[failure]} says it may not be saved, keeps the form, and Simpan deal again saves exactly one deal`, async ({ page }) => {
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
      expect(posts).toHaveLength(2);
      expect(posts[1].key).toBe(posts[0].key);
      expect(await storedDealsNamed(page, brand)).toBe(1);
    });
  }

  for (const failure of ["stored-no-answer", "stored-gateway-json"] as const) {
    test.describe(failure, () => {
      // One entry per test.use: a two-element array is read as [value, options].
      test.use({ expectedErrorResponses: [{ method: "POST", pathname: "/api/deals", status: failure === "stored-gateway-json" ? 504 : 502 }] });

      test(`a save the server stored but ${failure === "stored-no-answer" ? "never answered" : "a gateway answered with a JSON 504"} says it may not be saved, and Simpan deal again shows that one deal instead of a second`, async ({ page }) => {
        const brand = `E2E Tersimpan ${failure} ${Date.now()}`;
        const dialog = await openFilledDialog(page, brand);
        const posts = await failNext(page, "POST", "/api/deals", failure);
        const save = dialog.getByRole("button", { name: "Simpan deal" });
        await save.click();

        await expect(dialog.getByRole("alert")).toContainText(SAVE_UNKNOWN, { timeout: 15_000 });
        await expect(page.getByRole("status")).toHaveCount(0);
        await expect(dialog.getByLabel("Nama brand")).toHaveValue(brand);
        // Stored by the first request, which the page could not know.
        await expect.poll(() => storedDealsNamed(page, brand)).toBe(1);

        const repeated = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals");
        await save.click();
        // The server's answer to a repeat of a stored create.
        expect((await repeated).status()).toBe(200);
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole("status")).toHaveText("Deal disimpan");
        await expect(page.getByText(brand, { exact: true })).toHaveCount(1);
        expect(posts).toHaveLength(2);
        expect(posts[1].key).toBe(posts[0].key);
        expect(await storedDealsNamed(page, brand)).toBe(1);

        await page.reload();
        await expect(page.getByText(brand, { exact: true })).toHaveCount(1);
      });
    });
  }

  // The #54 review case: the first request is still on its way when the page
  // gives up, the person presses again and that one is stored, and only then
  // does the first one reach the server. A read of the deals at any point
  // before that would find nothing; the key still keeps it to one deal.
  test("an original that reaches the server after its retry was stored returns that deal instead of a second", async ({ page }) => {
    const brand = `E2E Terlambat ${Date.now()}`;
    const dialog = await openFilledDialog(page, brand);
    const posts = await failNext(page, "POST", "/api/deals", "no-answer");
    const save = dialog.getByRole("button", { name: "Simpan deal" });
    await save.click();
    await expect(dialog.getByRole("alert")).toContainText(SAVE_UNKNOWN, { timeout: 15_000 });
    expect(await storedDealsNamed(page, brand)).toBe(0);

    await save.click();
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");
    expect(await storedDealsNamed(page, brand)).toBe(1);

    const late = await resend(page, "/api/deals", posts[0]);
    expect(late.status()).toBe(200);
    expect(((await late.json()) as { deal: { brand: string } }).deal.brand).toBe(brand);
    expect(await storedDealsNamed(page, brand)).toBe(1);
  });
});

test.describe("HTTP 408 after the server stores a deal", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.use({ expectedErrorResponses: [{ method: "POST", pathname: "/api/deals", status: 408 }] });

  test("a gateway JSON 408 keeps the same key and the retry reuses one stored deal", async ({ page }) => {
    const brand = `E2E Gateway 408 ${Date.now()}`;
    const dialog = await openFilledDialog(page, brand);
    const posts = await failNext(page, "POST", "/api/deals", "stored-gateway-408-json");
    const save = dialog.getByRole("button", { name: "Simpan deal" });
    await save.click();

    await expect(dialog.getByRole("alert")).toContainText(SAVE_UNKNOWN, { timeout: 15_000 });
    await expect(save).toBeEnabled();
    await expect(dialog.getByLabel("Nama brand")).toHaveValue(brand);
    await expect.poll(() => storedDealsNamed(page, brand)).toBe(1);

    const response = page.waitForResponse((r) =>
      r.request().method() === "POST" && new URL(r.url()).pathname === "/api/deals",
    );
    await save.click();
    expect((await response).status()).toBe(200);
    await expect(dialog).toHaveCount(0);
    expect(posts).toHaveLength(2);
    expect(posts[1].key).toBe(posts[0].key);
    expect(posts[1].body).toBe(posts[0].body);
    expect(await storedDealsNamed(page, brand)).toBe(1);
    await page.reload();
    await expect(page.getByText(brand, { exact: true })).toHaveCount(1);
  });
});

test.describe("Idempotency-Key against the real database", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  test("repeats of one deal create sent at the same time store one deal, and each gets that deal", async ({ page }) => {
    await page.goto("/deal");
    const brand = `E2E Serentak ${Date.now()}`;
    const request = {
      key: crypto.randomUUID(),
      body: JSON.stringify({ brand, contactWa: "081234567890", scope: "E2E concurrent repeat", feeIdr: 1750000, status: "MASUK" }),
    };

    const responses = await Promise.all(Array.from({ length: 6 }, () => resend(page, "/api/deals", request)));

    const statuses = responses.map((response) => response.status()).sort();
    expect(statuses).toEqual([200, 200, 200, 200, 200, 201]);
    const ids = new Set(await Promise.all(responses.map(async (response) => ((await response.json()) as { deal: { id: string } }).deal.id)));
    expect(ids.size).toBe(1);
    expect(await storedDealsNamed(page, brand)).toBe(1);
  });

  test("a key already used for a different deal is refused with 409 and stores nothing", async ({ page }) => {
    await page.goto("/deal");
    const brand = `E2E Kunci Bentrok ${Date.now()}`;
    const key = crypto.randomUUID();
    const deal = { brand, contactWa: "081234567890", scope: "E2E key conflict", feeIdr: 1750000, status: "MASUK" };
    expect((await resend(page, "/api/deals", { key, body: JSON.stringify(deal) })).status()).toBe(201);

    const other = await resend(page, "/api/deals", { key, body: JSON.stringify({ ...deal, brand: `${brand} lain` }) });

    expect(other.status()).toBe(409);
    expect(await storedDealsNamed(page, brand)).toBe(1);
    expect(await storedDealsNamed(page, `${brand} lain`)).toBe(0);
  });

  test("repeats of one invoice create sent at the same time make one invoice", async ({ page }) => {
    await page.goto("/deal");
    const dealId = loadFixtureManifest().deals.invoicePending;
    const request = { key: crypto.randomUUID(), body: JSON.stringify({ dealId, withholdingTaxType: "NONE" }) };

    const responses = await Promise.all(Array.from({ length: 6 }, () => resend(page, "/api/invoices", request)));

    expect(responses.map((response) => response.status()).sort()).toEqual([200, 200, 200, 200, 200, 201]);
    expect(await storedInvoicesForDeal(page, dealId)).toBe(1);
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
      expect(patches).toHaveLength(2);
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
    expect(posts).toHaveLength(2);
    expect(posts[1].key).toBe(posts[0].key);
    expect(await storedInvoicesForDeal(page, dealId)).toBe(1);
  });

  test("a create the server stored but never answered says it may not be created, and Buat invoice again shows that one invoice instead of a second", async ({ page }) => {
    const dealId = loadFixtureManifest().deals.invoicePending;
    const card = await openInvoiceMenu(page);
    const posts = await failNext(page, "POST", "/api/invoices", "stored-no-answer");
    await page.getByRole("menuitem", { name: "Buat invoice" }).click();

    await expect(board(page)).toContainText(INVOICE_UNKNOWN, { timeout: 15_000 });
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect.poll(() => storedInvoicesForDeal(page, dealId)).toBe(1);

    await card.getByRole("button", { name: /^Aksi lain untuk deal/ }).click();
    await page.getByRole("menuitem", { name: "Buat invoice" }).click();
    await expect(page.getByRole("status")).toHaveText("Invoice dibuat");
    await expect(board(page)).toHaveCount(0);
    await card.getByRole("button", { name: /^Aksi lain untuk deal/ }).click();
    await expect(page.getByRole("menuitem", { name: "Buat invoice" })).toHaveCount(0);
    expect(posts).toHaveLength(2);
    expect(posts[1].key).toBe(posts[0].key);
    expect(await storedInvoicesForDeal(page, dealId)).toBe(1);
  });
});
