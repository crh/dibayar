// WhatsApp hand-off with a real popup blocker (FIND-04): INV-WA-02 on invoice
// detail and the blocked-popup alternate of HOME-03 on the Beranda queue
// (docs/testing/journey-coverage.json).
//
// Nothing in the page is stubbed. Chromium runs with its own
// --block-new-web-contents switch, which makes the browser refuse every new
// window, so window.open() comes back null from the browser itself -- the
// same outcome as a popup blocker or an in-app browser that allows no new
// windows. The click is a real click and the app's detection is the real
// one (src/lib/whatsapp-popup.ts). Before the FIND-04 fix these checks could
// not tell a block from a successful open; the "popup opened -> no fallback"
// half lives in home/follow-up-queue.spec.ts and invoices/overdue-invoice.spec.ts.
//
// Chromium only: the switch is Chromium's. The same switch also blocks the
// fallback link's own target=_blank tab, so following the fallback is left
// to the stubbed-blocker tests (invoices/invoice-journeys.spec.ts and
// home/follow-up-queue.spec.ts), which run in every engine. A real phone's
// blocker and the WhatsApp app itself stay manual (MAN-WA-01).
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { primaryNav } from "../support/nav";
import { followUpRow, keepWhatsAppLocal, parseWhatsAppLink, trackOpenedPages } from "../support/follow-up";

// The queue asks for the invoice's existing link (POST .../share/ensure),
// never the rotating POST .../share (FIND-05).
function isShareEnsurePost(invoiceId: string) {
  return (response: { request(): { method(): string }; url(): string }) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === `/api/invoices/${invoiceId}/share/ensure`;
}

// Top level: launchOptions can only be set per file (it needs its own worker).
test.use({ launchOptions: { args: ["--block-new-web-contents"] } });

test.describe("WhatsApp when the browser blocks new windows", { tag: "@critical" }, () => {
  test.skip(({ browserName }) => browserName !== "chromium", "--block-new-web-contents is a Chromium switch");
  test.afterEach(reseedFixtures);

  test("invoice detail: Kirim lewat WhatsApp shows a Buka WhatsApp link and opens nothing", async ({ page, context }) => {
    reseedFixtures();
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoiceSent];
    const whatsApp = await keepWhatsAppLocal(context);

    // In from Beranda and the invoice list, the way a person gets there.
    await page.goto("/");
    await primaryNav(page).getByRole("link", { name: "Invoice" }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await page.getByRole("link", { name: new RegExp(brand) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${manifest.invoices.sent}$`));

    const action = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
    await expect(action).toBeEnabled();
    await expect(page.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0);
    const opened = trackOpenedPages(context);
    // window.open runs inside the click, before the page asks the server
    // for the link to send (POST .../share/ensure reuses the seeded one).
    await action.click();

    const fallback = page.getByRole("link", { name: "Buka WhatsApp" });
    await expect(fallback).toBeVisible();
    await expect(action).toBeEnabled();
    const { number, text } = parseWhatsAppLink((await fallback.getAttribute("href"))!);
    expect(number).toBe("628110000006");
    expect(text).toContain("E2E/SENT/001");
    expect(text).toContain(`${new URL(page.url()).origin}/i/`);
    expect(await fallback.getAttribute("target")).toBe("_blank");
    expect(await fallback.getAttribute("rel")).toBe("noopener noreferrer");
    // The browser opened nothing and nothing was asked of WhatsApp.
    expect(opened).toHaveLength(0);
    expect(whatsApp).toHaveLength(0);
  });

  test("Beranda: Kirim pengingat on a queue row shows a Buka WhatsApp link and opens nothing", async ({ page, context }) => {
    applyFollowUpStates();
    const { followUp } = loadFixtureManifest();
    const row = followUpRow(page, followUp.brands[followUp.deals.overdueStored]);
    const whatsApp = await keepWhatsAppLocal(context);

    await page.goto("/");
    await expect(row).toContainText("Telat 5 hari");
    await expect(row.getByRole("link", { name: "Buka WhatsApp" })).toHaveCount(0);
    const opened = trackOpenedPages(context);
    const sharePost = page.waitForResponse(isShareEnsurePost(followUp.invoices.overdueStored));
    await row.getByRole("button", { name: "Kirim pengingat" }).click();
    expect((await sharePost).ok()).toBe(true);

    const fallback = row.getByRole("link", { name: "Buka WhatsApp" });
    await expect(fallback).toBeVisible();
    await expect(row.getByRole("alert")).toHaveCount(0);
    const { number, text } = parseWhatsAppLink((await fallback.getAttribute("href"))!);
    expect(number).toBe("628110000008");
    expect(text).toContain("E2E/OVERDUE/003");
    expect(text).toContain("sudah melewati jatuh tempo");
    expect(await fallback.getAttribute("target")).toBe("_blank");
    expect(opened).toHaveLength(0);
    expect(whatsApp).toHaveLength(0);
  });
});
