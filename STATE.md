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
last_deploy: unchanged from Task C: docs-only Preview `dpl_4bNQ5UySunYt4obgWbEPNTR6LrJe` (commit 745353e), Ready, protected. Task D commits `1154c51`/`3129b6a` are NOT deployed — both are local-only on `hermes/m2-invoice`, 3 commits ahead of `origin/hermes/m2-invoice` (still at `745353e`)
build_status: green
latest_validation: 2026-07-17 Task D: source hardening at `1154c51`/`3129b6a` verified two ways — (1) working tree at committed `3129b6a`: test 20 files/133 passed, lint/typecheck/build pass, route inventory unchanged, `git diff --check` pass, no secrets in `745353e..HEAD`; (2) from-scratch clean-checkout worktree at full sha `3129b6a7eeb6bc0478a7004e4cb7433af55cf5e1`: only tracked `.env.example` present, `npm ci` pass (612 pkgs, same known 6 moderate audit findings), lint/typecheck/test(20/133)/build all pass, build 29.2s, worktree removed after. No deploy performed. Full detail: DAILY_LOG "Day 1 Task D — code hardening and clean-checkout verification — 2026-07-17"
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M2 — Invoice (owner list/detail/status/PDF hardened; audit-remediation Tasks A, B, C, D all done — Task D route error-handling hardening committed and clean-checkout-verified, not yet deployed)
active_branch: hermes/m2-invoice
latest_feature_commit: 3129b6a fix(api): classify malformed JSON as 400 and contain auth failures in mutations — local only, not pushed
remote_feature_branch: origin/hermes/m2-invoice at 745353e (includes 067593c, 31cc6e9, c295d35, 745353e); local HEAD is 3 commits ahead (1154c51, 3129b6a, plus this docs commit), intentionally not pushed today
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview

today_tasks_max_3 (Chris explicitly requested a 4th task today; Focus scored 0/2 accordingly, see DAILY_LOG):
  - Task A: evidence-chain repair (docs-only) — done
  - Task B: rubric/checklist amendments (docs-only) — done
  - Task C: Invoice.deal FK Restrict + 409 owner-facing block on invoiced-deal deletion — done: fingerprint gate repeated (target confirmed isolated), migration applied to isolated `preview/hermes/m2-invoice`, pushed, protected Preview redeployed Ready, authenticated smoke passed (201/201/409/201/204), cleanup verified 0/0/0
  - Task D: deal/invoice route error-handling hardening (`1154c51`, `3129b6a`) — done: committed, canonical gates pass, independently reproduced in a from-scratch clean-checkout worktree; NOT pushed/deployed
open_blockers: none for Task C or D locally; recipient-facing share links still require a separate public-access decision; Production deployment/migration still requires a separate decision — Production untouched today; Task D commits remain unpushed pending Task E / go-no-go bundling

