// Real-interaction coverage for the phone's primary "create a deal" entry
// point (docs/testing/journey-coverage.json: DEAL-CREATE-02, NAV-04).
//
// Below 640px the top bar's "+ Deal" link is hidden and the floating action
// button (src/components/layout/floating-action-button.tsx) is the only
// always-present way to start a deal. Every pre-existing create-deal journey
// opened the dialog with page.goto("/deal?tambah=1") and filled fields with
// fill(), so nothing proved a person on a phone could reach or complete the
// form. This test taps the FAB from Beranda and types each field with the
// keyboard, then proves the saved values after a reload.
import { expect, test } from "../support/test";
import { reseedFixtures } from "../support/reseed";

const NBSP = " ";

test.describe("mobile create-deal entry point", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  test("tapping the floating + Deal button from Beranda creates a deal that persists with the typed values", async ({ page, isMobile }) => {
    test.skip(isMobile !== true, "the floating action button only renders below 640px (desktop uses the top bar, covered in add-deal-dialog.spec.ts)");

    await page.goto("/");
    // getByRole skips display:none elements, so on a phone this resolves to
    // the FAB alone (the top bar's "+ Deal" is hidden below 640px).
    const fab = page.getByRole("link", { name: "+ Deal", exact: true });
    await expect(fab).toBeVisible();
    await expect(fab).toBeInViewport();
    await fab.tap();

    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/deal$/);

    const brand = `E2E FAB Brand ${Date.now()}`;
    const fields: Array<[string, string]> = [
      ["Nama brand", brand],
      ["Kontak WhatsApp", "628177000009"],
      ["Scope pekerjaan", "Dua story dan satu reels"],
      ["Fee (Rp)", "3250000"],
    ];
    for (const [label, value] of fields) {
      const field = dialog.getByLabel(label);
      await field.tap();
      await expect(field).toBeFocused();
      await page.keyboard.type(value);
    }

    const createResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals",
    );
    await dialog.getByRole("button", { name: "Simpan deal" }).tap();
    expect((await createResponse).ok()).toBe(true);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");

    await page.reload();
    const card = page.locator("article", { hasText: brand });
    await expect(card).toBeVisible();
    // A card has no link of its own; detail is reached through its menu.
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).tap();
    await page.getByRole("menuitem", { name: "Lihat detail" }).tap();

    await expect(page.getByRole("heading", { name: brand })).toBeVisible();
    await expect(page.getByText(`Rp${NBSP}3.250.000`)).toBeVisible();
    await expect(page.getByText("Dua story dan satu reels")).toBeVisible();
    await expect(page.getByText("Tahap saat ini: Masuk")).toBeVisible();
  });
});
