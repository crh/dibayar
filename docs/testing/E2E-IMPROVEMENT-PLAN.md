# E2E Improvement Plan

Status: **proposed; planning only**
Branch: `codex/e2e-improvement-plan`
Baseline: `main` at `66fb523`
Prepared: 2026-09-21

This document defines the next improvements to Dibayar's Playwright journey,
accessibility, visual-regression, and CI test layers. It does not authorize or
implement application changes, dependency updates, snapshot regeneration,
deployment, or production-data access.

## 1. Current baseline

The suite has a sound foundation: production-build execution, guarded local
Postgres fixtures, real database-backed Auth.js sessions, deterministic fixture
IDs and dates, semantic locators, desktop and 390px Chromium projects, failure
traces/screenshots/videos, accessibility checks, and a curated visual suite.

Observed on 2026-09-20/21:

- `@critical`: 51 passed, 7 intentionally skipped across `chromium` and
  `chromium-mobile`; no journey failures.
- `@a11y`: 6 passed in desktop Chromium.
- `@visual`: 5 passed and 3 failed. The failures were Beranda desktop, Beranda
  mobile, and Invoice detail; the rendered pages looked materially correct, but
  the baselines must not be updated until the CI-runner diffs are inspected.
- The canonical E2E command did not reach Playwright in the current environment:
  the default Next/Turbopack production build failed while creating a process
  that binds to a port. `next build --webpack` passed, and the successful
  Playwright results above used that webpack production build.
- Firefox and WebKit projects exist but have not been established as a recurring
  CI signal.

## 2. Goals and success criteria

The improvement programme is complete when:

1. The documented E2E commands use one explicit, reproducible production-build
   strategy locally and in CI.
2. Critical journeys, accessibility checks, and the intended visual suite are
   all represented by required or deliberately scheduled CI checks.
3. A failing CI run preserves enough evidence to diagnose it without rerunning
   locally.
4. The recipient-facing invoice journey and the owner share/send workflow have
   direct browser coverage.
5. Mutating tests prove persistence after reload, not only immediate UI state.
6. The suite fails on unexpected browser errors and server failures without
   introducing noise from explicitly allowlisted behavior.
7. Visual and mobile coverage have an explicit policy; `npm run test:e2e` no
   longer has known order-dependent or missing-baseline behavior.
8. Cross-browser coverage runs on a documented cadence and has an owner for
   triage.

## 3. Guardrails and non-goals

- Use only the disposable `127.0.0.1:55432/dibayar_test` database and retain the
  existing `E2E_FIXTURE_CONFIRM=non-production` protections.
- Do not add a production authentication bypass or automate Google OAuth with
  real credentials. Google sign-in remains a manual Preview/Production smoke
  check.
- Do not regenerate visual baselines merely to make a failure green. Inspect
  expected, actual, and diff artifacts on the same CI runner first.
- Do not change product behavior in a test-infrastructure task. If a new journey
  exposes a product defect, record it and fix it in a separately scoped change.
- Do not enable parallel workers or sharding until fixtures are isolated per
  worker/project.
- Do not use Production or Preview data for automated mutation tests.

## 4. Workstream A — deterministic execution

### A1. Decide and pin the production-build strategy

- Reproduce the Turbopack failure in a clean CI-equivalent environment.
- If the failure is environment-specific and cannot be made reliable, change
  the E2E build script to use Next's explicit webpack build mode.
- If Turbopack is retained, document the required process/port capability and
  add a CI assertion that the canonical command reaches Playwright collection.
- Ensure `npm run build`, `npm run e2e:build`, `npm run test:e2e:critical`, and
  `npm run ux:audit` do not silently exercise conflicting build strategies.

Acceptance:

- A clean runner executes the canonical command twice with the same result.
- A build failure is reported as infrastructure failure, not as zero passing
  browser tests.

### A2. Remove known full-suite ambiguity

