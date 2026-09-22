import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { assertNoSeriousA11yViolations } from "../support/a11y";
import { ownerSessionCookie } from "../support/auth";
import { reseedFixtures } from "../support/reseed";

test.describe("recipient invoice journey", { tag: ["@critical", "@a11y"] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // This file's own tests are read-only, but the revoke test below mutates
  // the shared "sent" invoice's share -- reseed before every test so that
  // mutation can never leak into another test in this file, another
  // project's run of it (chromium/chromium-mobile share one database within
  // an invocation -- see e2e/support/reseed.ts), or a later spec file.
  test.beforeEach(reseedFixtures);

  test("valid share link renders recipient-safe invoice content and PDF action", async ({ page }, testInfo) => {
    const manifest = loadFixtureManifest();
    await page.goto(`/i/${manifest.shareTokens.active}`);

    await expect(page.getByText(/Nomor invoice:\s*E2E\/SENT\/001/)).toBeVisible();
    await expect(page.getByText("E2E Fixture Owner", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("E2E Brand Invoice Terkirim", { exact: true })).toBeVisible();
    await expect(page.locator('[data-ux-money="display"]')).toHaveText("Rp 6.000.000");
    await expect(page.getByRole("link", { name: "Unduh PDF" })).toHaveAttribute(
      "href",
      `/api/public/invoices/${manifest.shareTokens.active}/pdf`,
    );

    await expect(page.getByRole("link", { name: "Beranda" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Menu akun" })).toHaveCount(0);

    await assertNoSeriousA11yViolations(page, testInfo);
  });

  test("invalid share link uses the generic not-found state", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const response = await page.goto(`/i/${manifest.shareTokens.invalid}`);

    expect(response?.status()).toBe(404);
    await expect(page.locator('p[role="alert"]')).toHaveText("Tautan ini tidak ditemukan.");
    await expect(page.getByText("E2E/SENT/001", { exact: true })).toHaveCount(0);
  });

  test("expired share link shows an honest expired state without invoice data", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const response = await page.goto(`/i/${manifest.shareTokens.expired}`);

    expect(response?.status()).toBe(200);
    await expect(page.locator('p[role="alert"]')).toHaveText("Tautan ini sudah tidak berlaku.");
    await expect(page.getByText("E2E/PAID/002", { exact: true })).toHaveCount(0);
  });

  test("valid public PDF is downloadable without authentication", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const response = await page.request.get(`/api/public/invoices/${manifest.shareTokens.active}/pdf`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect(response.headers()["content-disposition"]).toContain("E2E-SENT-001.pdf");
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("invalid public PDF does not disclose invoice content", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const response = await page.request.get(`/api/public/invoices/${manifest.shareTokens.invalid}/pdf`);

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Invoice tidak ditemukan." });
  });

  // E2E-IMPROVEMENT-PLAN.md C1: issuer name is a real owner-entered field
  // (up to 120 chars per user-settings-validation.ts), and this route is
  // the one place InvoiceDocumentHtml (blocks.tsx) actually renders on the
  // web -- so a long unbreakable issuer name here is a genuine recipient-
  // facing risk, not a hypothetical. Confirmed a real bug this way before
  // fixing it: IssuerBlock/ClientBlock's plain <p> elements had no
  // `overflow-wrap`/`break-words`, so an unbreakable name overflowed the
  // viewport at 390px with no ancestor scroll container to absorb it
  // (unlike a board card, this page has none) -- a genuine page-level
  // horizontal-scroll bug, fixed with `break-words` on both blocks.
  //
  // Mutates shared owner Settings (issuerName), so unlike this file's other
  // read-only tests it reseeds itself at the end -- not relying on the
  // file's own beforeEach(reseedFixtures), which only protects tests that
  // run *after* it, not the revoked-token test's own assertions or
  // whatever runs in the next project/file within this invocation.
  test("a long unbreakable issuer name does not cause horizontal overflow on the public invoice page", async ({ page, browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "this test is specifically about the 390px mobile layout");

    const manifest = loadFixtureManifest();
    const longIssuer = "E2ELongIssuerBusinessNameWithNoSpacesWhatsoeverForOverflowTesting";

    const ownerContext = await browser.newContext({
      storageState: { cookies: [ownerSessionCookie(baseURL!)], origins: [] },
    });
    const ownerPage = await ownerContext.newPage();
    try {
      await ownerPage.goto("/pengaturan");
      await ownerPage.getByLabel("Nama / nama usaha").fill(longIssuer);
      await ownerPage.getByRole("button", { name: "Simpan pengaturan" }).click();
      await expect(ownerPage.getByText("Tersimpan")).toBeVisible();

      await page.goto(`/i/${manifest.shareTokens.active}`);
      await expect(page.getByText(longIssuer, { exact: true })).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await ownerContext.close();
      reseedFixtures();
    }
  });

  // E2E-IMPROVEMENT-PLAN.md C1: a revoked token must become unusable to the
  // recipient, not only stop appearing in the owner's UI. Uses the real
  // revoke action (owner UI, not a raw API call) so this exercises the same
  // path a real owner takes, mirroring invoice-journeys.spec.ts's own
  // create/regenerate/revoke test but from the recipient's side afterward.
  // Placed last in this file: it is the only test here that mutates the
  // shared active share, and test.beforeEach(reseedFixtures) above protects
  // every other test (in this file, the other project, or a later spec
  // file) from ever seeing that mutation.
  test("revoked token becomes unusable to the recipient after reload", async ({ page, browser, baseURL }) => {
    const manifest = loadFixtureManifest();
    const activePath = `/i/${manifest.shareTokens.active}`;

    await page.goto(activePath);
    await expect(page.getByText(/Nomor invoice:\s*E2E\/SENT\/001/)).toBeVisible();

    const ownerContext = await browser.newContext({
      storageState: { cookies: [ownerSessionCookie(baseURL!)], origins: [] },
    });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`/invoice/${manifest.invoices.sent}`);
    await ownerPage.getByRole("button", { name: "Cabut tautan" }).click();
    await ownerPage.getByRole("button", { name: "Ya, cabut tautan" }).click();
    await expect(ownerPage.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
    await ownerContext.close();

    const response = await page.reload();
    expect(response?.status()).toBe(404);
    await expect(page.locator('p[role="alert"]')).toHaveText("Tautan ini tidak ditemukan.");
    await expect(page.getByText("E2E/SENT/001", { exact: true })).toHaveCount(0);
  });
});
