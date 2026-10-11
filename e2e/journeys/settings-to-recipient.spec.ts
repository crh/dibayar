// Long journey B2: what the owner saves in Pengaturan is what the brand reads.
//
// The owner rewrites their issuer identity, their bank account and the
// "send invoice" WhatsApp template in one sitting, and the journey follows
// those values everywhere they surface: Pengaturan after a reload, the
// WhatsApp message sent from an invoice, the owner's PDF, the brand's public
// page and the brand's PDF. The short specs each follow one field group
// (bank details: settings/bank-details.spec.ts and invoices/pdf-download.spec.ts;
// templates: settings/whatsapp-templates.spec.ts); none follows the issuer's
// address, WhatsApp number and email, and none proves that one save reaches
// every surface at once.
//
// Checkpoints, in order (each is a test.step):
//   1. Beranda -> Pengaturan through the navigation; the seeded values show
//   2. every field group is rewritten and saved; all of it survives a reload,
//      and the reminder template, which was not touched, is still the default
//   3. Invoice list -> the seeded sent invoice: no "complete your settings"
//      notice, and Kirim lewat WhatsApp sends the rewritten template
//   4. the owner's PDF carries the new issuer and bank details
//   5. the brand, with no session: the public page and its PDF carry the
//      same, and nothing of the old values
//   6. back in Pengaturan through the navigation, the values are still there
//
// Preconditions come from the base seed only (scripts/e2e-fixtures.ts): the
// fixture owner's complete settings and their sent invoice E2E/SENT/001 with
// an active share link. Every changed value is typed and saved through the
// UI. The owner's own invoice page does not print issuer or bank details
// (the document does), so "what the owner sees" is the owner's PDF.
//
// All values are synthetic. WhatsApp never leaves the machine
// (keepWhatsAppLocal()). The journey changes the fixture owner's
// UserSettings, which every other spec reads, so it reseeds before and
// after, also when it fails.
import type { Page } from "@playwright/test";
import { expect } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";
import { keepWhatsAppLocal, parseWhatsAppLink, trackOpenedPages } from "../support/follow-up";
import { downloadPdfByClick } from "../support/pdf";
import { shareTest as test, shownShareLink, trackShareMutations } from "../support/share-links";
import { escapeRegExp, expectNoOwnerControls, press, responseTo, rupiah } from "../support/journey";

const SEEDED = {
  issuerName: "E2E Fixture Owner",
  issuerAddress: "Jl. Fixture E2E No. 1, Jakarta",
  issuerWhatsapp: "628199999999",
  bankName: "Bank E2E Fixture",
  bankAccountNumber: "1234509876",
};
const UPDATED = {
  issuerName: "Studio Sintetis Perjalanan",
  issuerAddress: "Jl. Uji Perjalanan No. 7, Bandung",
  issuerWhatsapp: "628122200033",
  issuerEmail: "studio.perjalanan@example.invalid",
  bankName: "Bank Perjalanan Uji",
  bankAccountNumber: "7770001234",
  bankAccountHolder: "Pemilik Studio Sintetis",
};
// Every token once, in an order the default never uses.
const SEND_TEMPLATE = "JALAN-KIRIM {brand} | {nomor_invoice} | {jumlah} | tempo {jatuh_tempo} | {tautan}";
const INVOICE_NUMBER = "E2E/SENT/001";

function settingsFields(page: Page) {
  const issuer = page.getByRole("region", { name: "Identitas penerbit" });
  const bank = page.getByRole("region", { name: "Rekening pembayaran" });
  const templates = page.getByRole("region", { name: /Template WhatsApp/ });
  return {
    issuerName: issuer.getByLabel("Nama / nama usaha"),
    issuerAddress: issuer.getByLabel("Alamat"),
    issuerWhatsapp: issuer.getByLabel("Nomor WhatsApp"),
    issuerEmail: issuer.getByLabel("Email"),
    bankName: bank.getByLabel("Nama bank"),
    bankAccountNumber: bank.getByLabel("Nomor rekening"),
    bankAccountHolder: bank.getByLabel("Atas nama"),
    templateSend: templates.getByLabel("Pesan kirim invoice"),
    templateChase: templates.getByLabel("Pesan pengingat"),
  };
}

