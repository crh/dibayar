// Real-interaction coverage for resetting a WhatsApp template to its default
// (docs/testing/journey-coverage.json: SET-05).
//
// Both templates are first rewritten and saved, so there is something to
// reset. Kembalikan ke bawaan under the send template then saves on its own
// (the form has no separate "apply" step for it): the send template must be
// the default again, the reminder template and every other setting must be
// untouched, a reload must agree, and the next WhatsApp message sent from an
// invoice must be built from the default. The second reset does the same for
// the reminder template.
//
// The templates belong to the fixture owner, so the spec reseeds before and
// after. WhatsApp never leaves the machine (keepWhatsAppLocal()).
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { primaryNav } from "../support/nav";
import { reseedFixtures } from "../support/reseed";
import { keepWhatsAppLocal, parseWhatsAppLink } from "../support/follow-up";
import { escapeRegExp, press, responseTo, rupiah } from "../support/journey";

// src/lib/user-settings-validation.ts, written out rather than imported.
const DEFAULT_SEND = "Halo {brand}, berikut invoice {nomor_invoice} sebesar {jumlah}.\nJatuh tempo {jatuh_tempo}.\nDetail dan unduh PDF: {tautan}\nTerima kasih!";
const DEFAULT_CHASE = "Halo {brand}, izin mengingatkan invoice {nomor_invoice} sebesar {jumlah} yang jatuh tempo {jatuh_tempo}.\nMohon dibantu prosesnya ya. Detail: {tautan}\nTerima kasih!";
const CUSTOM_SEND = "UJI-RESET-KIRIM {nomor_invoice} {brand} {jumlah} {jatuh_tempo} {tautan}";
const CUSTOM_CHASE = "UJI-RESET-PENGINGAT {brand} {nomor_invoice} {jumlah} {jatuh_tempo} {tautan}";
const SEEDED = { issuerName: "E2E Fixture Owner", bankName: "Bank E2E Fixture", bankAccountNumber: "1234509876", bankAccountHolder: "E2E Fixture Owner" };

function templates(page: Page) {
  const region = page.getByRole("region", { name: /Template WhatsApp/ });
  return {
    send: region.getByLabel("Pesan kirim invoice"),
    chase: region.getByLabel("Pesan pengingat"),
    // One reset button under each template, in document order.
    resetSend: region.getByRole("button", { name: "Kembalikan ke bawaan" }).nth(0),
    resetChase: region.getByRole("button", { name: "Kembalikan ke bawaan" }).nth(1),
  };
}

async function expectOtherSettingsUntouched(page: Page) {
  await expect(page.getByLabel("Nama / nama usaha")).toHaveValue(SEEDED.issuerName);
  const bank = page.getByRole("region", { name: "Rekening pembayaran" });
  await expect(bank.getByLabel("Nama bank")).toHaveValue(SEEDED.bankName);
  await expect(bank.getByLabel("Nomor rekening")).toHaveValue(SEEDED.bankAccountNumber);
  await expect(bank.getByLabel("Atas nama")).toHaveValue(SEEDED.bankAccountHolder);
}

test.describe("resetting a WhatsApp template", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("Kembalikan ke bawaan restores one template's default, leaves everything else, and the next message uses it", async ({ page, context, isMobile }) => {
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoiceSent];
    await keepWhatsAppLocal(context);

    await page.goto("/");
    await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
    await expect(page).toHaveURL(/\/pengaturan$/);
    const t = templates(page);
    await expect(t.send).toHaveValue(DEFAULT_SEND);
    await expect(t.chase).toHaveValue(DEFAULT_CHASE);

    // Something to reset: both templates rewritten and saved.
    await t.send.fill(CUSTOM_SEND);
    await t.chase.fill(CUSTOM_CHASE);
    const saved = await responseTo(page, "PATCH", "/api/me/settings", () => press(page.getByRole("button", { name: "Simpan pengaturan" }), isMobile));
    expect(saved.ok()).toBe(true);
    await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
    await page.reload();
    await expect(t.send).toHaveValue(CUSTOM_SEND);
    await expect(t.chase).toHaveValue(CUSTOM_CHASE);

    // Reset the send template only. The button saves by itself.
    const reset = await responseTo(page, "PATCH", "/api/me/settings", () => press(t.resetSend, isMobile));
    expect(reset.ok()).toBe(true);
    await expect(page.getByText("Tersimpan", { exact: true })).toBeVisible();
    await expect(t.send).toHaveValue(DEFAULT_SEND);
    await expect(t.chase).toHaveValue(CUSTOM_CHASE);
    await expectOtherSettingsUntouched(page);
    await expect(page.locator('p[role="alert"]')).toHaveCount(0);

    await page.reload();
    await expect(t.send).toHaveValue(DEFAULT_SEND);
    await expect(t.chase).toHaveValue(CUSTOM_CHASE);
    await expectOtherSettingsUntouched(page);

    // The next message from an invoice is the default text again.
    await press(primaryNav(page).getByRole("link", { name: "Invoice", exact: true }), isMobile);
    await press(page.getByRole("link", { name: new RegExp(escapeRegExp(brand)) }), isMobile);
    await expect(page).toHaveURL(new RegExp(`/invoice/${manifest.invoices.sent}$`));
    const send = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
    await expect(send).toBeEnabled();
    const [popup] = await Promise.all([page.waitForEvent("popup"), press(send, isMobile)]);
    await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const message = parseWhatsAppLink(popup.url()).text ?? "";
    await popup.close();
    await expect(send).toBeEnabled();
    const link = `${escapeRegExp(new URL(page.url()).origin)}/i/[A-Za-z0-9_-]{20,}`;
    expect(message).toMatch(new RegExp(
      `^Halo ${escapeRegExp(brand)}, berikut invoice E2E/SENT/001 sebesar ${escapeRegExp(rupiah(6_000_000))}\\.\\nJatuh tempo 31 Des 2099\\.\\nDetail dan unduh PDF: ${link}\\nTerima kasih!$`,
    ));
    expect(message).not.toContain("UJI-RESET");

    // The reminder template resets the same way.
    await press(primaryNav(page).getByRole("link", { name: "Pengaturan", exact: true }), isMobile);
    await expect(page).toHaveURL(/\/pengaturan$/);
    await expect(t.chase).toHaveValue(CUSTOM_CHASE);
    const resetChase = await responseTo(page, "PATCH", "/api/me/settings", () => press(t.resetChase, isMobile));
    expect(resetChase.ok()).toBe(true);
    await expect(t.chase).toHaveValue(DEFAULT_CHASE);
    await page.reload();
    await expect(t.send).toHaveValue(DEFAULT_SEND);
    await expect(t.chase).toHaveValue(DEFAULT_CHASE);
    await expectOtherSettingsUntouched(page);
  });
});
