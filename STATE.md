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
day_count: 8
repo_url: git@github.com:crh/dibayar.git
prod_url: https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/
last_deploy: 2026-07-19 — remote `hermes/m2-invoice` is synchronized at `58eed07`; latest protected Preview `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` is READY at https://dibayar-mhk536jix-kenji-iwakura.vercel.app with stable alias https://dibayar-git-hermes-m2-invoice-kenji-iwakura.vercel.app. Prior commit `5064e70` was the last pre-expiry deployment; expiry-aware code is now pushed and the latest Preview deployment is Ready. Production untouched; no public/non-SSO access enabled.
build_status: green
latest_validation: Local verification after `53032e3`: full Vitest suite 27 files / 247 tests passed; lint, typecheck, Prisma validate/generate, and production build passed. `5064e70` hardens the owner-auth invoice-share route and dashboard client (4 files: route + client, both with tests). A later report of a "share panel stuck loading" bug was investigated and found NOT reproducible: the source already transitions a valid `{ active: false }` response to the create-link UI state. A user-supplied browser screenshot taken after the `5064e70` deploy, inspected by Hermes, visibly shows the correct active-share state with the Bahasa text "Tautan berbagi aktif." No fresh automated test-count is claimed for `5064e70` beyond deployment-READY status and this screenshot; the deployment READY state and the isolated-Preview migration/E2E evidence for `85a4f6a` below are the load-bearing evidence for M2 acceptance.
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M2 — Invoice — ACCEPTED 2026-07-18. Both ROADMAP.md M2 items now `[x]`. Basis: `85a4f6a` (share-link + dashboard stage controls) and `5064e70` (mutation hardening) committed, pushed, HEAD == origin; isolated Preview migration `20260717090000_invoice_share` applied; protected Preview deployed READY; full authenticated Chrome E2E passed (see decisions below). Production deployment and public/non-SSO recipient access are explicit, separate, still-pending Chris decisions — NOT part of this acceptance. Next milestone: M3 (payment chasing) — not started, awaiting Chris go-ahead.
active_branch: hermes/m2-invoice
latest_feature_commit: 53032e3 feat(m2): expire invoice share links — pushed in remote `58eed07`; migration `20260719075600_invoice_share_expiry` applied 2026-07-19 to isolated Preview (`preview/hermes/m2-invoice`, database `neondb`) via Neon SQL Editor; latest protected Preview deployment is Ready
remote_feature_branch: origin/hermes/m2-invoice @ 58eed07; local branch matches remote; no unpushed feature work
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview
  - M2 invoice (generation, share-link, status tracking) accepted on protected Preview 2026-07-18 — Production/public-access separately gated, not yet decided

today_work (Focus measures approved scope, not task volume, from 2026-07-19):
  - Governance catch-up Task 1: apply the Chris-approved Focus amendment and consistency sweep — done
  - Governance catch-up Task 2: share-link expiry implemented/tested and pushed (`53032e3` included in remote `58eed07`) — done (code)
  - Governance catch-up Tasks 3–4: public-access decision brief (DEPLOYMENT.md) and distributed-rate-limit trigger note (SECURITY.md) — done, docs-only closeout
  - Governance catch-up Task 5: migration `20260719075600_invoice_share_expiry` applied to isolated Preview (`preview/hermes/m2-invoice`, database `neondb`) via Neon SQL Editor, verified by pre/postflight checks and the `_prisma_migrations` checksum; expiry code pushed and protected Preview redeployed READY — done

