// Real-interaction coverage for the Add Deal form's required-field check and
// its optional text fields (docs/testing/journey-coverage.json:
// DEAL-CREATE-06, and the automatable part of DEAL-CREATE-07).
//
// The form relies on the browser's own validation (`required` on brand,
// WhatsApp, scope and fee; deal-form.tsx): an incomplete submit sends
// nothing, focuses the first missing field and shows the browser's bubble.
// The bubble is browser chrome and not in the DOM, so the tests check what
// it stands on: which field has focus, which fields report themselves
// invalid, that no create request left the page, and that the dialog is
// still open with what was typed.
//
// The dialog is opened the way each viewport offers: the top bar's "+ Deal"
// at >=640px, the floating button on a phone.
//
// The deadline is a native date input. On desktop a person can type it with
// the keyboard, and the two deadline tests do exactly that (real keys into
// the field's own segments, desktop Chromium only). On a phone the only way
// in is the OS date picker, which Playwright cannot drive or observe: no test
// here sets a deadline in the phone project, and that stays MAN-DEAL-01 on a
// real device.
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { reseedFixtures } from "../support/reseed";
import { press, responseTo } from "../support/journey";

const NBSP = " ";
const REQUIRED = ["Nama brand", "Kontak WhatsApp", "Scope pekerjaan", "Fee (Rp)"] as const;

async function openAddDealFromBeranda(page: Page, isMobile: boolean): Promise<Locator> {
  await page.goto("/");
  // getByRole skips hidden elements, so this is the one "+ Deal" a person
  // sees: the floating button on a phone, the top-bar link otherwise.
  const plusDeal = page.getByRole("link", { name: "+ Deal", exact: true });
  await expect(plusDeal).toBeVisible();
  if (isMobile) await plusDeal.tap();
  else await plusDeal.click();
  const dialog = page.getByRole("dialog", { name: "Tambah deal" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/deal$/);
  return dialog;
}

function recordDealCreates(page: Page): string[] {
  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/deals") sent.push(request.url());
  });
  return sent;
}

// Fields the browser currently refuses to submit, by label.
async function invalidRequiredFields(dialog: Locator): Promise<string[]> {
  const invalid: string[] = [];
  for (const label of REQUIRED) {
    if (await dialog.getByLabel(label).evaluate((element) => !(element as HTMLInputElement).validity.valid)) invalid.push(label);
  }
  return invalid;
}

async function openDetailFromCard(page: Page, brand: string) {
  const card = page.locator("article", { hasText: brand });
  await expect(card).toBeVisible();
  // A card has no link of its own; detail is reached through its menu.
  await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
  await page.getByRole("menuitem", { name: "Lihat detail" }).click();
  await expect(page).toHaveURL(/\/deal\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: brand })).toBeVisible();
}

// A deal detail value by its label ("Tenggat", "Syarat pembayaran").
function detailValue(page: Page, label: string): Locator {
  return page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd");
}

// Types a date into the dialog's deadline field the way a desktop user does:
// a click on the field, then digits through the keyboard into its segments.
// Segment order is month/day/year with Playwright's bundled Chromium (the
// same order e2e/invoices/due-date-integrity.spec.ts relies on); the value
// check would catch a different order loudly.
async function typeDeadline(page: Page, dialog: Locator, digits: string, value: string) {
  const deadline = dialog.getByLabel("Tenggat");
  await expect(deadline).toHaveAttribute("type", "date");
  await deadline.click();
  await expect(deadline).toBeFocused();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowLeft");
  await page.keyboard.type(digits, { delay: 30 });
  await expect(deadline).toHaveValue(value);
}

