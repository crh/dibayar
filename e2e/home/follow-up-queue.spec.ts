// Real-interaction coverage for the Beranda follow-up queue ("Perlu
// dikejar"): which invoices it lists and why (HOME-02), and "Kirim
// pengingat" on a row (HOME-03) -- docs/testing/journey-coverage.json.
//
// Runs on the follow-up overlay (applyFollowUpStates(), e2e/support/reseed.ts),
// whose due dates sit on selectAttentionInvoices()' Jakarta-date boundaries:
// due yesterday (just overdue), due today (not overdue), due in 7 days (last
// day of the due-soon window) and due in 8 days (outside it), plus an invoice
// stored as OVERDUE and due 5 days ago. The base seed's SENT invoice (due
// 2099) and PAID invoice must never appear. Every test reseeds afterwards so
// the read-only specs and the @visual baselines see the base seed again.
//
// WhatsApp never leaves the machine: keepWhatsAppLocal() answers wa.me with a
// local stub, so the popup URL is the exact link the app built and nothing is
// sent to anyone.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { primaryNav } from "../support/nav";
import {
  addCalendarDays,
  expectSameJakartaDay,
  followUpQueue,
  followUpRow,
  followUpRowLink,
  jakartaToday,
  keepWhatsAppLocal,
  parseWhatsAppLink,
  shortIdDate,
} from "../support/follow-up";

const NBSP = "\u00a0";

function isSharePost(invoiceId: string) {
  return (response: { request(): { method(): string }; url(): string }) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === `/api/invoices/${invoiceId}/share`;
}

