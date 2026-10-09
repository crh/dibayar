// Real-interaction coverage for the invoice PDF
// (docs/testing/journey-coverage.json: INV-PDF-01, PUB-05, PUB-06).
//
// The earlier evidence fetched the PDF routes with the request API; no test
// clicked "Unduh PDF". Here the owner and a session-less recipient each click
// their visible link, the browser's own download event delivers the file, and
// its text is read with pdftotext (e2e/support/pdf.ts) -- the PDF's content
// stream is compressed, so a byte search would prove nothing. Files are
// written only under the test's output directory.
//
// The owner first changes the bank details in Settings, so the PDF is checked
// against values that exist nowhere in the seed: a PDF built from stale or
// default settings fails. Owner and recipient PDFs are compared by their
// normalized text, not byte-for-byte (PDF metadata differs per render).
//
// All values are synthetic. The tests change the fixture owner's
// UserSettings, so they reseed before and after.
import type { Page } from "@playwright/test";
import { expect } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";
import { downloadPdfByClick } from "../support/pdf";
import { shareTest as test, shownShareLink } from "../support/share-links";

const UPDATED_BANK = { bankName: "Bank Sintetis PDF", accountNumber: "5550012345", holder: "Pemilik Sintetis PDF" };

// What the seeded SENT invoice's document must say (scripts/e2e-fixtures.ts),
// written out here rather than derived from the app's own formatters. The
// PDF prints long Indonesian dates and "Rp" + a space + dot thousands.
function expectedDocumentLines(brand: string) {
  return [
    "Nomor invoice: E2E/SENT/001",
    `E2E Fixture Owner ${brand}`,
    "Jl. Fixture E2E No. 1, Jakarta",
    "628199999999",
    "E2E fixture: invoice already sent Rp 6.000.000",
    "Total Rp 6.000.000",
    "Pajak potong PPh 21",
    "30 hari setelah invoice diterima",
    "Jatuh tempo: 31 Desember 2099",
    `Bank: ${UPDATED_BANK.bankName}`,
    `Nomor rekening: ${UPDATED_BANK.accountNumber}`,
    `Atas nama: ${UPDATED_BANK.holder}`,
  ];
}

function expectDocumentText(text: string, brand: string) {
  const lines = text.split("\n");
  for (const expected of expectedDocumentLines(brand)) {
    expect(lines, `the PDF has the line "${expected}"`).toContain(expected);
  }
  // Nothing from the bank details that were replaced.
  expect(text).not.toContain("Bank E2E Fixture");
  expect(text).not.toContain("1234509876");
}

// Settings -> bank details -> save, through the nav and the visible fields.
async function saveBankDetails(page: Page) {
  await page.goto("/");
  await primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }).click();
  await expect(page).toHaveURL(/\/pengaturan$/);
  const bank = page.getByRole("region", { name: "Rekening pembayaran" });
  await expect(bank.getByLabel("Nama bank")).toHaveValue("Bank E2E Fixture");
  await bank.getByLabel("Nama bank").fill(UPDATED_BANK.bankName);
  await bank.getByLabel("Nomor rekening").fill(UPDATED_BANK.accountNumber);
  await bank.getByLabel("Atas nama").fill(UPDATED_BANK.holder);
  const save = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/me/settings",
  );
  await page.getByRole("button", { name: "Simpan pengaturan" }).click();
  expect((await save).ok()).toBe(true);
  await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
}

// Nav -> invoice list -> the seeded SENT invoice.
async function openSentInvoice(page: Page, brand: string, invoiceId: string) {
  await primaryNav(page).getByRole("link", { name: "Invoice", exact: true }).click();
  await expect(page).toHaveURL(/\/invoice$/);
  await page.getByRole("link", { name: new RegExp(brand) }).click();
  await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
  await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
}

test.describe("invoice PDF downloads", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("Unduh PDF on invoice detail downloads a PDF with the invoice, issuer and current bank details", async ({ page }, testInfo) => {
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoiceSent];
    await saveBankDetails(page);
    await openSentInvoice(page, brand, manifest.invoices.sent);

    const owner = await downloadPdfByClick(page, page.getByRole("link", { name: "Unduh PDF" }), testInfo, "owner.pdf");

    expect(owner.download.suggestedFilename()).toBe("E2E-SENT-001.pdf");
    expectDocumentText(owner.text, brand);
    // The click left the owner on the invoice page.
    await expect(page).toHaveURL(new RegExp(`/invoice/${manifest.invoices.sent}$`));
  });

  test("a recipient's Unduh PDF downloads the same document the owner gets", async ({ page, recipient }, testInfo) => {
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoiceSent];
    await saveBankDetails(page);
    await openSentInvoice(page, brand, manifest.invoices.sent);
    const owner = await downloadPdfByClick(page, page.getByRole("link", { name: "Unduh PDF" }), testInfo, "owner.pdf");
    // The recipient gets the link the owner's page shows, and has no session.
    const shareLink = await shownShareLink(page);

    await recipient.goto(shareLink);
    await expect(recipient.getByText(/Nomor invoice:\s*E2E\/SENT\/001/)).toBeVisible();
    await expect(recipient.locator("main")).toContainText(UPDATED_BANK.bankName);
    const received = await downloadPdfByClick(recipient, recipient.getByRole("link", { name: "Unduh PDF" }), testInfo, "recipient.pdf");

    expect(received.download.suggestedFilename()).toBe("E2E-SENT-001.pdf");
    expectDocumentText(received.text, brand);
    // Same business content, line for line. Compared as a boolean first so a
    // mismatch reports which lines differ instead of two whole documents.
    const ownerLines = owner.text.split("\n");
    const receivedLines = received.text.split("\n");
    const onlyInOwner = ownerLines.filter((line) => !receivedLines.includes(line));
    const onlyInRecipient = receivedLines.filter((line) => !ownerLines.includes(line));
    expect({ onlyInOwner, onlyInRecipient }).toEqual({ onlyInOwner: [], onlyInRecipient: [] });
    expect(received.text === owner.text, "owner and recipient PDFs have the same text in the same order").toBe(true);
    // The recipient is still on the public page, with no owner controls.
    await expect(recipient).toHaveURL(/\/i\/[^/]+$/);
    await expect(recipient.getByRole("button", { name: "Menu akun" })).toHaveCount(0);
  });
});
