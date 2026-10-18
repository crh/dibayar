// Editing a saved deal (#55; docs/product/capabilities.json CAP-DEAL-05,
// CAP-DEAL-06, CAP-DEAL-08).
//
// "Ubah deal" is in every board card's menu and on deal detail. It opens the
// create form prefilled with the deal, with Simpan perubahan and Batal. The
// page sends only the changed fields, never a stage, and reports a save only
// once the deal read back from the server holds it. Everything here is
// driven through visible controls on the fixture deals and checked after a
// reload, except two things a browser test cannot drive for real:
//
// - the deadline is a native date input. Desktop Chromium types it with the
//   keyboard (as e2e/journeys/deal-to-paid.spec.ts does for the due date);
//   the phone project leaves it alone, and clearing it uses fill(""), which
//   counts as partial. A real phone's date picker is MAN-DEAL-EDIT-01.
// - a server that fails or a session that ended is stubbed with page.route
//   (partial); the real 400 is the server's own.
//
// An invoiced deal's edit and its invoice: e2e/deals/deal-change-keeps-invoice.spec.ts.
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";
import { E2E_FIXTURE_PREFIX } from "../support/fixture-ids";
import { press, responseTo, rupiah, typeInto } from "../support/journey";

const NEGO_DEAL_PATCH = { method: "PATCH", pathname: `/api/deals/${E2E_FIXTURE_PREFIX}-deal-nego` };

function editDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Ubah deal" });
}

async function openFromCard(page: Page, brand: string, isMobile: boolean) {
  const card = page.locator("article", { hasText: brand });
  await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
  await press(page.getByRole("menu").getByRole("menuitem", { name: "Ubah deal" }), isMobile);
  await expect(editDialog(page)).toBeVisible();
}

