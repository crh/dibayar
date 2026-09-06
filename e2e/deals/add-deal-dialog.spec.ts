// ?tambah=1 is a one-shot URL trigger for the Add Deal dialog (see the
// comment above the stripping effect in src/app/(app)/deal/deal-client.tsx):
// it must open the dialog, then get stripped from the URL via
// router.replace() so reload/back don't reopen it on their own, while
// preserving any ?tahap filter that was present alongside it.
//
// Known gap (see docs/testing/E2E.md "Known limitations" / handoff): as of
// this baseline SHA there is no in-app link that actually navigates to
// ?tambah=1 -- TopBar's "+ Deal" goes to plain /deal. These tests exercise
// the URL contract directly via page.goto, which is what a future entry
// point (or an external/bookmarked link) would trigger.
import { expect, test } from "@playwright/test";
import { assertDealFilterState } from "../support/deal-filter";
import { loadFixtureManifest } from "../support/manifest";

const allBrands = () => Object.values(loadFixtureManifest().brands);
const invoiceBrands = () => {
  const m = loadFixtureManifest();
  return [m.brands[m.deals.invoicePending], m.brands[m.deals.invoiceSent]];
};

test.describe("tambah=1 add-deal dialog journey", { tag: "@critical" }, () => {
  test("/deal?tambah=1 opens the dialog, strips the param, no filter to preserve", async ({ page }) => {
    await page.goto("/deal?tambah=1");

    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/deal$/);
    await expect(page).not.toHaveURL(/tambah/);

    await dialog.getByRole("button", { name: "Tutup" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/deal$/);
  });

  test("/deal?tahap=INVOICE&tambah=1 opens the dialog and preserves the Invoice filter after cleanup", async ({ page }) => {
    await page.goto("/deal?tahap=INVOICE&tambah=1");

    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/tahap=INVOICE/);
    await expect(page).not.toHaveURL(/tambah/);

    await dialog.getByRole("button", { name: "Tutup" }).click();
    await expect(dialog).toBeHidden();

    await assertDealFilterState(page, {
      tahap: "INVOICE",
      pressedChip: "Invoice",
      visibleBrands: invoiceBrands(),
      hiddenBrands: allBrands().filter((brand) => !invoiceBrands().includes(brand)),
    });
  });

  test("dialog can be closed with Escape, and does not reopen on reload once stripped", async ({ page }) => {
    await page.goto("/deal?tambah=1");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    // Wait for the dialog's own documented focus-management effect (moves
    // focus to its first focusable element on open) to have committed,
    // rather than a fixed sleep: it's declared in the same component right
    // before the Escape-key listener effect, so React flushes both together
    // -- this is a semantic, non-flaky proxy for "the dialog is ready for
    // keyboard interaction", not just an assertion of focus itself.
    await expect(dialog.getByRole("button", { name: "Tutup" })).toBeFocused();

    await page.keyboard.press("Escape");
    // Empirically necessary, not a guess: with no wait here, this failed
    // deterministically (4/4 local repeats) even though toBeHidden()/
    // toHaveCount(0) poll for up to 5s -- the close reliably lands within a
    // few hundred ms once given ANY subsequent round trip (a page.url() or
    // isVisible() call also unblocks it), but never within the same
    // microtask turn as the keypress. Left as a short explicit wait rather
    // than a semantic assertion because no observable DOM/focus signal
    // marking "the keydown listener is attached" was found to poll on
    // instead -- see docs/testing/E2E.md "Known limitations". Bumped from
    // 300ms to 750ms after one flake under a full multi-file suite run
    // (heavier CPU contention widens the same race).
    await page.waitForTimeout(750);
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/deal$/);
  });

  test("no navigation loop / stale query state across Back after tambah=1 cleanup", async ({ page }) => {
    await page.goto("/deal");
    await page.getByRole("group", { name: /filter tahap deal/i }).getByRole("button", { name: "Invoice", exact: true }).click();
    await expect(page).toHaveURL(/tahap=INVOICE/);

    // Hard navigation (not a chip click) to a fresh tambah=1 URL, simulating
    // an external/bookmarked entry point landing on top of prior history.
    await page.goto("/deal?tambah=1");
    const dialog = page.getByRole("dialog", { name: "Tambah deal" });
    await expect(dialog).toBeVisible();
    // router.replace() rewrites this entry in place -- no new history entry,
    // and the filter from before this hard navigation is not resurrected
    // (there was no ?tahap on this URL to preserve).
    await expect(page).toHaveURL(/\/deal$/);
    await expect(page).not.toHaveURL(/tahap|tambah/);
    await dialog.getByRole("button", { name: "Tutup" }).click();

    // Back should land on the pre-existing history entry from the chip
    // click above, not reopen the dialog and not carry stale tambah state.
    await page.goBack();
    await expect(dialog).toBeHidden();
    await assertDealFilterState(page, {
      tahap: "INVOICE",
      pressedChip: "Invoice",
      visibleBrands: invoiceBrands(),
      hiddenBrands: allBrands().filter((brand) => !invoiceBrands().includes(brand)),
    });
  });
});
