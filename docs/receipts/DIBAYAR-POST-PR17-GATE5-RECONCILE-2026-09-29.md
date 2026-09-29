# Dibayar — Post-PR17 Gate 5 reconcile, verify, and PR (2026-09-29)

Task packet: `DIBAYAR-POST-PR17-GATE5-RECONCILE-AND-PR-PROMPT-2026-09-29.md`.
Previous receipt: `DIBAYAR-GATE5-FIX-AND-PR17-MERGE-ATTEMPT-2026-09-29.md`.
Timestamps below are UTC (local session date 2026-09-29, UTC+7).

## Repository state

| Item | Value |
|---|---|
| Remote | `git@github.com:crh/dibayar.git` |
| Starting `origin/main` (before fetch) | `4c2f868` (PR #16 merge) |
| `origin/main` after fetch | `1ed968f` |
| PR #17 | **MERGED** 2026-09-28T21:55:19Z by `crh`, merge commit `1ed968f11d8d3b48620047261426593bb28deab7` |
| `origin/staging` | `4c2f868` (unchanged) |
| Gate 5 branch | `fix/vercel-predeployment-branch-gate` |
| Original local commit | `2c9bb84` (based on `4c2f868`) |
| Rebased Gate 5 commit | `a8c0e28` |
| Docs reconcile commit | `f5bda7d` (first pushed head) |
| Working tree | clean except pre-existing untracked `src/generated/` (Prisma output, untouched) |

## Changes

The Gate 5 commit's content is unchanged apart from conflict resolution:
`vercel.json`, `scripts/vercel-ignore-build.sh`, `scripts/vercel-ignore-build.test.mjs`,
`DEPLOYMENT.md`, `docs/DEVELOPMENT-WORKFLOW.md`,
`docs/receipts/DIBAYAR-VERCEL-PREDEPLOYMENT-GATE5-FIX-2026-09-28.md`.
The follow-up commits touch `STATE.md`, `DEPLOYMENT.md`, and this receipt.

**Conflict resolution (rebase onto `1ed968f`).** Only `DEPLOYMENT.md` conflicted.
`docs/DEVELOPMENT-WORKFLOW.md` auto-merged cleanly, and I checked it by hand.
- "other branches" table row: I kept the Gate 5 row (two-layer mechanism, pending live verification). I expanded its `ignoreCommand`-disproved clause to name both live instances from PR #17's side (`chore/workflow-ci-only-smoke` 2026-09-27 and `chore/staging-activation-2026-09-27` 2026-09-28).
- "CI-only ordinary branches" bullet: I kept the Gate 5 two-layer bullet. I also kept PR #17's whole "Ordinary-branch Neon suppression gap" section (history, R2 audit, selective-branching guidance) word for word, and added a short "Proposed fix (Gate 5)" pointer at its top.
- I removed nothing from the PR #17 staging-activation documentation.

**Follow-up doc facts.** `DEPLOYMENT.md` "Neon capacity" now has a dated 2026-09-29 observation of 2/10. The stale "after Chris frees Neon capacity" precondition is gone. `STATE.md` records that PR #17 is merged, Neon is at 2/10, the eight earlier branches are gone, and Gate 5's status. It contains no authorization statements.

**Gate 5 behavior intact.** `vercel.json`:
```json
"git": { "deploymentEnabled": { "**": false, "main": true, "staging": true, "preview/**": true } }
```
`ignoreCommand` is retained as secondary.

## Validation (at `f5bda7d`)

| Command | Exit | Result |
|---|---|---|
| `npm run lint` | 0 | no errors |
| `npm run typecheck` | 0 | |
| `npm test` | 0 | 80 files, 771/771 passed |
| `npm run test:vercel-ignore-build` | 0 | 48/48 passed |
| `npm run build` | 0 | |
| `git diff --check origin/main` | 0 | clean |
| `vercel.json` JSON parse | 0 | OK |
| Ajv vs `https://openapi.vercel.sh/vercel.json` | 0 | VALID. Negative controls (a string value in `deploymentEnabled`, an unknown top-level key) were rejected. The published schema claims draft-04 but uses draft-06+ `exclusiveMinimum` in unrelated sections, so I compiled it in Ajv's default draft-07 dialect. |
| minimatch 3.1.5 and 10.2.5 (both installed) | 0 | Deploy: `main`, `staging`, `preview/foo`, `preview/a/b`. Blocked: `fix/vercel-predeployment-branch-gate`, `chore/x`, `feat/x`, `feature/x`, `hermes/m2`, `random`, `mainline`, `staging-old`, `previewx/y`. Also `"*"` does not match `chore/x`; `"**"` does. |
| GitHub CI run `36490024380` (PR #18) | success | `lint-typecheck-test`, `e2e-a11y`, `e2e-critical`, `ux-audit` succeeded; `e2e-cross-browser` skipped by design |

## GitHub

- Pushed `fix/vercel-predeployment-branch-gate` (first push, not forced) at 2026-09-28T22:02:37Z, head `f5bda7d3bcc9a94c47e61f43d149d1bf1b605ec2`.
- PR **#18**: https://github.com/crh/dibayar/pull/18. Base `main`, **OPEN, not merged**. Merging needs Chris's separate explicit authorization.

## Live Gate 5 evidence (first push, `f5bda7d`)

| Time (UTC) | Neon branches | Newest Vercel deployment | Vercel commit statuses on SHA | GitHub deployments for ref |
|---|---|---|---|---|
| 21:57:44 (baseline) | 2: `main`, `preview/chore/staging-activation-2026-09-27` | `dibayar-grdzyj9zo` (PR #17 Production, Ready) | — | — |
| 22:02:28 (just before push) | 2 (same) | `dibayar-grdzyj9zo` | — | — |
| 22:03:08 | 2 (same) | `dibayar-grdzyj9zo` | 0 | 0 |
| 22:04:00 | 2 (same) | `dibayar-grdzyj9zo` | 0 | 0 |
| 22:10:50 | 2 (same) | `dibayar-grdzyj9zo` | 0 | 0 |

Control: PR #17's head commit `8a33a05` on an ordinary `chore/*` branch carries Vercel commit statuses, including "Canceled by Ignored Build Step". This shows the status check can detect a Vercel deployment on an ordinary branch. The Gate 5 commit has none.

**Conclusion: PASS for this push.** The ordinary `fix/*` ref created no Vercel deployment and no Neon branch.

Scope limits:
- This is proven on the PR branch, where the pushed commit's own `vercel.json` has the rule. Other ordinary branches cut from `main` get the gate only after PR #18 merges.
- The positive side (`main`/`staging`/`preview/**` still deploy) is shown by config and tests only. I pushed no live `preview/**` branch because that would provision a Neon branch.
- I could not read the Vercel dashboard "Ignored Build Step" field or the Neon-integration settings from this session.

The second push, which added this receipt, is recorded in the PR #18 comment thread.

## Not done (guardrails)

I did not merge any PR or deploy manually. I did not delete, create, or mutate any Neon branch, and did not create the persistent `staging` Neon branch. I made no Vercel, OAuth, or GitHub setting change, and printed no secrets.

## Remaining Chris-only actions

1. Review PR #18 and, if authorized, merge it. A merge deploys Production.
2. Delete Neon branch `preview/chore/staging-activation-2026-09-27` (PR #17 merged, so it is now eligible).
3. Create the persistent `staging` Neon branch from the current primary branch.
4. Configure the Vercel staging environment/domain.
5. Register the Google OAuth staging redirect URI.
6. Confirm the Vercel dashboard "Ignored Build Step" field is empty/default.
7. Enable GitHub "Automatically delete head branches".
8. After merge: optionally confirm on a fresh ordinary branch cut from the new `main` that it gets no Vercel deployment and no Neon branch.
