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
build_status: green (2026-09-22) — `npm test` 80 files/768 tests, `npm run lint` (0 errors/0 warnings), `npm run typecheck`, `npm run build` (canonical Turbopack), `test:diagnostics-selftest`, `test:e2e:critical` (68 passed/8 skipped) all PASS on `codex/post-pr9-hardening`, verified locally and on PR #10's own CI (run `35697350409`, success).
latest_validation: 2026-09-22 — PR #9 merged to `main` (048e4e2); PR #10 opened with all three cross-browser findings root-caused and fixed, CI green. See `docs/receipts/DIBAYAR-PR9-MERGE-AND-NEXT-STEPS-2026-09-22.md`.
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: Engineering MVP and UX work through T-27, PR #8's E2E hardening, and PR #9's diagnostics self-test/sleep-fix/revoked-token work are present in `main`. PR #10 (`codex/post-pr9-hardening`: all three cross-browser findings root-caused and fixed, plus two more found while verifying) is open, CI-green, awaiting Chris review. M4 creator validation and launch/access decisions remain open.
active_branch: main (HEAD `048e4e2`, merge of PR #9). PR #10 (`codex/post-pr9-hardening`) open against `main`, CI green (run `35697350409`), not yet merged.
latest_feature_commit: `048e4e2` — merge of PR #9 (`codex/post-pr8-hardening`) to `main`, 2026-09-22T05:43:23Z, after re-validation and explicit approval in this session.
open_blockers: Full plan at `docs/PROJECT-PLAN-2026-09-22.md`; latest receipt at `docs/receipts/DIBAYAR-PR9-MERGE-AND-NEXT-STEPS-2026-09-22.md`. **PR #10 needs Chris review/merge** (https://github.com/crh/dibayar/pull/10) — CI green, all three original cross-browser findings root-caused and fixed (not worked around): Firefox's CSP `eval` block was Zod v4's `allowsEval` probe (not `@react-pdf/renderer`), fixed via `z.config({jitless:true})`; WebKit's 404-diagnostics allowlist now correlates against the real response instead of lagging page-navigation state; the due-date "Tersimpan" toast race replaced with a deterministic `waitForResponse` on the save PATCH. P2-2's scheduled-run acceptance stays **WAITING FOR SCHEDULE** — 0 scheduled runs observed as of ~07:07 UTC 2026-09-22, past today's expected 02:17 UTC firing (a GitHub Actions scheduling delay, not actionable from here). Five P2-4 residual journey gaps remain deferred, one (ownership-denial) now known to need a new second fixture user — see `docs/testing/E2E-IMPROVEMENT-PLAN.md` §8a. Other product blockers unchanged: M4 creator validation, confirmation of Production edge/public-access intent, and decisions on the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis.
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
  - Re-validated and merged PR #9 (head unchanged, MERGEABLE/CLEAN, CI green; merge required explicit approval after the same "Merge Without Review" classifier denial as PR #8). Root-caused and fixed all three pre-merge cross-browser findings on new PR #10: Zod's eval capability probe (Firefox), a page-navigation-timing gap in the WebKit diagnostics allowlist, and a real-time toast-visibility race in the due-date persistence test. Found and fixed two more genuine cross-browser gaps (Firefox `NS_BINDING_ABORTED`, WebKit's cancelled-prefetch pageerror text) while verifying the above via the full non-visual cross-browser sweep — not narrow single-file runs. Added regression coverage (a unit test for the Zod fix, two synthetic diagnostics-harness tests for the WebKit allowlist fix). Extracted WebKit's missing `libavif`/`libgav1`/`libyuv` shared libraries from Ubuntu `.deb` packages into the Playwright browser cache (no `sudo`, no system install) to make local WebKit testing possible at all in this environment.

open_blockers_continued: none beyond the ones listed above.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-09-22: Chris supplied `docs/PROJECT-PLAN-2026-09-22.md` (persisted verbatim) with explicit, pre-scoped authorization to merge PR #8 after re-validation, plus a bounded independent-engineering work list. Re-validation confirmed PR #8 unchanged (head `2e9ab13`, MERGEABLE/CLEAN, CI run `35609851823` green). The merge command itself was initially denied by the Claude Code auto-mode "Merge Without Review" classifier; Chris then said "Execute the pr 8 merge. I approve" and it succeeded (merge commit `5e33153`, post-merge CI green). A manual pre-merge `workflow_dispatch` cross-browser run (`35660957102`) surfaced real Firefox/WebKit findings (CSP `eval` block on invoice pages in Firefox; a WebKit console-allowlist path mismatch; a WebKit due-date-toast timing issue) — none affect PR #8's own PR-gate checks. Closed P0-3 (`npm audit --omit=dev`, 0 vulnerabilities), P1-3 (MFA design note, `docs/security/MFA-DESIGN.md`), and P1-4 (re-dispositioned `Deal.contactWa` as genuinely used, `User.image` as a required Auth.js/Google-adapter write target) with evidence in `SECURITY.md`. Separately, Chris caught a real error: this session had claimed no disposable Postgres was reachable to test two E2E items, when a container was already running on `127.0.0.1:55432` the whole time (a `/dev/tcp` check in this shell gave a false negative). Corrected immediately: seeded the real fixtures, ran the full critical E2E suite locally (68 passed/8 skipped), empirically re-tested (not just re-read) the `add-deal-dialog.spec.ts` wait (removing it failed 7/15 repeats, confirming the original finding), and closed one of the six previously-deferred P2-4 gaps (revoked-token recipient view) with a real, passing test. All on PR #9, CI green. Full detail: `DAILY_LOG.md` "2026-09-22" entry; receipt at `docs/receipts/DIBAYAR-PROJECT-PLAN-EXECUTION-2026-09-22.md`.
- 2026-09-22 (continued): Chris supplied a new merge-and-continue instruction bundle authorizing PR #9's merge specifically plus bounded follow-on engineering. Re-validated PR #9 (head `7273911` unchanged, MERGEABLE/CLEAN, CI green) and merged after explicit user approval (merge commit `048e4e2`; post-merge CI run `35691822317` green). Root-caused all three cross-browser findings from the pre-PR#8-merge dispatch rather than just re-describing them: Firefox's CSP `eval()` block was Zod v4.4.3's `allowsEval` capability probe (`node_modules/zod/src/v4/core/util.ts`), confirmed by decompiling the built client chunk and cross-referencing Zod's own upstream regression test for the same GitHub issue — fixed with `z.config({jitless:true})`, not a CSP change or library swap. WebKit's 404-diagnostics allowlist gated on `message.page().url()`, which (confirmed via temporary debug instrumentation, since removed) lags behind the real navigation in WebKit; replaced with response-based correlation. The due-date "Tersimpan" toast assertion was racing a 2-second-lived UI affordance against real wall-clock/browser speed; replaced with `page.waitForResponse` on the actual save PATCH. Found two further genuine cross-browser gaps only visible when running the full non-visual firefox+webkit sweep (not single-file runs): Firefox's `NS_BINDING_ABORTED` RSC-prefetch-cancellation text wasn't recognized (only Chromium's `net::ERR_ABORTED` was), and WebKit surfaces that same cancellation as an uncaught pageerror too. Extracted WebKit's missing shared libraries (`libavif`/`libgav1`/`libyuv`) from downloaded Ubuntu `.deb` packages into the Playwright browser cache to enable local WebKit testing at all (no `sudo`, no system-wide install). All fixes landed on new PR #10 (`codex/post-pr9-hardening`), CI green (run `35697350409`), left unmerged per this session's scope. P2-2 (two consecutive scheduled cross-browser runs) checked twice (~06:03 and ~07:07 UTC): still zero scheduled runs, past today's expected 02:17 UTC firing — a GitHub Actions delay, not investigated further per the plan's explicit instruction not to accelerate it. P2-4's remaining five gaps reviewed but not implemented; one (ownership-denial) now known to need a new second fixture user, one (server-validation) found harder than expected because native `<input type="date">` resists holding malformed values — both documented with concrete next steps in `docs/testing/E2E-IMPROVEMENT-PLAN.md` §8a rather than left vague. Full detail: `DAILY_LOG.md` "2026-09-22 (continued, PR#9)" entry; receipt at `docs/receipts/DIBAYAR-PR9-MERGE-AND-NEXT-STEPS-2026-09-22.md`.
- Older entries (through 2026-09-20: Phase 0–6/T-27 UX implementation, PR #7 Preview database-binding fix, and the 2026-09-20 truth audit) already live in full in `DAILY_LOG.md` per the 3-day retention rule; nothing was dropped, only relocated out of this file.

## approvals
pending_from_chris: [2026-09-22] **Review/merge PR #10** (https://github.com/crh/dibayar/pull/10), CI green. [2026-09-20, still open] Confirm whether Production's no-Vercel-SSO edge reachability is intentional; decide recipient public-access policy; complete M4 validation/go-no-go; confirm or revise the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis.
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval (Phases 4–6, unchanged). 2026-09-22: merge authorization exercised for PR #9 specifically (re-validated, then merged after explicit in-session approval once the harness's classifier denied the first unattended attempt) — PR #9 is now merged. That authorization does not extend to PR #10 or any other PR.

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
1. Chris: review and merge PR #10 (https://github.com/crh/dibayar/pull/10).
2. Watch for the first scheduled `e2e-cross-browser` run on `main` (weekdays 02:17 UTC, none observed yet); once two consecutive qualifying runs land, close B3's acceptance.
3. Pick up one of the five remaining P2-4 gaps (`docs/testing/E2E-IMPROVEMENT-PLAN.md` §8a) — ownership-denial needs a new second fixture user first; the others are more self-contained.
