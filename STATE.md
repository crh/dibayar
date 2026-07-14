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
latest_validation: 2026-07-14 local M1 gates green; 21 tests; lint; typecheck; production build; local HTTP auth/deals/rate-limit smoke; npm audit has 6 moderate findings
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M1 — Auth + Deal Pipeline (local implementation ready; protected Preview verification pending)
active_branch: hermes/day-001-m0-bootstrap
latest_feature_commit: local HEAD — feat(m1): add auth and deal pipeline vertical slice
remote_feature_branch: origin/hermes/day-001-m0-bootstrap at 854a702; local contains additional unpushed governance and M1 commits
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 local vertical slice implementation and quality gates complete

today_tasks_max_3:
  - Configure protected Preview environment: DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
  - Apply checked-in Prisma migration to Preview database and run authenticated CRUD smoke
  - Keep production protected; defer public launch and phase transition decisions to Chris
open_blockers: real Preview OAuth/Postgres environment and Vercel source/deployment verification; production public access remains approval-gated

## recent_signal_findings
- No external signal check recorded; this run was limited to M1 implementation and local verification.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-14: Continue M1 after laptop interruption; keep Vercel project/linkage assumptions unchanged and skip already-completed project setup.
- 2026-07-14: Enforce auth rate limiting in the Auth.js route handler; module-level middleware state was not reliable in Next.js dev runtime.
- 2026-07-13: Keep Vercel Authentication protection enabled; public launch and phase transition remain approval-gated.

## approvals
pending_from_chris: protected Preview environment/application and whether production URL should become public
pending_external: Google OAuth credentials, Postgres database, and Vercel environment configuration

granted_by_chris: local staging/commit review, authenticated M0 production smoke confirmation, and instruction to continue interrupted M1 work

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; dashboard independently inaccessible in current browser session
preview: not deployed for M1; protected Preview is the next verification target
production: URL reachable; Vercel Authentication protected; no M1 deployment claimed
smoke: local root/auth/deals/rate-limit endpoints verified; protected production M0 smoke confirmed by Chris; Vercel source-commit mapping unverified

## next_3_tasks
1. Configure Vercel Preview environment and a non-production Postgres database; add Google OAuth redirect URI.
2. Apply the checked-in Prisma migration to Preview; run Google sign-in, session, deal CRUD, tenant-isolation, and 390px smoke checks.
3. Review M1 diff and decide separately whether to deploy to protected production or keep Preview-only; do not make the URL public without approval.