test.describe("add-deal form validation and optional fields", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("Simpan deal with required fields missing sends nothing and points at the first missing field; completing them saves the deal", async ({ page, isMobile }) => {
    const dialog = await openAddDealFromBeranda(page, isMobile === true);
    const creates = recordDealCreates(page);
    const save = dialog.getByRole("button", { name: "Simpan deal" });

    // Everything empty: all four required fields are refused, the first one
    // gets the focus (where the browser shows its message), nothing is sent.
    await save.click();
    await expect(dialog.getByLabel("Nama brand")).toBeFocused();
    expect(await dialog.getByLabel("Nama brand").evaluate((element) => (element as HTMLInputElement).validationMessage.length > 0)).toBe(true);
    expect(await invalidRequiredFields(dialog)).toEqual([...REQUIRED]);
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(creates).toEqual([]);

    // One field at a time: the check moves on to the next missing field and
    // still sends nothing.
    const brand = `E2E Validasi Brand ${Date.now()}`;
    await dialog.getByLabel("Nama brand").fill(brand);
    await save.click();
    await expect(dialog.getByLabel("Kontak WhatsApp")).toBeFocused();
    expect(await invalidRequiredFields(dialog)).toEqual(["Kontak WhatsApp", "Scope pekerjaan", "Fee (Rp)"]);

    await dialog.getByLabel("Kontak WhatsApp").fill("628177000021");
    await dialog.getByLabel("Scope pekerjaan").fill("Satu video ulasan");
    await save.click();
    await expect(dialog.getByLabel("Fee (Rp)")).toBeFocused();
    expect(await invalidRequiredFields(dialog)).toEqual(["Fee (Rp)"]);
    // What was typed is still there, and still nothing was sent.
    await expect(dialog.getByLabel("Nama brand")).toHaveValue(brand);
    expect(creates).toEqual([]);

    // Complete: the same button now saves.
    await dialog.getByLabel("Fee (Rp)").fill("1250000");
    const createResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals",
    );
    await save.click();
    expect((await createResponse).ok()).toBe(true);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");
    expect(creates).toHaveLength(1);

    await page.reload();
    const card = page.locator("article", { hasText: brand });
    await expect(card).toBeVisible();
    await expect(card.getByText(`Rp${NBSP}1.250.000`)).toBeVisible();
    // Exactly one deal with that name: the refused attempts created nothing.
    await expect(page.locator("article", { hasText: brand })).toHaveCount(1);
  });

  test("optional contact name and payment terms are saved and shown on the deal's detail page after reload", async ({ page, isMobile }) => {
    const dialog = await openAddDealFromBeranda(page, isMobile === true);
    const brand = `E2E Opsional Brand ${Date.now()}`;
    await dialog.getByLabel("Nama brand").fill(brand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000022");
    await dialog.getByLabel("Nama kontak (opsional)").fill("Sari Brand Manager");
    await dialog.getByLabel("Scope pekerjaan").fill("Dua foto produk");
    await dialog.getByLabel("Fee (Rp)").fill("2100000");
    await dialog.getByLabel("Syarat pembayaran (opsional)").fill("DP 50%, pelunasan 7 hari setelah tayang");

    const createResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals",
    );
    await dialog.getByRole("button", { name: "Simpan deal" }).click();
    expect((await createResponse).ok()).toBe(true);
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");

    await page.reload();
    await openDetailFromCard(page, brand);
    await expect(page.getByLabel("Nama kontak", { exact: true })).toHaveValue("Sari Brand Manager");
    await expect(page.getByText("DP 50%, pelunasan 7 hari setelah tayang")).toBeVisible();
    await expect(page.getByText("Dua foto produk")).toBeVisible();
    // Still there after reloading the detail page itself. Let the page finish
    // loading first: Firefox reports requests a reload cuts short (here the
    // favicon) as failed.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByLabel("Nama kontak", { exact: true })).toHaveValue("Sari Brand Manager");
    await expect(page.getByText("DP 50%, pelunasan 7 hari setelah tayang")).toBeVisible();
  });

  test("a deal saved without the optional fields shows them as empty, not as leftover text", async ({ page, isMobile }) => {
    const dialog = await openAddDealFromBeranda(page, isMobile === true);
    const brand = `E2E Tanpa Opsional ${Date.now()}`;
    await dialog.getByLabel("Nama brand").fill(brand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000023");
    await dialog.getByLabel("Scope pekerjaan").fill("Satu story");
    await dialog.getByLabel("Fee (Rp)").fill("500000");
    const createResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/deals",
    );
    await dialog.getByRole("button", { name: "Simpan deal" }).click();
    expect((await createResponse).ok()).toBe(true);

    await page.reload();
    // No deadline was set: the card and the detail page both say so.
    await expect(page.locator("article", { hasText: brand }).getByText("Tanpa tenggat", { exact: true })).toBeVisible();
    await openDetailFromCard(page, brand);
    await expect(page.getByLabel("Nama kontak", { exact: true })).toHaveValue("");
    await expect(page.getByText("Sari Brand Manager")).toHaveCount(0);
    await expect(detailValue(page, "Tenggat")).toHaveText("Tanpa tenggat");
    await expect(detailValue(page, "Syarat pembayaran")).toHaveText("Tidak ditentukan");
  });

  test("a deadline typed on the keyboard is saved, shown on the card and the detail page after reload, and becomes the new invoice's due date", async ({ page, isMobile }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path; a phone's date picker is MAN-DEAL-01");
    const dialog = await openAddDealFromBeranda(page, isMobile === true);
    const brand = `E2E Tenggat Brand ${Date.now()}`;
    await dialog.getByLabel("Nama brand").fill(brand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000024");
    await dialog.getByLabel("Scope pekerjaan").fill("Satu video unboxing");
    await dialog.getByLabel("Fee (Rp)").fill("3200000");
    await typeDeadline(page, dialog, "01152030", "2030-01-15");
    await dialog.getByLabel("Syarat pembayaran (opsional)").fill("Lunas 14 hari setelah tayang");

    const created = await responseTo(page, "POST", "/api/deals", () => press(dialog.getByRole("button", { name: "Simpan deal" }), isMobile));
    expect(created.ok()).toBe(true);
    const dealId = ((await created.json()) as { deal: { id: string } }).deal.id;
    await expect(page.getByRole("status")).toHaveText("Deal disimpan");

    await page.reload();
    const card = page.locator("article", { hasText: brand });
    await expect(card.getByText("15 Jan 2030", { exact: true })).toBeVisible();
    await expect(card.getByText("Tanpa tenggat")).toHaveCount(0);

    // Masuk -> Nego from the card's menu, then on to Invoice on deal detail.
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    const moved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => page.getByRole("menuitem", { name: "Lanjut ke Nego" }).click());
    expect(moved.ok()).toBe(true);
    await openDetailFromCard(page, brand);
    await expect(detailValue(page, "Tenggat")).toHaveText("15 Jan 2030");
    await expect(detailValue(page, "Syarat pembayaran")).toHaveText("Lunas 14 hari setelah tayang");
    for (const stage of ["Deal", "Konten", "Invoice"]) {
      const patch = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => page.getByRole("button", { name: `Lanjut ke ${stage}`, exact: true }).click());
      expect(patch.ok()).toBe(true);
      await expect(page.getByText(`Tahap saat ini: ${stage}`)).toBeVisible();
    }
    // The stage moves did not touch the deadline.
    await page.reload();
    await expect(detailValue(page, "Tenggat")).toHaveText("15 Jan 2030");

    // The invoice made from this deal starts with the deadline as its due date.
    const invoiced = await responseTo(page, "POST", "/api/invoices", () => page.getByRole("button", { name: "Buat invoice" }).click());
    expect(invoiced.ok()).toBe(true);
    await page.getByRole("link", { name: /^Lihat invoice / }).click();
    await expect(page).toHaveURL(/\/invoice\/[^/]+$/);
    await expect(page.getByText("Jatuh tempo: 15 Jan 2030")).toBeVisible();
    await expect(page.getByLabel("Tanggal jatuh tempo")).toHaveValue("2030-01-15");
    await expect(page.getByText("Belum ditentukan")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeEnabled();
    await page.reload();
    await expect(page.getByText("Jatuh tempo: 15 Jan 2030")).toBeVisible();
    await expect(page.getByLabel("Tanggal jatuh tempo")).toHaveValue("2030-01-15");
  });

  test("a different typed deadline (a leap day) is the one stored, and a deal without one starts its invoice with no due date", async ({ page, isMobile }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path; a phone's date picker is MAN-DEAL-01");
    const dialog = await openAddDealFromBeranda(page, isMobile === true);
    const brand = `E2E Tenggat Kabisat ${Date.now()}`;
    await dialog.getByLabel("Nama brand").fill(brand);
    await dialog.getByLabel("Kontak WhatsApp").fill("628177000025");
    await dialog.getByLabel("Scope pekerjaan").fill("Satu carousel");
    await dialog.getByLabel("Fee (Rp)").fill("900000");
    await typeDeadline(page, dialog, "02292028", "2028-02-29");
    const created = await responseTo(page, "POST", "/api/deals", () => press(dialog.getByRole("button", { name: "Simpan deal" }), isMobile));
    expect(created.ok()).toBe(true);

    await page.reload();
    await expect(page.locator("article", { hasText: brand }).getByText("29 Feb 2028", { exact: true })).toBeVisible();
    await openDetailFromCard(page, brand);
    await expect(detailValue(page, "Tenggat")).toHaveText("29 Feb 2028");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(detailValue(page, "Tenggat")).toHaveText("29 Feb 2028");

    // The seeded Invoice-stage deal has no deadline and no invoice yet: its
    // new invoice has no due date, so the default above came from the deal.
    await page.goto("/deal");
    const seededBrand = "E2E Brand Invoice Pending";
    await openDetailFromCard(page, seededBrand);
    await expect(detailValue(page, "Tenggat")).toHaveText("Tanpa tenggat");
    const invoiced = await responseTo(page, "POST", "/api/invoices", () => page.getByRole("button", { name: "Buat invoice" }).click());
    expect(invoiced.ok()).toBe(true);
    await page.getByRole("link", { name: /^Lihat invoice / }).click();
    await expect(page).toHaveURL(/\/invoice\/[^/]+$/);
    await expect(page.getByText("Jatuh tempo: Belum ditentukan")).toBeVisible();
    await expect(page.getByLabel("Tanggal jatuh tempo")).toHaveValue("");
  });
});
