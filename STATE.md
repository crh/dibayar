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
day_count: 1
repo_url: git@github.com:crh/dibayar.git
prod_url: https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/
last_deploy: 2026-07-13 (Chris-provided production URL; protected-access response verified)
build_status: green
latest_validation: 2026-07-13 local gates green; 6/6 tests; HTTP/security-header smoke; 390px accessibility snapshot; npm audit has 5 moderate findings
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M0 — repo bootstrap (local implementation complete; deployment criteria incomplete)
active_branch: hermes/day-001-m0-bootstrap
latest_feature_commit: 12e8145 feat(m0): bootstrap Dibayar foundation
remote_feature_branch: origin/hermes/day-001-m0-bootstrap at 854a702; local contains additional unpushed governance commits
completed_milestones:
  - Phase 0 discovery closed
  - M0 local scaffold and validation checkpoint complete
today_tasks_max_3:
  - Finish M0 scaffold and independent review (local implementation complete)
  - Preserve validated work on the feature branch (commit 4f531d9 created)
  - Resolve the M0 deployment approval/access decision
open_blockers: Production URL is reachable but Vercel Authentication blocks unauthenticated content verification; authenticated Bahasa-page smoke and public-access decision remain

## recent_signal_findings
- No external signal check recorded; this run was limited to the M0 bootstrap and validation scope.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-13: Continue Dibayar/M0; local scaffold is validated, but do not mark M0 complete without the Roadmap deployment evidence.
- 2026-07-13: Keep the repository private and do not deploy publicly without Chris approval; no phase transition requested.
- 2026-07-12: Use exact claude-sonnet-5 through the repository wrapper; do not downgrade or claim completion without independent gates.

## approvals
pending_from_chris: deployment approval/access decision for M0; no production launch requested
granted_by_chris: local staging/commit review approval

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; dashboard independently inaccessible in current browser session
preview: none
production: URL reachable; Vercel Authentication redirect verified; app content not yet authenticated-smoke-tested; Vercel source-commit mapping unverified
smoke: local HTTP page and security headers passed; production access protection verified

## next_3_tasks
1. Open the production URL while authenticated to Vercel and verify the Bahasa page/title/content.
2. Run authenticated production smoke checks and record the deployment/branch mapping.
3. Decide whether the URL should remain protected or receive explicit public-launch approval before Phase 2.
