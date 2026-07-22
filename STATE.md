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
day_count: 8
repo_url: git@github.com:crh/dibayar.git
prod_url: https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/
last_deploy: 2026-07-22 — design-system Preview `dpl_D3jMNsrSF2tETo6t4414VRM3oM77` / `https://dibayar-4ue6es7ll-kenji-iwakura.vercel.app` is READY from `10f1d20`; stable branch alias updated and authenticated 390×844 Chrome MCP smoke passed. Production untouched; no public/non-SSO access enabled.
build_status: green
latest_validation: 2026-07-22 final design-system tree at `10f1d20`: full Vitest suite 31 files / 316 tests passed; lint, typecheck, Prisma validate/generate, production build, and diff check passed. Authenticated stable-Preview smoke at 390×844 returned `/dashboard` HTTP 200 with clean console and corrected English empty-state copy.
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel
vercel_project: https://vercel.com/kenji-iwakura/dibayar (Chris-confirmed; linked to github.com/crh/dibayar)

## now
current_milestone: M3 — Payment Chasing — COMPLETE. Phase 1 design-system pass is technically closed on protected Preview; Phase 1→2 transition, Production deployment, public/non-SSO recipient access, and M4 creator validation remain Chris-gated.
active_branch: hermes/design-system
latest_feature_commit: `10f1d20` fix(ui): localize English dashboard empty states; design-system implementation begins at `f71ed98`; pushed to `origin/hermes/design-system`.
remote_feature_branch: origin/hermes/design-system contains feature commit `10f1d20`; source branch `hermes/m3-chasing` remains unchanged
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

open_blockers: No technical blocker remains on the design-system protected Preview. Chris-gated decisions remain: (1) Phase 1→2 transition and M4 creator-validation go-ahead, (2) Production deployment, (3) public/non-SSO recipient access for share links. Email remains a separate product decision. The 7-day due-soon window is provisional and needs creator feedback. Monthly income uses invoice `createdAt` because no `paidAt` field exists; PPh values are estimates, not tax filing calculations.

