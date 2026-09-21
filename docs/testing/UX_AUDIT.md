# UX Audit harness

`tests/ux-audit/` (Playwright config: `playwright.config.ts`) is Dibayar's deterministic UX QA layer: functional/layout/state/visual checks that catch responsive-layout defects, state/data inconsistencies, and suspicious empty states that pure semantic assertions can miss. It complements, not replaces:

- `src/**/*.test.ts(x)` (Vitest) -- component/unit correctness.
- `e2e/` (`playwright.e2e.config.ts`) -- App Router navigation/URL/auth journeys, plus the existing `@visual` pixel-regression suite (`e2e/visual/visual.spec.ts`).

## Why the existing suites can miss UX defects

`e2e/` journey tests assert semantics (role, text, URL, `aria-pressed`) at two viewports (`chromium` desktop, `chromium-mobile` 390px) -- they don't measure geometry, so a column that's 40px too wide, an element sitting outside the viewport, or a touch target that shrank to 30px passes as long as the right text is on the page. Its own `@visual` suite adds curated desktop screenshots plus one true mobile (`isMobile`/touch) baseline, but remains an undifferentiated pixel diff rather than a route x state x viewport matrix or severity/reporting model.

`tests/ux-audit/` predates this doc as a set of one-off historical proofs (`baseline.landing.spec.ts`, `fixtures.baseline.spec.ts`, `t27.verification.spec.ts`) for past tasks (T-00, T-27) -- solid detector code, but no reusable matrix, no CI wiring, and no dedicated Deals-desktop-scroll regression.

## Architecture

```
tests/ux-audit/
  support/
    capture.ts            deterministic screenshot naming + manifest (pre-existing)
    detectors.ts           overflow / touch-target / wrapped-row / overlap /
                            scroll-container / hidden-required-control /
                            empty-state-consistency detectors
    scroll-policy.ts        reviewable registry of intentional-scroll exceptions
    viewports.ts            viewport set used ONLY by the historical T-00/T-27 specs (pre-existing, do not repurpose)
    viewport-matrix.ts       the 5 required viewport bands for the generic harness
    session.ts              fixture manifest loading + cookie login helper
  baseline.landing.spec.ts, fixtures.baseline.spec.ts,
  detectors.selftest.spec.ts, t27.verification.spec.ts   historical (pre-existing, do not weaken)
  routes/
    deals.desktop-scroll.spec.ts   Deals Pipeline Regression Rule
    matrix.spec.ts                  curated route x state x viewport screenshot corpus
  states/
    needs-chasing.spec.ts          Needs Chasing actionable + legitimate-zero coverage
  synthetic/
    detectors.negative-control.spec.ts   proves detectors fail on bad synthetic input

scripts/
  ux-fixtures.ts    seeds/verifies/cleans up the local Postgres fixtures this harness reads
  ux-audit.ts        `npm run ux:audit` orchestrator
  ux-report.ts       reads Playwright JSON output, writes the report

artifacts/ux-audit/
  UX-AUDIT-REPORT.md
  manifest.json               curated screenshot corpus manifest
  ai-review-manifest.json     manifest + deterministic findings, for a later separate AI review pass
  matrix-findings.json        raw per-capture detector output
  screenshots/                the curated PNGs
```

## Running it

```bash
npm run ux:audit                 # full gate: fixtures -> build -> tests/ux-audit -> @visual -> report
npm run ux:audit -- --route=/deal   # focused: only tests/ux-audit specs whose title matches "deal"; skips build's @visual step and re-seeds fixtures but not e2e's
npm run ux:report                # regenerate the report from whatever JSON results already exist, without re-running anything
```