async function replace(page: Page, field: Locator, value: string, isMobile: boolean) {
  await field.fill("");
  await typeInto(page, field, value, isMobile);
}

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test.describe("edit a saved deal (#55)", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  test("Ubah deal from the card menu changes brand, WhatsApp number, scope, fee and payment terms; the deal keeps its stage and history, and the change survives a reload", async ({ page, isMobile }, testInfo) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.nego;
    const brand = manifest.brands[dealId];
    const typesDeadline = testInfo.project.name === "chromium";
    const edited = { brand: "E2E Brand Nego Diubah", contactWa: "0812 7777 6655", contactWaShown: "+62 812-7777-6655", scope: "Dua video pendek dan satu story", fee: 3_250_000, paymentTerms: "Lunas 14 hari setelah tayang" };

    await page.goto("/deal");
    await openFromCard(page, brand, isMobile);
    const dialog = editDialog(page);
    await expect(dialog.getByLabel("Nama brand")).toHaveValue(brand);
    await expect(dialog.getByLabel("Kontak WhatsApp")).toHaveValue("628110000002");
    await expect(dialog.getByLabel(/^Fee \(Rp\)/)).toHaveValue("2000000");
    await noSidewaysScroll(page);

    await replace(page, dialog.getByLabel("Nama brand"), edited.brand, isMobile);
    await replace(page, dialog.getByLabel("Kontak WhatsApp"), edited.contactWa, isMobile);
    await replace(page, dialog.getByLabel("Scope pekerjaan"), edited.scope, isMobile);
    await replace(page, dialog.getByLabel(/^Fee \(Rp\)/), String(edited.fee), isMobile);
    await replace(page, dialog.getByLabel("Syarat pembayaran (opsional)"), edited.paymentTerms, isMobile);
    if (typesDeadline) {
      await dialog.getByLabel("Tenggat").focus();
      for (const key of "12152030") await page.keyboard.press(key);
      await expect(dialog.getByLabel("Tenggat")).toHaveValue("2030-12-15");
    }

    const saved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(dialog.getByRole("button", { name: "Simpan perubahan" }), isMobile));
    expect(saved.ok()).toBe(true);
    const sent = JSON.parse(saved.request().postData() ?? "{}");
    expect(sent).not.toHaveProperty("status");
    expect(Object.keys(sent).sort()).toEqual(["brand", "contactWa", "feeIdr", "paymentTerms", "scope", ...(typesDeadline ? ["deadline"] : [])].sort());
    await expect(page.getByRole("status").filter({ hasText: "Perubahan deal disimpan." })).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // The board, after a reload: the card in the same column, new values.
    await page.reload();
    const card = page.locator("article", { hasText: edited.brand });
    await expect(card).toContainText(rupiah(edited.fee));
    await expect(page.locator("article", { hasText: brand }).filter({ hasNotText: edited.brand })).toHaveCount(0);

    // Deal detail: every value, the same stage, and no new history entry.
    await page.goto(`/deal/${dealId}`);
    await expect(page.getByRole("heading", { level: 1, name: edited.brand })).toBeVisible();
    await expect(page.getByText("Tahap saat ini: Nego")).toBeVisible();
    await expect(page.getByText(rupiah(edited.fee))).toBeVisible();
    await expect(page.getByText(edited.contactWaShown, { exact: true })).toBeVisible();
    await expect(page.getByText(edited.scope)).toBeVisible();
    await expect(page.getByText(edited.paymentTerms)).toBeVisible();
    if (typesDeadline) await expect(page.getByText("15 Des 2030")).toBeVisible();
    await expect(page.getByRole("main").locator("ol > li")).toHaveCount(1);
    await expect(page.getByText("Deal dibuat langsung di tahap Nego", { exact: true })).toBeVisible();
  });

  test("Ubah deal on deal detail clears the contact name and payment terms, and they stay empty after a reload (CAP-DEAL-08)", async ({ page, isMobile }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.invoiceSent;
    // Give the deal a contact name first, through its own field.
    await page.goto(`/deal/${dealId}`);
    await typeInto(page, page.getByLabel("Nama kontak", { exact: true }), "Kontak Sementara", isMobile);
    await press(page.getByRole("button", { name: "Simpan", exact: true }), isMobile);
    await expect(page.getByRole("status").filter({ hasText: "Nama kontak disimpan" })).toBeVisible();
    await expect(page.getByText("30 hari setelah invoice diterima")).toBeVisible();

    await press(page.getByRole("button", { name: "Ubah deal" }), isMobile);
    const dialog = editDialog(page);
    await expect(dialog.getByLabel("Nama kontak (opsional)")).toHaveValue("Kontak Sementara");
    await expect(dialog.getByLabel("Syarat pembayaran (opsional)")).toHaveValue("30 hari setelah invoice diterima");
    // The deal has an invoice: the dialog says the invoice is left alone.
    await expect(dialog.getByRole("note")).toContainText("Deal ini sudah punya invoice E2E/SENT/001");
    await dialog.getByLabel("Nama kontak (opsional)").fill("");
    await dialog.getByLabel("Syarat pembayaran (opsional)").fill("");
    const saved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(dialog.getByRole("button", { name: "Simpan perubahan" }), isMobile));
    expect(JSON.parse(saved.request().postData() ?? "{}")).toEqual({ contactName: null, paymentTerms: null });
    await expect(page.getByRole("status").filter({ hasText: "Perubahan deal disimpan." })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Nama kontak", { exact: true })).toHaveValue("");
    await expect(page.getByText("30 hari setelah invoice diterima")).toHaveCount(0);
    await expect(page.getByText("Tahap saat ini: Invoice")).toBeVisible();
  });

  test("emptying the contact name field on deal detail clears it and says so, after a reload too (FIND-11)", async ({ page, isMobile }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.konten;
    await page.goto(`/deal/${dealId}`);
    const field = page.getByLabel("Nama kontak", { exact: true });
    await typeInto(page, field, "Nama Yang Akan Dihapus", isMobile);
    await press(page.getByRole("button", { name: "Simpan", exact: true }), isMobile);
    await expect(page.getByRole("status").filter({ hasText: "Nama kontak disimpan" })).toBeVisible();
    await page.reload();
    await expect(field).toHaveValue("Nama Yang Akan Dihapus");

    await field.fill("");
    const saved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(page.getByRole("button", { name: "Simpan", exact: true }), isMobile));
    expect(JSON.parse(saved.request().postData() ?? "{}")).toEqual({ contactName: null });
    await expect(page.getByRole("status").filter({ hasText: "Nama kontak dihapus" })).toBeVisible();
    await page.reload();
    await expect(field).toHaveValue("");
  });

  test("clearing the deadline in the editor removes it (partial: fill on a native date input)", async ({ page, isMobile }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.deal;
    await page.goto(`/deal/${dealId}`);
    await press(page.getByRole("button", { name: "Ubah deal" }), isMobile);
    await editDialog(page).getByLabel("Tenggat").fill("2030-06-01");
    await press(editDialog(page).getByRole("button", { name: "Simpan perubahan" }), isMobile);
    await expect(page.getByRole("status").filter({ hasText: "Perubahan deal disimpan." })).toBeVisible();
    await expect(page.getByText("1 Jun 2030")).toBeVisible();

    await press(page.getByRole("button", { name: "Ubah deal" }), isMobile);
    await expect(editDialog(page).getByLabel("Tenggat")).toHaveValue("2030-06-01");
    await editDialog(page).getByLabel("Tenggat").fill("");
    const saved = await responseTo(page, "PATCH", `/api/deals/${dealId}`, () => press(editDialog(page).getByRole("button", { name: "Simpan perubahan" }), isMobile));
    expect(JSON.parse(saved.request().postData() ?? "{}")).toEqual({ deadline: null });
    // The page reads the deal back before it says so; reloading earlier would
    // cancel that read.
    await expect(page.getByRole("status").filter({ hasText: "Perubahan deal disimpan." })).toBeVisible();
    await page.reload();
    await expect(page.getByText("1 Jun 2030")).toHaveCount(0);
  });

  test("a WhatsApp number WhatsApp cannot open is refused on its field and nothing is sent; Batal then asks before throwing the edit away, and nothing changed", async ({ page, isMobile }) => {
    const manifest = loadFixtureManifest();
    const dealId = manifest.deals.masuk;
    const brand = manifest.brands[dealId];
    let patched = false;
    page.on("request", (request) => {
      if (request.method() === "PATCH" && new URL(request.url()).pathname === `/api/deals/${dealId}`) patched = true;
    });

    await page.goto("/deal");
    await openFromCard(page, brand, isMobile);
    const dialog = editDialog(page);
    await replace(page, dialog.getByLabel("Kontak WhatsApp"), "12345", isMobile);
    await press(dialog.getByRole("button", { name: "Simpan perubahan" }), isMobile);
    await expect(dialog.getByText("Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.")).toBeVisible();
    await expect(dialog.getByLabel("Kontak WhatsApp")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByLabel("Kontak WhatsApp")).toBeFocused();

    await press(dialog.getByRole("button", { name: "Batal" }), isMobile);
    const confirm = page.getByRole("alertdialog", { name: "Buang perubahan yang belum disimpan?" });
    await expect(confirm).toBeVisible();
    await press(confirm.getByRole("button", { name: "Lanjut mengubah" }), isMobile);
    await expect(dialog.getByLabel("Kontak WhatsApp")).toHaveValue("12345");
    await press(dialog.getByRole("button", { name: "Batal" }), isMobile);
    await press(page.getByRole("alertdialog").getByRole("button", { name: "Buang perubahan" }), isMobile);
    await expect(dialog).toHaveCount(0);
    expect(patched, "nothing was sent").toBe(false);

    await page.reload();
    await openFromCard(page, brand, isMobile);
    await expect(editDialog(page).getByLabel("Kontak WhatsApp")).toHaveValue("628110000001");
    // Unchanged: Batal closes straight away.
    await press(editDialog(page).getByRole("button", { name: "Batal" }), isMobile);
    await expect(editDialog(page)).toHaveCount(0);
  });

  test("every stage's card offers Ubah deal", async ({ page, isMobile }) => {
    const manifest = loadFixtureManifest();
    await page.goto("/deal");
    for (const key of ["masuk", "nego", "deal", "konten", "invoicePending", "invoiceSent", "dibayar"] as const) {
      const brand = manifest.brands[manifest.deals[key]];
      const card = page.locator("article", { hasText: brand });
      await press(card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }), isMobile);
      await expect(page.getByRole("menu").getByRole("menuitem", { name: "Ubah deal" }), `${key} card`).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
    }
  });
});

