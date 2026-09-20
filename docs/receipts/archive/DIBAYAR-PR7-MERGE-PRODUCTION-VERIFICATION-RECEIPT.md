# Dibayar PR #7 Merge + Production Verification — Receipt

## 1. Executive Summary

PR #7 (`fix/preview-neon-database-binding`) was independently re-verified in a
fresh session on 2026-09-18/19. Its head commit is unchanged from the
previously verified SHA (`5b68d99`). All independent checks — diff/contract
inspection, CI status, and local lint/typecheck/build — pass. The full local
`npm test` run could not be completed on this machine due to persistent,
system-wide memory pressure from unrelated concurrent processes (see §4);
this is corroborated, not worked around, by CI's clean 766/766 pass at the
exact head SHA and a clean local run of the PR's own test file.

**The merge itself (`gh pr merge 7 --merge`) was blocked by the Claude Code
auto-mode permission classifier** ("Merge Without Review"). Per this task's
own safety rules (do not "improve"/route around a control without evidence
it blocks a verified-safe action), no alternate/raw method was attempted to
force the merge. **PR #7 was not merged. No production deployment exists yet
for this change.**

Final decision state: **NOT_READY_TO_MERGE** — not because any verification
gate failed, but because the merge action requires explicit user action
(approve the Bash permission, or merge manually) that this session cannot
grant itself. All gates that could be independently verified passed.

## 2. Starting State

- Repository: `/home/kenji/code/dibayar` (`git@github.com:crh/dibayar.git`)
- Base branch: `main`
- PR: #7, "fix: point Preview DB connections at the Neon-integration variable"
- PR head branch: `fix/preview-neon-database-binding`
- PR head SHA (current, verified): `5b68d99a6205b9b7a361dcd56b2d604ed3848ffe`
- Expected verified SHA (from prior receipt): `5b68d99a6205b9b7a361dcd56b2d604ed3848ffe` — **match**
- Worktree state: clean of tracked changes; several untracked `.md` receipt
  files from prior sessions present (not part of this PR's diff, not staged,
  not touched by a merge operation)

## 3. PR / Diff Verification

- Current PR state: `OPEN`
- Mergeable: `MERGEABLE`, `mergeStateStatus`: `CLEAN`
- Current head SHA: `5b68d99a6205b9b7a361dcd56b2d604ed3848ffe` (no new commits since prior verification)
- Differences from previously verified state: none — 3 commits (`f62078e`, `98d6260`, `5b68d99`), same as prior receipt
- Diff scope vs `main`: 4 files — `scripts/vercel-build.sh` (new, 21 lines), `src/lib/prisma.ts`, `src/lib/prisma.test.ts`, `vercel.json` (2-line change)

**Fail-closed runtime contract** (`src/lib/prisma.ts`, inspected directly):
- `VERCEL_ENV === "preview"` → requires `DATABASE_URL_POSTGRES_URL`; throws
  `"DATABASE_URL_POSTGRES_URL is required for Vercel Preview database connections"`
  if absent — **no fallback to `DATABASE_URL`**.
- Non-preview (including production) → unchanged: reads `DATABASE_URL`,
  throws if absent. Verified untouched for non-preview envs.

**Fail-closed build/migration contract** (`scripts/vercel-build.sh`,
inspected directly):
- `VERCEL_ENV = preview` → requires `DATABASE_URL_POSTGRES_URL_NON_POOLING`;
  `exit 1` before any Prisma step if absent — **no fallback to `DATABASE_URL`**.
- `vercel.json` invokes `bash scripts/vercel-build.sh` (2-line file, no long
  inline `buildCommand` — the prior incident this PR also fixes).

**Test assertions** (`src/lib/prisma.test.ts`, inspected — not just names):
- `"fails closed on Preview when the integration variable is absent, without
  falling back to DATABASE_URL"` — sets `DATABASE_URL` to a live-looking
  fallback value *and* omits `DATABASE_URL_POSTGRES_URL`, then asserts the
  client throws rather than silently using `DATABASE_URL`. This is a direct
  behavioral assertion of the fail-closed contract, not a name-only check.
- A companion test confirms non-preview (`VERCEL_ENV=production`) still uses
  `DATABASE_URL` and ignores the preview-only variable.

## 4. Validation Gates

