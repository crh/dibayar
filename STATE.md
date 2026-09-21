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
last_deploy: 2026-09-19 — repository receipts report Production deployment from merged commit `f55b320`; not independently inspected today (no deployment action occurred this session). Current local checkout is `main` at this commit.
build_status: green (2026-09-20) — `npm test` 79 files/766 tests, `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` all PASS; not re-run today since no application code changed (today's changes are docs/security only). `npm audit --omit=dev` re-verified 2026-09-22: 0 vulnerabilities (registry now reachable). PR #8's own CI (lint/typecheck/test/build + critical/a11y/visual E2E) is independently green at head `2e9ab13`, run `35609851823`.
latest_validation: 2026-09-20 truth audit (`docs/status/DIBAYAR-CURRENT-TRUTH-AUDIT-2026-09-20.md`) plus 2026-09-22 PR #8 re-validation and dependency-audit re-run (this file, `SECURITY.md`).
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: Engineering MVP and UX work through T-27 are present in `main`. PR #8 (`codex/e2e-improvement-plan`, E2E hardening: cross-browser CI tier, canonical-build coverage, visual-baseline fix) is OPEN, CI-green, MERGEABLE/CLEAN at head `2e9ab13`, but **not yet merged** — see open_blockers. M4 creator validation and launch/access decisions remain open.
active_branch: main (HEAD is this commit). PR #8 branch `codex/e2e-improvement-plan` HEAD `2e9ab13` unchanged since CI run `35609851823` (all required jobs green). Follow-up branch `codex/post-pr8-hardening` created off `2e9ab13`, not yet pushed, reserved for P2-1/P2-3 work below.
latest_feature_commit: UX feature chain through T-27 is an ancestor of `main`; latest integration commit on `main` is `f55b320` (PR #7). PR #8 is the next integration, pending merge.
open_blockers: Full plan at `docs/PROJECT-PLAN-2026-09-22.md` (persisted 2026-09-22). **PR #8 merge needs Chris**: `gh pr merge 8 --merge` was denied by the Claude Code auto-mode classifier ("Merge Without Review") — this session verified head/CI/mergeable state is exactly as the plan expected, but the merge action itself requires Chris to run it directly or grant permission. Everything sequenced behind the merge (STATE.md's own post-merge close-out, the scheduled cross-browser signal) is blocked until then. A pre-merge manual `workflow_dispatch` cross-browser datapoint (run `35660957102`) found real, reproducible findings, not infra failure: Firefox blocks a `eval()` call via CSP on `invoice-journeys.spec.ts` pages only (5 tests, same error on retry); WebKit's expired/invalid-token console-message allowlist in `e2e/support/test.ts` doesn't match WebKit's console text (1 test); WebKit is slow/flaky on the due-date "Tersimpan" toast (1 test, browser-timing). None of these affect PR #8's own required checks (`e2e-cross-browser` only runs on `schedule`/`workflow_dispatch`, never `pull_request`) — they are follow-up triage items for whoever picks up P2-2/P2-4, not a merge blocker. Other product blockers unchanged: M4 creator validation, confirmation of Production edge/public-access intent, and decisions on the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis. Deal deletion with invoices remains deferred; PPh values remain estimates, not tax filing calculations.
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
  - Executed `docs/PROJECT-PLAN-2026-09-22.md` P0/P1 items: re-validated PR #8 (head/CI/mergeable all matched the plan's stated baseline), ran a pre-merge manual cross-browser datapoint, re-ran `npm audit --omit=dev` (0 vulnerabilities), wrote the MFA design note, and re-dispositioned the two flagged personal-data fields — all with evidence in `SECURITY.md`. PR #8 merge itself is blocked on Chris (see open_blockers); P2-1/P2-3 (test-infra work depending on PR #8's files) are queued on branch `codex/post-pr8-hardening`, not yet implemented.

open_blockers_continued: none beyond the ones listed above.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-09-22: Chris supplied `docs/PROJECT-PLAN-2026-09-22.md` (persisted verbatim) with explicit, pre-scoped authorization to merge PR #8 after re-validation, plus a bounded independent-engineering work list. Re-validation confirmed PR #8 unchanged (head `2e9ab13`, MERGEABLE/CLEAN, CI run `35609851823` green). The merge command itself was denied by the Claude Code auto-mode "Merge Without Review" classifier — a harness-level gate, not a plan/authorization problem — so PR #8 remains open pending Chris running the merge directly. A manual pre-merge `workflow_dispatch` cross-browser run (`35660957102`) surfaced real Firefox/WebKit findings (CSP `eval` block on invoice pages in Firefox; a WebKit console-allowlist path mismatch; a WebKit due-date-toast timing issue) — none affect PR #8's own PR-gate checks. Closed P0-3 (`npm audit --omit=dev`, 0 vulnerabilities), P1-3 (MFA design note, `docs/security/MFA-DESIGN.md`), and P1-4 (re-dispositioned `Deal.contactWa` as genuinely used, `User.image` as a required Auth.js/Google-adapter write target) with evidence in `SECURITY.md`. Full detail: `DAILY_LOG.md` "2026-09-22" entry; receipt at `docs/receipts/DIBAYAR-PROJECT-PLAN-EXECUTION-2026-09-22.md`.
- Older entries (through 2026-09-20: Phase 0–6/T-27 UX implementation, PR #7 Preview database-binding fix, and the 2026-09-20 truth audit) already live in full in `DAILY_LOG.md` per the 3-day retention rule; nothing was dropped, only relocated out of this file.

## approvals
pending_from_chris: [2026-09-22] **Run/authorize the PR #8 merge** (`gh pr merge 8 --merge`) — blocked by the local harness's own auto-mode classifier, not by review readiness. [2026-09-20, still open] Confirm whether Production's no-Vercel-SSO edge reachability is intentional; decide recipient public-access policy; complete M4 validation/go-no-go; confirm or revise the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis.
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval (Phases 4–6, unchanged). 2026-09-22: `docs/PROJECT-PLAN-2026-09-22.md` grants explicit merge authorization for PR #8 specifically (conditioned on re-validation, which passed) and bounded independent-engineering authorization for the P1/P2 items listed there — it does not authorize deployment, production data access, public-access changes, or merging any PR other than #8.

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
1. Chris: run `gh pr merge 8 --merge` (or grant the classifier permission) — everything else in `docs/PROJECT-PLAN-2026-09-22.md` P0/P2-2 sequences behind it.
2. Once #8 is merged: implement P2-1 (diagnostics negative-control self-test) and P2-3 (remove the two empirical E2E sleeps) on branch `codex/post-pr8-hardening`; triage today's Firefox/WebKit findings (see open_blockers) as part of the same pass.
3. Confirm Production edge/public-access intent, then resume M4 creator validation — unchanged from 2026-09-20, still the largest open item.
