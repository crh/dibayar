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
  This is deliberately a different build strategy than the app's default
  `npm run build` (Turbopack, what Vercel deploys with); CI's
  `lint-typecheck-test` job runs the default build too, so a Turbopack-only
  break still surfaces without giving browser tests two build strategies to
  chase.
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

**Follow-up overlay (opt-in).** `npm run e2e:fixtures -- follow-up-states`
(or `applyFollowUpStates()` from `e2e/support/reseed.ts`, which reseeds
first) adds, on top of a fresh seed only, five invoices whose due dates are
relative to today's Asia/Jakarta date -- stored `OVERDUE` due 5 days ago,
`SENT` due yesterday, today, in 7 days and in 8 days (the
`selectAttentionInvoices` boundaries) -- each on its own `INVOICE` deal, plus
a `NEGO` deal whose WhatsApp number (`12345678`) is accepted by the API but
not usable. They are not in the base seed on purpose: the base seed's Beranda
follow-up queue is empty and the deal board has seven cards, which the
`@visual` baselines capture. IDs and brands are in the manifest under
`followUp` (the rows exist only after the overlay). Specs that apply it
reseed again in `afterEach`, because the read-only specs never reseed.

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

Specs that open WhatsApp (`e2e/home/follow-up-queue.spec.ts`,
`e2e/invoices/overdue-invoice.spec.ts`, `e2e/invoices/invoice-journeys.spec.ts`,
`e2e/deals/contact-repair.spec.ts`, `e2e/whatsapp/popup-blocker.spec.ts`)
call `keepWhatsAppLocal(context)` (`e2e/support/follow-up.ts`): `wa.me` and
`api.whatsapp.com` are answered by a local stub, so the popup URL is the exact
link the app built and nothing reaches WhatsApp. It also returns the requests
WhatsApp would have received (URL and Referer), and `trackOpenedPages(context)`
lists every tab the context opens, so a test can prove "exactly one tab, one
request, no Referer".

