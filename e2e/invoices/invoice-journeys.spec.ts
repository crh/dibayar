import { expect, test } from "../support/test";
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
    await page.reload();
    await page.goto("/invoice");
    await expect(page.getByRole("link", { name: new RegExp(brand) })).toBeVisible();
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

  test("share link can be created, recovered after reload, regenerated, and revoked", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    await expect(page.getByRole("button", { name: "Buat ulang tautan" })).toBeVisible();
    await page.getByRole("button", { name: "Cabut tautan" }).click();
    await page.getByRole("button", { name: "Ya, cabut tautan" }).click();
    await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
    await page.getByRole("button", { name: "Buat tautan berbagi" }).click();

    const linkTrack = page.getByTestId("share-link-track");
    await expect(linkTrack).toBeVisible();
    const firstLink = await linkTrack.locator("span[title]").getAttribute("title");
    expect(firstLink).toMatch(/\/i\/[A-Za-z0-9_-]{40,}$/);

    await page.reload();
    await expect(linkTrack.locator("span[title]")).toHaveAttribute("title", firstLink!);

    await page.getByRole("button", { name: "Buat ulang tautan" }).click();
    await page.getByRole("button", { name: "Ya, buat tautan baru" }).click();
    await expect(linkTrack.locator("span[title]")).not.toHaveAttribute("title", firstLink!);

    await page.getByRole("button", { name: "Cabut tautan" }).click();
    await page.getByRole("button", { name: "Ya, cabut tautan" }).click();
    await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
  });

  test("due date edits and clears persist after reload", async ({ page }, testInfo) => {
    // Playwright cannot drive Chromium's native date picker reliably in the
    // emulated mobile project: fill() leaves the date input unchanged. The
    // persistence contract is covered on desktop; mobile still covers the
    // rendered invoice and all other invoice actions.
    test.skip(testInfo.project.name === "chromium-mobile", "native mobile date input is not automation-stable");
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    const dueDate = page.getByLabel("Tanggal jatuh tempo");
    await dueDate.fill("2030-01-15");
    await expect(page.getByText("Tersimpan")).toBeVisible();
    await expect(dueDate).toHaveValue("2030-01-15");

    await page.reload();
    await expect(dueDate).toHaveValue("2030-01-15");

    await page.getByRole("button", { name: "Kosongkan" }).click();
    await expect(page.getByText("Tersimpan")).toBeVisible();
    await page.reload();
    await expect(dueDate).toHaveValue("");
  });

  test("WhatsApp action opens a saved-template message with the invoice link", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    const action = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
    await expect(action).toBeEnabled();
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      action.click(),
    ]);

    await expect.poll(() => popup.url()).toContain("api.whatsapp.com/send");
    const popupUrl = new URL(popup.url());
    expect(popupUrl.searchParams.get("phone")).toBe("628110000006");
    const message = popupUrl.searchParams.get("text");
    expect(message).toContain("E2E Brand Invoice Terkirim");
    expect(message).toContain("E2E/SENT/001");
    expect(message).toMatch(/Rp\s6\.000\.000/);
    expect(message).toContain("http://localhost:3300/i/");
    await popup.close();
  });
});
