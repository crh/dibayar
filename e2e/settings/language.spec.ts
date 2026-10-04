// Real-interaction coverage for the interface-language switch
// (docs/testing/journey-coverage.json: SET-06). This is the suite's one
// targeted language pair (JOURNEY-GRAPHS.md §6), not a language x page
// matrix.
//
// The only earlier coverage switched language with a page.evaluate fetch
// to /api/me/language. Here the English button is clicked, the choice is
// checked after a reload and on another page reached through the nav, an
// English control is used on that page, and Indonesian is restored through
// the same Settings buttons.
//
// User.language belongs to the fixture owner every other test signs in as,
// so a failure halfway would leave the next test in English. The reseed
// before AND after each test resets it (scripts/e2e-fixtures.ts seeds
// language "id"); the new browser context of the next test carries no
// language cookie of its own. The language PATCH is rate-limited to 10 per
// minute per user (src/lib/rate-limit.ts); this test sends two per project.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";

function isLanguagePatch(response: { request(): { method(): string }; url(): string }) {
  return response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/me/language";
}

test.describe("interface language", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("choosing English in Settings persists across reload and pages, and Indonesia switches it back", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const invoiceBrand = manifest.brands[manifest.deals.invoiceSent];

    await page.goto("/pengaturan");
    const languageGroup = page.getByRole("group", { name: "Bahasa antarmuka" });
    await expect(languageGroup.getByRole("button", { name: "Indonesia" })).toHaveAttribute("aria-pressed", "true");

    const toEnglish = page.waitForResponse(isLanguagePatch);
    await languageGroup.getByRole("button", { name: "English" }).click();
    expect((await toEnglish).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Interface language" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.reload();
    const englishGroup = page.getByRole("group", { name: "Interface language" });
    await expect(englishGroup.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Payment account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();

    // Another page, reached through the (now English) navigation.
    await primaryNav(page, "en").getByRole("link", { name: "Invoices", exact: true }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await page.getByRole("link", { name: new RegExp(invoiceBrand) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${manifest.invoices.sent}$`));
    await expect(page.getByText("Due date", { exact: true })).toBeVisible();

    // Use an English control: Clear empties the due date, which then reads
    // "Not set" in the header and the field, also after a reload.
    const clearPatch = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${manifest.invoices.sent}`,
    );
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    expect((await clearPatch).ok()).toBe(true);
    await expect(page.getByText("Due: Not set", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Due: Not set", { exact: true })).toBeVisible();
    await expect(page.getByText("Due date", { exact: true })).toBeVisible();
    await expect(page.getByText("Jatuh tempo: Belum ditentukan")).toHaveCount(0);

    // Back to Indonesian through the same Settings control.
    await primaryNav(page, "en").getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
    const toIndonesian = page.waitForResponse(isLanguagePatch);
    await page.getByRole("group", { name: "Interface language" }).getByRole("button", { name: "Indonesia" }).click();
    expect((await toIndonesian).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Bahasa antarmuka" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("group", { name: "Bahasa antarmuka" }).getByRole("button", { name: "Indonesia" })).toHaveAttribute("aria-pressed", "true");
    await primaryNav(page).getByRole("link", { name: "Invoice", exact: true }).click();
    await page.getByRole("link", { name: new RegExp(invoiceBrand) }).click();
    await expect(page.getByText("Jatuh tempo: Belum ditentukan", { exact: true })).toBeVisible();
    await expect(page.getByText("Tanggal jatuh tempo", { exact: true })).toBeVisible();
  });
});
