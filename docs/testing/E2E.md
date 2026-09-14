# Playwright E2E / journey testing

This is the real-browser journey layer, separate from `tests/ux-audit/` (the
existing visual/detector audit harness, unchanged by this work). It exists to
catch bugs that Vitest/RTL component tests structurally cannot see: the
interaction between App Router navigation, `window.history`, `useSearchParams`,
and client component state -- exactly the class of bug that escaped the prior
test suite in the V3/V4 deal-filter regressions.

Baseline note: as of this writing, this suite was built on top of the
unmerged `hermes/ux-phase-2` candidate SHA `b48a2974e3cb7269a7af35fc3c88c9ffa5bc7f97`
(branch `hermes/playwright-e2e`, worktree `../dibayar-playwright-e2e`), not `main`
-- see `DIBAYAR-PLAYWRIGHT-E2E-HANDOFF.md` for why and what that means for
rebasing this work later.

## Architecture

- `playwright.e2e.config.ts` -- journey config. Separate from
  `playwright.config.ts` (ux-audit): different `testDir` (`./e2e`), different
  port (`E2E_PORT`, default 3300), different purpose.
- `e2e/` -- spec files, grouped by area (`deals/`, `invoices/`, `settings/`,
  `auth/`, `smoke/`, `visual/`), plus `e2e/support/` for shared helpers and
  `e2e/global-setup.ts` / `e2e/global-teardown.ts`.
- `scripts/e2e-fixtures.ts` -- deterministic data + session fixtures, sibling
  to (not a replacement for) `scripts/ux-fixtures.ts`. Same safety guardrails:
  refuses to run against anything but `127.0.0.1:55432/dibayar_test`, requires
  `E2E_FIXTURE_CONFIRM=non-production`, and a hostname sanity check.
- Runs against a **production build** (`next build` + `next start`), not
  `next dev` -- `npm run e2e:build` before every `test:e2e*` script.
- Projects: `chromium` (desktop) and `chromium-mobile` (390x844, Dibayar's
  primary mobile target) are the PR-gate tier. `firefox` and `webkit` exist
  for a broader/nightly tier, selected explicitly with `--project`.

## How authentication works

Auth.js uses a database session strategy (`src/auth.ts`). The E2E fixture
seed writes a real `Session` row straight into the approved disposable test
database, then Playwright's `storageState` sets the `authjs.session-token`
cookie to that row's token (see `e2e/support/auth.ts` and
`playwright.e2e.config.ts`).

