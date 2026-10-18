// Controls for the #55 tripwire's detector (e2e/support/deal-edit-affordance.ts):
// it must see a full deal edit in each place a valid implementation could
// put it -- the card menu, a deal detail action, deal detail fields editable
// in place -- and must not mistake what the app already has for one. Without
// these, an expected failure that can never pass would look exactly like a
// working tripwire. Synthetic markup only, no application code or data.
import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { cardMenuEditAction, dealDetailEditAffordance } from "../support/deal-edit-affordance";

// The card menu (src/components/deals/deal-card.tsx) and deal detail
// (src/app/(app)/deal/[id]/deal-detail-client.tsx) as they were before #55
// shipped Ubah deal, reduced to their controls: stage moves, Lihat detail,
// the read-only core details, the contact-name field and the WhatsApp repair
// field. They stay the negative controls: none of these is a full edit.
const TODAY_MENU = `
  <div role="menu">
    <button role="menuitem">Kembali ke Nego</button>
    <button role="menuitem">Lanjut ke Konten</button>
    <button role="menuitem">Lihat detail</button>
  </div>`;
const TODAY_DETAIL = `
  <a href="/deal">← Kembali ke papan deal</a>
  <h1>Brand Contoh</h1>
  <dl>
    <dt>Fee</dt><dd>Rp 1.500.000</dd>
    <dt>Tenggat</dt><dd>20 Okt 2026</dd>
    <dt>Syarat pembayaran</dt><dd>Tidak ditentukan</dd>
    <dt>Scope pekerjaan</dt><dd>1 Reels</dd>
  </dl>
  <button>Lanjut ke Konten</button>
  <label for="contactName">Nama kontak</label><input id="contactName"><button>Simpan</button>
  <label for="contactWa">Perbaiki nomor WhatsApp</label><input id="contactWa" inputmode="tel"><button>Simpan nomor</button>`;

async function show(page: Page, { header = "", main = "", menu = "" }: { header?: string; main?: string; menu?: string }) {
  await page.setContent(`<html lang="id"><body><header>${header}</header><main>${main}${menu}</main></body></html>`);
}

test.describe("#55 tripwire detector controls", { tag: "@critical" }, () => {
  test("finds an edit item in the card menu, in Bahasa Indonesia and English", async ({ page }) => {
    for (const label of ["Ubah", "Ubah deal", "Edit", "Edit deal", "Ubah detail deal"]) {
      await show(page, { menu: TODAY_MENU.replace("</div>", `<button role="menuitem">${label}</button></div>`) });
      expect(await cardMenuEditAction(page), label).toBe(`card menu item "${label}"`);
    }
    await show(page, { menu: TODAY_MENU.replace("</div>", '<button role="menuitem" aria-label="Ubah deal Brand Contoh">Ubah</button></div>') });
    expect(await cardMenuEditAction(page)).toBe('card menu item "Ubah deal Brand Contoh"');
  });

  test("finds an edit action on deal detail, as a button or a link", async ({ page }) => {
    await show(page, { main: `${TODAY_DETAIL}<button>Ubah deal</button>` });
    expect(await dealDetailEditAffordance(page)).toBe('deal detail action "Ubah deal"');
    await show(page, { main: `${TODAY_DETAIL}<a href="/deal/1/edit">Edit deal</a>` });
    expect(await dealDetailEditAffordance(page)).toBe('deal detail action "Edit deal"');
  });

  test("finds core fields made editable in place on deal detail", async ({ page }) => {
    const cases: [string, string][] = [
      ['<label for="b">Nama brand</label><input id="b">', "brand"],
      ['<label for="s">Scope pekerjaan</label><textarea id="s"></textarea>', "scope"],
      ['<label>Fee (Rp) <input inputmode="numeric"></label>', "fee"],
      ['<label for="d">Tenggat</label><input id="d" type="date">', "deadline"],
      ['<label for="p">Payment terms</label><input id="p">', "paymentTerms"],
      ['<div role="textbox" aria-label="Fee" contenteditable="true">1500000</div>', "fee"],
    ];
    for (const [field, expected] of cases) {
      await show(page, { main: `${TODAY_DETAIL}${field}` });
      expect(await dealDetailEditAffordance(page), field).toBe(`deal detail editable field: ${expected}`);
    }
  });

  test("ignores today's menu and detail, and edit controls a person cannot use", async ({ page }) => {
    await show(page, { menu: TODAY_MENU });
    expect(await cardMenuEditAction(page)).toBeNull();
    await show(page, { main: TODAY_DETAIL });
    expect(await dealDetailEditAffordance(page)).toBeNull();

    const notAnEdit = [
      // One-field actions are not a deal edit.
      '<button role="menuitem">Ubah tahap</button>',
      '<button role="menuitem">Edit contact name</button>',
      // Hidden or disabled.
      '<button role="menuitem" hidden>Ubah deal</button>',
      '<button role="menuitem" style="display:none">Ubah deal</button>',
      '<button role="menuitem" disabled>Ubah deal</button>',
      '<button role="menuitem" aria-disabled="true">Ubah deal</button>',
    ];
    for (const item of notAnEdit) {
      await show(page, { menu: TODAY_MENU.replace("</div>", `${item}</div>`) });
      expect(await cardMenuEditAction(page), item).toBeNull();
    }
    // An edit item outside the open menu is not in the card menu.
    await show(page, { main: '<button role="menuitem">Ubah deal</button>', menu: TODAY_MENU });
    expect(await cardMenuEditAction(page)).toBeNull();

    const notEditable = [
      '<button disabled>Ubah deal</button>',
      '<button style="visibility:hidden">Ubah deal</button>',
      '<label for="f">Fee</label><input id="f" readonly>',
      '<label for="f">Fee</label><input id="f" disabled>',
      '<label for="f">Fee</label><input id="f" type="hidden">',
      '<label for="t">Tenggat</label><input id="t" style="display:none">',
    ];
    for (const control of notEditable) {
      await show(page, { main: `${TODAY_DETAIL}${control}` });
      expect(await dealDetailEditAffordance(page), control).toBeNull();
    }
    // The app's navigation is not the deal's own page.
    await show(page, { header: '<a href="/pengaturan">Edit</a>', main: TODAY_DETAIL });
    expect(await dealDetailEditAffordance(page)).toBeNull();
  });
});