## recent_signal_findings
- No external signal check recorded; this run was limited to M2 implementation and local verification.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-17: Task D (4th task today, Chris-requested; Focus scored 0/2, see DAILY_LOG) hardened deal/invoice route error handling in two commits already on `HEAD`: `1154c51` adds try/catch to deal `GET`/`GET [id]`/`DELETE [id]` so DB errors return the standard Bahasa 500 instead of escaping uncaught; `3129b6a` fixes malformed-JSON handling (400 instead of 500) and moves `auth()`/`params` inside the try block (controlled 500 instead of uncaught) across all four deal/invoice mutation routes. Verified twice: working tree at `3129b6a` (test 20/133, lint, typecheck, build, `git diff --check` all pass) and independently in a from-scratch clean-checkout worktree at the full sha (same gates green, `npm ci` clean, only tracked `.env.example` present). Two prior `claude-saas` runs had timed out at 600s; a recovery run restored four temporarily-reverted route files to `HEAD` and confirmed the tree clean — no manual source recovery by Hermes. Not pushed/deployed; Production/public/database/cron untouched. Full detail: DAILY_LOG "Day 1 Task D — code hardening and clean-checkout verification — 2026-07-17".
- 2026-07-17: Post-commit deployment reconciliation (this run, docs-only, correction of a prior worker's timeout): confirmed the push of `745353e` triggered protected docs-only Preview `dpl_4bNQ5UySunYt4obgWbEPNTR6LrJe`, Ready, target Preview, stable alias still 302-protected (`vercel inspect --json`). Local HEAD matched `origin/hermes/m2-invoice` at `745353e` before this run, tree clean. Since `745353e` touched only DAILY_LOG.md/SECURITY.md/STATE.md, the Task C runtime smoke against `dpl_6opTQAFMHkfVjcKFYc1t3Jc3GrVk` remains valid evidence for the identical current runtime code. Canonical gates re-run and green: `npm run test` 19 files/111 tests, `npm run lint`, `npm run typecheck`, `npm run build` (unchanged route inventory); one unsupported command, `npm run test -- --runInBand` (a Jest flag Vitest rejects), was run in error immediately before the canonical `npm run test` and is logged honestly rather than omitted. This correction commit is local-only, intentionally not pushed today. Full detail: DAILY_LOG "Day 1 Task C post-commit deployment reconciliation".
- 2026-07-17: Task C executed and closed: SHA-256 fingerprint gate repeated against the isolated `preview/hermes/m2-invoice` target and confirmed distinct from Production (prefixes only, no host/URL/value, logged in DAILY_LOG); `20260717060000_invoice_deal_restrict_delete` applied via `prisma migrate deploy` (preflight: only this migration pending; postflight: schema up to date); temp mode-0600 credential file securely deleted and verified absent; one limited exposure logged honestly — Prisma's status banner surfaced the Preview pooler hostname only (no password/URL/value) inside the internal execution trace, never returned to Chris or committed (see SECURITY.md known gaps). Branch fast-forward pushed `270fef1..c295d35`; protected Preview redeploy `dpl_6opTQAFMHkfVjcKFYc1t3Jc3GrVk` Ready, stable alias attached and still Vercel-Auth protected. Authenticated smoke (marker `SMOKE-C-1784264959642`) passed: invoiced-deal delete blocked 409 with exact Bahasa copy, plain-deal delete 204. Neon cleanup left invoice/deal/marker counts at 0/0/0, screenshot-verified. Migration apply, fingerprint values, and the smoke HTTP calls were performed by the executing session and relayed to this docs run, not re-run here; this run independently corroborated the deployment (`vercel inspect --json`), the stable alias protection (curl 302), and the cleanup result (direct screenshot inspection). Full detail: DAILY_LOG "Day 1 Task C migration, protected Preview smoke, and cleanup".
- 2026-07-17: Chris approved Task C execution scope only (relayed by Hermes from the active Hermes/Chris conversation; exact Chris quote: "I approve"): apply migration `20260717060000_invoice_deal_restrict_delete` to isolated Neon branch `preview/hermes/m2-invoice` only, after repeating the SHA-256 fingerprint gate, then push/redeploy protected M2 Preview and run authenticated smoke. Explicitly excluded from this approval: Production and any public/recipient-facing access change, both of which remain pending. This docs-only run did not witness the approval conversation directly, did not execute the migration, push, or redeploy, and made no source/schema/migration change.
- 2026-07-17: Task C hardens deal deletion so financial/tax records survive: `Invoice.deal` FK changed from `onDelete: Cascade` to `Restrict` in `prisma/schema.prisma`; `deleteDeal` (src/lib/deals.ts) now returns `{kind: "deleted"|"not-found"|"has-invoices"}`, narrowly catching only `Prisma.PrismaClientKnownRequestError` code `P2003` (the sole FK restricting Deal deletion) and rethrowing anything else; `DELETE /api/deals/[id]` returns 409 with exact Bahasa copy `Deal ini punya invoice, jadi belum bisa dihapus.` for invoiced deals, 204 otherwise, 404/401 unchanged. TDD: RED confirmed (4 failing assertions) before the code change, GREEN after (11/11 targeted, 111/111 full suite). Migration `prisma/migrations/20260717060000_invoice_deal_restrict_delete` was hand-written then cross-checked byte-for-byte against `prisma migrate diff --script` output. Committed as `067593c`; subsequently applied to isolated Preview, pushed, and deployed — see the newer decision entry above.
- 2026-07-17: Task A evidence-chain repair corrected `day_count` from a stale `1` to `6`, counting distinct Asia/Jakarta calendar days with recorded activity from `phase_started` 2026-07-12 through today 2026-07-17 inclusive (git-log/DAILY_LOG evidence on 12, 13, 14, 15, 16, plus this Task A documentation work on 17) — not a count of delegation runs. Also annotated the `4f531d9`→`12e8145` history-rewrite reference and reconciled SECURITY.md with verified evidence (see DAILY_LOG "Day 1 Task A — evidence-chain repair — 2026-07-17").
- 2026-07-16: Owner invoice hardening keeps all routes authenticated, adds controlled non-leaking 500 responses to list/detail/PDF GETs, and scopes source-deal creation plus status writes by user ID. No public invoice route was added.
- 2026-07-16: Chris granted standing autonomous milestone execution; task selection should not require prompts. Ask only for a genuine access/decision blocker; Production, public access, credentials, destructive changes, financial/legal/medical decisions remain separately gated.
- 2026-07-16: Commits 3f897c9 and 2cc00c7 add owner-scoped mobile invoice list/detail/status transitions and PDF download. Protected Preview smokes passed; no recipient-public route was exposed.
- 2026-07-16: Commit 9f8c00b adds tenant-scoped invoice list/detail reads; b8fe0ae hardens existing deal reads to scope `id` and `userId` in the database query. Both are live-smoke-passed on isolated protected Preview; Production untouched.
- 2026-07-16: Commit 8faadca binds methods returned by the lazy Prisma Proxy to the actual client, fixing invoice `$transaction`; creation smoke passed on isolated protected Preview.

## approvals
pending_from_chris: Production deployment decision; public-access decision for recipient-facing invoice links
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval; local staging/commit review, authenticated M0 production smoke confirmation, instruction to continue interrupted M1 work, M1 documentation push, and M2 start; Task C migration `20260717060000_invoice_deal_restrict_delete` apply to isolated Neon branch `preview/hermes/m2-invoice` only (after repeating the SHA-256 fingerprint gate), then push/redeploy protected M2 Preview and authenticated smoke — Production and public-access explicitly excluded; relayed by Hermes 2026-07-17 ("I approve"); execution completed and closed 2026-07-17 (see decisions_last_3_days)

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; Google Cloud OAuth client managed through logged-in Chrome MCP session
preview: latest protected deployment `dpl_4bNQ5UySunYt4obgWbEPNTR6LrJe` (commit 745353e, docs-only) Ready at https://dibayar-lukd019zo-kenji-iwakura.vercel.app with stable alias https://dibayar-git-hermes-m2-invoice-kenji-iwakura.vercel.app, Vercel Authentication protected (302 confirmed); it changed only DAILY_LOG.md/SECURITY.md/STATE.md, so the runtime app is byte-identical to the prior `dpl_6opTQAFMHkfVjcKFYc1t3Jc3GrVk` (commit c295d35) build — that deployment's authenticated smoke (Task C, marker `SMOKE-C-1784264959642`) remains the valid runtime evidence; M2 uses its isolated Neon branch and has the deal-deletion-restrict migration applied
production: URL reachable; Vercel Authentication protected; no new Production deployment this run (independently confirmed via `vercel ls` — most recent Production entry unchanged, 4d old)
smoke: protected M2 Preview Google OAuth signed in as Kenji. Deal/invoice/status/PDF smoke as previously recorded, plus Task C 2026-07-17 (marker `SMOKE-C-1784264959642`): POST invoiced deal 201, POST invoice 201, DELETE invoiced deal 409 (`Deal ini punya invoice, jadi belum bisa dihapus.`), POST plain deal 201, DELETE plain deal 204. Cleanup verified invoice/deal/marker counts 0/0/0 (screenshot-inspected this run).

## next_3_tasks
1. Task E (audit-remediation) — not started.
2. Push local `hermes/m2-invoice` (Task D commits) and redeploy protected Preview once approved — not started.
3. Final STATE.md update and MVP go/no-go review — not started; blocked on Chris's Production and public-access decisions.
