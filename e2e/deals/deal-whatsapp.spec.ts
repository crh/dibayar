// Real-interaction coverage for opening WhatsApp from deal detail
// (docs/testing/journey-coverage.json: DEAL-DETAIL-04).
//
// Buka WhatsApp must open exactly one chat, addressed to the deal's own
// number, with no prefilled message and no Referer, and leave the deal page
// as it was. WhatsApp never leaves the machine (keepWhatsAppLocal()): the
// chat is a local stub at the exact wa.me address the app built. The
// WhatsApp app itself and a real phone's hand-off stay MAN-WA-01.
//
// A base-seed deal, reached the way a person reaches it (board card -> menu
// -> Lihat detail). Nothing is stored, so there is no reseed.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { keepWhatsAppLocal, trackOpenedPages } from "../support/follow-up";
import { press } from "../support/journey";

async function openDealFromBoard(page: Page, brand: string, dealId: string, isMobile: boolean) {
  await page.goto("/deal");
  const card = page.locator("article", { hasText: brand });
  await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
  await press(page.getByRole("menuitem", { name: "Lihat detail" }), isMobile);
  await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
  await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
}

test.describe("WhatsApp from deal detail", { tag: "@critical" }, () => {
  test("Buka WhatsApp on deal detail opens one chat with the deal's own number", async ({ page, context, isMobile }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.nego;
    const brand = manifest.brands[dealId];
    const requests = await keepWhatsAppLocal(context);
    await openDealFromBoard(page, brand, dealId, isMobile);
    await expect(page.getByText("+62 811-0000-002", { exact: true })).toBeVisible();

    const opened = trackOpenedPages(context);
    const button = page.getByRole("button", { name: "Buka WhatsApp" });
    const [chat] = await Promise.all([context.waitForEvent("page"), press(button, isMobile)]);
    // The seeded number (scripts/e2e-fixtures.ts), with no prefilled message.
    await expect.poll(() => chat.url()).toBe("https://wa.me/628110000002");
    await expect(chat.getByText("E2E stub: no message was sent.")).toBeVisible();

    // One tab, one request, nothing that tells WhatsApp where it came from.
    expect(opened).toEqual([chat]);
    expect(requests.map((request) => request.url)).toEqual(["https://wa.me/628110000002"]);
    // No Referer header, or (WebKit) an empty one: either way no address.
    expect(requests[0].referer ?? "", "the request names no referring page").toBe("");
    expect(await chat.evaluate(() => window.opener === null), "the chat cannot reach back into the app").toBe(true);
    await chat.close();

    // The deal page is where it was: no repair form, no error, same deal.
    await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
    await expect(page.getByLabel("Perbaiki nomor WhatsApp")).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: "Nomor WhatsApp belum valid" })).toHaveCount(0);
    await expect(button).toBeEnabled();
  });
});
