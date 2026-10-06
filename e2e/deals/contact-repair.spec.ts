// Real-interaction coverage for repairing a deal's invalid WhatsApp number on
// deal detail (docs/testing/journey-coverage.json: DEAL-DETAIL-03).
//
// Uses the follow-up overlay's deal whose stored number is "12345678"
// (applyFollowUpStates(), e2e/support/reseed.ts): the API accepts it, but
// normalizeWhatsAppNumber() rejects it, so "Buka WhatsApp" must offer the
// repair form instead of opening a chat. After the repair, a reload proves
// the number was saved, and the next "Buka WhatsApp" opens a chat with
// exactly that number. WhatsApp never leaves the machine (keepWhatsAppLocal()).
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { keepWhatsAppLocal } from "../support/follow-up";

function isDealPatch(dealId: string) {
  return (response: { request(): { method(): string }; url(): string }) =>
    response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/deals/${dealId}`;
}

test.describe("deal WhatsApp number repair", { tag: "@critical" }, () => {
  test.beforeEach(applyFollowUpStates);
  test.afterEach(reseedFixtures);

  test("an invalid number opens the repair form; the repaired number is saved, survives reload, and is used by Buka WhatsApp", async ({ page, context }) => {
    const { followUp } = loadFixtureManifest();
    const dealId = followUp.deals.invalidContact;
    const brand = followUp.brands[dealId];
    await keepWhatsAppLocal(context);
    let popups = 0;
    page.on("popup", () => {
      popups += 1;
    });

    // Board card -> menu -> Lihat detail, as a person gets there.
    await page.goto("/deal");
    await page.locator("article", { hasText: brand }).getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    await page.getByRole("menuitem", { name: "Lihat detail" }).click();
    await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
    await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
    const contact = page.locator("dt", { hasText: /^Kontak WhatsApp$/ }).locator("xpath=following-sibling::dd[1]");
    await expect(contact).toHaveText("+123-456-78");

    // The button is not disabled; activating it explains and offers the fix
    // instead of opening a chat with an unusable number.
    const repairField = page.getByLabel("Perbaiki nomor WhatsApp");
    await expect(repairField).toHaveCount(0);
    await page.getByRole("button", { name: "Buka WhatsApp" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Nomor WhatsApp belum valid" })).toBeVisible();
    await expect(repairField).toBeFocused();
    await expect(repairField).toHaveValue(followUp.invalidContactWa);
    expect(popups, "no chat opens for an invalid number").toBe(0);

    // Type a local-format number and save it.
    await repairField.fill("0812-3456-7890");
    const patch = page.waitForResponse(isDealPatch(dealId));
    await page.getByRole("button", { name: "Simpan nomor" }).click();
    expect((await patch).ok()).toBe(true);
    await expect(page.getByRole("status").filter({ hasText: "Nomor WhatsApp disimpan" })).toBeVisible();
    // Stored normalized (62...), shown formatted, and the form is gone.
    await expect(contact).toHaveText("+62 812-3456-7890");
    await expect(repairField).toHaveCount(0);
    expect(popups, "saving the number does not open a chat by itself").toBe(0);

    await page.reload();
    await expect(contact).toHaveText("+62 812-3456-7890");
    await expect(page.getByRole("alert").filter({ hasText: "Nomor WhatsApp belum valid" })).toHaveCount(0);

    // The next action uses the saved number.
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Buka WhatsApp" }).click(),
    ]);
    await expect.poll(() => popup.url()).toBe("https://wa.me/6281234567890");
    await popup.close();
    await expect(repairField).toHaveCount(0);
  });
});