**Why this cannot become a production auth bypass:** there is no new code
path in `src/` that trusts a token an E2E run invents. The only thing this
skips is clicking through Google's interactive OAuth consent screen --
everything downstream (the session lookup, the adapter, route guards) is the
exact mechanism production uses. A production database has no row with this
session token, and `scripts/e2e-fixtures.ts` refuses to write one anywhere
except `127.0.0.1:55432/dibayar_test`. Google OAuth itself is not exercised
by this suite at all (it isn't practically automatable) and stays a manual
smoke item outside CI.

Two session tokens exist for the same fixture owner:
`E2E_OWNER_SESSION_TOKEN` (used by almost everything, via project-level
`storageState`) and `E2E_OWNER_SIGNOUT_SESSION_TOKEN` (used only by the
sign-out journey, since signing out deletes the Session row server-side and
would otherwise invalidate every other test's cookie).

Tests that need an unauthenticated context override per-test:
```ts
test.use({ storageState: { cookies: [], origins: [] } });
```

## How the data fixtures work

`scripts/e2e-fixtures.ts seed` creates one fixture owner (`E2E Fixture
Owner`) with seven deals -- one per pipeline stage (`MASUK`, `NEGO`, `DEAL`,
`KONTEN`, two at `INVOICE` -- one with no invoice yet for the "create
invoice" journey, one already invoiced -- and one `DIBAYAR`), two invoices
(`SENT` and `PAID`), and a complete `UserSettings` row. IDs and brand names
are fully deterministic (prefix `e2e-t0-...`); read them via
`loadFixtureManifest()` (`e2e/support/manifest.ts`) rather than
hardcoding, so a future schema/fixture change only needs updating in one
place.

`e2e/global-setup.ts` seeds once per `playwright test` invocation;
`e2e/global-teardown.ts` cleans up after (set `E2E_KEEP_FIXTURES=1` to skip
teardown for manual debugging).

**Important:** global setup/teardown run once per invocation, not once per
*project*. `test:e2e`/`test:e2e:critical` run `chromium` and
`chromium-mobile` in the same invocation against the same database, so any
test that *mutates* shared owner data (moves a deal's stage, creates an
invoice, deletes a session on sign-out) calls `reseedFixtures()`
(`e2e/support/reseed.ts`) in a `beforeEach` -- otherwise the second project
to run inherits the first project's mutations and its assertions about "the
deal at stage X" go stale. Read-only/filter-only specs
(`deals/filter-navigation.spec.ts`, `deals/add-deal-dialog.spec.ts`) need no
reseed.

## Commands

| Command | What it does |
|---|---|
| `npm run e2e:fixtures -- seed\|verify\|cleanup` | Manual fixture control for local debugging |
| `npm run e2e:build` | Production build (`next build`), needed before any `test:e2e*` run |
| `npm run test:e2e` | Full suite, chromium + chromium-mobile |
| `npm run test:e2e:critical` | `@critical`-tagged tests only, chromium + chromium-mobile -- the PR gate |
| `npm run test:e2e:visual` | `@visual`-tagged screenshot suite, chromium only |
| `npm run test:e2e:a11y` | `@a11y`-tagged axe-core suite, chromium only |
| `npm run test:e2e:update-snapshots` | Regenerate visual baselines intentionally |
| `npm run test:e2e:all-browsers` | Full suite across chromium, chromium-mobile, firefox, webkit -- release/nightly tier |
| `npm run test:e2e:headed` | Headed chromium run (assumes a build already exists -- run `npm run e2e:build` first if not) |
| `npm run test:e2e:ui` | Playwright UI mode |

`E2E_PORT` (default 3300) and `E2E_SKIP_WEBSERVER=1` (reuse an already-running
server, e.g. for `test:e2e:headed`/`:ui` iteration) are available as env
overrides, matching `tests/ux-audit`'s `UX_PORT`/`UX_SKIP_WEBSERVER`
convention.

## Where evidence lives on failure

- `trace: "on-first-retry"`, `screenshot: "only-on-failure"`,
  `video: "retain-on-failure"` (`playwright.e2e.config.ts`).
- Traces/screenshots/videos: `test-results/e2e/<test-name>/`.
- HTML report: `playwright-report/e2e/index.html`
  (`npx playwright show-report playwright-report/e2e`).
- Each failure's `error-context.md` (in the same `test-results/e2e/...`
  folder) has an accessibility snapshot of the page at failure time.

## Diagnosing a failed test

1. Open the HTML report or the relevant `test-results/e2e/<test>/` folder.
2. Check the screenshot/video for what was on screen.
3. Check the trace (`npx playwright show-trace test-results/e2e/<test>/trace.zip`)
   for the exact action sequence, network requests, and console/page errors.
4. If it's in `deals/filter-navigation.spec.ts` or `deals/add-deal-dialog.spec.ts`,
   check whether the failure reproduces via `assertDealFilterState`
   (`e2e/support/deal-filter.ts`) disagreeing about URL vs. chip vs. board
   content -- that's the exact invariant this suite exists to guard.

## CI

See `.github/workflows/e2e.yml`. Gate order: lint -> typecheck -> unit/component
tests -> build -> `test:e2e:critical`. `workers: 1` (no sharding yet) --
see "Known limitations" in the handoff for when to revisit.

## Cross-browser strategy

Routine PR gate: `chromium` + `chromium-mobile` only, for speed and
determinism. `firefox` and `webkit` projects exist in
`playwright.e2e.config.ts` for a broader/nightly run
(`npm run test:e2e:all-browsers`) -- not wired into the PR-gate CI job.

**Browser used for `chromium`/`chromium-mobile`:** Playwright's own bundled
Chromium (no `channel` set), not a `channel: "chrome"` project pointed at
whatever system Google Chrome happens to be installed -- that channel
resolves to whichever Chrome build the runner/host has, which drifts as
Chrome auto-updates and isn't pinned to the `@playwright/test` version in
`package.json`. That drift is what caused the `@visual` suite's baselines
(`beranda-desktop`, `beranda-mobile`, `invoice-detail-desktop`, etc.) to go
stale in CI. Install the pinned browser locally with:

```bash
npx playwright install chromium
```

Do not add `channel: "chrome"` back to either project without a documented,
repository-specific reason.

**To intentionally update a `@visual` baseline**: `npm run
test:e2e:update-snapshots`. First run `npm run test:e2e:visual` (no
`--update-snapshots`) and inspect every reported diff -- confirm the mismatch
is stale-baseline/browser-rendering drift, not a real UI regression -- before
regenerating. After regenerating, re-run `npm run test:e2e:visual` once more
and confirm it passes clean with no further snapshot writes.

A bare dev machine's Chromium (and even the official Playwright Docker image,
pinned to the exact installed version) can still render a handful of pixels
differently than the actual `ubuntu-latest` CI runner -- confirmed in
practice, not just a theoretical risk. Use the `Update visual baselines`
GitHub Actions workflow instead (`workflow_dispatch`-only); see
`docs/testing/UX_AUDIT.md` "Browser strategy" for how to run it and where to
get the regenerated PNGs from.

## Security safeguards (recap)

- `scripts/e2e-fixtures.ts` will not run without `E2E_FIXTURE_CONFIRM=non-production`
  and refuses any `DATABASE_URL` other than `127.0.0.1:55432/dibayar_test`
  (same guardrail shape as the existing `scripts/ux-fixtures.ts`).
- No new production code path was added for authentication -- see "How
  authentication works" above.
- `.env.local` (containing the real local `DATABASE_URL`/`AUTH_SECRET`) is
  gitignored and was never committed; it's copied locally per developer
  machine same as the existing convention.

## Known limitations / not yet automated

- **`e2e/visual/visual.spec.ts` has no committed `chromium-mobile` baselines.**
  Neither `npm run test:e2e:visual` nor `ux:audit`'s own `@visual` step ever
  select the `chromium-mobile` project (both pass `--project=chromium`
  explicitly), so this has never been a gap in the actual CI gates
  (`e2e-critical` excludes `@visual` via `--grep @critical`; `ux-audit`'s
  `@visual` step is `chromium`-only). It only surfaces if someone runs the
  unfiltered `npm run test:e2e` locally, where Playwright will auto-write (and
  fail on) brand-new `-chromium-mobile-linux.png` files. Mobile coverage that
  *is* intentional (`beranda-mobile`) is captured by resizing the viewport
  inside the `chromium` project, not by a second project run. Adding a real
  `chromium-mobile` `@visual` tier is a scope decision for whoever owns this
  suite, not implied by this doc.
- **`e2e/visual/visual.spec.ts` does not call `reseedFixtures()`.** Per "How
  the data fixtures work" above, any spec that mutates the shared owner
  fixture must reseed in `beforeEach`, or a later spec in the same invocation
  inherits its mutation. `visual.spec.ts` doesn't, so running the full `npm
  run test:e2e` (not `test:e2e:visual`, which runs `@visual` alone) can fail
  its `Pengaturan main state` snapshot if `settings/settings.spec.ts` ran
  first in the same invocation and changed the owner's saved name. Not
  reachable from either real CI job for the same reason as the point above.
- No cross-browser (Firefox/WebKit) run has been exercised in this sandboxed
  environment -- `npx playwright install` succeeded for the browsers, but
  `--with-deps` (system libraries) failed for lack of `sudo`, so Firefox/WebKit
  may need those installed in whatever CI runner actually executes
  `test:e2e:all-browsers`.
- The Escape-key dialog-close test uses a short empirical `waitForTimeout`
  rather than a semantic wait -- see the comment at
  `e2e/deals/add-deal-dialog.spec.ts` for what was tried and why.
- No sharding configured yet (`workers: 1` everywhere) -- deliberate until the
  suite has a longer track record; `playwright.e2e.config.ts` is a single
  place to add `shard` support later.
- See `DIBAYAR-PLAYWRIGHT-E2E-HANDOFF.md` for the two real product
  regressions this suite found (not fixed here, per this task's scope) and
  the recommended next journeys.
