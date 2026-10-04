# Receipt — Close review findings and integrate PR #26 + PR #25 (2026-10-04)

Prepared by Claude Code (worker), Asia/Jakarta, for Chris. Nothing was merged, deployed, or released. No Production, hosted-staging, or Neon database was read or written. No Vercel, Neon, or OAuth setting was changed, and no visual baseline was updated. All database work used the disposable local `127.0.0.1:55432/dibayar_test` only.

## 1. Starting state (verified live, not assumed)

- `origin/staging` = `27d3ab1`, `origin/main` = `308a339`. Both PRs were OPEN and mergeable, with heads exactly as in the task snapshot: PR #26 `9334109`, PR #25 `80173c8`.
- **Nothing had been fixed since the snapshot.** All three Codex P2 threads were unresolved, with no replies.
- PR #26 was worked in its existing worktree (`dibayar-due-date-fix`, clean) and PR #25 in the main checkout, which is on its branch. That checkout's two pre-existing untracked receipts and `src/generated/` were left untouched. No other worktree was modified.

## 2. PR #26 — `fix/due-date-input-integrity-2026-10-04` → `staging`

**State: OPEN, review-clean, merge-ready (not merged).** Head is `3081bb2` (fix `f1328dc`, receipt `3081bb2`). Latest-head CI run **`37169015246`: success**: lint-typecheck-test ✓ (vitest 893/893), e2e-critical ✓ (99 passed / 17 skipped), e2e-a11y ✓ (12 passed / 1 skipped), ux-audit ✓, e2e-cross-browser skipped by design (schedule/dispatch only).

| Finding | Before | After | Evidence |
|---|---|---|---|
| `invoice-validation.ts:18`: demo seed passes a `Date` | `m4:demo-data seed` would throw a Zod error at the first invoiced deal. `createInvoice(input: unknown)` hid it from typecheck. It was the only such caller. | The caller sends a `yyyy-mm-dd` Jakarta day (`buildM4DemoInvoiceInput` / `jakartaDateOnlyOffset`). The strict public schema is unchanged. | Every demo payload goes through the real `createInvoice` at 16:59:59Z and 17:00Z and is stored as UTC midnight of the intended day. The old `Date` payload is rejected. The script was not run: its guard allows only staging. |
| `date-field.tsx:128`: failed save leaves the attempted date visible | After a failed pick, Enter/blur, or clear, the field showed the unsaved date (or was empty after a failed clear) while the DB still held the old value. | The field reverts to the last confirmed value: the newest successful request in the chain, else the persisted prop. The error stays visible and retry works. While saving, the newest intent stays on screen, and a mid-flight keyboard draft is never overwritten. | 7 unit tests + 2 browser journeys (`page.route` 409; DB checked via `page.request`). Negative controls: 5/7 unit and 3/3 browser fail on the pre-fix component. |

Also changed in PR #26: on Chromium, the visible-field picker test no longer skips when `:open` is missing; it fails loudly. Firefox and WebKit stay feature-detected, and both pass.

Integrity properties from the original PR were re-proven on the new tree by the critical suite:
- No PATCH for intermediate segments.
- One PATCH on Enter or blur.
- The picker opens from the visible text.
- An invalid year returns 400 with no mutation.
- Legacy rows stay correctable.

Local gates:
- lint, typecheck, build: 0 / 0 / 0
- unit: 893/893
- critical E2E: 99 / 0 / 17
- Firefox + WebKit due-date spec: 10 / 0 / 12, with the skips being the Chromium-only keyboard/API tests
- picker on 4 projects: 8/8
- a11y: 12 / 0 / 1

