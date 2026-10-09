// Real-interaction regressions for FIND-02 and FIND-03 (invoice due date).
//
// FIND-02: the visible due-date field is a full-size opacity-0 native
// <input type="date"> over the formatted text. Chromium opens a date input's
// picker only from its calendar-icon edge, so clicking/tapping the visible
// text did nothing. Fixed by DateField calling showPicker() on click.
//
// FIND-03: a native date input emits a complete-looking value on every
// intermediate year digit ("0002-01-15", "0020-01-15", ...). DateField saved
// every change, the API accepted year 0002, and the owner's invoice page then
// failed on every load ("Gagal memuat."). Fixed by: keyboard edits commit
// only on Enter / leaving the field; the API accepts only a strict yyyy-mm-dd
// inside 2000-01-01..2099-12-31 (src/lib/due-date.ts); and a legacy bad row
// renders as a correctable "Tanggal tidak valid" instead of crashing.
//
// Everything acts on what a person sees: clicks/taps land on the visible
// display text's own on-screen position (from its bounding box), and keys go
// through the real keyboard. No fill(), no synthetic events.
//
// Picker-open observability: Chromium supports the `:open` pseudo-class on
// <input type="date">, true only while the native picker is showing -- a
// real browser state, not app state. Chromium must support it (a missing
// `:open` fails there); other engines without `:open` skip that
// assertion (feature-detected, not assumed). Choosing a date *inside* the
// native picker cannot be driven from Playwright; that stays manual UAT.
import type { Locator, Page, Request } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures, seedLegacyInvalidDueDate } from "../support/reseed";
import { E2E_FIXTURE_PREFIX } from "../support/fixture-ids";
import { activateVisibleText, DUE_DATE_FIELD_LABEL as FIELD_LABEL, focusFieldForTyping, visibleDisplay } from "../support/due-date";

const EMPTY_LABEL = "Belum ditentukan";
const INVALID_STORED_LABEL = "Tanggal tidak valid";
// The seeded SENT invoice's due date (FIXTURE_FUTURE_DATE).
const SEEDED_DISPLAY = "31 Des 2099";
const SAVE_ERROR = "Tanggal jatuh tempo belum bisa diperbarui. Coba lagi.";

function isInvoicePatchRequest(invoiceId: string) {
  return (request: Request) =>
    request.method() === "PATCH" && new URL(request.url()).pathname === `/api/invoices/${invoiceId}`;
}

// Records every due-date PATCH body the page sends, from now on.
function recordDueDatePatches(page: Page, invoiceId: string): Array<string | null> {
  const sent: Array<string | null> = [];
  const matches = isInvoicePatchRequest(invoiceId);
  page.on("request", (request) => {
    if (!matches(request)) return;
    const body = JSON.parse(request.postData() ?? "{}") as { dueDate?: string | null };
    if ("dueDate" in body) sent.push(body.dueDate ?? null);
  });
  return sent;
}

function expectOnlySupportedDueDates(sent: Array<string | null>) {
  for (const value of sent) {
    if (value === null) continue;
    expect(value, "a partial or malformed due date was sent").toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(value >= "2000-01-01" && value <= "2099-12-31", `out-of-range due date was sent: ${value}`).toBe(true);
  }
}

async function supportsOpenPseudoClass(input: Locator): Promise<boolean> {
  return input.evaluate((element) => {
    try {
      element.matches(":open");
      return true;
    } catch {
      return false;
    }
  });
}

