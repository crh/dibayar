// The required viewport bands for the general-purpose route x state x
// viewport UX audit matrix (deals.desktop-scroll.spec.ts, matrix.spec.ts,
// needs-chasing.spec.ts). Deliberately separate from ./viewports.ts, which
// the T-00/T-27 historical specs (baseline.landing, fixtures.baseline,
// t27.verification) still enumerate with hardcoded artifact-count
// assertions (e.g. "5 viewports x 2 languages = 10") -- adding or renaming
// entries there would silently change those counts. Add/remove a band here
// to change what the generic matrix and the Deals desktop-scroll regression
// cover; it has no effect on the historical specs.
export const UX_VIEWPORT_MATRIX = {
  mobile375: { width: 375, height: 812 },
  tablet768: { width: 768, height: 1024 },
  laptop1280: { width: 1280, height: 800 },
  desktop1440: { width: 1440, height: 900 },
  desktop1920: { width: 1920, height: 1080 },
} as const;

export type UxMatrixViewportKey = keyof typeof UX_VIEWPORT_MATRIX;

// Viewports where the Deals board is expected to render in its desktop
// (multi-column, non-stacked) layout -- see DESIGN.md's breakpoints and
// deal-board.tsx's `lg:` (1024px+) column layout. Below this band the board
// intentionally renders as stacked, horizontally-swipeable full-width
// sections (DEALS_BOARD_MOBILE_SCROLL = allowed).
export const DESKTOP_VIEWPORT_KEYS: readonly UxMatrixViewportKey[] = [
  "laptop1280",
  "desktop1440",
  "desktop1920",
];

export const NON_DESKTOP_VIEWPORT_KEYS: readonly UxMatrixViewportKey[] = ["mobile375", "tablet768"];
