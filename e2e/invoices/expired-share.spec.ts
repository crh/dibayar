// FIND-07 regression: invoice detail tells the owner the truth about an
// expired share link and never sends one. Its WhatsApp action asks the server
// for a link to send (POST .../share/ensure, the same contract the Beranda
// reminder uses since FIND-05): the invoice's usable link, or a new one when
// there is none or it has expired. Only "Buat ulang tautan" rotates a usable
// link (INV-WA-01, SHARE-01, SHARE-02 -- docs/testing/journey-coverage.json).
//
// Before the fix the page showed an expired share as "Tautan berbagi aktif."
// / "Tautan aktif sampai 1 Jan 2020." and Kirim pengingat sent that dead
// link.
//
// Runs on the follow-up overlay; the expired share comes from the
// follow-up-expired-share fixture action, because the app has no way to
// backdate an expiry (e2e/support/reseed.ts). Links are compared as
// booleans, never printed (e2e/support/share-links.ts). WhatsApp never
// leaves the machine (keepWhatsAppLocal()).
import type { Page } from "@playwright/test";
import { expect } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { applyFollowUpExpiredShare, applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { primaryNav } from "../support/nav";
import { followUpRowLink, keepWhatsAppLocal } from "../support/follow-up";
import {
  expectRecipientGetsNotFound,
  expectRecipientSeesExpired,
  expectRecipientSeesInvoice,
  sendReminder,
  shareTest as test,
  shownShareLink,
  trackShareMutations,
} from "../support/share-links";

const NBSP = " ";
const INVOICE_NUMBER = "E2E/OVERDUE/003";
const AMOUNT = `Rp${NBSP}8.000.000`;
// FIXTURE_PAST_DATE (src/lib/e2e-fixture-dates.ts), as the app prints it.
const EXPIRED_ON_ID = "1 Jan 2020";

function overdueStored() {
  const { followUp } = loadFixtureManifest();
  return { followUp, invoiceId: followUp.invoices.overdueStored, brand: followUp.brands[followUp.deals.overdueStored] };
}

// In from Beranda's queue row, the way a person gets to an overdue invoice.
async function openInvoiceDetail(page: Page, brand: string, invoiceId: string) {
  await page.goto("/");
  await followUpRowLink(page, brand).click();
  await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
  await expectDetailSettled(page);
}

// The contact and share fetches are done once the reminder is enabled.
async function expectDetailSettled(page: Page) {
  await expect(page.getByRole("heading", { name: AMOUNT })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim pengingat" })).toBeEnabled();
}

function shareSection(page: Page) {
  return page.getByRole("region", { name: "Bagikan invoice" });
}

async function expectExpiredShareState(page: Page) {
  const section = shareSection(page);
  await expect(section.getByText("Tautan berbagi sudah tidak berlaku.")).toBeVisible();
  await expect(section.getByText(`Berakhir pada ${EXPIRED_ON_ID}. Penerima tidak bisa lagi membuka invoice lewat tautan ini.`)).toBeVisible();
  // Nothing says or implies the link still works.
  await expect(section.getByText("Tautan berbagi aktif.")).toHaveCount(0);
  await expect(section.getByText(/Tautan aktif/)).toHaveCount(0);
  await expect(section.getByTestId("share-link-track")).toHaveCount(0);
  await expect(section.getByRole("button", { name: "Buat ulang tautan" })).toHaveCount(0);
  await expect(section.getByRole("button", { name: "Cabut tautan" })).toHaveCount(0);
  await expect(section.getByRole("button", { name: "Buat tautan baru" })).toBeVisible();
}

async function expectActiveShareState(page: Page) {
  const section = shareSection(page);
  await expect(section.getByText("Tautan berbagi aktif.")).toBeVisible();
  await expect(section.getByText(/^Tautan aktif sampai /)).toBeVisible();
  await expect(section.getByText("Tautan berbagi sudah tidak berlaku.")).toHaveCount(0);
}

test.describe("expired share link on invoice detail", { tag: "@critical" }, () => {
  test.afterEach(reseedFixtures);

  test("an expired share link is shown as expired, not active, in Indonesian and in English", async ({ page }) => {
    applyFollowUpExpiredShare();
    const { invoiceId, brand } = overdueStored();

    await openInvoiceDetail(page, brand, invoiceId);
    await expectExpiredShareState(page);
    // Looking at it changes nothing: still expired after a reload.
    await page.reload();
    await expectDetailSettled(page);
    await expectExpiredShareState(page);

    // English, switched with the real Settings control.
    await primaryNav(page).getByRole("link", { name: "Pengaturan" }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
    const languagePatch = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/me/language",
    );
    await page.getByRole("group", { name: "Bahasa antarmuka" }).getByRole("button", { name: "English" }).click();
    expect((await languagePatch).ok()).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await primaryNav(page, "en").getByRole("link", { name: "Invoices", exact: true }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await page.getByRole("link", { name: new RegExp(brand) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));

    const section = page.getByRole("region", { name: "Share invoice" });
    await expect(section.getByText("The sharing link has expired.")).toBeVisible();
    await expect(section.getByText("It ended on 1 Jan 2020. Recipients can no longer open the invoice with this link.")).toBeVisible();
    await expect(section.getByText("Sharing link is active.")).toHaveCount(0);
    await expect(section.getByText(/Link active/)).toHaveCount(0);
    await expect(section.getByRole("button", { name: "Create a new link" })).toBeVisible();
  });

  test("Kirim pengingat on invoice detail replaces an expired link with a working one, and the next reminder reuses it", async ({ page, context, recipient }) => {
    applyFollowUpExpiredShare();
    const { followUp, invoiceId, brand } = overdueStored();
    await keepWhatsAppLocal(context);

    await openInvoiceDetail(page, brand, invoiceId);
    await expectExpiredShareState(page);
    const expiredLink = `${new URL(page.url()).origin}/i/${followUp.expiredShareToken}`;
    // The old link is a real one and the recipient sees it has expired.
    await expectRecipientSeesExpired(recipient, expiredLink, INVOICE_NUMBER);

    const mutations = trackShareMutations(page, invoiceId);
    const sentLink = await sendReminder(page, page, INVOICE_NUMBER);
    expect(sentLink === expiredLink, "the reminder must not carry the expired link").toBe(false);
    expect(mutations).toEqual(["POST /share/ensure"]);
    await expectRecipientSeesInvoice(recipient, sentLink, INVOICE_NUMBER, AMOUNT);
    // The page now shows that link as the invoice's active one...
    await expectActiveShareState(page);
    expect((await shownShareLink(page)) === sentLink, "invoice detail shows the link that was sent").toBe(true);
    // ...also after a reload.
    await page.reload();
    await expectDetailSettled(page);
    await expectActiveShareState(page);
    expect((await shownShareLink(page)) === sentLink, "the new link survives a reload").toBe(true);
    // The old link did not come back. An invoice has one share row, so the
    // replaced token is now unknown: generic not-found, not the expired page.
    await expectRecipientGetsNotFound(recipient, expiredLink, INVOICE_NUMBER);

    // A second reminder from the same page reuses the fresh link.
    const secondSent = await sendReminder(page, page, INVOICE_NUMBER);
    expect(secondSent === sentLink, "the second reminder reuses the fresh link").toBe(true);
    expect(mutations).toEqual(["POST /share/ensure", "POST /share/ensure"]);
    await expectRecipientSeesInvoice(recipient, sentLink, INVOICE_NUMBER, AMOUNT);
    expect((await shownShareLink(page)) === sentLink, "invoice detail still shows the same link").toBe(true);
  });

  test("Buat tautan baru on an expired share creates a working link in one step", async ({ page, recipient }) => {
    applyFollowUpExpiredShare();
    const { followUp, invoiceId, brand } = overdueStored();

    await openInvoiceDetail(page, brand, invoiceId);
    await expectExpiredShareState(page);
    const expiredLink = `${new URL(page.url()).origin}/i/${followUp.expiredShareToken}`;

    const mutations = trackShareMutations(page, invoiceId);
    await shareSection(page).getByRole("button", { name: "Buat tautan baru" }).click();
    await expectActiveShareState(page);
    const newLink = await shownShareLink(page);
    expect(newLink === expiredLink, "the new link is not the expired one").toBe(false);
    expect(mutations).toEqual(["POST /share"]);
    await expectRecipientSeesInvoice(recipient, newLink, INVOICE_NUMBER, AMOUNT);

    await page.reload();
    await expectDetailSettled(page);
    expect((await shownShareLink(page)) === newLink, "the new link survives a reload").toBe(true);
  });

  test("Kirim pengingat on invoice detail sends the active link that already exists and does not rotate it", async ({ page, context, recipient }) => {
    applyFollowUpStates();
    const { invoiceId, brand } = overdueStored();
    await keepWhatsAppLocal(context);

    await openInvoiceDetail(page, brand, invoiceId);
    await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
    await page.getByRole("button", { name: "Buat tautan berbagi" }).click();
    const existingLink = await shownShareLink(page);
    await expectRecipientSeesInvoice(recipient, existingLink, INVOICE_NUMBER, AMOUNT);
    // A fresh page load, so the link is the one the server gives back.
    await page.reload();
    await expectDetailSettled(page);

    const mutations = trackShareMutations(page, invoiceId);
    const firstSent = await sendReminder(page, page, INVOICE_NUMBER);
    const secondSent = await sendReminder(page, page, INVOICE_NUMBER);
    expect(firstSent === existingLink, "the first reminder carries the existing link").toBe(true);
    expect(secondSent === existingLink, "the second reminder carries the existing link").toBe(true);
    expect(mutations).toEqual(["POST /share/ensure", "POST /share/ensure"]);
    await expectRecipientSeesInvoice(recipient, existingLink, INVOICE_NUMBER, AMOUNT);

    await page.reload();
    await expectDetailSettled(page);
    expect((await shownShareLink(page)) === existingLink, "invoice detail still shows the same link").toBe(true);
  });

  test("after Buat ulang tautan, the old link is dead and invoice detail reminders send the new one without rotating it again", async ({ page, context, recipient }) => {
    applyFollowUpStates();
    const { invoiceId, brand } = overdueStored();
    await keepWhatsAppLocal(context);

    await openInvoiceDetail(page, brand, invoiceId);
    await page.getByRole("button", { name: "Buat tautan berbagi" }).click();
    const oldLink = await shownShareLink(page);
    await expectRecipientSeesInvoice(recipient, oldLink, INVOICE_NUMBER, AMOUNT);

    const mutations = trackShareMutations(page, invoiceId);
    await page.getByRole("button", { name: "Buat ulang tautan" }).click();
    await page.getByRole("button", { name: "Ya, buat tautan baru" }).click();
    const shown = page.getByTestId("share-link-track").locator("span[title]");
    await expect.poll(async () => (await shown.getAttribute("title")) === oldLink, { message: "the shown link changes" }).toBe(false);
    const newLink = await shownShareLink(page);
    expect(mutations).toEqual(["POST /share"]);
    await expectRecipientGetsNotFound(recipient, oldLink, INVOICE_NUMBER);
    await expectRecipientSeesInvoice(recipient, newLink, INVOICE_NUMBER, AMOUNT);

    // Reminders from this page now carry the new link and leave it alone.
    const firstSent = await sendReminder(page, page, INVOICE_NUMBER);
    const secondSent = await sendReminder(page, page, INVOICE_NUMBER);
    expect(firstSent === newLink, "the first reminder carries the regenerated link").toBe(true);
    expect(secondSent === newLink, "the second reminder carries the regenerated link").toBe(true);
    expect(mutations).toEqual(["POST /share", "POST /share/ensure", "POST /share/ensure"]);
    await expectRecipientSeesInvoice(recipient, newLink, INVOICE_NUMBER, AMOUNT);
    await expectRecipientGetsNotFound(recipient, oldLink, INVOICE_NUMBER);
  });
});
