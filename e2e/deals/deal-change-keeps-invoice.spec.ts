// A change to a deal never rewrites the invoice already issued for it
// (docs/product/capabilities.json: CAP-INV-11; issue #55, "Invoice
// integrity").
//
// An invoice copies the deal's fee into its own amount and may take the
// deal's deadline as its due date when it is created (src/lib/invoices.ts).
// After that, number, amount, PPh and due date belong to the invoice: the
// owner and the brand must keep seeing the figures that were sent, whatever
// happens to the deal. Today the only deal change a person can make on a
// deal that already has an invoice is the contact name on deal detail, so
// that is the change driven here. When #55 adds editing of the fee,
// deadline and other fields, extend this journey with those edits rather
// than writing a second one.
//
// What this journey does NOT decide: the brand, scope, payment terms and
// contact name on the invoice document are read from the deal when the page
// or PDF is rendered (src/lib/invoice-share.ts), so a contact name saved
// after the invoice went out does appear on the brand's page. Whether that is
// wanted is an open product decision (CAP-INV-12, UNKNOWN); the journey
// records what it saw as an annotation and asserts nothing about it.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";
import { press, responseTo } from "../support/journey";
import { cardMenuEditAction, dealDetailEditAffordance } from "../support/deal-edit-affordance";

const NEW_CONTACT_NAME = "Kontak Baru Setelah Invoice";

// What the owner sees of the issued invoice: the header (number, amount, due
// date) and the Rincian block (number, PPh, amount).
async function ownerInvoiceFigures(page: Page, number: string, brand: string, isMobile: boolean) {
  await page.goto("/invoice");
  await press(page.getByRole("link", { name: new RegExp(brand) }), isMobile);
  await expect(page.getByText(number, { exact: true }).first()).toBeVisible();
  const details = page.locator("section", { has: page.locator("#rincian-invoice") });
  await expect(details).toContainText(number);
  return {
    due: (await page.getByText(/^Jatuh tempo/).first().innerText()).trim(),
    details: (await details.locator("dl").innerText()).replace(/\s+/g, " ").trim(),
  };
}

// What the brand sees on the shared link.
async function recipientFigures(recipient: Page, link: string) {
  const response = await recipient.goto(link);
  expect(response?.status()).toBe(200);
  const text = (await recipient.locator("body").innerText()).replace(/\s+/g, " ");
  return {
    number: /Nomor invoice:\s*E2E\/SENT\/001/.test(text),
    // Money is printed with a non-breaking space after "Rp".
    amount: (await recipient.locator('[data-ux-money="display"]').innerText()).replace(/\s+/g, " ").trim(),
    due: text.match(/Jatuh tempo[^.]*?\d{4}/)?.[0] ?? null,
    pph: text.match(/PPh 2[13][^R]*/)?.[0]?.trim() ?? null,
    showsNewContactName: text.includes(NEW_CONTACT_NAME),
  };
}

test.describe("a deal change leaves its issued invoice alone (CAP-INV-11)", () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("after the contact name of an invoiced deal is changed, the invoice keeps its number, amount, PPh and due date for the owner and the brand", { tag: "@critical" }, async ({ page, browser, baseURL, isMobile }, testInfo) => {
    test.setTimeout(60_000);
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.invoiceSent;
    const brand = manifest.brands[dealId];
    const number = "E2E/SENT/001";
    const recipientContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const recipient = await recipientContext.newPage();
    const link = `/i/${manifest.shareTokens.active}`;

    try {
      const ownerBefore = await ownerInvoiceFigures(page, number, brand, isMobile);
      const brandBefore = await recipientFigures(recipient, link);
      expect(brandBefore.number).toBe(true);
      expect(brandBefore.amount).toBe("Rp 6.000.000");
      expect(brandBefore.due).not.toBeNull();
      expect(brandBefore.showsNewContactName).toBe(false);

      // The deal, reached the way a person reaches it: board, Invoice stage,
      // card menu, Lihat detail. (Invoice detail has no link to its deal:
      // CAP-INV-03.)
      await page.goto("/deal");
      const stageFilter = page.getByRole("group", { name: /filter tahap deal/i });
      await press(stageFilter.getByRole("button", { name: "Invoice", exact: true }), isMobile);
      const card = page.locator("article", { hasText: brand });
      await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
      await press(page.getByRole("menuitem", { name: "Lihat detail" }), isMobile);
      await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
      await expect(page.getByText("Tahap saat ini: Invoice")).toBeVisible();

      await page.getByLabel("Nama kontak", { exact: true }).fill(NEW_CONTACT_NAME);
      const saved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("button", { name: "Simpan", exact: true }), isMobile));
      expect(saved.ok()).toBe(true);
      await expect(page.getByRole("status").filter({ hasText: "Nama kontak disimpan" })).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Nama kontak", { exact: true })).toHaveValue(NEW_CONTACT_NAME);
      await expect(page.getByText("Tahap saat ini: Invoice")).toBeVisible();

      // The owner's invoice, after a fresh load from the list.
      const ownerAfter = await ownerInvoiceFigures(page, number, brand, isMobile);
      expect(ownerAfter).toEqual(ownerBefore);
      expect(ownerAfter.details).toContain("PPh 21");
      expect(ownerAfter.details).toContain("Rp 6.000.000");

      // The brand's page, reloaded.
      const brandAfter = await recipientFigures(recipient, link);
      expect(brandAfter.number).toBe(true);
      expect(brandAfter.amount).toBe(brandBefore.amount);
      expect(brandAfter.due).toBe(brandBefore.due);
      expect(brandAfter.pph).toBe(brandBefore.pph);
      testInfo.annotations.push({
        type: "observation (CAP-INV-12, undecided)",
        description: `contact name saved after the invoice was issued ${brandAfter.showsNewContactName ? "appears" : "does not appear"} on the brand's invoice page`,
      });
    } finally {
      await recipientContext.close();
    }
  });

  // Expected failure, never counted as coverage. It documents that a saved
  // deal's core details cannot be edited (#55, CAP-DEAL-05) and is meant to
  // start passing -- which fails the run -- the day an edit ships, in the
  // card menu or on deal detail (an edit action, or the core fields made
  // editable in place): then remove test.fail, turn this into the edit
  // journey, map it in docs/testing/journey-coverage.json, and close the gap
  // in docs/product/capabilities.json. What counts as an edit, and what does
  // not, is in e2e/support/deal-edit-affordance.ts and proved by
  // e2e/deals/deal-edit-affordance.spec.ts.
  test("a saved deal can be edited from its card menu or its detail page (#55)", async ({ page, isMobile }, testInfo) => {
    test.fail(true, "#55: no edit for a saved deal's brand, scope, fee, deadline or payment terms");
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.nego;
    const brand = manifest.brands[dealId];
    await page.goto("/deal");
    const card = page.locator("article", { hasText: brand });
    await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
    await page.getByRole("menu").getByRole("menuitem").first().waitFor();
    let found = await cardMenuEditAction(page);
    if (found === null) {
      await press(page.getByRole("menuitem", { name: "Lihat detail" }), isMobile);
      await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
      await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
      found = await dealDetailEditAffordance(page);
    }
    testInfo.annotations.push({ type: "#55 edit affordance", description: found ?? "none on the card menu or deal detail" });
    expect(found, "no full edit of a saved deal on its card menu or its detail page").not.toBeNull();
  });
});
