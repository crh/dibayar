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
last_deploy: 2026-09-19 — repository receipts report Production deployment from merged commit `f55b320`; not independently inspected since (no deployment action has occurred in any session covered by this file).
build_status: PR #12 (CI font-hardening: self-hosted both Google Fonts imports via `next/font/local`, fixed a Codex-flagged license-notice bug, fixed a real CI-only touch-target regression, regenerated all 9 `@visual` baselines on the real CI runner) merged 2026-09-25, merge commit `d90356b` — `main`'s current HEAD. Post-merge CI green on every job. Full detail: `docs/receipts/DIBAYAR-CI-FONT-HARDENING-2026-09-23.md`; `DAILY_LOG.md` "2026-09-25" entry.
latest_validation: 2026-09-25 — post-merge CI on `main` (`36092553353`) green across `lint-typecheck-test`/`e2e-a11y`/`e2e-critical`/`ux-audit` (`e2e-cross-browser` skipped on push, by design).
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: Engineering MVP and UX work through T-27, PR #8-#12's E2E hardening/CI reliability, and the full P2-4 round (5/5 residual journey gaps closed) are merged to `main`. PR #14 open (M4 wording + moderated-Preview kit). M4 creator validation and launch/access decisions remain open.
active_branch: `codex/m4-invoiced-this-month` (from `main` @ `86eff1d`). IN PR: #14 (relabels the Beranda monthly summary "Ditagihkan bulan ini" / "Invoiced this month" — wording only, calculation unchanged; corrects `docs/validation/M4-READINESS.md` §3; adds the moderated-Preview checklist and `docs/validation/M4-SESSION-TRACKER.md`). PR #13 (M4 readiness) is MERGED (`86eff1d`, 2026-09-26T02:42Z, on Chris's explicit authorization).
latest_feature_commit: `d90356b` on `main` (PR #12 merge: CI font-hardening).
open_blockers: Full plan at `docs/PROJECT-PLAN-2026-09-22.md`; receipts at `docs/receipts/DIBAYAR-P2-4-OWNERSHIP-DENIAL-2026-09-23.md` and `docs/receipts/DIBAYAR-CI-FONT-HARDENING-2026-09-23.md`. All three original cross-browser findings, all five P2-4 residual gaps, and the recurring font-CI flake are merged/fixed on `main`. **P2-2's scheduled-run acceptance**: a 2026-09-24 scheduled run (`35970637176`) failed on `e2e-cross-browser` while running against `main`'s then-pre-font-fix commit — very likely (pattern-matched, not log-confirmed; see `DAILY_LOG.md` "2026-09-25") the same now-fixed font flake, breaking the prior "two consecutive" streak. The next scheduled run (`36109870314`, 2026-09-25T07:52 UTC, post-PR#12-merge) passed clean on every job including `e2e-cross-browser` — **1 of 2 fresh qualifying runs**, needs one more consecutive success. Being actively monitored this session (see below) — no schedule modification, no manual trigger counted toward it. Other product blockers unchanged: M4 creator validation, confirmation of Production edge/public-access intent, and decisions on the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis.
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
  - Closed the recurring `next/font/google` CI build-time flake that failed PR #11's post-merge `e2e-a11y` job: moved both Google Fonts imports (Plus Jakarta Sans, Source Serif 4) to self-hosted `next/font/local`, opened PR #12. See decisions log for full detail.

open_blockers_continued: none beyond the ones listed above.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-09-23: Closed the ownership-denial journey (last P2-4 gap) on PR #11, restoring PR discipline after the prior day's direct-to-main deviation. Corrected a first-draft assumption (cross-owner page nav returns 200 with a streamed not-found UI, not a real 404 — confirmed via curl and Next's own docs) rather than assuming the test was right. Full detail: `docs/receipts/DIBAYAR-P2-4-OWNERSHIP-DENIAL-2026-09-23.md`.
- 2026-09-24: Merged PR #11 (`0aab7df`); post-merge CI hit the recurring `next/font/google` build-time flake on `e2e-a11y`. Opened PR #12 self-hosting both Google Fonts imports via `next/font/local`. Full detail: `docs/receipts/DIBAYAR-CI-FONT-HARDENING-2026-09-23.md`.
- 2026-09-25: Fixed PR #12's two remaining gaps (a Codex-flagged license-notice bug, a real CI-only touch-target regression) and regenerated all 9 `@visual` baselines via the real-CI-runner-only workflow (Chris granted explicit `gh workflow run` permission after auto-mode's classifier denied it). Merged PR #12 (`d90356b`) on Chris's explicit "merge if green" instruction. While confirming post-merge state, found a 2026-09-24 scheduled run had failed `e2e-cross-browser` against the pre-fix commit — resets P2-2's consecutive-success streak to 0 of 2; being monitored this session. Full detail: `DAILY_LOG.md` "2026-09-25" entry; receipt addenda §15-16.
- 2026-09-26: Roadmap resumed post-PR #12. Found the "issue-date" income basis is really `Invoice.createdAt` (no issue-date column; paid and unpaid non-drafts both count) and a mislabeled income test that never tested draft exclusion. PR #13 marks it and the 90-day share lifetime provisional, pins current behaviour with tests, and adds `docs/validation/M4-READINESS.md` (decision packet + feedback template). No Production/public-access change. Receipt: `docs/receipts/DIBAYAR-M4-READINESS-2026-09-26.md`.
- 2026-09-26 (later): PR #13 merged on Chris's explicit "Merge is authorized" (`86eff1d`). PR #14 relabels the monthly summary "Ditagihkan bulan ini" (was "Net bulan ini"), fixes the M4-READINESS §3 rate-limiter statement, and adds the moderator checklist (§5) and session tracker. 3 Beranda `@visual` baselines regenerated via the real-runner workflow (run `36213322701`). Status: monthly-summary wording IN PR; 7-day due-soon and 90-day share lifetime WAITING FOR PRODUCT DECISION (unchanged); M4 environment = moderated Preview; Production/public access unchanged; recruiting NON-CODE / Chris action; P2-2 still 1 of 2 (WAITING FOR SCHEDULE; no scheduled run since `36109870314`, weekday-only cron). Receipt: `docs/receipts/DIBAYAR-M4-INVOICED-THIS-MONTH-2026-09-26.md`.
- Older entries (through 2026-09-22: PR #8/#9/#10 merges, cross-browser root-causing, P2-4 round) already live in full in `DAILY_LOG.md` per the 3-day retention rule; nothing was dropped, only relocated out of this file.

## approvals
pending_from_chris: [2026-09-20, still open] Confirm whether Production's no-Vercel-SSO edge reachability is intentional; decide recipient public-access policy; complete M4 validation/go-no-go; confirm or revise the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis.
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval (Phases 4–6, unchanged). 2026-09-22: merge authorization exercised for PR #9/#10. 2026-09-25: "Fix all the issues to make it green" (touch-target fix + baseline regen), explicit `gh workflow run` permission grant for `update-visual-baselines.yml` (auto-mode's classifier had denied it), and "merge PR #12 if all CI is green" — PR #12 merged. No PR is currently open.

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
1. Watch for one more qualifying (successful) *post-PR#12-merge* scheduled `e2e-cross-browser` run (weekdays 02:17 UTC, historically fires ~5h late) to close P2-2's acceptance — `36109870314` (2026-09-25) is the first of the two needed, after the streak restarted from a 2026-09-24 failure (see `open_blockers`).
2. Confirm Production edge/public-access intent, then resume M4 creator validation — unchanged from 2026-09-20, still the largest open item.
3. IN PR #14 (green CI required before merge; merge is Chris's call — merging to `main` triggers the normal Vercel Production redeploy, see receipt §7). No unblocked engineering item remains on the roadmap; further work is WAITING FOR PRODUCT DECISION (7-day due-soon, 90-day share lifetime, ratifying the `createdAt` summary basis) or PRODUCTION AUTHORIZATION (edge/public access, distributed rate limiter, P1-1/P1-2). M4 recruiting/sessions are non-code and need Chris (`docs/validation/M4-READINESS.md` §5, `M4-SESSION-TRACKER.md`).
