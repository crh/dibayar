// Real-interaction coverage for "the due date reads the same everywhere"
// (docs/testing/journey-coverage.json: INV-DUE-05).
//
// The only earlier evidence was unit tests of the date logic. Here a due date
// is typed into the invoice's field with the keyboard (the path INV-DUE-04
// already proves; desktop Chromium only -- a phone has no segment keyboard
// and the native picker cannot be driven), and the same calendar date is then
// read back from every place a person meets it: the invoice header and field,
// the invoice list, the Beranda queue row with its "N hari lagi" count, the
// WhatsApp messages sent from the invoice page and from Beranda.
//
// Not checked here: the recipient's page and PDF. They print the due date
// only when the deal has payment terms (buildInvoiceDocumentModel, pinned by
// model.test.ts), and this fixture deal has none. Where they do print it,
// invoices/pdf-download.spec.ts checks it.
//
// A due date is a calendar date with no time of day (stored as UTC midnight),
// and "N hari lagi" counts Asia/Jakarta days. The classic mistake is to
// format or count it in the viewer's own timezone. So the journey runs twice:
// once in the suite's Asia/Jakarta browser, and once in a Pacific/Honolulu
// browser (UTC-10, 17 hours behind Jakarta: its calendar date is a day behind
// Jakarta's for most of the day, and UTC midnight falls on the previous
// afternoon there). An owner travelling abroad must still see the Jakarta
// date and count. The typed date is three Jakarta days ahead, so both the
// date and the count are checked.
//
// Runs on the follow-up overlay. WhatsApp never leaves the machine.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { applyFollowUpStates, reseedFixtures } from "../support/reseed";
import {
  addCalendarDays,
  expectSameJakartaDay,
  followUpRow,
  followUpRowLink,
  jakartaToday,
  keepWhatsAppLocal,
  parseWhatsAppLink,
  shortIdDate,
} from "../support/follow-up";
import { DUE_DATE_FIELD_LABEL, focusFieldForTyping, visibleDisplay } from "../support/due-date";

const NBSP = " ";
const INVOICE_NUMBER = "E2E/DUE/005";
// The digits a person types into the date field's segments: month, day,
// year in this suite's id-ID Chromium (see due-date-integrity.spec.ts).
function segmentDigits(calendarDate: string): string {
  const [year, month, day] = calendarDate.split("-");
  return `${month}${day}${year}`;
}

async function sentMessage(page: Page, action: ReturnType<Page["getByRole"]>) {
  await expect(action).toBeEnabled();
  const [popup] = await Promise.all([page.waitForEvent("popup"), action.click()]);
  await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\//);
  const { text } = parseWhatsAppLink(popup.url());
  await popup.close();
  return text ?? "";
}

for (const timezoneId of ["Asia/Jakarta", "Pacific/Honolulu"]) {
  test.describe(`due date consistency (browser in ${timezoneId})`, { tag: "@critical" }, () => {
    test.use({ timezoneId });
    test.afterEach(reseedFixtures);

    test(`a typed due date reads as the same Jakarta calendar date on detail, list, Beranda and WhatsApp (${timezoneId})`, async ({ page, context }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path (INV-DUE-04)");
      const overlayDay = jakartaToday();
      applyFollowUpStates();
      const { followUp } = loadFixtureManifest();
      const invoiceId = followUp.invoices.dueToday;
      const brand = followUp.brands[followUp.deals.dueToday];
      const before = addCalendarDays(overlayDay, followUp.dueOffsetDays.dueToday);
      const target = addCalendarDays(overlayDay, 3);
      const short = shortIdDate(target);
      await keepWhatsAppLocal(context);

      // The browser really is where the describe says, so its own calendar
      // date can differ from Jakarta's.
      expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(timezoneId);

      // In from the Beranda row, which starts as "due today".
      await page.goto("/");
      await expect(followUpRow(page, brand)).toContainText(`${shortIdDate(before)} · Jatuh tempo hari ini`);
      await followUpRowLink(page, brand).click();
      await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));
      await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
      await expect(page.getByText(`Jatuh tempo: ${shortIdDate(before)}`)).toBeVisible();

      // Type the new date and save it with Enter.
      const input = page.getByLabel(DUE_DATE_FIELD_LABEL);
      await focusFieldForTyping(page, visibleDisplay(page, shortIdDate(before)));
      await page.keyboard.type(segmentDigits(target), { delay: 30 });
      await expect(input).toHaveValue(target);
      const save = page.waitForResponse(
        (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${invoiceId}`,
      );
      await page.keyboard.press("Enter");
      expect((await save).ok()).toBe(true);

      // 1. Invoice detail: header and field, also after a reload.
      async function expectDetailShowsTarget() {
        await expect(page.getByText(`Jatuh tempo: ${short}`)).toBeVisible();
        await expect(visibleDisplay(page, short)).toBeVisible();
        await expect(input).toHaveValue(target);
        await expect(page.getByText(`Jatuh tempo: ${shortIdDate(before)}`)).toHaveCount(0);
      }
      await expectDetailShowsTarget();
      await page.reload();
      await expectDetailShowsTarget();

      // 2. The WhatsApp message sent from the invoice page (default send
      // template: "Jatuh tempo <date>.").
      const fromDetail = await sentMessage(page, page.getByRole("button", { name: "Kirim lewat WhatsApp" }));
      expect(fromDetail).toContain(`berikut invoice ${INVOICE_NUMBER} sebesar Rp${NBSP}1.100.000.`);
      expect(fromDetail.split("\n")).toContain(`Jatuh tempo ${short}.`);

      // 3. The invoice list row.
      await primaryNav(page).getByRole("link", { name: "Invoice", exact: true }).click();
      await expect(page).toHaveURL(/\/invoice$/);
      await expect(page.getByRole("link", { name: new RegExp(brand) })).toContainText(`${INVOICE_NUMBER} · ${short}`);

      // 4. The Beranda queue row: the same date, counted in Jakarta days.
      await primaryNav(page).getByRole("link", { name: "Beranda" }).click();
      await expect(page).toHaveURL(/\/$/);
      const row = followUpRow(page, brand);
      await expect(row).toContainText(`${short} · Jatuh tempo 3 hari lagi`);
      await expect(row).not.toContainText("Jatuh tempo hari ini");

      // 5. The reminder sent from that row.
      const fromBeranda = await sentMessage(page, row.getByRole("button", { name: "Kirim pengingat" }));
      expect(fromBeranda.split("\n")[0]).toBe(`Halo, ini pengingat invoice ${INVOICE_NUMBER} sebesar Rp${NBSP}1.100.000 yang jatuh tempo pada ${short}.`);

      expectSameJakartaDay(overlayDay);
    });
  });
}
