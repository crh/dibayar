// Decision A (issue #55, approved 2026-10-18): an invoice's document is
// frozen at its first exposure -- the first share link or the move out of
// Draf, whichever comes first -- and later deal and Settings edits never
// reach it (docs/product/capabilities.json: CAP-INV-12).
//
// A Draft that was never shared still follows its deal and Settings. From
// the moment a link exists, the owner's PDF, the brand's page and the
// brand's PDF all show the copy taken then, through link rotation, revoke and
// re-share, and the move to Terkirim.
//
// What changes the deal here: the contact name through deal detail (the only
// deal edit the UI offers before #55's editor ships), and brand, scope and
// payment terms through the deal's own PATCH endpoint, which already accepts
// them -- same-origin, as the page sends it. Settings are changed through
// Pengaturan. When the #55 editor ships, the brand/scope/terms edits move to
// it (deal-change-keeps-invoice.spec.ts carries that journey).
//
// Every value is synthetic. The links are bearer tokens of the disposable
// test database; comparisons about them are booleans so failures do not
// print them.
import type { APIResponse, Page } from "@playwright/test";
import { expect } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";
import { downloadPdfByClick } from "../support/pdf";
import { shareTest as test, shownShareLink } from "../support/share-links";
import { press, responseTo } from "../support/journey";

const SEEDED_BANK = "Bank E2E Fixture";
const DRAFT_EDIT = { brand: "E2E Brand Draf Diubah", scope: "Scope yang diubah selagi draf", paymentTerms: "Termin yang diubah selagi draf" };
const DRAFT_CONTACT = "Kontak Selagi Draf";
const AFTER_EDIT = { brand: "E2E Brand Setelah Dibagikan", scope: "Scope setelah tautan dibuat", paymentTerms: "Termin setelah tautan dibuat" };
const AFTER_CONTACT = "Kontak Setelah Dibagikan";
const AFTER_BANK = "Bank Setelah Dibagikan";

function statusAction(page: Page, name: string) {
  return page.getByRole("region", { name: "Status pembayaran" }).getByRole("button", { name, exact: true });
}

// The deal's PATCH endpoint, called the way the app's own pages call it.
async function patchDeal(page: Page, dealId: string, data: Record<string, string>): Promise<APIResponse> {
  const origin = new URL(page.url()).origin;
  const response = await page.request.patch(`/api/deals/${dealId}`, { data, headers: { Origin: origin } });
  expect(response.ok(), `PATCH /api/deals/${dealId}`).toBe(true);
  return response;
}

async function saveContactName(page: Page, dealId: string, name: string, isMobile: boolean) {
  await page.goto(`/deal/${dealId}`);
  await page.getByLabel("Nama kontak", { exact: true }).fill(name);
  const saved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("button", { name: "Simpan", exact: true }), isMobile));
  expect(saved.ok()).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "Nama kontak disimpan" })).toBeVisible();
}

async function saveBankName(page: Page, bankName: string, isMobile: boolean) {
  await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
  await expect(page).toHaveURL(/\/pengaturan$/);
  await page.getByRole("region", { name: "Rekening pembayaran" }).getByLabel("Nama bank").fill(bankName);
  const saved = await responseTo(page, "PATCH", "/api/me/settings", () => press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile));
  expect(saved.ok()).toBe(true);
  await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
}

