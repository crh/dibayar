# Dibayar — PR #16: Deploy-Filter Test CI Enforcement Fix (2026-09-27)

**Outcome: the one valid unresolved Codex P2 finding on PR #16 is fixed, revalidated locally and in real CI, the review thread is replied to with exact evidence and resolved, and PR #16 is left OPEN, review-ready, mergeable, with required CI green and no unresolved review threads. Not merged — still requires Chris's explicit authorization.**

## Review finding

Codex flagged (P2, `package.json` line 31, thread `PRRT_kwDOTVT6hM6mZi3t`, unresolved at task start):

> The new test (`test:vercel-ignore-build`) is only exposed as a standalone package script, while the `lint-typecheck-test` job runs `npm test`, and `vitest.config.ts` limits that command to `src/**/*.test.{ts,tsx}`. Consequently, no PR or `main`/`staging` push executes this suite, so a regression in the inverted exit-code behavior or branch allowlist could merge with green CI and either suppress required deployments or deploy ordinary branches.

Confirmed accurate by reading `.github/workflows/e2e.yml` and `package.json` directly: the `lint-typecheck-test` job ran `npm run lint` / `npm run typecheck` / `npm test` / `npm run build`, with no step invoking `test:vercel-ignore-build` (the `node --test scripts/vercel-ignore-build.test.mjs` suite), which Vitest's `src/**/*.test.{ts,tsx}` scoping never picks up.

## Fix

`.github/workflows/e2e.yml`, `lint-typecheck-test` job — added one step:

```yaml
- run: npm test
# Shell-script suite for scripts/vercel-ignore-build.sh: not covered by
# `npm test` (vitest.config.ts scopes that to src/**/*.test.{ts,tsx}),
# so it must run explicitly or a regression in the inverted exit-code
# behavior/branch allowlist could merge with green CI (PR #16 Codex P2).
- run: npm run test:vercel-ignore-build
- run: npm run build
```

No change to `scripts/vercel-ignore-build.sh` or its test file — the review finding was about CI wiring, not the filter logic itself, and no test failure emerged that would justify touching the logic. Existing workflow triggers (`pull_request`, `push` to `[main, staging]`, `workflow_dispatch`, `schedule`) and every other job/step left untouched. `docs/receipts/DIBAYAR-STAGING-BOOTSTRAP-2026-09-27.md` updated minimally (one new table row, one new paragraph) to record that the suite is now CI-enforced; `STATE.md` left unchanged since its existing wording ("NOT YET LIVE-VERIFIED") is about live Vercel behavior, not CI coverage, and was not false.

## Local validation

```
npm run test:vercel-ignore-build -> 11/11 pass (all 6 required cases: main/staging/preview/* -> build,
                                     ordinary branches -> skip, previewish-branch -> skip,
                                     unset VERCEL_GIT_COMMIT_REF -> fail open/build)
npm run lint       -> exit 0, errorCount sum 0, warningCount sum 0 (all files)
npm run typecheck  -> exit 0
npm test           -> 80 test files, 771 tests, all passed (91.04s)
npm run build      -> Next.js 16.3.3 (Turbopack) production build succeeded, all 21 routes compiled
```

## CI validation

Commit `6689238` pushed to `bootstrap/staging-workflow`. New CI run: **`36315909044`** (https://github.com/crh/dibayar/actions/runs/36315909044).

Job outcomes:

```
lint-typecheck-test  -> success
e2e-a11y             -> success
e2e-critical         -> success
ux-audit             -> success
e2e-cross-browser    -> skipped (by design; only runs on schedule/workflow_dispatch)
```

Confirmed directly from the `lint-typecheck-test` job's own step list (`gh api repos/crh/dibayar/actions/jobs/108610457058`), not inferred from local validation:

```
Step 7: Run npm test                        -> success
Step 8: Run npm run test:vercel-ignore-build -> success
Step 9: Run npm run build                    -> success
```

And from that step's raw log (TAP output):

```
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

This is direct evidence the suite executed inside required CI and passed, in the correct job, in the correct position — not an inference from the local run.

## Review thread

- Replied on the P2 thread (`package.json` line 31) with: exact fix commit (`6689238`), exact CI run (`36315909044`) and job id (`108610457058`), the passing step's TAP tally, and confirmation that the filter logic itself was untouched. Reply: https://github.com/crh/dibayar/pull/16#discussion_r4115193779
- Resolved the thread after CI proved the fix (`resolveReviewThread` mutation; `isResolved: true` confirmed by re-querying `reviewThreads`). No other unresolved review threads exist on PR #16.

## PR

```
number:            16
state:             OPEN
draft:             false
head:              6689238512eecac8cc6215a23fe8045d38bd7178 (bootstrap/staging-workflow)
base:              main
mergeable:         MERGEABLE
mergeStateStatus:  CLEAN
required CI:       green (see above)
unresolved threads: 0
merged:            false
```

## Remaining next step

Chris authorizes merge of PR #16 (still targets `main` and would trigger a Production deploy — every `main` merge during the pre-staging transition needs his explicit per-PR authorization per `docs/DEVELOPMENT-WORKFLOW.md`). After that: create `staging` from the merged commit and proceed through the six pre-staging transition gates and the external Vercel/Neon/Google-console/GitHub-settings action packet already recorded in `docs/receipts/DIBAYAR-STAGING-BOOTSTRAP-2026-09-27.md` §4-5. This task did not touch, advance, or attempt any of those external actions or the six gates, and did not create `staging`.

---

**Scope discipline honored:** no continuation of the external staging rollout, no merge of PR #16, no change to the deploy-filter script's logic, no broadening beyond the one CI-wiring gap, no gate marked complete, no external Vercel/Neon/Google/GitHub-settings action attempted.