- Choose one supported meaning for `npm run test:e2e`:
  either an intentional aggregate of critical, accessibility, and visual tiers,
  or a non-visual journey aggregate with visual tests kept in their own command.
- Add `reseedFixtures()` to visual tests or give each mutating suite isolated
  fixture ownership so test order cannot change snapshots.
- Decide whether `chromium-mobile` owns visual baselines. If not, exclude
  `@visual` from that project explicitly instead of relying on command-specific
  project selection.
- Replace the dialog Escape test's empirical timeout with a semantic condition
  if Playwright/component behavior now permits it.

Acceptance:

- The documented full command runs from a freshly seeded database without
  creating untracked snapshot files.
- Reversing spec order does not alter results.

**P2-3 status (2026-09-22, `docs/PROJECT-PLAN-2026-09-22.md`), closed:**
`e2e/deals/filter-navigation.spec.ts`'s "zero /deal network requests" test
replaced its flat `waitForTimeout(300)` with `page.waitForLoadState("networkidle")`
— the request watcher (`watchForDealNavigationRequests`) is event-driven
(`page.on("request", ...)`), so it already captures a request the instant it's
dispatched regardless of when the test checks; waiting for real network
settlement (used for the same purpose earlier in this same test, line ~129)
is strictly more reliable than an arbitrary sleep and resolves faster when
nothing fires. Verified against a real disposable `127.0.0.1:55432/dibayar_test`
database (initially thought unavailable in this environment; it was in fact
already running and reachable, corrected mid-session) via `npm run
test:e2e:critical` (66 passed) and CI (`e2e-critical`, twice green).

`e2e/deals/add-deal-dialog.spec.ts`'s Escape-key `waitForTimeout(750)` was
re-investigated with the same database, not left on faith: removing it and
relying on `toHaveCount(0)`'s own polling was run 15 times
(`--repeat-each=15`) and failed 7/15 — reproducing the original
investigation's finding rather than assuming it still held. Left in place,
with the re-confirmation recorded at the call site. This is now a
positively re-verified "no semantic condition exists" case, not an
unverified assumption.

## 5. Workstream B — CI signal and diagnostics

### B1. Promote accessibility to a maintained CI signal

- Run `@a11y` in CI after the shared production build/database setup.
- Cover Beranda, Deal, Invoice list, Invoice detail, Pengaturan, Add Deal dialog,
  and the public invoice page.
- Keep serious/critical violations blocking. Record moderate violations in the
  report initially, then decide whether to make them blocking after the backlog
  is known.

Acceptance:

- A deliberate accessibility violation fails the expected CI job in a harness
  self-test or temporary verification commit.

### B2. Preserve complete failure evidence

- Upload both `playwright-report/e2e` and `test-results/e2e` when browser tests
  fail, so traces, screenshots, videos, and error context are available.
- Use distinct artifact names for critical, accessibility, visual, and scheduled
  cross-browser runs.
- Keep artifact retention bounded and avoid uploading authenticated cookies or
  environment files.

Acceptance:

- A controlled failed test produces a downloadable trace and screenshot from CI.

### B3. Establish a cross-browser cadence

- Add a scheduled/manual Firefox and WebKit job after installing the required
  Playwright system dependencies.
- Keep Chromium desktop/mobile as the pull-request gate until cross-browser
  runtime and flake rates are understood.
- Define the escalation rule: reproducible product defects block release;
  runner/browser installation failures are infrastructure findings.

Acceptance:

- Firefox and WebKit complete on two consecutive scheduled runs with results and
  artifacts retained.

## 6. Workstream C — highest-value journey coverage

### C1. Recipient-facing invoice journey — highest priority

Add browser coverage for:

- a valid `/i/:token` page rendering invoice identity, issuer, totals, tax,
  payment details, and due date without owner-only navigation;
- the public PDF endpoint returning a PDF with recipient-visible parity;
- invalid and expired tokens returning the intended safe states without leaking
  invoice existence or owner data;