`ux:audit` needs the same local Postgres target as the rest of the repo (`127.0.0.1:55432/dibayar_test`, `.env.local`'s `DATABASE_URL`) -- see `docs/ux-implementation/` and `CLAUDE.md`'s "Database and migration process". Never point it at anything else.

## Browser strategy

`playwright.config.ts` and `playwright.e2e.config.ts`'s `chromium` project both use Playwright's own bundled Chromium (no `channel` set) -- **not** `channel: "chrome"`. A `channel: "chrome"` project launches whatever Google Chrome build happens to be installed on the machine running the tests; on CI that's whatever the `ubuntu-latest` runner image ships that week, which changes as the image updates and is not pinned to the Playwright version in `package.json`. That drift is exactly what caused the `beranda-desktop`/`beranda-mobile`/`invoice-detail-desktop` (and every other `@visual`) baseline to go stale: same UI, same content, different sub-pixel font rendering from a different browser build.

Install the pinned browser locally with:

```bash
npx playwright install chromium
```

(matches CI's `npx playwright install --with-deps chromium` -- the `--with-deps` part only adds Ubuntu system libraries, irrelevant on a dev machine that already has them). Do not install/rely on `google-chrome`/`chrome` for this repo's Playwright suites, and do not add `channel: "chrome"` back without a documented, repository-specific reason -- it reintroduces the same non-reproducible baseline drift.

**Never regenerate a baseline against an arbitrary system Chrome install.** Only regenerate against the pinned `npx playwright install chromium` binary, after confirming (screenshot diff, not just "tests pass") that the actual rendered UI -- not just pixels -- is correct. See "To update a visual baseline" below.

**The same Chromium binary still isn't enough on its own -- generate baselines on the actual CI runner, not a dev machine.** Even with `channel: "chrome"` removed, a baseline generated on an arbitrary dev machine can mismatch the `ubuntu-latest` CI runner by a handful of pixels (OS font/fontconfig/freetype differences, not pinned by the Playwright version). This isn't hypothetical: baselines regenerated locally via `npx playwright install chromium`, and separately inside the official Playwright Docker image pinned to the exact installed version (`mcr.microsoft.com/playwright:v1.62.1-noble`), both still failed in CI with small anti-aliasing-level diffs (a handful of pixels out of hundreds of thousands). Only generating them on an actual `ubuntu-latest` GitHub Actions runner matched CI.

**Use the `Update visual baselines` workflow** (`.github/workflows/update-visual-baselines.yml`, `workflow_dispatch`-only): Actions tab -> "Update visual baselines" -> "Run workflow" against your branch, then download the `updated-visual-baselines` artifact from the completed run and replace the files under `e2e/visual/visual.spec.ts-snapshots/` with its contents. Equivalently: `gh workflow run update-visual-baselines.yml --ref <your-branch>`, then `gh run download <run-id> -n updated-visual-baselines -D <dir>`.

This still doesn't replace the inspection step -- a genuine UI regression regenerates "clean" on CI too. Always inspect the diff (or, for a fresh regeneration, the new image itself) before trusting it; see "To update a visual baseline" below.

## PDF tooling

`tests/ux-audit/fixtures.baseline.spec.ts` and `t27.verification.spec.ts` shell out directly to the `pdftotext`/`pdfinfo` binaries (`poppler-utils` on Debian/Ubuntu) to assert on real generated-PDF text/metadata, not just "a PDF-shaped file exists". Install locally:

```bash
sudo apt-get update && sudo apt-get install -y poppler-utils
pdftotext -v
pdfinfo -v
```

CI (`ux-audit` job in `.github/workflows/e2e.yml`) installs the same package before `npm run ux:audit`. Do not replace these tests' `pdftotext`/`pdfinfo` assertions with a weaker file-exists check to avoid installing the binary.

## Viewport matrix

`support/viewport-matrix.ts`:

| key | width x height |
| --- | --- |
| `mobile375` | 375x812 |
| `tablet768` | 768x1024 |
| `laptop1280` | 1280x800 |
| `desktop1440` | 1440x900 |
| `desktop1920` | 1920x1080 |

To add or remove a band: edit `UX_VIEWPORT_MATRIX` (and `DESKTOP_VIEWPORT_KEYS`/`NON_DESKTOP_VIEWPORT_KEYS` if it changes which side of the Deals desktop/mobile split it falls on). This is separate from `support/viewports.ts`, which the historical T-00/T-27 specs enumerate with hardcoded artifact-count assertions -- do not repurpose that file for new work.

## Scroll policy

```
PAGE_HORIZONTAL_SCROLL       = forbidden, everywhere, always
DEALS_BOARD_DESKTOP_SCROLL   = forbidden (laptop1280 / desktop1440 / desktop1920)
DEALS_BOARD_MOBILE_SCROLL    = allowed (mobile375 / tablet768)
EXPLICIT_SCROLL_CONTAINER    = allowed only for containers registered in support/scroll-policy.ts
```

The Deals board rail (`[data-testid="deal-board-rail"]`) is `overflow-x: auto` at *every* viewport in `deal-board.tsx` -- it's allowed to be scrollable, so `detectHorizontalOverflow` can't tell "is this a problem" from "does an intentional scroll container exist" alone. `routes/deals.desktop-scroll.spec.ts` answers the real question instead: does the rail's `scrollWidth` actually exceed its `clientWidth` (via `measureScrollContainer`) at each viewport.

**To declare a new intentional scroll container**: add one entry to `ALLOWED_SCROLL_CONTAINERS` in `support/scroll-policy.ts` with an exact `testid` or `uxScroll` match (never a role/aria-label pattern) and a `reason`. Never add a wildcard rule.

## Fixture/state matrix

Seeded by `scripts/ux-fixtures.ts` (`npm run ux:fixtures -- seed|verify|cleanup`) against the four fixture users below. All four are additive to the original T-00 fixture set -- existing keys (`owner`, `other`, `zero`, and their nested ids) are unchanged, so the historical specs keep working unmodified.

| state | how it's covered |
| --- | --- |
| fresh-user | `zero` user: zero deals, zero invoices -- Beranda's own onboarding empty state |
| normal-user | `owner` user: one deal/invoice per stage/status |
| many-deals | `owner`'s `deals.many` -- 7 extra cards spread across MASUK/NEGO/DEAL, several with long Indonesian brand names |
| long-content | `owner`'s `deals.invoice` / `invoices.overdue` -- a long brand name, scope, and payment-terms string |
| nothing-needs-chasing | `quiet` user: has a real deal and a PAID (terminal) invoice, so FollowUpQueue's own empty copy is reached through business logic, not absent data |
| overdue-invoice | `owner`'s `invoices.overdue` |
| overdue-deliverable | `owner`'s `deals.overdueDeliverable`: pre-INVOICE deal with a past `deadline`, distinct from an overdue invoice |
| mixed-deal-payment-states | `owner`: DRAFT/SENT/DUE/OVERDUE/PAID invoices coexist |

## Deterministic detectors (`support/detectors.ts`)

`detectHorizontalOverflow`, `detectSmallTouchTargets`, `detectWrappedActionRows`, `rectanglesOverlap` are pre-existing (T-00). Added by this harness:

- `measureScrollContainer(page, selector)` -- is a *specific, already-known* intentional-scroll container actually needing to scroll right now.
- `detectHiddenRequiredControls(page, selector = "[data-ux-required]")` -- flags an element explicitly marked "this must always be usable" that's `display:none`/`visibility:hidden`/zero-opacity/zero-size/detached. Declarative by design: a generic scan can't know intent (a collapsed mobile menu button being hidden on desktop is correct), so this only ever looks at elements a caller has explicitly marked.
- `detectEmptyStateInconsistency(page, containerSelector)` -- compares a container's declared item count (`data-ux-item-count`) against what actually rendered (`data-ux-item` children) and whether empty-state copy (`data-ux-empty-state`) is shown. Generic and declarative; demonstrated only against synthetic HTML (see below) -- wiring it into a real component means adding those data-attributes there first, which is a product change out of this task's scope.

## Needs Chasing coverage

`states/needs-chasing.spec.ts` covers all three cases the real `FollowUpQueue` (`src/components/home/follow-up-queue.tsx`) component can be in:

1. **Actionable** (`owner`): an overdue and a due-soon invoice both appear, each with the correct urgency reason, and an invoice outside the 7-day window is correctly excluded.
2. **Fresh-user zero** (`zero`): zero deals at all renders Beranda's own onboarding empty state (`home.emptyTitle`) -- the FollowUpQueue section doesn't render at all in this case, which is itself asserted (a regression that silently fell back to a blank shell instead of this copy would be caught).
3. **Nothing-needs-chasing zero** (`quiet`): real deal/invoice activity exists (asserted independently via `/deal`), but the only invoice is PAID (terminal), so the queue reaches its own local empty copy (`home.chaseEmpty`) through actual business logic.

## Screenshot corpus

`routes/matrix.spec.ts` captures a curated, hand-picked set (not a full route x state x viewport cross product) at two representative bands, `mobile375` and `desktop1440` -- the same two-viewport pattern the task spec's own example matrix uses. 9 route/state pairs x 2 viewports = 18 screenshots under `artifacts/ux-audit/screenshots/`, each also checked for page-level overflow and sub-44px controls. To add a route/state: add one `test(...)` block following the existing pattern (login as the right fixture user, `goto200`, one semantic assertion that the right state actually loaded, then `captureAndCheck` per viewport).

**Visual pixel regression is intentionally not re-implemented here.** `scripts/ux-fixtures.ts` uses relative dates (`now`/`past`/`future`), so a `toHaveScreenshot()` baseline built from it would drift every day -- exactly the "brittle baseline caused by timestamps" the harness is supposed to avoid. `e2e/visual/visual.spec.ts` already covers these same routes/states with a stable, fixed-calendar-date fixture pipeline (`scripts/e2e-fixtures.ts`); `ux:audit` runs it (`--grep @visual`) and the report's "Visual Regression status" reflects its result. **To update a visual baseline**: `npm run test:e2e:update-snapshots`, per `e2e/visual/visual.spec.ts`'s own header comment. Before running it, first run `npm run test:e2e:visual` (no `--update-snapshots`) and inspect every reported diff -- actual vs. expected vs. the pixel diff, plus the DOM/fixture state -- to confirm the mismatch is stale-baseline/rendering drift and not a real product regression. Never regenerate a baseline solely because CI is red; if the rendered UI looks wrong, stop and report it instead of updating the snapshot. After regenerating, re-run `npm run test:e2e:visual` once more without `--update-snapshots` and confirm it passes clean -- that's the proof the new baseline is actually deterministic, not just "whatever this run happened to produce".

The visual command includes desktop Chromium and one explicitly scoped true-mobile
visual project; the semantic E2E aggregate excludes all `@visual` tests. `ux:audit`
runs both the `chromium` and `chromium-mobile-visual` projects for `@visual`, so
the report's "Visual Regression status" reflects the full curated suite (desktop
baselines plus the one true-mobile baseline), not desktop alone.

## Proving the detectors work

`synthetic/detectors.negative-control.spec.ts` uses `page.setContent` (never real application code) to prove each detector still fails loudly on genuinely bad input, so a passing suite elsewhere means the app is clean, not that a regression would go undetected:

1. page-level horizontal overflow
2. a desktop Deals-like board (`data-testid="deal-board-rail"`) with unintended horizontal scroll
3. an element escaping the viewport
4. an overlapping interactive control (a pseudo-element hit-area stealing a neighbor's box)
5. an invisible required control (plus a visible control control-case, `5b`)
6. an incorrect empty-state/data expectation (plus two consistent control-cases, `6b`/`6c`)

`detectors.selftest.spec.ts` (pre-existing, T-00) already proves the original four detectors' many edge cases (active-dialog exemptions, pseudo hit-area math, etc.) -- this file adds the remaining cases the task specifically calls out, without duplicating that coverage.

**To add a new detector negative-control test**: add one `test()` here using `page.setContent` with the smallest DOM that reproduces the bad case, then assert the relevant detector actually reports it (not just "doesn't throw").

## Severity model

| severity | meaning | gate behavior |
| --- | --- | --- |
| CRITICAL | a broken detector (`synthetic/`) or a real responsive-layout regression (`routes/`, including the Deals desktop-scroll rule) | fails `npm run ux:audit` |
| HIGH | a state/data defect (`states/`) or a legacy functional-regression spec failure, including the pre-existing historical specs | fails `npm run ux:audit` |
| MEDIUM / LOW | not currently emitted by any check in this harness -- reserved for a future detector that produces advisory-only findings | reported only, does not fail the gate |

Categorization is file-path-based (`scripts/ux-report.ts`'s `categoryForFile`/`severityForCategory`), not per-assertion, so it's reviewable in one place rather than scattered across test files. Never downgrade a real failure's severity to make CI green -- add a scoped, documented exception (scroll-policy.ts) or fix the underlying defect instead.

## Interpreting `UX-AUDIT-REPORT.md`

Generated at `artifacts/ux-audit/UX-AUDIT-REPORT.md` by `scripts/ux-report.ts` from two already-completed Playwright JSON runs (`test-results/ux-audit/results.json`, `test-results/e2e/results.json`). Each finding block is one failed Playwright test, with `route`/`viewport` best-effort-parsed from its title (informational only -- open `evidence` (`file:line`) for the real assertion). "Overall status" is `FAIL` whenever any CRITICAL/HIGH finding exists, matching the gate `ux:audit` itself enforces via its exit code.

**Known pre-existing gap, not caused by this harness:** `fixtures.baseline.spec.ts`'s "captures populated owner dashboard" test fails against unmodified `main` (verified by reseeding the original, pre-this-branch fixture data and rerunning it in isolation) -- the legacy `/dashboard` route no longer surfaces `UX/OVERDUE/004` the way this T-00-era spec expects, most likely because later UX phases (T-27) split it into `/`, `/deal`, `/invoice` without updating this historical spec. This harness correctly reports it as a HIGH finding rather than silently passing; per this task's scope, the fix belongs to whoever owns `/dashboard`'s fate (retire it, or migrate this spec to the current routes), not to this branch.

## Distinguishing deterministic failures from subjective AI findings

Everything in `tests/ux-audit/` and this doc is deterministic: a fixed assertion either passes or fails, with no model judgment involved, and `ux:audit`'s exit code depends only on that. `artifacts/ux-audit/ai-review-manifest.json` (screenshot paths + route/state/viewport + the matrix's raw detector findings) exists to be handed to a *separate*, later Claude Code session for subjective review (visual hierarchy, spacing, information density, confusing-but-not-technically-broken copy, etc. -- see the task's own rubric). That review must never become a required step in `ux:audit` or CI -- it's manual, and its findings are advisory, reviewed and actioned separately from this gate.

## CI

`.github/workflows/e2e.yml`'s `ux-audit` job runs `npm run ux:audit` against the same disposable Postgres service the `e2e-critical` job uses, and uploads `artifacts/ux-audit/` (including the report and screenshots) on every run so a failure is inspectable without re-running locally. It runs after `lint-typecheck-test` in parallel with `e2e-critical`, not nested inside it, so a `ux:audit` failure doesn't block or slow down the existing critical-path gate.
