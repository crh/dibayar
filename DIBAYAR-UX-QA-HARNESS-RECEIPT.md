# Dibayar UX QA Harness — Completion Receipt

## 1. Baseline commit

`179802c` (`Merge branch 'security/dependabot-triage-deepmerge-major'`, `origin/main` at session start). Working tree was clean except one untracked, unrelated file (`DIBAYAR-VISUAL-DATE-PUSH-RECEIPT.md`, left untouched).

## 2. Branch

`test/ux-qa-harness`, created from `main` at the baseline commit. Not merged or pushed.

## 3. Architecture inventory (Phase 1 findings)

Before writing any code, inspected: `playwright.config.ts` (pre-existing `tests/ux-audit/` harness, port 3100, single chromium project) and `playwright.e2e.config.ts` (the separate `e2e/` journey layer, port 3300, chromium + chromium-mobile + firefox/webkit tiers, `@critical`/`@visual`/`@a11y` tags); `tests/ux-audit/support/{capture,detectors,viewports,parity}.ts` (solid, reusable — overflow/touch-target/wrapped-row/overlap detectors already had a real intentional-scroll-exception mechanism keyed on `data-testid="deal-board-rail"`); the existing specs (`baseline.landing`, `fixtures.baseline`, `detectors.selftest`, `t27.verification`) — all one-off historical regression proofs for past tasks (T-00, T-27), not a generic reusable matrix; `scripts/ux-fixtures.ts` (seeds a rich single "owner" with all 6 deal stages, mixed invoice statuses, one long brand name, one invalid phone, plus an empty "zero" user, against `127.0.0.1:55432/dibayar_test`); `.github/workflows/e2e.yml` (only ran the `e2e/` suite — `tests/ux-audit/` had **no CI wiring at all**); `e2e/visual/visual.spec.ts` (existing, stable pixel-regression suite using fixed-calendar-date fixtures).

Key finding that shaped the design: `deal-board.tsx`'s `[data-testid="deal-board-rail"]` is `overflow-x: auto` at **every** viewport, including desktop — so "does an intentional scroll container exist" is the wrong question; the real question is whether it actually needs to scroll at a given width.

**Why the existing suites can miss UX defects**: `e2e/` asserts semantics (role/text/URL) at exactly two viewports, no geometry checks. `tests/ux-audit/` checks geometry but only for the exact past-task scenarios; no generic route×state×viewport matrix, no severity/report/gate model, no CI wiring, no dedicated Deals-desktop-scroll regression, no negative-control proof beyond the existing detector unit tests.

## 4. Files added / modified

**Modified (additive only, no removed assertions):**
- `scripts/ux-fixtures.ts` — added a `quiet` fixture user (nothing-needs-chasing) and 8 more deal rows on `owner` (many-deals density + overdue-deliverable); all existing ids/manifest keys/checks unchanged.
- `tests/ux-audit/support/detectors.ts` — scroll-exception logic now reads from `scroll-policy.ts`'s registry (behavior-identical, proven by the pre-existing `detectors.selftest.spec.ts`'s 28 tests all still passing unchanged); added `measureScrollContainer`, `detectHiddenRequiredControls`, `detectEmptyStateInconsistency`.
- `tests/ux-audit/support/capture.ts` — `CaptureDescriptor.viewport` widened from the old viewport-set union to `string` so it isn't coupled to one specific viewport module.
- `playwright.e2e.config.ts` — added a `json` reporter output (additive; existing `list`/`html` reporters unchanged) so `ux-report.ts` can read the `@visual` suite's results.
- `package.json` — added `ux:audit` and `ux:report` scripts.
- `.github/workflows/e2e.yml` — added a `ux-audit` job.
- `.gitignore` — added `/artifacts/` (generated output, same treatment as `/test-results/`).

