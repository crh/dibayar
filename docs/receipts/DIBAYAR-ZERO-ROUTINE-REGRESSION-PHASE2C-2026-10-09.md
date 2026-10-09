# Receipt — Zero Routine Manual Regression Testing, Phase 2C (CI lane, evidence, exception register), 2026-10-09

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **PR #33 into `staging` is open and not merged.** Nothing was deployed or released. `main` and Production were not touched. No Production, hosted-staging or Neon database was read or written; no Vercel, Neon, OAuth or repository setting was changed; no `preview/*` or Neon branch was created; no visual baseline was updated; no schema migration was added; no application code, spec or fixture changed. No coverage-percentage threshold was added. No request went to Google or WhatsApp.

**Final status: `READY_FOR_CHRIS_REVIEW`** (section 13). Three things need your attention when you review:

1. The workflow has one trigger beyond the brief's preferred shape: a `pull_request` trigger limited to the lane's own files (section 2).
2. The schedule cannot fire until the workflow file is on `main`, and it will check `main`, not `staging` (section 2). No scheduled run exists yet.
3. The release policy in Gate F and the register's "Blocks a release" column are a proposal. Merging the PR ratifies them (section 7).

## 1. Start gate (verified live, 2026-10-09)

- PR #32 (`chore/zero-routine-regression-phase2b-2026-10-08`) MERGED into `staging` at 2026-10-09T01:35:16Z, merge commit `eace1b2`.
- `eace1b2` is an ancestor of `origin/staging` (it is its head).
- No open PRs and no Phase 2C branch before this work.
- Live coverage before any change: 95 actions / 94 applicable, real 65/94 = 69.1%, P0 28/30 = 93.3%, 5 outstanding P0/P1 (INV-DUE-03, A11Y-01, DEAL-CREATE-07, INV-DUE-06, INV-STATUS-05); AUTH-03 `manual_verified`. Matches the brief.
- Branch `chore/zero-routine-regression-phase2c-2026-10-09` from `origin/staging` `eace1b2`, in the main checkout. Untracked items (`compose.yml`, two older receipts, `src/generated/`) left as found.

## 2. CI workflow design, before and after

| | Before (Phase 2B) | After (this PR) |
|---|---|---|
| Where | Job `journey-coverage-full` inside workflow `CI` (`e2e.yml`) | Its own workflow `Journey coverage (full)` (`.github/workflows/journey-coverage-full.yml`); the job is gone from `e2e.yml` |
| Triggers | `workflow_dispatch` of `CI` only | `workflow_dispatch`; `schedule` Mon/Wed/Fri 04:43 UTC; `pull_request` only when the workflow file, `scripts/journey-coverage.mjs` or `scripts/journey-coverage-discovery.mjs` change |
| Shares a run with `e2e-cross-browser` | Yes, on every manual dispatch of `CI` | No |
| Steps | full `test:e2e`, keep its results aside, `ux:audit`, `coverage:journeys --require-results` | Same, plus `--evidence`, a run summary, and a 90-day evidence artifact |
| Installs | Chromium, poppler-utils | Same |
| Database | CI Postgres service on `127.0.0.1:55432/dibayar_test` | Same. No secret, no hosted database |
| Limits | none | `timeout-minutes: 45`, `permissions: contents: read`; a newer push to a PR cancels that PR's older run, dispatched and scheduled runs never cancel each other |
| Threshold / release gate | none / no | none / no |

**The extra trigger.** The brief preferred dispatch plus schedule. With only those, `gh workflow run journey-coverage-full.yml --ref <branch>` returned `HTTP 404: Not Found`: GitHub will not dispatch a workflow file that is not on the default branch and has never run. The lane would have been unusable from `staging` until a release. The path-limited `pull_request` trigger registered the workflow (dispatch worked from then on) and means a later edit to the lane is run before it merges. It cannot affect workflow `CI`. If you would rather not have it, it can be removed after this PR's runs; dispatch keeps working once a workflow has run.

**The schedule.** GitHub runs `schedule` only from the default branch. So the schedule starts only after a `staging -> main` release carries the file to `main`, and each scheduled run checks `main`. For the release candidate on `staging`, dispatch it: `gh workflow run journey-coverage-full.yml --ref staging`. **No scheduled run of this workflow has happened; scheduled reliability is not claimed.**

**Duration.** The dispatched runs took about 16 minutes each.

## 3. Manual full-results runs

All `workflow_dispatch` of `Journey coverage (full)` on this branch.