- revoked tokens becoming unusable after reload;
- long issuer/brand/payment text at the 390px viewport.

Fixture changes:

- Expose only stable test token values through the guarded fixture manifest.
- Seed valid, expired, and revoked/invalid cases without weakening production
  token hashing or authorization.

Acceptance:

- Recipient journeys pass unauthenticated on Chromium desktop and mobile.
- Owner-only controls and private fields are asserted absent.

### C2. Owner share, send, and due-date workflow

Add browser coverage for:

- creating/regenerating and revoking an invoice share link;
- share-link state persisting after reload;
- editing and clearing the due date with persistence after reload;
- generated WhatsApp links using the saved template, contact number, amount, and
  optional due-date line;
- blocked-popup/manual-link fallback where practical in Playwright;
- marking paid and undoing after a reload, not only in immediate component state.

Acceptance:

- Every successful mutation is verified after navigation or reload.
- Failure responses leave the UI and persisted data in a coherent prior state.

### C3. Strengthen existing deal and settings journeys

- Verify created deals survive reload and contain the submitted values.
- Verify stage moves survive reload and produce the expected stage-history entry.
- Verify closing an unsaved deal form leaves no database-backed row.
- Isolate or reseed Settings tests so desktop/mobile and visual suites cannot
  inherit a changed issuer name.
- Add representative server-validation and ownership-denial journeys where they
  provide value beyond existing service/API tests.

Acceptance:

- Existing happy-path tests prove persisted outcomes rather than only toasts or
  transient DOM state.

## 7. Workstream D — runtime error detection

- Add a shared Playwright fixture that records `pageerror`, unexpected console
  errors, failed requests, and HTTP 5xx responses.
- Maintain a narrow, documented allowlist for expected navigation aborts or
  third-party behavior; do not broadly ignore error categories.
- Attach the captured diagnostics to the failing test report.
- Add focused response assertions around important mutations so a success toast
  cannot hide a failed or retried request.

Acceptance:

- A deliberate unhandled page error and a deliberate API 500 each fail a harness
  verification test with actionable output.

**Status: closed 2026-09-22** (`docs/PROJECT-PLAN-2026-09-22.md` P2-1, branch
`codex/post-pr8-hardening`). `e2e/support/synthetic/diagnostics-negative-control.ts`
(three specs: pageerror, 5xx, and a clean control) runs under its own isolated
`playwright.diagnostics-selftest.config.ts` (no webServer/DB — fully synthetic
via `page.setContent`/`page.route`), driven as a subprocess by
`e2e/support/diagnostics-selftest.test.mjs` (`npm run test:diagnostics-selftest`),
which asserts the child run exits non-zero and that the two deliberate-failure
specs' JSON-report error text actually names the fixture's own
"Unexpected browser diagnostics" message plus the specific injected string —
not just "some test failed." The synthetic spec is named without
`.spec.`/`.test.` so `playwright.e2e.config.ts`'s default `testDir` sweep never
collects it (confirmed via `playwright test --list`); only the dedicated
config's explicit `testMatch` runs it. Verified locally: the self-test passes,
proving the fixture still fails on both cases and does not false-positive on
the clean control.

## 8. Workstream E — visual and mobile policy

- Re-run the three current visual failures on the GitHub-hosted baseline runner.
- Inspect each diff before deciding whether it represents browser/font drift,
  screenshot timing instability, or a genuine layout change.
- If intentional, regenerate through the existing manual baseline workflow and
  re-run without update mode to prove determinism.
- Decide whether to add true `chromium-mobile` snapshots (`isMobile` and touch)
  or keep a smaller 390px viewport set under desktop Chromium. Record the choice
  in `docs/testing/E2E.md`.
- Prefer semantic/layout assertions for dynamic or interaction-specific behavior;
  keep pixel snapshots curated and small.

Acceptance:

- The visual suite passes twice on the baseline runner without writing files.
- Mobile visual coverage has no implicit missing-baseline state.