// Buat invoice on the deal's detail page; returns the new invoice's id.
async function createInvoiceFromDeal(page: Page, dealId: string, isMobile: boolean): Promise<string> {
  await page.goto(`/deal/${dealId}`);
  const created = await responseTo(page, "POST", "/api/invoices", () => press(page.getByRole("button", { name: "Buat invoice" }), isMobile));
  expect(created.ok()).toBe(true);
  const invoiceLink = page.getByRole("link", { name: /^Lihat invoice / });
  await press(invoiceLink, isMobile);
  await expect(page).toHaveURL(/\/invoice\/[^/]+$/);
  await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function ownerPdfText(page: Page, invoiceId: string, testInfo: Parameters<typeof downloadPdfByClick>[2], name: string) {
  await page.goto(`/invoice/${invoiceId}`);
  const { text } = await downloadPdfByClick(page, page.getByRole("link", { name: "Unduh PDF" }), testInfo, name);
  return text;
}

async function recipientText(recipient: Page, link: string) {
  const response = await recipient.goto(link);
  expect(response?.status()).toBe(200);
  return (await recipient.getByRole("main").innerText()).replace(/\s+/g, " ");
}

function expectShows(text: string, expected: string[], absent: string[], where: string) {
  for (const value of expected) expect(text.includes(value), `${where} shows "${value}"`).toBe(true);
  for (const value of absent) expect(text.includes(value), `${where} does not show "${value}"`).toBe(false);
}

test.describe("issued invoice documents are frozen (Decision A, CAP-INV-12)", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("a Draft follows its deal and Settings until its first share link; from then on the owner's PDF, the brand's page and its PDF keep that copy through rotate, revoke, re-share and Terkirim", async ({ page, recipient, isMobile }, testInfo) => {
    test.setTimeout(150_000);
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.invoicePending;
    const frozenValues = [DRAFT_EDIT.brand, DRAFT_EDIT.scope, DRAFT_EDIT.paymentTerms, DRAFT_CONTACT, SEEDED_BANK];
    const laterValues = [AFTER_EDIT.brand, AFTER_EDIT.scope, AFTER_EDIT.paymentTerms, AFTER_CONTACT, AFTER_BANK];
    let invoiceId = "";
    let link = "";

    await test.step("a new Draft follows the deal it was made from", async () => {
      invoiceId = await createInvoiceFromDeal(page, dealId, isMobile);
      await patchDeal(page, dealId, DRAFT_EDIT);
      await saveContactName(page, dealId, DRAFT_CONTACT, isMobile);
      const draftPdf = await ownerPdfText(page, invoiceId, testInfo, "draft.pdf");
      expectShows(draftPdf, frozenValues, [manifest.brands[dealId]], "the Draft's PDF");
    });

    await test.step("Buat tautan berbagi freezes the document", async () => {
      await page.goto(`/invoice/${invoiceId}`);
      const created = await responseTo(page, "POST", `/api/invoices/${invoiceId}/share`, () => press(page.getByRole("button", { name: "Buat tautan berbagi" }), isMobile));
      expect(created.ok()).toBe(true);
      link = await shownShareLink(page);
      expectShows(await recipientText(recipient, link), frozenValues, [], "the brand's page right after sharing");
    });

    await test.step("deal and Settings edits after the link exists reach neither the owner's PDF nor the brand's page and PDF", async () => {
      await patchDeal(page, dealId, AFTER_EDIT);
      await saveContactName(page, dealId, AFTER_CONTACT, isMobile);
      await saveBankName(page, AFTER_BANK, isMobile);
      // The deal itself did change.
      await page.goto(`/deal/${dealId}`);
      await expect(page.getByRole("heading", { level: 1, name: AFTER_EDIT.brand })).toBeVisible();

      const ownerPdf = await ownerPdfText(page, invoiceId, testInfo, "owner-after-edit.pdf");
      expectShows(ownerPdf, frozenValues, laterValues, "the owner's PDF");
      expectShows(await recipientText(recipient, link), frozenValues, laterValues, "the brand's page");
      const { text: recipientPdf } = await downloadPdfByClick(recipient, recipient.getByRole("link", { name: "Unduh PDF" }), testInfo, "recipient-after-edit.pdf");
      expect(recipientPdf === ownerPdf, "owner and brand PDFs have the same text").toBe(true);
    });

    await test.step("rotating, revoking and re-sharing the link keep the same document", async () => {
      await page.goto(`/invoice/${invoiceId}`);
      await press(page.getByRole("button", { name: "Buat ulang tautan" }), isMobile);
      await press(page.getByRole("button", { name: "Ya, buat tautan baru" }), isMobile);
      await expect.poll(async () => (await shownShareLink(page)) === link, { message: "the shown link changes" }).toBe(false);
      const rotated = await shownShareLink(page);
      expectShows(await recipientText(recipient, rotated), frozenValues, laterValues, "the brand's page on the rotated link");

      await press(page.getByRole("button", { name: "Cabut tautan" }), isMobile);
      await press(page.getByRole("button", { name: "Ya, cabut tautan" }), isMobile);
      await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
      await press(page.getByRole("button", { name: "Buat tautan berbagi" }), isMobile);
      link = await shownShareLink(page);
      expectShows(await recipientText(recipient, link), frozenValues, laterValues, "the brand's page on a re-shared link");
    });

    await test.step("marking it sent changes nothing in the document", async () => {
      const sent = await responseTo(page, "PATCH", `/api/invoices/${invoiceId}`, () => press(statusAction(page, "Tandai sudah dikirim"), isMobile));
      expect(sent.ok()).toBe(true);
      await page.reload();
      expectShows(await recipientText(recipient, link), frozenValues, laterValues, "the brand's page after Terkirim");
      // The page judges completeness by the frozen copy: it had bank details.
      await expect(page.getByText(/Lengkapi identitas penerbit|sudah dikirim atau dibagikan dengan identitas/)).toHaveCount(0);
    });
  });

  test("Tandai sudah dikirim freezes a Draft that has no link yet; a link made later shows the copy from that moment", async ({ page, recipient, isMobile }, testInfo) => {
    test.setTimeout(90_000);
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.invoicePending;
    const issuedBrand = manifest.brands[dealId];
    const invoiceId = await createInvoiceFromDeal(page, dealId, isMobile);

    const sent = await responseTo(page, "PATCH", `/api/invoices/${invoiceId}`, () => press(statusAction(page, "Tandai sudah dikirim"), isMobile));
    expect(sent.ok()).toBe(true);
    await patchDeal(page, dealId, AFTER_EDIT);

    const ownerPdf = await ownerPdfText(page, invoiceId, testInfo, "owner-sent.pdf");
    expectShows(ownerPdf, [issuedBrand, "E2E fixture: ready to invoice, none created yet"], [AFTER_EDIT.brand, AFTER_EDIT.scope, AFTER_EDIT.paymentTerms], "the owner's PDF");

    await page.goto(`/invoice/${invoiceId}`);
    await press(page.getByRole("button", { name: "Buat tautan berbagi" }), isMobile);
    const link = await shownShareLink(page);
    expectShows(await recipientText(recipient, link), [issuedBrand], [AFTER_EDIT.brand, AFTER_EDIT.scope], "the brand's page");
  });
});
