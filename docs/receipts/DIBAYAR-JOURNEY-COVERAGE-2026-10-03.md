# Receipt — User-experience journey coverage program (2026-10-03)

Task: `DIBAYAR-USER-JOURNEY-COVERAGE-CLAUDE-CODE-2026-10-03.md`
Branch: `chore/journey-coverage-2026-10-03` (from `origin/staging` `27d3ab1`) → PR into `staging` (not merged)
Commit / PR / CI: see "Delivery" at the bottom.

## Summary (four separate claims)

| Claim | Result |
|---|---|
| **Inventory completeness** | 95 user-facing actions inventoried from the implemented code (routes, components, i18n labels, API routes) across 9 domains; 1 `not_applicable` (deal delete has an API but no UI). Every action has an ID, route, persona, preconditions, interaction, expected/persisted outcome, scope, priority, status, test references and follow-up. It is complete for the current UI as far as the code inspection went. It is not proof that every action works. |
| **Automated real-user-interaction coverage** | **44/94 = 46.8%** of applicable actions; **P0 26/30 = 86.7%**. 18 more are `automated_partial` (URL entry, `fill()` on a picker, API/request, mocks, render/scan only), and those are not counted. |
| **Manual verification** | **1/94 = 1.1%** (AUTH-03 Google round trip, staging 2026-09-30). 3 actions are `manual_pending`, with scripts in `docs/testing/MANUAL-UAT.md`. |
| **Remaining gaps** | 25 outstanding P0/P1 actions (3 P0, 22 P1), listed in `docs/testing/JOURNEY-COVERAGE.md`. Across all priorities: 3 `blocked` (INV-DUE-02 by FIND-02, INV-DUE-04 by FIND-03, INV-STATUS-05 pending the FIND-01 decision), 25 `not_covered` (7 P1, 18 P2), 18 `automated_partial`, 3 `manual_pending`. The 3 open P0s: INV-DUE-02 (blocked), INV-DUE-03 (manual pending), DEAL-CREATE-01 (partial). |

The suite is **not** "100% tested". CI-green does not mean release-ready. See the new `REVIEW_CHECKLIST.md` Gate F.

## Recon (state verified, not assumed)

