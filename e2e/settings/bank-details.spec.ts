// Real-interaction coverage for editing payment (bank) details
// (docs/testing/journey-coverage.json: SET-03).
//
// The owner's own invoice page does not render bank details; the recipient
// document does (/i/<token>, src/components/documents/invoice-document). So
// the journey edits the three bank fields in Settings, proves they survived
// a reload and a round trip through the nav, takes the share link from the
// owner's invoice page, and opens it the way a recipient does: in a
// separate browser context with no session. The PDF carries the same model
// (buildInvoiceDocumentModel) but its compressed text is not checked here;
// a PDF download journey is Batch 2 (INV-PDF-01 / PUB-05).
//
// All values are synthetic. Both tests change the fixture owner's
// UserSettings, so they reseed before and after.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";

const SEEDED = { bankName: "Bank E2E Fixture", accountNumber: "1234509876", holder: "E2E Fixture Owner" };
const UPDATED = { bankName: "Bank Sintetis Uji", accountNumber: "9876500001", holder: "Pemilik Uji Sintetis" };

test.describe("payment details in settings", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("edited bank details persist after reload and appear on the recipient's invoice page", async ({ page, browser, baseURL }) => {
    const manifest = loadFixtureManifest();
    const invoiceBrand = manifest.brands[manifest.deals.invoiceSent];

    await page.goto("/");
    await primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
    const bank = page.getByRole("region", { name: "Rekening pembayaran" });
    await expect(bank.getByLabel("Nama bank")).toHaveValue(SEEDED.bankName);

    await bank.getByLabel("Nama bank").fill(UPDATED.bankName);
    await bank.getByLabel("Nomor rekening").fill(UPDATED.accountNumber);
    await bank.getByLabel("Atas nama").fill(UPDATED.holder);
    const save = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/me/settings",
    );
    await page.getByRole("button", { name: "Simpan pengaturan" }).click();
    expect((await save).ok()).toBe(true);
    await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();

    await page.reload();
    await expect(bank.getByLabel("Nama bank")).toHaveValue(UPDATED.bankName);
    await expect(bank.getByLabel("Nomor rekening")).toHaveValue(UPDATED.accountNumber);
    await expect(bank.getByLabel("Atas nama")).toHaveValue(UPDATED.holder);

    // Away and back through the nav: still the saved values.
    await primaryNav(page).getByRole("link", { name: "Invoice", exact: true }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await page.getByRole("link", { name: new RegExp(invoiceBrand) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${manifest.invoices.sent}$`));
    // The full link is the share field's title (the visible text is
    // middle-truncated, see share-link-field.tsx).
    const shareLink = await page.getByTestId("share-link-track").locator("span[title]").getAttribute("title");
    expect(shareLink).toMatch(/\/i\/[^/]+$/);

    const recipient = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const recipientPage = await recipient.newPage();
      await recipientPage.goto(shareLink!);
      const paymentBlock = recipientPage.locator("div", { has: recipientPage.getByRole("heading", { name: "Pembayaran ke" }) }).last();
      await expect(paymentBlock).toContainText(`Bank: ${UPDATED.bankName}`);
      await expect(paymentBlock).toContainText(`Nomor rekening: ${UPDATED.accountNumber}`);
      await expect(paymentBlock).toContainText(`Atas nama: ${UPDATED.holder}`);
      await expect(paymentBlock).not.toContainText(SEEDED.bankName);
      await expect(paymentBlock.getByRole("alert")).toHaveCount(0);
    } finally {
      await recipient.close();
    }
  });

  test("clearing a required bank field shows a field error and saves nothing", async ({ page }) => {
    await page.goto("/pengaturan");
    const bank = page.getByRole("region", { name: "Rekening pembayaran" });
    await bank.getByLabel("Nomor rekening").fill("");
    await bank.getByLabel("Nama bank").fill(UPDATED.bankName);

    let patched = false;
    page.on("request", (request) => {
      if (request.method() === "PATCH" && new URL(request.url()).pathname === "/api/me/settings") patched = true;
    });
    await page.getByRole("button", { name: "Simpan pengaturan" }).click();
    await expect(bank.getByRole("alert")).toHaveText("Wajib diisi.");
    await expect(bank.getByLabel("Nomor rekening")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Tersimpan", { exact: true })).toHaveCount(0);
    expect(patched).toBe(false);

    await page.reload();
    await expect(bank.getByLabel("Nama bank")).toHaveValue(SEEDED.bankName);
    await expect(bank.getByLabel("Nomor rekening")).toHaveValue(SEEDED.accountNumber);
  });
});
