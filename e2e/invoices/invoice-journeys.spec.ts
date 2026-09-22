import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

// Money is formatted with a non-breaking space after "Rp" (see
// src/lib/format/money.ts and CLAUDE.md's IDR formatting rule) -- a plain
// space in a locator regex never matches it.   (not a literal
// character in this source) keeps that explicit rather than invisible.
const NBSP = " ";

test.describe("invoice journeys", { tag: "@critical" }, () => {
  // Reseed before each test: "create an invoice" depends on a deal having
  // no invoice yet, which a prior run (in another project sharing this
  // database within the same invocation) may have already created. See
  // e2e/support/reseed.ts.
  test.beforeEach(reseedFixtures);

  test("create an invoice from a pending INVOICE-stage deal", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoicePending];

    await page.goto("/deal?tahap=INVOICE");
    const card = page.locator("article", { hasText: brand });
    await card.getByRole("button", { name: `Aksi lain untuk deal ${brand}` }).click();
    await page.getByRole("menuitem", { name: "Buat invoice" }).click();

    await expect(page.getByRole("status")).toHaveText("Invoice dibuat");
    await page.reload();
    await page.goto("/invoice");
    await expect(page.getByRole("link", { name: new RegExp(brand) })).toBeVisible();
  });

  test("invoice list navigates to invoice detail with matching totals", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const brand = manifest.brands[manifest.deals.invoiceSent];

    await page.goto("/invoice");
    await expect(page.getByRole("heading", { level: 1, name: "Invoice" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(brand) }).click();

    await expect(page).toHaveURL(/\/invoice\//);
    await expect(page.getByRole("heading", { name: `Rp${NBSP}6.000.000` })).toBeVisible();
  });

  test("mark an invoice paid, then undo", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    await page.getByRole("button", { name: "Tandai lunas" }).click();
    await expect(page.getByRole("heading", { name: "Status pembayaran" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Batalkan status lunas" })).toBeVisible();

    await page.getByRole("button", { name: "Batalkan status lunas" }).click();
    await expect(page.getByRole("button", { name: "Tandai lunas" })).toBeVisible();
  });

  test("share link can be created, recovered after reload, regenerated, and revoked", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    await expect(page.getByRole("button", { name: "Buat ulang tautan" })).toBeVisible();
    await page.getByRole("button", { name: "Cabut tautan" }).click();
    await page.getByRole("button", { name: "Ya, cabut tautan" }).click();
    await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
    await page.getByRole("button", { name: "Buat tautan berbagi" }).click();

    const linkTrack = page.getByTestId("share-link-track");
    await expect(linkTrack).toBeVisible();
    const firstLink = await linkTrack.locator("span[title]").getAttribute("title");
    expect(firstLink).toMatch(/\/i\/[A-Za-z0-9_-]{40,}$/);

    await page.reload();
    await expect(linkTrack.locator("span[title]")).toHaveAttribute("title", firstLink!);

    await page.getByRole("button", { name: "Buat ulang tautan" }).click();
    await page.getByRole("button", { name: "Ya, buat tautan baru" }).click();
    await expect(linkTrack.locator("span[title]")).not.toHaveAttribute("title", firstLink!);

    await page.getByRole("button", { name: "Cabut tautan" }).click();
    await page.getByRole("button", { name: "Ya, cabut tautan" }).click();
    await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Belum ada tautan berbagi untuk invoice ini.")).toBeVisible();
  });

  test("due date edits and clears persist after reload", async ({ page }, testInfo) => {
    // Playwright cannot drive Chromium's native date picker reliably in the
    // emulated mobile project: fill() leaves the date input unchanged. The
    // persistence contract is covered on desktop; mobile still covers the
    // rendered invoice and all other invoice actions.
    test.skip(testInfo.project.name === "chromium-mobile", "native mobile date input is not automation-stable");
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    const dueDate = page.getByLabel("Tanggal jatuh tempo");
    const patchUrl = (response: Awaited<ReturnType<typeof page.waitForResponse>>) =>
      response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${manifest.invoices.sent}`;

    // The "Tersimpan" toast is a 2-second-lived UI affordance (see
    // src/components/date-field.tsx's SAVED_DISPLAY_MS), already covered
    // deterministically with fake timers in date-field.test.tsx. Asserting
    // on it here raced real wall-clock time against browser/network speed
    // under load -- WebKit failed this specifically when the full
    // e2e-cross-browser suite ran under local machine contention (this
    // file's own test in isolation, and every other project, passed). The
    // product requirement this journey test actually owns is persistence,
    // not toast timing: wait for the PATCH that saves the due date to
    // resolve (the real "did it save" signal), then prove persistence with
    // a reload, exactly as this test already did for the value itself.
    const savePatch = page.waitForResponse(patchUrl);
    await dueDate.fill("2030-01-15");
    expect((await savePatch).ok()).toBe(true);
    await expect(dueDate).toHaveValue("2030-01-15");

    await page.reload();
    await expect(dueDate).toHaveValue("2030-01-15");

    const clearPatch = page.waitForResponse(patchUrl);
    await page.getByRole("button", { name: "Kosongkan" }).click();
    expect((await clearPatch).ok()).toBe(true);
    await page.reload();
    await expect(dueDate).toHaveValue("");
  });

  test("WhatsApp action opens a saved-template message with the invoice link", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    const action = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
    await expect(action).toBeEnabled();
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      action.click(),
    ]);

    await expect.poll(() => popup.url()).toContain("api.whatsapp.com/send");
    const popupUrl = new URL(popup.url());
    expect(popupUrl.searchParams.get("phone")).toBe("628110000006");
    const message = popupUrl.searchParams.get("text");
    expect(message).toContain("E2E Brand Invoice Terkirim");
    expect(message).toContain("E2E/SENT/001");
    expect(message).toMatch(/Rp\s6\.000\.000/);
    expect(message).toContain("http://localhost:3300/i/");
    await popup.close();
  });

  // E2E-IMPROVEMENT-PLAN.md C2: invoice-detail-client.tsx (search "F15
  // fallback") already has a manual-link fallback for when window.open()
  // comes back blocked -- this proves it, rather than assuming it works.
  // Playwright doesn't expose a cross-browser "simulate a popup blocker"
  // toggle, but the app's own detection is exactly "window.open() returned
  // null" (see sendWhatsApp in invoice-detail-client.tsx), which is the
  // real signal every browser's popup blocker actually produces -- so
  // stubbing window.open() to return null via an init script reproduces
  // the same code path a real blocked popup would take, deterministically
  // and cross-browser, without depending on any one engine's own
  // popup-blocking heuristics (which differ and aren't Playwright-
  // controllable anyway).
  test("a blocked WhatsApp popup falls back to a clickable manual link", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await page.addInitScript(() => {
      window.open = () => null;
    });
    await page.goto(`/invoice/${manifest.invoices.sent}`);

    await expect(page.getByText("Buka WhatsApp")).toHaveCount(0);
    await page.getByRole("button", { name: "Kirim lewat WhatsApp" }).click();

    const fallbackLink = page.getByRole("link", { name: "Buka WhatsApp" });
    await expect(fallbackLink).toBeVisible();
    // buildWhatsAppShareUrl builds a wa.me link directly (see
    // src/lib/whatsapp.ts); it only resolves to api.whatsapp.com/send on
    // an actual navigation/redirect, which this test deliberately never
    // triggers -- the point here is the fallback link itself exists and
    // is correctly addressed, not the redirect target.
    const href = await fallbackLink.getAttribute("href");
    expect(href).toContain("https://wa.me/628110000006");
    expect(await fallbackLink.getAttribute("target")).toBe("_blank");
  });
});
