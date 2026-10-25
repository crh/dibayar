// A change to a deal never rewrites the invoice already issued for it
// (docs/product/capabilities.json: CAP-INV-11; issue #55, "Invoice
// integrity").
//
// An invoice copies the deal's fee into its own amount and may take the
// deal's deadline as its due date when it is created (src/lib/invoices.ts).
// After that, number, amount, PPh and due date belong to the invoice: the
// owner and the brand must keep seeing the figures that were sent, whatever
// happens to the deal. The journey changes the contact name on deal detail,
// then the brand, scope, fee and payment terms through Ubah deal (#55), and
// checks the owner's and the brand's view of the invoice after each.
//
// Decision A (issue #55, approved 2026-10-18; CAP-INV-12): the brand, scope,
// payment terms and contact name on the document are frozen with the issuer
// and bank details when the invoice is first shared or sent
// (src/lib/invoice-snapshot.ts), so a contact name saved afterwards does not
// reach the brand's page either. e2e/invoices/document-snapshot.spec.ts
// follows the other fields and the owner's and brand's PDFs.
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

const EDITED = { brand: "E2E Brand Terkirim Diubah", scope: "Scope yang diubah setelah invoice", fee: "9100000", paymentTerms: "Termin yang diubah setelah invoice" };

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
    showsAnyEditedValue: Object.values(EDITED).some((value) => text.includes(value)) || text.includes("9.100.000"),
  };
}

test.describe("a deal change leaves its issued invoice alone (CAP-INV-11)", () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("after the contact name, brand, scope, fee and payment terms of an invoiced deal are changed, the invoice keeps its number, amount, PPh, due date and document for the owner and the brand", { tag: "@critical" }, async ({ page, browser, baseURL, isMobile }) => {
    test.setTimeout(90_000);
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

      // Ubah deal (#55) on the same page: brand, scope, fee, payment terms.
      await press(page.getByRole("button", { name: "Ubah deal" }), isMobile);
      const dialog = page.getByRole("dialog", { name: "Ubah deal" });
      await expect(dialog.getByRole("note")).toContainText(`Deal ini sudah punya invoice ${number}`);
      await dialog.getByLabel("Nama brand").fill(EDITED.brand);
      await dialog.getByLabel("Scope pekerjaan").fill(EDITED.scope);
      await dialog.getByLabel(/^Fee \(Rp\)/).fill(EDITED.fee);
      await dialog.getByLabel("Syarat pembayaran (opsional)").fill(EDITED.paymentTerms);
      const edited = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(dialog.getByRole("button", { name: "Simpan perubahan" }), isMobile));
      expect(edited.ok()).toBe(true);
      await expect(page.getByRole("status").filter({ hasText: "Perubahan deal disimpan." })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: EDITED.brand })).toBeVisible();
      await expect(page.getByText("Tahap saat ini: Invoice")).toBeVisible();

      // The owner's invoice, after a fresh load from the list (which names
      // the deal, so by its new brand).
      const ownerAfter = await ownerInvoiceFigures(page, number, EDITED.brand, isMobile);
      expect(ownerAfter).toEqual(ownerBefore);
      expect(ownerAfter.details).toContain("PPh 21");
      expect(ownerAfter.details).toContain("Rp 6.000.000");

      // The brand's page, reloaded.
      const brandAfter = await recipientFigures(recipient, link);
      expect(brandAfter.number).toBe(true);
      expect(brandAfter.amount).toBe(brandBefore.amount);
      expect(brandAfter.due).toBe(brandBefore.due);
      expect(brandAfter.pph).toBe(brandBefore.pph);
      // Decision A: the issued document keeps the contact it was issued with.
      expect(brandAfter.showsNewContactName, "a contact name saved after issue is not on the brand's page").toBe(false);
      expect(brandAfter.showsAnyEditedValue, "no deal edit made after issue is on the brand's page").toBe(false);
    } finally {
      await recipientContext.close();
    }
  });

  // Formerly the #55 expected-failure tripwire. The edit now exists, so the
  // same detector (e2e/support/deal-edit-affordance.ts, with its controls in
  // e2e/deals/deal-edit-affordance.spec.ts) must find it in both places; the
  // edit itself is driven in e2e/deals/deal-edit.spec.ts.
  test("a saved deal can be edited from its card menu and from its detail page (#55)", { tag: "@critical" }, async ({ page, isMobile }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.nego;
    const brand = manifest.brands[dealId];
    await page.goto("/deal");
    const card = page.locator("article", { hasText: brand });
    await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
    await page.getByRole("menu").getByRole("menuitem").first().waitFor();
    expect(await cardMenuEditAction(page), "the card menu offers the edit").toBe('card menu item "Ubah deal"');
    await press(page.getByRole("menuitem", { name: "Lihat detail" }), isMobile);
    await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
    await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
    expect(await dealDetailEditAffordance(page), "deal detail offers the edit").toBe('deal detail action "Ubah deal"');
  });
});
