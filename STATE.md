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
last_deploy: 2026-07-24 (relayed, Hermes) — commit `8c35390` (`fix(invoice): preserve owner share link in session`, on top of `ebf8f1a` `fix(design): resolve invoice UAT workflow defects`) pushed to `origin/hermes/design-system`; local/tracking/remote refs equal `8c353909004ba638d7e8fb60c386585edf83f105`; worktree clean. Vercel Preview `dpl_vYFBgjb65J5aCmD8cMRuWP5YwnFx` READY at that commit; stable protected branch alias `https://dibayar-git-hermes-design-system-kenji-iwakura.vercel.app`. Production unchanged; no public/non-SSO access enabled. Supersedes the 2026-07-23 ephemeral OAuth-blocked Preview entry (no longer the operative deploy).
build_status: green (Hermes independent, 2026-08-06) — Phase 0 local gates: T-03 full `npm test` PASS (51 files / 519 tests), lint PASS, typecheck PASS, `npx prisma validate` PASS, production build PASS; T-00–T-02 preceding gates remain recorded in the implementation log.
latest_validation: 2026-08-06 (Hermes independent) — T-03 production HTTP route matrix 8/8 on the approved local database: real `/dashboard` 302 with query drop, `/masuk` 200/no app menu, protected route redirects, legacy invoice compatibility, and invalid public token 404. No Preview/Production deployment or public-access change.
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: UX implementation Phase 0 foundations T-00–T-03 — COMPLETE locally and independently reviewed. T-04 is next. Phase 1→2 transition, Preview/Production deployment, public/non-SSO recipient access, and M4 creator validation remain Chris-gated.
active_branch: hermes/ux-phase-0
latest_feature_commit: T-03 `2c42a28` scaffold owner routes and preserve legacy redirects; local only, not pushed or deployed.
remote_feature_branch: no Phase 0 push performed; `hermes/ux-integration` remains at baseline `8ca6137ea988b57f7a9379b5109b4dc3516290ee`.
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview
  - M2 invoice (generation, share-link, status tracking) accepted on protected Preview 2026-07-18 — Production/public-access separately gated, not yet decided
  - UX implementation Phase 0 T-00 baseline, T-01 locale/formatters, T-02 Grid primitives, and T-03 route scaffolding accepted locally on `hermes/ux-phase-0`