- `git fetch`: `origin/staging` = `27d3ab1` (PR #24), `origin/main` = `308a339` (PR #23). No open PRs.
- No due-date bugfix in flight: no branch matching due/date/picker, and `ListAgents` showed no other local session. So the due-date journey test does not duplicate another fix.
- Pre-existing untracked files in this worktree (two 2026-10-01 receipts, `src/generated/`) belong to earlier sessions. They were left untouched and not committed.

## Audit of existing coverage (not duplicated)

- `e2e/invoices/invoice-journeys.spec.ts` "due date edits and clears persist after reload" sets the hidden input with `fill()` and is skipped on `chromium-mobile`. It proves server persistence, not usability, so it is classified `partial` and kept as is.
- "mark an invoice paid, then undo" checks only immediate state with no reload, so it is `partial` for SENT→PAID. No test drove DRAFT→SENT or SENT→DUE.
- Every create-deal journey opened the dialog via `page.goto("/deal?tambah=1")`. The mobile FAB, the phone's only create entry point, was never tapped.
- Settings "update issuer and bank details" changes only the issuer name (bank details are untested: SET-03).
- Language is switched only through `page.evaluate(fetch('/api/me/language'))` in `t27.verification.spec.ts`. The Settings language buttons are never clicked (SET-06). The Production report was in English ("Not set").
- `tests/ux-audit/t27.verification.spec.ts` does give real-interaction proof for drag, keyboard and menu stage moves, the account menu, and the invoice contact repair. It is credited, with a note that its CI job is report-gated.
- The `@a11y` axe scans and `@visual` screenshots are assertion-only, so they count as `partial`.
- Stale comment noted, not changed: `e2e/deals/deal-crud.spec.ts` says no in-app link goes to `?tambah=1`, but the top bar's **+ Deal** and the FAB both do.

## Pilot: 3 new real-interaction journeys

| Spec | What it proves | chromium | chromium-mobile | firefox | webkit |
|---|---|---|---|---|---|
| `e2e/invoices/status-lifecycle.spec.ts` | Deal detail **Buat invoice** → link → DRAFT → SENT → DUE → PAID → undo, a **reload after every step**, then the list agrees | pass | pass | pass | pass |
| `e2e/deals/mobile-create-entry.spec.ts` | Tap the FAB from Beranda; tap and type each field; save; reload; card menu → **Lihat detail** shows the typed fee/scope/stage | skip (FAB < 640px) | pass | skip | skip |
| `e2e/invoices/due-date-entry.spec.ts` — empty state | **Kosongkan** → reload → "Belum ditentukan" visible, input empty | pass | pass | pass | pass |
| …— picker opens from the visible field | Click/tap at the visible text's own position; assert the native picker via Chromium `:open` | expected failure (FIND-02) | expected failure (FIND-02) | skip | skip |
| …— desktop keyboard entry | Click visible field, type the date, saved, reload, clear | expected failure (FIND-03) | skip (no keyboard path) | skip | skip |

Picker observability was established before any test was written. A
synthetic probe (Chromium 151, Playwright 1.62.1) showed that `:open` is
true after an icon-edge click or `showPicker()`, and false after a
click/tap on the text area of an opacity-0 date input. The real app
reproduces the Production report on desktop and in 390px mobile
emulation. Real-device behaviour (Android or iOS tap) is not proven by
emulation, so MAN-DUE-01 covers it.

Expected-failure tests were checked for failing **for the right reason**
(from each failure's `error-context.md`):
- picker test: `:open` poll `Expected: true, Received: false`, after the `:open`-support precondition passed.
- keyboard test: the page shows "Gagal memuat.".

## New defects

- **FIND-03 (high, new — found by this pilot).** Desktop keyboard due-date entry: Chromium emits a valid `0002-mm-dd` as soon as the first year digit is typed. `DateField` commits every change, so the client sends `PATCH /api/invoices/:id {"dueDate":"0002-12-01"}` and gets **200**. The client then throws `Expected an ISO yyyy-mm-dd date, received: 2-12-01`. A diagnostic run with a persisted year-0002 date showed **the owner's invoice detail page renders "Gagal memuat." on every load**, so the only UI that can fix it is unreachable. `/invoice`, `/`, deal detail, `/i/<token>` and the public PDF still render. Suggested fix scope (separate `fix/*` PR): server-side `dueDate` range validation; do not commit partial keyboard input; invoice page must not throw on an out-of-range stored date. **Chris:** a read-only Production check for `dueDate < 1900-01-01` is advisable; any data repair is Chris-only. Not done here.
- **FIND-02 (high, Production report, reproduced).** Click/tap on the visible empty due-date field does not open the picker. `src/components/date-field.tsx` puts a full-size opacity-0 `<input type="date">` over the display, and Chromium opens the picker only from the invisible icon edge.
- **FIND-01 (medium, product question).** "Tandai terlambat" on a DUE invoice without a past due date stores OVERDUE, but `deriveInvoiceDisplayStatus` shows **Terkirim**. Not tested either way until Chris decides.

## Controls (each mutation reverted)

One temporary local build with two deliberate product mutations; afterwards
`git checkout -- src/components/layout/floating-action-button.tsx src/components/date-field.tsx`
was run, `git diff -- src/` was empty, and the app was rebuilt clean.

| Mutation | Expected | Observed |
|---|---|---|
| FAB gets `pointer-events-none` (visible but untappable) | FAB journey fails | **failed**: `locator.tap` timeout, "…subtree intercepts pointer events" |
| `DateField` input `onClick → showPicker()` (one candidate fix) | picker expected-failure test unexpectedly passes | **"Expected to fail, but passed"** on chromium and chromium-mobile, so the test is not vacuous |
| (same build) keyboard test | still fails (FIND-03 is independent) | still failed |

## Inventory tooling

- `docs/testing/journey-coverage.json`: inventory with classification rules.
- `scripts/journey-coverage.mjs`: `check` and `report`. It rejects duplicate or invalid IDs, statuses and priorities, test refs whose file or title doesn't exist, status-evidence mismatches (e.g. a `real` claim without a real test, or an expected failure counted as coverage), unknown manual-check IDs, and unknown action IDs in the graphs/UAT/backlog docs. It also fails on a stale report.
- `scripts/journey-coverage.test.mjs`: 9 negative/positive self-tests.
- CI: two steps in the existing `lint-typecheck-test` job, adding seconds. No new job, no percentage gate, and no new Neon/Vercel activity (ordinary branch stays CI-only).
- Docs: `JOURNEY-COVERAGE.md` (generated), `JOURNEY-GRAPHS.md` (state graphs, with untested/blocked edges explicit), `MANUAL-UAT.md` (device checks, release smoke, exploratory charter, run log), `JOURNEY-BACKLOG.md` (fix order, Batches 1–3), plus updates to `E2E.md`, `REVIEW_CHECKLIST.md` (Gate D line, new Gate F) and `docs/DEVELOPMENT-WORKFLOW.md` (release PR pointer to Gate F).

## Validation (local, this session)

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings (274 files) |
| `npm run typecheck` | pass |
| `npm test` | 81 files, 780/780 |
| `npm run test:journey-coverage` | 9/9 |
| `npm run coverage:journeys` | OK — 95 actions, 46.8% real, P0 86.7%, 25 outstanding P0/P1 |
| `npm run test:e2e:critical` | exit 0: **88 passed + 3 expected failures** (listed as passed by Playwright) **+ 13 skipped** (11 pre-existing, 2 new, all project-scoped by design); 0 unexpected failures |
| New specs, `firefox` + `webkit` | 4 passed, 6 skipped by design |
| `npm run build` (Turbopack) | not re-run locally (no app code changed); CI `lint-typecheck-test` runs it |
| `@a11y`, `ux:audit`, `@visual` | not re-run: no product, UI or fixture change; new specs are `@critical` only |

## Environment notes

- The local `127.0.0.1:55432/dibayar_test` had **no tables** (all 12 migrations unapplied). After confirming the URL host/port/db (no credentials printed), I applied `prisma migrate deploy` to that disposable DB only. CI does the same with its own service.
- An earlier "DB not reachable" was a false negative: the Bash tool's zsh doesn't support `/dev/tcp`. The user confirmed the container was up. Docker was never invoked by the agent.

## Safety

No product source changed in the committed diff. No Production or hosted-staging DB, Vercel, Neon or OAuth settings, or secrets were touched. No screenshots were rebaselined, no assertions weakened, and no existing test was skipped. The temporary diagnostic specs (`e2e/zz-debug*.tmp.spec.ts`) and probe scripts were deleted.

## Residual risks

- The expected-failure tests pass CI while their defects are open. If a future change breaks them *for another reason*, they would still report as expected failures. Mitigated by the separate empty-state test (same setup, real assertions) and the documented requirement to remove `test.fail()` in the fix PRs.
- `:open`-based picker detection is verified in Playwright's bundled Chromium only. Engine upgrades could change it, and the test checks `:open` support first and fails loudly if it's missing.
- Emulated mobile is not a real phone. MAN-DUE-01 on real Android and iOS is still `manual_pending`.
- The keyboard segment order (month/day/year in the bundled Chromium under `id-ID`) may differ in real Indonesian-locale Chrome.

## Delivery

- PR: https://github.com/crh/dibayar/pull/25 (`chore/journey-coverage-2026-10-03` → `staging`), **not merged**; merge needs authorization per `docs/DEVELOPMENT-WORKFLOW.md`.
- Implementation commit: `ded4ba2` (this receipt's delivery section is a follow-up docs commit).
- CI run `37120793919` on `ded4ba2`: `lint-typecheck-test` success (vitest 780/780, journey-coverage self-test 9/9, `coverage:journeys` OK), `e2e-critical` success (91 passed incl. 3 expected failures, 13 skipped — identical to local), `e2e-a11y` success, `ux-audit` success, `e2e-cross-browser` skipped (schedule/dispatch only, by design).
- Gate 5 check (read-only): 0 GitHub deployments and no Vercel commit status for the branch. Neon branch list was not checked in this session.

## Review follow-up (2026-10-04, Codex P2 on `scripts/journey-coverage.mjs:91`)

**Finding:** the validator matched a referenced title anywhere in the file's text and trusted the declared `kind`. A commented-out test, a renamed test still named in a comment (e.g. the NAV-03 title repeated in a comment in `add-deal-dialog.spec.ts`), or a `test.skip()` / `test.fail()` test would all keep counting as real coverage.

**Before (proved):** the old validator (`git show 80173c8:scripts/journey-coverage.mjs`), run against the new synthetic fixtures, *accepted* all six of these as real coverage: a commented-out test, a renamed test, an unconditional `test.skip()`, `test.fail()`, `test.fixme()`, and `test.describe.skip`.

**After:** references are resolved structurally, never by text search:

1. **Registry** (`scripts/journey-coverage-list-reporter.mjs` + `playwright test --list`, both configs): a titled reference must be a test Playwright registers, matched on its exact title or full `describe › test` title. An ambiguous title is an error. Declaration-level modifiers (`test.skip("t", fn)`, `test.fail("t", fn)`, `test.fixme`, `test.describe.skip`) come from Playwright itself.
2. **AST** (`scripts/journey-coverage-discovery.mjs`, TypeScript compiler API): finds each listed test's call. It evaluates `test.skip/fail/fixme(cond)` in the test body and in enclosing describe/file scopes, per project, over `testInfo.project.name`, `browserName`, `isMobile`, literals, `!`, `===`, `!==`, `&&`, `||` (including the describe-level callback form). Anything else, such as a modifier under `if` or an `await` condition, is "unknown" and never counts.
3. **Rules:**
   - An `automated_real_interaction` action needs, in each claimed Playwright project (scope mapped to `e2e:<project>` or the ux-audit project), a `real` test that is runnable there. Each `real` reference must also be runnable in at least one claimed project.
   - An unknown scope project is an error.
   - An `expected_failure` reference must still be `test.fail()`-annotated, so a fixed defect forces an inventory update.
   - A titled `partial` reference that never runs as a pass is an error.
   - Unit/component files can only be untitled `partial` evidence.
4. **Run results:** `coverage:journeys -- --results <playwright-json> [--require-results]`.
   - A referenced real test that ran but was skipped, failed, or expected to fail is an error. A flaky pass counts, with a warning.
   - Claims that run did not exercise are listed. With `--require-results` they are errors.
   - CI's `e2e-critical` job now runs this against its @critical results.
5. `playwright.e2e.config.ts` gets `testMatch: /\.spec\.ts$/`. The default matched `e2e/support/diagnostics-selftest.test.mjs`, so every E2E run and `--list` also executed that node:test file and its nested Playwright run (still run separately by `test:diagnostics-selftest`). The registry is identical: 268 tests, same count per project. `--list` went from ~31 s to ~4 s.

**Negative controls** (`npm run test:journey-coverage`, 24 tests, was 9):
- They run the real registry + AST over `scripts/journey-coverage-fixtures/coverage.spec.ts`, a synthetic, browserless Playwright project with two projects. Its cases: a commented-out test, a renamed test, `test.skip()`, `test.fail()`, declared skip/fail/fixme, `describe.skip`, a describe-level `isMobile` skip, project-name and `isMobile` skips, and an opaque condition.
- They also run a **real** Playwright run of those fixtures through `verifyAgainstResults`.
- The NAV-03 comment case is a regression test against the real `add-deal-dialog.spec.ts`.

**Inventory changes:** A11Y-01 referenced a template-literal fragment (`${name} has no …`) that is not a registered test. It now names the four registered scans. Its `route` claimed `/i/[token]`, but only `/`, `/deal`, `/invoice` and `/pengaturan` are scanned, so `route` is corrected and the gap noted in `followUp`. No other reference changed: every other `real` claim already resolved to a test that runs in its claimed projects. The metrics are unchanged: real interaction 44/94 = 46.8%, P0 86.7%, 25 outstanding P0/P1.

**Validation (local, disposable `127.0.0.1:55432` only, on this follow-up tree):**

| Gate | Result |
|---|---|
| lint / typecheck / build | 0 / 0 / 0 |
| `npm test` | 780/780 (no app code changed) |
| `npm run test:journey-coverage` | 24/24 (was 9) |
| `npm run coverage:journeys` | OK; 95 actions, 94 applicable, real 46.8%, P0 real 86.7%, 25 outstanding P0/P1 |
| `npm run test:diagnostics-selftest` | 1/1 (still runs on its own after the `testMatch` change) |
| `npm run test:e2e` (full non-visual, chromium + chromium-mobile) | 103 passed, 0 failed, 13 skipped. Playwright counts the 3 `test.fail()` due-date runs as passed, and the validator does not count them as coverage |
| ux-audit config (fixtures seeded as `npm run ux:audit` does) | 69/69 |
| `coverage:journeys -- --results <e2e> --results <ux-audit> --require-results` | **75/75 real (action × project) claims passed in an actual run, 0 not exercised** |

On the first local ux-audit attempt I ran the config without seeding the UX fixtures, and 30 of 69 failed. Results mode correctly reported the 4 affected real claims (NAV-06, DEAL-STAGE-04, DEAL-STAGE-05, INV-WA-03) as errors. Re-run with the fixture seed, all 69 passed.

**Due-date reconciliation with PR #26: not done yet (gated).** PR #26 is open and not merged, and merging it needs Chris. Until it lands, `due-date-entry.spec.ts` keeps its two `test.fail()` tests (INV-DUE-02 and INV-DUE-04 stay `blocked`). The follow-on plan after PR #26 merges is in the 2026-10-04 integration receipt.