async function expectUpdatedSettings(page: Page) {
  const fields = settingsFields(page);
  for (const key of Object.keys(UPDATED) as Array<keyof typeof UPDATED>) {
    await expect(fields[key], `${key} holds the saved value`).toHaveValue(UPDATED[key]);
  }
  await expect(fields.templateSend).toHaveValue(SEND_TEMPLATE);
  await expect(fields.templateChase).toHaveValue(/^Halo \{brand\}, izin mengingatkan/);
}

// The lines the document must print for the new issuer and bank details, and
// the old values it must no longer print anywhere.
function expectDocumentText(text: string, brand: string) {
  const lines = text.split("\n");
  for (const expected of [
    `Nomor invoice: ${INVOICE_NUMBER}`,
    `${UPDATED.issuerName} ${brand}`,
    UPDATED.issuerAddress,
    UPDATED.issuerWhatsapp,
    UPDATED.issuerEmail,
    "Total Rp 6.000.000",
    `Bank: ${UPDATED.bankName}`,
    `Nomor rekening: ${UPDATED.bankAccountNumber}`,
    `Atas nama: ${UPDATED.bankAccountHolder}`,
  ]) {
    expect(lines, `the PDF has the line "${expected}"`).toContain(expected);
  }
  for (const old of Object.values(SEEDED)) expect(text, `the PDF no longer has "${old}"`).not.toContain(old);
}

