// FIND-13: what someone types into the add-deal dialog before the page's
// scripts have run must still be there once they have.
//
// /deal?tambah=1 arrives from the server with the dialog already open, so on
// a slow phone or connection a person can tap a field and start typing while
// the scripts are still downloading. Before the fix, the first re-render
// after the scripts ran put every field back to empty, and the dialog moved
// the keyboard to its close button in the middle of the word.
//
// The test holds the page's own scripts back (nothing else), types the way a
// person does (a tap or click on the field, then keys), lets the scripts
// through, keeps typing without touching the field again, and saves. It does
// not wait for the scripts before typing and never sets a field's value from
// script: both would hide the behaviour it is here for.
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { reseedFixtures } from "../support/reseed";
import { press, responseTo, typeInto } from "../support/journey";

// Holds every script file of the app until release() is called. The document
// and its styles load normally, so the page is drawn and can be typed into.
async function holdPageScripts(page: Page) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  const held = new Set<string>();
  await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, async (route) => {
    held.add(route.request().url());
    await released;
    await route.continue();
  });
  // Counts the frames the browser draws, for dialogOnScreen() below.
  await page.addInitScript(() => {
    const counter = window as unknown as { __framesDrawn: number };
    counter.__framesDrawn = 0;
    const count = () => {
      counter.__framesDrawn += 1;
      requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
  });
  return { release, heldCount: () => held.size };
}

// Waits for the dialog the server rendered. It is in the document from the
// start; React's own inline script moves it into place on the browser's next
// frame (requestAnimationFrame).
//
// Headless WebKit sometimes draws no frame at all while a page's scripts are
// still outstanding: measured locally, 0 frames after 13 s in 8 of 20 runs
// that followed a Firefox project, with the document complete and the dialog
// waiting in it, and Playwright's own screenshot of that page hanging too. On
// such a page nothing can be typed, so there is nothing for this test to
// check, and it is skipped, in WebKit only and only when not one frame was
// drawn. A phone always draws frames. Any other reason for the dialog not
// showing fails the test as usual.
async function dialogOnScreen(page: Page, dialog: Locator, browserName: string) {
  const shown = await dialog.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false);
  if (!shown && browserName === "webkit") {
    const framesDrawn = await page.evaluate(() => (window as unknown as { __framesDrawn?: number }).__framesDrawn ?? -1);
    test.skip(framesDrawn === 0, "headless WebKit drew no frame while the page's scripts were held, so the server-rendered dialog never appeared");
  }
  await expect(dialog).toBeVisible();
}

