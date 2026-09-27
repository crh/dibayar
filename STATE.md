# STATE.md — Single Source of Truth

<!-- RULES FOR THIS FILE (Hermes: obey strictly)
1. Read this file FIRST every run. It replaces re-reading the full doc set.
2. Update it at the END of every run.
3. HARD CAP: 120 lines. Overflow gets archived to DAILY_LOG.md, never kept here.
4. decisions_log keeps ONLY the last 3 days. Older entries move to DAILY_LOG.md.
5. Format is key:value / short bullets. No prose paragraphs. No marketing language.
-->

## meta
product_name: Dibayar (working name — rename requires Chris approval)
one_liner: Brand-deal CRM + invoice + payment tracker for Indonesian creators (WhatsApp-first)
phase: 1-build            # 0-discovery | 1-build | 2-validate  (transition = Chris approval)
phase_started: 2026-07-12
day_count: 12
repo_url: git@github.com:crh/dibayar.git
prod_url: https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/
last_deploy: 2026-09-19 — repository receipts report Production deployment from merged commit `f55b320`; not independently inspected since (no deployment action has occurred in any session covered by this file).
build_status: PR #15 (canonical Git/deployment workflow docs) merged 2026-09-27 (`423592e`), then PR #14 (M4 monthly-summary wording + Preview-limit remediation, reconciled onto post-PR#15 `main`) merged 2026-09-27, both by `crh` (Chris) directly on GitHub — merge commit `4d92f87`, `main`'s current HEAD. Post-merge CI green on every job (run `36304427958`). Full detail: `docs/receipts/DIBAYAR-PR14-FINAL-RECEIPT-2026-09-27.md`, `DAILY_LOG.md` "2026-09-27" entries.
latest_validation: 2026-09-27 — post-merge CI on `main` (`36304427958`) green across `lint-typecheck-test`/`e2e-a11y`/`e2e-critical`/`ux-audit` (`e2e-cross-browser` skipped on push, by design).
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: PR #15 (canonical Git/deployment workflow docs) and PR #14 (M4 wording + Preview remediation) are both merged to `main`. **Staging bootstrap in progress** (this session, `bootstrap/staging-workflow`): implementing `docs/DEVELOPMENT-WORKFLOW.md`'s pre-staging transition — see "pre_staging_transition" checklist below. Ordinary feature/fix/chore work stays blocked from `main` until that transition completes. M4 creator validation and launch/access decisions remain open and unaffected by this bootstrap.
active_branch: `bootstrap/staging-workflow` (from `main` @ `4d92f87`) — the one-time pre-staging exception PR named in `docs/DEVELOPMENT-WORKFLOW.md`. Recovered this session from a prior session that hung in the tool-execution layer (~2h, stuck on `echo hi`); nothing was reset/discarded, all prior repo-side work was verified accurate before continuing (`docs/receipts/DIBAYAR-STAGING-BOOTSTRAP-2026-09-27.md` §1-2). Repo-side changes: `vercel.json`/`scripts/vercel-ignore-build.sh` (CI-only-branch deploy filtering, unit-tested), `.github/workflows/e2e.yml` (`staging` added to push triggers), `scripts/cron-guard.mjs` (stale `hermes/m2-invoice` default branch fixed to `main`), one stale `origin/hermes/m2-invoice` doc reference in `DEPLOYMENT.md` fixed this session, this file, the receipt above. All local gates re-run clean this session (lint 0/0, typecheck clean, 771/771 tests, build pass). Pushed and opened as a PR into `main` this session — see receipt §9 for the PR. Not yet done in-branch: creating the `staging` branch itself (deferred until after this PR merges to `main`, per `docs/DEVELOPMENT-WORKFLOW.md` Phase F sequencing) and every Vercel/Neon/Google-console action (Chris-only; see receipt action packet).
latest_feature_commit: `4d92f87` on `main` (PR #14 merge).
open_blockers: Full plan at `docs/PROJECT-PLAN-2026-09-22.md`. **P2-2's scheduled-run acceptance**: `36109870314` (2026-09-25) is 1 of 2 fresh qualifying `e2e-cross-browser` scheduled runs needed (streak reset by a 2026-09-24 failure); next expected weekday run untouched, no schedule modification, no manual trigger counted toward it. Other product blockers unchanged: M4 creator validation, confirmation of Production edge/public-access intent, and decisions on the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis. New: the pre-staging transition itself blocks ordinary feature/fix/chore work (see checklist below) until all six conditions are verified.

## pre_staging_transition (docs/DEVELOPMENT-WORKFLOW.md "Pre-staging transition")
- [x] repo-side deploy-filtering config added (`vercel.json` `ignoreCommand` allowlist: main/staging/preview/*) — NOT YET LIVE-VERIFIED (needs a real branch push once the bootstrap PR lands)
- [ ] `staging` branch exists
- [ ] stable Vercel staging environment/domain verified
- [ ] stable Neon staging branch verified
- [ ] staging Google OAuth redirect configured and working
- [ ] ordinary feature/fix/chore auto-deploy suppression verified live
- [ ] staging CI path verified (push trigger added to `.github/workflows/e2e.yml`; unexercised until `staging` exists)
Do not mark "PRE-STAGING TRANSITION COMPLETE" until every unchecked item above has direct evidence. External actions (Vercel/Neon/Google Console/GitHub repo settings) are Chris's — see the bootstrap PR body and `docs/receipts/DIBAYAR-STAGING-BOOTSTRAP-2026-09-27.md` for the exact action packet.
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview
  - M2 invoice (generation, share-link, status tracking) accepted on protected Preview 2026-07-18 — Production/public-access separately gated, not yet decided
  - UX implementation Phase 0 (T-00–T-03) and Phase 1 (T-04–T-07, shell/blocking findings) accepted and closed by Chris; see `docs/ux-implementation/evidence/phase-0/GATE.md` and `phase-1/GATE.md`
  - UX implementation Phase 2 (T-08–T-12, IA split) implemented, committed, and independently verified 2026-08-09; external gate criteria (Preview/Production isolation, Chris acknowledgement) satisfied 2026-08-17; merge/Phase 3 separately not authorized at that point — see `docs/ux-implementation/evidence/phase-2/GATE.md`
  - UX implementation Phase 3 (T-13–T-18: deal board/detail polish) implemented, tested, committed, pushed, and live-verified on Vercel Preview with real Google OAuth 2026-08-21–23; a genuine Preview P2022 infra bug (stale `DATABASE_URL` pointing at an abandoned Neon branch) was found and fixed via runtime instrumentation, not guesswork — see `DAILY_LOG.md` "Phase 3" entry
  - UX implementation Phase 4 (T-19–T-21: invoice detail reorder, DateField, configurable WhatsApp templates) implemented, tested, committed, pushed, and live-verified on Preview 2026-08-24; a genuine broken-link bug (invoice list/home queue pointing at a dead `/invoice/:id` placeholder while the real page sat at the compatibility route) was found and fixed as part of T-19 — see `DAILY_LOG.md` "Phase 4" entry
  - UX implementation Phase 5 (T-22–T-24: canonical `InvoiceDocument`, public route rewrite, PDF parity) implemented, tested, pushed, and present in current `main`; Preview verification recorded 2026-08-25 — see `DAILY_LOG.md` "Phase 5" entry
  - UX implementation Phase 6/T-27 (T-25 landing, T-26 XS-band pass, T-27 verification work) implemented and present in current `main`; historical Preview verification is recorded in `DAILY_LOG.md` "Phase 6" entry

today_work (Focus measures approved scope, not task volume, from 2026-07-19):
  - Closed the recurring `next/font/google` CI build-time flake that failed PR #11's post-merge `e2e-a11y` job: moved both Google Fonts imports (Plus Jakarta Sans, Source Serif 4) to self-hosted `next/font/local`, opened PR #12. See decisions log for full detail.

open_blockers_continued: none beyond the ones listed above.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-09-25: Fixed PR #12's two remaining gaps and regenerated all 9 `@visual` baselines via the real-CI-runner-only workflow. Merged PR #12 (`d90356b`) on Chris's explicit "merge if green" instruction. A 2026-09-24 scheduled run had failed `e2e-cross-browser` against the pre-fix commit — resets P2-2's streak to 0 of 2. Full detail: `DAILY_LOG.md` "2026-09-25" entry.
- 2026-09-26: PR #13 (M4 readiness, income-basis pinning) merged on Chris's explicit authorization (`86eff1d`). PR #14 opened (monthly-summary relabel); its Preview then failed `BUILD_FAILED`/"Resource provisioning failed" — diagnosed read-only as the Neon `branches_limit` 10 cap (HIGH_CONFIDENCE, not yet confirmed). Receipts: `DIBAYAR-M4-READINESS-2026-09-26.md`, `DIBAYAR-M4-INVOICED-THIS-MONTH-2026-09-26.md`, `DIBAYAR-PR14-PREVIEW-AND-MONTHLY-SUMMARY-REMEDIATION-2026-09-26.md`.
- 2026-09-27: Chris freed a Neon branch and redeployed — PR #14's Preview reached READY, confirming the Neon-cap cause; Chris then pruned Neon to 6/10. Chris merged PR #15 (`423592e`, canonical Git/deployment workflow docs) directly on GitHub; PR #14 was reconciled onto the new `main` (merge commit `64b77b1`) and its own docs reworded for the new policy text (commit `12ba2fc`). Chris then merged PR #14 (`4d92f87`) directly on GitHub — post-merge CI green (`36304427958`). Receipt: `docs/receipts/DIBAYAR-PR14-FINAL-RECEIPT-2026-09-27.md`.
- 2026-09-27 (earlier this session): Started the staging-bootstrap task on `bootstrap/staging-workflow` from `main` @ `4d92f87`. Verified PR #14/#15 both merged (superseding the task prompt's assumed in-flight state) before doing anything else. Read-only audit: Neon `neon-dijual` at 7/10 branches; Vercel Neon-integration env vars are project-wide for Preview, not per-branch; `src/auth.ts` needs no `AUTH_URL` (`trustHost: true`, default Google callback path); GitHub "delete branch on merge" still off. Repo changes: `vercel.json`/`scripts/vercel-ignore-build.sh` (deploy-filtering allowlist, tested), `.github/workflows/e2e.yml` (`staging` push trigger), `scripts/cron-guard.mjs` stale-branch-default fix (`hermes/m2-invoice` → `main`), this file's `pre_staging_transition` checklist. `staging` branch and all Vercel/Neon/Google-console/GitHub-settings actions deliberately deferred. This session then hung in the tool-execution layer before writing its own receipt.
- 2026-09-27 (recovery, fresh session): Recovered the above from a hung session with no reset/discard; independently re-verified every claim against live `git`/`gh`/`neon` state (all accurate). Fixed one leftover doc bug: `DEPLOYMENT.md`'s cron-guard description still said `origin/hermes/m2-invoice` one line below where the branch-default line had already been corrected to `main`. Wrote the missing `docs/receipts/DIBAYAR-STAGING-BOOTSTRAP-2026-09-27.md` (both `STATE.md` and `DEPLOYMENT.md` referenced it before it existed). Re-ran lint/typecheck/test/build from scratch rather than trust the hung session's tail-end report — all green, tool layer behaved normally throughout (771/771 tests, clean build). Pushed the branch and opened the bootstrap PR into `main`, review-ready, not merged. No staging/Vercel/Neon/OAuth/GitHub-settings action taken — all remain Chris's, per the receipt's action packet.
- Older entries (through 2026-09-24) already live in full in `DAILY_LOG.md` per the 3-day retention rule; nothing was dropped, only relocated out of this file.

## approvals
pending_from_chris: [2026-09-27, new] PR #16 (`bootstrap/staging-workflow` -> `main`) open, review-ready. Staging bootstrap action packet (Vercel Ignored-Build-Step/domain verification, Neon `staging` branch creation, Google OAuth staging redirect URI, GitHub "delete merged branches" setting) — see PR #16 body / `docs/receipts/DIBAYAR-STAGING-BOOTSTRAP-2026-09-27.md`. Do not merge PR #16 without Chris's explicit authorization (every `main` merge needs it during the pre-staging transition). [2026-09-20, still open] Confirm whether Production's no-Vercel-SSO edge reachability is intentional; decide recipient public-access policy; complete M4 validation/go-no-go; confirm or revise the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis; decide the moderated-Preview-vs-policy question (`M4-READINESS.md` §3.1).
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval (Phases 4–6, unchanged). PR #13/#14/#15 all merged on Chris's explicit authorization or direct action. PR #16 (`bootstrap/staging-workflow`) is open, review-ready, not for auto-merge.

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; Vercel deploys from the GitHub-linked repository. The exact current Preview deployment for `main` was not inspected in this audit.
preview: historical Preview deployment for `331e986` was READY and live-verified 2026-08-25; current Preview state not independently inspected in this audit
production: repository receipts report current Production deployment from merged `main` commit `f55b320`; live state was not independently inspected in this audit.
production_2026-09-06: PR #2 merged to `main` (`b6119d2`) auto-deployed Production via Vercel's GitHub integration; a real incident followed (Production had no `AUTH_SECRET`/Google OAuth vars and zero applied Prisma migrations — pre-existing gaps, not caused by the merge). Both were fixed at the user's explicit direction: auth vars added, then all 12 migrations applied via a Vercel Build Command override (`npx prisma migrate deploy && next build`, still active). A real user completed live Google sign-in; independently reconfirmed 2026-09-06 via unauthenticated `curl` (`/` -> 307 to `/api/auth/signin`) and `node scripts/smoke-deployment.mjs --env production --url https://dibayar.vercel.app` (PASS). Full detail: `docs/receipts/DIBAYAR-V6-1-PRODUCTION-HARDENING-HANDOFF.md`, `DEPLOYMENT.md` "Current verified state". Open finding: Production is reachable at the Vercel edge without an SSO gate — not confirmed as an intentional public-launch decision; do not mark PRODUCTION_READY (see `DEPLOYMENT.md` "Production release gate") until Chris confirms.
smoke: real browser automation against the live Preview deployment — see latest_validation for the exact Phase 6 checks; Phase 5 (2026-08-25), Phase 4 (2026-08-24), and Phase 3 (2026-08-23) UAT passed the same way

## next_3_tasks
1. Get PR #16 (`bootstrap/staging-workflow` -> `main`) reviewed and, on Chris's explicit authorization, merged; then create `staging` from that known-good commit (never from an open feature branch) and work through the Vercel/Neon/OAuth/GitHub items in the action packet.
2. Watch for one more qualifying scheduled `e2e-cross-browser` run to close P2-2's acceptance — `36109870314` (2026-09-25) is 1 of 2 needed.
3. Once all six pre-staging conditions are verified and marked complete, resume ordinary feature/fix/chore work targeting `staging`. Until then: confirm Production edge/public-access intent and resume M4 creator validation (unchanged largest open item, non-code, needs Chris).
