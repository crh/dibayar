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
latest_validation: 2026-07-15 M2 rebased local slice green; Prisma validate/generate; lint; typecheck; 78 tests; production build; diff check; migration unapplied; npm audit has 6 moderate findings
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M2 — Invoice (backend create/numbering/status-tax data slice complete locally; PDF/share link/UI remain)
active_branch: hermes/m2-invoice
latest_feature_commit: a412b0c — feat(m2): add atomic invoice creation API; rebased on accepted M1 baseline eeb2f42
remote_feature_branch: no M2 remote branch; local branch rebased on origin/hermes/day-001-m0-bootstrap at eeb2f42
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview

today_tasks_max_3:
  - Review the local M2 invoice API slice before any push or protected Preview deployment; keep its migration unapplied
  - Implement M2 invoice list/detail and PDF/share-link UI only after a review checkpoint
  - Keep Production protected and all phase transitions approval-gated
open_blockers: M2 PDF/share-link/UI integration and migration approval; optional cleanup of unused prefixed Neon variables; Production public access and phase transition remain approval-gated

## recent_signal_findings
- No external signal check recorded; this run was limited to M2 implementation and local verification.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-15: Chris approved pushing M1 evidence then starting M2; M2 remains local-only after rebase, with migration unapplied and no Preview/Production deployment.
- 2026-07-15: M1 accepted after protected Preview Google OAuth plus authenticated deal create/read/update/delete smoke; added only the stable protected Preview callback URI to the Google OAuth client.
- 2026-07-15: M2 invoice creation snapshots the owned deal fee, records PPh type (NONE/PPH21/PPH23) without tax calculation, and creates the numbered draft invoice in one database transaction.

## approvals
pending_from_chris: review/push M2 local commits, migration application, protected M2 Preview deployment, and whether Production should become public
pending_external: M2 migration remains unapplied; no external dependency blocks local M2 work

granted_by_chris: local staging/commit review, authenticated M0 production smoke confirmation, instruction to continue interrupted M1 work, M1 documentation push, and M2 start

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; Google Cloud OAuth client managed through logged-in Chrome MCP session
preview: Ready at https://dibayar-15tw2d2jd-kenji-iwakura.vercel.app with stable alias https://dibayar-git-hermes-day-001-m0-bootstrap-kenji-iwakura.vercel.app; Vercel Authentication protected; M1 migration applied; Google OAuth callback URI registered and login verified; no M2 deployment claimed
production: URL reachable; Vercel Authentication protected; no M1/M2 deployment claimed
smoke: protected Preview Google OAuth signed in as the existing test user; UI created a labeled disposable deal; authenticated API list/read/patch/read/delete returned 200/200/200/200/204 and final GET returned 404; cache-bypassing dashboard reload showed zero deals

## next_3_tasks
1. Review the local M2 API slice and decide whether to push it for a protected Preview deployment; do not apply the migration yet.
2. Implement M2 invoice listing/detail plus PDF/share-link UI with unguessable identifier, expiry/revocation, and noindex controls.
3. Add M2 status transition handling and later decide whether to apply the reviewed migration.