test.describe("add-deal dialog: text typed before the page's scripts run", { tag: "@critical" }, () => {
  // The test saves a deal.
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("typing started before the scripts run is kept, can be continued, and saves one deal", async ({ page, isMobile, browserName }) => {
    const brand = `E2E Sebelum Skrip ${Date.now()}`;
    const whatsappBefore = "62817";
    const whatsappAfter = "7000123";
    const scripts = await holdPageScripts(page);
    const created: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/deals") created.push(request.url());
    });

    // "commit", not "load": the load event waits for the scripts held above.
    await page.goto("/deal?tambah=1", { waitUntil: "commit" });
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await dialogOnScreen(page, dialog, browserName);
    const brandField = dialog.getByLabel("Nama brand");
    const whatsappField = dialog.getByLabel("Kontak WhatsApp");

    // Before the scripts: a whole first field, and the start of a second.
    await press(brandField, isMobile);
    await expect(brandField).toBeFocused();
    await page.keyboard.type(brand);
    await press(whatsappField, isMobile);
    await expect(whatsappField).toBeFocused();
    await page.keyboard.type(whatsappBefore);
    await expect(brandField).toHaveValue(brand);
    await expect(whatsappField).toHaveValue(whatsappBefore);

    // Proof the typing above happened before the scripts ran: they are still
    // held, and the page has not yet removed its one-shot ?tambah=1 (which
    // only its script does).
    expect(scripts.heldCount(), "script files held back").toBeGreaterThan(0);
    expect(new URL(page.url()).search).toBe("?tambah=1");

    // The scripts arrive. The page removing ?tambah=1 is what a person can
    // see of that.
    scripts.release();
    await expect(page).toHaveURL(/\/deal$/);

    // Nothing typed was lost, and the keyboard is still in the same field:
    // the rest of the number goes in without touching the field again.
    await expect(dialog).toBeVisible();
    await expect(brandField).toHaveValue(brand);
    await expect(whatsappField).toHaveValue(whatsappBefore);
    await expect(whatsappField).toBeFocused();
    await page.keyboard.type(whatsappAfter);
    await expect(whatsappField).toHaveValue(whatsappBefore + whatsappAfter);
    await expect(brandField).toHaveValue(brand);

    // The rest of the form, typed after the scripts, then saved.
    await typeInto(page, dialog.getByLabel("Scope pekerjaan"), "Satu video promosi produk", isMobile);
    await typeInto(page, dialog.getByLabel("Fee (Rp)"), "2500000", isMobile);
    await expect(brandField).toHaveValue(brand);
    await expect(whatsappField).toHaveValue(whatsappBefore + whatsappAfter);
    const saved = await responseTo(page, "POST", "/api/deals", () =>
      press(dialog.getByRole("button", { name: "Simpan deal" }), isMobile));
    expect(saved.status()).toBe(201);
    expect((await saved.json()).deal).toMatchObject({
      brand,
      contactWa: whatsappBefore + whatsappAfter,
      scope: "Satu video promosi produk",
      feeIdr: 2500000,
    });

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");
    await expect(page.getByText(brand, { exact: true })).toHaveCount(1);

    // Saved once, with what was typed, and still there after a reload.
    await page.reload();
    await expect(page.getByText(brand, { exact: true })).toHaveCount(1);
    await expect(page.getByRole("dialog", { name: "Tambah deal" })).toHaveCount(0);
    const stored = (await (await page.request.get("/api/deals")).json()).deals.filter((deal: { brand: string }) => deal.brand === brand);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ contactWa: whatsappBefore + whatsappAfter, feeIdr: 2500000 });
    expect(created, "POST /api/deals requests").toHaveLength(1);
  });

  // The other half of the same change: closing the dialog still throws the
  // typed text away, including text typed before the scripts ran. Reopening
  // it must not bring that text back.
  test("text typed before the scripts run is discarded by Tutup and is not there when the dialog is reopened", async ({ page, isMobile, browserName }) => {
    const scripts = await holdPageScripts(page);
    await page.goto("/deal?tambah=1", { waitUntil: "commit" });
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await dialogOnScreen(page, dialog, browserName);
    const brandField = dialog.getByLabel("Nama brand");
    await press(brandField, isMobile);
    await expect(brandField).toBeFocused();
    await page.keyboard.type("Tidak Disimpan");
    expect(new URL(page.url()).search).toBe("?tambah=1");

    scripts.release();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(brandField).toHaveValue("Tidak Disimpan");

    await press(dialog.getByRole("button", { name: "Tutup" }), isMobile);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Tidak Disimpan", { exact: true })).toHaveCount(0);

    const plusDeal = isMobile
      ? page.getByRole("link", { name: "+ Deal", exact: true })
      : page.getByTestId("top-bar").getByRole("link", { name: "+ Deal", exact: true });
    await press(plusDeal, isMobile);
    await expect(dialog).toBeVisible();
    for (const label of ["Nama brand", "Kontak WhatsApp", "Scope pekerjaan", "Fee (Rp)"]) {
      await expect(dialog.getByLabel(label)).toHaveValue("");
    }
    const none = await page.request.get("/api/deals");
    expect((await none.json()).deals.filter((deal: { brand: string }) => deal.brand === "Tidak Disimpan")).toHaveLength(0);
  });
});
