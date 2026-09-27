# Dibayar — Staging bootstrap: hung-session recovery + repo-side rollout (2026-09-27)

**Outcome: repo-side pre-staging transition work is committed, locally validated
clean, and opened as a review-ready PR into `main` (the documented one-time
bootstrap exception). None of the six pre-staging transition gates are
complete — every remaining gate is an external Vercel/Neon/Google-console/
GitHub-settings action that belongs to Chris.**

## 1. Hung-session recovery

- A prior session on this same branch ran roughly two hours and stalled in the
  Bash/tool-execution layer; its last visible command was `echo hi`, left
  `Running` indefinitely. A fresh session was started to recover state rather
  than trust that session's tail-end claims.
- Working-tree state found at recovery: `bootstrap/staging-workflow` at
  `4d92f87` (== `origin/main`, == `main`), 8 modified tracked files, 4
  untracked paths (2 real receipts, 1 new script + its test). No reset,
  checkout, stash, or clean was run before or during inspection.
- Work preserved: all 8 modified files' diffs were read in full and cross-
  checked against live repository/GitHub/Neon state before any further edit.
  All of it was accurate and is kept. One stale cross-reference was found and
  fixed (§3).
- Work confirmed incomplete: this receipt itself (referenced by both `STATE.md`
  and `DEPLOYMENT.md` before it existed); the `bootstrap/staging-workflow`
  branch had never been pushed; no PR existed.
- No destructive command was run at any point in this recovery.

## 2. Repository changes (this session's diff, on top of the prior session's)

| File | What changed | Verified against |
|---|---|---|
| `.github/workflows/e2e.yml` | `push.branches` now `[main, staging]` | live file content |
| `vercel.json` | added `ignoreCommand: bash scripts/vercel-ignore-build.sh` | live file content |
| `scripts/vercel-ignore-build.sh` (new) | Vercel Ignored-Build-Step allowlist: builds `main`, `staging`, `preview/*`; skips everything else; fails open (builds) if `VERCEL_GIT_COMMIT_REF` is unset | read in full; logic matches `DEPLOYMENT.md`'s described mechanics |
| `scripts/vercel-ignore-build.test.mjs` (new) | 11 `node:test` cases covering the allowlist, the fail-open path, and the `previewish-branch` non-match edge case | `npm run test:vercel-ignore-build` — all pass (see §3) |
| `package.json` | added `test:vercel-ignore-build` script | diff only |
| `scripts/cron-guard.mjs` | `DEFAULT_EXPECTED_BRANCH` changed `hermes/m2-invoice` -> `main` | diff; code already parameterizes on this constant elsewhere (no other hardcoded branch name in the script) |
| `scripts/cron-guard.test.mjs` | matching assertion updated | diff |
| `STATE.md` | full section rewrite: `now`, `pre_staging_transition` checklist (new), `decisions_last_3_days`, `approvals`, `next_3_tasks`; reduced to 92 lines (cap 120) | `wc -l`; content cross-checked against `gh`/`git`/`neon` below |
| `DEPLOYMENT.md` | environment-map table row for "other branches" updated from "not yet enforced" to "repo config added, not yet live-verified"; new "Deployment filtering" / "CI staging trigger" rollback subsections; Neon-capacity bullet updated to 7/10 with named PR branches; **this session fixed** a stale `origin/hermes/m2-invoice` reference left in the cron-guard description (the line above it had already been updated to describe the new `main` default, but this one line was missed) | `git diff`; live grep for remaining stale references (none left outside historical `DAILY_LOG.md`/`SECURITY.md` entries, which are dated history and correctly left alone) |
| `docs/receipts/DIBAYAR-M4-NEXT-MOVE-2026-09-26.md` (untracked, pre-existing) | PR #13 merge-attempt evidence from an earlier session, never committed | read in full; matches `STATE.md`'s references |
| `docs/receipts/DIBAYAR-PR14-FINAL-RECEIPT-2026-09-27.md` (untracked, pre-existing) | PR #14 Preview-fix evidence from an earlier session, never committed | read in full; matches `STATE.md`'s references |
| `docs/receipts/DIBAYAR-STAGING-BOOTSTRAP-2026-09-27.md` (this file) | was referenced by `STATE.md`/`DEPLOYMENT.md` before it existed — the hang happened before it was written | created this session |

No dependency, schema, auth/session, or API-route file was touched. `src/generated/` remains the pre-existing gitignored, correctly-owned (kenji, not root) Prisma client output and was not modified.

## 3. Validation (re-run from scratch in this fresh session, not trusted from the hung one)

