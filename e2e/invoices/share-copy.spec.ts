// Real-interaction coverage for copying an invoice share link
// (docs/testing/journey-coverage.json: SHARE-05). Desktop Chromium only:
// it is the one project where Playwright can grant clipboard access and
// read it back. Phones stay a manual check (MAN-SHARE-01).
//
// The happy path clicks the visible "Salin" control, then reads the real
// system clipboard and requires the exact public link for the seeded share:
// this page's own origin + /i/<the seeded active token> -- not just the
// toast. Clipboard permissions are granted only to this test's context, and
// only for the app's own origin. The token is a synthetic fixture value and
// is never printed.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";

test.describe("copy share link", { tag: "@critical" }, () => {
  // Read-only: copying changes nothing on the server, so no reseed.

  test("Salin copies the exact public invoice link to the clipboard and confirms it", async ({ page, context, browserName, isMobile }) => {
    test.skip(browserName !== "chromium" || isMobile === true, "clipboard read-back needs Chromium's clipboard permissions; phones are MAN-SHARE-01");
    const manifest = loadFixtureManifest();

    await page.goto("/invoice");
    await page.getByRole("link", { name: new RegExp(manifest.brands[manifest.deals.invoiceSent]) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${manifest.invoices.sent}$`));
    const origin = new URL(page.url()).origin;
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    // Start from a known value, so a stale clipboard can't satisfy the check.
    await page.evaluate(() => navigator.clipboard.writeText("before-copy"));

    const expectedLink = `${origin}/i/${manifest.shareTokens.active}`;
    const copyButton = page.getByRole("button", { name: "Salin tautan invoice" });
    await expect(copyButton).toHaveText("Salin");
    await copyButton.click();

    await expect(copyButton).toHaveText("Tersalin");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // Compared as booleans so a mismatch never prints the token.
    expect(copied === expectedLink, "clipboard holds this invoice's public link").toBe(true);
    expect(copied === (await page.getByTestId("share-link-track").locator("span[title]").getAttribute("title")), "clipboard matches the link shown in the field").toBe(true);
    // Only the copy error; Next's route announcer is also an alert after a client navigation.
    await expect(page.getByRole("alert").filter({ hasText: "Gagal menyalin" })).toHaveCount(0);
    await expect(page.getByTestId("share-link-manual-copy")).toHaveCount(0);

    // The feedback is temporary (2s, share-link-field.tsx COPY_SUCCESS_MS).
    await expect(copyButton).toHaveText("Salin", { timeout: 5_000 });
  });

  test("when the browser refuses the copy, Salin shows the manual-copy fallback with the full link", async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== "chromium" || isMobile === true, "paired with the desktop Chromium copy journey above");
    const manifest = loadFixtureManifest();
    // Same idea as the blocked-WhatsApp-popup test in invoice-journeys.spec.ts:
    // the app's failure signal is writeText() rejecting, which is what a
    // denied clipboard produces, so it is stubbed to reject. The click is real.
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable: true,
        value: () => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")),
      });
    });

    await page.goto(`/invoice/${manifest.invoices.sent}`);
    const origin = new URL(page.url()).origin;
    const copyButton = page.getByRole("button", { name: "Salin tautan invoice" });
    await copyButton.click();

    await expect(page.getByRole("alert").filter({ hasText: "Gagal menyalin" })).toHaveText("Gagal menyalin. Tekan lama untuk salin manual.");
    await expect(copyButton).toHaveText("Salin");
    const manual = page.getByTestId("share-link-manual-copy");
    await expect(manual).toBeVisible();
    expect((await manual.inputValue()) === `${origin}/i/${manifest.shareTokens.active}`, "fallback field holds this invoice's public link").toBe(true);
  });
});
