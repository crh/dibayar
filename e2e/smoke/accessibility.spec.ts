// Lightweight, targeted accessibility smoke checks on the highest-traffic
// authenticated pages plus the Add Deal dialog (the one modal widget in the
// app). Deliberately not a whole-page ARIA snapshot suite (see
// docs/testing/E2E.md) -- axe's automated ruleset catches contrast/label/
// landmark-class issues; the explicit role/aria-pressed/focus assertions
// elsewhere in this suite (deal-filter chips, dialog focus trap) cover the
// interaction-specific semantics axe can't.
import { expect, test } from "../support/test";
import { assertNoSeriousA11yViolations } from "../support/a11y";

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