// Tab first walks the native date input's own segments, so keep tabbing
// until focus has really left the field (a person's "I'm done here").
async function leaveFieldWithTab(page: Page) {
  const input = page.getByLabel(FIELD_LABEL);
  for (let i = 0; i < 4 && (await input.evaluate((element) => element === document.activeElement)); i += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(input).not.toBeFocused();
}

async function clearThroughUi(page: Page, invoiceId: string) {
  const clearPatch = page.waitForResponse((response) => isInvoicePatchRequest(invoiceId)(response.request()));
  await page.getByRole("button", { name: "Kosongkan" }).click();
  expect((await clearPatch).ok()).toBe(true);
}

test.describe("invoice due-date integrity (FIND-02, FIND-03)", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  for (const state of ["empty", "filled"] as const) {
    test(`clicking or tapping the visible ${state} due-date text opens the native date picker`, async ({ page, browserName, isMobile }) => {
      const manifest = loadFixtureManifest();
      const invoiceId = manifest.invoices.sent;
      await page.goto(`/invoice/${invoiceId}`);
      if (state === "empty") {
        await clearThroughUi(page, invoiceId);
        await page.reload();
      }

      const input = page.getByLabel(FIELD_LABEL);
      // Chromium is known to support :open, so there it must never skip: a
      // missing :open fails loudly below instead. Other engines are
      // feature-detected.
      const openSupported = await supportsOpenPseudoClass(input);
      test.skip(browserName !== "chromium" && !openSupported, ":open is unsupported here, so the native picker state is not observable; covered by manual UAT");
      await expect.poll(() => input.evaluate((element) => element.matches(":open"))).toBe(false);

      await activateVisibleText(page, visibleDisplay(page, state === "empty" ? EMPTY_LABEL : SEEDED_DISPLAY), isMobile);
      await expect.poll(() => input.evaluate((element) => element.matches(":open")), { timeout: 2_000 }).toBe(true);
    });
  }

  // Desktop keyboard entry: the path that saved year 0002. Desktop Chromium
  // only -- a phone user has no segment keyboard (the picker is their path,
  // above), and segment typing differs per engine (manual UAT elsewhere).
  // Segment order is month/day/year in this suite's id-ID context with
  // Playwright's bundled Chromium (probe-verified: "01152030" -> 2030-01-15);
  // the final toHaveValue() would catch a different order loudly.
  test("keyboard year entry never sends a partial or out-of-range date, saves on Enter, survives reload, and clears", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path");
    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    await page.goto(`/invoice/${invoiceId}`);
    await clearThroughUi(page, invoiceId);
    await page.reload();

    const input = page.getByLabel(FIELD_LABEL);
    await focusFieldForTyping(page, visibleDisplay(page, EMPTY_LABEL));
    const sent = recordDueDatePatches(page, invoiceId);

    // Digit by digit, checking after every key that nothing was sent -- the
    // year digits pass through 0002-01-15, 0020-01-15, 0203-01-15.
    const seenIntermediate: string[] = [];
    for (const digit of "01152030") {
      await page.keyboard.press(digit);
      seenIntermediate.push(await input.inputValue());
      expect(sent, `a PATCH was sent mid-typing after "${digit}"`).toEqual([]);
    }
    // Proves the test really drove the input through the old failure value.
    expect(seenIntermediate).toContain("0002-01-15");
    await expect(input).toHaveValue("2030-01-15");
    await expect(visibleDisplay(page, "15 Jan 2030")).toBeVisible();

    const savePatch = page.waitForResponse((response) => isInvoicePatchRequest(invoiceId)(response.request()));
    await page.keyboard.press("Enter");
    expect((await savePatch).ok()).toBe(true);
    // Leaving the field after Enter must not send it again.
    await leaveFieldWithTab(page);
    await page.waitForLoadState("networkidle");
    expect(sent).toEqual(["2030-01-15"]);
    expectOnlySupportedDueDates(sent);

    await page.reload();
    await expect(visibleDisplay(page, "15 Jan 2030")).toBeVisible();
    await expect(input).toHaveValue("2030-01-15");

    await clearThroughUi(page, invoiceId);
    await page.reload();
    await expect(visibleDisplay(page, EMPTY_LABEL)).toBeVisible();
    await expect(input).toHaveValue("");
  });

  test("a typed year outside the supported range is refused on leaving the field and nothing is saved", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path");
    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    await page.goto(`/invoice/${invoiceId}`);
    await clearThroughUi(page, invoiceId);
    await page.reload();

    const input = page.getByLabel(FIELD_LABEL);
    await focusFieldForTyping(page, visibleDisplay(page, EMPTY_LABEL));
    const sent = recordDueDatePatches(page, invoiceId);
    await page.keyboard.type("01150002", { delay: 30 });
    await expect(input).toHaveValue("0002-01-15");

    await leaveFieldWithTab(page);
    await expect(page.getByText(/Tanggal belum lengkap atau di luar rentang/)).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await page.waitForLoadState("networkidle");
    expect(sent).toEqual([]);

    await page.reload();
    await expect(visibleDisplay(page, EMPTY_LABEL)).toBeVisible();
    await expect(input).toHaveValue("");
  });

  test("typing over an existing date never clears it mid-edit, and Escape restores it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path");
    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    await page.goto(`/invoice/${invoiceId}`);

    const input = page.getByLabel(FIELD_LABEL);
    await focusFieldForTyping(page, visibleDisplay(page, SEEDED_DISPLAY));
    const sent = recordDueDatePatches(page, invoiceId);
    // A single month digit leaves the native input incomplete (value ""),
    // which the old field saved as a clear.
    await page.keyboard.press("0");
    await page.keyboard.press("Escape");
    await expect(input).toHaveValue("2099-12-31");
    await expect(visibleDisplay(page, SEEDED_DISPLAY)).toBeVisible();
    await leaveFieldWithTab(page);
    await page.waitForLoadState("networkidle");
    expect(sent).toEqual([]);

    await page.reload();
    await expect(input).toHaveValue("2099-12-31");
  });

  test("a legacy year-0002 due date keeps the invoice page usable and can be cleared", async ({ page }) => {
    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    seedLegacyInvalidDueDate();

    await page.goto(`/invoice/${invoiceId}`);
    await expect(page.getByText("Gagal memuat.")).toHaveCount(0);
    await expect(page.getByText("E2E/SENT/001").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rincian invoice" })).toBeVisible();
    await expect(visibleDisplay(page, INVALID_STORED_LABEL)).toBeVisible();
    await expect(page.getByText(/Tanggal jatuh tempo yang tersimpan tidak valid/)).toBeVisible();
    await expect(page.getByLabel(FIELD_LABEL)).toHaveAttribute("aria-invalid", "true");
    // Shown as a problem, never as a real-looking date.
    await expect(page.getByText(/\b15 Jan 2\b/)).toHaveCount(0);

    await clearThroughUi(page, invoiceId);
    await page.reload();
    await expect(visibleDisplay(page, EMPTY_LABEL)).toBeVisible();
    await expect(page.getByText(/tersimpan tidak valid/)).toHaveCount(0);
  });

  test("a legacy year-0002 due date can be corrected by typing a new date", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path");
    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    seedLegacyInvalidDueDate();
    await page.goto(`/invoice/${invoiceId}`);

    const input = page.getByLabel(FIELD_LABEL);
    await focusFieldForTyping(page, visibleDisplay(page, INVALID_STORED_LABEL));
    const sent = recordDueDatePatches(page, invoiceId);
    await page.keyboard.type("01152030", { delay: 30 });
    const savePatch = page.waitForResponse((response) => isInvoicePatchRequest(invoiceId)(response.request()));
    await page.keyboard.press("Enter");
    expect((await savePatch).ok()).toBe(true);
    expect(sent).toEqual(["2030-01-15"]);

    await page.reload();
    await expect(visibleDisplay(page, "15 Jan 2030")).toBeVisible();
    await expect(input).toHaveValue("2030-01-15");
    await expect(input).not.toHaveAttribute("aria-invalid", "true");
  });

  test("a legacy year-0002 due date does not break the dashboard, invoice list, or public invoice", async ({ page }) => {
    const manifest = loadFixtureManifest();
    seedLegacyInvalidDueDate();

    // Beranda lists attention invoices by brand; the invoice list and the
    // public page show the number. browserDiagnostics (support/test.ts)
    // separately fails the test on any page error or 5xx along the way.
    for (const [path, expected] of [
      ["/", "E2E Brand Invoice Terkirim"],
      ["/invoice", "E2E/SENT/001"],
      [`/i/${manifest.shareTokens.active}`, "E2E/SENT/001"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByText(expected).first(), `${path} did not render the legacy invoice`).toBeVisible();
      await expect(page.getByText("Gagal memuat.")).toHaveCount(0);
    }
  });

  // PR #26 review: a failed save must never leave the attempted date (or an
  // empty field, after a failed clear) on screen as if it were saved. The
  // field shows the stored date again beside the error, and a retry works.
  // The failure is injected in the browser with page.route as a 409 so only
  // the next due-date PATCH fails; the client treats any non-OK response or
  // network error the same way. The real database is checked through
  // page.request, which page.route does not intercept.
  test.describe("failed saves", () => {
    test.use({ expectedErrorResponses: [{ method: "PATCH", pathname: `/api/invoices/${E2E_FIXTURE_PREFIX}-invoice-sent` }] });

    async function failNextDueDatePatch(page: Page, invoiceId: string) {
      let armed = true;
      await page.route(`**/api/invoices/${invoiceId}`, async (route) => {
        if (armed && route.request().method() === "PATCH") {
          armed = false;
          await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "simulated failure" }) });
          return;
        }
        await route.fallback();
      });
    }

    async function storedDueDate(page: Page, invoiceId: string) {
      return (await (await page.request.get(`/api/invoices/${invoiceId}`)).json()).invoice.dueDate as string | null;
    }

    test("a failed Kosongkan shows the stored date again with an error, and a retry clears it", async ({ page }) => {
      const manifest = loadFixtureManifest();
      const invoiceId = manifest.invoices.sent;
      expect(invoiceId).toBe(`${E2E_FIXTURE_PREFIX}-invoice-sent`);
      await page.goto(`/invoice/${invoiceId}`);
      const input = page.getByLabel(FIELD_LABEL);
      await failNextDueDatePatch(page, invoiceId);

      const failed = page.waitForResponse((response) => isInvoicePatchRequest(invoiceId)(response.request()));
      await page.getByRole("button", { name: "Kosongkan" }).click();
      expect((await failed).status()).toBe(409);

      await expect(page.getByText(SAVE_ERROR)).toBeVisible();
      await expect(visibleDisplay(page, SEEDED_DISPLAY)).toBeVisible();
      await expect(visibleDisplay(page, EMPTY_LABEL)).toHaveCount(0);
      await expect(input).toHaveValue("2099-12-31");
      await expect(page.getByText("Tersimpan", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Kosongkan" })).toBeVisible();
      expect(await storedDueDate(page, invoiceId)).toBe("2099-12-31T00:00:00.000Z");

      await clearThroughUi(page, invoiceId);
      await expect(visibleDisplay(page, EMPTY_LABEL)).toBeVisible();
      await expect(page.getByText(SAVE_ERROR)).toHaveCount(0);
      expect(await storedDueDate(page, invoiceId)).toBeNull();
      await page.reload();
      await expect(visibleDisplay(page, EMPTY_LABEL)).toBeVisible();
    });

    test("a failed typed date (Enter) shows the stored date again with an error, and retyping saves it", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path");
      const manifest = loadFixtureManifest();
      const invoiceId = manifest.invoices.sent;
      await page.goto(`/invoice/${invoiceId}`);
      const input = page.getByLabel(FIELD_LABEL);
      await failNextDueDatePatch(page, invoiceId);
      const sent = recordDueDatePatches(page, invoiceId);

      await focusFieldForTyping(page, visibleDisplay(page, SEEDED_DISPLAY));
      await page.keyboard.type("01152030", { delay: 30 });
      await expect(input).toHaveValue("2030-01-15");
      const failed = page.waitForResponse((response) => isInvoicePatchRequest(invoiceId)(response.request()));
      await page.keyboard.press("Enter");
      expect((await failed).status()).toBe(409);

      await expect(page.getByText(SAVE_ERROR)).toBeVisible();
      await expect(visibleDisplay(page, SEEDED_DISPLAY)).toBeVisible();
      await expect(input).toHaveValue("2099-12-31");
      expect(await storedDueDate(page, invoiceId)).toBe("2099-12-31T00:00:00.000Z");

      await focusFieldForTyping(page, visibleDisplay(page, SEEDED_DISPLAY));
      await page.keyboard.type("01152030", { delay: 30 });
      const saved = page.waitForResponse((response) => isInvoicePatchRequest(invoiceId)(response.request()));
      await page.keyboard.press("Enter");
      expect((await saved).ok()).toBe(true);
      await expect(visibleDisplay(page, "15 Jan 2030")).toBeVisible();
      await expect(page.getByText(SAVE_ERROR)).toHaveCount(0);
      await leaveFieldWithTab(page);
      await page.waitForLoadState("networkidle");
      expect(sent).toEqual(["2030-01-15", "2030-01-15"]);

      await page.reload();
      await expect(input).toHaveValue("2030-01-15");
    });
  });

  // The server contract, against the real database (unit tests cover the
  // same cases with a mocked adapter). Browser-independent, so run once.
  test("the API refuses malformed, impossible, and out-of-range due dates and leaves the stored date unchanged", async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "browser-independent API contract; runs once");
    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    const patch = (dueDate: unknown) =>
      page.request.patch(`/api/invoices/${invoiceId}`, { data: { dueDate }, headers: { origin: baseURL! } });
    const storedDueDate = async () => (await (await page.request.get(`/api/invoices/${invoiceId}`)).json()).invoice.dueDate;

    expect(await storedDueDate()).toBe("2099-12-31T00:00:00.000Z");
    for (const bad of ["0002-01-15", "1999-12-31", "2100-01-01", "2026-02-30", "2026-13-01", "2026-1-5", "2030-01-15T00:00:00.000Z", " 2030-01-15", "", 1_900_000_000_000]) {
      const response = await patch(bad);
      expect(response.status(), `dueDate ${JSON.stringify(bad)}`).toBe(400);
      expect(await storedDueDate(), `stored date changed after ${JSON.stringify(bad)}`).toBe("2099-12-31T00:00:00.000Z");
    }

    for (const [good, stored] of [
      ["2000-01-01", "2000-01-01T00:00:00.000Z"],
      ["2028-02-29", "2028-02-29T00:00:00.000Z"],
      ["2099-12-31", "2099-12-31T00:00:00.000Z"],
    ] as const) {
      const response = await patch(good);
      expect(response.status(), `dueDate ${good}`).toBe(200);
      expect(await storedDueDate()).toBe(stored);
    }

    const cleared = await patch(null);
    expect(cleared.status()).toBe(200);
    expect(await storedDueDate()).toBeNull();
  });
});