today_work (Focus measures approved scope, not task volume, from 2026-07-19):
  - Governance catch-up Task 1: apply the Chris-approved Focus amendment and consistency sweep — done
  - Governance catch-up Task 2: share-link expiry implemented/tested and pushed (`53032e3` included in remote `bc732a8`) — done (code)
  - Governance catch-up Tasks 3–4: public-access decision brief (DEPLOYMENT.md) and distributed-rate-limit trigger note (SECURITY.md) — done, docs-only closeout
  - Governance catch-up Task 5: migration `20260719075600_invoice_share_expiry` applied to isolated Preview (`preview/hermes/m2-invoice`, database `neondb`) via Neon SQL Editor, verified by pre/postflight checks and the `_prisma_migrations` checksum; expiry code pushed and protected Preview redeployed READY — done
  - Governance catch-up Task 6 (audit correction): `bc732a8`'s claim of having updated the DEPLOYMENT.md §4 residual-risk bullets was inaccurate — those two bullets still said `53032e3` was "not yet pushed or deployed" and named `5064e70` as the deployed commit, both false now that `origin/hermes/m2-invoice` is at `bc732a8` (includes `53032e3`) and protected Preview `dpl_HGimfRd7RKdmZwDgpABCeo5ZgU36` is READY at that SHA; corrected, plus a 3-file sweep (DEPLOYMENT.md, SECURITY.md, STATE.md) — done, docs-only
  - Pre-M3 security review (Chris-requested; existing-code review plus focused CSRF remediation; no commit/push): output-escaping and URL-construction inventory (zero dangerous-construct hits; 10 href/src/action hits, 11 URL/query hits, all fixed/internal/server-generated) — done; CSRF same-origin protection verified wired into all 5 deal/invoice mutation handlers (RED 15 failed/46 passed → GREEN 61/61 passed) — done; personal-data minimization 40-field census across all 9 schema models, `Deal.contactWa` and `User.image` flagged, none deleted — done; PDF render structural review with an open control-character/long-string caveat — done
  - M3 Task 1: Jakarta-aware due-date attention surface — complete; local gates and authenticated Preview smoke passed
  - M3 Task 2: owner-only contact fetch and one-tap WhatsApp reminder — complete; local gates and authenticated Preview smoke passed
  - M3 Task 3: monthly income summary with Jakarta boundary and explicit PPh estimates — complete; local gates and authenticated Preview smoke passed
  - Phase 1 design-system closeout: Preview branch environment corrected; all 5 Prisma migrations applied to isolated `preview/hermes/design-system`; OAuth and authenticated dashboard smoke passed; 390px English localization leak found, fixed by TDD in `10f1d20`, deployed and re-verified — done
  - 2026-07-23 design-system UAT reconciliation (docs-only, STATE.md + DAILY_LOG.md): recorded relayed local gates green on the dirty tree, an ephemeral Preview that is READY but OAuth-blocked, and a stable-alias Chrome-MCP UAT that exposed 3 functional defects (due-date inheritance, share-link reload, WhatsApp CTA coherence) plus 1 UX-feedback item; no code/commit/push/migration/config change — done (docs)
  - 2026-07-24 design-system UAT closeout (docs-only, STATE.md + DAILY_LOG.md): reconciled all 4 open UAT defects as fixed and verified per relayed evidence (commit `8c35390`, local gates, protected Preview READY, 5/5 authenticated browser UAT, Hermes-confirmed reload); no code/commit/push/migration/config change made by this docs session — done (docs)
  - 2026-07-24 invoice attention follow-up: local uncommitted implementation adds an owner-controlled due-date editor (set/change/clear through same-origin owner-scoped PATCH) and fixes detail-page/WhatsApp raw-status inconsistency via shared Jakarta-aware display-status derivation; Hermes independently ran focused 79/79 tests plus lint/typecheck/full `npm test` 32 files/355 tests/build/`prisma validate`/`git diff --check` PASS; no commit/push/deploy/migration/browser data mutation — pending Chris review and separate commit/push/deploy decision

