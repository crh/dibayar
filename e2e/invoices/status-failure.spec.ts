// Coverage for a failed invoice status update
// (docs/testing/journey-coverage.json: INV-STATUS-07).
//
// Two ways the update fails:
//
// - For real: the invoice is open in two tabs. One marks it paid; the other,
//   still showing "Terkirim", presses Tandai jatuh tempo. PAID -> DUE is not
//   an allowed move, so the server answers 409 itself. Nothing is stubbed.
// - Injected: the next status PATCH is answered with a 409 by page.route
//   before it reaches the server, the way the due-date failure tests do it.
//   The click and everything the page then shows are real; the failure is a
//   stub, so by the inventory's rules this test is partial evidence.
//
// In both, the page must say the change did not happen, keep the status it
// showed, offer the same actions again, and a reload must show what the
// server really holds.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { E2E_FIXTURE_PREFIX } from "../support/fixture-ids";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";
import { press, responseTo } from "../support/journey";

const STATUS_ERROR = "Status invoice belum bisa diperbarui.";

function chip(page: Page, label: string) {
  return page.getByRole("main").locator("header").first().getByText(label, { exact: true });
}

function action(page: Page, name: string) {
  return page.getByRole("region", { name: "Status pembayaran" }).getByRole("button", { name, exact: true });
}

async function openSentInvoiceFromList(page: Page, isMobile: boolean) {
  const { invoices, brands, deals } = loadFixtureManifest();
  await page.goto("/invoice");
  await press(page.getByRole("link", { name: new RegExp(brands[deals.invoiceSent]) }), isMobile);
  await expect(page).toHaveURL(new RegExp(`/invoice/${invoices.sent}$`));
  await expect(chip(page, "Terkirim")).toBeVisible();
  // Hydrated, and the page's own fetches have settled.
  await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
}

test.describe("failed invoice status update", { tag: "@critical" }, () => {
  test.use({ expectedErrorResponses: [{ method: "PATCH", pathname: `/api/invoices/${E2E_FIXTURE_PREFIX}-invoice-sent` }] });
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("a status change the server refuses (the invoice was paid in another tab) shows an error and changes nothing", async ({ page, context, isMobile }) => {
    const { invoices } = loadFixtureManifest();
    const path = `/api/invoices/${invoices.sent}`;
    await openSentInvoiceFromList(page, isMobile);

    // The same owner, in a second tab, marks it paid.
    const otherTab = await context.newPage();
    await openSentInvoiceFromList(otherTab, isMobile);
    const paid = await responseTo(otherTab, "PATCH", path, () => press(action(otherTab, "Tandai lunas"), isMobile));
    expect(paid.ok()).toBe(true);
    await expect(chip(otherTab, "Lunas ✓")).toBeVisible();
    await otherTab.close();

    // The first tab still shows what it loaded, and offers a move that is no
    // longer possible.
    await expect(chip(page, "Terkirim")).toBeVisible();
    const refused = await responseTo(page, "PATCH", path, () => press(action(page, "Tandai jatuh tempo"), isMobile));
    expect(refused.status()).toBe(409);

    const section = page.getByRole("region", { name: "Status pembayaran" });
    await expect(section.getByRole("alert").filter({ hasText: STATUS_ERROR })).toBeVisible();
    // No success in disguise: the chip did not move and the buttons are usable again.
    await expect(chip(page, "Terkirim")).toBeVisible();
    await expect(chip(page, "Jatuh tempo")).toHaveCount(0);
    await expect(page.getByText("Lunas — invoice ini sudah selesai.")).toHaveCount(0);
    await expect(action(page, "Tandai jatuh tempo")).toBeEnabled();
    await expect(action(page, "Tandai lunas")).toBeEnabled();

    // The refused change stored nothing: the invoice is what the other tab made it.
    await page.reload();
    await expect(chip(page, "Lunas ✓")).toBeVisible();
    await expect(chip(page, "Jatuh tempo")).toHaveCount(0);
    await expect(action(page, "Batalkan status lunas")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: STATUS_ERROR })).toHaveCount(0);
  });

  test("a failed Tandai lunas shows an error, keeps the status after a reload, and a second try works", async ({ page, isMobile }) => {
    const { invoices } = loadFixtureManifest();
    const path = `/api/invoices/${invoices.sent}`;
    await openSentInvoiceFromList(page, isMobile);

    // Only the next status PATCH fails, and it never reaches the server.
    let armed = true;
    await page.route(`**${path}`, async (route) => {
      if (armed && route.request().method() === "PATCH") {
        armed = false;
        await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "simulated failure" }) });
        return;
      }
      await route.fallback();
    });

    const failed = await responseTo(page, "PATCH", path, () => press(action(page, "Tandai lunas"), isMobile));
    expect(failed.status()).toBe(409);
    const section = page.getByRole("region", { name: "Status pembayaran" });
    await expect(section.getByRole("alert").filter({ hasText: STATUS_ERROR })).toBeVisible();
    await expect(chip(page, "Terkirim")).toBeVisible();
    await expect(chip(page, "Lunas ✓")).toHaveCount(0);
    await expect(page.getByText("Lunas — invoice ini sudah selesai.")).toHaveCount(0);
    await expect(action(page, "Tandai lunas")).toBeEnabled();
    await expect(action(page, "Batalkan status lunas")).toHaveCount(0);
    // page.request is not intercepted by page.route: this is the stored row.
    expect((await (await page.request.get(path)).json()).invoice.status).toBe("SENT");

    await page.reload();
    await expect(chip(page, "Terkirim")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: STATUS_ERROR })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();

    // The second try reaches the server; the error goes away.
    const retried = await responseTo(page, "PATCH", path, () => press(action(page, "Tandai lunas"), isMobile));
    expect(retried.ok()).toBe(true);
    await expect(chip(page, "Lunas ✓")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: STATUS_ERROR })).toHaveCount(0);
    await page.reload();
    await expect(chip(page, "Lunas ✓")).toBeVisible();
  });
});
