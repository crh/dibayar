// Real-interaction coverage for clearing an invoice due date
// (docs/testing/journey-coverage.json: INV-DUE-01).
//
// The empty state is reached through the visible "Kosongkan" button a person
// would use, not fill(), and must survive a reload.
//
// This file used to also hold two test.fail() expected failures for FIND-02
// (the visible field did not open the picker) and FIND-03 (keyboard entry
// saved year 0002). PR #26 (merge b51fba1) fixed both, and its
// e2e/invoices/due-date-integrity.spec.ts has the positive replacements: the
// picker opening from the visible empty and filled text (INV-DUE-02), and
// desktop keyboard entry with no PATCH mid-typing, one PATCH on Enter,
// reload, and clear (INV-DUE-04). The old keyboard test assumed a click
// leaves the picker closed and that typing saves at once; both are no longer
// true, so it was removed rather than adapted.
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

const EMPTY_LABEL = "Belum ditentukan";

function isInvoicePatch(invoiceId: string) {
  return (response: { request(): { method(): string }; url(): string }) =>
    response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${invoiceId}`;
}

// Reaches the empty state through the UI a person would use (the visible
// "Kosongkan" button), then proves it survived a reload.
async function openInvoiceWithEmptyDueDate(page: Page, invoiceId: string) {
  await page.goto(`/invoice/${invoiceId}`);
  const clearPatch = page.waitForResponse(isInvoicePatch(invoiceId));
  await page.getByRole("button", { name: "Kosongkan" }).click();
  expect((await clearPatch).ok()).toBe(true);
  await page.reload();
}

// The visible display is aria-hidden by design (the real <input> carries the
// accessible name), so it is located by text inside the field's own wrapper
// rather than by role.
function dueDateDisplay(page: Page): Locator {
  return page.locator("#invoice-due-date").locator("xpath=..").getByText(EMPTY_LABEL, { exact: true });
}

test.describe("invoice due-date entry through the visible field", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  test("an invoice whose due date was cleared shows the empty state after reload", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await openInvoiceWithEmptyDueDate(page, manifest.invoices.sent);

    await expect(dueDateDisplay(page)).toBeVisible();
    await expect(page.getByLabel("Tanggal jatuh tempo")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Kosongkan" })).toHaveCount(0);
  });
});