```
npm run lint       -> exit 0, errorCount sum 0, warningCount sum 0 (all files)
npm run typecheck  -> exit 0
npm test           -> 80 test files, 771 tests, all passed (105.58s)
npm run build      -> Next.js 16.3.3 (Turbopack) production build succeeded, all 21 routes compiled
npm run test:vercel-ignore-build -> new script's own suite, all cases passed
```

Tool execution behaved normally throughout this session: `printf 'shell-ok'` returned immediately before any long-running command was attempted, and every subsequent command (including the 105s test run and the build) completed and returned control normally. Nothing hung. This corroborates the hung-session hypothesis (tool-layer stall, not a Dibayar build/test problem) rather than contradicting it.

No behavioral/UI change is in this diff (CI trigger config, a new deploy-filter shell script, a stale-default-branch-name fix, and docs), so no new Playwright journey test was added — `docs/testing/E2E.md`'s trigger condition (navigation/URL/multi-step/auth/cross-component behavior change) does not apply here. The new shell script has its own focused `node:test` suite instead, matching the pattern used for `scripts/cron-guard.mjs`.

## 4. External actions — Chris action packet

| Action | Why needed | Exact scope | Where | Validation after | Rollback | Status |
|---|---|---|---|---|---|---|
| Create `staging` branch | Pre-staging gate 1 | `git branch staging <known-good main commit, after this PR merges>`; push | Git (Chris or Claude with authorization, after merge) | `git ls-remote --heads origin staging` | Delete the branch (never `main`) | REQUIRED — deferred until after this PR merges per `docs/DEVELOPMENT-WORKFLOW.md` sequencing |
| Verify/confirm Vercel "Ignored Build Step" dashboard field is empty/default | So this repo's `ignoreCommand` in `vercel.json` is the single source of truth, not silently overridden or duplicated | Vercel project settings | Vercel dashboard | Push a throwaway `chore/*` branch, confirm no deployment appears | Clear the dashboard field if non-default | REQUIRED |
| Stable Vercel staging environment/domain | Pre-staging gate 2 | Vercel custom environment or the ordinary `staging` branch Preview, with a stable domain | Vercel dashboard | `curl` the stable domain, confirm 200/302-to-SSO as expected | Remove the environment/domain | REQUIRED |
| Neon staging branch (never pruned) | Pre-staging gate 3 | A persistent Neon branch dedicated to `staging` | Neon console | `neon branches list`, confirm it exists and is wired to the Vercel staging env | Delete the branch (destructive — Chris only) | REQUIRED |
| Google OAuth staging redirect URI | Pre-staging gate 4 | Add `https://<staging-domain>/api/auth/callback/google` to the OAuth client's 3-URI allowlist | Google Cloud Console | Live Google sign-in against the staging domain | Remove the URI | REQUIRED |
| Verify ordinary-branch deploy suppression live | Pre-staging gate 5 | Push a disposable `chore/workflow-ci-only-smoke` branch (Phase 9 of the recovery prompt); confirm CI runs, no Vercel deployment, no Neon branch | GitHub Actions + Vercel + Neon | As above | Delete the disposable branch after | REQUIRED — repo-side mechanism (`vercel-ignore-build.sh`) is committed and unit-tested, but has never seen a real Vercel build event |
| Confirm staging CI path live | Pre-staging gate 6 | Push (or merge) something to `staging` once it exists; confirm the `e2e.yml` `push` trigger fires | GitHub Actions | Actions tab | n/a (config already in this PR) | REQUIRED — trigger config is in this PR; unexercised until `staging` exists |
| GitHub "Automatically delete head branches" | Repo hygiene named in `docs/DEVELOPMENT-WORKFLOW.md` "Cleanup" | Repo Settings toggle | GitHub repo settings | `gh api repos/crh/dibayar --jq .delete_branch_on_merge` reads `true` | Toggle off | REQUIRED — **carried forward from the prior session**, not retried this session (auto-mode classifier denied it before; per this session's own operating rule, a denied settings/destructive action is reported once, not retried) |
| Neon branch pruning (merged-PR previews) | Free capacity before the staging branch needs its own slot | Delete stale Neon preview branches for already-merged PRs (see §5 candidates) | Neon console | `neon branches list` re-count | n/a (branches are disposable Preview copies) | REQUIRED — destructive, Chris-only per `docs/DEVELOPMENT-WORKFLOW.md` "Authorization" |
| Merge `bootstrap/staging-workflow` into `main` | Every `main` merge during the pre-staging transition needs explicit per-PR authorization | Merge the PR opened by this session | GitHub | Post-merge CI green, `main` HEAD matches | Revert PR | REQUIRED — do not merge without Chris's explicit go-ahead |

## 5. Transition gates

```
[x] repo-side deploy-filtering config added, unit-tested       — PASS (code-level only)
[ ] staging branch exists                                       — NOT STARTED (deferred to post-merge)
[ ] stable Vercel staging environment/domain verified            — NOT STARTED
[ ] stable Neon staging branch verified                          — NOT STARTED
[ ] staging Google OAuth redirect configured                     — NOT STARTED
[ ] ordinary branch deploy suppression verified LIVE              — BLOCKED (mechanism committed; unexercised — no real Vercel build event yet)
[ ] staging CI path verified                                      — BLOCKED (trigger committed; unexercised — staging doesn't exist)
```

None of the six required gates are complete. Do not treat this PR's merge as completing the transition — it only makes the transition possible to complete.

## 6. Neon (read-only; nothing deleted or created this session)

```
branch count: 7 / 10 (free_v3 plan)
main:         br-still-darkness-aobvo77q  (ready)
staging:      does not exist
preview branches (all `ready`):
  preview/codex/m4-invoiced-this-month              (PR #14, merged — cleanup candidate)
  preview/codex/document-development-workflow      (PR #15, merged — cleanup candidate)
  preview/codex/m4-provisional-decisions-readiness  (PR #13, merged — cleanup candidate)
  preview/codex/ci-font-self-hosting                (PR #12, merged — cleanup candidate)
  preview/codex/p2-4-ownership-denial               (PR #11, merged — cleanup candidate)
  preview/fix/preview-neon-database-binding         (older; merged per DAILY_LOG history — cleanup candidate)
free capacity: 3 branches
```

All 6 non-`main` branches correspond to already-merged PRs whose GitHub git branches also still exist on `origin` (GitHub "delete merged branches" is off — see §4). No connection string, host, or credential was read or printed.

## 7. Vercel

- Production: unaffected this session; no deployment, redeploy, or settings change made or attempted.
- Staging: does not exist yet (this PR only adds the repo-side pieces that a future staging deployment will use).
- Ordinary-branch suppression: repo-side mechanism (`vercel.json` `ignoreCommand`) is committed and unit-tested at the script level, but **not yet live-verified** — it has not seen a real Vercel build event, because this branch had not been pushed before this session.
- Preview behavior: unchanged this session; PR #14's now-merged Preview history is documented in the pre-existing `DIBAYAR-PR14-FINAL-RECEIPT-2026-09-27.md`.

## 8. OAuth

- Production callback: unchanged, out of scope this session.
- Staging callback: does not exist; required before gate 4 can be checked (see §4).
- Localhost callback: unaffected; `src/auth.ts` uses `trustHost: true` and reads no `AUTH_URL`/`NEXTAUTH_URL`, so the three-URI strategy in `docs/DEVELOPMENT-WORKFLOW.md` needs no additional base-URL env var beyond the callback registration itself (confirmed by reading `src/auth.ts` in an earlier session this branch inherited; re-confirmed this session by reading the same file).
- What Chris must still change: add the staging redirect URI once a staging domain exists (see §4).

## 9. Git / PR

- Branch: `bootstrap/staging-workflow`, created from `main` @ `4d92f87` (the exact commit named in `docs/DEVELOPMENT-WORKFLOW.md`'s allowed-exceptions list, post-PR #14/#15 merge).
- Commits: `ec849c3` (this session's full recovery + repo-side changeset), plus this small follow-up commit adding the PR number to `STATE.md`. No force-push, no history rewrite, no squash of pre-existing work.
- PR: **#16** (`bootstrap/staging-workflow` -> `main`), opened this session — the documented one-time bootstrap exception. Left review-ready, **not merged**.
- CI: run `36312256822` triggered on PR open; see the PR's checks tab for the live/final result (not restated here to avoid a stale snapshot going out of date the moment a new run fires).
- Merge status: **not merged.** Requires Chris's explicit per-PR authorization per `docs/DEVELOPMENT-WORKFLOW.md` "Authorization" (merging to `main` deploys Production).

## 10. Remaining work

Only actual unresolved items:

1. Chris's explicit authorization to merge this PR.
2. Every item in the §4 action packet (staging branch creation is sequenced *after* this PR merges, per `docs/DEVELOPMENT-WORKFLOW.md`; the rest can proceed in parallel once Chris has bandwidth).
3. The Phase 9 smoke tests (disposable `chore/*` CI-only branch; `staging` update; optional `preview/*` smoke) — none attempted this session, since they depend on infrastructure that doesn't exist yet (`staging`) or would consume Neon capacity that should be validated against a merged, authoritative `vercel.json` first.
4. P2-2's scheduled-run acceptance streak (unrelated to this bootstrap; tracked separately in `STATE.md`).
5. All pre-existing M4/product-decision blockers (unchanged, unaffected by this bootstrap; see `STATE.md` `approvals`).

No secrets were read, printed, or committed at any point in this recovery.
