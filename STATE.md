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
last_deploy: 2026-07-16 Git-triggered protected M2 Preview for commit b8fe0ae; Ready in 34 seconds on the stable M2 branch alias
build_status: green
latest_validation: 2026-07-16 isolated M2 Preview: Google OAuth, authenticated invoice create/list/detail, missing-invoice 404, and cleanup all passed
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M2 — Invoice (isolated Preview migrations/read APIs and invoice creation are verified; mobile UI, PDF/share link, and status transitions remain)
active_branch: hermes/m2-invoice
latest_feature_commit: b8fe0ae — scope deal ownership lookup in query; follows 9f8c00b tenant-scoped invoice reads and 8faadca Prisma transaction fix
remote_feature_branch: origin/hermes/m2-invoice is current through b8fe0ae
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview

today_tasks_max_3:
  - Implement M2 mobile invoice list/detail UI from the verified read APIs
  - Implement M2 share-link/PDF and invoice status transitions
  - Keep Production protected and all phase transitions approval-gated
open_blockers: none; M2 mobile UI, PDF/share-link, and status-transition work remains

## recent_signal_findings
- No external signal check recorded; this run was limited to M2 implementation and local verification.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-16: Chris granted standing autonomous milestone execution; task selection should not require prompts. Ask only for a genuine access/decision blocker; Production, public access, credentials, destructive changes, financial/legal/medical decisions remain separately gated.
- 2026-07-16: Commit 9f8c00b adds tenant-scoped invoice list/detail reads; b8fe0ae hardens existing deal reads to scope `id` and `userId` in the database query. Both are live-smoke-passed on isolated protected Preview; Production untouched.
- 2026-07-16: Commit 8faadca binds methods returned by the lazy Prisma Proxy to the actual client, fixing invoice `$transaction`; creation smoke passed on isolated protected Preview.

## approvals
pending_from_chris: Production public-access decision
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval; local staging/commit review, authenticated M0 production smoke confirmation, instruction to continue interrupted M1 work, M1 documentation push, and M2 start

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; Google Cloud OAuth client managed through logged-in Chrome MCP session
preview: M1 Ready at https://dibayar-15tw2d2jd-kenji-iwakura.vercel.app; M2 Ready from b8fe0ae at https://dibayar-8m9gkr5mq-kenji-iwakura.vercel.app with stable alias https://dibayar-git-hermes-m2-invoice-kenji-iwakura.vercel.app; Vercel Authentication protected; M2 uses its isolated Neon branch, has both approved migrations, and Google OAuth persists User/Account successfully
production: URL reachable; Vercel Authentication protected; no M1/M2 deployment claimed
smoke: protected M2 Preview Google OAuth signed in as Kenji. After 8faadca, authenticated POST /api/deals and POST /api/invoices returned 201. After b8fe0ae, authenticated GET /api/invoices returned 200 including the created invoice, GET /api/invoices/:id returned 200 for it, and a missing invoice returned 404 in Bahasa. Labeled temporary data was removed; final temporary-deal/invoice/sequence counts were 0/0/0.

## next_3_tasks
1. Implement the M2 mobile invoice list/detail UI using the verified read APIs.
2. Implement M2 share-link/PDF and status transitions with appropriate tenant/public authorization boundaries.
3. Keep Production protected; request a separate decision before public access or production deployment.