open_blockers: none for M2 (accepted). Separate, still-pending, Chris-gated decisions: (1) Production deployment, (2) public/non-SSO recipient access for share links — decision brief now in DEPLOYMENT.md, decision itself not made. The 2026-07-19 amended-rubric entry establishes a no-zero day; unattended cron still requires a fresh post-commit guard check before go/no-go.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-19: Migration `20260719075600_invoice_share_expiry` applied to the isolated Preview database (`preview/hermes/m2-invoice`, database `neondb`) via the Neon SQL Editor, visibly scoped to that branch/database. Preflight `expires_at_exists=false`, `migration_finished=false`; exact checked-in migration SQL ran successfully in one transaction; postflight confirmed `InvoiceShare.expiresAt` is `timestamp without time zone`, nullable, and `_prisma_migrations` shows `20260719075600_invoice_share_expiry` `finished=true`, checksum `05fbf7a79269cf4420dfea84d2114bd69ff3137215f998dee077e75275f4df2e`. This supersedes the "generated only, NOT applied" wording in the Tasks 2–4 entry immediately below — that entry remains as the historical record of that point in time. Expiry code is pushed in `58eed07`; latest protected Preview `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` is Ready. Production untouched; no public/non-SSO access enabled; neither pending Chris decision made or implied made.
- 2026-07-19: Governance closeout Tasks 2–4 (Chris-requested 2026-07-18). Task 2 (share-link expiry) was already committed locally at `53032e3` before this closeout: `InvoiceShare.expiresAt` (nullable), 90-day provisional default on create/regenerate, uniform-404 for expired tokens alongside unknown/revoked. Migration `20260719075600_invoice_share_expiry` generated only — explicitly NOT applied to any database, per this task's constraint. Tasks 3–4 are docs-only: DEPLOYMENT.md gained a decision-ready public/non-SSO access brief (routes, accurate Vercel Deployment-Protection-Exceptions/OPTIONS-Allowlist/Bypass-for-Automation mechanics with citations, edge-exposure scope, residual risk, post-enable curl verification, rollback) with no Vercel setting touched; SECURITY.md gained a distributed-rate-limit trigger note naming the in-memory/per-instance limiters and the two conditions (public/non-SSO access enabled, or multi-instance sustained traffic) that require moving to a shared store. Neither pending Chris decision (Production deployment, public/non-SSO access) was made or implied made by this entry.
- 2026-07-19: Applied Chris's 2026-07-17 Focus amendment. Focus now measures whether work stayed planned or explicitly requested; task volume is not scored. Historical DAILY_LOG scores remain unchanged. Thresholds, Gate E, and cron-guard code are unchanged. Today's Task 1 entry scores no dimension 0; unattended cron awaits a fresh guard check after commit.
- 2026-07-18: M2 explicitly accepted; both ROADMAP.md M2 items marked `[x]`. Basis: `85a4f6a` (share-link + stage controls) and `5064e70` (mutation hardening) both committed and pushed; `origin/hermes/m2-invoice` HEAD == local HEAD == `5064e70`. Isolated Preview migration `20260717090000_invoice_share` applied. Protected Preview `dpl_JBQfD2wYbjuDhb81t4GrYyjLAmBo` (`5064e70`) READY; prior `dpl_3XePMMPAs9tSBydhmPYNQ687QSFZ` (`85a4f6a`) also READY, same stable alias, both Vercel-SSO protected. Full authenticated Chrome E2E on the `85a4f6a` deployment passed: dashboard stage transition, invoice creation, share create/regenerate/revoke, recipient page, public JSON/PDF privacy headers, old/new-token 404 invalidation; cleanup returned disposable deal/invoice/share counts to 0/0/0; browser console clean; mobile Lighthouse Accessibility/Best Practices/SEO all 100. A later "share panel stuck loading" report was diagnosed and found not reproducible — the code already handles the `{ active: false }` transition correctly; a post-`5064e70` browser screenshot (inspected by Hermes, not run by Claude) confirms the working active-share state. Excluded from this acceptance, separately gated and undecided: Production deployment, public/non-SSO recipient access. The unrelated cron NO-GO (today's Focus 0/2) is not an M2 blocker. Full detail: DAILY_LOG "Day 1 M2 acceptance and documentation reconciliation — 2026-07-18".
- 2026-07-18 (earlier same day, superseded by the above): Task F+G final pre-commit review passed (dashboard 7/7, share/public 37/37, full suite 27 files/223 tests, lint/typecheck/build/prisma/cron-guard/diff-check all green). The "uncommitted/unpushed/undeployed" and "M2 NOT accepted" language recorded at that point has since been superseded by the commit/push/migration-apply/deploy/E2E chain above. Full detail: DAILY_LOG "Day 1 Task F+G — final pre-commit review disposition — 2026-07-18" and the earlier Task F entries.
- 2026-07-17: Chris approved item 1 (push 8 M2 commits + protected Preview redeploy) and separately approved option A for share-link scope; both executed and closed same day. Full detail: DAILY_LOG "Day 1 Task C/D/E/F" entries.

## approvals
pending_from_chris: Production deployment decision; separate public (non-SSO) access decision for recipient share links; M3 go-ahead.
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval; M2 share-link option A + Preview-only rollout execution (2026-07-18, "Please continue what you think the best") — executed in full (commit/push/migration-apply/deploy/E2E, see decisions above); M2 documentation reconciliation + explicit acceptance closeout (2026-07-18, "continue") — this task, completed.

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; Google Cloud OAuth client managed through logged-in Chrome MCP session
preview: latest protected deployment `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` (remote `58eed07`, branch `hermes/m2-invoice`, target preview) READY at https://dibayar-mhk536jix-kenji-iwakura.vercel.app, stable alias https://dibayar-git-hermes-m2-invoice-kenji-iwakura.vercel.app, both Vercel-SSO protected. Isolated Neon Preview branch (`preview/hermes/m2-invoice`, database `neondb`) has migrations `20260717090000_invoice_share` and `20260719075600_invoice_share_expiry` applied 2026-07-19 via Neon SQL Editor.
production: URL reachable; Vercel Authentication protected; no new Production deployment this run.
smoke: full authenticated Chrome E2E on the `85a4f6a` deployment passed (see decisions above); a post-`5064e70` screenshot confirms the share panel renders the correct active state.

## next_3_tasks
1. Get Chris's separate Production deployment decision — not started.
2. Get Chris's separate public/non-SSO recipient share-link access decision — decision brief now available in DEPLOYMENT.md; decision itself not started/not made.
