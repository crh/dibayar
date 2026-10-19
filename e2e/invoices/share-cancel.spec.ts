// Real-interaction coverage for backing out of the two destructive share
// confirmations (docs/testing/journey-coverage.json: SHARE-04).
//
// "Buat ulang tautan" and "Cabut tautan" each open a warning with Batal.
// Batal must change nothing: no request, the same link shown, the same link
// still opening for the recipient, also after a reload. The confirm paths
// are SHARE-02 / SHARE-03.
import type { Page } from "@playwright/test";
import { expect } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";
import { expectRecipientSeesInvoice, shareTest as test, shownShareLink, trackShareMutations } from "../support/share-links";

const NBSP = " ";
const INVOICE_NUMBER = "E2E/SENT/001";
const AMOUNT = `Rp${NBSP}6.000.000`;
const REGENERATE_WARNING = "Tautan lama akan langsung berhenti berfungsi. Lanjutkan buat tautan baru?";
const REVOKE_WARNING = "Penerima tidak akan bisa membuka invoice ini lagi. Lanjutkan cabut tautan?";

function shareSection(page: Page) {
  return page.getByRole("region", { name: "Bagikan invoice" });
}

test.describe("cancelling share confirmations", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("Batal on Buat ulang tautan and on Cabut tautan leaves the link unchanged and working", async ({ page, recipient }) => {
    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    const brand = manifest.brands[manifest.deals.invoiceSent];

    await page.goto("/");
    await primaryNav(page).getByRole("link", { name: "Invoice", exact: true }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await page.getByRole("link", { name: new RegExp(brand) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));

    const section = shareSection(page);
    const originalLink = await shownShareLink(page);
    await expectRecipientSeesInvoice(recipient, originalLink, INVOICE_NUMBER, AMOUNT);
    const mutations = trackShareMutations(page, invoiceId);

    // Regenerate, then back out.
    await section.getByRole("button", { name: "Buat ulang tautan" }).click();
    await expect(section.getByText(REGENERATE_WARNING)).toBeVisible();
    await expect(section.getByRole("button", { name: "Ya, buat tautan baru" })).toBeVisible();
    await section.getByRole("button", { name: "Batal" }).click();
    await expect(section.getByText(REGENERATE_WARNING)).toHaveCount(0);
    await expect(section.getByRole("button", { name: "Ya, buat tautan baru" })).toHaveCount(0);
    expect((await shownShareLink(page)) === originalLink, "the link is unchanged after cancelling regenerate").toBe(true);

    // Revoke, then back out.
    await section.getByRole("button", { name: "Cabut tautan" }).click();
    await expect(section.getByText(REVOKE_WARNING)).toBeVisible();
    await expect(section.getByRole("button", { name: "Ya, cabut tautan" })).toBeVisible();
    await section.getByRole("button", { name: "Batal" }).click();
    await expect(section.getByText(REVOKE_WARNING)).toHaveCount(0);
    await expect(section.getByRole("button", { name: "Ya, cabut tautan" })).toHaveCount(0);
    await expect(section.getByText("Tautan berbagi aktif.")).toBeVisible();
    expect((await shownShareLink(page)) === originalLink, "the link is unchanged after cancelling revoke").toBe(true);

    // Neither cancel sent anything, and both actions are still on offer.
    expect(mutations).toEqual([]);
    await expect(section.getByRole("button", { name: "Buat ulang tautan" })).toBeEnabled();
    await expect(section.getByRole("button", { name: "Cabut tautan" })).toBeEnabled();

    // The same link after a reload, and the recipient can still open it.
    await page.reload();
    expect((await shownShareLink(page)) === originalLink, "the same link is shown after a reload").toBe(true);
    await expect(shareSection(page).getByText("Belum ada tautan berbagi untuk invoice ini.")).toHaveCount(0);
    await expectRecipientSeesInvoice(recipient, originalLink, INVOICE_NUMBER, AMOUNT);
    expect(mutations).toEqual([]);
  });
});
