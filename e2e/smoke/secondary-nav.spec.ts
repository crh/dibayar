// Real-interaction coverage for the navigation that is not the primary nav
// (docs/testing/journey-coverage.json): the account menu's Pengaturan item
// (NAV-07), the back links on invoice detail (NAV-09) and deal detail
// (NAV-10), and the legacy /dashboard address that invoice detail's back
// link still points at (AUTH-08).
//
// Each test reaches the page the way a person does, clicks the visible
// control, and then walks the browser's own back and forward buttons and a
// reload across the result: these are plain links, so what can go wrong is
// the history entry and the route they land on, not the click.
//
// Read-only: nothing here changes fixture data, so nothing reseeds.
import { expect, test } from "../support/test";
import { unauthenticatedStorageState } from "../support/auth";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";

const NBSP = " ";

test.describe("secondary navigation", { tag: "@critical" }, () => {
  test("account menu Pengaturan opens Settings, closes the menu, and Back returns", async ({ page }) => {
    await page.goto("/invoice");
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();

    const trigger = page.getByRole("button", { name: "Menu akun" });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Menu akun" });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await menu.getByRole("menuitem", { name: "Pengaturan" }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();
    await expect(page.getByLabel("Nama / nama usaha")).toHaveValue("E2E Fixture Owner");
    // The menu does not stay open over the page it led to.
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await page.reload();
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/invoice$/);
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.goForward();
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();
  });

  test("account menu Pengaturan works from the keyboard", async ({ page, isMobile }) => {
    // Opening the menu moves focus into it: onto Pengaturan on desktop, and
    // on the phone's bottom sheet onto its Tutup button, one Tab before it.
    const reachItem = async () => {
      if (isMobile) {
        await expect(page.getByRole("menu", { name: "Menu akun" }).getByRole("button", { name: "Tutup" })).toBeFocused();
        await page.keyboard.press("Tab");
      }
      await expect(item).toBeFocused();
    };
    await page.goto("/deal");
    await expect(page.getByRole("group", { name: /filter tahap deal/i })).toBeVisible();

    const trigger = page.getByRole("button", { name: "Menu akun" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const item = page.getByRole("menu", { name: "Menu akun" }).getByRole("menuitem", { name: "Pengaturan" });
    await reachItem();

    // Escape closes it and hands focus back, without navigating.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/\/deal$/);

    await page.keyboard.press("Enter");
    await reachItem();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(page.getByRole("heading", { name: "Identitas penerbit" })).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("invoice detail's Kembali ke dashboard lands on Beranda, with working Back and Forward", async ({ page }) => {
    const { invoices, brands, deals } = loadFixtureManifest();
    const invoiceUrl = new RegExp(`/invoice/${invoices.sent}$`);
    const invoiceAmount = page.getByRole("heading", { name: `Rp${NBSP}6.000.000` });
    const beranda = page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" });

    // In from the invoice list.
    await page.goto("/invoice");
    await page.getByRole("link", { name: new RegExp(brands[deals.invoiceSent]) }).click();
    await expect(page).toHaveURL(invoiceUrl);
    await expect(invoiceAmount).toBeVisible();
    // Settled before leaving, so no contact/share fetch is cut off mid-flight.
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();

    // The link points at the legacy /dashboard address; what a person gets
    // is Beranda at "/", with Beranda marked as the current section.
    await page.getByRole("link", { name: "← Kembali ke dashboard" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(beranda).toBeVisible();
    await expect(primaryNav(page).getByRole("link", { name: "Beranda", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(invoiceAmount).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(beranda).toBeVisible();

    // Back is the invoice again (not the list, and not a /dashboard hop that
    // bounces forward), and Forward is Beranda.
    await page.goBack();
    await expect(page).toHaveURL(invoiceUrl);
    await expect(invoiceAmount).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/$/);
    await expect(beranda).toBeVisible();
  });

  test("the legacy /dashboard addresses redirect to Beranda and to the invoice", async ({ page }) => {
    const { invoices } = loadFixtureManifest();

    // An old bookmark.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();

    // An old invoice link (the pre-T-19 address of invoice detail).
    await page.goto(`/dashboard/invoices/${invoices.sent}`);
    await expect(page).toHaveURL(new RegExp(`/invoice/${invoices.sent}$`));
    await expect(page.getByRole("heading", { name: `Rp${NBSP}6.000.000` })).toBeVisible();
  });

  test.describe("signed out", () => {
    test.use({ storageState: unauthenticatedStorageState() });

    test("the legacy /dashboard addresses send a signed-out visitor to sign-in", async ({ page }) => {
      const { invoices, brands, deals } = loadFixtureManifest();

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/api\/auth\/signin/);
      await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toHaveCount(0);

      await page.goto(`/dashboard/invoices/${invoices.sent}`);
      await expect(page).toHaveURL(/\/api\/auth\/signin/);
      await expect(page.getByText(brands[deals.invoiceSent])).toHaveCount(0);
      await expect(page.getByText("E2E/SENT/001")).toHaveCount(0);
    });
  });

  test("deal detail's Kembali ke papan deal returns to the board, with working Back and Forward", async ({ page }) => {
    const { deals, brands } = loadFixtureManifest();
    const dealId = deals.nego;
    const brand = brands[dealId];
    const dealUrl = new RegExp(`/deal/${dealId}$`);
    const board = page.getByRole("group", { name: /filter tahap deal/i });
    const card = page.locator("article", { hasText: brand });

    // In from the board: card menu -> Lihat detail.
    await page.goto("/deal");
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    await page.getByRole("menuitem", { name: "Lihat detail" }).click();
    await expect(page).toHaveURL(dealUrl);
    await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();

    await page.getByRole("link", { name: "← Kembali ke papan deal" }).click();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(board).toBeVisible();
    await expect(card).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: brand })).toHaveCount(0);
    await expect(primaryNav(page).getByRole("link", { name: "Deal", exact: true })).toHaveAttribute("aria-current", "page");

    await page.reload();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(card).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(dealUrl);
    await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(board).toBeVisible();
  });
});
