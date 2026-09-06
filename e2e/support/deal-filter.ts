// Reusable invariant for the /deal stage filter: at stable state, the
// browser URL, the pressed filter chip, and the visible DealBoard content
// must all describe the same effective filter. See CLAUDE.md-adjacent
// docs/testing/E2E.md for why this exists -- the V3/V4 regressions this
// suite guards against were exactly these three things disagreeing with
// each other while each individually looked fine.
import { expect, type Page } from "@playwright/test";

export type ChipLabel = "Semua" | "Invoice" | "Dibayar" | "Masuk" | "Nego" | "Deal" | "Konten";

const ALL_CHIP_LABELS: ChipLabel[] = ["Semua", "Masuk", "Nego", "Deal", "Konten", "Invoice", "Dibayar"];

export async function assertDealFilterState(
  page: Page,
  options: {
    /** Expected `tahap` query param value, or null for no param (Semua). */
    tahap: string | null;
    /** The chip that must be the only one with aria-pressed="true". */
    pressedChip: ChipLabel;
    /** Deal brand names that must be visible on the board right now. */
    visibleBrands: readonly string[];
    /** Deal brand names that must NOT be visible on the board right now. */
    hiddenBrands: readonly string[];
  },
): Promise<void> {
  // expect.poll, not a one-shot check on page.url(): Playwright's
  // goBack()/goForward() can resolve fractionally before a same-document
  // (History API-driven) navigation has actually committed, so reading
  // page.url() exactly once here raced the browser in practice.
  await expect
    .poll(() => new URL(page.url()).searchParams.get("tahap"), { message: "URL ?tahap param" })
    .toBe(options.tahap);

  const filterGroup = page.getByRole("group", { name: /filter tahap deal|filter by stage/i });
  for (const label of ALL_CHIP_LABELS) {
    const chip = filterGroup.getByRole("button", { name: label, exact: true });
    const expectedPressed = label === options.pressedChip ? "true" : "false";
    await expect(chip, `chip "${label}" aria-pressed`).toHaveAttribute("aria-pressed", expectedPressed);
  }

  for (const brand of options.visibleBrands) {
    await expect(page.getByText(brand, { exact: true }), `deal card "${brand}" visible`).toBeVisible();
  }
  for (const brand of options.hiddenBrands) {
    await expect(page.getByText(brand, { exact: true }), `deal card "${brand}" hidden`).not.toBeVisible();
  }
}
