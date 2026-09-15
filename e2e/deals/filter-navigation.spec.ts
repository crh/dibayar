// Highest-priority E2E suite (see docs/testing/E2E.md): real browser, real
// Next.js App Router, real DOM. Deliberately does NOT mock useSearchParams,
// next/navigation, window.history, or router.push -- the V3/V4 regressions
// this guards against were exactly bugs in how those four things agree with
// each other, which a mocked unit test cannot see.
import { expect, test } from "@playwright/test";
import { assertDealFilterState } from "../support/deal-filter";
import { loadFixtureManifest } from "../support/manifest";
import { watchForDealNavigationRequests } from "../support/network";

const allBrands = () => Object.values(loadFixtureManifest().brands);
const invoiceBrands = () => {
  const m = loadFixtureManifest();
  return [m.brands[m.deals.invoicePending], m.brands[m.deals.invoiceSent]];
};
const dibayarBrand = () => {
  const m = loadFixtureManifest();
  return [m.brands[m.deals.dibayar]];
};
const complement = (visible: string[]) => allBrands().filter((brand) => !visible.includes(brand));

test.describe("deal filter/navigation matrix", { tag: "@critical" }, () => {
  test("initial default: /deal shows Semua selected, no stage filter", async ({ page }) => {
    await page.goto("/deal");
    await assertDealFilterState(page, {
      tahap: null,
      pressedChip: "Semua",
      visibleBrands: allBrands(),
      hiddenBrands: [],
    });
  });

  test("deep link /deal?tahap=INVOICE selects Invoice and survives reload", async ({ page }) => {
    await page.goto("/deal?tahap=INVOICE");
    await assertDealFilterState(page, {
      tahap: "INVOICE",
      pressedChip: "Invoice",
      visibleBrands: invoiceBrands(),
      hiddenBrands: complement(invoiceBrands()),
    });

    await page.reload();
    await assertDealFilterState(page, {
      tahap: "INVOICE",
      pressedChip: "Invoice",
      visibleBrands: invoiceBrands(),
      hiddenBrands: complement(invoiceBrands()),
    });
  });

  test("invalid ?tahap value falls back to Semua without crashing", async ({ page }) => {
    await page.goto("/deal?tahap=NOT_A_REAL_STAGE");
    // Safe fallback: the client treats an unrecognized value as "no filter"
    // (isStageValue() in deal-stages.ts), so the board shows everything and
    // Semua reads as pressed -- it does not redirect or strip the URL.
    await assertDealFilterState(page, {
      tahap: "NOT_A_REAL_STAGE",
      pressedChip: "Semua",
      visibleBrands: allBrands(),
      hiddenBrands: [],
    });
  });

  test("chip navigation: Semua -> Invoice -> Dibayar -> Semua, invariant holds after every click", async ({ page }) => {
    await page.goto("/deal");
    const group = page.getByRole("group", { name: /filter tahap deal/i });

    await group.getByRole("button", { name: "Invoice", exact: true }).click();
    await assertDealFilterState(page, {
      tahap: "INVOICE",
      pressedChip: "Invoice",
      visibleBrands: invoiceBrands(),
      hiddenBrands: complement(invoiceBrands()),
    });

    await group.getByRole("button", { name: "Dibayar", exact: true }).click();
    await assertDealFilterState(page, {
      tahap: "DIBAYAR",
      pressedChip: "Dibayar",
      visibleBrands: dibayarBrand(),
      hiddenBrands: complement(dibayarBrand()),
    });

    await group.getByRole("button", { name: "Semua", exact: true }).click();
    await assertDealFilterState(page, {
      tahap: null,
      pressedChip: "Semua",
      visibleBrands: allBrands(),
      hiddenBrands: [],
    });
  });

  test("browser Back steps to the previous chip state", async ({ page }) => {
    await page.goto("/deal");
    const group = page.getByRole("group", { name: /filter tahap deal/i });
    await group.getByRole("button", { name: "Invoice", exact: true }).click();
    await group.getByRole("button", { name: "Dibayar", exact: true }).click();

    await page.goBack();
    await assertDealFilterState(page, {
      tahap: "INVOICE",
      pressedChip: "Invoice",
      visibleBrands: invoiceBrands(),
      hiddenBrands: complement(invoiceBrands()),
    });
  });

  test("browser Back then Forward returns to the later chip state", async ({ page }) => {
    await page.goto("/deal");
    const group = page.getByRole("group", { name: /filter tahap deal/i });
    await group.getByRole("button", { name: "Invoice", exact: true }).click();
    await group.getByRole("button", { name: "Dibayar", exact: true }).click();

    await page.goBack();
    await page.goForward();
    await assertDealFilterState(page, {
      tahap: "DIBAYAR",
      pressedChip: "Dibayar",
      visibleBrands: dibayarBrand(),
      hiddenBrands: complement(dibayarBrand()),
    });
  });

  test("stage chip click causes zero /deal network requests (no unwanted RSC navigation)", async ({ page }) => {
    await page.goto("/deal");
    // Let TopBar's own Link-prefetch traffic for /deal and /deal?tahap=INVOICE
    // (unrelated to the chip -- Next prefetches visible Links automatically)
    // settle first, so it isn't mistaken for a request the chip click caused.
    await page.waitForLoadState("networkidle");
    const group = page.getByRole("group", { name: /filter tahap deal/i });
    const watch = watchForDealNavigationRequests(page);

    await group.getByRole("button", { name: "Invoice", exact: true }).click();
    await expect(group.getByRole("button", { name: "Invoice", exact: true })).toHaveAttribute("aria-pressed", "true");
    // Give any accidental navigation request a moment to fire before asserting none did.
    await page.waitForTimeout(300);

    watch.dispose();
    expect(
      watch.requests.map((request) => request.url()),
      "no request should touch /deal when a filter chip changes the URL via history.pushState only",
    ).toEqual([]);
  });

  // --- Mixed-navigation regressions (mandatory: these are the class of bug
  // that escaped the prior test suite in V3/V4) ---
  // TopBar's create-deal/create-invoice links only render at >=640px
  // (create-deal) and >=1024px (create-invoice) -- see src/components/layout/top-bar.tsx
  // -- so these run on the desktop project only.

  test("sequence A: /deal -> chip Invoice -> TopBar New Deal resets to Semua, unfiltered", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "TopBar create-deal link only renders at >=640px");
    await page.goto("/deal");
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Invoice", exact: true }).click();
    await expect(page).toHaveURL(/tahap=INVOICE/);

    await page.getByRole("link", { name: "+ Deal", exact: true }).click();

    await expect(page).toHaveURL(/\/deal$/);
    await assertDealFilterState(page, {
      tahap: null,
      pressedChip: "Semua",
      visibleBrands: allBrands(),
      hiddenBrands: [],
    });
  });

  test("sequence B: /deal -> chip Dibayar -> TopBar New Invoice filters to Invoice", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "TopBar create-invoice link only renders at >=1024px");
    await page.goto("/deal");
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Dibayar", exact: true }).click();
    await expect(page).toHaveURL(/tahap=DIBAYAR/);

    await page.getByRole("link", { name: "Deal siap ditagih", exact: true }).click();

    await expect(page).toHaveURL(/tahap=INVOICE/);
    await assertDealFilterState(page, {
      tahap: "INVOICE",
      pressedChip: "Invoice",
      visibleBrands: invoiceBrands(),
      hiddenBrands: complement(invoiceBrands()),
    });
  });

  test("sequence C: /deal?tahap=INVOICE -> chip Dibayar -> TopBar New Invoice stays on Invoice", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "TopBar create-invoice link only renders at >=1024px");
    await page.goto("/deal?tahap=INVOICE");
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Dibayar", exact: true }).click();
    await expect(page).toHaveURL(/tahap=DIBAYAR/);

    await page.getByRole("link", { name: "Deal siap ditagih", exact: true }).click();

    await expect(page).toHaveURL(/tahap=INVOICE/);
    await assertDealFilterState(page, {
      tahap: "INVOICE",
      pressedChip: "Invoice",
      visibleBrands: invoiceBrands(),
      hiddenBrands: complement(invoiceBrands()),
    });
  });

  test("sequence D: /deal?tahap=INVOICE -> chip Dibayar -> TopBar New Deal resets to Semua", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "TopBar create-deal link only renders at >=640px");
    await page.goto("/deal?tahap=INVOICE");
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Dibayar", exact: true }).click();
    await expect(page).toHaveURL(/tahap=DIBAYAR/);

    await page.getByRole("link", { name: "+ Deal", exact: true }).click();

    await expect(page).toHaveURL(/\/deal$/);
    await assertDealFilterState(page, {
      tahap: null,
      pressedChip: "Semua",
      visibleBrands: allBrands(),
      hiddenBrands: [],
    });
  });
});
