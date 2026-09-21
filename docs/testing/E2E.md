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
- Runs against a **production build** (`next build --webpack` + `next start`),
  not `next dev` -- `npm run e2e:build` runs before every `test:e2e*` script.
- Projects: `chromium` (desktop) and `chromium-mobile` (390x844, Dibayar's
  primary mobile target) are the semantic PR-gate tier. Visuals use the
  desktop project plus one explicitly scoped `chromium-mobile-visual` project
  for a true mobile baseline. `firefox` and `webkit` exist for the scheduled
  broader tier.

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
| `npm run e2e:build` | Reproducible webpack production build, needed before any `test:e2e*` run |
| `npm run test:e2e` | Semantic journey suite, chromium + chromium-mobile; visual snapshots are separate |
| `npm run test:e2e:critical` | `@critical`-tagged tests only, chromium + chromium-mobile -- the PR gate |
| `npm run test:e2e:visual` | Curated `@visual` screenshots: desktop Chromium plus one true-mobile Chromium baseline |
| `npm run test:e2e:a11y` | `@a11y`-tagged axe-core suite, chromium only |
| `npm run test:e2e:update-snapshots` | Regenerate visual baselines intentionally |
| `npm run test:e2e:all-browsers` | Semantic suite across chromium, chromium-mobile, Firefox, and WebKit -- scheduled/manual tier |
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

See `.github/workflows/e2e.yml`. The PR gate runs lint/typecheck/unit tests,
then the Chromium desktop/mobile critical journeys. Accessibility runs in a
separate blocking job with its own report artifacts. A weekday schedule and
manual dispatch run the semantic suite in Firefox and WebKit as well.

The shared Playwright fixture (`e2e/support/test.ts`) attaches browser
diagnostics for page exceptions, unexpected console errors, failed requests,
and HTTP 5xx responses. Expected App Router RSC cancellations and the known
invalid-public-token 404 console message are narrowly excluded; other
diagnostics fail an otherwise passing test.

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

**Telling drift apart from a real state change.** Host drift shows up as tens
of differing pixels at *identical* image dimensions. A changed image height is
never drift -- it means the page rendered different content, and the diff must
be explained before any baseline moves. Worked example: after the fixture seed
started writing `tokenCiphertext` on the seeded `InvoiceShare` (it previously
wrote only `tokenHash`), `invoice-detail-desktop` went from 965px to 921px
tall. `getInvoiceShare` (`src/lib/invoice-share.ts`) can only recover a share
URL when the ciphertext is present, so the old hash-only row rendered the
"link not available after reload" fallback with a disabled WhatsApp button --
a state only a legacy pre-encryption row can produce. The taller baseline was
therefore capturing behaviour a real share link never has; the shorter render
is correct, and the matching semantic assertions live in
`e2e/invoices/invoice-journeys.spec.ts` ("share link can be created, recovered
after reload, regenerated, and revoked"). Pair every `@visual` baseline change
with the semantic test that pins the same behaviour, so the next diff can be
judged against an assertion rather than against a picture.

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

- The scheduled Firefox/WebKit job is configured but has not been exercised
  in this local environment; CI installs the required browser system
  dependencies.
- The Escape-key dialog-close test uses a short empirical `waitForTimeout`
  rather than a semantic wait -- see the comment at
  `e2e/deals/add-deal-dialog.spec.ts` for what was tried and why.
- The due-date persistence journey is skipped only in `chromium-mobile`
  because Chromium's emulated native date picker does not accept a stable
  programmatic `fill()`; the same server-backed persistence path is exercised
  on desktop, while mobile still covers invoice rendering and actions.
- No sharding configured yet (`workers: 1` everywhere) -- deliberate until the
  suite has a longer track record; `playwright.e2e.config.ts` is a single
  place to add `shard` support later.
- See `DIBAYAR-PLAYWRIGHT-E2E-HANDOFF.md` for the two real product
  regressions this suite found (not fixed here, per this task's scope) and
  the recommended next journeys.
