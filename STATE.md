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
build_status: `origin/staging` = `3e410da` (merge of PR #63, 2026-10-18; PR #62 merge `63b9e3c` before it). `main` = `308a339` (unchanged since PR #23, 2026-10-03). Verified from Git 2026-10-18. Staging alias serves `3e410da` (deployment `dpl_BSktgprFNbC812RpFkabPWbnCFSp`, Preview, Ready, 14 migrations none pending; `20261018000000_invoice_document_snapshot` applied to Neon `staging` by the `63b9e3c` build, verified from the build log). Hosted pages not opened (SSO). Production not inspected. Staging activation detail: `docs/receipts/DIBAYAR-HOBBY-STAGING-ACTIVATION-2026-09-29.md`.
latest_validation: 2026-10-01 — M4 internal dry run on staging (`fb28c30`): deal capture/stage move/invoice read/summary/due-soon PASS; share+WhatsApp PASS at API level (UI not browser-verified: occluded automation window); **gap: no UI PPh picker**. Demo data seeded for Oktober 2026 (net Rp 8.045.000). Branch gates: lint/typecheck/test 780/780/vercel-ignore 48/build pass. Receipt `docs/receipts/DIBAYAR-M4-STAGING-KICKOFF-2026-09-30.md`. Earlier: 2026-09-30 — staging smoke PASS (Google OAuth round trip, `/`, `/deal`, `/invoice`, `/pengaturan`, no console errors, no Production host references); staging runtime DB identity proven = Neon `staging`. 2026-09-29 local gates on `d9fef85`: lint/typecheck/test (771/771)/`test:vercel-ignore-build`/build all pass; PR #19 CI green.
staging_url: https://dibayar-git-staging-kenji-iwakura.vercel.app (Vercel Preview branch alias, Deployment Protection SSO on)
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: **M4 creator validation — prep on staging (2026-09-30).** Environment = staging (`staging_url`), moderated sessions, synthetic data via `npm run m4:demo-data`. Kit: `docs/validation/M4-READINESS.md`; tracker: `docs/validation/M4-SESSION-TRACKER.md`; receipt: `docs/receipts/DIBAYAR-M4-STAGING-KICKOFF-2026-09-30.md`.
active_branch: none in flight. 2026-10-18: PR #62 (Decision A invoice snapshots, CAP-INV-12) and PR #63 (#55 deal edit + FIND-11) merged to `staging`, CI green on exact heads, all review threads resolved. #55 stays open for the physical-phone check (MAN-DEAL-02). Release: **NO-GO** on the manual gates. Receipt: `docs/receipts/DIBAYAR-DECISION-A-SNAPSHOT-AND-DEAL-EDIT-2026-10-18.md`.
latest_feature_commit: `308a339` on `main` (PR #23 release merge, 2026-10-03).
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
- 2026-10-18 (Decision A + #55, PRs #62 and #63, merged to `staging`): Chris approved Decision A in the #55 comment of 2026-10-18 (staging only; B #56 and C #57 still NEEDS_OWNER_APPROVAL). An invoice's deal/Settings text (brand, contact name, scope, payment terms, issuer, bank) is frozen into `InvoiceSnapshot` at its first move out of DRAFT or first share link, in the same transaction; owner PDF, `/i/` page and public PDF read only the snapshot; UPDATE rejected by a DB trigger; backfill of sent/shared invoices labelled `RECONSTRUCTED_ON_MIGRATION` (current values, not originals). Number, subtotal, PPh, issue and due date stay invoice-owned; the due-date editor (MAN-DUE-01) is kept, its post-issue policy belongs to Decision B. #55: Ubah deal on every card and on deal detail, changed fields only, never a status, read-back before success, discard confirmation, invoice note. FIND-11 fixed (null/blank clears; deal detail contact name reads back); fee no longer coerces null/blank to Rp 0. CI: #62 `c0d30da` 39091936114, #63 `abdb60a` 39095099575 (critical 326 passed), full journeys green; `test:snapshot-db` 15/15 in CI. REQUIRED covered 31/35. Migration applied to Neon `staging` (build log); Production untouched. MAN-DEAL-02 (new) and the other manual gates **NOT_RUN**.
- Older entries (through 2026-10-16) live in full in `DAILY_LOG.md` per the 3-day retention rule; nothing was dropped, only relocated out of this file.

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
1. Chris: on staging `3e410da`, run MAN-DEAL-02 (edit a saved deal, physical iPhone Safari + Android Chrome) and MAN-DUE-01 (P0) on real phones; MAN-AUTH-01; MAN-REL-01. Then close #55 if MAN-DEAL-02 passes.
2. Chris: decide Decision B (#56), including whether a sent invoice's due date stays editable, and Decision C (#57); run the FIND-10 read-only Production query. Note for the next `staging -> main` release: it applies the snapshot migration and backfill to Production (reconstructed snapshots for already sent/shared invoices).
3. Then the `staging -> main` release PR with Gate F on the final SHA; #58/#59 (P2) can follow independently.