One local picker run hit `ERR_CONNECTION_REFUSED` because I started it while the a11y run still owned port 3300. A clean rerun passed 8/8. `@visual` was not re-run: there is no layout change, and the local renderer differs (PR #26 receipt §7).

**Review threads:** both replied to with evidence and **resolved**.

## 3. PR #25 — `chore/journey-coverage-2026-10-03` → `staging`

**State: OPEN.** The validator finding is fixed and pushed (fix `925d223`, evidence `9dec296`). CI **`37169922379` on `9dec296`: success**: lint-typecheck-test ✓ (vitest 780/780, journey self-test 24/24, `coverage:journeys` OK), e2e-critical ✓ (91 passed / 13 skipped; new results step: 70 real claims passed, 5 not exercised because they are non-@critical: the 4 ux-audit claims and A11Y-02), e2e-a11y ✓, ux-audit ✓ (69 passed). **The due-date reconciliation is NOT done**, because it depends on PR #26 being merged (§5).

**Finding** (`journey-coverage.mjs:91`): the validator matched titles by text search and trusted `kind`. The **old validator accepted all six** synthetic false positives as real coverage: a commented-out test, a renamed test, `test.skip()`, `test.fail()`, `test.fixme()`, and `describe.skip`.

**Fix:**
- References are resolved through Playwright's own registry (`playwright test --list` with a small custom reporter) and each test's TypeScript AST.
- Skip/fail/fixme conditions in the body and in describe/file scope are evaluated per project. Anything not evaluable is "unknown" and never counts.
- Each claimed project of an `automated_real_interaction` action needs a `real` test that runs there.
- `expected_failure` references must still be `test.fail()`-annotated.
- Run results (`--results`, `--require-results`) confirm the claims. CI's `e2e-critical` job now checks its own results.
- `playwright.e2e.config.ts` now sets `testMatch: /\.spec\.ts$/`, so runs and `--list` no longer execute the node:test diagnostics self-test. The registry is identical at 268 tests, and listing drops from 31 s to 4 s.
- Negative controls in `npm run test:journey-coverage` (24 tests, up from 9) run the real discovery and a real browserless Playwright run over `scripts/journey-coverage-fixtures/`.

**Inventory:**
- A11Y-01 referenced a non-test title fragment and claimed an unscanned `/i/` page. Both are corrected.
- No other claim was false. Metrics are unchanged: **real interaction 44/94 = 46.8%, P0 real 86.7%, manual verified 1/94, 25 outstanding P0/P1.**
- With actual runs (full non-visual e2e: 103 passed / 0 failed / 13 skipped; ux-audit: 69/69 after seeding as `npm run ux:audit` does), `--require-results` verified **75/75 real (action × project) claims, 0 not exercised**.
- The 3 `test.fail()` due-date runs show as "passed" in Playwright's totals and are not counted as coverage.
- My first, unseeded ux-audit run failed 30 of 69, and results mode correctly flagged those 4 claims. That run is reported here, not hidden.

Local gates:
- lint, typecheck, build: 0 / 0 / 0
- unit: 780/780
- journey self-test: 24/24
- `coverage:journeys`: OK
- diagnostics self-test: 1/1

Critical E2E was covered by the full run above.

**Review thread:** replied to with evidence and **resolved**.

## 4. Recommendation and safe merge order

**Merge PR #26 first, then PR #25** (after its reconciliation). Reasons:
- PR #26 is self-contained and green.
- PR #25's expected-failure tests encode the *pre-fix* behavior. With the new validator, once PR #26 lands, those `test.fail()` tests will "unexpectedly pass" and the inventory's `expected_failure` references will be rejected. PR #25 is therefore deliberately blocked until it is reconciled against the merged fix.

## 5. Gated follow-on plan (run only after Chris merges PR #26)

1. Confirm PR #26's merge SHA on `origin/staging`.
2. In the main checkout, merge `origin/staging` into `chore/journey-coverage-2026-10-03`. Don't rebase: the branch is shared and already pushed. A trial `git merge-tree` of the two heads predicts conflicts **only** in `STATE.md` and `DAILY_LOG.md`; `docs/testing/E2E.md` auto-merges. Resolve by keeping both entries in date order and dropping nothing.
3. `e2e/invoices/due-date-entry.spec.ts`:
   - Delete the picker `test.fail()` test and the keyboard `test.fail()` test. PR #26's `due-date-integrity.spec.ts` has strictly stronger versions: empty and filled picker on all engines; keyboard per-digit no-PATCH, Enter, reload, clear.
   - Keep "an invoice whose due date was cleared shows the empty state after reload" (INV-DUE-01). It is unique.
   - Update the header comment.
4. Inventory:
   - **INV-DUE-02** → `automated_real_interaction`, scope `chromium`, `chromium-mobile`, `real` refs to "clicking or tapping the visible empty due-date text opens the native date picker" (plus the filled variant). It needs PR #26's tightened Chromium skip, already merged with it, to be statically runnable.
   - **INV-DUE-04** → `automated_real_interaction`, scope `chromium`, `real` ref to "keyboard year entry never sends a partial or out-of-range date, saves on Enter, survives reload, and clears".
   - Consider a new action for the failed-save journey.
   - **FIND-02/FIND-03** → fixed in PR #26 (merge SHA).
   - **INV-DUE-03 and MAN-DUE-01 stay `manual_pending`** until there is physical Android/iOS evidence.
   - Regenerate the report and expect real coverage to rise by exactly the claims that pass.
5. Gates: lint, typecheck, unit, build, `test:journey-coverage`, `coverage:journeys`, critical E2E plus `--results`, full e2e plus ux-audit with `--require-results`, a11y, and Firefox/WebKit due-date. Then confirm latest-head CI.
6. If PR #25 is merged first by someone else, do steps 3–5 on a new `fix/*` branch and don't rewrite the merged branch.

## 6. Still outstanding (kept separate and visible)

1. **Read-only Production count** of out-of-range Invoice `dueDate` and Deal `deadline`: Chris to run or authorize. The proposal is in PR #26's receipt §9. Not run.
2. **Real Android Chrome / iPhone Safari UAT** (MAN-DUE-01): still manual and not claimed.
3. **FIND-01** ("Tandai terlambat" shows "Terkirim"): needs a product decision.
4. **Legacy out-of-range dates** still render literally (e.g. "15 Jan 2") on the list, Beranda, the public page, and the PDF. Only the owner detail page shows the invalid state.
5. **Deal `deadline` validation** is still `z.coerce.date()`: a follow-up.
6. **Next phase:** the "Zero Routine Manual Regression Testing" backlog is now numbered in `docs/testing/JOURNEY-BACKLOG.md` (7 steps, deduplicated against Batches 1–3). Nothing is started, and no coverage gate is turned on.

## 7. CI and approvals

- PR #26 latest head `3081bb2`: run `37169015246`, success.
- PR #25 head `9dec296`: run `37169922379`, success. This receipt is a docs-only commit on top of it; its own run is listed on the PR.

**Approvals Chris must give next:**
1. Merge PR #26 into `staging`.
2. Then authorize me (or do it yourself) to run §5 on PR #25, and later merge PR #25.
3. The read-only Production query (§6.1).
4. Real-device UAT on staging.
5. FIND-01 decision.
6. Eventual `staging → main` release.

Links: https://github.com/crh/dibayar/pull/26 · https://github.com/crh/dibayar/pull/25