test.describe("Beranda follow-up queue", { tag: "@critical" }, () => {
  let overlayDay = "";
  test.beforeEach(() => {
    overlayDay = jakartaToday();
    applyFollowUpStates();
  });
  test.afterEach(reseedFixtures);

  test("lists overdue and due-soon invoices with their reasons in order, and keeps them after reload", async ({ page }) => {
    const { followUp, brands, deals } = loadFixtureManifest();
    const due = (key: keyof typeof followUp.dueOffsetDays) => shortIdDate(addCalendarDays(overlayDay, followUp.dueOffsetDays[key]));
    // Overdue first (most recently overdue first), then due-soon (nearest
    // first) -- the order a person should chase them in.
    const expectedRows = [
      { brand: followUp.brands[followUp.deals.overdueSent], reason: `${due("overdueSent")} · Telat 1 hari`, amount: `Rp${NBSP}9.000.000` },
      { brand: followUp.brands[followUp.deals.overdueStored], reason: `${due("overdueStored")} · Telat 5 hari`, amount: `Rp${NBSP}8.000.000` },
      { brand: followUp.brands[followUp.deals.dueToday], reason: `${due("dueToday")} · Jatuh tempo hari ini`, amount: `Rp${NBSP}1.100.000` },
      { brand: followUp.brands[followUp.deals.dueWindowEdge], reason: `${due("dueWindowEdge")} · Jatuh tempo 7 hari lagi`, amount: `Rp${NBSP}1.200.000` },
    ];
    const neverListed = [
      followUp.brands[followUp.deals.dueOutsideWindow],
      brands[deals.invoiceSent],
      brands[deals.dibayar],
    ];

    async function expectQueue() {
      const rows = followUpQueue(page).getByRole("listitem");
      await expect(rows).toHaveCount(expectedRows.length);
      for (const [index, row] of expectedRows.entries()) {
        await expect(rows.nth(index)).toContainText(row.brand);
        await expect(rows.nth(index)).toContainText(row.reason);
        await expect(rows.nth(index)).toContainText(row.amount);
        await expect(rows.nth(index).getByRole("button", { name: "Kirim pengingat" })).toBeVisible();
      }
      for (const brand of neverListed) await expect(followUpQueue(page)).not.toContainText(brand);
      await expect(followUpQueue(page)).not.toContainText("Tidak ada yang perlu dikejar.");
    }

    // Arrive the way a person does: from another page, through the nav.
    await page.goto("/invoice");
    await primaryNav(page).getByRole("link", { name: "Beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectQueue();

    // A row opens that invoice, and the detail page agrees on why it is listed.
    await followUpRowLink(page, expectedRows[0].brand).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${followUp.invoices.overdueSent}$`));
    await expect(page.getByText("Terlambat", { exact: true })).toBeVisible();
    await expect(page.getByText(`Jatuh tempo: ${due("overdueSent")}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim pengingat" })).toBeVisible();

    // Browser back and a full reload both show the same queue.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expectQueue();
    await page.reload();
    await expectQueue();
    expectSameJakartaDay(overlayDay);
  });

  test("Kirim pengingat on an overdue row opens WhatsApp with the overdue reminder and a working invoice link", async ({ page, context, browser, baseURL, viewport, isMobile, hasTouch, userAgent, locale, timezoneId }) => {
    const { followUp } = loadFixtureManifest();
    const invoiceId = followUp.invoices.overdueStored;
    const brand = followUp.brands[followUp.deals.overdueStored];
    const dueText = shortIdDate(addCalendarDays(overlayDay, followUp.dueOffsetDays.overdueStored));
    await keepWhatsAppLocal(context);

    await page.goto("/");
    const row = followUpRow(page, brand);
    await expect(row).toContainText("Telat 5 hari");

    const sharePost = page.waitForResponse(isSharePost(invoiceId));
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      row.getByRole("button", { name: "Kirim pengingat" }).click(),
    ]);
    expect((await sharePost).ok()).toBe(true);
    await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\//);
    const { number, text } = parseWhatsAppLink(popup.url());
    await popup.close();

    // The deal's contact, and the overdue wording -- not the due-soon one.
    expect(number).toBe("628110000008");
    const origin = new URL(page.url()).origin;
    const linkPattern = `${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/i/[A-Za-z0-9_-]{40,}`;
    expect(text).toMatch(new RegExp(
      `^Halo, ini pengingat invoice E2E/OVERDUE/003 sebesar Rp${NBSP}8\\.000\\.000 yang sudah melewati jatuh tempo ${dueText}\\.\\nDetail invoice: ${linkPattern}\\nTerima kasih\\.$`,
    ));
    const sentLink = text!.match(new RegExp(linkPattern))![0];
    // No error. (The row does also show the "Buka WhatsApp" fallback here
    // even though the popup opened -- FIND-04, pinned by the expected-failure
    // test below rather than asserted either way in this one.)
    await expect(row.getByRole("alert")).toHaveCount(0);

    // The link in the message is the invoice's share link, and it persisted:
    // after a reload, invoice detail shows that same active link...
    await followUpRowLink(page, brand).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
    await page.reload();
    const shownLink = await page.getByTestId("share-link-track").locator("span[title]").getAttribute("title");
    // Compared as booleans so a mismatch never prints the token.
    expect(shownLink === sentLink, "invoice detail shows the link that was sent").toBe(true);

    // ...and a recipient without a session can open it.
    const recipient = await browser.newContext({
      baseURL, viewport, isMobile, hasTouch, userAgent, locale, timezoneId,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const recipientPage = await recipient.newPage();
      await recipientPage.goto(sentLink);
      await expect(recipientPage.getByText("E2E/OVERDUE/003").first()).toBeVisible();
      await expect(recipientPage.getByText(`Rp${NBSP}8.000.000`).first()).toBeVisible();
    } finally {
      await recipient.close();
    }
    expectSameJakartaDay(overlayDay);
  });

  // FIND-04 (expected failure, never counted as coverage): the queue opens
  // WhatsApp with window.open(href, "_blank", "noopener,noreferrer"), and the
  // HTML spec makes window.open() return null whenever "noopener" is set --
  // so the "popup was blocked" check (`win ? IDLE : blocked`) is true even
  // when the chat opened, and the fallback link always appears. Remove
  // test.fail() when the detection is fixed; `npm run coverage:journeys`
  // then forces the inventory update.
  test("after the reminder popup opens, the row shows no blocked-popup fallback", async ({ page, context }) => {
    test.fail(true, "FIND-04: window.open() with noopener always returns null, so the blocked-popup fallback always shows");
    const { followUp } = loadFixtureManifest();
    const row = followUpRow(page, followUp.brands[followUp.deals.overdueStored]);
    await keepWhatsAppLocal(context);

    await page.goto("/");
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      row.getByRole("button", { name: "Kirim pengingat" }).click(),
    ]);
    await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/628110000008\?text=/);
    await popup.close();
    // The send finished (spinner gone, accessible name back)...
    await expect(row.getByRole("button", { name: "Kirim pengingat" })).toBeVisible();
    // ...and, since the popup did open, no "it was blocked" link should show.
    await expect(row.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0, { timeout: 2_000 });
  });

  // Partial by the inventory's rules: window.open() is stubbed to return
  // null, the exact signal a popup blocker gives (same technique as the
  // invoice-detail fallback test in invoice-journeys.spec.ts). The click and
  // the rendered fallback link are real. Until FIND-04 is fixed this test
  // cannot tell a blocked popup from an opened one (the link shows either
  // way); it still proves the link is correctly addressed and clickable.
  test("a blocked reminder popup on a queue row shows a Buka WhatsApp fallback link", async ({ page, context }) => {
    const { followUp } = loadFixtureManifest();
    const brand = followUp.brands[followUp.deals.overdueStored];
    await keepWhatsAppLocal(context);
    await page.addInitScript(() => {
      window.open = () => null;
    });

    await page.goto("/");
    const row = followUpRow(page, brand);
    await expect(row.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0);
    const sharePost = page.waitForResponse(isSharePost(followUp.invoices.overdueStored));
    await row.getByRole("button", { name: "Kirim pengingat" }).click();
    expect((await sharePost).ok()).toBe(true);

    const fallback = row.getByRole("link", { name: "Buka WhatsApp" });
    await expect(fallback).toBeVisible();
    expect(await fallback.getAttribute("target")).toBe("_blank");
    const { number, text } = parseWhatsAppLink((await fallback.getAttribute("href"))!);
    expect(number).toBe("628110000008");
    expect(text).toContain("E2E/OVERDUE/003");
    expect(text).toContain("sudah melewati jatuh tempo");
    // The fallback is clickable and leads to the same link (stubbed locally).
    const [popup] = await Promise.all([page.waitForEvent("popup"), fallback.click()]);
    await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/628110000008\?text=/);
    await popup.close();
  });
});
