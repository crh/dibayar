// Real-interaction coverage for the invoice due-date entry point
// (docs/testing/journey-coverage.json: INV-DUE-01..INV-DUE-04).
//
// Why this file exists: a Production user clicked the visible empty
// due-date field ("Not set" / "Belum ditentukan") and nothing happened,
// while the existing journey (invoice-journeys.spec.ts "due date edits and
// clears persist after reload") stayed green -- it sets the value with
// fill(), which never touches the visible entry point. Everything here acts
// on what a person actually sees: the click/tap lands on the visible
// display text's own on-screen position (computed from its bounding box,
// not hardcoded), and whatever element is really on top at that point
// receives it, exactly as for a person. A hidden, covered, or zero-size
// display therefore fails these tests instead of passing silently.
//
// Picker-open observability: Chromium (151+, Playwright 1.62's bundled
// build) supports the `:open` pseudo-class on <input type="date">, which
// matches only while the native picker is showing. That is a real browser
// state, not app state, so it cannot be satisfied by a synthetic event. It
// was probe-verified on a synthetic page before use: clicking/tapping the
// text area of an opacity-0 date input leaves `:open` false, while
// clicking its calendar-icon edge or calling showPicker() makes it true.
// Choosing a date *inside* the native picker is not observable or drivable
// from Playwright, so that step stays a manual UAT check (MAN-DUE-01 in
// docs/testing/MANUAL-UAT.md).
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/test";
import { loadFixtureManifest } from "../support/manifest";
import { reseedFixtures } from "../support/reseed";

const EMPTY_LABEL = "Belum ditentukan";

