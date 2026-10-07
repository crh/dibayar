// FIND-05 regression: a reminder sent from the Beranda queue reuses the
// invoice's share link instead of rotating it, so a link the brand already
// holds keeps working (HOME-03). It makes a new link only when there is no
// usable one (none yet, or expired). The explicit "Buat ulang tautan" on
// invoice detail still rotates and kills the old link (SHARE-02) --
// docs/testing/journey-coverage.json.
//
// Before the fix the queue called POST /api/invoices/:id/share
// (createOrRegenerateShare), so every reminder issued a new token and the
// previous link returned 404. It now calls POST .../share/ensure
// (ensureShare, src/lib/invoice-share.ts).
//
// Runs on the follow-up overlay (e2e/support/reseed.ts). Links are compared
// as booleans and never interpolated into a message, so a failure can't
// print a token. WhatsApp never leaves the machine (keepWhatsAppLocal()).
import type { Locator, Page } from "@playwright/test";
import { expect, test as base } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { applyFollowUpExpiredShare, applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { primaryNav } from "../support/nav";
import { followUpRow, followUpRowLink, keepWhatsAppLocal, parseWhatsAppLink } from "../support/follow-up";

const NBSP = " ";
const INVOICE_NUMBER = "E2E/OVERDUE/003";
const AMOUNT = `Rp${NBSP}8.000.000`;

// `recipient`: a page in its own context with no session and no storage --
// the brand opening the link on their own device.
const test = base.extend<{ recipient: Page }>({
  recipient: async ({ browser, baseURL, viewport, isMobile, hasTouch, userAgent, locale, timezoneId }, provide) => {
    const context = await browser.newContext({
      baseURL, viewport, isMobile, hasTouch, userAgent, locale, timezoneId,
      storageState: { cookies: [], origins: [] },
    });
    try {
      await provide(await context.newPage());
    } finally {
      await context.close();
    }
  },
});

async function expectRecipientSeesInvoice(recipient: Page, link: string, invoiceNumber: string, amount: string) {
  const response = await recipient.goto(link);
  expect(response?.status()).toBe(200);
  await expect(recipient.getByText(invoiceNumber).first()).toBeVisible();
  await expect(recipient.getByText(amount).first()).toBeVisible();
  await expect(recipient.locator('p[role="alert"]')).toHaveCount(0);
}

async function expectRecipientGetsNotFound(recipient: Page, link: string, invoiceNumber: string) {
  const response = await recipient.goto(link);
  expect(response?.status()).toBe(404);
  await expect(recipient.locator('p[role="alert"]')).toHaveText("Tautan ini tidak ditemukan.");
  await expect(recipient.getByText(invoiceNumber)).toHaveCount(0);
}

// Every share mutation the page sends for this invoice, as "METHOD /suffix"
// (no tokens: the request carries none).
function trackShareMutations(page: Page, invoiceId: string): string[] {
  const prefix = `/api/invoices/${invoiceId}`;
  const mutations: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (request.method() !== "GET" && pathname.startsWith(`${prefix}/share`)) {
      mutations.push(`${request.method()} ${pathname.slice(prefix.length)}`);
    }
  });
  return mutations;
}

// Clicks the row's visible Kirim pengingat and returns the public invoice
// link inside the WhatsApp message it opened.
async function sendReminder(page: Page, row: Locator): Promise<string> {
  const button = row.getByRole("button", { name: "Kirim pengingat" });
  const [popup] = await Promise.all([page.waitForEvent("popup"), button.click()]);
  await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/628110000008\?text=/);
  const { text } = parseWhatsAppLink(popup.url());
  await popup.close();
  // The send finished cleanly: no error, no blocked-popup fallback (FIND-04).
  await expect(button).toBeVisible();
  await expect(row.getByRole("alert")).toHaveCount(0);
  await expect(row.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0);

  expect(text).toContain(INVOICE_NUMBER);
  const origin = new URL(page.url()).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const links = text?.match(new RegExp(`${origin}/i/[A-Za-z0-9_-]{40,}`, "g")) ?? [];
  expect(links.length, "the reminder carries exactly one public invoice link").toBe(1);
  return links[0]!;
}

// The link invoice detail shows for the active share.
async function shownShareLink(page: Page): Promise<string> {
  const shown = page.getByTestId("share-link-track").locator("span[title]");
  await expect(shown).toBeVisible();
  return (await shown.getAttribute("title"))!;
}

