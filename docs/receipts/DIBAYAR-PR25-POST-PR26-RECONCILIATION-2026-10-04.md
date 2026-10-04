# Receipt — PR #25 reconciled after the PR #26 merge (2026-10-04)

Prepared by Claude Code (worker) for Chris, Asia/Jakarta. **PR #25 was not merged.** Nothing was deployed or released. No Production, hosted-staging, or Neon database was read or written. No Vercel, Neon, or OAuth setting was changed, and no visual baseline was updated. All database work used the disposable local `localhost:55432/dibayar_test`. Host, port, and database name were checked before any run; credentials were not printed. The fixture scripts' own guards stayed in place.

## 1. Starting state (verified live)

- PR #26: **MERGED** 2026-10-04T02:39:38Z as `b51fba1d9148dcff28f638d48738469f2963a142`. `git merge-base --is-ancestor b51fba1 origin/staging` passes, and `origin/staging` = `b51fba1`. Its tree is identical to the PR #26 head `3081bb2`.
- PR #25: OPEN, head `607c05ef`, **CONFLICTING / DIRTY**. The local and remote branch were both `607c05e`, so no concurrent contributor had pushed. Its one review thread (Codex P2, validator) was resolved. The last CI run was `37170432898`: success.
- Main checkout: on the PR #25 branch, with three untracked items owned by others (two 2026-10-01 receipts and `src/generated/`). Neither path exists on `staging`. They were left untouched.

## 2. What changed

| Commit | Kind | Content |
|---|---|---|
| `ca02959` | merge | `origin/staging` (`b51fba1`) merged into the branch. **No rebase, no force-push.** |
| `d8827ed` | test + inventory | Obsolete expected-failure tests removed; inventory and generated report updated |
| (this commit) | docs | E2E.md, JOURNEY-GRAPHS/BACKLOG, MANUAL-UAT, REVIEW_CHECKLIST, STATE, DAILY_LOG, this receipt |

**Merge conflicts.** The integration receipt predicted exactly two, and those were the only ones:
- `STATE.md`: `active_branch` and `decisions_last_3_days`. Both decision entries were kept, newest first, as each side had prepended. `active_branch` now names this branch and the reconciliation.
- `DAILY_LOG.md`: both sides appended. All four entries were kept, ordered by commit time: journey coverage (10-03) → due-date fix (07:49) → PR #26 follow-up (08:46) → PR #25 follow-up (09:04).
- `docs/testing/E2E.md` auto-merged: PR #26 added one fixture-table row and PR #25 changed separate sections. Its stale `test.fail()` paragraph was rewritten in the docs commit.

**Tests (`e2e/invoices/due-date-entry.spec.ts`).**
- Removed `clicking or tapping the visible empty due-date field opens the date picker` (FIND-02) and `keyboard date entry after clicking the visible field saves, survives reload, and clears` (FIND-03). Both were `test.fail()`.
- The keyboard test assumed a click leaves the picker closed and that typing saves at once. Both assumptions are wrong by design now, so the test was removed, not adapted.
- Kept `an invoice whose due date was cleared shows the empty state after reload` (INV-DUE-01). The header comment explains the removal.

PR #26's `due-date-integrity.spec.ts` was checked for coverage of what was removed:
- **Picker:** the visible text opens the picker, both for an empty and for a filled field. Chromium uses a click (desktop) or a tap (390px). On Chromium a missing `:open` fails the test instead of skipping it. Firefox and WebKit are feature-detected.
- **Keyboard:** a PATCH check after **every** digit asserts zero PATCHes, and the input is proven to pass through `0002-01-15`. Enter sends exactly one PATCH, `2030-01-15`, and leaving the field afterwards sends nothing more. The date survives a reload, and a clear also survives a reload.
- **Failed saves:** the field reverts and a retry works, for both Kosongkan and typed Enter.
- **Other cases:** out-of-range input is refused, Escape restores the saved date, legacy rows can be corrected, and the API contract is tested.

**Inventory (`docs/testing/journey-coverage.json`):**

