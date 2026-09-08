// Single source of truth for the fixed reference dates used by E2E/visual
// fixture data whose *formatted text* is captured byte-for-byte in
// checked-in visual-regression screenshots (npm run test:e2e:visual --
// see e2e/visual/visual.spec.ts "Invoice list"/"Invoice detail", and
// scripts/e2e-fixtures.ts for where these are written).
//
// These must be genuinely fixed calendar dates, never computed relative to
// `new Date()`/`now`: a value like `now + 14 days` renders a different
// formatted date string (and wrapped line height) every day, which fails
// the visual suite for reasons having nothing to do with a real
// regression. See e2e-fixture-dates.test.ts for the invariants this file
// must keep holding.
//
// Lives under src/lib (not e2e/support, where its sibling fixture-ids.ts
// lives) so its unit test runs under Vitest without colliding with
// Playwright's default testMatch, which also scans e2e/**/*.test.ts.
//
// Chosen far enough out/back that they will never cross
// DUE_SOON_WINDOW_DAYS (./invoice-date-status.ts) or otherwise change
// derived invoice display status -- so existing "not overdue"/"terminal
// PAID" assumptions the rest of the E2E suite relies on stay valid
// indefinitely too, not just on the day this was written.
export const FIXTURE_FUTURE_DATE = new Date("2099-12-31T00:00:00.000Z");
export const FIXTURE_PAST_DATE = new Date("2020-01-01T00:00:00.000Z");
