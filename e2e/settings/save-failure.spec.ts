// Coverage for a settings save that fails
// (docs/testing/journey-coverage.json: SET-08).
//
// Two ways the save fails:
//
// - For real: the form has no length limit on the issuer's WhatsApp number,
//   the server allows 32 characters (src/lib/user-settings-validation.ts).
//   A longer one passes the form's own checks and the server answers 400
//   itself. Nothing is stubbed.
// - Injected: the next settings PATCH is answered with a 409 by page.route
//   before it reaches the server. The click and everything the page then
//   shows are real; the failure is a stub, so by the inventory's rules this
//   test is partial evidence.
//
// In both, the page must say the save failed, keep what was typed so it can
// be corrected, never say "Tersimpan", and a reload must show the values the
// server still holds. The spec reseeds before and after (UserSettings).
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";
import { press, responseTo } from "../support/journey";

const SAVE_ERROR = "Gagal menyimpan. Coba lagi.";
const SEEDED = { issuerName: "E2E Fixture Owner", issuerWhatsapp: "628199999999", bankName: "Bank E2E Fixture" };
const TYPED = { issuerName: "Nama Yang Tidak Tersimpan", bankName: "Bank Yang Tidak Tersimpan" };
// 33 characters: one more than the server accepts.
const TOO_LONG_WHATSAPP = "628123456789012345678901234567890";

function fields(page: Page) {
  const issuer = page.getByRole("region", { name: "Identitas penerbit" });
  return {
    issuerName: issuer.getByLabel("Nama / nama usaha"),
    issuerWhatsapp: issuer.getByLabel("Nomor WhatsApp"),
    bankName: page.getByRole("region", { name: "Rekening pembayaran" }).getByLabel("Nama bank"),
  };
}

async function openSettings(page: Page, isMobile: boolean) {
  await page.goto("/");
  await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
  await expect(page).toHaveURL(/\/pengaturan$/);
  await expect(fields(page).issuerName).toHaveValue(SEEDED.issuerName);
}

async function expectSeededAfterReload(page: Page) {
  await page.reload();
  const f = fields(page);
  await expect(f.issuerName).toHaveValue(SEEDED.issuerName);
  await expect(f.issuerWhatsapp).toHaveValue(SEEDED.issuerWhatsapp);
  await expect(f.bankName).toHaveValue(SEEDED.bankName);
  await expect(page.locator('p[role="alert"]')).toHaveCount(0);
}

test.describe("failed settings save", { tag: "@critical" }, () => {
  test.use({ expectedErrorResponses: [{ method: "PATCH", pathname: "/api/me/settings" }] });
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("a save the server rejects (WhatsApp number too long) shows an error, keeps what was typed, and stores nothing", async ({ page, isMobile }) => {
    expect(TOO_LONG_WHATSAPP).toHaveLength(33);
    await openSettings(page, isMobile);
    const f = fields(page);
    await f.issuerName.fill(TYPED.issuerName);
    await f.bankName.fill(TYPED.bankName);
    await f.issuerWhatsapp.fill(TOO_LONG_WHATSAPP);

    const rejected = await responseTo(page, "PATCH", "/api/me/settings", () => press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile));
    expect(rejected.status()).toBe(400);

    await expect(page.locator('p[role="alert"]')).toHaveText(SAVE_ERROR);
    await expect(page.getByText("Tersimpan", { exact: true })).toHaveCount(0);
    // What was typed is still there to correct, and the button works again.
    await expect(f.issuerName).toHaveValue(TYPED.issuerName);
    await expect(f.bankName).toHaveValue(TYPED.bankName);
    await expect(f.issuerWhatsapp).toHaveValue(TOO_LONG_WHATSAPP);
    await expect(page.getByRole("button", { name: "Simpan pengaturan" })).toBeEnabled();

    // None of it was stored, including the fields that were valid.
    await expectSeededAfterReload(page);
    // Back through the navigation before typing again: a field filled on a
    // freshly reloaded page can be reset when React attaches to it.
    await press(primaryNav(page).getByRole("link", { name: "Beranda", exact: true }), isMobile);
    await expect(page).toHaveURL(/\/$/);
    await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(f.issuerName).toHaveValue(SEEDED.issuerName);

    // Corrected, the same edit saves.
    await f.issuerName.fill(TYPED.issuerName);
    await f.issuerWhatsapp.fill("628123456789");
    const saved = await responseTo(page, "PATCH", "/api/me/settings", () => press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile));
    expect(saved.ok()).toBe(true);
    await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
    await page.reload();
    await expect(f.issuerName).toHaveValue(TYPED.issuerName);
    await expect(f.issuerWhatsapp).toHaveValue("628123456789");
  });

  test("a failed save shows an error and keeps the form; pressing Simpan again saves it", async ({ page, isMobile }) => {
    await openSettings(page, isMobile);
    const f = fields(page);
    await f.issuerName.fill(TYPED.issuerName);
    await f.bankName.fill(TYPED.bankName);

    // Only the next settings PATCH fails, and it never reaches the server.
    let armed = true;
    await page.route("**/api/me/settings", async (route) => {
      if (armed && route.request().method() === "PATCH") {
        armed = false;
        await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "simulated failure" }) });
        return;
      }
      await route.fallback();
    });

    const failed = await responseTo(page, "PATCH", "/api/me/settings", () => press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile));
    expect(failed.status()).toBe(409);
    await expect(page.locator('p[role="alert"]')).toHaveText(SAVE_ERROR);
    await expect(page.getByText("Tersimpan", { exact: true })).toHaveCount(0);
    await expect(f.issuerName).toHaveValue(TYPED.issuerName);
    await expect(f.bankName).toHaveValue(TYPED.bankName);
    // page.request is not intercepted by page.route: this is the stored row.
    const stored = (await (await page.request.get("/api/me/settings")).json()).settings as { issuerName: string; bankName: string };
    expect(stored.issuerName).toBe(SEEDED.issuerName);
    expect(stored.bankName).toBe(SEEDED.bankName);

    // The same form, sent again, is saved and the error goes away.
    const retried = await responseTo(page, "PATCH", "/api/me/settings", () => press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile));
    expect(retried.ok()).toBe(true);
    await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
    await expect(page.locator('p[role="alert"]')).toHaveCount(0);
    await page.reload();
    await expect(f.issuerName).toHaveValue(TYPED.issuerName);
    await expect(f.bankName).toHaveValue(TYPED.bankName);
  });
});