// Partial: the failure is stubbed with page.route. What is stored is read
// with page.request, which page.route does not intercept.
test.describe("a deal edit the server does not take (#55)", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);
  test.afterEach(reseedFixtures);

  for (const [status, text] of [
    [500, "belum pasti tersimpan"],
    [401, "sesi kamu sudah berakhir"],
  ] as const) {
    test.describe(`answered ${status}`, () => {
      test.use({ expectedErrorResponses: [{ ...NEGO_DEAL_PATCH, status }] });

      test(`says so, keeps the dialog and the edit, and stores nothing (${status})`, async ({ page, isMobile }) => {
        const manifest = loadFixtureManifest();
        const dealId = manifest.deals.nego;
        const brand = manifest.brands[dealId];
        await page.route((url) => url.pathname === NEGO_DEAL_PATCH.pathname, (route) =>
          route.request().method() === "PATCH" ? route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: "x" }) }) : route.fallback(),
        );

        await page.goto("/deal");
        await openFromCard(page, brand, isMobile);
        const dialog = editDialog(page);
        await replace(page, dialog.getByLabel("Nama brand"), "E2E Brand Tidak Tersimpan", isMobile);
        await press(dialog.getByRole("button", { name: "Simpan perubahan" }), isMobile);

        await expect(dialog.getByRole("alert")).toContainText(text);
        await expect(dialog.getByLabel("Nama brand")).toHaveValue("E2E Brand Tidak Tersimpan");
        await expect(dialog.getByRole("button", { name: "Simpan perubahan" })).toBeEnabled();
        await expect(page.getByText("Perubahan deal disimpan.")).toHaveCount(0);

        const stored = await (await page.request.get(`/api/deals/${dealId}`)).json();
        expect(stored.deal.brand).toBe(brand);
        expect(stored.deal.status).toBe("NEGO");
      });
    });
  }
});
