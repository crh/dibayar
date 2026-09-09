// Registry of the only elements allowed to be an "intentional horizontal
// scroll ancestor" for detectHorizontalOverflow (see ./detectors.ts) and the
// Deals desktop-scroll regression (see ../routes/deals.desktop-scroll.spec.ts).
//
// Policy model (see docs/testing/UX_AUDIT.md "Scroll policy"):
//   PAGE_HORIZONTAL_SCROLL       = forbidden, everywhere, always
//   DEALS_BOARD_DESKTOP_SCROLL   = forbidden (laptop1280/desktop1440/desktop1920)
//   DEALS_BOARD_MOBILE_SCROLL    = allowed (mobile375/tablet768)
//   EXPLICIT_SCROLL_CONTAINER    = allowed only for the containers listed below
//
// To declare a new intentional scroll container: add one entry here with a
// concrete selector match (never a broad role/aria-label pattern -- an
// unrelated element that happens to share a role must still be reported)
// and a `reason` explaining what it is and why it's allowed to scroll. Do
// not add a wildcard/catch-all rule.
export type ScrollExceptionRule = {
  /** Human-readable id, used in report output. */
  id: string;
  /** Matches an element whose `dataset.testid` equals this value. */
  testid?: string;
  /** Matches an element whose `dataset.uxScroll` equals this value. */
  uxScroll?: string;
  reason: string;
};

export const ALLOWED_SCROLL_CONTAINERS: readonly ScrollExceptionRule[] = [
  {
    id: "deal-board-rail",
    testid: "deal-board-rail",
    reason:
      "Deals pipeline stage rail. Intentionally horizontally scrollable at " +
      "mobile375/tablet768 (stacked full-width stage sections). At " +
      "laptop1280/desktop1440/desktop1920 it must NOT actually need to " +
      "scroll -- enforced separately by routes/deals.desktop-scroll.spec.ts, " +
      "not by this exemption (this only keeps the generic overflow detector " +
      "from flagging the mobile/tablet case as page-level overflow).",
  },
  {
    id: "stage-filter-chip-rail",
    uxScroll: "stage-filter",
    reason: "Deal stage/status filter chip row. Intentional horizontal scroll at narrow widths (see stage-filter.tsx).",
  },
];

export function isAllowedScrollContainerDataset(dataset: { testid?: string; uxScroll?: string }): boolean {
  return ALLOWED_SCROLL_CONTAINERS.some(
    (rule) =>
      (rule.testid !== undefined && dataset.testid === rule.testid) ||
      (rule.uxScroll !== undefined && dataset.uxScroll === rule.uxScroll),
  );
}
