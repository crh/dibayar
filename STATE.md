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
day_count: 11
repo_url: git@github.com:crh/dibayar.git
prod_url: https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/
last_deploy: 2026-09-19 — repository receipts report Production deployment from merged commit `f55b320`; this audit did not independently inspect Vercel. Current local checkout is `main` at `3473194`.
build_status: green (2026-09-20) — `npm test` 79 files/766 tests, `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` all PASS. `npm audit --omit=dev` was not verified because registry DNS was unavailable.
latest_validation: 2026-09-20 — current `main` source, Git history, checked-in deployment configuration, and status documents reconciled; standalone report: `docs/status/DIBAYAR-CURRENT-TRUTH-AUDIT-2026-09-20.md`.
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: Engineering MVP and UX work through T-27 are present in `main`; M4 creator validation and launch/access decisions remain open.
active_branch: main (HEAD `3473194`; local is one documentation commit ahead of `origin/main` at `f55b320`)
latest_feature_commit: UX feature chain through T-27 is an ancestor of `main`; latest integration commit is `f55b320` (PR #7 Preview database binding fix), with local documentation-only HEAD `3473194`.
open_blockers: Current status is reconciled in docs/status/DIBAYAR-CURRENT-TRUTH-AUDIT-2026-09-20.md. Product blockers remain M4 creator validation, confirmation of Production edge/public-access intent, and decisions on the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis. Deal deletion with invoices remains deferred; PPh values remain estimates, not tax filing calculations.
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
  - T-25: landing page rebuilt to the spec's single-column 5-block layout; "Coming soon" deleted and replaced with the honest access sentence; on-page language switcher and its now-unused component/keys removed (language switching already lives in Settings) — done, committed, pushed, live-verified
  - T-26: every always-side-by-side action row (2 buttons, or input+button) across the app now stacks full-width below 360px via `min-[360px]:` variants, reverting to today's layout at and above it; card padding on the invoice header/payment-status/share/details cards and the home net-income card drops to 16px below 360px the same way — done, committed, pushed, live-verified (via computed-style inspection, see latest_validation)

open_blockers_continued: none beyond the ones listed above.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-08-25 (Phase 6): T-25/T-26 implemented, tested, committed (`084b717`, `331e986`), pushed, and live-verified on Preview. T-25 rebuilt `/masuk` to the spec's exact single-column 5-block order (headline, subhead, chips, sign-in, three steps), deleting "Coming soon"/"Segera hadir" for the honest access sentence and removing the on-page language switcher (redundant with Settings) along with its now-fully-unused `LanguageSwitcher` component and `language.*` i18n keys. T-26 audited every always-side-by-side action row across the six owner routes and converted the genuine wrap/overflow risks (two-button rows, input+button rows) to stack full-width below 360px via `min-[360px]:` variants, plus dropped card padding to 16px below 360px on four invoice-detail cards and the home income card. Since jsdom has no layout engine and this session's browser-resize tool doesn't produce a true <360px viewport, added structural class-presence tests as the implementation-side evidence and verified live via `getComputedStyle` (confirming the media query is genuinely active at 390px, not a dead class) rather than a visual capture — the real pixel-measurement capture is Hermes's T-27 job. 696/696 tests pass. Full detail: `DAILY_LOG.md` "Phase 6" entry.
- 2026-08-25 (Phase 5): T-22/T-23/T-24 implemented, tested, committed (`18edb01`, `366f6e8`, `4ee47bb`+`a1ae921`), pushed, and live-verified on Preview. T-22 built the canonical `InvoiceDocument` model/blocks/HTML adapter from the §5.3 field table, reusing the existing `withholdingTaxLabel` (now exported) for guaranteed tax-parity. T-23 rewrote `/i/:token` to server-render that model directly (was: server gate + redundant client re-fetch), adding a typed "expired" state distinct from the deliberately-generic "invalid"/rate-limited 404. T-24 added the react-pdf adapter and rewired both PDF routes onto the same canonical model, including the owner route fetching issuer/bank Settings for the first time. A staging mistake split T-24 into two commits (`4ee47bb` alone doesn't build; `a1ae921` completes it), caught and fixed in the same push. Live verification captured real `%PDF-1.3` bytes from both PDF routes, byte-identical in length for the same invoice. Full detail: `DAILY_LOG.md` "Phase 5" entry.
- 2026-08-24 (Phase 4): T-19 (corrected)/T-20/T-21 implemented, tested, committed (`08079f0`, `fd15377`, `3fb7546`), pushed, and live-verified on Preview. T-19's first pass (`08079f0`) reordered the payment-status section and added the PAID→SENT undo, but missed two spec requirements: moving the real page from the `/dashboard/invoices/:id` compatibility route to `/invoice/:id` (the list/home queue already linked there, so those links were live-broken), and putting the primary WhatsApp action first with due-date editing moved into Details. Surfaced to Chris before proceeding; Chris chose the full fix. `fd15377` fixed both, added a 302 redirect, built `DateField`, and added a desktop share rail. `3fb7546` replaced hardcoded WhatsApp message text with the owner's actual Settings templates. Full detail: `DAILY_LOG.md` "Phase 4" entry.
- Older entries (2026-08-07 through 2026-08-23: Phase 0/1 checkpoints, Phase 2 T-08–T-12, the full T-13 R1 delegation-ledger saga, and Phase 3 T-13–T-18) moved to `DAILY_LOG.md` per the 3-day retention rule; nothing was dropped, only relocated.

## approvals
pending_from_chris: [2026-09-20] Confirm whether Production's no-Vercel-SSO edge reachability is intentional; decide recipient public-access policy; complete M4 validation/go-no-go; confirm or revise the provisional 7-day due-soon window, 90-day share lifetime, and invoice-issue-date income basis.
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval; T-14 through T-26 executed directly per Chris's explicit "continue... just want to complete tasks as fast as possible" and subsequent "proceed"/"continue"/"yes" instructions across Phases 4–6, without a separate per-task delegation-ledger approval; explicit "remember to do live-preview after each phase" instruction, followed via real browser automation against the live Preview deployment for Phases 4, 5, and 6.

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
1. Confirm Production edge/public-access intent and deployment-protection policy.
2. Run M4 creator validation with at least five Indonesian creators and record feedback.
3. Re-run dependency audit from a network-enabled environment; then clean up stale status/receipt references and decide whether the historical cron guard should be updated or retired.
