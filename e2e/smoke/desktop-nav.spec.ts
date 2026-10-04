// Real-interaction coverage for desktop primary navigation
// (docs/testing/journey-coverage.json: NAV-02). The phone's BottomNav is
// mobile-nav.spec.ts.
//
// Desktop has two variants of the same four links (src/components/layout):
// SideNav at >=1024px and the TopBar's inline nav at 640-1023px; each is
// display:none outside its range. Each test clicks every link in the variant
// a person at that width actually sees, and checks the route, the section's
// own content, and which item is marked current.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";

const SECTIONS = [
  { link: "Deal", path: /\/deal$/, check: (page: Page) => page.getByRole("group", { name: /filter tahap deal/i }) },
  { link: "Invoice", path: /\/invoice$/, check: (page: Page) => page.getByRole("heading", { level: 1, name: "Invoice" }) },
  { link: "Pengaturan", path: /\/pengaturan$/, check: (page: Page) => page.getByRole("heading", { name: "Identitas penerbit" }) },
  // Beranda's own content, not the top bar (whose "Deal siap ditagih" link is on every page).
  { link: "Beranda", path: /\/$/, check: (page: Page) => page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" }) },
] as const;

async function walkPrimaryNav(page: Page, navTestId: "side-nav" | "top-bar-nav") {
  await page.goto("/");
  const nav = page.getByTestId(navTestId);
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Beranda", exact: true })).toHaveAttribute("aria-current", "page");

  for (const section of SECTIONS) {
    await nav.getByRole("link", { name: section.link, exact: true }).click();
    await expect(page).toHaveURL(section.path);
    await expect(section.check(page)).toBeVisible();
    await expect(nav.getByRole("link", { name: section.link, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  }
}

test.describe("desktop primary navigation", { tag: "@critical" }, () => {
  test("side nav moves between Beranda, Deal, Invoice, and Pengaturan at desktop width", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "SideNav only renders at >=1024px");
    expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(1024);
    await expect(page.getByTestId("top-bar-nav")).toBeHidden();
    await walkPrimaryNav(page, "side-nav");
  });

  test.describe("tablet width", () => {
    // 640-1023px: the TopBar's inline nav replaces the SideNav.
    test.use({ viewport: { width: 800, height: 900 } });

    test("top-bar nav moves between Beranda, Deal, Invoice, and Pengaturan at 800px", async ({ page, isMobile }) => {
      test.skip(isMobile === true, "the top-bar nav is the 640-1023px desktop variant; phones use BottomNav (mobile-nav.spec.ts)");
      await page.goto("/");
      await expect(page.getByTestId("side-nav")).toBeHidden();
      await walkPrimaryNav(page, "top-bar-nav");
    });
  });
});
