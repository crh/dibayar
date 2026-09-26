// Curated visual regression: a small set of stable, important states, not a
// snapshot of every page/transition (see docs/testing/E2E.md). Screenshots
// are not the primary correctness check anywhere else in this suite --
// semantic assertions (role, aria-pressed, URL, text) do that job. This file
// exists only to catch unintended visual drift in layout/spacing/color that
// semantic assertions wouldn't notice.
//
// Run with `npm run test:e2e:visual`; update intentional baselines with
// `npm run test:e2e:update-snapshots`. Fixture dates rendered into these
// pages (invoice due dates, share-link expiry) are fixed calendar dates,
// not computed relative to whenever the seed runs -- see
// scripts/e2e-fixtures.ts -- specifically so the formatted text (and its
// wrapped line height) doesn't drift with the day a test happens to run,
// which would fail these for reasons having nothing to do with a real
// regression. No masking is needed to keep these stable across runs.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

test.describe("visual regression", { tag: "@visual" }, () => {
  // Visual runs can be composed with other E2E tiers in a local aggregate.
  // Re-seed before every capture so a preceding mutating settings/deal test
  // cannot change the screenshot's owner data.
  test.beforeEach(reseedFixtures);

  test("Beranda desktop", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();
    await expect(page).toHaveScreenshot("beranda-desktop.png", { fullPage: true });
  });

  test("Beranda mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();
    await expect(page).toHaveScreenshot("beranda-mobile.png", { fullPage: true });
  });

  test("Beranda true mobile", { tag: "@visual-mobile" }, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();
    await expect(page).toHaveScreenshot("beranda-true-mobile.png", { fullPage: true });
  });

  test("Deals default (Semua)", async ({ page }) => {
    await page.goto("/deal");
    await expect(page.getByRole("group", { name: /filter tahap deal/i })).toBeVisible();
    await expect(page).toHaveScreenshot("deals-semua-desktop.png", { fullPage: true });
  });

  test("Deals filtered to Invoice", async ({ page }) => {
    await page.goto("/deal?tahap=INVOICE");
    await expect(page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Invoice", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveScreenshot("deals-invoice-filtered-desktop.png", { fullPage: true });
  });

  test("Add Deal dialog open", async ({ page }) => {
    await page.goto("/deal?tambah=1");
    await expect(page.getByRole("dialog", { name: "Tambah deal" })).toBeVisible();
    await expect(page).toHaveScreenshot("deals-add-dialog-desktop.png", { fullPage: true });
  });

  test("Invoice list", async ({ page }) => {
    await page.goto("/invoice");
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
    await expect(page).toHaveScreenshot("invoice-list-desktop.png", { fullPage: true });
  });

  test("Invoice detail", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);
    await expect(page.getByRole("heading", { name: "Status pembayaran" })).toBeVisible();
    await expect(page).toHaveScreenshot("invoice-detail-desktop.png", { fullPage: true });
  });

  test("Pengaturan main state", async ({ page }) => {
    await page.goto("/pengaturan");
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();
    await expect(page).toHaveScreenshot("pengaturan-desktop.png", { fullPage: true });
  });
});
