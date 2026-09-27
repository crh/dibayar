# Dibayar — Codify Development Workflow: Receipt (2026-09-27)

PR: https://github.com/crh/dibayar/pull/15 (`codex/document-development-workflow` -> `main`), review-ready, **not merged**.

## 1. Starting state
- Session started on `codex/m4-invoiced-this-month` (PR #14 open). Work done on a fresh branch from `origin/main` (`86eff1d`), not on PR #14's branch. Two untracked PR #14 receipts and `src/generated/` were left untouched and uncommitted.
- Open PRs at start: #14 only. `staging` did not exist on `origin`. Branch protection is unavailable (GitHub plan); `delete_branch_on_merge` is off.
- CI (`.github/workflows/e2e.yml`): `pull_request` (any base), `push` only on `main`, scheduled runs only from the default branch.

## 2. Workflow documents found
`CLAUDE.md`, `.hermes.md` (delegation only), `DEPLOYMENT.md` (490 lines, mostly dated history), `README.md`, `STATE.md`, `ROADMAP.md`, `BACKLOG.md`, `docs/testing/*`, `docs/ux-implementation/{HERMES_CONTROLLER,AGENT_ROLES}.md`. No `CONTRIBUTING.md`, no `AGENTS.md`. No document defined a branch model or staging.

## 3. Stale / contradictory guidance found
- `CLAUDE.md`: "Current status" (Phase 0/T-04 next) and "Deployment workflow" (Preview non-isolated, no release authorized) — both self-declared stale but kept.
- `DEPLOYMENT.md`: per-branch OAuth redirect list and `vercel env add ... preview hermes/day-001-m0-bootstrap`; "Next deployment step" (protected production page, separate Preview DB still to be configured); shared Preview/Production `DATABASE_URL`; `vercel.json` snippet (now `bash scripts/vercel-build.sh`); "Rollback: not yet verified" stub; Preview policy assuming branch-scoped Previews.
- Not changed (out of scope, still true as history): the dated "Current status (historical)" bullets, incident narrative, share-link gate, public-access brief, cron guard. Two annotations added so they aren't read as current.

## 4. Structure implemented
`docs/DEVELOPMENT-WORKFLOW.md` (canonical workflow) / `DEPLOYMENT.md` (mechanics, gates) / `STATE.md` (status) with explicit precedence at the top of the workflow doc and DEPLOYMENT.md. Agent files hold invariants and pointers only.

Judgement calls (change if Chris disagrees):
- `staging -> main` and `main -> staging` PRs use **merge commits only** (no squash/rebase) so the long-lived branches don't diverge; feature -> staging may squash.
- Default cap of **3 concurrent `preview/*`** environments (Neon `free_v3` limit is 10: `main` + `staging` + 3 leaves headroom).
- Legacy prefixes (`codex/`, `hermes/`, `claude/`, ...) are treated as ordinary CI-only branches by purpose.
- Merging into `staging` requires the task's/Chris's explicit merge authorization (matches current PR practice); Production merges always need Chris per PR.
- A short "Rollout status" section warns that staging infrastructure may not exist; it does not embed dated status.

## 5. Exact `CLAUDE.md` changes
- Removed the "Current status: UX implementation Phase 0..." paragraph and its stale-warning; replaced by one line pointing to `STATE.md`/`DEPLOYMENT.md`.
- Repo-structure list: added `docs/DEVELOPMENT-WORKFLOW.md`, reworded `DEPLOYMENT.md`.
- Replaced the "Deployment workflow" section (both stale paragraphs) with "Git and deployment workflow": read-first instruction, the six requested invariants (plus `staging` may not exist yet; merging to `main` deploys Production), a Chris-only line for destructive/OAuth/Vercel/Neon actions, and a no-secrets line. Nothing else touched.

## 6. Exact `.hermes.md` changes
Appended one section, "Git and deployment workflow": the requested sentence verbatim plus one sentence that Production merge/deploy, OAuth-console, and destructive Neon/Vercel actions stay with Chris. Delegation policy untouched.

## 7. `AGENTS.md`
**Not created.** No concrete evidence it's needed: the implementation worker is Claude Code (reads `CLAUDE.md`), the orchestrator is Hermes (reads `.hermes.md`), and there is no third tool. A third file would be a new drift surface. Revisit if another agent/tool is adopted.

## 8. Validation
- `git diff --check` clean; all backticked/linked file paths in changed docs resolve; no secret-like strings in the diff; no env values added.
- No repo markdown/link checker or doc-validation script exists (`npm run lint` is code-only), so none run. App suites (Vitest/Playwright/build) not run — docs-only change.
- Phase E: workflow not duplicated in full; only the environment map is intentionally echoed in DEPLOYMENT.md's table (with the extra "Implemented" column) — the one drift risk, owned by DEPLOYMENT.md for mechanics and the workflow doc for policy. Precedence stated in both.

## 9. Git / PR state
Commit `9459953` (+ this receipt) on `codex/document-development-workflow`, pushed; PR #15 open, review-ready. CI runs on the PR. Note: under *current* behavior, pushing this branch also triggers a Vercel Preview and a Neon branch (Neon was 6/10 before this push) — precisely what the new workflow removes; delete that Neon branch after merge (Chris). PR #14 also edits `DEPLOYMENT.md` in a separate hunk; expect a trivial rebase at most. Merging PR #15 auto-deploys Production (docs-only, no app change) and needs Chris's authorization.

## 10. Remaining implementation work (none done here; all need Chris unless stated)
1. Create the `staging` branch and its stable Vercel deployment/domain (custom environment vs. Preview of `staging`).
2. Provision a stable, never-pruned staging Neon branch; separate `AUTH_SECRET`/`AUTH_GOOGLE_*` for staging.
3. Register the staging OAuth callback; audit/remove old per-branch `hermes/*` redirect URIs.
4. Configure Vercel Ignored Build Step (allowlist `main`, `staging`, `preview/*`) and confirm a skipped build also skips Neon provisioning.
5. CI: decide whether to add `staging` to `push` triggers (PRs into `staging` already run CI; scheduled runs stay default-branch-only).
6. Enable GitHub "Automatically delete head branches"; prune merged remote branches and their Neon branches.
7. Verify and record the real Vercel/Neon rollback procedure in `DEPLOYMENT.md`.
8. Update `STATE.md` (Hermes-owned) to track the above; `scripts/cron-guard.mjs` still defaults to a historical branch (see current-truth audit).
