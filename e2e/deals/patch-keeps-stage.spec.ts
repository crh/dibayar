// Regression for FIND-10, and real-interaction coverage for editing a deal's
// contact name (docs/testing/journey-coverage.json: DEAL-DETAIL-02).
//
// FIND-10: every change to a deal that did not itself name a stage -- saving
// the contact name, repairing the WhatsApp number on deal detail, on invoice
// detail or in the Beranda queue -- also moved the deal back to Masuk and
// wrote a "<stage> → Masuk" line into its history. The PATCH schema was the
// create schema made partial, and partial() keeps the create schema's
// `status: "MASUK"` default. The page kept showing the old stage until the
// next load, so nothing looked wrong at the moment of saving.
//
// Both tests therefore assert the stage and the stage history after a
// reload, on a deal that is not at Masuk:
//
// - the contact name, typed and saved on a Nego deal's detail page;
// - a WhatsApp number repaired from invoice detail, where the deal is at
//   Invoice and already has an invoice (the costliest case: the deal would
//   leave the Invoice column while its invoice stays).
//
// The second test's deal starts with a number the API accepts but WhatsApp
// cannot use ("12345678"), typed into the add-deal dialog like any other.
// WhatsApp never leaves the machine (keepWhatsAppLocal()).
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";
import { keepWhatsAppLocal } from "../support/follow-up";
import { press, responseTo } from "../support/journey";

