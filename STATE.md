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
last_deploy: 2026-07-23 (relayed, Hermes) — the uncommitted `hermes/design-system` tree was manually deployed to an ephemeral protected Vercel Preview, READY at `https://dibayar-hgt0dgt4r-kenji-iwakura.vercel.app`, but could NOT complete Google OAuth (Google 400 `redirect_uri_mismatch` on its exact callback); no OAuth/Vercel config changed; Production unchanged. Prior: 2026-07-22 design-system Preview `dpl_D3jMNsrSF2tETo6t4414VRM3oM77` / `https://dibayar-4ue6es7ll-kenji-iwakura.vercel.app` READY from `10f1d20`, stable branch alias updated, authenticated 390×844 smoke passed. No public/non-SSO access enabled.
build_status: green (local uncommitted-tree gates only; see latest_validation)
latest_validation: 2026-07-23 (relayed, Hermes) local gates on the dirty `hermes/design-system` tree (11 intended source/test files): lint PASS; typecheck PASS; `npm test` 32 files / 338 tests PASS; build PASS; `npx prisma validate` PASS; `git diff --check` PASS. This is local implementation evidence only, NOT evidence the stable branch alias contains this code. Prior 2026-07-22 at `10f1d20`: 31 files / 316 tests, lint/typecheck/Prisma/build/diff all passed.
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M3 — Payment Chasing — COMPLETE. Phase 1 design-system pass is NOT cleanly closed: 2026-07-23 authenticated Chrome-MCP UAT on the stable branch alias exposed 3 functional defects (draft due-date inheritance, share-link reload, WhatsApp CTA coherence) that must be fixed and re-verified before these flows are demo-ready. Phase 1→2 transition, Production deployment, public/non-SSO recipient access, and M4 creator validation remain Chris-gated.
active_branch: hermes/design-system
latest_feature_commit: `4da297f` [verified] fix locale consistency across creator flows — the latest commit pushed to `origin/hermes/design-system`, committed 2026-07-22 immediately after `1ee7304` (docs(ui): close design preview verification); HEAD and `origin/hermes/design-system` were synchronized at `4da297f` before the current dirty tree. Prior: `10f1d20` fix(ui): localize English dashboard empty states; design-system implementation begins at `f71ed98`. The current 2026-07-23 UAT-fix work (11 intended source/test files) remains uncommitted/unpushed on top of `4da297f`; `4da297f` addresses locale-consistency behavior only and does not establish that the 3 open UAT defects are fixed.
remote_feature_branch: origin/hermes/design-system is synchronized with local HEAD at `4da297f`; source branch `hermes/m3-chasing` remains unchanged. The uncommitted UAT-fix tree on top of `4da297f` is not yet committed or pushed.
completed_milestones:
  - Phase 0 discovery closed
  - M0 bootstrap and protected production deployment complete
  - M1 auth + deal pipeline accepted on protected Preview
  - M2 invoice (generation, share-link, status tracking) accepted on protected Preview 2026-07-18 — Production/public-access separately gated, not yet decided

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

