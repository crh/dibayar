// Regression coverage for the sidebar background seam found by Claude
// Design review (artifacts/claude-design-review-v2/OBSERVATIONS.md,
// "Responsive / layout"): at 1440px, SideNav (side-nav.tsx) used a fixed
// `h-[calc(100vh-4rem)]` height. Because it is `position: sticky`, that
// height is also its permanent box height in the document flow -- on a
// page whose main column is taller than one viewport (e.g. the populated
// Pengaturan form), the nav's `bg-surface` fill stopped a little past one
// viewport height down the page, leaving the page's `bg` background
// exposed beside the remaining, still-scrollable main column below that
// point. The fix changed the fixed height to a `min-h-`, so the default
// flex `align-items: stretch` grows the nav (and its background) to match
// the row's real height whenever the main column is taller.
//
// This is a deterministic geometry check (not a screenshot diff): with the
// bug, the nav's document-relative bottom edge stops roughly one viewport
// height down regardless of how tall the main column is; with the fix, it
// always reaches at least as far as the main column's own bottom edge.
import { expect, test } from "@playwright/test";
import { loadUxFixtures, loginAs, goto200, type UxFixtureManifest } from "../support/session";
import { UX_VIEWPORTS } from "../support/viewports";

let fixtures: UxFixtureManifest;

test.beforeAll(async () => {
  fixtures = await loadUxFixtures();
});

test.describe("Pengaturan sidebar background seam at 1440px", () => {
  test("the sidebar's background reaches the bottom of a main column taller than the viewport", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "owner");
    await page.setViewportSize(UX_VIEWPORTS.xl1440);
    await goto200(page, "/pengaturan");

    const nav = page.getByTestId("side-nav");
    const main = page.locator("main");
    await expect(nav).toBeVisible();
    await expect(main).toBeVisible();

    const documentBottom = (locator: typeof nav) =>
      locator.evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);

    const [navBottom, mainBottom, mainHeight, viewportHeight] = await Promise.all([
      documentBottom(nav),
      documentBottom(main),
      main.evaluate((el) => el.getBoundingClientRect().height),
      page.evaluate(() => window.innerHeight),
    ]);

    expect(mainHeight, "this fixture's Pengaturan form must be taller than the viewport for this test to be meaningful").toBeGreaterThan(viewportHeight);
    expect(navBottom, "the sidebar's background must reach at least as far down as the main column, leaving no seam").toBeGreaterThanOrEqual(mainBottom - 1);
  });
});