| Gate | Result | Evidence |
|---|---|---|
| Lint | PASS | `npm run lint` locally, exit 0, 240 files, 0 errors / 0 warnings |
| Typecheck | PASS | `npm run typecheck` locally, exit 0 |
| Tests (CI, head SHA) | PASS | GitHub Actions run `35174229195`, job `lint-typecheck-test`: `npm test` → `766 passed (766)`, `79 passed (79)` test files, 63.71s |
| Tests (local, full suite) | **INCONCLUSIVE — environmental** | Local `npm test` was killed twice by the harness's system-memory guard (machine-wide `free` memory dropped from ~4.7Gi to ~1.3Gi independent of test parallelism settings tried: default, then `--no-file-parallelism`); `ps aux` showed multiple unrelated Hermes multi-agent gateway processes and two Chrome instances consuming memory concurrently on this shared machine. Not a code issue. |
| Tests (local, PR-scoped) | PASS | `npx vitest run src/lib/prisma.test.ts` → `4 passed (4)`, clean run |
| Build | PASS | `npm run build` locally, exit 0, all routes compiled (`Compiled successfully in 55s`, TypeScript pass, static page generation 9/9) |
| GitHub required checks | PASS (no formal branch protection) | Repo has no branch-protection rule (private repo, free plan — `gh api .../branches/main/protection` → 403 "Upgrade to GitHub Pro"). CI workflow "CI" ran 3 jobs at head SHA, all `success`: `lint-typecheck-test`, `e2e-critical`, `e2e-critical` includes `prisma migrate deploy` + Playwright critical journeys, `ux-audit`. Vercel Preview deployment status also `success` ("Deployment has completed"). |
| Mergeability | PASS | `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN` |

## 5. Merge Evidence

**Merge was not performed.**

- Attempted command: `gh pr merge 7 --merge --subject "Merge pull request #7 from crh/fix/preview-neon-database-binding"`
- Result: denied by the Claude Code auto-mode permission classifier — `Permission for this action was denied ... Reason: [Merge Without Review]`
- No alternate/raw method (direct push to `main`, REST/GraphQL merge call, disabling hooks) was attempted, per this task's explicit instruction not to route around a safety control and not to broaden scope.
- PR #7 remains `OPEN`, head SHA unchanged (`5b68d99`).

## 6. Production Deployment Evidence

Not applicable — no merge occurred, so no new production deployment was
triggered by this session.

**Pre-merge production baseline (for reference / future provenance check):**
- Current production deployment: `dpl_678ZRYXPmbt2S62MzUFwLRpC1HUz`
- Environment: Production, status: Ready
- Aliases: `dibayar.vercel.app`, `dibayar-kenji-iwakura.vercel.app`, `dibayar-git-main-kenji-iwakura.vercel.app`
- Created: 2026-09-15T16:27:46+07:00
- Corresponds to `origin/main` HEAD at start of this session: `282dcdeb5fd1f7d6ccce03b9710a3a83b157f3a8` ("Merge pull request #6 ...", committed 2026-09-15T16:27:42+07:00 — timestamps match, confirming provenance)

Once PR #7 is merged, the next production deployment's source SHA should be
the new merge commit on `main` (a child of `282dcde` and `5b68d99`) — verify
that specifically, not just that "a" Production deployment is Ready.

## 7. Production Runtime Verification

Not performed — no new deployment exists yet to verify. Production at the
pre-merge baseline (`282dcde`) was not touched, tested, or altered by this
session.

## 8. Regression Check

Confirmed directly from source at the current PR head (§3): Preview still
requires `DATABASE_URL_POSTGRES_URL` at runtime, still requires
`DATABASE_URL_POSTGRES_URL_NON_POOLING` for migration/build, and does not
fall back to static `DATABASE_URL` in either path. No commits were added
after the previously verified SHA, so no new regression surface exists
versus the prior receipt.

## 9. Residual Risks / Follow-ups

Carried over, not actioned (out of scope for this session):
1. Orphaned branch-scoped Preview secrets from earlier Neon branch cleanup.
2. Each Preview branch may need its own Google OAuth callback URI.
3. `vercel.json`'s inline `buildCommand` length limit — mitigated by this PR
   (logic moved to `scripts/vercel-build.sh`), but worth remembering if the
   script grows.

New from this session:
4. This development machine is under heavy, unrelated multi-agent memory
   pressure (multiple Hermes gateway processes, two Chrome instances) that
   prevented a full local `npm test` run from completing without being
   killed by the memory guard, on two separate attempts with different
   parallelism settings. CI is unaffected (isolated runner, clean pass).
   Local full-suite runs on this machine may need to be scheduled when other
   agent processes are quieter, or run with a stricter memory cap and
   `--no-file-parallelism` plus fewer concurrent forks if this recurs.

## 10. Final Decision

```text
NOT_READY_TO_MERGE
```

Clarification: this is **not** a failed-gate outcome. Every independently
verifiable gate (diff/contract inspection, CI at head SHA, local
lint/typecheck/build, PR-scoped test) passed. The blocker is procedural: the
merge action itself was denied by the Claude Code auto-mode classifier
(`Merge Without Review`), which requires either (a) Chris merging PR #7
manually (GitHub UI or `gh pr merge 7 --merge` from an interactive/approved
session), or (b) an explicit Bash permission rule added to allow this
session to run `gh pr merge`. Phases D through F (merge, production
deployment verification, production smoke test) were not attempted.

**Single action required to unblock:** merge PR #7
(`https://github.com/crh/dibayar/pull/7`, head `5b68d99`) — either
manually, or by granting this session merge permission and re-running.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZtnVoEbfsb9bTCtYrvz3r
