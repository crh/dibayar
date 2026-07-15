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
latest_validation: 2026-07-15 M1 accepted; 30 tests; lint; typecheck; production build; protected Preview OAuth sign-in and authenticated create/read/update/delete smoke verified; smoke record deleted; npm audit has 6 moderate findings
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M1 — Auth + Deal Pipeline accepted; M2 invoice foundation is committed on hermes/m2-invoice and paused pending Chris instruction
active_branch: hermes/day-001-m0-bootstrap
latest_feature_commit: a8c0347 — fix(auth): allow Google OAuth sign-in flow (M1 implementation); d7562dd local documentation evidence update
remote_feature_branch: origin/hermes/day-001-m0-bootstrap at a8c0347; protected Preview M1 smoke verified
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview

today_tasks_max_3:
  - Review M2 invoice foundation on hermes/m2-invoice before API/UI work; keep the migration unapplied
  - Decide whether to push the local M1 documentation evidence commit; do not deploy Production or make it public without Chris approval
  - Keep M4 validation and all phase transitions approval-gated
open_blockers: Optional cleanup of unused prefixed Neon variables; M2 API/UI integration and migration approval; Production public access and phase transition remain approval-gated

## recent_signal_findings
- No external signal check recorded; this run was limited to M1 implementation and local verification.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-15: M1 accepted after protected Preview Google OAuth plus authenticated deal create/read/update/delete smoke; added only the stable protected Preview callback URI to the Google OAuth client.
- 2026-07-15: Pause M2 until M1 acceptance; M2 remains isolated on hermes/m2-invoice with its migration unapplied.
- 2026-07-14: Enforce auth rate limiting in the Auth.js route handler; module-level middleware state was not reliable in Next.js dev runtime.

## approvals
pending_from_chris: whether to push the local M1 documentation evidence commit, resume M2, and whether Production should become public
pending_external: M1 acceptance complete; M2 migration remains unapplied pending API/UI integration and Chris approval

granted_by_chris: local staging/commit review, authenticated M0 production smoke confirmation, and instruction to continue interrupted M1 work

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; Google Cloud OAuth client managed through logged-in Chrome MCP session
preview: Ready at https://dibayar-15tw2d2jd-kenji-iwakura.vercel.app with stable alias https://dibayar-git-hermes-day-001-m0-bootstrap-kenji-iwakura.vercel.app; Vercel Authentication protected; M1 migration applied; Google OAuth callback URI registered and login verified
production: URL reachable; Vercel Authentication protected; no M1 deployment claimed
smoke: protected Preview Google OAuth signed in as the existing test user; UI created a labeled disposable deal; authenticated API list/read/patch/read/delete returned 200/200/200/200/204 and final GET returned 404; cache-bypassing dashboard reload showed zero deals

## next_3_tasks
1. On Chris approval, switch to hermes/m2-invoice and review the committed invoice foundation before API/UI work.
2. Keep the M2 migration unapplied until invoice API integration is reviewed and approved.
3. Decide separately whether to push M1 documentation evidence and whether to change protected Production access.
