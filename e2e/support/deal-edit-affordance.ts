// Detects a full edit of a saved deal (#55, CAP-DEAL-05) wherever a valid
// implementation could put it: an action in the board card's menu, or on
// deal detail either an action that opens the edit or the core fields
// themselves made editable in place. Used by the #55 tripwire in
// e2e/deals/deal-change-keeps-invoice.spec.ts; its positive and negative
// controls are e2e/deals/deal-edit-affordance.spec.ts.
//
// Deliberately narrow. What deal detail already lets a person change -- the
// contact name, and an invalid WhatsApp number -- is not #55, and neither
// is a stage move ("Lanjut ke Konten") or a one-field action such as
// "Ubah tahap". Labels are matched in Bahasa Indonesia and English, the two
// languages of src/lib/i18n.ts.
import type { Locator, Page } from "@playwright/test";

// "Ubah", "Edit", "Ubah deal", "Edit deal", "Ubah detail deal", "Ubah data
// deal", "Edit deal <brand>" (an aria-label naming the deal, like the card's
// "Aksi lain untuk deal <brand>").
export const EDIT_DEAL_ACTION = /^(ubah|edit)( (data |detail )?deal\b.*)?$/i;

// The core fields of CAP-DEAL-05, by their label in either language. Same
// wording as the add-deal form ("Nama brand", "Fee (Rp)", "Syarat pembayaran
// (opsional)") and the read-only deal detail list ("Scope pekerjaan",
// "Tenggat", "Payment terms").
export const CORE_DEAL_FIELDS = {
  brand: /^(nama brand|brand( name)?)\b/i,
  scope: /^(scope|lingkup)( pekerjaan)?\b|^work scope\b/i,
  fee: /^fee\b/i,
  deadline: /^(tenggat|deadline)\b/i,
  paymentTerms: /^(syarat|termin) pembayaran\b|^payment terms\b/i,
} as const;

const ENABLED = ":not([disabled]):not([aria-disabled=true])";
const EDITABLE_FIELD = [
  `input:not([type=hidden]):not([readonly])${ENABLED}`,
  `textarea:not([readonly])${ENABLED}`,
  `select${ENABLED}`,
  "[contenteditable=true]",
].join(", ");

async function visibleName(locator: Locator): Promise<string | null> {
  const visible = locator.filter({ visible: true });
  if ((await visible.count()) === 0) return null;
  return (await visible.first().evaluate((element) => element.getAttribute("aria-label") || (element as HTMLElement).innerText)).trim();
}

// With a card's menu open: the menu item that edits the deal, or null.
export async function cardMenuEditAction(page: Page): Promise<string | null> {
  const item = page.getByRole("menu").getByRole("menuitem", { name: EDIT_DEAL_ACTION }).and(page.locator(ENABLED));
  const name = await visibleName(item);
  return name === null ? null : `card menu item "${name}"`;
}

// On deal detail: the action that edits the deal, or the first core field
// that can be edited in place, or null. Only the page's own main content
// counts, not the app's navigation.
export async function dealDetailEditAffordance(page: Page): Promise<string | null> {
  const main = page.getByRole("main");
  const action = main
    .getByRole("button", { name: EDIT_DEAL_ACTION })
    .or(main.getByRole("link", { name: EDIT_DEAL_ACTION }))
    .and(page.locator(ENABLED));
  const actionName = await visibleName(action);
  if (actionName !== null) return `deal detail action "${actionName}"`;
  for (const [field, label] of Object.entries(CORE_DEAL_FIELDS)) {
    const editable = main.getByLabel(label).and(page.locator(EDITABLE_FIELD));
    if ((await editable.filter({ visible: true }).count()) > 0) return `deal detail editable field: ${field}`;
  }
  return null;
}
