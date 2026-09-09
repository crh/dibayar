// Deals Pipeline Regression Rule (see docs/testing/UX_AUDIT.md "Scroll
// policy" and support/scroll-policy.ts): the deal-board rail
// (`[data-testid="deal-board-rail"]`) is *always* `overflow-x: auto` in
// deal-board.tsx, at every viewport -- so "does an intentional scroll
// container exist" is not the interesting question. The interesting
// question is whether it actually NEEDS to scroll. On a normal desktop
// viewport it must not; on mobile/tablet it's allowed to (stacked
// full-width stage sections by design).
//
// Uses the owner fixture, which carries both the original one-per-stage
// deals and the "many-deals" density fixture (several extra cards in
// MASUK/NEGO/DEAL, including long Indonesian brand names) on the SAME
// unfiltered board -- see scripts/ux-fixtures.ts -- so this exercises the
// realistic worst case, not an artificially sparse board.
import { expect, test } from "@playwright/test";
import { measureScrollContainer, detectHorizontalOverflow } from "../support/detectors";
import { loadUxFixtures, loginAs, goto200, type UxFixtureManifest } from "../support/session";
import {
  UX_VIEWPORT_MATRIX,
  DESKTOP_VIEWPORT_KEYS,
  NON_DESKTOP_VIEWPORT_KEYS,
  type UxMatrixViewportKey,
} from "../support/viewport-matrix";

const RAIL_SELECTOR = '[data-testid="deal-board-rail"]';

let fixtures: UxFixtureManifest;

test.beforeAll(async () => {
  fixtures = await loadUxFixtures();
});

test.describe("Deals pipeline desktop-scroll regression", () => {
  for (const viewportKey of DESKTOP_VIEWPORT_KEYS as UxMatrixViewportKey[]) {
    test(`${viewportKey}: Deals board does not require horizontal scrolling`, async ({ page, context, baseURL }) => {
      if (!baseURL) throw new Error("baseURL required");
      await loginAs(context, baseURL, fixtures, "owner");
      await page.setViewportSize(UX_VIEWPORT_MATRIX[viewportKey]);
      await goto200(page, "/deal");
      await expect(page.getByRole("group", { name: /filter tahap deal/i })).toBeVisible();

      const rail = await measureScrollContainer(page, RAIL_SELECTOR);
      expect(rail.found, `${RAIL_SELECTOR} must be present on /deal`).toBe(true);
      expect(
        rail.requiresHorizontalScroll,
        `DEALS_BOARD_DESKTOP_SCROLL is forbidden at ${viewportKey} (${UX_VIEWPORT_MATRIX[viewportKey].width}px): rail scrollWidth=${rail.scrollWidth} clientWidth=${rail.clientWidth}`,
      ).toBe(false);

      const overflow = await detectHorizontalOverflow(page);
      expect(overflow.pageOverflow, `PAGE_HORIZONTAL_SCROLL is forbidden at ${viewportKey}`).toBe(false);
    });
  }

  for (const viewportKey of NON_DESKTOP_VIEWPORT_KEYS as UxMatrixViewportKey[]) {
    test(`${viewportKey}: Deals board may scroll its rail, but never the page`, async ({ page, context, baseURL }) => {
      if (!baseURL) throw new Error("baseURL required");
      await loginAs(context, baseURL, fixtures, "owner");
      await page.setViewportSize(UX_VIEWPORT_MATRIX[viewportKey]);
      await goto200(page, "/deal");
      await expect(page.getByRole("group", { name: /filter tahap deal/i })).toBeVisible();

      // DEALS_BOARD_MOBILE_SCROLL = allowed: no assertion on
      // requiresHorizontalScroll here, by design (see scroll-policy.ts).
      // The rail is read anyway so a run's raw findings (consumed by
      // scripts/ux-report.ts) always record the measurement.
      await measureScrollContainer(page, RAIL_SELECTOR);

      const overflow = await detectHorizontalOverflow(page);
      expect(overflow.pageOverflow, `PAGE_HORIZONTAL_SCROLL is forbidden even at ${viewportKey}`).toBe(false);
    });
  }
});
