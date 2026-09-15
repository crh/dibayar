// Regression coverage for the mobile fixed-chrome overlap defect found by
// manual/Claude Design review (artifacts/claude-design-review-v2/
// OBSERVATIONS.md) that the repository's own geometry detectors missed: at
// 390x844, BottomNav's padding reservation (app-shell.tsx) only accounted
// for the 56px nav bar, not the FloatingActionButton floating above it
// (56px, offset 72px from the bottom -- see globals.css's
// --mobile-fixed-chrome-clearance). Live DOM inspection during remediation
// (not just the screenshot pack -- a full-page screenshot renders fixed
// elements at a scroll-independent offset, so it can visually suggest
// overlap at a different position than where it actually, permanently
// occurs at rest) confirmed one real, reachable-at-rest case: Beranda's
// last "3 deal terdekat" card, which is full-width and sits directly under
// the FAB's bottom-right corner. The OBSERVATIONS.md screenshot also shows
// the FAB over the invoice-detail share-link row and a Pengaturan input,
// but those never actually happen at scroll rest for a real user (that
// screenshot artifact); the true last elements on those two pages ("Unduh
// PDF", "Keluar") sit further left, outside the FAB's narrow x-range,
// confirmed here by measuring the actual link/button rather than its
// full-width wrapper. Their assertions are kept anyway as general-purpose
// coverage for the same invariant (and would have passed even before this
// fix) -- not because they were confirmed regressions.
//
// These assertions scroll each page to its true bottom (not just the
// unscrolled viewport, which existing detectors already cover) and assert
// the last real interactive element never sits under the fixed nav or FAB
// -- a deterministic geometry check, not a screenshot diff, per this
// remediation's regression-coverage requirement.
//
// Follow-up (mobile-polish batch): the above only ever covered pages long
// enough that scrolling the *document* to its end was meaningful. Beranda's
// "3 deal terdekat" list is short and, with typical fixture data, the whole
// page fits (or nearly fits) within the viewport -- so `window.scrollTo`
// to the document's bottom was a no-op, and the padding-bottom clearance
// reserved by app-shell.tsx (only reachable by scrolling *past* it) never
// applied. The last card rendered wherever normal flow put it, which could
// still be inside the FAB's reserved band even though this suite's
// original "scroll rest" test above happened to pass (see git history for
// the false-negative: a raw boundingBox() comparison between the card and
// the FAB doesn't know the card is clipped out of view by an ancestor's
// `overflow`, so it kept reporting "overlap" as geometrically true long
// after the fix made it visually impossible).
//
// The fix (beranda-client.tsx) bounds the page's own <main> to
// `100dvh - topbar - clearance` with `overflow-y: auto`, so the visible
// content area's own bottom edge can never reach the FAB's band regardless
// of how much (or little) content is on the page -- content that would
// have landed there is clipped out of the initial view and reachable by
// scrolling *within* `<main>` instead. The tests below assert that
// invariant directly (main's rendered bottom edge vs. the FAB's top edge)
// rather than repeating the same boundingBox-vs-FAB comparison that can't
// distinguish "visible and overlapping" from "clipped and not shown".
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loadUxFixtures, loginAs, goto200, type UxFixtureManifest } from "../support/session";
import { UX_VIEWPORTS } from "../support/viewports";

let fixtures: UxFixtureManifest;

test.beforeAll(async () => {
  fixtures = await loadUxFixtures();
});

// Scrolls to the document's true bottom, re-scrolling if the page grows
// after the first attempt (client-side data fetched post-hydration can
// still extend scrollHeight after goto200's networkidle wait) -- a single
// scrollTo + fixed wait was observed to settle short of the real bottom on
// some routes, which would make these overlap assertions pass for the
// wrong reason (never actually reaching the covered element).
async function scrollToBottom(page: Page) {
  let previousHeight = -1;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const height = await page.evaluate(() => {
      window.scrollTo(0, document.scrollingElement!.scrollHeight);
      return document.scrollingElement!.scrollHeight;
    });
    if (height === previousHeight) return;
    previousHeight = height;
    await page.waitForTimeout(100);
  }
}

async function rectsOverlap(a: Locator, b: Locator) {
  const [boxA, boxB] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  if (!boxA || !boxB) throw new Error("Missing element for overlap check");
  return boxA.x < boxB.x + boxB.width && boxA.x + boxA.width > boxB.x && boxA.y < boxB.y + boxB.height && boxA.y + boxA.height > boxB.y;
}

