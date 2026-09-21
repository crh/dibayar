import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { assertNoSeriousA11yViolations } from "../support/a11y";

test.describe("recipient invoice journey", { tag: ["@critical", "@a11y"] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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
});