| Run | Head | Result | Claims |
|---|---|---|---|
| `37882859422` (trial, before the final head) | `12e121f` | success | 113 real claims, 113 passed, 0 not exercised |
| `37887980418` | `9bb3114` (final implementation) | success | 113 real claims, 113 passed, 0 not exercised, 0 failed, 0 passed only on retry |
| `37887983419` | `9bb3114` (final implementation) | success | 113 real claims, 113 passed, 0 not exercised, 0 failed, 0 passed only on retry |

`9bb3114` holds every workflow, validator and documentation change in this PR. The only commit after it adds these run IDs to this receipt. Both final runs: full E2E 193 passed, 0 failed, 0 flaky; ux-audit specs 69 passed. These are manual runs; they say nothing about the schedule.

## 4. Proof the scheduled cross-browser acceptance is isolated

By configuration:

- Two workflow files. `e2e.yml` no longer contains the job or any reference to the lane beyond a comment. `journey-coverage-full.yml` has one job.
- Neither file uses `workflow_run` or `workflow_call`. The only `needs:` are inside `e2e.yml`, on `lint-typecheck-test`. The only `concurrency` group is the lane's own and is keyed to itself.
- A workflow run's conclusion comes from its own jobs. A scheduled `CI` run on `main` therefore has exactly `lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit` and `e2e-cross-browser`.

By observation:

- PR run of `CI` `37882789470` on `12e121f`: jobs `lint-typecheck-test`, `e2e-critical`, `ux-audit`, `e2e-a11y` (success), `e2e-cross-browser` (skipped by design). No `journey-coverage-full` job.
- The deliberate lane failure `37883045082` (section 8) is a run of `Journey coverage (full)` only. No `CI` run was created, changed or failed by it.
- Scheduled `CI` runs on `main` are unchanged by this branch (latest: `37753800363`, 2026-10-08, success). They still use `main`'s `e2e.yml`, where the old job was already skipped on `schedule`.

Not done, on purpose: no protected branch was broken to demonstrate this.

## 5. Latest full-claim count and evidence