function isInvoicePatch(invoiceId: string) {
  return (response: { request(): { method(): string }; url(): string }) =>
    response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/invoices/${invoiceId}`;
}

// Reaches the empty state through the UI a person would use (the visible
// "Kosongkan" button), then proves it survived a reload.
async function openInvoiceWithEmptyDueDate(page: Page, invoiceId: string) {
  await page.goto(`/invoice/${invoiceId}`);
  const clearPatch = page.waitForResponse(isInvoicePatch(invoiceId));
  await page.getByRole("button", { name: "Kosongkan" }).click();
  expect((await clearPatch).ok()).toBe(true);
  await page.reload();
}

// The visible display is aria-hidden by design (the real <input> carries the
// accessible name), so it is located by text inside the field's own wrapper
// rather than by role.
function dueDateDisplay(page: Page): Locator {
  return page.locator("#invoice-due-date").locator("xpath=..").getByText(EMPTY_LABEL, { exact: true });
}

async function activateVisibleText(page: Page, display: Locator, isMobile: boolean) {
  await display.scrollIntoViewIfNeeded();
  await expect(display).toBeVisible();
  await expect(display).toBeInViewport();
  const box = await display.boundingBox();
  expect(box, "visible due-date display has no layout box").not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test.describe("invoice due-date entry through the visible field", { tag: "@critical" }, () => {
  test.beforeEach(reseedFixtures);

  test("an invoice whose due date was cleared shows the empty state after reload", async ({ page }) => {
    const manifest = loadFixtureManifest();
    await openInvoiceWithEmptyDueDate(page, manifest.invoices.sent);

    await expect(dueDateDisplay(page)).toBeVisible();
    await expect(page.getByLabel("Tanggal jatuh tempo")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Kosongkan" })).toHaveCount(0);
  });

  // KNOWN DEFECT (INV-DUE-02, Production report 2026-10-03): the field is a
  // full-size opacity-0 native date input over the display text. Chromium
  // opens a date input's picker only from its calendar-icon edge (or
  // showPicker()/keyboard), so a click/tap on the visible text focuses an
  // invisible segment and nothing visible happens. test.fail() keeps this
  // running in the PR gate as an expected failure: the day a product fix
  // lands, this test starts passing, Playwright reports it as an
  // unexpected pass, and the annotation must be removed in that fix PR.
  // It is not a skip and is not counted as coverage in the inventory.
  test("clicking or tapping the visible empty due-date field opens the date picker", async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== "chromium", "picker-open state is observed via :open, probe-verified in Chromium only; other engines are manual UAT MAN-DUE-01");
    test.fail(true, "Known defect INV-DUE-02: the visible empty due-date field does not open the picker on click/tap. Remove this line in the fix PR.");

    const manifest = loadFixtureManifest();
    await openInvoiceWithEmptyDueDate(page, manifest.invoices.sent);

    const input = page.getByLabel("Tanggal jatuh tempo");
    const supportsOpen = await input.evaluate((element) => {
      try {
        element.matches(":open");
        return true;
      } catch {
        return false;
      }
    });
    expect(supportsOpen, ":open unsupported -- this browser cannot observe the picker").toBe(true);

    await activateVisibleText(page, dueDateDisplay(page), isMobile);
    await expect.poll(() => input.evaluate((element) => element.matches(":open")), { timeout: 2_000 }).toBe(true);
  });

  // Desktop keyboard entry is a real user path for this control: a click on
  // the visible field focuses the native input, and typing fills its
  // segments. Not run on chromium-mobile (a phone user has no segment
  // keyboard; the picker is their only path -- see the test above and
  // MAN-DUE-01) or on Firefox/WebKit (segment typing differs per engine and
  // has not been verified there).
  //
  // KNOWN DEFECT (INV-DUE-04 / FIND-03, found by this test on 2026-10-03):
  // Chromium emits a complete, valid value as soon as the first year digit
  // is typed ("0002-01-15", then "0020-...", "0203-...", "2030-..."). The
  // DateField commits on every change, the API accepts year 0002, and the
  // owner's invoice page then throws ("Expected an ISO yyyy-mm-dd date,
  // received: 2-01-15") into the route error boundary -- on every later
  // load too, so the owner can no longer reach the field to fix it.
  // test.fail() keeps it visible in the PR gate until the fix PR (server
  // range validation plus not committing partial keyboard input) removes it.
  test("keyboard date entry after clicking the visible field saves, survives reload, and clears", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "desktop Chromium keyboard path; mobile and other engines are covered by MAN-DUE-01");
    test.fail(true, "Known defect FIND-03: typing a year saves year 0002 and breaks the invoice page. Remove this line in the fix PR.");

    const manifest = loadFixtureManifest();
    const invoiceId = manifest.invoices.sent;
    await openInvoiceWithEmptyDueDate(page, invoiceId);

    const input = page.getByLabel("Tanggal jatuh tempo");
    await activateVisibleText(page, dueDateDisplay(page), false);
    await expect(input).toBeFocused();

    // Move to the first segment wherever the click landed, then type the
    // date in segment order. Playwright's bundled Chromium orders the
    // segments month/day/year in this suite's id-ID context (probe-verified
    // 2026-10-03: "01152030" -> 2030-01-15); a real Indonesian-locale Chrome
    // may order them day/month/year, which MAN-DUE-01 covers by hand.
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowLeft");
    const patches: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH" && new URL(request.url()).pathname === `/api/invoices/${invoiceId}`) {
        patches.push(request.postData() ?? "");
      }
    });
    await page.keyboard.type("01152030", { delay: 50 });

    const fieldWrapper = page.locator("#invoice-due-date").locator("xpath=..");
    await expect(fieldWrapper.getByText("15 Jan 2030", { exact: true })).toBeVisible();
    await expect(input).toHaveValue("2030-01-15");
    await page.waitForLoadState("networkidle");
    // The last save must carry the date the person typed, whatever partial
    // values the browser emitted on the way there.
    expect(patches.at(-1)).toContain("2030-01-15");

    await page.reload();
    await expect(fieldWrapper.getByText("15 Jan 2030", { exact: true })).toBeVisible();
    await expect(input).toHaveValue("2030-01-15");

    const clearPatch = page.waitForResponse(isInvoicePatch(invoiceId));
    await page.getByRole("button", { name: "Kosongkan" }).click();
    expect((await clearPatch).ok()).toBe(true);
    await page.reload();
    await expect(dueDateDisplay(page)).toBeVisible();
  });
});
