import { expect, test } from "@playwright/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

// Money is formatted with a non-breaking space after "Rp" (see
// src/lib/format/money.ts and CLAUDE.md's IDR formatting rule) -- a plain
// space in a locator regex never matches it.   (not a literal
// character in this source) keeps that explicit rather than invisible.
const NBSP = " ";

test.describe("invoice journeys", { tag: "@critical" }, () => {
  // Reseed before each test: "create an invoice" depends on a deal having
  // no invoice yet, which a prior run (in another project sharing this
  // database within the same invocation) may have already created. See
  // e2e/support/reseed.ts.
  test.beforeEach(reseedFixtures);

  test("create an invoice from a pending INVOICE-stage deal", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoicePending];

    await page.goto("/deal?tahap=INVOICE");
    const card = page.locator("article", { hasText: brand });
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    await page.getByRole("menuitem", { name: "Buat invoice" }).click();

    await expect(page.getByRole("status")).toHaveText("Invoice dibuat");
  });

  test("invoice list navigates to invoice detail with matching totals", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoiceSent];

    await page.goto("/invoice");
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(brand) }).click();

    await expect(page).toHaveURL(/\/invoice\//);
    await expect(page.getByRole("heading", { name: `Rp${NBSP}6.000.000` })).toBeVisible();
  });

  test("mark an invoice paid, then undo", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    await page.getByRole("button", { name: "Tandai lunas" }).click();
    await expect(page.getByRole("heading", { name: "Status pembayaran" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Batalkan status lunas" })).toBeVisible();

    await page.getByRole("button", { name: "Batalkan status lunas" }).click();
    await expect(page.getByRole("button", { name: "Tandai lunas" })).toBeVisible();
  });
});
