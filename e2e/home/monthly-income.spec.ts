// Real-interaction coverage for Beranda's "Net ditagihkan bulan ini" card
// (docs/testing/journey-coverage.json: HOME-01).
//
// Earlier evidence only checked that the heading renders; the amount was
// covered by unit tests of the calculation alone. This reads the amount a
// person sees and compares it with a total worked out here from the fixture's
// literal amounts -- not with the app's own summarizeMonthlyIncome().
//
// The base seed has two invoices created "now": SENT Rp 6.000.000 with PPh 21
// and PAID Rp 7.000.000 without withholding. The income overlay
// (applyIncomeBoundaries(), scripts/e2e-fixtures.ts) adds four on the rule's
// edges; only the one created at the first instant of this Jakarta month
// counts. The three that must not count are large enough that including any
// of them, or dropping the edge one, lands on a different figure:
//
//   draft (status)                     Rp 50.000.000   excluded
//   1 ms before this Jakarta month     Rp 40.000.000   excluded
//   first instant of this month, PPh23 Rp  2.000.000   included, net 1.960.000
//   first instant of next month        Rp 30.000.000   excluded
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { primaryNav } from "../support/nav";
import { applyIncomeBoundaries, reseedFixtures } from "../support/reseed";

const NBSP = " ";
const ID_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Net = subtotal minus estimated withholding (PPh 21 5%, PPh 23 2%).
const SENT_NET = 6_000_000 - 6_000_000 * 0.05; // 5.700.000
const PAID_NET = 7_000_000;
const MONTH_START_NET = 2_000_000 - 2_000_000 * 0.02; // 1.960.000
const BASE_SEED_NET = SENT_NET + PAID_NET; // 12.700.000
const WITH_BOUNDARIES_NET = BASE_SEED_NET + MONTH_START_NET; // 14.660.000

// "14660000" -> "Rp 14.660.000" with the app's non-breaking space (CLAUDE.md
// IDR rule), built by hand rather than with the app's formatter.
function rupiah(value: number): string {
  const digits = String(value);
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return `Rp${NBSP}${groups.join(".")}`;
}

function jakartaMonthLabel(): string {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date()).split("-").map(Number);
  return `${ID_MONTHS[month - 1]} ${year}`;
}

function incomeCard(page: Page) {
  return page.getByRole("region", { name: "Net ditagihkan bulan ini" });
}

async function expectMonthlyTotal(page: Page, net: number, monthLabel: string) {
  const card = incomeCard(page);
  // The card's one amount (MoneyDisplay renders a .ds-money span).
  const amount = card.locator(".ds-money");
  await expect(amount).toHaveCount(1);
  // toHaveText normalizes whitespace, so also check the exact characters.
  await expect(amount).toHaveText(rupiah(net));
  expect(await amount.textContent()).toBe(rupiah(net));
  // One paid invoice this month in both states (the seeded PAID one).
  await expect(card.getByTestId("home-income-subtitle")).toHaveText(`${monthLabel} · 1 invoice lunas`);
  await expect(card.getByRole("alert")).toHaveCount(0);
}

async function openBerandaThroughNav(page: Page) {
  await page.goto("/invoice");
  await primaryNav(page).getByRole("link", { name: "Beranda" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("Beranda monthly total", { tag: "@critical" }, () => {
  test.afterEach(reseedFixtures);

  test("the monthly card shows the net of this Jakarta month's non-draft invoices, and leaves out drafts and other months", async ({ page }) => {
    const monthLabel = jakartaMonthLabel();
    expect(rupiah(WITH_BOUNDARIES_NET)).toBe(`Rp${NBSP}14.660.000`);

    // The base seed alone first, so the overlay's effect is visible as a
    // change of exactly the one invoice that should count.
    reseedFixtures();
    await openBerandaThroughNav(page);
    await expectMonthlyTotal(page, BASE_SEED_NET, monthLabel);

    applyIncomeBoundaries();
    await page.reload();
    await expectMonthlyTotal(page, WITH_BOUNDARIES_NET, monthLabel);
    // And the same when arriving through the app rather than a reload.
    await openBerandaThroughNav(page);
    await expectMonthlyTotal(page, WITH_BOUNDARIES_NET, monthLabel);

    expect(jakartaMonthLabel(), "test crossed an Asia/Jakarta month boundary; the overlay's month edges no longer match").toBe(monthLabel);
  });
});
