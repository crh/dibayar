// Real-interaction coverage for creating a deal on desktop
// (docs/testing/journey-coverage.json: DEAL-CREATE-01, and the desktop path
// of DEAL-DETAIL-01).
//
// The pre-existing happy path ("create a deal via the dialog, happy path" in
// deal-crud.spec.ts) opens the dialog with page.goto("/deal?tambah=1"), and
// the top bar's "+ Deal" click (NAV-03) was only ever proven to open an
// empty dialog. Neither proves a person on desktop can get from the app to a
// saved deal. This journey starts on Beranda, clicks the visible top-bar
// "+ Deal", fills every visible text field, saves, reloads, and then reaches
// the new deal the only way the board offers (card menu -> Lihat detail) to
// check every stored value. The deadline is a native date picker and stays
// manual (MAN-DEAL-01). The phone equivalent is mobile-create-entry.spec.ts.
import { expect, test } from "../support/test";
import { reseedFixtures } from "../support/reseed";

// Money uses a non-breaking space after "Rp" (CLAUDE.md IDR rule).
const NBSP = "\u00a0";

test.describe("desktop create-deal entry point", { tag: "@critical" }, () => {
  // Creates a deal; reseeding drops it (and anything another project left
  // behind) before the next test. See e2e/support/reseed.ts.
  test.beforeEach(reseedFixtures);

  test("clicking the top-bar + Deal from Beranda creates a deal whose stored values show on its detail page after reload", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "the top bar's + Deal only renders at >=640px (phones use the floating button, see mobile-create-entry.spec.ts)");

    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    const plusDeal = page.getByTestId("top-bar").getByRole("link", { name: "+ Deal", exact: true });
    await expect(plusDeal).toBeVisible();
    await plusDeal.click();

    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/deal$/);

    const brand = `E2E Desktop Brand ${Date.now()}`;
    await dialog.getByLabel("Nama brand").fill(brand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000010");
    await dialog.getByLabel("Nama kontak (opsional)").fill("Rina Marketing");
    await dialog.getByLabel("Scope pekerjaan").fill("Tiga konten TikTok dan satu live");
    await dialog.getByLabel("Fee (Rp)").fill("4750000");
    // The fee field echoes the formatted amount as you type.
    await expect(dialog.getByText(`≈ Rp${NBSP}4.750.000`)).toBeVisible();
    await dialog.getByLabel("Syarat pembayaran (opsional)").fill("14 hari setelah konten tayang");

    const createResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals",
    );
    await dialog.getByRole("button", { name: "Simpan deal" }).click();
    expect((await createResponse).ok()).toBe(true);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");

    await page.reload();
    const card = page.locator("article", { hasText: brand });
    await expect(card).toBeVisible();
    await expect(card.getByText(`Rp${NBSP}4.750.000`)).toBeVisible();
    // A card has no link of its own; detail is reached through its menu.
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    await page.getByRole("menuitem", { name: "Lihat detail" }).click();

    await expect(page).toHaveURL(/\/deal\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
    await expect(page.getByText("Tahap saat ini: Masuk")).toBeVisible();
    const fee = page.getByText(`Rp${NBSP}4.750.000`);
    await expect(fee).toBeVisible();
    // getByText normalizes whitespace, so check the exact characters once.
    expect(await fee.textContent()).toBe(`Rp${NBSP}4.750.000`);
    await expect(page.getByText("Tiga konten TikTok dan satu live")).toBeVisible();
    await expect(page.getByText("14 hari setelah konten tayang")).toBeVisible();
    await expect(page.getByLabel("Nama kontak", { exact: true })).toHaveValue("Rina Marketing");
    // src/lib/format/phone.ts formatPhone("628177000010").
    await expect(page.getByText("+62 817-7000-010", { exact: true })).toBeVisible();
    await expect(page.getByText("Deal dibuat langsung di tahap Masuk")).toBeVisible();
  });
});