open_blockers: Technical blocker on the design-system flows (relayed 2026-07-23 Chrome-MCP UAT on the stable branch alias; Hermes independently hard-reloaded and confirmed): (a) draft invoice INV/2026/07/004 did not inherit the deal deadline as its due date — detail showed "Due: Not set"; (b) share link lost its URL and Copy Link control after reload though the UI still claimed the link active with expiry (owner share GET lacks a reusable path on reload); (c) WhatsApp Open stayed disabled with "Create a sharing link first…" while sharing was active and a contact number existed (client state coherence, not a missing link). Note the distinction: (i) local uncommitted implementation gates are green, (ii) the ephemeral Preview is READY but OAuth-blocked (Google 400 `redirect_uri_mismatch` on its exact callback), (iii) the stable-alias authenticated UAT exposed the 3 defects above. Next technical action: fix the 3 defects in code, rerun gates, deploy the corrected artifact to a stable OAuth-configured Preview alias, then rerun UAT before describing these flows as demo-ready. Separate and unchanged Chris-gated decisions: (1) Phase 1→2 transition and M4 creator-validation go-ahead, (2) Production deployment, (3) public/non-SSO recipient access for share links. Email remains a separate product decision. The 7-day due-soon window is provisional and needs creator feedback. Monthly income uses invoice `createdAt` because no `paidAt` field exists; PPh values are estimates, not tax filing calculations.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-23: Design-system UAT reconciliation (docs-only; branch `hermes/design-system` tree uncommitted/dirty, 11 intended source/test files, no schema/migration/env/secret/Vercel/deploy file changed). Relayed evidence — Hermes ran final local gates on the dirty tree: lint PASS, typecheck PASS, `npm test` 32 files / 338 tests PASS, build PASS, `npx prisma validate` PASS, `git diff --check` PASS (local implementation evidence only, NOT proof the stable alias contains this code). Hermes manually deployed the uncommitted tree to an ephemeral protected Vercel Preview, READY at `https://dibayar-hgt0dgt4r-kenji-iwakura.vercel.app`; it could not complete Google OAuth (Google 400 `redirect_uri_mismatch` on its exact callback); no OAuth/Vercel config changed; Production unchanged. Claude Code 2.1.197 invoked as `claude-opus-4-8` with the local Chrome MCP server ran authenticated UAT on the stable alias `https://dibayar-git-hermes-design-system-kenji-iwakura.vercel.app/dashboard` (demo/UAT, not release/sign-off); Hermes independently hard-reloaded and visually confirmed the central defects. Findings: (1) PASS existing fixture "UAT Demo 20260723-044611" persisted through reload (IDR 7,500,000; 31 Jul 2026; Deal→Invoice stage transition persisted). (2) FAIL draft INV/2026/07/004 showed IDR 7,500,000 but its due date was not inherited from the deal deadline ("Due: Not set"). (3) PARTIAL/FAIL share creation worked then lost its URL and Copy Link control after reload though the UI still said the link active with expiry (owner share GET lacks a reusable path on reload). (4) FAIL WhatsApp Open stayed disabled with "Create a sharing link first…" while sharing was active and a contact number existed (client state coherence). (5) UX feedback only, not a release blocker: English is the default and the DRAFT badge stays untranslated in Indonesian mode; Indonesian formatting is otherwise correct (Rp/dot separator, Indonesian dates). UAT data intentionally changed: reused the existing fixture (no new deal), moved it Deal→Invoice, created draft INV/2026/07/004, created one active share link; no WhatsApp opened/sent, none marked sent/paid, no revoke/delete, no cleanup; no share token/path recorded. Boundaries: demo/feedback evidence only — no release acceptance, no Phase 1→2 transition, no M4, no Production, no public/non-SSO access, and no commit/push/migration/config change occurred.
- 2026-07-22: Phase 1 design-system protected-Preview blocker resolved without exposing secrets. Branch-scoped OAuth/Auth.js values and the isolated Neon `DATABASE_URL` were corrected; all 5 checked-in Prisma migrations were applied to `preview/hermes/design-system` and `prisma migrate status` reported up to date. Stable branch alias authenticated successfully. A 390×844 smoke found two Indonesian strings leaking into English mode; TDD evidence was RED 1 failed/13 passed, GREEN 14/14, followed by full 31-file/316-test and lint/typecheck/Prisma/build/diff gates. Fix `10f1d20` is pushed; Vercel deployment `dpl_D3jMNsrSF2tETo6t4414VRM3oM77` is READY and the final authenticated mobile smoke returned `/dashboard` 200 with clean console. Production/public access/M4 were not advanced.
- 2026-07-21: Phase 1 design-system pass (branch `hermes/design-system`, from `hermes/m3-chasing` HEAD `c826a58`): design foundation (extended tokens, fonts, metadata) and shared primitives (`design-system.tsx`, `haptics.ts`), plus UX surfaces (dashboard hierarchy/pipeline, invoice detail, public invoice, landing/sign-in). Verification: 31 files / 313 tests passed; lint, typecheck, build, and `git diff --check` passed. Protected Preview deployed READY, but authenticated smoke was initially blocked by the Preview branch environment missing `AUTH_SECRET`/`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`/`DATABASE_URL` (resolved 2026-07-22, see below). No Production, public/non-SSO access, migration, or M4 change.

## approvals
pending_from_chris: Production deployment decision; separate public (non-SSO) access decision for recipient share links; M4 validation/go-no-go; confirm or revise provisional 7-day due-soon window and invoice-issue-date income basis.
pending_external: none

granted_by_chris: standing autonomous milestone execution, code-fix, and protected Preview redeployment approval; M2 share-link option A + Preview-only rollout execution (2026-07-18, "Please continue what you think the best") — executed in full (commit/push/migration-apply/deploy/E2E, see decisions above); M2 documentation reconciliation + explicit acceptance closeout (2026-07-18, "continue") — this task, completed; M3 go-ahead for all three ROADMAP items, including one-tap WhatsApp follow-up (2026-07-19 task-set instruction).

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## latest_deployment_status
project_linkage: confirmed by Chris; Google Cloud OAuth client managed through logged-in Chrome MCP session
preview: 2026-07-23 (relayed) — the uncommitted `hermes/design-system` tree was manually deployed to an ephemeral protected Vercel Preview, READY at `https://dibayar-hgt0dgt4r-kenji-iwakura.vercel.app`, but Google OAuth could not complete there (400 `redirect_uri_mismatch` on its exact callback); no OAuth/Vercel config changed. The stable authenticated alias `https://dibayar-git-hermes-design-system-kenji-iwakura.vercel.app` (Vercel-SSO protected) was used for the demo/UAT. Prior 2026-07-22 deployment `dpl_D3jMNsrSF2tETo6t4414VRM3oM77` / `https://dibayar-4ue6es7ll-kenji-iwakura.vercel.app` from `10f1d20` is READY. Production untouched; no public/non-SSO access enabled.
production: URL reachable; Vercel Authentication protected; no new Production deployment this run.
smoke: 2026-07-23 authenticated Chrome-MCP UAT on the stable design-system alias (relayed; Hermes independently hard-reloaded and confirmed) exposed 3 functional defects — draft-invoice due-date not inherited ("Due: Not set"), share link lost URL/Copy control after reload, WhatsApp Open disabled despite active share + contact; existing-fixture persistence PASSED. This is NOT a clean smoke; fixes are required before these flows are demo-ready. Earlier 2026-07-22 390×844 smoke on the same alias returned `/dashboard` 200 with clean console; earlier M2 full owner/recipient E2E remains recorded in DAILY_LOG.

## next_3_tasks
1. Fix the 3 design-system UAT defects in code (draft-invoice due-date inheritance from deal deadline; owner share GET reusable-path-on-reload; WhatsApp CTA client-state coherence), rerun all gates, deploy the corrected artifact to a stable OAuth-configured Preview alias, then rerun authenticated UAT before calling these flows demo-ready — not started.
2. Get Chris's approval to transition Phase 1→2 and begin M4 validation with 5 Indonesian creators — not started.
3. Get Chris's separate Production deployment and public/non-SSO recipient share-link access decisions — brief available in DEPLOYMENT.md; not made.
