// The recipient sees the due date even when the deal has no payment terms
// (FIND-08; docs/testing/journey-coverage.json: PUB-01, PUB-05, INV-DUE-05).
//
// The invoice document used to print "Jatuh tempo" only inside the
// payment-terms block, so an invoice whose deal had no payment terms showed
// the recipient no due date at all, on the page and in the PDF. Here the
// owner opens such an invoice from the list, creates its share link with the
// visible button, and a session-less recipient opens that link, reloads it
// and downloads the PDF with the visible Unduh PDF link. The due date must be
// there each time, and no payment-terms heading or text may be made up to
// carry it. The owner's PDF must read the same as the recipient's.
//
// Runs on the follow-up overlay: its deals have no payment terms, and the
// invoice used is due seven Jakarta days from today. The expected date is
// written from a fixed month table (e2e/support/follow-up.ts), not from the
// app's formatter. Like the other due-date journeys it runs in an
// Asia/Jakarta and a Pacific/Honolulu browser: a due date is a calendar date,
// so both must print the same day.
import { expect } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { addCalendarDays, expectSameJakartaDay, jakartaToday, longIdDate, shortIdDate } from "../support/follow-up";
import { downloadPdfByClick } from "../support/pdf";
import { shareTest as test, shownShareLink } from "../support/share-links";

const INVOICE_NUMBER = "E2E/DUE/006";
const PDF_FILENAME = "E2E-DUE-006.pdf";

for (const timezoneId of ["Asia/Jakarta", "Pacific/Honolulu"]) {
  test.describe(`recipient due date without payment terms (browser in ${timezoneId})`, { tag: "@critical" }, () => {
    test.use({ timezoneId });
    test.afterEach(reseedFixtures);

    test(`a recipient sees the due date on the page and in the PDF when the deal has no payment terms (${timezoneId})`, async ({ page, recipient }, testInfo) => {
      const overlayDay = jakartaToday();
      applyFollowUpStates();
      const { followUp } = loadFixtureManifest();
      const invoiceId = followUp.invoices.dueWindowEdge;
      const brand = followUp.brands[followUp.deals.dueWindowEdge];
      const due = addCalendarDays(overlayDay, followUp.dueOffsetDays.dueWindowEdge);
      const dueLine = `Jatuh tempo: ${longIdDate(due)}`;

      // Owner: nav -> invoice list -> the invoice. It has a due date and no
      // share link yet.
      await page.goto("/");
      await primaryNav(page).getByRole("link", { name: "Invoice", exact: true }).click();
      await expect(page).toHaveURL(/\/invoice$/);
      await page.getByRole("link", { name: new RegExp(brand) }).click();
      await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
      await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
      await expect(page.getByText(`Jatuh tempo: ${shortIdDate(due)}`)).toBeVisible();
      await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
      await page.getByRole("button", { name: "Buat tautan berbagi" }).click();
      const shareLink = await shownShareLink(page);

      const owner = await downloadPdfByClick(page, page.getByRole("link", { name: "Unduh PDF" }), testInfo, "owner.pdf");
      expect(owner.download.suggestedFilename()).toBe(PDF_FILENAME);

      // Recipient: no session, own context.
      async function expectRecipientDocument() {
        const document = recipient.locator("main article");
        await expect(document.getByText(new RegExp(`Nomor invoice:\\s*${INVOICE_NUMBER}`))).toBeVisible();
        await expect(document.getByText(brand, { exact: true })).toBeVisible();
        const line = document.locator("p", { hasText: "Jatuh tempo:" });
        await expect(line).toHaveCount(1);
        await expect(line).toBeVisible();
        await expect(line).toHaveText(dueLine);
        // No payment terms were made up to carry it: no heading, and the due
        // date's block holds that one line only.
        await expect(document.getByText("Syarat pembayaran")).toHaveCount(0);
        await expect(line.locator("xpath=../*")).toHaveCount(1);
        expect(await document.locator("p, h2").evaluateAll((elements) => elements.filter((element) => !element.textContent?.trim()).length), "no empty line in the document").toBe(0);
        // Read-only, and no owner chrome.
        await expect(recipient.locator("main").locator("button, input, select, textarea, form")).toHaveCount(0);
        await expect(recipient.getByRole("button", { name: "Menu akun" })).toHaveCount(0);
        await expect(recipient.getByRole("link", { name: "Beranda" })).toHaveCount(0);
      }
      expect(await recipient.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezoneId);
      const response = await recipient.goto(shareLink);
      expect(response?.status()).toBe(200);
      expect(await recipient.context().cookies(), "the recipient has no session").toEqual([]);
      await expectRecipientDocument();
      await recipient.reload();
      await expectRecipientDocument();

      const received = await downloadPdfByClick(recipient, recipient.getByRole("link", { name: "Unduh PDF" }), testInfo, "recipient.pdf");
      expect(received.download.suggestedFilename()).toBe(PDF_FILENAME);
      const receivedLines = received.text.split("\n");
      expect(receivedLines, `the recipient's PDF has the line "${dueLine}"`).toContain(dueLine);
      expect(received.text).not.toContain("Syarat pembayaran");
      expect(receivedLines).toContain(`Nomor invoice: ${INVOICE_NUMBER}`);
      // The due date sits between the tax line and the bank block.
      const at = (start: string) => receivedLines.findIndex((value) => value.startsWith(start));
      expect(at("Pajak potong")).toBeGreaterThanOrEqual(0);
      expect(at("Pajak potong")).toBeLessThan(at("Jatuh tempo:"));
      expect(at("Jatuh tempo:")).toBeLessThan(at("Pembayaran ke"));

      // Owner and recipient PDFs: same text, same order.
      const ownerLines = owner.text.split("\n");
      expect(ownerLines, `the owner's PDF has the line "${dueLine}"`).toContain(dueLine);
      const onlyInOwner = ownerLines.filter((value) => !receivedLines.includes(value));
      const onlyInRecipient = receivedLines.filter((value) => !ownerLines.includes(value));
      expect({ onlyInOwner, onlyInRecipient }).toEqual({ onlyInOwner: [], onlyInRecipient: [] });
      expect(received.text === owner.text, "owner and recipient PDFs have the same text in the same order").toBe(true);
      await expect(recipient).toHaveURL(/\/i\/[^/]+$/);

      expectSameJakartaDay(overlayDay);
    });
  });
}