async function openDealFromBoard(page: Page, brand: string, isMobile: boolean) {
  await page.goto("/deal");
  const card = page.locator("article", { hasText: brand });
  await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
  await press(page.getByRole("menuitem", { name: "Lihat detail" }), isMobile);
  await expect(page).toHaveURL(/\/deal\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
}

// The stage history, top to bottom, without the dates.
async function stageHistory(page: Page): Promise<string[]> {
  const items = page.locator("div", { has: page.getByRole("heading", { name: "Riwayat tahap" }) }).last().getByRole("listitem");
  return (await items.locator("span").first().count()) === 0 ? [] : items.evaluateAll((nodes) => nodes.map((node) => node.querySelector("span")?.textContent ?? ""));
}

test.describe("changing a deal's contact keeps its stage (FIND-10)", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("a contact name typed on deal detail is saved, survives a reload, and leaves the deal's stage and history alone", async ({ page, isMobile }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.nego;
    const brand = manifest.brands[dealId];
    await openDealFromBoard(page, brand, isMobile);
    await expect(page).toHaveURL(new RegExp(`/deal/${dealId}$`));

    const field = page.getByLabel("Nama kontak", { exact: true });
    const save = page.getByRole("button", { name: "Simpan", exact: true });
    const saved = page.getByRole("status").filter({ hasText: "Nama kontak disimpan" });
    // The seeded deal has no contact name, and one history entry.
    await expect(field).toHaveValue("");
    await expect(field).toHaveAttribute("placeholder", "Belum diisi");
    await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();
    expect(await stageHistory(page)).toEqual(["Deal dibuat langsung di tahap Nego"]);

    await field.fill("Rina Kemitraan");
    const first = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(save, isMobile));
    expect(first.ok()).toBe(true);
    expect(((await first.json()) as { deal: { status: string } }).deal.status).toBe("NEGO");
    await expect(saved).toBeVisible();
    await expect(field).toHaveValue("Rina Kemitraan");
    await expect(page.getByRole("alert").filter({ hasText: "Nama kontak belum bisa disimpan" })).toHaveCount(0);

    await page.reload();
    await expect(field).toHaveValue("Rina Kemitraan");
    // Nothing else about the deal changed: same stage, same single history
    // entry, same number, and the stage buttons of a Nego deal.
    await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();
    expect(await stageHistory(page)).toEqual(["Deal dibuat langsung di tahap Nego"]);
    await expect(page.getByText("+62 811-0000-002", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lanjut ke Deal", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kembali ke Masuk", exact: true })).toBeVisible();

    // A second edit replaces the first.
    await field.fill("Bima Pemasaran");
    const second = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(save, isMobile));
    expect(second.ok()).toBe(true);
    await expect(saved).toBeVisible();
    await page.reload();
    await expect(field).toHaveValue("Bima Pemasaran");
    await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();

    // The board agrees: still in Nego, not back in Masuk.
    await page.goto("/deal");
    const stageFilter = page.getByRole("group", { name: /filter tahap deal/i });
    await press(stageFilter.getByRole("button", { name: "Nego", exact: true }), isMobile);
    await expect(page.locator("article", { hasText: brand })).toBeVisible();
    await press(stageFilter.getByRole("button", { name: "Masuk", exact: true }), isMobile);
    await expect(page.locator("article", { hasText: brand })).toHaveCount(0);
    // And through the board again, not only this page's own reload.
    await openDealFromBoard(page, brand, isMobile);
    await expect(field).toHaveValue("Bima Pemasaran");
    expect(await stageHistory(page)).toEqual(["Deal dibuat langsung di tahap Nego"]);
  });

  test("a WhatsApp number repaired from invoice detail leaves the deal at Invoice", async ({ page, context, isMobile }) => {
    const brand = "E2E Brand Nomor Diperbaiki";
    await keepWhatsAppLocal(context);

    // A deal whose number WhatsApp cannot use, taken to Invoice and invoiced.
    await page.goto("/deal?tambah=1");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await dialog.getByLabel("Nama brand").fill(brand);
    await dialog.getByLabel("Kontak WhatsApp").fill("12345678");
    await dialog.getByLabel("Scope pekerjaan").fill("Satu video");
    await dialog.getByLabel("Fee (Rp)").fill("1500000");
    const created = await responseTo(page, "POST", "/api/deals", () => press(dialog.getByRole("button", { name: "Simpan deal" }), isMobile));
    const dealId = ((await created.json()) as { deal: { id: string } }).deal.id;
    await expect(dialog).toHaveCount(0);
    await openDealFromBoard(page, brand, isMobile);
    for (const stage of ["Nego", "Deal", "Konten", "Invoice"]) {
      const moved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("button", { name: `Lanjut ke ${stage}`, exact: true }), isMobile));
      expect(moved.ok()).toBe(true);
      await expect(page.getByText(`Tahap saat ini: ${stage}`)).toBeVisible();
    }
    const invoiced = await responseTo(page, "POST", "/api/invoices", () => press(page.getByRole("button", { name: "Buat invoice" }), isMobile));
    expect(invoiced.ok()).toBe(true);
    await press(page.getByRole("link", { name: /^Lihat invoice .+ →$/ }), isMobile);
    await expect(page).toHaveURL(/\/invoice\/[^/]+$/);

    // Kirim lewat WhatsApp asks for a usable number instead of opening a chat.
    const send = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
    await expect(send).toBeEnabled();
    await press(send, isMobile);
    await expect(page.getByRole("alert").filter({ hasText: "Nomor WhatsApp belum valid" })).toBeVisible();
    const repair = page.locator("#invoice-contact-wa");
    await expect(repair).toHaveValue("12345678");
    await repair.fill("0812-3456-7890");
    const [popup, patched] = await Promise.all([
      page.waitForEvent("popup"),
      responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("button", { name: "Simpan & kirim" }), isMobile)),
    ]);
    expect(patched.ok()).toBe(true);
    const body = (await patched.json()) as { deal: { status: string; contactWa: string } };
    expect(body.deal.contactWa).toBe("6281234567890");
    expect(body.deal.status).toBe("INVOICE");
    await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    await popup.close();
    await expect(send).toBeEnabled();

    // The deal is still at Invoice, with its invoice, and no move back to Masuk.
    await openDealFromBoard(page, brand, isMobile);
    await expect(page.getByText("Tahap saat ini: Invoice")).toBeVisible();
    await expect(page.getByText("+62 812-3456-7890", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Lihat invoice .+ →$/ })).toBeVisible();
    expect(await stageHistory(page)).toEqual(["Konten → Invoice", "Deal → Konten", "Nego → Deal", "Masuk → Nego", "Deal dibuat langsung di tahap Masuk"]);
    await page.goto("/deal");
    const stageFilter = page.getByRole("group", { name: /filter tahap deal/i });
    await press(stageFilter.getByRole("button", { name: "Masuk", exact: true }), isMobile);
    await expect(page.locator("article", { hasText: brand })).toHaveCount(0);
    await press(stageFilter.getByRole("button", { name: "Invoice", exact: true }), isMobile);
    await expect(page.locator("article", { hasText: brand })).toBeVisible();
  });
});
