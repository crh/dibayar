// Accessibility scans of the pages and states e2e/smoke/accessibility.spec.ts
// does not reach (docs/testing/journey-coverage.json: A11Y-01): deal detail,
// the states a page only shows after something went wrong (an unusable
// WhatsApp number, an expired share link, Settings field errors), the English
// interface, and the phone layout.
//
// Every state is reached the way a person reaches it (the nav, a card's menu,
// the button that reveals it) and then scanned whole with the same rule set
// and the same threshold as the base spec: zero serious or critical findings,
// nothing excluded, no rule switched off.
//
// What this is not: an axe scan reads the rendered page. It does not operate
// a screen reader, so it says nothing about what TalkBack or VoiceOver
// announce or in which order (MAN-A11Y-01, on real devices). The phone-layout
// scans run desktop Chromium at 390x844; that is the app's phone layout, not
// a phone.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { assertNoSeriousA11yViolations } from "../support/a11y";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { applyFollowUpExpiredShare, applyFollowUpStates, reseedFixtures } from "../support/reseed";
import { keepWhatsAppLocal } from "../support/follow-up";
import { responseTo } from "../support/journey";

async function openDealDetailFromBoard(page: Page, brand: string) {
  await page.goto("/deal");
  await page.locator("article", { hasText: brand }).getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
  await page.getByRole("menuitem", { name: "Lihat detail" }).click();
  await expect(page).toHaveURL(/\/deal\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Riwayat tahap" })).toBeVisible();
}

test.describe("accessibility of deal detail and error states", { tag: "@a11y" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("Deal detail has no automatically-detectable serious/critical a11y violations", async ({ page }, testInfo) => {
    const { deals, brands } = loadFixtureManifest();
    await openDealDetailFromBoard(page, brands[deals.nego]);
    await expect(page.getByRole("button", { name: "Lanjut ke Deal", exact: true })).toBeVisible();
    await assertNoSeriousA11yViolations(page, testInfo);
  });

  test("Deal detail of an invoiced deal has no automatically-detectable serious/critical a11y violations", async ({ page }, testInfo) => {
    const { deals, brands } = loadFixtureManifest();
    await openDealDetailFromBoard(page, brands[deals.invoiceSent]);
    await expect(page.getByRole("link", { name: /^Lihat invoice / })).toBeVisible();
    await assertNoSeriousA11yViolations(page, testInfo);
  });

  test("Deal detail with the WhatsApp number repair form open has no automatically-detectable serious/critical a11y violations", async ({ page, context }, testInfo) => {
    applyFollowUpStates();
    await keepWhatsAppLocal(context);
    const { followUp } = loadFixtureManifest();
    await openDealDetailFromBoard(page, followUp.brands[followUp.deals.invalidContact]);

    await page.getByRole("button", { name: "Buka WhatsApp" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Nomor WhatsApp belum valid" })).toBeVisible();
    const repair = page.getByLabel("Perbaiki nomor WhatsApp");
    // The error is announced (role=alert) and the fix has the focus.
    await expect(repair).toBeFocused();
    await assertNoSeriousA11yViolations(page, testInfo);
  });

  test("Invoice detail with the WhatsApp number repair form open has no automatically-detectable serious/critical a11y violations", async ({ page, context }, testInfo) => {
    applyFollowUpStates();
    await keepWhatsAppLocal(context);
    const { followUp } = loadFixtureManifest();
    const dealId = followUp.deals.invalidContact;
    // The overlay's deal with an unusable number, taken to Invoice and invoiced.
    await openDealDetailFromBoard(page, followUp.brands[dealId]);
    for (const stage of ["Deal", "Konten", "Invoice"]) {
      const moved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => page.getByRole("button", { name: `Lanjut ke ${stage}`, exact: true }).click());
      expect(moved.ok()).toBe(true);
      await expect(page.getByText(`Tahap saat ini: ${stage}`)).toBeVisible();
    }
    const invoiced = await responseTo(page, "POST", "/api/invoices", () => page.getByRole("button", { name: "Buat invoice" }).click());
    expect(invoiced.ok()).toBe(true);
    await page.getByRole("link", { name: /^Lihat invoice / }).click();
    await expect(page).toHaveURL(/\/invoice\/[^/]+$/);

    const send = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.getByRole("alert").filter({ hasText: "Nomor WhatsApp belum valid" })).toBeVisible();
    await expect(page.locator("#invoice-contact-wa")).toHaveValue(followUp.invalidContactWa);
    await assertNoSeriousA11yViolations(page, testInfo);
  });

  test("Invoice detail with an expired share link has no automatically-detectable serious/critical a11y violations", async ({ page }, testInfo) => {
    applyFollowUpExpiredShare();
    const { followUp } = loadFixtureManifest();
    const brand = followUp.brands[followUp.deals.overdueStored];
    await page.goto("/invoice");
    await page.getByRole("link", { name: new RegExp(brand) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${followUp.invoices.overdueStored}$`));
    const share = page.getByRole("region", { name: "Bagikan invoice" });
    await expect(share.getByText("Tautan berbagi sudah tidak berlaku.")).toBeVisible();
    await expect(share.getByRole("button", { name: "Buat tautan baru" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim pengingat" })).toBeEnabled();
    await assertNoSeriousA11yViolations(page, testInfo);
  });

  test("Pengaturan with field errors showing has no automatically-detectable serious/critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/");
    await primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }).click();
    await expect(page).toHaveURL(/\/pengaturan$/);
    const bank = page.getByRole("region", { name: "Rekening pembayaran" });
    await expect(bank.getByLabel("Nama bank")).toHaveValue("Bank E2E Fixture");
    await bank.getByLabel("Nomor rekening").fill("");
    await page.getByLabel("Email").fill("bukan-email");
    await page.getByRole("button", { name: "Simpan pengaturan" }).click();

    await expect(bank.getByRole("alert")).toHaveText("Wajib diisi.");
    await expect(bank.getByLabel("Nomor rekening")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Email tidak valid.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await assertNoSeriousA11yViolations(page, testInfo);
  });

  // One language switch (two PATCHes; the limit is 10 a minute), every main
  // page scanned in English in between. The reseed in afterEach puts the
  // owner back to Indonesian even if a scan fails halfway.
  test("the English interface has no automatically-detectable serious/critical a11y violations on the main pages", async ({ page }, testInfo) => {
    const { invoices, brands, deals } = loadFixtureManifest();
    await page.goto("/pengaturan");
    const isLanguagePatch = (response: { request(): { method(): string }; url(): string }) =>
      response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/me/language";
    const toEnglish = page.waitForResponse(isLanguagePatch);
    await page.getByRole("group", { name: "Bahasa antarmuka" }).getByRole("button", { name: "English" }).click();
    expect((await toEnglish).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Interface language" })).toBeVisible();
    // The document says which language it is in.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await assertNoSeriousA11yViolations(page, testInfo);

    const nav = primaryNav(page, "en");
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await assertNoSeriousA11yViolations(page, testInfo);

    await nav.getByRole("link", { name: "Deals", exact: true }).click();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(page.locator("article", { hasText: brands[deals.nego] })).toBeVisible();
    await assertNoSeriousA11yViolations(page, testInfo);

    await nav.getByRole("link", { name: "Invoices", exact: true }).click();
    await expect(page).toHaveURL(/\/invoice$/);
    await expect(page.getByRole("link", { name: new RegExp(brands[deals.invoiceSent]) })).toBeVisible();
    await assertNoSeriousA11yViolations(page, testInfo);

    await page.getByRole("link", { name: new RegExp(brands[deals.invoiceSent]) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${invoices.sent}$`));
    await expect(page.getByText("Due date", { exact: true })).toBeVisible();
    await expect(page.getByTestId("share-link-track")).toBeVisible();
    await assertNoSeriousA11yViolations(page, testInfo);

    await nav.getByRole("link", { name: "Settings", exact: true }).click();
    const toIndonesian = page.waitForResponse(isLanguagePatch);
    await page.getByRole("group", { name: "Interface language" }).getByRole("button", { name: "Indonesia" }).click();
    expect((await toIndonesian).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Bahasa antarmuka" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
  });
});

// The layout a phone gets (bottom navigation, floating + Deal, stacked
// cards), which the base spec never renders: it runs at the desktop
// viewport. Desktop Chromium at the app's 390px target, not a phone.
test.describe("accessibility of the phone layout (390px, desktop Chromium)", { tag: "@a11y" }, () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(reseedFixtures);

  for (const [name, link, url] of [
    ["Beranda", "Beranda", /\/$/],
    ["Deal board", "Deal", /\/deal$/],
    ["Invoice list", "Invoice", /\/invoice$/],
    ["Pengaturan", "Pengaturan", /\/pengaturan$/],
  ] as const) {
    test(`${name} in the phone layout has no automatically-detectable serious/critical a11y violations`, async ({ page }, testInfo) => {
      await page.goto(name === "Beranda" ? "/pengaturan" : "/");
      // The bottom navigation is the one a 390px viewport shows.
      const nav = primaryNav(page);
      await expect(nav).toBeVisible();
      await nav.getByRole("link", { name: link, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await assertNoSeriousA11yViolations(page, testInfo);
    });
  }

  test("Invoice detail in the phone layout has no automatically-detectable serious/critical a11y violations", async ({ page }, testInfo) => {
    const { invoices, brands, deals } = loadFixtureManifest();
    await page.goto("/invoice");
    await page.getByRole("link", { name: new RegExp(brands[deals.invoiceSent]) }).click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${invoices.sent}$`));
    await expect(page.getByTestId("share-link-track")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
    await assertNoSeriousA11yViolations(page, testInfo);
  });

  test("the Add Deal dialog in the phone layout has no automatically-detectable serious/critical a11y violations", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("link", { name: "+ Deal", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tutup" })).toBeFocused();
    await assertNoSeriousA11yViolations(page, testInfo);
  });
});

// Keyboard only: no mouse, no touch, no focus() from the test. Tab is pressed
// until the control a person is looking for has the focus (a bounded number
// of presses, so a control the keyboard cannot reach fails the test).
async function tabTo(page: Page, target: ReturnType<Page["locator"]>, limit = 40) {
  for (let presses = 0; presses < limit; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target, `not reachable with ${limit} Tab presses`).toBeFocused();
}

test.describe("keyboard-only use", { tag: "@a11y" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("a deal can be added, found and opened with the keyboard alone, and the dialog keeps the focus inside", async ({ page, isMobile }) => {
    test.skip(isMobile, "a hardware-keyboard journey through the desktop layout; the phone project has no Tab key");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Net ditagihkan bulan ini" })).toBeVisible();

    // + Deal from the top bar, by Tab and Enter.
    const plusDeal = page.getByTestId("top-bar").getByRole("link", { name: "+ Deal", exact: true });
    await tabTo(page, plusDeal);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Tutup" });
    await expect(close).toBeFocused();

    // Tab walks the fields in reading order and typing lands in each.
    const brand = `E2E Keyboard Brand ${Date.now()}`;
    for (const [label, value] of [
      ["Nama brand", brand],
      ["Kontak WhatsApp", "628177000031"],
      ["Nama kontak (opsional)", "Dewi Papan Ketik"],
      ["Scope pekerjaan", "Satu video"],
      ["Fee (Rp)", "1750000"],
    ] as const) {
      await page.keyboard.press("Tab");
      await expect(dialog.getByLabel(label)).toBeFocused();
      await page.keyboard.type(value);
      await expect(dialog.getByLabel(label)).toHaveValue(value);
    }

    // From the last control, Tab comes back to the first: focus never leaves
    // the dialog for the page behind it.
    const save = dialog.getByRole("button", { name: "Simpan deal" });
    await tabTo(page, save, 12);
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);

    // Enter on Simpan deal saves.
    await tabTo(page, save, 12);
    const created = await responseTo(page, "POST", "/api/deals", () => page.keyboard.press("Enter"));
    expect(created.ok()).toBe(true);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");

    // The new card's menu, and Lihat detail in it, by keyboard.
    const card = page.locator("article", { hasText: brand });
    await expect(card).toBeVisible();
    const menuButton = card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` });
    await tabTo(page, menuButton, 80);
    await page.keyboard.press("Enter");
    const detail = page.getByRole("menuitem", { name: "Lihat detail" });
    await expect(detail).toBeVisible();
    await tabTo(page, detail, 8);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/deal\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
    await expect(page.getByLabel("Nama kontak", { exact: true })).toHaveValue("Dewi Papan Ketik");
  });
});

// The scan's own control: the helper every scan above uses must fail on a
// page that has a serious problem. Synthetic content, no application code.
test.describe("accessibility scan control", { tag: "@a11y" }, () => {
  test("control: the scan reports a field without a label and low-contrast text", async ({ page }, testInfo) => {
    await page.setContent('<html lang="id"><head><title>kontrol</title></head><body><main><h1>Kontrol</h1><input type="text"><p style="color:#bbbbbb;background:#ffffff">sulit dibaca</p></main></body></html>');
    let message = "";
    try {
      await assertNoSeriousA11yViolations(page, testInfo);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message, "the scan passed a page with known serious problems").toContain('"id": "label"');
    expect(message).toContain('"id": "color-contrast"');
  });
});