## recent_signal_findings
- No external signal check recorded.

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-22: Phase 1 design-system protected-Preview blocker resolved without exposing secrets. Branch-scoped OAuth/Auth.js values and the isolated Neon `DATABASE_URL` were corrected; all 5 checked-in Prisma migrations were applied to `preview/hermes/design-system` and `prisma migrate status` reported up to date. Stable branch alias authenticated successfully. A 390×844 smoke found two Indonesian strings leaking into English mode; TDD evidence was RED 1 failed/13 passed, GREEN 14/14, followed by full 31-file/316-test and lint/typecheck/Prisma/build/diff gates. Fix `10f1d20` is pushed; Vercel deployment `dpl_D3jMNsrSF2tETo6t4414VRM3oM77` is READY and the final authenticated mobile smoke returned `/dashboard` 200 with clean console. Production/public access/M4 were not advanced.
- 2026-07-19 (pre-M3 security review, docs/review-only, no source/test edits, no commit/push): Chris requested a security review before M3 starts. Findings, all recorded in SECURITY.md: (1) output escaping/URL construction — zero hits for `dangerouslySetInnerHTML`/`innerHTML`/`eval(`/`new Function`; 10 href/src/action assignment sites and 11 URL/query construction sites inventoried, all fixed internal paths or server-generated IDs/tokens, no unsafe user-controlled href or `wa.me` path found; a URL-safety rule and href scheme allowlist are now documented for M3's WhatsApp links. (2) CSRF — same-origin check (`src/lib/request-origin.ts`, new file) is now wired into all 5 deal/invoice mutation handlers (`POST`/`PATCH`/`DELETE` on `/api/deals` and `/api/invoices`); focused RED (15 failed/46 passed) → GREEN (61/61 passed) confirms the fix. (3) Personal data minimization — a 40-field census across all 9 schema models found nothing to delete but flagged `Deal.contactWa` (stored, unused by current M2) and `User.image` (not needed by current invoicing UI) for a future decision. (4) PDF rendering — structurally reviewed (`@react-pdf/renderer` `Text` children, not HTML; field bounds and `contactWa` exclusion confirmed) but control-character/long-string library behavior remains an open, undisclaimed caveat. (5) Public exposure — confirmed the unauthenticated share routes expose only `brand`/`scope`/invoice number/`subtotalIdr`/withholding-tax label/`status`/`dueDate`/issuer name, nothing else. No schema/migration/dependency/deployment/Vercel/database/cron change, and no M3/reminders/WhatsApp-sending/income-summary feature work, was done this run.
- 2026-07-19 (audit correction, later same day): `bc732a8`'s DAILY_LOG entry claimed the DEPLOYMENT.md §4 residual-risk bullets on expiry had been "updated to match" the verified-applied migration state; they had not — both bullets still called `53032e3` "not yet pushed or deployed" and named `5064e70` as the deployed commit. Ground truth for this run: `origin/hermes/m2-invoice` is `bc732a8` (includes `53032e3`); protected Preview `dpl_HGimfRd7RKdmZwDgpABCeo5ZgU36` is READY with `gitSource.sha`/`meta.githubCommitSha` `bc732a8b777be966dc3978ce3c2d3488900a82a1` — expiry-aware code is pushed and deployed on protected Preview; the schema migration remains isolated-Preview-only, Production untouched. Corrected the two §4 bullets and swept DEPLOYMENT.md/SECURITY.md/STATE.md for the same stale-pointer pattern: found and corrected 3 additional current-state passages (DEPLOYMENT.md current-status list, SECURITY.md Known-gaps top entry, STATE.md's `last_deploy`/`latest_feature_commit`/`remote_feature_branch`/`latest_deployment_status.preview` fields) by appending superseding entries rather than rewriting history. `bc732a8`'s own DAILY_LOG entry is left unmodified as the historical record of the inaccurate claim. No source/schema/migration/dependency/deploy/Vercel/database/cron/public-access/Production/M3 change made; nothing committed or pushed by this run.
- 2026-07-19: Migration `20260719075600_invoice_share_expiry` applied to the isolated Preview database (`preview/hermes/m2-invoice`, database `neondb`) via the Neon SQL Editor, visibly scoped to that branch/database. Preflight `expires_at_exists=false`, `migration_finished=false`; exact checked-in migration SQL ran successfully in one transaction; postflight confirmed `InvoiceShare.expiresAt` is `timestamp without time zone`, nullable, and `_prisma_migrations` shows `20260719075600_invoice_share_expiry` `finished=true`, checksum `05fbf7a79269cf4420dfea84d2114bd69ff3137215f998dee077e75275f4df2e`. This supersedes the "generated only, NOT applied" wording in the Tasks 2–4 entry immediately below — that entry remains as the historical record of that point in time. Expiry code is pushed in `58eed07`; latest protected Preview `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` is Ready. Production untouched; no public/non-SSO access enabled; neither pending Chris decision made or implied made.
- 2026-07-19: Governance closeout Tasks 2–4 (Chris-requested 2026-07-18). Task 2 (share-link expiry) was already committed locally at `53032e3` before this closeout: `InvoiceShare.expiresAt` (nullable), 90-day provisional default on create/regenerate, uniform-404 for expired tokens alongside unknown/revoked. Migration `20260719075600_invoice_share_expiry` generated only — explicitly NOT applied to any database, per this task's constraint. Tasks 3–4 are docs-only: DEPLOYMENT.md gained a decision-ready public/non-SSO access brief (routes, accurate Vercel Deployment-Protection-Exceptions/OPTIONS-Allowlist/Bypass-for-Automation mechanics with citations, edge-exposure scope, residual risk, post-enable curl verification, rollback) with no Vercel setting touched; SECURITY.md gained a distributed-rate-limit trigger note naming the in-memory/per-instance limiters and the two conditions (public/non-SSO access enabled, or multi-instance sustained traffic) that require moving to a shared store. Neither pending Chris decision (Production deployment, public/non-SSO access) was made or implied made by this entry.
- 2026-07-19: Applied Chris's 2026-07-17 Focus amendment. Focus now measures whether work stayed planned or explicitly requested; task volume is not scored. Historical DAILY_LOG scores remain unchanged. Thresholds, Gate E, and cron-guard code are unchanged. Today's Task 1 entry scores no dimension 0; unattended cron awaits a fresh guard check after commit.
- 2026-07-18: M2 explicitly accepted; both ROADMAP.md M2 items marked `[x]`. Basis: `85a4f6a` (share-link + stage controls) and `5064e70` (mutation hardening) both committed and pushed; `origin/hermes/m2-invoice` HEAD == local HEAD == `5064e70`. Isolated Preview migration `20260717090000_invoice_share` applied. Protected Preview `dpl_JBQfD2wYbjuDhb81t4GrYyjLAmBo` (`5064e70`) READY; prior `dpl_3XePMMPAs9tSBydhmPYNQ687QSFZ` (`85a4f6a`) also READY, same stable alias, both Vercel-SSO protected. Full authenticated Chrome E2E on the `85a4f6a` deployment passed: dashboard stage transition, invoice creation, share create/regenerate/revoke, recipient page, public JSON/PDF privacy headers, old/new-token 404 invalidation; cleanup returned disposable deal/invoice/share counts to 0/0/0; browser console clean; mobile Lighthouse Accessibility/Best Practices/SEO all 100. A later "share panel stuck loading" report was diagnosed and found not reproducible — the code already handles the `{ active: false }` transition correctly; a post-`5064e70` browser screenshot (inspected by Hermes, not run by Claude) confirms the working active-share state. Excluded from this acceptance, separately gated and undecided: Production deployment, public/non-SSO recipient access. The unrelated cron NO-GO (today's Focus 0/2) is not an M2 blocker. Full detail: DAILY_LOG "Day 1 M2 acceptance and documentation reconciliation — 2026-07-18".
- 2026-07-18 (earlier same day, superseded by the above): Task F+G final pre-commit review passed (dashboard 7/7, share/public 37/37, full suite 27 files/223 tests, lint/typecheck/build/prisma/cron-guard/diff-check all green). The "uncommitted/unpushed/undeployed" and "M2 NOT accepted" language recorded at that point has since been superseded by the commit/push/migration-apply/deploy/E2E chain above. Full detail: DAILY_LOG "Day 1 Task F+G — final pre-commit review disposition — 2026-07-18" and the earlier Task F entries.
- 2026-07-17: Chris approved item 1 (push 8 M2 commits + protected Preview redeploy) and separately approved option A for share-link scope; both executed and closed same day. Full detail: DAILY_LOG "Day 1 Task C/D/E/F" entries.

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
preview: design-system deployment `dpl_D3jMNsrSF2tETo6t4414VRM3oM77` / `https://dibayar-4ue6es7ll-kenji-iwakura.vercel.app` from `10f1d20` is READY; stable alias `https://dibayar-git-hermes-design-system-kenji-iwakura.vercel.app` is Vercel-SSO protected. OAuth, isolated Preview database, migrations, authenticated dashboard, 390×844 layout, bilingual empty-state copy, and clean console verified. Production untouched; no public/non-SSO access enabled.
production: URL reachable; Vercel Authentication protected; no new Production deployment this run.
smoke: latest 2026-07-22 authenticated 390×844 Chrome MCP smoke passed on the stable design-system alias; `/dashboard` returned 200 and the console was clean. Earlier M2 full owner/recipient E2E remains recorded in DAILY_LOG.

## next_3_tasks
1. Get Chris's approval to transition Phase 1→2 and begin M4 validation with 5 Indonesian creators — not started.
2. Get Chris's separate Production deployment decision — not started.
3. Get Chris's separate public/non-SSO recipient share-link access decision — decision brief available in DEPLOYMENT.md; decision not made.
