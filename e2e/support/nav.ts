// The app's primary navigation, whichever variant the viewport renders:
// SideNav at >=1024px, TopBar's inline nav at 640-1023px, BottomNav below
// 640px (src/components/layout/*). All three share the same accessible name
// (i18n "nav.label") and the other two are display:none, which getByRole
// already skips -- so this resolves to exactly the one a person can see.
import type { Locator, Page } from "@playwright/test";

export function primaryNav(page: Page, language: "id" | "en" = "id"): Locator {
  return page.getByRole("navigation", { name: language === "id" ? "Navigasi utama" : "Main navigation" });
}