Blocked popups (FIND-04, fixed): invoice detail and the Beranda queue open
WhatsApp through `openWhatsAppPopup()` (`src/lib/whatsapp-popup.ts`), so a
`null` from `window.open()` is now a real block. Two ways to get one:
`e2e/whatsapp/popup-blocker.spec.ts` launches Chromium with its own
`--block-new-web-contents` switch (the browser refuses every new window;
nothing in the page is stubbed; Chromium only, and it also blocks the
fallback link's own tab), and the older tests stub `window.open = () => null`
(partial by the inventory's rules, but they run in every engine and follow
the fallback link).

Share links and reminders (FIND-05, fixed): the Beranda queue asks for the
invoice's link with `POST /api/invoices/:id/share/ensure`, which reuses a
usable link and never rotates one; only **Buat ulang tautan** (`POST .../share`)
rotates. `e2e/invoices/reminder-share-link.spec.ts` checks this with a
`recipient` fixture (a page in its own context with no session) and
`trackShareMutations()`, which lists the share requests the page sent. Share
links are compared as booleans (`expect(a === b, "...").toBe(true)`) so a
failing assertion never prints a token; keep that pattern in new share tests.

Specs that change per-user state every other test depends on
(`settings/language.spec.ts` changes `User.language`,
`settings/bank-details.spec.ts` changes `UserSettings`) reseed in an
`afterEach` as well, so a failure halfway can't leave the next test in
English or with other bank details. `invoices/share-copy.spec.ts` grants
`clipboard-read`/`clipboard-write` only to its own browser context and only
for the app origin, and compares the clipboard as a boolean so a failure never
prints the share token.

## Commands

| Command | What it does |
|---|---|
| `npm run e2e:fixtures -- seed\|verify\|cleanup` | Manual fixture control for local debugging |
| `npm run e2e:fixtures -- legacy-due-date` | Overwrites the seeded SENT invoice's due date with year 0002 (the FIND-03 value) on the guarded disposable DB only; the next `seed` restores it. Used by `e2e/invoices/due-date-integrity.spec.ts` via `seedLegacyInvalidDueDate()` |
| `npm run e2e:fixtures -- follow-up-states` | Adds the follow-up overlay (overdue / due-soon invoices, invalid-contact deal) on top of a fresh `seed`; refuses to stack on anything else. The next `seed` removes it |
| `npm run e2e:fixtures -- follow-up-expired-share` | On top of `follow-up-states`: gives the stored-`OVERDUE` invoice an already-expired share with a recoverable path (the app cannot backdate an expiry). Used by `e2e/invoices/reminder-share-link.spec.ts` via `applyFollowUpExpiredShare()`; refuses to replace an existing share. The next `seed` removes it |
| `npm run e2e:build` | Reproducible webpack production build, needed before any `test:e2e*` run |
| `npm run test:e2e` | Semantic journey suite, chromium + chromium-mobile; visual snapshots are separate |
| `npm run test:e2e:critical` | `@critical`-tagged tests only, chromium + chromium-mobile -- the PR gate |
| `npm run test:e2e:visual` | Curated `@visual` screenshots: desktop Chromium plus one true-mobile Chromium baseline |
| `npm run test:e2e:a11y` | `@a11y`-tagged axe-core suite, chromium only |
| `npm run test:e2e:update-snapshots` | Regenerate visual baselines intentionally |
| `npm run test:e2e:all-browsers` | Semantic suite across chromium, chromium-mobile, Firefox, and WebKit -- scheduled/manual tier |
| `npm run test:e2e:headed` | Headed chromium run (assumes a build already exists -- run `npm run e2e:build` first if not) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:diagnostics-selftest` | Negative-control proof that `browserDiagnostics` (below) still fails a test on a real pageerror/5xx; no build or database needed |
| `npm run coverage:journeys` / `coverage:journeys:report` | Validate the user-action inventory (`docs/testing/journey-coverage.json`) against Playwright's registry / regenerate `docs/testing/JOURNEY-COVERAGE.md`; no browser or DB needed. Add `-- --results <results.json>` to check real claims against an actual run |

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
diagnostics fail an otherwise passing test. `npm run test:diagnostics-selftest`
proves this mechanism itself still works — a synthetic subprocess run
(`e2e/support/synthetic/diagnostics-negative-control.ts`, isolated by its own
`playwright.diagnostics-selftest.config.ts`) checks that a deliberate pageerror
and a deliberate 5xx each still fail, and that a clean page doesn't
false-positive, without touching application code.

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
- The due-date persistence journey ("due date edits and clears persist after
  reload") is skipped only in `chromium-mobile` because Chromium's emulated
  native date picker does not accept a stable programmatic `fill()`. It
  waits for hydration (the WhatsApp button turning enabled) before `fill()`:
  a `fill()` before hydration is undone by React and sends no PATCH, which
  was its intermittent failure (reproduced on demand with CDP CPU throttling,
  2026-10-04). It sets
  the hidden input with `fill()`, so it proves server persistence, **not**
  that a person can use the field. The visible entry point is covered by
  `e2e/invoices/due-date-integrity.spec.ts` (PR #26, merge `b51fba1`), which
  observes the native picker through the `:open` pseudo-class: click/tap on
  the visible empty or filled text opens the picker (FIND-02, fixed), and
  desktop keyboard entry sends no PATCH while typing, exactly one on Enter,
  and survives reload and clear (FIND-03, fixed). On Chromium a missing
  `:open` fails the picker test; Firefox/WebKit are feature-detected.
  `e2e/invoices/due-date-entry.spec.ts` keeps only the clear-and-reload
  journey (INV-DUE-01); its two former `test.fail()` expected-failure tests
  were removed once PR #26 landed. No `test.fail()` remains in `e2e/`.
  Choosing a date inside a native picker is not automatable and stays manual
  (`docs/testing/MANUAL-UAT.md` MAN-DUE-01).

## User-action inventory and coverage report

`docs/testing/journey-coverage.json` inventories every user-facing action,
with its priority, its status (`automated_real_interaction`,
`automated_partial`, `manual_verified`, `manual_pending`, `not_covered`,
`blocked`, `not_applicable`), the exact tests that cover it, and what kind of
proof each test gives. The classification rules are in the file itself.
`npm run coverage:journeys` (run in CI's `lint-typecheck-test` job) rejects
duplicate IDs, unknown statuses, and a stale report, and resolves every test
reference structurally, never by text search
(`scripts/journey-coverage-discovery.mjs`): a titled reference must be a test
Playwright itself registers (`playwright test --list`, so a title in a
comment or a renamed/deleted test fails), and an `automated_real_interaction`
claim needs, in each claimed project, a `real` test that the test's AST shows
is not `test.skip()`-ed, `test.fixme()`-ed or `test.fail()`-annotated there.
Project conditions (`testInfo.project.name`, `browserName`, `isMobile`) are
evaluated per project; a condition it cannot evaluate never counts. An
`expected_failure` reference must still point at a `test.fail()` test, so a
fixed defect forces an inventory update. CI's `e2e-critical` job then runs
`npm run coverage:journeys -- --results test-results/e2e/results.json`: a
referenced real test that ran there but was skipped, failed, or expected to
fail is an error (non-@critical claims are listed as not exercised; add
`--require-results` with a full-suite results file to make those errors
too). `npm run test:journey-coverage` proves each of these rejections with
negative controls against `scripts/journey-coverage-fixtures/` (a synthetic,
browserless Playwright project). `docs/testing/JOURNEY-COVERAGE.md` is
generated from the inventory, and `docs/testing/JOURNEY-GRAPHS.md` holds the
state graphs. No coverage percentage is a gate; adding one needs Chris's
approval. When you rename or add a journey test, update the inventory in
the same PR.
- No sharding configured yet (`workers: 1` everywhere) -- deliberate until the
  suite has a longer track record; `playwright.e2e.config.ts` is a single
  place to add `shard` support later.
- See `DIBAYAR-PLAYWRIGHT-E2E-HANDOFF.md` for the two real product
  regressions this suite found (not fixed here, per this task's scope) and
  the recommended next journeys.
