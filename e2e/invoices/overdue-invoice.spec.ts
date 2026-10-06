// Real-interaction coverage for an overdue invoice on its detail page
// (docs/testing/journey-coverage.json: INV-STATUS-06): the reminder uses the
// chase template, and "Tandai lunas" moves it to Lunas everywhere and
// survives a reload.
//
// Uses the follow-up overlay's invoice that is *stored* as OVERDUE and due 5
// Jakarta days ago (applyFollowUpStates(), e2e/support/reseed.ts). That is
// the state whose only status action is "Tandai lunas"
// (NEXT_ACTIONS.OVERDUE in invoice-detail-client.tsx); a SENT invoice that is
// merely past due also shows "Tandai jatuh tempo". This test does not touch
// "Tandai terlambat" or status derivation (FIND-01 stays open).
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

  // FIND-04 (expected failure, never counted as coverage): sendWhatsApp()
  // in invoice-detail-client.tsx treats a null window.open() as "blocked",
  // but window.open(href, "_blank", "noopener,noreferrer") returns null by
  // spec even when the chat opened, so the fallback link always appears.
  // Same defect as the Beranda queue row (follow-up-queue.spec.ts). Remove
  // test.fail() when fixed.
  test("after the reminder popup opens, invoice detail shows no blocked-popup fallback", async ({ page, context }) => {
    test.fail(true, "FIND-04: window.open() with noopener always returns null, so the blocked-popup fallback always shows");
    const { followUp } = loadFixtureManifest();
    await keepWhatsAppLocal(context);

    await page.goto("/");
    await followUpRowLink(page, followUp.brands[followUp.deals.overdueStored]).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${followUp.invoices.overdueStored}$`));
    const remind = page.getByRole("button", { name: "Kirim pengingat" });
    await expect(remind).toBeEnabled();
    const [popup] = await Promise.all([page.waitForEvent("popup"), remind.click()]);
    await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/628110000008\?text=/);
    await popup.close();
    await expect(remind).toBeEnabled();
    await expect(page.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0, { timeout: 2_000 });
  });
});
