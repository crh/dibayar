// Real-interaction coverage for the "complete your settings" notice
// (docs/testing/journey-coverage.json: SET-07).
//
// An owner who has never saved Pengaturan has no issuer name and no bank
// account, so an invoice they share tells the brand nothing about where to
// pay. The app says so in three places, and this journey follows all three
// and then makes them go away the way a person would:
//
//   invoice detail (owner)  "Lengkapi identitas penerbit dan rekening di
//                            Pengaturan agar invoice lengkap."
//   Pengaturan              "Lengkapi identitas dan rekening agar invoice
//                            bisa dibagikan."
//   the brand's page        "Detail rekening belum lengkap."
//
// The form cannot produce the starting state (it refuses to save an empty
// required field), so it comes from the guarded fixture action
// `incomplete-issuer-settings`, which removes the fixture owner's
// UserSettings row: exactly what a new account has. Everything after that is
// done through the UI. The next seed restores the row; the spec reseeds
// before and after.
import type { Page } from "@playwright/test";
import { expect } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { applyIncompleteIssuerSettings, reseedFixtures } from "../support/reseed";
import { shareTest as test, shownShareLink } from "../support/share-links";
import { escapeRegExp, press, responseTo } from "../support/journey";

const INVOICE_NOTICE = "Lengkapi identitas penerbit dan rekening di Pengaturan agar invoice lengkap.";
const SETTINGS_NOTICE = "Lengkapi identitas dan rekening agar invoice bisa dibagikan.";
const RECIPIENT_NOTICE = "Detail rekening belum lengkap.";
const COMPLETED = { issuerName: "Studio Baru Sintetis", bankName: "Bank Baru Uji", bankAccountNumber: "4440009876", bankAccountHolder: "Pemilik Studio Baru" };

async function openSentInvoice(page: Page, isMobile: boolean) {
  const { invoices, brands, deals } = loadFixtureManifest();
  await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
  await expect(page).toHaveURL(/\/invoice$/);
  await press(page.getByRole("link", { name: new RegExp(escapeRegExp(brands[deals.invoiceSent])) }), isMobile);
  await expect(page).toHaveURL(new RegExp(`/invoice/${invoices.sent}$`));
  await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
}

test.describe("incomplete issuer settings", { tag: "@critical" }, () => {
  test.beforeEach(applyIncompleteIssuerSettings);
  test.afterEach(reseedFixtures);

  test("missing issuer and bank details warn on invoice detail, in Pengaturan and on the brand's page, until they are saved", async ({ page, recipient, isMobile }) => {
    await page.goto("/");
    await openSentInvoice(page, isMobile);

    // Invoice detail: the notice, inside the details section, as a status.
    const details = page.getByRole("region", { name: "Rincian invoice" });
    await expect(details.getByRole("status").filter({ hasText: INVOICE_NOTICE })).toBeVisible();
    // The invoice itself still works: it has its number, amount and link.
    await expect(page.getByRole("main").locator("header").first().getByText("E2E/SENT/001", { exact: true })).toBeVisible();
    const shareLink = await shownShareLink(page);
    await page.reload();
    await expect(details.getByRole("status").filter({ hasText: INVOICE_NOTICE })).toBeVisible();

    // What the brand gets in this state: dashes and a plain warning.
    await recipient.goto(shareLink);
    const payment = recipient.locator("div", { has: recipient.getByRole("heading", { name: "Pembayaran ke" }) }).last();
    await expect(payment.getByRole("alert")).toHaveText(RECIPIENT_NOTICE);
    await expect(payment).toContainText("Bank: —");
    await expect(payment).not.toContainText("Bank E2E Fixture");

    // Pengaturan says the same, and its fields are empty.
    await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
    await expect(page).toHaveURL(/\/pengaturan$/);
    const settingsNotice = page.getByRole("status").filter({ hasText: SETTINGS_NOTICE });
    await expect(settingsNotice).toBeVisible();
    const issuerName = page.getByLabel("Nama / nama usaha");
    const bank = page.getByRole("region", { name: "Rekening pembayaran" });
    await expect(issuerName).toHaveValue("");
    await expect(bank.getByLabel("Nama bank")).toHaveValue("");

    // Half the answer is not enough: the form names what is missing, saves
    // nothing, and the notice stays.
    await issuerName.fill(COMPLETED.issuerName);
    let patched = false;
    page.on("request", (request) => {
      if (request.method() === "PATCH" && new URL(request.url()).pathname === "/api/me/settings") patched = true;
    });
    await press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile);
    await expect(bank.getByRole("alert")).toHaveCount(3);
    await expect(bank.getByRole("alert").first()).toHaveText("Wajib diisi.");
    expect(patched, "an incomplete form is not sent").toBe(false);
    await expect(settingsNotice).toBeVisible();

    // Complete it and save: the notice goes, and stays gone after a reload.
    await bank.getByLabel("Nama bank").fill(COMPLETED.bankName);
    await bank.getByLabel("Nomor rekening").fill(COMPLETED.bankAccountNumber);
    await bank.getByLabel("Atas nama").fill(COMPLETED.bankAccountHolder);
    const saved = await responseTo(page, "PATCH", "/api/me/settings", () => press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile));
    expect(saved.ok()).toBe(true);
    await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
    await expect(settingsNotice).toHaveCount(0);
    await expect(bank.getByRole("alert")).toHaveCount(0);
    await page.reload();
    await expect(settingsNotice).toHaveCount(0);
    await expect(issuerName).toHaveValue(COMPLETED.issuerName);

    // Back on the invoice the notice is gone too, also after a reload.
    await openSentInvoice(page, isMobile);
    await expect(page.getByText(INVOICE_NOTICE)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
    await expect(page.getByText(INVOICE_NOTICE)).toHaveCount(0);

    // And the brand now sees where to pay.
    await recipient.reload();
    await expect(payment).toContainText(`Bank: ${COMPLETED.bankName}`);
    await expect(payment).toContainText(`Nomor rekening: ${COMPLETED.bankAccountNumber}`);
    await expect(payment).toContainText(`Atas nama: ${COMPLETED.bankAccountHolder}`);
    await expect(payment.getByRole("alert")).toHaveCount(0);
    await expect(recipient.getByText(COMPLETED.issuerName, { exact: true }).first()).toBeVisible();
  });
});