open_blockers: Phase 0 T-00–T-03 has no unresolved implementation, migration, regression, or independent-review blocker. Still gated: (1) T-04 onward implementation, (2) Preview isolation before any Phase 2 migration/capture, (3) Phase 1→2 transition and M4 creator-validation go-ahead, (4) Production deployment, and (5) public/non-SSO recipient access. Existing product findings remain recorded: small touch targets, including the 21px invoice-detail back link and landing language selector; deal-deletion-with-invoices UX remains deferred. The 7-day due-soon window is provisional; monthly income uses invoice `createdAt`; PPh values are estimates, not tax filing calculations.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-24: Design-system UAT closeout (docs-only; STATE.md + DAILY_LOG.md only, no source/schema/migration/env/secret/Vercel-config file touched, no command run by this docs session). Hermes-supplied evidence cited: commit `8c35390` pushed to `origin/hermes/design-system`, worktree clean; local gates lint/typecheck/build/`prisma validate`/`git diff --check` PASS, full `npm test` 32 files/344 tests PASS, focused UAT suites 54/54 PASS; Vercel Preview `dpl_vYFBgjb65J5aCmD8cMRuWP5YwnFx` READY, stable alias unchanged; Claude Code Sonnet browser-UAT 5/5 PASS closing all 4 defects logged in the entry below (due-date inheritance, share/reload, WhatsApp coherence, locale default + `Draf`); permitted mutation limited to regenerating one disposable fixture's share; Hermes independently hard-reloaded and confirmed. Boundaries: no Phase 1→2, Production, public/non-SSO access, M4, or milestone transition marked approved/completed by this entry.
- 2026-07-23: Design-system UAT reconciliation (docs-only; branch `hermes/design-system` tree uncommitted/dirty, 11 intended source/test files, no schema/migration/env/secret/Vercel/deploy file changed). Relayed evidence — Hermes ran final local gates on the dirty tree: lint PASS, typecheck PASS, `npm test` 32 files / 338 tests PASS, build PASS, `npx prisma validate` PASS, `git diff --check` PASS (local implementation evidence only, NOT proof the stable alias contains this code). Hermes manually deployed the uncommitted tree to an ephemeral protected Vercel Preview, READY at `https://dibayar-hgt0dgt4r-kenji-iwakura.vercel.app`; it could not complete Google OAuth (Google 400 `redirect_uri_mismatch` on its exact callback); no OAuth/Vercel config changed; Production unchanged. Claude Code 2.1.197 invoked as `claude-opus-4-8` with the local Chrome MCP server ran authenticated UAT on the stable alias `https://dibayar-git-hermes-design-system-kenji-iwakura.vercel.app/dashboard` (demo/UAT, not release/sign-off); Hermes independently hard-reloaded and visually confirmed the central defects. Findings: (1) PASS existing fixture "UAT Demo 20260723-044611" persisted through reload (IDR 7,500,000; 31 Jul 2026; Deal→Invoice stage transition persisted). (2) FAIL draft INV/2026/07/004 showed IDR 7,500,000 but its due date was not inherited from the deal deadline ("Due: Not set"). (3) PARTIAL/FAIL share creation worked then lost its URL and Copy Link control after reload though the UI still said the link active with expiry (owner share GET lacks a reusable path on reload). (4) FAIL WhatsApp Open stayed disabled with "Create a sharing link first…" while sharing was active and a contact number existed (client state coherence). (5) UX feedback only, not a release blocker: English is the default and the DRAFT badge stays untranslated in Indonesian mode; Indonesian formatting is otherwise correct (Rp/dot separator, Indonesian dates). UAT data intentionally changed: reused the existing fixture (no new deal), moved it Deal→Invoice, created draft INV/2026/07/004, created one active share link; no WhatsApp opened/sent, none marked sent/paid, no revoke/delete, no cleanup; no share token/path recorded. Boundaries: demo/feedback evidence only — no release acceptance, no Phase 1→2 transition, no M4, no Production, no public/non-SSO access, and no commit/push/migration/config change occurred.
- 2026-07-22: Phase 1 design-system protected-Preview blocker resolved without exposing secrets. Branch-scoped OAuth/Auth.js values and the isolated Neon `DATABASE_URL` were corrected; all 5 checked-in Prisma migrations were applied to `preview/hermes/design-system` and `prisma migrate status` reported up to date. Stable branch alias authenticated successfully. A 390×844 smoke found two Indonesian strings leaking into English mode; TDD evidence was RED 1 failed/13 passed, GREEN 14/14, followed by full 31-file/316-test and lint/typecheck/Prisma/build/diff gates. Fix `10f1d20` is pushed; Vercel deployment `dpl_D3jMNsrSF2tETo6t4414VRM3oM77` is READY and the final authenticated mobile smoke returned `/dashboard` 200 with clean console. Production/public access/M4 were not advanced.


## approvals
pending_from_chris: Production deployment decision; separate public (non-SSO) access decision for recipient share links; M4 validation/go-no-go; confirm or revise provisional 7-day due-soon window and invoice-issue-date income basis.
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval; M2 share-link option A + Preview-only rollout execution (2026-07-18, "Please continue what you think the best") — executed in full (commit/push/migration-apply/deploy/E2E, see decisions above); M2 documentation reconciliation + explicit acceptance closeout (2026-07-18, "continue") — this task, completed; M3 go-ahead for all three ROADMAP items, including one-tap WhatsApp follow-up (2026-07-19 task-set instruction).

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; no deployment action taken in this Phase 0 run
preview: not used for T-00–T-03 evidence; Preview is non-isolated from Production per current fingerprint check, so Phase 2 migrations/captures remain blocked.
production: untouched; no public/non-SSO access enabled; no Production deployment authorized.
smoke: local production-mode landing and authenticated fixture evidence passed during T-00; T-03 local HTTP route matrix passed 8/8. No remote smoke or public-access claim.

## next_3_tasks
1. T-04 — implement and independently verify the responsive AppShell/top bar/side nav/bottom nav; no Preview/Production deployment.
2. T-05 — make the account menu responsive and focus-safe after T-04 review.
3. Recheck the Preview/Production database fingerprints before any Phase 2 migration or capture; request Chris's Phase 2 acknowledgement only if isolation is proven.
