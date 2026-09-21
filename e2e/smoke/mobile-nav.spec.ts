// BottomNav only renders below 640px (min-[640px]:hidden in
// src/components/layout/bottom-nav.tsx) -- desktop uses TopBar's inline nav
// instead, already covered indirectly by the deal-filter suite's TopBar
// interactions. This file is mobile-viewport only.
import { expect, test } from "../support/test";

test.describe("mobile bottom navigation", { tag: "@critical" }, () => {
  test("bottom nav moves between Beranda, Deal, Invoice, and Pengaturan", async ({ page, isMobile }) => {
    test.skip(isMobile !== true, "BottomNav only renders below 640px");
    await page.goto("/");

    const nav = page.getByTestId("bottom-nav");
    await expect(nav).toBeVisible();

    await nav.getByRole("link", { name: "Deal" }).click();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(page.getByRole("group", { name: /filter tahap deal/i })).toBeVisible();

    await nav.getByRole("link", { name: "Invoice" }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();

    await nav.getByRole("link", { name: "Pengaturan" }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();

    await nav.getByRole("link", { name: "Beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