| Entry | Before | After |
|---|---|---|
| INV-DUE-02 (P0) | `blocked`, `expected_failure` ref | `automated_real_interaction`, scope `chromium`, `chromium-mobile` (+ `manual: real phones`). `real` refs: the empty and filled picker tests in `due-date-integrity.spec.ts`. **Firefox/WebKit are not claimed.** They pass, but they skip at runtime when `:open` is unsupported, and the validator correctly treats that as unknown (§4). |
| INV-DUE-04 (P1) | `blocked`, `expected_failure` ref | `automated_real_interaction`, scope `chromium`. `real` refs: keyboard entry, out-of-range refusal, typing over a saved date + Escape. |
| INV-DUE-06 (P1, failed save) | partial (component test) | **Still `automated_partial`.** The PR #26 browser failed-save tests were added as `partial` refs because the failure is injected with `page.route`, which the inventory's rules classify as a stub. This action already existed, so no new one was added and nothing is double-counted. |
| INV-DUE-03 / MAN-DUE-01 | `manual_pending` | Unchanged. Emulation is not real-device evidence. |
| FIND-02, FIND-03 | open | `fixed: PR #26 (merge b51fba1, into staging …; not yet on main/Production)`. Pending real-device and Production-data items are named in the status. |
| FIND-01 | open | Unchanged (product decision). |

PR #26's legacy-row journeys were **not** added as a new action. The inventory has no "legacy invalid row" action. Adding one would raise the denominator and the numerator together, so the change belongs in a scoped inventory review, not in this reconciliation.

## 3. Coverage (generated by `npm run coverage:journeys:report`, not hand-edited)

| Metric | Before (`607c05e`) | After |
|---|---|---|
| Real-interaction | 44/94 = 46.8% | **46/94 = 48.9%** |
| P0 real-interaction | 26/30 = 86.7% | **27/30 = 90.0%** |
| P1 real-interaction | 16 | **17** |
| Manually verified | 1/94 = 1.1% | 1/94 = 1.1% |
| `blocked` | 3 (1 P0, 2 P1) | 1 (P1: INV-STATUS-05 / FIND-01) |
| Outstanding P0/P1 | 25 | **23** |
| Remaining outstanding **P0** | 3 | **2**: DEAL-CREATE-01 (`automated_partial`), INV-DUE-03 (`manual_pending`) |
| Real (action × project) claims verified by actual runs | 75/75 | **78/78**, 0 not exercised |

The +2 actions and +3 run-verified claims match exactly what passed: INV-DUE-02 on two projects and INV-DUE-04 on one.

## 4. Validator still rejects false coverage (run on the real inventory, each mutation reverted with `git checkout`)

| Mutation | Result |
|---|---|
| Claim INV-DUE-02 on `firefox` and `webkit` (runtime feature-detect skip) | rejected: "no real test runs as a pass in firefox/webkit (… unknown)" |
| Claim INV-DUE-04 on `chromium-mobile` | rejected: all three refs "skipped" there |
| Re-add `test.fail()` to the keyboard tests | rejected: "expected_failure" in chromium, and refs must pass in at least one claimed project |
| Rename the picker tests (registry miss) | rejected: "not a test Playwright registers" |
| `test.describe.skip` on the integrity suite | rejected for INV-DUE-04 real refs and INV-DUE-06 partial refs |
| Before any inventory edit, run the merged tree with the old refs | rejected: both removed titles "not a test Playwright registers" |
| `--require-results` with critical-only results | exit 1: the 5 non-@critical claims are "not exercised" |

The `npm run test:journey-coverage` self-tests (synthetic fixtures: comment, rename, skip, fail, fixme, `describe.skip`, unsupported project, results mode) passed 24/24. After the mutations the tree was clean and the validator returned OK.

