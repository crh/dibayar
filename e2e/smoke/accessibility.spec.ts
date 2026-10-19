// Lightweight, targeted accessibility smoke checks on the highest-traffic
// authenticated pages, invoice detail, plus the Add Deal dialog (the one
// modal widget in the app). Deliberately not a whole-page ARIA snapshot suite (see
// docs/testing/E2E.md) -- axe's automated ruleset catches contrast/label/
// landmark-class issues; the explicit role/aria-pressed/focus assertions
// elsewhere in this suite (deal-filter chips, dialog focus trap) cover the
// interaction-specific semantics axe can't.
import { expect, test } from "../support/test";
import { assertNoSeriousA11yViolations } from "../support/a11y";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

test.describe("accessibility smoke", { tag: "@a11y" }, () => {
  for (const [name, path] of [
    ["Beranda", "/"],
    ["Deal board", "/deal"],
    ["Invoice list", "/invoice"],
    ["Pengaturan", "/pengaturan"],
  ] as const) {
    test(`${name} has no automatically-detectable serious/critical a11y violations`, async ({ page }, testInfo) => {
      await page.goto(path);
      await assertNoSeriousA11yViolations(page, testInfo);
    });
  }

  // Invoice detail is the app's densest page (status actions, due-date
  // field, share management). Scanned once the share section has settled,
  // so the link field and its controls are part of the scan. The public
  // /i/ page is scanned in e2e/public/invoice.spec.ts.
  test("Invoice detail has no automatically-detectable serious/critical a11y violations", async ({ page }, testInfo) => {
    // Other @a11y-tagged tests revoke this invoice's share; start from the seed.
    reseedFixtures();
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);
    await expect(page.getByTestId("share-link-track")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
    await assertNoSeriousA11yViolations(page, testInfo);
  });

  test("Invoice detail with the regenerate confirmation open has no automatically-detectable serious/critical a11y violations", async ({ page }, testInfo) => {
    reseedFixtures();
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);
    await page.getByRole("button", { name: "Buat ulang tautan" }).click();
    await expect(page.getByRole("button", { name: "Ya, buat tautan baru" })).toBeVisible();
    await assertNoSeriousA11yViolations(page, testInfo);
    // Leaves the share untouched for the tests that follow.
    await page.getByRole("button", { name: "Batal" }).click();
  });

  test("Add Deal dialog: correct role, accessible name, and a working focus trap", async ({ page }, testInfo) => {
    await page.goto("/deal?tambah=1");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    await assertNoSeriousA11yViolations(page, testInfo, '[role="dialog"]');

    // Shift+Tab from the first focusable element must wrap to the last
    // (the dialog's documented focus trap), not escape to the page behind it.
    await expect(dialog.getByRole("button", { name: "Tutup" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    const lastFocusable = dialog.locator(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ).last();
    await expect(lastFocusable).toBeFocused();
  });

  test("deal stage filter group exposes group role, label, and per-chip pressed state", async ({ page }) => {
    await page.goto("/deal");
    const group = page.getByRole("group", { name: "Filter tahap deal" });
    await expect(group).toBeVisible();
    for (const label of ["Semua", "Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"]) {
      await expect(group.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", /true|false/);
    }
  });
});
