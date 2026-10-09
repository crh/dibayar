// Real-interaction coverage for an overdue invoice on its detail page
// (docs/testing/journey-coverage.json: INV-STATUS-06): the reminder uses the
// chase template, and "Tandai lunas" moves it to Lunas everywhere and
// survives a reload.
//
// Uses the follow-up overlay's invoice that is *stored* as OVERDUE and due 5
// Jakarta days ago (applyFollowUpStates(), e2e/support/reseed.ts). That is
// Its only status action is "Tandai lunas", as for every invoice shown as
// overdue; stored SENT/DUE invoices that are past due are covered by
// status-consistency.spec.ts.
//
// WhatsApp never leaves the machine (keepWhatsAppLocal()).
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
  trackOpenedPages,
} from "../support/follow-up";

const NBSP = " ";

function isInvoicePatch(invoiceId: string) {
  return (response: { request(): { method(): string }; url(): string }) =>
    response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${invoiceId}`;
}

test.describe("overdue invoice", { tag: "@critical" }, () => {
  let overlayDay = "";
  test.beforeEach(() => {
    overlayDay = jakartaToday();
    applyFollowUpStates();
  });
  test.afterEach(reseedFixtures);

  test("an overdue invoice sends the chase reminder, then Tandai lunas persists across detail, list and Beranda", async ({ page, context }) => {
    const { followUp } = loadFixtureManifest();
    const invoiceId = followUp.invoices.overdueStored;
    const brand = followUp.brands[followUp.deals.overdueStored];
    const dueText = shortIdDate(addCalendarDays(overlayDay, followUp.dueOffsetDays.overdueStored));
    await keepWhatsAppLocal(context);

    // In from the invoice list, the way a person finds it.
    await page.goto("/");
    await primaryNav(page).getByRole("link", { name: "Invoice" }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await expect(page.getByRole("region", { name: "Terlambat" }).getByRole("link", { name: new RegExp(brand) })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(brand) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${invoiceId}$`));

    // Overdue state: chip, due line, the reminder (not the first-send
    // action) and only "Tandai lunas" as the status action.
    await expect(page.getByRole("heading", { name: `Rp${NBSP}8.000.000` })).toBeVisible();
    await expect(page.getByText("Terlambat", { exact: true })).toBeVisible();
    await expect(page.getByText(`Jatuh tempo: ${dueText}`)).toBeVisible();
    const remind = page.getByRole("button", { name: "Kirim pengingat" });
    await expect(remind).toBeEnabled();
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tandai lunas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tandai jatuh tempo" })).toHaveCount(0);

    // Kirim pengingat: the Settings chase template (the fixture owner has
    // none saved, so the default chase text), filled with this invoice.
    const [popup] = await Promise.all([page.waitForEvent("popup"), remind.click()]);
    await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\//);
    const { number, text } = parseWhatsAppLink(popup.url());
    await popup.close();
    expect(number).toBe("628110000008");
    const origin = new URL(page.url()).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(text).toMatch(new RegExp(
      `^Halo ${brand}, izin mengingatkan invoice E2E/OVERDUE/003 sebesar Rp${NBSP}8\\.000\\.000 yang jatuh tempo ${dueText}\\.\\n`
      + `Mohon dibantu prosesnya ya\\. Detail: ${origin}/i/[A-Za-z0-9_-]{40,}\\nTerima kasih!$`,
    ));

    // Tandai lunas.
    const patch = page.waitForResponse(isInvoicePatch(invoiceId));
    await page.getByRole("button", { name: "Tandai lunas" }).click();
    expect((await patch).ok()).toBe(true);
    await expect(page.getByRole("status").filter({ hasText: "Lunas — invoice ini sudah selesai." })).toBeVisible();

    async function expectPaidDetail() {
      await expect(page.getByText("Lunas ✓", { exact: true })).toBeVisible();
      await expect(page.getByText("Terlambat", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Batalkan status lunas" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Tandai lunas" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Kirim pengingat" })).toHaveCount(0);
    }
    await expectPaidDetail();
    await page.reload();
    await expectPaidDetail();

    // The list agrees after navigating there...
    await primaryNav(page).getByRole("link", { name: "Invoice" }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await expect(page.getByRole("region", { name: "Lunas" }).getByRole("link", { name: new RegExp(brand) })).toBeVisible();
    // Only there: not also left behind in another group.
    await expect(page.getByRole("link", { name: new RegExp(brand) })).toHaveCount(1);

    // ...and Beranda no longer asks to chase it, while the others remain.
    await primaryNav(page).getByRole("link", { name: "Beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(followUpRow(page, followUp.brands[followUp.deals.overdueSent])).toBeVisible();
    await expect(followUpQueue(page)).not.toContainText(brand);
    expectSameJakartaDay(overlayDay);
  });

  // FIND-04 regression (fixed in fix/whatsapp-popup-fallback-2026-10-05):
  // sendWhatsApp() in invoice-detail-client.tsx used to call
  // window.open(href, "_blank", "noopener,noreferrer"), which returns null by
  // spec even when the chat opened, so the "blocked" fallback always
  // appeared. Same fix and checks as the Beranda queue row
  // (follow-up-queue.spec.ts).
  test("after the reminder popup opens, invoice detail shows no blocked-popup fallback", async ({ page, context }) => {
    const { followUp } = loadFixtureManifest();
    const whatsApp = await keepWhatsAppLocal(context);

    await page.goto("/");
    await followUpRowLink(page, followUp.brands[followUp.deals.overdueStored]).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${followUp.invoices.overdueStored}$`));
    const remind = page.getByRole("button", { name: "Kirim pengingat" });
    await expect(remind).toBeEnabled();
    const opened = trackOpenedPages(context);
    const [popup] = await Promise.all([page.waitForEvent("popup"), remind.click()]);
    await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/628110000008\?text=/);
    expect(parseWhatsAppLink(popup.url()).text).toContain("izin mengingatkan invoice E2E/OVERDUE/003");
    // The send finished, and since the popup opened there is no fallback.
    await expect(remind).toBeEnabled();
    await expect(page.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0);
    // Exactly one tab, one request to WhatsApp, no Referer, no opener.
    expect(opened).toEqual([popup]);
    expect(whatsApp.map((request) => request.url)).toEqual([popup.url()]);
    expect(whatsApp[0].referer).toBeNull();
    expect(await popup.evaluate(() => window.opener === null)).toBe(true);
    await popup.close();
  });
});