## 5. Validation (local, on the reconciled tree)

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0, 281 files, 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` | exit 0 |
| Unit | `npm test` (vitest) | **893/893**, 82 files |
| Build | `npm run build` | exit 0 |
| Journey self-test | `npm run test:journey-coverage` | 24/24 |
| Inventory | `npm run coverage:journeys` | OK (95 actions, 94 applicable) |
| Diagnostics self-test | `npm run test:diagnostics-selftest` | 1/1 |
| Critical E2E | `npm run test:e2e:critical` (includes `e2e:build`) | **104 passed, 0 failed, 18 skipped, 0 flaky** |
| Critical results | `coverage:journeys -- --results test-results/e2e/results.json` (as CI) | OK: 73 real claims passed, 5 not exercised (4 ux-audit, A11Y-02; non-@critical, same as before) |
| Full non-visual E2E | `playwright … --project=chromium --project=chromium-mobile --grep-invert @visual` (= `test:e2e` minus the rebuild of the same tree) | **116 passed, 0 failed, 18 skipped** |
| UX audit | `npm run ux:audit` (seeds, rebuilds, runs) | `tests/ux-audit`: **69/69**. Functional / responsive / state-data PASS. Visual FAIL (below), so exit 1 |
| All claims vs runs | `coverage:journeys -- --results <full> --results <ux-audit> --require-results` | **OK: 78 real claims passed, 0 not exercised** |
| a11y | `playwright … --project=chromium --grep @a11y` | 12 passed, 0 failed, 1 skipped |
| Firefox + WebKit | `due-date-integrity.spec.ts` + `due-date-entry.spec.ts`, `--project=firefox --project=webkit` | **12 passed, 0 failed, 12 skipped**. None of the skips is the `:open` feature-detect skip, so both picker tests really ran and passed on both engines. |

**Expected failures:** **0** in every run. Results JSON has no test with `expectedStatus: "failed"`. `grep` finds no `test.fail(` or `.fixme(` in `e2e/` or `tests/ux-audit/`. There were no unexpected passes and no flaky tests.

**Every skip is by design** (critical/full runs, 18):
- `due-date-integrity` on chromium-mobile: 5 "desktop Chromium keyboard path" and 1 "API contract; runs once"
- `add-deal-dialog` ×2 and `filter-navigation` ×4 on mobile: top-bar links render only at ≥640/1024px
- `deal-crud` ×2, `public/invoice` ×1, `mobile-create-entry` ×1, `mobile-nav` ×1 on desktop: 390px-only layouts
- `invoice-journeys` ×1 on mobile: the native date input is not `fill()`-stable

Firefox/WebKit (12): 10 "desktop Chromium keyboard path" and 2 "API contract; runs once". a11y (1): a 390px-only test.

**`@visual` (inside `ux:audit`): 9/9 differ from the CI-rendered baselines on this machine.** To check whether this was a regression:
- I ran the same `@visual` command on **staging `b51fba1`** (the clean PR #26 worktree, tree-identical to staging) on the same machine. It failed **the same 9/9**.
- Comparing actual screenshots, branch vs staging: **7 byte-identical**. Add Deal dialog differs by 9 px and Invoice detail by 19 px. Both differences sit in the share-URL box, whose text contains the server port (3300 vs 3301), so the ellipsis antialiasing shifts.
- `git diff origin/staging HEAD -- src prisma public next.config.* package-lock.json e2e/visual e2e/support` is **empty**: this PR changes no app code.

Conclusion: environmental font rendering, not a regression. No baseline was changed. CI's own renderer decides (§6).

Port hygiene: 3300 was free before the runs, and the staging comparison used `E2E_PORT=3301`. Both worktrees ended clean, apart from gitignored build/test output and the pre-existing untracked files.

## 6. CI and PR status

Head `5fd0870` (merge + test/inventory + docs): CI run [`37185867967`](https://github.com/crh/dibayar/actions/runs/37185867967): **success**.

| Job | Result |
|---|---|
| lint-typecheck-test | ✓ vitest 893/893, self-tests 48/48 and 24/24, `coverage:journeys` OK (48.9%, P0 90.0%, 23 outstanding) |
| e2e-critical | ✓ 104 passed, 18 skipped. Results check: 73 real claims passed, 5 non-@critical not exercised. Diagnostics self-test 1/1. |
| e2e-a11y | ✓ 12 passed, 1 skipped |
| ux-audit | ✓ 69/69. **`@visual` 9/9 pass in CI's renderer**, `overallStatus: PASS`, 0 findings. This confirms the local visual failures in §5 are environmental. |
| e2e-cross-browser | skipped by design (schedule/dispatch only) |

After the push, PR #25 is **MERGEABLE / CLEAN**. The branch has no GitHub deployments and its head has no Vercel commit status (`gh api`), so no Preview was provisioned. The one review thread is resolved. This receipt update is a docs-only commit, and its own CI run is listed on the PR.

**Recommendation: READY_FOR_CHRIS_REVIEW.** Stopped before merge. Merging PR #25 into `staging` needs Chris's explicit authorization. The items in §7 stay open after any merge.

## 7. Outstanding (not done here, kept visible)

1. **Read-only Production audit** of out-of-range `Invoice.dueDate` and `Deal.deadline`. **Not run.** It needs a separately authorized, scoped Production operation (query in the PR #26 receipt §9).
2. **Real-device verification** (MAN-DUE-01) on Android Chrome and iPhone Safari. **Not done**, and emulation is not counted. Steps 9–10 were added (out-of-range year, iOS wheel).
3. **FIND-01** (overdue vs. Terkirim). Needs a product decision.
4. **Legacy out-of-range date rendering** on Beranda, the invoice list, the public page, and the PDF ("15 Jan 2"), and the permissive **Deal `deadline` validation** (`z.coerce.date()`). Both are tracked separately.
5. **Zero Routine Manual Regression Testing.** Not started. The plan is in `docs/testing/JOURNEY-BACKLOG.md`. No percentage gate was enabled, and no manual check is claimed retirable.
6. Firefox/WebKit picker coverage is real but unclaimed. Claiming it would need a statically provable test, or a scope rule that accepts run results. That is a validator design decision for the next phase.