test.describe("Mobile fixed-chrome (BottomNav + FAB) clearance at 390x844", () => {
  test("invoice detail: the download-PDF link is not covered by the nav or FAB at scroll rest", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "owner");
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    await goto200(page, `/invoice/${fixtures.invoices.overdue}`);
    await scrollToBottom(page);

    const downloadLink = page.getByRole("link", { name: "Unduh PDF" });
    const nav = page.getByTestId("bottom-nav");
    const fab = page.locator('a.fixed[href="/deal?tambah=1"]');

    await expect(downloadLink).toBeVisible();
    expect(await rectsOverlap(downloadLink, nav), "Unduh PDF must not sit under the bottom nav").toBe(false);
    expect(await rectsOverlap(downloadLink, fab), "Unduh PDF must not sit under the FAB").toBe(false);
  });

  test("pengaturan: the sign-out button is not covered by the nav or FAB at scroll rest", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "owner");
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    await goto200(page, "/pengaturan");
    await scrollToBottom(page);

    const signOut = page.getByRole("button", { name: "Keluar" });
    const nav = page.getByTestId("bottom-nav");
    const fab = page.locator('a.fixed[href="/deal?tambah=1"]');

    await expect(signOut).toBeVisible();
    expect(await rectsOverlap(signOut, nav), "Keluar must not sit under the bottom nav").toBe(false);
    expect(await rectsOverlap(signOut, fab), "Keluar must not sit under the FAB").toBe(false);
  });

  for (const [viewportName, viewport] of [
    ["390px", UX_VIEWPORTS.sm390],
    ["320px", UX_VIEWPORTS.xs320],
  ] as const) {
    test(`beranda: the page's own content area never renders into the FAB's reserved band, even before any scroll (${viewportName})`, async ({
      page,
      context,
      baseURL,
    }) => {
      if (!baseURL) throw new Error("baseURL required");
      await loginAs(context, baseURL, fixtures, "owner");
      await page.setViewportSize(viewport);
      await goto200(page, "/");
      // Deliberately no scroll: this is the cold-load state a real user sees
      // first, and the one the FAB-clearance fix must hold for regardless of
      // whether the page's content happens to be long enough to scroll at all.

      const main = page.locator("main");
      const fab = page.locator('a.fixed[href="/deal?tambah=1"]');
      const [mainBox, fabBox] = await Promise.all([main.boundingBox(), fab.boundingBox()]);
      if (!mainBox || !fabBox) throw new Error("Missing geometry for Beranda main/FAB");

      expect(
        mainBox.y + mainBox.height,
        "Beranda's own scrollable content area must never extend past the FAB's top edge at rest",
      ).toBeLessThanOrEqual(fabBox.y);
    });
  }

  test("beranda: the last nearest-deal card is reachable and not covered by the FAB after scrolling the content area", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "owner");
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    await goto200(page, "/");

    const nearestSection = page.locator('section[aria-labelledby="home-deal-terdekat"]');
    await expect(nearestSection).toBeVisible();
    const lastCard = nearestSection.locator("li").last();
    const fab = page.locator('a.fixed[href="/deal?tambah=1"]');

    // Beranda's own <main> is the scroll container now (see the fix note
    // above), not the document -- scroll it directly, the way a real touch
    // scroll on this page would.
    await lastCard.scrollIntoViewIfNeeded();
    await expect(lastCard).toBeVisible();
    expect(await rectsOverlap(lastCard, fab), "the last nearest-deal card must not sit under the FAB once scrolled to").toBe(false);
  });
});

test.describe("Deals stage-filter reachability at 390x844", () => {
  test("the stage-filter row is horizontally scrollable and every chip is fully reachable", async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "owner");
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    await goto200(page, "/deal");

    const row = page.locator('[data-ux-scroll="stage-filter"]');
    await expect(row).toBeVisible();
    const rightHint = page.getByTestId("stage-filter-scroll-hint-right");
    const leftHint = page.getByTestId("stage-filter-scroll-hint-left");

    const measurement = await row.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    expect(measurement.scrollWidth, "the many-stage fixture must overflow at 390px for this test to be meaningful").toBeGreaterThan(measurement.clientWidth);

    // At rest (scrolled to the start), the right hint signals more content
    // and the left hint does not falsely claim there's content behind.
    await expect(rightHint).toHaveAttribute("data-visible", "true");
    await expect(leftHint).toHaveAttribute("data-visible", "false");

    // Scrolling to the end must fully reveal the last chip and flip the
    // hints -- the row must never leave a chip permanently unreachable.
    await row.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect(rightHint).toHaveAttribute("data-visible", "false");
    await expect(leftHint).toHaveAttribute("data-visible", "true");

    const stages = await row.getByRole("button").all();
    const lastChip = stages[stages.length - 1];
    const [chipBox, rowBox] = await Promise.all([lastChip.boundingBox(), row.boundingBox()]);
    if (!chipBox || !rowBox) throw new Error("Missing stage-filter chip geometry");
    expect(chipBox.x + chipBox.width, "the last stage chip must be fully within the scrolled row, not clipped").toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
  });

  // The row was already reachable by scroll before this batch (see the test
  // above) -- what OBSERVATIONS.md found was that the partially-cut chip at
  // rest read as a rendering glitch, not an intentional "scroll for more"
  // cue, because the fade's `from-bg` gradient stop and the chip's own
  // `bg-surface` background are only 1.5% apart in oklch lightness (see
  // globals.css's --bg/--surface), making it nearly imperceptible. This
  // guards against reverting to a same-as-background fade with no glyph.
  test("the stage-filter row's scroll-hint is a perceptible affordance, not just a structurally-present one", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("baseURL required");
    await loginAs(context, baseURL, fixtures, "owner");
    await page.setViewportSize(UX_VIEWPORTS.sm390);
    await goto200(page, "/deal");

    const rightHint = page.getByTestId("stage-filter-scroll-hint-right");
    await expect(rightHint).toHaveAttribute("data-visible", "true");

    const chevron = rightHint.locator("span");
    await expect(chevron).toBeVisible();
    await expect(chevron).toHaveText("›");

    const style = await rightHint.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(style, "the hint's fade must use a tinted (not background-matched) gradient stop").toContain("0.25");
  });
});
