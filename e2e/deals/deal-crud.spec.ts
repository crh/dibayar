import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

test.describe("deal create/update journeys", { tag: "@critical" }, () => {
  // Reseed before each test: "moving a deal" depends on a deal being at a
  // specific starting stage, which a prior run (in another project sharing
  // this database within the same invocation) may have already moved. See
  // e2e/support/reseed.ts.
  test.beforeEach(reseedFixtures);


  test("create a deal via the dialog, happy path", async ({ page }) => {
    // Direct URL, not a TopBar click: see e2e/deals/add-deal-dialog.spec.ts's
    // header comment -- there is currently no in-app link that navigates to
    // ?tambah=1 (TopBar's "+ Deal" goes to plain /deal).
    await page.goto("/deal?tambah=1");

    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();

    const brand = `E2E New Brand ${Date.now()}`;
    await dialog.getByLabel("Nama brand").fill(brand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000000");
    await dialog.getByLabel("Scope pekerjaan").fill("Satu video promosi produk");
    await dialog.getByLabel("Fee (Rp)").fill("2500000");
    await dialog.getByRole("button", { name: "Simpan deal" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");
    await expect(page.getByText(brand, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(brand, { exact: true })).toBeVisible();
  });

  test("opening the dialog and closing it without saving creates nothing", async ({ page }) => {
    await page.goto("/deal?tambah=1");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Nama brand").fill("Should Not Be Saved");
    await dialog.getByRole("button", { name: "Tutup" }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.getByText("Should Not Be Saved", { exact: true })).toHaveCount(0);
  });

  test("moving a deal to the next stage via its card menu updates the board", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const masukBrand = manifest.brands[manifest.deals.masuk];
    const negoBrand = manifest.brands[manifest.deals.nego];

    await page.goto("/deal");
    const masukCard = page.locator("article", { hasText: masukBrand });
    await masukCard.getByRole("button", { name: `Aksi lain untuk deal ${masukBrand}` }).click();
    await page.getByRole("menuitem", { name: "Lanjut ke Nego" }).click();

    // Filter to Nego to unambiguously confirm the move landed there.
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Nego", exact: true }).click();
    await expect(page.getByText(masukBrand, { exact: true })).toBeVisible();
    await expect(page.getByText(negoBrand, { exact: true })).toBeVisible();

    await page.reload();
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Nego", exact: true }).click();
    await expect(page.getByText(masukBrand, { exact: true })).toBeVisible();
  });
});