**Added:**
- `tests/ux-audit/support/viewport-matrix.ts`, `scroll-policy.ts`, `session.ts`
- `tests/ux-audit/routes/deals.desktop-scroll.spec.ts`, `matrix.spec.ts`
- `tests/ux-audit/states/needs-chasing.spec.ts`
- `tests/ux-audit/synthetic/detectors.negative-control.spec.ts`
- `scripts/ux-audit.ts`, `scripts/ux-report.ts`
- `docs/testing/UX_AUDIT.md`

## 5. New commands

```
npm run ux:audit                     # full gate
npm run ux:audit -- --route=/deal    # focused
npm run ux:report                    # regenerate report from existing JSON results
```

## 6. Viewport matrix

`support/viewport-matrix.ts`: `mobile375` 375×812, `tablet768` 768×1024, `laptop1280` 1280×800, `desktop1440` 1440×900, `desktop1920` 1920×1080. Kept separate from the pre-existing `support/viewports.ts` (used by historical specs with hardcoded artifact-count assertions).

## 7. Fixture/state matrix

All additive to the existing `owner`/`other`/`zero` users (new `quiet` user added):

| state | fixture |
| --- | --- |
| fresh-user | `zero` (0 deals, 0 invoices) |
| normal-user | `owner` |
| many-deals | `owner.deals.many` (7 extra cards, MASUK/NEGO/DEAL) |
| long-content | `owner.deals.invoice` / `owner.invoices.overdue` (pre-existing long brand name) |
| nothing-needs-chasing | `quiet` (real deal + PAID-only invoice) |
| overdue-invoice | `owner.invoices.overdue` (pre-existing) |
| overdue-deliverable | `owner.deals.overdueDeliverable` (new: past `deadline`, pre-INVOICE) |
| mixed-deal-payment-states | `owner` (pre-existing: DRAFT/SENT/DUE/OVERDUE/PAID) |

## 8. Deterministic detectors implemented

Pre-existing (T-00, unchanged behavior): `detectHorizontalOverflow`, `detectSmallTouchTargets`, `detectWrappedActionRows`, `rectanglesOverlap`.