## 8a. Residual journey gaps (C1–C3) — status 2026-09-22

`docs/PROJECT-PLAN-2026-09-22.md` P2-4 asks each deferred item below to be
either implemented or explicitly retired here, not silently dropped. This
was first written believing no disposable `127.0.0.1:55432/dibayar_test`
Postgres was available in this environment — that was wrong (Chris pointed
out a running container on the expected port; the earlier check had a false
negative), corrected mid-session once a real database was confirmed
reachable and seeded.

- **Revoked-token recipient view after reload** (C1): **closed.**
  `e2e/public/invoice.spec.ts` "revoked token becomes unusable to the
  recipient after reload" — revokes the shared invoice's real active share
  through the owner's actual UI (a second, separately-authenticated
  browser context via `browser.newContext`/`ownerSessionCookie`, not a raw
  API call), then confirms the recipient's already-open `/i/[token]` tab
  gets the generic 404/not-found state on reload, identical to an unknown
  token. `test.beforeEach(reseedFixtures)` was added to the whole file
  since this is now the one mutating test in it, protecting every other
  test (this file, the other Chromium project sharing the same database,
  and any later spec file) from inheriting the revoked state. Verified:
  12/12 passed across both `chromium`/`chromium-mobile` on this file alone,
  and the full `test:e2e:critical` run (68 passed, 8 intentionally skipped).

Remaining five stay **deferred, not retired** — not because they lack
value, but as a scope/priority choice for this session (see
`docs/receipts/DIBAYAR-PROJECT-PLAN-EXECUTION-2026-09-22.md`), now that a
database is confirmed available for whoever picks these up next:
- **Long issuer/brand text at 390px** (C1): needs a fixture with
  deliberately long strings and a layout assertion, not a snapshot.
- **Blocked-popup/manual-link WhatsApp fallback** (C2): needs verifying
  Playwright's popup-blocking behavior interacts as expected with the
  existing `wa.me` link, which may need a product-side manual-link
  fallback to exist first — check `src/lib/whatsapp.ts` before writing
  the test.
- **Stage-history entry assertions** (C3): needs asserting the
  `DealStageTransition` row/timeline entry, not just the stage-badge UI
  state, after a stage move + reload.
- **Server-validation journey** (C3): needs a deliberately invalid
  mutation request asserting the existing 400 contract end-to-end
  through the UI, not just the API test suite.
- **Ownership-denial journey** (C3): needs a second fixture user/session
  asserting a 403/404 on another user's deal or invoice through the UI.

## 9. Proposed delivery sequence

Implement as reviewable, independently reversible changes:

1. **PR 1 — runner reliability:** A1, A2, and fixture-order fixes.
2. **PR 2 — CI diagnostics:** B1 and B2.
3. **PR 3 — recipient journey:** C1.
4. **PR 4 — owner invoice journey:** C2 and relevant runtime diagnostics from D.
5. **PR 5 — existing-journey persistence:** C3 and remaining D work.
6. **PR 6 — visual/mobile/cross-browser:** B3 and E after the suite is stable.

Each PR should include focused tests, the canonical unit/lint/type/build gates,
the applicable Playwright tier, `git diff --check`, and a short evidence note in
the PR description. Passing one workstream does not authorize the next
workstream's application or infrastructure changes.

## 10. Decisions required before implementation

1. Use webpack explicitly for E2E builds, or require Turbopack parity?
2. Should `npm run test:e2e` include visual tests or remain a semantic journey
   command?
3. Should true `chromium-mobile` visual snapshots become a required gate?
4. Should accessibility moderate-impact findings block immediately or enter a
   measured backlog first?
5. What cadence should own Firefox/WebKit: nightly, weekly, or release-only?

Recommended defaults: explicit webpack E2E builds until Turbopack is proven
reliable; semantic-only `test:e2e`; one curated true-mobile visual tier;
serious/critical accessibility blocking with moderate findings reported first;
and nightly Firefox/WebKit runs.
