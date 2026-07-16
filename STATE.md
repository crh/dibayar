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
last_deploy: 2026-07-16 Git-triggered protected M2 Preview for feature commit 9794d02; Ready with the stable M2 branch alias
build_status: green
latest_validation: 2026-07-16 M2 owner hardening: 105 tests/lint/typecheck/build passed; protected Preview Ready; no public invoice route added
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M2 — Invoice (owner list/detail/status/PDF hardened and protected-Preview deployed; recipient public share link remains approval-gated)
active_branch: hermes/m2-invoice
latest_feature_commit: 9794d02 — owner-only GET error handling and tenant-scoped create/status hardening; follows 2cc00c7 owner PDF
remote_feature_branch: origin/hermes/m2-invoice includes 9794d02
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview

today_tasks_max_3:
  - Owner-only invoice hardening completed and deployed to protected Preview
  - Keep recipient invoice routes unimplemented until explicit public-access approval
  - Keep Production protected and all phase transitions approval-gated
open_blockers: recipient-facing share links require a public-access decision; protected Preview prevents external recipients from opening a shared URL

## recent_signal_findings
- No external signal check recorded; this run was limited to M2 implementation and local verification.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-16: Owner invoice hardening keeps all routes authenticated, adds controlled non-leaking 500 responses to list/detail/PDF GETs, and scopes source-deal creation plus status writes by user ID. No public invoice route was added.
- 2026-07-16: Chris granted standing autonomous milestone execution; task selection should not require prompts. Ask only for a genuine access/decision blocker; Production, public access, credentials, destructive changes, financial/legal/medical decisions remain separately gated.
- 2026-07-16: Commits 3f897c9 and 2cc00c7 add owner-scoped mobile invoice list/detail/status transitions and PDF download. Protected Preview smokes passed; no recipient-public route was exposed.
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
preview: M1 Ready at https://dibayar-15tw2d2jd-kenji-iwakura.vercel.app; M2 owner hardening feature commit 9794d02 Ready at https://dibayar-prkn63wl4-kenji-iwakura.vercel.app with stable alias https://dibayar-git-hermes-m2-invoice-kenji-iwakura.vercel.app; Vercel Authentication protected; M2 uses its isolated Neon branch and approved migrations
production: URL reachable; Vercel Authentication protected; no M1/M2 deployment claimed
smoke: protected M2 Preview Google OAuth signed in as Kenji. Authenticated deal/invoice creation returned 201; list/detail returned 200; missing invoice returned 404; DRAFT→SENT returned 200 and rendered correctly in the mobile detail UI. Owner PDF returned 200 application/pdf, attachment filename, %PDF- signature, and 2,769 bytes. Labeled temporary data was removed; final temporary-deal/invoice/sequence counts were 0/0/0.

## next_3_tasks
1. Obtain a public-access decision before building recipient-facing invoice links.
2. After approval, implement share-token/link creation and external-recipient smoke tests.
3. Keep Production protected; request a separate decision before production deployment.
