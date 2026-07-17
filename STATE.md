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
day_count: 6
repo_url: git@github.com:crh/dibayar.git
prod_url: https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/
last_deploy: 2026-07-16 Git-triggered protected M2 Preview for feature commit 9794d02; Ready with the stable M2 branch alias
build_status: green
latest_validation: 2026-07-17 Task C pre-apply checkpoint: 111 tests/lint/typecheck/build/prisma validate+generate passed locally; commit 067593c not deployed
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M2 — Invoice (owner list/detail/status/PDF hardened and protected-Preview deployed; audit-remediation Tasks A/B done; Task C deal-deletion hardening code+migration generated, locally verified, NOT applied/deployed)
active_branch: hermes/m2-invoice
latest_feature_commit: 067593c fix(deals): preserve invoiced records — local only, not pushed, not deployed
remote_feature_branch: origin/hermes/m2-invoice includes 9794d02 (067593c and docs commits a8f9f9c/a113d5d/0f16cf7 are local-only, unpushed)
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview

today_tasks_max_3:
  - Task A: evidence-chain repair (docs-only) — done
  - Task B: rubric/checklist amendments (docs-only) — done
  - Task C1-C3: Invoice.deal FK Restrict + 409 owner-facing block on invoiced-deal deletion; migration generated; code committed locally; migration apply and Preview smoke explicitly pending Chris approval — done up to that gate
open_blockers: Task C migration apply + protected M2 Preview runtime smoke require explicit Chris approval before proceeding; recipient-facing share links still require a separate public-access decision; Production untouched

## recent_signal_findings
- No external signal check recorded; this run was limited to M2 implementation and local verification.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-17: Task C hardens deal deletion so financial/tax records survive: `Invoice.deal` FK changed from `onDelete: Cascade` to `Restrict` in `prisma/schema.prisma`; `deleteDeal` (src/lib/deals.ts) now returns `{kind: "deleted"|"not-found"|"has-invoices"}`, narrowly catching only `Prisma.PrismaClientKnownRequestError` code `P2003` (the sole FK restricting Deal deletion) and rethrowing anything else; `DELETE /api/deals/[id]` returns 409 with exact Bahasa copy `Deal ini punya invoice, jadi belum bisa dihapus.` for invoiced deals, 204 otherwise, 404/401 unchanged. TDD: RED confirmed (4 failing assertions) before the code change, GREEN after (11/11 targeted, 111/111 full suite). Migration `prisma/migrations/20260717060000_invoice_deal_restrict_delete` was hand-written then cross-checked byte-for-byte against `prisma migrate diff --script` output; NOT applied to any database. Committed locally as `067593c`; not pushed; Preview/Production untouched. Migration apply + Preview smoke pending explicit Chris approval.
- 2026-07-17: Task A evidence-chain repair corrected `day_count` from a stale `1` to `6`, counting distinct Asia/Jakarta calendar days with recorded activity from `phase_started` 2026-07-12 through today 2026-07-17 inclusive (git-log/DAILY_LOG evidence on 12, 13, 14, 15, 16, plus this Task A documentation work on 17) — not a count of delegation runs. Also annotated the `4f531d9`→`12e8145` history-rewrite reference and reconciled SECURITY.md with verified evidence (see DAILY_LOG "Day 1 Task A — evidence-chain repair — 2026-07-17").
- 2026-07-16: Owner invoice hardening keeps all routes authenticated, adds controlled non-leaking 500 responses to list/detail/PDF GETs, and scopes source-deal creation plus status writes by user ID. No public invoice route was added.
- 2026-07-16: Chris granted standing autonomous milestone execution; task selection should not require prompts. Ask only for a genuine access/decision blocker; Production, public access, credentials, destructive changes, financial/legal/medical decisions remain separately gated.
- 2026-07-16: Commits 3f897c9 and 2cc00c7 add owner-scoped mobile invoice list/detail/status transitions and PDF download. Protected Preview smokes passed; no recipient-public route was exposed.
- 2026-07-16: Commit 9f8c00b adds tenant-scoped invoice list/detail reads; b8fe0ae hardens existing deal reads to scope `id` and `userId` in the database query. Both are live-smoke-passed on isolated protected Preview; Production untouched.
- 2026-07-16: Commit 8faadca binds methods returned by the lazy Prisma Proxy to the actual client, fixing invoice `$transaction`; creation smoke passed on isolated protected Preview.

## approvals
pending_from_chris: Task C migration apply (`20260717060000_invoice_deal_restrict_delete`) to isolated M2 Preview + post-apply Preview runtime smoke; Production public-access decision
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
1. Obtain Chris approval to apply migration `20260717060000_invoice_deal_restrict_delete` to isolated M2 Preview only, then run and record the post-apply Preview runtime smoke (blocked deletion + normal deletion).
2. Obtain a public-access decision before building recipient-facing invoice links.
3. Keep Production protected; request a separate decision before production deployment.