New: `measureScrollContainer` (does a known scroll container actually need to scroll), `detectHiddenRequiredControls` (an explicitly `data-ux-required`-marked control that's hidden/zero-size/detached), `detectEmptyStateInconsistency` (declared item count vs. rendered items vs. empty-state copy, all must agree).

## 9. Intentional-scroll exception mechanism

`tests/ux-audit/support/scroll-policy.ts` — a reviewable `ALLOWED_SCROLL_CONTAINERS` registry (exact `testid`/`uxScroll` match only, never role/pattern matching), consumed by `detectHorizontalOverflow` via an injected argument (browser-side code can't `import` it directly). Currently two entries, both pre-existing exemptions carried over unchanged: `deal-board-rail`, `stage-filter`.

## 10. Screenshot / visual-regression design

`routes/matrix.spec.ts` captures a curated 9 route/state pairs × 2 viewports (`mobile375`, `desktop1440`) = **18 screenshots** to `artifacts/ux-audit/screenshots/`, each also checked for page overflow and sub-44px controls. Full pixel diffing is deliberately **not** re-implemented here: `scripts/ux-fixtures.ts` uses relative dates, which would make a `toHaveScreenshot()` baseline drift daily. Instead, `ux:audit` runs the existing, stable `e2e/visual/visual.spec.ts` (`--grep @visual`, fixed-calendar-date fixtures) and the report's "Visual Regression status" reflects that run.

## 11. Synthetic negative-control tests and results

`tests/ux-audit/synthetic/detectors.negative-control.spec.ts`, all against `page.setContent` only (no app/DB): **9/9 passed**.

1. page-level horizontal overflow ✓
2. desktop Deals-like board with unintended horizontal scroll ✓
3. element escaping the viewport ✓
4. overlapping interactive control (pseudo hit-area theft) ✓
5. invisible required control ✓ (+ 5b visible-control control-case ✓)
6. incorrect empty-state/data expectation ✓ (+ 6b/6c consistent-state control-cases ✓)

## 12. `Needs chasing` state-test results

`tests/ux-audit/states/needs-chasing.spec.ts`, **3/3 passed**:
- actionable (`owner`): overdue + due-soon invoices both appear with correct urgency reason; the out-of-window SENT invoice correctly excluded.
- fresh-user zero (`zero`): correctly shows Beranda's onboarding empty state (FollowUpQueue doesn't render at all with 0 deals — asserted explicitly).
- nothing-needs-chasing zero (`quiet`): real activity confirmed independently via `/deal`, then confirmed the queue's own local empty copy renders (business logic, not absent data).

## 13. Deals regression-test results

`tests/ux-audit/routes/deals.desktop-scroll.spec.ts`, **5/5 passed**, against `owner`'s full board (1-per-stage + many-deals density, unfiltered):
- `laptop1280`/`desktop1440`/`desktop1920`: rail does not require horizontal scroll, page has no horizontal overflow.
- `mobile375`/`tablet768`: page still has no horizontal overflow (rail's own scroll is allowed and unasserted).

## 14. CI changes

Added a `ux-audit` job to `.github/workflows/e2e.yml`, parallel to (not nested in) `e2e-critical`, same disposable Postgres service, running `npm run ux:audit` and uploading `artifacts/ux-audit/` on every run (`if: always()`).

## 15. Exact validation results

| command | result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean (0 files with errors/warnings) |
| `npx vitest run` | 752/752 passed (78 files) |
| `npm run test:e2e:critical` | 51 passed, 7 skipped (pre-existing skips, untouched files), 0 failed |
| `npm run test:e2e:visual` (via `ux:audit`) | 8/8 passed |
| `npm run ux:audit` | **61/62 tests/ux-audit tests passed** + 8/8 visual; exits **non-zero** (see gap below) |
| `npm run build` | succeeds (Next.js 16.3.0, all 21 routes) |

## 16. Generated report location

`artifacts/ux-audit/UX-AUDIT-REPORT.md` (plus `manifest.json`, `ai-review-manifest.json`, `matrix-findings.json`, `screenshots/`). Current run: Functional=FAIL (1 pre-existing finding, see below), Responsive/Layout=PASS, State/Data=PASS, Visual Regression=PASS, Overall=FAIL.

## 17. Remaining gaps / risks

- **Known pre-existing failure, not caused by this branch**: `fixtures.baseline.spec.ts`'s "captures populated owner dashboard" test fails against unmodified `main` — verified by stashing all my `ux-fixtures.ts` changes, reseeding the original fixture data, and rerunning that one test in isolation (same failure). The legacy `/dashboard` route no longer shows `UX/OVERDUE/004` the way this T-00-era spec expects, most likely superseded by `/`, `/deal`, `/invoice` after T-27. Recorded as a HIGH finding rather than silently fixed or excluded, per this task's explicit scope constraint (don't fix unrelated product logic). This is also the reason `ux:audit` currently exits non-zero — every check this task asked for is green; this one pre-existing, out-of-scope defect is not.
- `--route=` focused mode does simple title-substring matching (`--grep`), not a structured route/state/viewport selector — kept intentionally simple per the task's "optionally support... if it stays simple."
- MEDIUM/LOW severities are defined in the model but nothing in this harness currently emits one (all current checks are binary pass/fail at CRITICAL/HIGH); documented in `docs/testing/UX_AUDIT.md` as a place to extend, not a gap in coverage.
- The subjective-AI-review manifest (`ai-review-manifest.json`) is produced but not consumed by anything in this branch — by design (section 14 of the task explicitly forbids making AI review a CI dependency).

## 18. Final status

**READY_FOR_INDEPENDENT_REVIEW**

All 15 items in the task's "Required Demonstration" are satisfied. The one non-zero exit from `ux:audit` is a genuine, independently-verified pre-existing defect outside this branch's scope, not a gap in the harness itself — which is precisely the harness doing its job (reporting real problems instead of always passing).
