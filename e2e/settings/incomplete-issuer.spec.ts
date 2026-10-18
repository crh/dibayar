// Real-interaction coverage for the "complete your settings" notice
// (docs/testing/journey-coverage.json: SET-07).
//
// An owner who has never saved Pengaturan has no issuer name and no bank
// account, so an invoice they share tells the brand nothing about where to
// pay. The app says so in three places:
//
//   invoice detail (owner)  "Lengkapi identitas penerbit dan rekening di
//                            Pengaturan agar invoice lengkap."
//   Pengaturan              "Lengkapi identitas dan rekening agar invoice
//                            bisa dibagikan."
//   the brand's page        "Detail rekening belum lengkap."
//
// Decision A (issue #55, CAP-INV-12): an invoice's document is frozen at its
// first share link or its move out of Draf. So saving Pengaturan completes a
// Draft that was not shared yet -- the first test makes the notices go away
// the way a person would, then shares -- but not an invoice already shared
// with the gaps: the second test shows that one keeps them, with its own
// notice saying Pengaturan no longer changes it.
//
// The form cannot produce the starting state (it refuses to save an empty
// required field), so it comes from the guarded fixture action
// `incomplete-issuer-settings`, which removes the fixture owner's
// UserSettings row: exactly what a new account has. The seeded sent invoice
// was frozen at seed time with complete details, so it never shows a notice
// here. The invoice in each test is made from the seeded pending deal
// through Buat invoice. The spec reseeds before and after each test.
import type { Page } from "@playwright/test";
import { expect } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { applyIncompleteIssuerSettings, reseedFixtures } from "../support/reseed";
import { shareTest as test, shownShareLink } from "../support/share-links";
import { escapeRegExp, press, responseTo } from "../support/journey";

const INVOICE_NOTICE = "Lengkapi identitas penerbit dan rekening di Pengaturan agar invoice lengkap.";
const FROZEN_NOTICE = "Invoice ini sudah dikirim atau dibagikan dengan identitas penerbit atau rekening yang belum lengkap. Perubahan di Pengaturan tidak mengubah invoice ini.";
const SETTINGS_NOTICE = "Lengkapi identitas dan rekening agar invoice bisa dibagikan.";
const RECIPIENT_NOTICE = "Detail rekening belum lengkap.";
const COMPLETED = { issuerName: "Studio Baru Sintetis", bankName: "Bank Baru Uji", bankAccountNumber: "4440009876", bankAccountHolder: "Pemilik Studio Baru" };

// Buat invoice on the pending deal's detail page, then open the new Draft.
async function createDraftInvoice(page: Page, isMobile: boolean): Promise<string> {
  const { deals } = loadFixtureManifest();
  await page.goto(`/deal/${deals.invoicePending}`);
  const created = await responseTo(page, "POST", "/api/invoices", () => press(page.getByRole("button", { name: "Buat invoice" }), isMobile));
  expect(created.ok()).toBe(true);
  await press(page.getByRole("link", { name: /^Lihat invoice / }), isMobile);
  await expect(page).toHaveURL(/\/invoice\/[^/]+$/);
  await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function openInvoiceFromList(page: Page, brand: string, invoiceId: string, isMobile: boolean) {
  await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
  await expect(page).toHaveURL(/\/invoice$/);
  await press(page.getByRole("link", { name: new RegExp(escapeRegExp(brand)) }), isMobile);
  await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
  await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
}

function noticeIn(page: Page, text: string) {
  return page.getByRole("region", { name: "Rincian invoice" }).getByRole("status").filter({ hasText: text });
}

// Pengaturan: the notice, a refused half-save, then a complete save that
// clears the notice and survives a reload.
async function completeSettings(page: Page, isMobile: boolean) {
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
}

test.describe("incomplete issuer settings", { tag: "@critical" }, () => {
  test.beforeEach(applyIncompleteIssuerSettings);
  test.afterEach(reseedFixtures);

  test("missing issuer and bank details warn on a Draft and in Pengaturan until they are saved; the Draft shared afterwards gives the brand the saved details", async ({ page, recipient, isMobile }) => {
    test.setTimeout(90_000);
    const { brands, deals, invoices } = loadFixtureManifest();
    const brand = brands[deals.invoicePending];

    // The invoice already sent before the settings were removed keeps the
    // complete details it was issued with: no notice.
    await page.goto(`/invoice/${invoices.sent}`);
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
    await expect(page.getByText(INVOICE_NOTICE)).toHaveCount(0);
    await expect(page.getByText(FROZEN_NOTICE)).toHaveCount(0);

    const invoiceId = await createDraftInvoice(page, isMobile);
    await expect(noticeIn(page, INVOICE_NOTICE)).toBeVisible();
    await page.reload();
    await expect(noticeIn(page, INVOICE_NOTICE)).toBeVisible();

    await completeSettings(page, isMobile);

    // Back on the Draft the notice is gone too, also after a reload.
    await openInvoiceFromList(page, brand, invoiceId, isMobile);
    await expect(page.getByText(INVOICE_NOTICE)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
    await expect(page.getByText(INVOICE_NOTICE)).toHaveCount(0);

    // Shared now, the brand sees where to pay.
    await press(page.getByRole("button", { name: "Buat tautan berbagi" }), isMobile);
    const link = await shownShareLink(page);
    await recipient.goto(link);
    const payment = recipient.locator("div", { has: recipient.getByRole("heading", { name: "Pembayaran ke" }) }).last();
    await expect(payment).toContainText(`Bank: ${COMPLETED.bankName}`);
    await expect(payment).toContainText(`Nomor rekening: ${COMPLETED.bankAccountNumber}`);
    await expect(payment).toContainText(`Atas nama: ${COMPLETED.bankAccountHolder}`);
    await expect(payment.getByRole("alert")).toHaveCount(0);
    await expect(recipient.getByText(COMPLETED.issuerName, { exact: true }).first()).toBeVisible();
  });

  test("an invoice shared while the details were missing keeps the gaps after Pengaturan is completed, and says so", async ({ page, recipient, isMobile }) => {
    test.setTimeout(90_000);
    const { brands, deals } = loadFixtureManifest();
    const brand = brands[deals.invoicePending];

    const invoiceId = await createDraftInvoice(page, isMobile);
    await expect(noticeIn(page, INVOICE_NOTICE)).toBeVisible();
    // The invoice itself still works: it has its number, amount and link.
    await press(page.getByRole("button", { name: "Buat tautan berbagi" }), isMobile);
    const link = await shownShareLink(page);
    await page.reload();
    await expect(noticeIn(page, FROZEN_NOTICE)).toBeVisible();
    await expect(page.getByText(INVOICE_NOTICE)).toHaveCount(0);

    // What the brand gets in this state: dashes and a plain warning.
    await recipient.goto(link);
    const payment = recipient.locator("div", { has: recipient.getByRole("heading", { name: "Pembayaran ke" }) }).last();
    await expect(payment.getByRole("alert")).toHaveText(RECIPIENT_NOTICE);
    await expect(payment).toContainText("Bank: —");

    await completeSettings(page, isMobile);

    // The shared invoice does not change: the owner's notice says why, and
    // the brand still sees the document as it was shared.
    await openInvoiceFromList(page, brand, invoiceId, isMobile);
    await expect(noticeIn(page, FROZEN_NOTICE)).toBeVisible();
    await recipient.reload();
    await expect(payment.getByRole("alert")).toHaveText(RECIPIENT_NOTICE);
    await expect(payment).toContainText("Bank: —");
    await expect(payment).not.toContainText(COMPLETED.bankName);
  });
});
