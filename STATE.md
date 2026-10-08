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
last_deploy: 2026-09-27 — Vercel Production deployment for the PR #16 merge commit (`4c2f868`) verified `Ready` via `vercel ls` (deployment `dibayar-a3cz1kpp6`).
build_status: PR #20 (staging-activation docs) merged into `staging` 2026-09-30 by Chris — `origin/staging` = `fb28c30`. `main` = `d9fef85` (PR #18). Staging activation detail: `docs/receipts/DIBAYAR-HOBBY-STAGING-ACTIVATION-2026-09-29.md`.
latest_validation: 2026-10-01 — M4 internal dry run on staging (`fb28c30`): deal capture/stage move/invoice read/summary/due-soon PASS; share+WhatsApp PASS at API level (UI not browser-verified: occluded automation window); **gap: no UI PPh picker**. Demo data seeded for Oktober 2026 (net Rp 8.045.000). Branch gates: lint/typecheck/test 780/780/vercel-ignore 48/build pass. Receipt `docs/receipts/DIBAYAR-M4-STAGING-KICKOFF-2026-09-30.md`. Earlier: 2026-09-30 — staging smoke PASS (Google OAuth round trip, `/`, `/deal`, `/invoice`, `/pengaturan`, no console errors, no Production host references); staging runtime DB identity proven = Neon `staging`. 2026-09-29 local gates on `d9fef85`: lint/typecheck/test (771/771)/`test:vercel-ignore-build`/build all pass; PR #19 CI green.
staging_url: https://dibayar-git-staging-kenji-iwakura.vercel.app (Vercel Preview branch alias, Deployment Protection SSO on)
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: **M4 creator validation — prep on staging (2026-09-30).** Environment = staging (`staging_url`), moderated sessions, synthetic data via `npm run m4:demo-data`. Kit: `docs/validation/M4-READINESS.md`; tracker: `docs/validation/M4-SESSION-TRACKER.md`; receipt: `docs/receipts/DIBAYAR-M4-STAGING-KICKOFF-2026-09-30.md`.
active_branch: `chore/zero-routine-regression-phase2b-2026-10-08` (from `origin/staging` @ `979c3ec`, PR #31 squash-merged) — Zero Routine Phase 2B (journey Batch 2B); PR #32 into `staging`, not merged.
latest_feature_commit: `d9fef85` on `main` (PR #18 merge).
open_blockers: Full plan at `docs/PROJECT-PLAN-2026-09-22.md`. **P2-2's scheduled-run acceptance**: `36109870314` (2026-09-25) is 1 of 2 fresh qualifying `e2e-cross-browser` scheduled runs needed (streak reset by a 2026-09-24 failure); next expected weekday run untouched, no schedule modification, no manual trigger counted toward it. Other product blockers: M4 sessions (Chris recruits/schedules Creator 01–05); Production edge/public-access intent (not needed for moderated M4). The 7-day due-soon window, 90-day share lifetime, and `createdAt` net-invoiced summary basis are M4 hypotheses under test, kept fixed across sessions.

## pre_staging_transition (docs/DEVELOPMENT-WORKFLOW.md "Pre-staging transition")
- [x] repo-side deploy-filtering config added, AND Vercel build suppression LIVE-VERIFIED 2026-09-27 (disposable `chore/workflow-ci-only-smoke` branch: Vercel deployment `Canceled` in ~4s)
- [x] `staging` branch exists — `origin/staging` = `4c2f868825ee03c4a6fc84c758c35c157e901246`, exactly the PR #16 merge commit (verified 2026-09-27)
- [x] stable Vercel staging environment/domain verified 2026-09-29 — Hobby pattern: Preview deployments of Git branch `staging`, stable alias `dibayar-git-staging-kenji-iwakura.vercel.app`; deployment `dpl_CMk3N7bVwEDqRnGps6TrjWFHPjGF` READY (PR #19 merge `cab167f`)
- [x] stable Neon staging branch verified 2026-09-29/30 — `staging` `br-late-grass-aoea90yk` (schema-only from `main`, endpoint `ep-gentle-morning-aofsje23`; 0 Production rows; 12 migrations baselined); runtime DB identity proven via `Session` scan-counter probe; no integration side branch created. Neon: 2/10 (`main`, `staging`)
- [x] staging Google OAuth redirect configured and working 2026-09-30 — URI added by Chris to the generic-Preview OAuth client; live sign-in round trip succeeded, User/Account rows landed in Neon `staging`
- [x] ordinary feature/fix/chore auto-deploy suppression verified live 2026-09-30 — post-PR #18 merge, push of ordinary `chore/staging-activation-docs-2026-09-30` (`ed39128`, 00:19:57Z): no Vercel deployment, no commit status, Neon unchanged (`main`, `staging`). History: re-confirmed unchanged 2026-09-28: Vercel build suppression confirmed live (see repo-side line above), but the Neon integration still provisions a preview branch for an ordinary branch regardless — now confirmed on two independent branches (`preview/chore/workflow-ci-only-smoke` 2026-09-27, `preview/chore/staging-activation-2026-09-27` 2026-09-28). No Vercel/Neon-CLI-inspectable branch-pattern setting was found this session; closing this gap needs a Chris dashboard check of the Neon-Vercel integration's own settings. See `docs/receipts/DIBAYAR-STAGING-ACTIVATION-R2-SELECTIVE-NEON-2026-09-28.md`. **2026-09-29:** Gate 5 fix (`git.deploymentEnabled`, PR #18) live-verified on its own ordinary `fix/*` branch: no Vercel deployment and no Neon branch. It covers other ordinary branches only once PR #18 is merged, so this stays partial until then. See `docs/receipts/DIBAYAR-POST-PR17-GATE5-RECONCILE-2026-09-29.md`.
- [x] staging CI path verified LIVE 2026-09-27 — the `staging` branch-creation push triggered run `36323868003`: `lint-typecheck-test`/`e2e-a11y`/`e2e-critical`/`ux-audit` all success, `e2e-cross-browser` skipped by design; no separate empty-commit push was needed since this push already exercised the `push: staging` trigger end to end
**PRE-STAGING TRANSITION COMPLETE (2026-09-30)** — all six conditions have direct evidence (`docs/receipts/DIBAYAR-HOBBY-STAGING-ACTIVATION-2026-09-29.md`). Normal flow applies: feature/fix/chore → `staging`; `staging -> main` release PRs need Chris.
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
- 2026-10-08 (Zero Routine Phase 2B = journey Batch 2B, `chore/zero-routine-regression-phase2b-2026-10-08`, PR #32): test/fixture/CI/docs only, no `src/` change. Real now: INV-PDF-01, PUB-05, PUB-06 (clicked downloads, `pdftotext`, bank details edited first, owner/recipient text equal), DEAL-CREATE-06, SET-04, HOME-01 (new `income-boundaries` overlay), AUTH-02 (redirect to Google read, never followed), SHARE-04, INV-DUE-05 (desktop Chromium; Jakarta and Honolulu browsers). DEAL-CREATE-07 → partial (deadline picker manual), A11Y-01 and INV-DUE-06 stay partial. Real 65/94 (69.1%, was 56), P0 28/30, outstanding P0/P1 5 (was 13); `--require-results` 113/0. CI: poppler in E2E jobs, manual-dispatch `journey-coverage-full` (not scheduled, no threshold). 7 negative controls caught (the first only after tightening the PDF helper). New **FIND-08** (low, open): recipient page/PDF show the due date only with payment terms. Disclosed: a draft AUTH-02 test loaded Google's authorization page (no sign-in). Critical 177/0, full 193/0; `@visual` 9/9 local = clean staging on the same host. Receipt `DIBAYAR-ZERO-ROUTINE-REGRESSION-PHASE2B-2026-10-08.md`.
- 2026-10-08 (FIND-07 fix, `fix/expired-share-reminder-2026-10-08`, PR #31, squash-merged `979c3ec` 2026-10-08): `getShareState` reported an expired share as active, so invoice detail showed "Tautan aktif sampai <past date>" and sent the dead link. Owner share state is now inactive / active / expired (one `isShareExpired` rule; expired path never leaves the server; reads never write). Detail shows "Tautan berbagi sudah tidak berlaku." + **Buat tautan baru** (ID + EN) and sends via `POST /share/ensure`; `POST /share` unchanged. New `expired-share.spec.ts` (5 journeys, chromium + mobile); helpers in `e2e/support/share-links.ts`; unit 944/944; 4 negative controls caught. Coverage totals unchanged (56/94, outstanding 13). Kept: remembered legacy link sent without asking the server. Critical 157/0, full 169/0; `@visual` 9/9 local host drift. Local test DB schema re-applied after a host restart. A generated Prisma backup dir was committed by mistake and untracked in a follow-up commit (squash-merge keeps it out). Receipt `DIBAYAR-FIND07-EXPIRED-SHARE-REMINDER-FIX-2026-10-08.md`.
- 2026-10-07 (FIND-05 fix, `fix/reminder-share-link-reuse-2026-10-07`, PR #30, merged `e498ad5` 2026-10-07): Beranda **Kirim pengingat** called the rotating `POST /share`, so an already-sent link 404'd. Now `POST /share/ensure` → `ensureShare()`: reuse when unexpired and path recoverable (nothing written, expiry not extended), else issue a new link; `POST /share` unchanged, Regenerate still rotates. New `reminder-share-link.spec.ts` (reuse, repeat, no share, expired, Regenerate) on chromium + mobile; opt-in `follow-up-expired-share` fixture; unit 929/929. 3 negative controls caught. Coverage totals unchanged (56/94, outstanding 13). Replaced expired link shows not-found, not expired (one share row per invoice). New **FIND-07** (open): invoice detail shows an expired share as active and sends it. Critical 147/0, full 159/0; `@visual` 9/9 local host drift. Receipt `DIBAYAR-FIND05-REMINDER-SHARE-LINK-REUSE-2026-10-07.md`.
- 2026-10-06/07 (FIND-04 fix, `fix/whatsapp-popup-fallback-2026-10-05`, PR #29, merged `ac53043` 2026-10-07): `window.open(..., "noopener")` returns null by spec, so the fallback always showed. Both surfaces now use `src/lib/whatsapp-popup.ts`: blank tab opened inside the click, `opener` cut, navigated via a `rel=noreferrer` link (no Referer; `location.replace` rejected because it leaks the origin), closed on failure. Two `test.fail()` tests → positive; new real Chromium blocker spec (`--block-new-web-contents`). HOME-03, INV-WA-02 → real; real 56/94, outstanding P0/P1 13. 3 negative controls caught. Host reboot wiped the first gate run and the test DB schema; migrations re-applied locally and gates rerun (critical 137/0, full 149/0). Firefox intermittent failures on 10-06 not reproduced, not root-caused. Receipt `DIBAYAR-FIND04-WHATSAPP-POPUP-FALLBACK-FIX-2026-10-06.md`.
- Older entries (through 2026-10-04) live in full in `DAILY_LOG.md` per the 3-day retention rule; nothing was dropped, only relocated out of this file.

## approvals
pending_from_chris: [2026-10-03] Merge authorization for the Git-safeguards PR into `staging`; run `scripts/git-safeguards/install-hooks.sh` in any Dibayar clone outside ALPHA; optional read-only deploy key / off-host encrypted backup copy (see `docs/GIT-SAFEGUARDS-AND-BACKUPS.md`). [2026-09-30] Staging activation packet closed (see receipt `DIBAYAR-HOBBY-STAGING-ACTIVATION-2026-09-29.md`). Optional: the OAuth client also lists `http://localhost:3103` and `http://localhost:3001` callbacks beyond the three-URI policy in `docs/DEVELOPMENT-WORKFLOW.md` — keep (document) or remove. [2026-09-30] Merge authorization for the M4 kickoff PR into `staging` (it also adds the explicit moderated-session clause to `DEPLOYMENT.md` "Preview and staging policy", closing the old §3.1 question); recruit/schedule Creator 01–05; run the first moderated session. [2026-09-20, still open] Confirm whether Production's no-Vercel-SSO edge reachability is intentional; decide recipient public-access policy; M4 go/no-go after ≥5 sessions; ratify or revise the three M4 hypotheses from session evidence.
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval (Phases 4–6, unchanged). PR #13/#14/#15 all merged on Chris's explicit authorization or direct action. PR #16 and PR #17 merged by `crh` (2026-09-27 and 2026-09-28). PR #18 merged (2026-09-29). PR #19 (`main -> staging` sync) merged 2026-09-29.

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
1. Chris: review/merge PR #32 (Zero Routine Phase 2B) into `staging` (receipt `DIBAYAR-ZERO-ROUTINE-REGRESSION-PHASE2B-2026-10-08.md`); decide FIND-01, FIND-06, FIND-08 (recipient due date without payment terms); decide whether `compose.yml` (untracked) should be committed and whether agents may start the test DB; read-only Production count of out-of-range `Invoice.dueDate`/`Deal.deadline` (PR #26 receipt §9).
2. MAN-DUE-01 on a real Android Chrome phone and a real iPhone Safari against staging (INV-DUE-03, the last outstanding P0); MAN-SHARE-01, MAN-WA-01 (incl. the new link-reuse step) on phones.
3. Zero Routine Phase 2C (separate PR): schedule `journey-coverage-full` after green manual runs; A11Y-01 remaining states; AUTH-02 English CTA; Batch 3 (P2 navigation/resilience). Watch the scheduled `e2e-cross-browser` run for P2-2; M4 creator validation (needs Chris).