test.describe("journey: settings reach the recipient", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("issuer, bank and template changes saved in Pengaturan reach the WhatsApp message, both PDFs and the brand's page", async ({ page, context, recipient, isMobile }, testInfo) => {
    test.setTimeout(120_000);
    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    const brand = manifest.brands[manifest.deals.invoiceSent];
    const whatsAppRequests = await keepWhatsAppLocal(context);

    await test.step("Beranda -> Pengaturan shows the seeded settings", async () => {
      await page.goto("/");
      await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/pengaturan$/);
      const fields = settingsFields(page);
      await expect(fields.issuerName).toHaveValue(SEEDED.issuerName);
      await expect(fields.issuerAddress).toHaveValue(SEEDED.issuerAddress);
      await expect(fields.bankName).toHaveValue(SEEDED.bankName);
      await expect(fields.templateSend).toHaveValue(/^Halo \{brand\}, berikut invoice/);
      await expect(page.getByText("Lengkapi identitas dan rekening agar invoice bisa dibagikan.")).toHaveCount(0);
    });

    await test.step("the rewritten issuer, bank and send template are saved and survive a reload", async () => {
      const fields = settingsFields(page);
      for (const key of Object.keys(UPDATED) as Array<keyof typeof UPDATED>) await fields[key].fill(UPDATED[key]);
      await fields.templateSend.fill(SEND_TEMPLATE);
      const saved = await responseTo(page, "PATCH", "/api/me/settings", () => press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile));
      expect(saved.ok()).toBe(true);
      await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
      await expect(page.locator('p[role="alert"]')).toHaveCount(0);

      await page.reload();
      await expectUpdatedSettings(page);
    });

    let shareLink = "";
    await test.step("the sent invoice has no settings notice and its WhatsApp message uses the rewritten template", async () => {
      await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/invoice$/);
      await press(page.getByRole("link", { name: new RegExp(escapeRegExp(brand)) }), isMobile);
      await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
      await expect(page.getByText("Lengkapi identitas penerbit dan rekening di Pengaturan agar invoice lengkap.")).toHaveCount(0);

      const send = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
      await expect(send).toBeEnabled();
      shareLink = await shownShareLink(page);
      const mutations = trackShareMutations(page, invoiceId);
      const opened = trackOpenedPages(context);
      const [popup] = await Promise.all([page.waitForEvent("popup"), press(send, isMobile)]);
      await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
      const message = parseWhatsAppLink(popup.url());
      await popup.close();
      await expect(send).toBeEnabled();

      // The deal's contact, not the issuer's own number from Pengaturan.
      expect(message.number).toBe("628110000006");
      const prefix = `JALAN-KIRIM ${brand} | ${INVOICE_NUMBER} | ${rupiah(6_000_000)} | tempo 31 Des 2099 | `;
      expect(message.text?.startsWith(prefix), "the message is built from the saved template, token by token").toBe(true);
      expect(message.text?.slice(prefix.length) === shareLink, "the template's {tautan} is the link the page shows").toBe(true);
      expect(message.text).not.toContain("Halo ");
      expect(opened).toHaveLength(1);
      expect(whatsAppRequests).toHaveLength(1);
      // Sending reused the existing link.
      expect(mutations).toEqual(["POST /share/ensure"]);
      expect((await shownShareLink(page)) === shareLink, "the shown link is unchanged after sending").toBe(true);
    });

    let ownerPdfText = "";
    await test.step("the owner's PDF carries the new issuer and bank details", async () => {
      const owner = await downloadPdfByClick(page, page.getByRole("link", { name: "Unduh PDF" }), testInfo, "owner.pdf");
      expect(owner.download.suggestedFilename()).toBe("E2E-SENT-001.pdf");
      expectDocumentText(owner.text, brand);
      ownerPdfText = owner.text;
      await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
    });

    await test.step("the brand, with no session, reads the same details on the page and in its PDF", async () => {
      const response = await recipient.goto(shareLink);
      expect(response?.status()).toBe(200);
      const invoiceDoc = recipient.getByRole("main");
      await expect(invoiceDoc.getByText(new RegExp(`Nomor invoice:\\s*${escapeRegExp(INVOICE_NUMBER)}`))).toBeVisible();
      const from = recipient.locator("div", { has: recipient.getByRole("heading", { name: "Dari" }) }).last();
      await expect(from).toContainText(UPDATED.issuerName);
      await expect(from).toContainText(UPDATED.issuerAddress);
      await expect(from).toContainText(UPDATED.issuerWhatsapp);
      await expect(from).toContainText(UPDATED.issuerEmail);
      const payment = recipient.locator("div", { has: recipient.getByRole("heading", { name: "Pembayaran ke" }) }).last();
      await expect(payment).toContainText(`Bank: ${UPDATED.bankName}`);
      await expect(payment).toContainText(`Nomor rekening: ${UPDATED.bankAccountNumber}`);
      await expect(payment).toContainText(`Atas nama: ${UPDATED.bankAccountHolder}`);
      for (const old of Object.values(SEEDED)) await expect(invoiceDoc.getByText(old), `"${old}" is gone from the page`).toHaveCount(0);
      await expect(recipient.locator('p[role="alert"]')).toHaveCount(0);
      // The template is the owner's message, not part of the document.
      await expect(invoiceDoc.getByText("JALAN-KIRIM")).toHaveCount(0);
      await expectNoOwnerControls(recipient);
      expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      const received = await downloadPdfByClick(recipient, recipient.getByRole("link", { name: "Unduh PDF" }), testInfo, "recipient.pdf");
      expectDocumentText(received.text, brand);
      expect(received.text === ownerPdfText, "owner and recipient PDFs have the same text").toBe(true);

      // A reload of the brand's page reads the settings again, not a copy.
      await recipient.reload();
      await expect(from).toContainText(UPDATED.issuerName);
      await expect(payment).toContainText(`Bank: ${UPDATED.bankName}`);
    });

    await test.step("back in Pengaturan through the navigation, the saved values are still there", async () => {
      await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
      await expect(page).toHaveURL(/\/pengaturan$/);
      await expectUpdatedSettings(page);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
      await page.goForward();
      await expect(page).toHaveURL(/\/pengaturan$/);
      await expectUpdatedSettings(page);
    });
  });
});