async function openInvoiceFromQueue(page: Page, brand: string, invoiceId: string) {
  await followUpRowLink(page, brand).click();
  await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
  // Settled: the contact and share fetches are done once this is enabled.
  await expect(page.getByRole("heading", { name: AMOUNT })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim pengingat" })).toBeEnabled();
}

async function backToBeranda(page: Page) {
  await primaryNav(page).getByRole("link", { name: "Beranda" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// The owner makes the link the normal way: Beranda -> the invoice -> "Buat
// tautan berbagi". Returns the link shown.
async function createShareLinkOnDetail(page: Page, brand: string, invoiceId: string): Promise<string> {
  await page.goto("/");
  await openInvoiceFromQueue(page, brand, invoiceId);
  await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
  await page.getByRole("button", { name: "Buat tautan berbagi" }).click();
  const link = await shownShareLink(page);
  expect(/\/i\/[A-Za-z0-9_-]{40,}$/.test(link), "invoice detail shows a public link").toBe(true);
  return link;
}

test.describe("share link and reminders", { tag: "@critical" }, () => {
  test.afterEach(reseedFixtures);

  test.describe("Beranda Kirim pengingat", () => {
    test("reuses the invoice's active share link, which keeps working for the recipient", async ({ page, context, recipient }) => {
      applyFollowUpStates();
      const { followUp } = loadFixtureManifest();
      const invoiceId = followUp.invoices.overdueStored;
      const brand = followUp.brands[followUp.deals.overdueStored];
      await keepWhatsAppLocal(context);

      const existingLink = await createShareLinkOnDetail(page, brand, invoiceId);
      // The brand received this link and it opens without a session.
      await expectRecipientSeesInvoice(recipient, existingLink, INVOICE_NUMBER, AMOUNT);

      await backToBeranda(page);
      const mutations = trackShareMutations(page, invoiceId);
      const sentLink = await sendReminder(page, followUpRow(page, brand));
      expect(sentLink === existingLink, "the reminder carries the link that already existed").toBe(true);
      expect(mutations).toEqual(["POST /share/ensure"]);
      // The link the brand already has still opens after the reminder.
      await expectRecipientSeesInvoice(recipient, existingLink, INVOICE_NUMBER, AMOUNT);

      // It is still the invoice's link after a reload of Beranda, on invoice
      // detail, and after reloading that too.
      await page.reload();
      await openInvoiceFromQueue(page, brand, invoiceId);
      expect((await shownShareLink(page)) === existingLink, "invoice detail still shows the same link").toBe(true);
      await page.reload();
      expect((await shownShareLink(page)) === existingLink, "the same link survives a reload").toBe(true);
      await expectRecipientSeesInvoice(recipient, existingLink, INVOICE_NUMBER, AMOUNT);
    });

    test("sending the reminder twice sends the same link both times", async ({ page, context, recipient }) => {
      applyFollowUpStates();
      const { followUp } = loadFixtureManifest();
      const invoiceId = followUp.invoices.overdueStored;
      const brand = followUp.brands[followUp.deals.overdueStored];
      await keepWhatsAppLocal(context);

      const existingLink = await createShareLinkOnDetail(page, brand, invoiceId);
      await backToBeranda(page);
      const mutations = trackShareMutations(page, invoiceId);
      const row = followUpRow(page, brand);

      const firstSent = await sendReminder(page, row);
      const secondSent = await sendReminder(page, row);

      expect(firstSent === existingLink, "the first reminder carries the existing link").toBe(true);
      expect(secondSent === existingLink, "the second reminder carries the existing link").toBe(true);
      expect(mutations).toEqual(["POST /share/ensure", "POST /share/ensure"]);
      // The first link still opens after the second reminder...
      await expectRecipientSeesInvoice(recipient, firstSent, INVOICE_NUMBER, AMOUNT);
      // ...and it is still the invoice's one link: nothing was rotated.
      await openInvoiceFromQueue(page, brand, invoiceId);
      expect((await shownShareLink(page)) === existingLink, "invoice detail shows the same link after two reminders").toBe(true);
    });

    test("with no share link yet, the first reminder creates one and the next reuses it", async ({ page, context, recipient }) => {
      applyFollowUpStates();
      const { followUp } = loadFixtureManifest();
      const invoiceId = followUp.invoices.overdueStored;
      const brand = followUp.brands[followUp.deals.overdueStored];
      await keepWhatsAppLocal(context);

      // The overlay's invoices start with no share at all.
      await page.goto("/");
      await openInvoiceFromQueue(page, brand, invoiceId);
      await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
      await backToBeranda(page);
      const row = followUpRow(page, brand);

      const createdLink = await sendReminder(page, row);
      await expectRecipientSeesInvoice(recipient, createdLink, INVOICE_NUMBER, AMOUNT);

      const secondSent = await sendReminder(page, row);
      expect(secondSent === createdLink, "the second reminder reuses the link the first one created").toBe(true);
      await expectRecipientSeesInvoice(recipient, createdLink, INVOICE_NUMBER, AMOUNT);

      // That one link is the invoice's share, also after a reload.
      await page.reload();
      await openInvoiceFromQueue(page, brand, invoiceId);
      expect((await shownShareLink(page)) === createdLink, "invoice detail shows the link the reminder created").toBe(true);
    });

    test("an expired share link is not sent: the reminder makes a new working link", async ({ page, context, recipient }) => {
      applyFollowUpExpiredShare();
      const { followUp } = loadFixtureManifest();
      const invoiceId = followUp.invoices.overdueStored;
      const brand = followUp.brands[followUp.deals.overdueStored];
      await keepWhatsAppLocal(context);

      await page.goto("/");
      const expiredLink = `${new URL(page.url()).origin}/i/${followUp.expiredShareToken}`;
      // The starting state: the old link is a real one, and it has expired.
      const before = await recipient.goto(expiredLink);
      expect(before?.status()).toBe(200);
      await expect(recipient.locator('p[role="alert"]')).toHaveText("Tautan ini sudah tidak berlaku.");
      await expect(recipient.getByText(INVOICE_NUMBER)).toHaveCount(0);

      const row = followUpRow(page, brand);
      const sentLink = await sendReminder(page, row);
      expect(sentLink === expiredLink, "the reminder must not carry the expired link").toBe(false);
      await expectRecipientSeesInvoice(recipient, sentLink, INVOICE_NUMBER, AMOUNT);
      // The old link did not come back to life. An invoice has one share row,
      // so replacing it leaves the old token unknown: generic not-found.
      await expectRecipientGetsNotFound(recipient, expiredLink, INVOICE_NUMBER);

      // The replacement is now the link every later reminder uses.
      const secondSent = await sendReminder(page, row);
      expect(secondSent === sentLink, "the next reminder reuses the replacement link").toBe(true);
      await expectRecipientSeesInvoice(recipient, sentLink, INVOICE_NUMBER, AMOUNT);
      await openInvoiceFromQueue(page, brand, invoiceId);
      expect((await shownShareLink(page)) === sentLink, "invoice detail shows the replacement link").toBe(true);
    });
  });

  test("Buat ulang tautan on invoice detail still replaces the link: the old one stops working, the new one opens", async ({ page, context, recipient }) => {
    applyFollowUpStates();
    const { followUp } = loadFixtureManifest();
    const invoiceId = followUp.invoices.overdueStored;
    const brand = followUp.brands[followUp.deals.overdueStored];
    await keepWhatsAppLocal(context);

    const oldLink = await createShareLinkOnDetail(page, brand, invoiceId);
    await expectRecipientSeesInvoice(recipient, oldLink, INVOICE_NUMBER, AMOUNT);

    const mutations = trackShareMutations(page, invoiceId);
    await page.getByRole("button", { name: "Buat ulang tautan" }).click();
    await page.getByRole("button", { name: "Ya, buat tautan baru" }).click();
    const shown = page.getByTestId("share-link-track").locator("span[title]");
    await expect.poll(async () => (await shown.getAttribute("title")) === oldLink, { message: "the shown link changes" }).toBe(false);
    const newLink = await shownShareLink(page);
    expect(/\/i\/[A-Za-z0-9_-]{40,}$/.test(newLink), "the new link is a public link").toBe(true);
    expect(mutations).toEqual(["POST /share"]);

    await expectRecipientGetsNotFound(recipient, oldLink, INVOICE_NUMBER);
    await expectRecipientSeesInvoice(recipient, newLink, INVOICE_NUMBER, AMOUNT);

    // The rotation persisted, and a reminder from Beranda now carries the
    // new link rather than rotating it again.
    await page.reload();
    expect((await shownShareLink(page)) === newLink, "the new link survives a reload").toBe(true);
    await backToBeranda(page);
    const sentLink = await sendReminder(page, followUpRow(page, brand));
    expect(sentLink === newLink, "the reminder carries the regenerated link").toBe(true);
    await expectRecipientSeesInvoice(recipient, newLink, INVOICE_NUMBER, AMOUNT);
    await expectRecipientGetsNotFound(recipient, oldLink, INVOICE_NUMBER);
  });
});
