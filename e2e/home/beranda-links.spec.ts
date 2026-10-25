// Real-interaction coverage for the links out of Beranda
// (docs/testing/journey-coverage.json): a follow-up row to its invoice
// (HOME-05), a "3 deal terdekat" row to its deal (HOME-06), and the two
// "Lihat semua" links (HOME-07).
//
// Which invoices the queue lists, and in what order, is HOME-02
// (follow-up-queue.spec.ts). This file is about where each link goes: every
// row is opened and checked against that row's own invoice or deal, so a
// link wired to the wrong record fails, and Back, Forward and a reload are
// walked across each.
//
// Runs on the follow-up overlay (the base seed's queue is empty) and reseeds
// afterwards, like every overlay spec.
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { expectSameJakartaDay, followUpQueue, followUpRowLink, jakartaToday } from "../support/follow-up";

const NBSP = " ";

test.describe("links out of Beranda", { tag: "@critical" }, () => {
  let overlayDay = "";
  test.beforeEach(() => {
    overlayDay = jakartaToday();
    applyFollowUpStates();
  });
  test.afterEach(reseedFixtures);

  test("every follow-up row opens its own invoice, and Back returns to the queue", async ({ page }) => {
    const { followUp } = loadFixtureManifest();
    // Queue order (HOME-02). Number and amount are each invoice's own.
    const rows = [
      { key: "overdueSent", number: "E2E/OVERDUE/004", amount: `Rp${NBSP}9.000.000` },
      { key: "overdueStored", number: "E2E/OVERDUE/003", amount: `Rp${NBSP}8.000.000` },
      { key: "dueToday", number: "E2E/DUE/005", amount: `Rp${NBSP}1.100.000` },
      { key: "dueWindowEdge", number: "E2E/DUE/006", amount: `Rp${NBSP}1.200.000` },
    ] as const;

    await page.goto("/");
    await expect(followUpQueue(page).getByRole("listitem")).toHaveCount(rows.length);

    for (const row of rows) {
      const brand = followUp.brands[followUp.deals[row.key]];
      const invoiceUrl = new RegExp(`/invoice/${followUp.invoices[row.key]}$`);

      await followUpRowLink(page, brand).click();
      await expect(page).toHaveURL(invoiceUrl);
      // That invoice, not a neighbour: its own number and its own amount
      // (invoice detail does not print the brand).
      await expect(page.getByRole("main").getByText(row.number, { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: row.amount })).toBeVisible();
      // Settled (contact and share fetched) before leaving the page.
      await expect(page.getByRole("button", { name: /^Kirim (pengingat|lewat WhatsApp)$/ })).toBeEnabled();

      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
      await expect(followUpQueue(page).getByRole("listitem")).toHaveCount(rows.length);
    }

    // Forward returns to the last invoice opened, and it survives a reload.
    const last = rows[rows.length - 1];
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/invoice/${followUp.invoices[last.key]}$`));
    await expect(page.getByRole("heading", { name: last.amount })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Kirim (pengingat|lewat WhatsApp)$/ })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole("heading", { name: last.amount })).toBeVisible();
    expectSameJakartaDay(overlayDay);
  });

  test("every deal terdekat row opens its own deal, and Back returns to Beranda", async ({ page }) => {
    const { brands, followUp } = loadFixtureManifest();
    const dealIdByBrand = new Map<string, string>();
    for (const [id, brand] of [...Object.entries(brands), ...Object.entries(followUp.brands)]) dealIdByBrand.set(brand, id);

    await page.goto("/");
    const section = page.getByRole("region", { name: "3 deal terdekat" });
    const rowLinks = section.getByRole("listitem").getByRole("link");
    await expect(rowLinks).toHaveCount(3);

    // Which three deals are nearest is unit-tested (nearest-deals.test.tsx);
    // here each listed row is read, opened and compared with the deal it names.
    const listed: Array<{ brand: string; dealId: string }> = [];
    for (let index = 0; index < 3; index += 1) {
      const brand = (await rowLinks.nth(index).locator("p").first().innerText()).trim();
      const dealId = dealIdByBrand.get(brand);
      expect(dealId, `row ${index + 1} names a fixture deal ("${brand}")`).toBeTruthy();
      listed.push({ brand, dealId: dealId! });
    }
    expect(new Set(listed.map((row) => row.dealId)).size).toBe(3);

    for (const { brand, dealId } of listed) {
      await section.getByRole("link", { name: new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) }).click();
      await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));
      await expect(page.getByRole("heading", { level: 1, name: brand, exact: true })).toBeVisible();

      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
      await expect(rowLinks).toHaveCount(3);
    }

    // Forward returns to the last deal opened, and it survives a reload.
    const last = listed[listed.length - 1];
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/deal/${last.dealId}$`));
    await expect(page.getByRole("heading", { level: 1, name: last.brand, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: last.brand, exact: true })).toBeVisible();
  });

  test("Lihat semua opens the invoice list from Perlu dikejar and the deal board from 3 deal terdekat", async ({ page }) => {
    const { followUp } = loadFixtureManifest();
    const overdueBrand = followUp.brands[followUp.deals.overdueSent];
    const beranda = page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" });

    await page.goto("/");
    await expect(beranda).toBeVisible();

    // Perlu dikejar -> the invoice list, where the queue's invoices are.
    await followUpQueue(page).getByRole("link", { name: "Lihat semua →" }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Terlambat" }).getByRole("link", { name: new RegExp(overdueBrand) })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/invoice$/);
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(beranda).toBeVisible();

    // 3 deal terdekat -> the deal board, unfiltered.
    await page.getByRole("region", { name: "3 deal terdekat" }).getByRole("link", { name: "Lihat semua →" }).click();
    await expect(page).toHaveURL(/\/deal$/);
    const stageFilter = page.getByRole("group", { name: /filter tahap deal/i });
    await expect(stageFilter).toBeVisible();
    await expect(page.locator("article", { hasText: overdueBrand })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(stageFilter).toBeVisible();

    // Back is Beranda, Forward the board again.
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(beranda).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(stageFilter).toBeVisible();
  });
});