From the evidence of run `37882859422` (`journey-coverage-full-evidence` artifact and the run's summary page):

- Commit `12e121f7633b1af80e297a860f9f07251db32622`, event `workflow_dispatch`.
- Inventory: 95 actions (94 applicable), 65 automated real interaction, P0 28/30.
- Real claims (action × project): **113. Passed: 113. Not exercised: 0. Failed: 0. Passed only on retry: 0.**
- Results files: full E2E 193 passed, 0 failed, 0 flaky, 25 skipped; ux-audit specs 69 passed, 0 failed.

How a reviewer answers "what is the most recent commit for which every real claim was exercised and passed": the workflow is green only in that case, so

```bash
gh run list --workflow journey-coverage-full.yml --status success --limit 5 \
  --json databaseId,headSha,headBranch,event,createdAt
```

and the run's summary page states the commit and counts without a log (`docs/testing/E2E.md`, "Full real-claim verification"). The evidence JSON's `everyRealClaimExercisedAndPassed` is true only with `--require-results`, at least one claim, and nothing failed or unexercised. It holds no secret: commit, ref, run id, counts, claim labels.

## 6. Exception register

Machine-readable in `docs/testing/journey-coverage.json` (`exceptions`), rendered into `docs/testing/JOURNEY-COVERAGE.md`. `npm run coverage:journeys` now fails when an outstanding P0/P1 action or a P0/P1 manual check has no entry, when an entry outlives its reason (the action became real and no manual check remains), or when its category contradicts the action's status. No action's classification changed.

| Actions | Category | Check / finding | Blocks a release | Evidence required |
|---|---|---|---|---|
| INV-DUE-03 (P0, manual pending), INV-DUE-02 (P0, real) | Physical / native device | MAN-DUE-01 | Yes | Logged PASS on a real Android Chrome phone and a real iPhone Safari |
| AUTH-03 (P0, manual verified) | Third-party auth | MAN-AUTH-01 | Yes | Sign-in and sign-out logged PASS on staging for the release candidate |
| DEAL-CREATE-07 (P1, partial) | Physical / native device | MAN-DEAL-01 | No | Partial tests green; manual check logged or listed as not run |
| INV-WA-01 (P0, real), INV-WA-02, HOME-03 (P1, real) | Physical / native device | MAN-WA-01 | No | Automated journeys green; manual check logged or listed as not run |
| INV-PDF-01, PUB-05 (P1, real) | Physical / native device | MAN-PDF-01 | No | Same |
| SHARE-05 (P1, real) | Physical / native device | MAN-SHARE-01 | No | Same |
| A11Y-01 (P1, partial) | Partial by rule | — | No | `e2e-a11y` green on the release head |
| INV-DUE-06 (P1, partial) | Partial by rule | — | No | Its two stubbed-failure journeys green in `e2e-critical` |
| INV-STATUS-05 (P1, blocked) | Product decision | FIND-01 | Yes | Your decision, or explicit acceptance in the release PR |

The full register also records why each item cannot be fully automated and whether an automation strategy exists (device lane: candidate exists, undecided; Google sign-in: none planned; the two partial-by-rule items: no route under the current rules).

Noted while writing it: the only recorded MAN-AUTH-01 run (2026-09-30, `cab167f`) covers sign-in only, on an older commit.

## 7. Release-readiness policy changes (documentation only)

`REVIEW_CHECKLIST.md` Gate F is now four groups. No script enforces it.

- **F1, automated CI blockers (absolute):** workflow `CI` green on the release head (`lint-typecheck-test` including `coverage:journeys`, `e2e-critical`, `e2e-a11y`, `ux-audit`); no expected-failure test on a P0 action.
- **F2, manual sign-off:** MAN-REL-01; every "blocks a release" manual check logged PASS (MAN-DUE-01, MAN-AUTH-01), or your acceptance; the P1 phone checks logged or listed as not run, which does not block by itself.
- **F3, your explicit acceptance:** every outstanding P0; every product-decision entry (INV-STATUS-05 / FIND-01). Partial-by-rule entries need no acceptance while their tests are green.
- **F4, informational:** latest scheduled `e2e-cross-browser` result; latest `Journey coverage (full)` run for the release head; low findings (FIND-06, FIND-08) and fixes still awaiting device UAT.

What I decided that you may want different:

- P1 phone-only checks (MAN-DEAL-01, MAN-WA-01, MAN-PDF-01, MAN-SHARE-01) do not block when not run. MAN-WA-01 covers INV-WA-01, which is P0, but that action's automated journey is real and the check itself is labelled P1.
- INV-STATUS-05 (P1) needs your explicit acceptance. The old Gate F asked that only for P0.
- The full-coverage run is informational, per the brief ("not a Production release gate yet").

`docs/testing/MANUAL-UAT.md` gained a short table saying which checks a release waits for. FIND-01, FIND-06 and FIND-08 were not implemented or re-decided; their documented status is unchanged (open, decision required).

## 8. Negative controls

All temporary; nothing from them is in the branch. Controls 1 and 2 used mutated copies of the stored full-results JSON in a scratch directory.

| # | Mutation | Result |
|---|---|---|
| 1 | One claimed result set to failed (INV-PDF-01, chromium) | Exit 1: `INV-PDF-01 [chromium]: real test "…" ran and failed`; evidence FAIL, 112 passed, 1 failed |
| 2 | One claimed project result removed (INV-PDF-01, chromium-mobile) | Exit 1: `INV-PDF-01 [chromium-mobile]: not exercised by the given run results`; evidence FAIL |
| 3 | Workflow reads the wrong results file (`test-results/e2e/results.json`, which `ux:audit` has overwritten) on throwaway branch `chore/zr-phase2c-negctl-wrong-results` | Run `37883045082`: **failure** at "Check every real claim against this run", 4 passed, 109 not exercised; summary and evidence say FAIL. Branch deleted afterwards. A missing file exits 2 with `cannot read Playwright results file` and writes no evidence |
| 4 | Simulated lane failure vs. the cross-browser schedule | Section 4: by configuration, plus control 3's failing run touching no `CI` run |

Control 3's output was correct but was a 109-line list, so the check now ends with a hint naming the likely cause (commit `ce3e47d`). The untouched results still pass: 113 passed, 0 not exercised, exit 0.

The validator's own test suite gained permanent negative controls for the register, the evidence and the CLI failure modes (33 tests, was 24).

## 9. Local validation (2026-10-09)

Tree: `12e121f` plus the then-uncommitted docs and the hint commit; nothing after it changes application code, specs, fixtures or Playwright config.

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 944/944 (84 files) |
| `npm run build` | pass |
| `npm run test:journey-coverage` | 33/33 |
| `npm run coverage:journeys` | OK: 95 actions, 94 applicable, 69.1%, P0 93.3%, 5 outstanding |
| `npm run test:diagnostics-selftest` | pass |
| `npm run test:e2e:critical` | 177 passed, 0 failed, 25 skipped |
| `coverage:journeys --results` (critical run) | 108 passed, 5 not exercised (non-critical claims, as designed) |
| `npm run test:e2e` | 193 passed, 0 failed, 25 skipped |
| `npm run test:e2e:a11y` | 14 passed, 1 skipped |
| `npm run ux:audit` | specs 69/69; functional, responsive, state PASS; `@visual` 9/9 fail → overall FAIL locally |
| full E2E + ux-audit → `coverage:journeys --require-results` | 113 passed, 0 not exercised, exit 0 |
| Targeted regressions (FIND-04, FIND-05, FIND-07, PDF journeys, AUTH-02) | 42 passed, 0 failed (7 spec files, chromium + chromium-mobile) |

**`@visual` locally:** 17557, 15200, 13708, 10584, 13943, 9743, 27355, 39880, 12367 differing pixels, the same nine numbers Phase 2B recorded for clean `staging` on this host. Host font drift. CI's `ux-audit` job, which includes `@visual`, is green on this branch. No baseline touched.

**Local test database:** `127.0.0.1:55432/dibayar_test` was reachable but had no schema (all 12 migrations unapplied), as after earlier host restarts. I re-applied the checked-in migrations with `prisma migrate deploy`. No Docker or Compose command was run.

**Regression integrity (brief section F):** FIND-04 popup behaviour, FIND-05 link reuse, FIND-07 expired share, the Phase 2B PDF journeys and the AUTH-02 sign-in entry all ran in the full suite above and again in the targeted run. `wa.me` is answered by the local stub and the Google redirect is read, never followed.

## 10. Latest-head CI and review state

On `9bb3114` (everything except the run IDs in this receipt):

- Workflow `CI`, PR run `37887982844`: **success**. `lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit` succeeded; `e2e-cross-browser` skipped by design (schedule and dispatch only).
- Workflow `Journey coverage (full)`, PR-triggered run `37887982886`: **success**, 113/113. Its evidence names commit `fbacece`: on `pull_request` events GitHub checks out and reports the temporary merge commit of the PR with `staging`, not the branch head. Dispatched and scheduled runs report the real commit.
- The two dispatched runs in section 3: **success**.

The receipt-only commit after `9bb3114` triggers one more `CI` run and one more lane run; their result is in the PR, not here.

Independent review: none recorded yet. This is the worker's own report; Luna/Archie verification and your review are still to come.

## 11. Residual risks

- **Scheduled runs are unproven.** They start only once the file is on `main`. The first weeks of scheduled results should be read before anyone relies on them.
- **The schedule checks `main`, not `staging`.** Evidence for a release candidate needs a manual dispatch. A `push: staging` trigger would automate that at about 16 CI minutes per merge; not added.
- **A green run is as fresh as its commit.** The evidence names the commit; it does not say whether `staging` has moved since.
- **The `pull_request` trigger** adds a ~16-minute run to PRs that edit the lane's own files. It is not a required check.
- **Gate F is procedural.** Nothing enforces it; the repository has no branch protection.
- **PR-triggered evidence names the merge commit**, not the PR head (section 10). Use a dispatched run when the commit matters.
- **Local evidence** (`--evidence` outside CI) records `HEAD` and does not record a dirty working tree. CI runs are from a clean checkout.
- `STATE.md` `day_count` is still 12. Its rule cannot be verified from the repository; left unchanged and flagged, as in Phase 2B.
- `STATE.md` `last_deploy` and the deployment section were not re-verified (no hosted system was inspected); only the Git-verifiable fields were corrected.
- Carried forward, untouched: MAN-DUE-01 on real phones (the last outstanding P0), FIND-01 / FIND-06 / FIND-08 decisions, A11Y-01's unscanned states, the AUTH-02 English CTA, Batch 3.

## 12. Confirmation of what was not touched

`main`, Production, the hosted staging environment, Neon, Vercel, Google OAuth and repository settings were not changed or read. No application code (`src/`), no Playwright spec, fixture or config, no dependency, no migration and no visual baseline changed. No product behaviour changed. One remote branch was created and deleted by me (`chore/zr-phase2c-negctl-wrong-results`, the negative control); it created no deployment. The PR is not merged.

Changed files: `.github/workflows/e2e.yml`, `.github/workflows/journey-coverage-full.yml` (new), `scripts/journey-coverage.mjs`, `scripts/journey-coverage.test.mjs`, `docs/testing/journey-coverage.json`, `docs/testing/JOURNEY-COVERAGE.md` (generated), `docs/testing/E2E.md`, `docs/testing/JOURNEY-BACKLOG.md`, `docs/testing/MANUAL-UAT.md`, `REVIEW_CHECKLIST.md`, `STATE.md`, `DAILY_LOG.md`, this receipt.

Commit history: no generated or untracked file entered history, so either a squash or a merge commit is fine.

## 13. Final status

**`READY_FOR_CHRIS_REVIEW`.** Stopped before merge. Merging PR #33 into `staging` needs your explicit authorization.
