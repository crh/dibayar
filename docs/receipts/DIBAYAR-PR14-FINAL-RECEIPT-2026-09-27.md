# Dibayar — PR #14 final receipt: Preview fixed, monthly-summary heading corrected (2026-09-27)

Supersedes the mid-flow `DIBAYAR-PR14-PREVIEW-AND-MONTHLY-SUMMARY-REMEDIATION-2026-09-26.md`
(kept as the running record; its §9 covers the same ending in less detail).

**Outcome: PR #14 is green, Preview is READY, and it is merge-ready. Not merged; merge is Chris's call.**

## 1. Starting state (2026-09-26)

- `main` = `origin/main` = `86eff1d` (PR #13 merge).
- PR #14 `codex/m4-invoiced-this-month`, OPEN, head `394bac8`, MERGEABLE, `mergeStateStatus` UNSTABLE (Vercel Preview only).
- Required CI on `394bac8`: run `36221739312` green (`e2e-cross-browser` skipped on PRs by design).
- Vercel Preview `dpl_3mdSyjC3kH93eWk4YkmTdXkCbaJP`: ERROR.
- Left untouched and uncommitted throughout: `src/generated/` (root-owned Prisma output), `docs/receipts/DIBAYAR-M4-NEXT-MOVE-2026-09-26.md`.

## 2. Preview diagnosis

**Classification: `CONFIRMED_ROOT_CAUSE`** (confirmed by intervention, 2026-09-27).

- Failure: `BUILD_FAILED` / "Resource provisioning failed", `integrations.status` `error` in ~1.5 s, `Builds [0ms]`, no logs — i.e. at the Neon integration step, **before** `scripts/vercel-build.sh` ran.
- Hand-off hypothesis (missing per-branch `DATABASE_URL_POSTGRES_URL_NON_POOLING`) was **wrong**: that variable exists project-wide for Preview.
- Cause: Neon project `neon-dijual` (`free_v3`) has `branches_limit` 10 and held exactly 10 branches; none existed for this git branch. Seven were preview branches of merged PRs #7–#13 whose git branches still exist on `origin`.
- Confirmation: Chris deleted the oldest branch (`preview/claude/dibayar-week-2026-09-07`, archived, no PR) and redeployed from the Vercel dashboard; Neon then created `preview/codex/m4-invoiced-this-month` and the deployment went READY. Freeing exactly one branch flipped the result.
- Repo remediation: **none possible or made** — the failure precedes the build.
- Neon capacity afterwards: back at 10/10 immediately, then Chris deleted four more (5 total). Verified read-only: **6/10** (`main` + preview branches for PR #7, #11, #12, #13, #14), 4 free slots.
- Final Preview: `dpl_F2phqqXnFK8qSU35PdYHwaccThg5` READY on `d58c0de`; later commits also Vercel `success`. An unauthenticated request to the Preview URL and to the branch alias returns a 302 to Vercel SSO (protection intact).
- Actions blocked by the auto-mode classifier and therefore performed by Chris, not me: `neon branches delete` and `vercel redeploy`.

## 3. Monthly-summary semantic audit

Verified from `src/lib/income-summary.ts`, `src/components/home/monthly-income.tsx`, and their tests.

| Question | Verified answer |
|---|---|
| Date basis / timezone | `Invoice.createdAt`, Asia/Jakarta calendar month |
| Status filter | every status except `DRAFT` |
| Draft counted? | No |
| Sent / unpaid counted? | Yes |
| Paid counted? | Yes |
| Created last month, paid this month | Counted in the creation month |
| Figure shown | `Σ subtotalIdr − Σ round(subtotalIdr × rate)`, rates NONE 0 / PPh 21 5% / PPh 23 2% — **net of estimated PPh**, not gross |
| Subline | `{month} · {N} invoice lunas` (PAID invoices created this month) |
| Other copy | the `dashboard.income*` keys are unused in `src/` |

| | Indonesian | English |
|---|---|---|
| Original | Net bulan ini | Net this month |
| PR #14 as handed over | Ditagihkan bulan ini | Invoiced this month |
| **Final** | **Net ditagihkan bulan ini** | **Net invoiced this month** |

Rationale: "Ditagihkan bulan ini" implied gross and dropped the net-of-PPh meaning. The final heading keeps both: "ditagihkan" (unpaid counts) and "Net" (PPh already deducted; matches existing "Net estimasi"). No helper line, deliberately — M4 task 4 asks whether creators notice it is net of PPh, and a line would pre-empt the answer. Alternative if Chris prefers: "Invoice bulan ini" + helper "Setelah estimasi PPh; termasuk yang belum dibayar" (adds a visible line and baseline change).

**Calculation, schema, PPh rates unchanged.** The only non-string edit in `src/` is a comment in `income-summary.ts`.

## 4. M4 policy / readiness

- Mode: **moderated Preview** (unchanged). Production/public access untouched.
- **Preview-policy ambiguity — Chris decision still needed.** `DEPLOYMENT.md` "Preview policy": usable "for technical verification only… not announced or shared with users". A moderated creator screen-share is product validation with a prospective user. Packaged as `M4-READINESS.md` §3.1 (Option A allow + wording, Option B other environment). Policy text not changed.
- Still provisional, WAITING FOR PRODUCT DECISION: `DUE_SOON_WINDOW_DAYS = 7`, `DEFAULT_SHARE_LIFETIME_DAYS = 90`, and ratification of the `createdAt` basis. Not touched.
- Checklist (§5), canonical feedback template (§4) and `M4-SESSION-TRACKER.md` preserved; tracker has no PII and was not edited. `users_shown` / `feedback_logged` / `wtp_signals` remain 0.
- M4 Preview blocker (§5/§6) is cleared; a note about periodic Neon pruning remains.

## 5. Validation

Local (on the heading change): `npm run lint` 0 errors / 0 warnings · `npm run typecheck` pass · `npm test` 80 files / 771 tests pass · `npm run build` pass. Later commits were docs/baseline only; those gates were not re-run locally, CI covers them.

Visual: `Update visual baselines` workflow run `36236175674` (success). Only `beranda-desktop`, `beranda-mobile`, `beranda-true-mobile` changed, identical dimensions (1280×720, 390×844); the other six baselines are byte-identical. The 390px render was viewed: heading on one line, nothing else moved.

GitHub CI (all: lint-typecheck-test, e2e-a11y, e2e-critical, ux-audit success; e2e-cross-browser skipped by design on PRs):

| Head | Run | Result |
|---|---|---|
| `394bac8` (start) | `36221739312` | success |
| `d58c0de` | `36236499806` | success |
| `ffc31b6` | `36288082510` | success |
| `87d0b51` (final) | `36289152425` | success |

Superseded runs `36236173560` (`aeb0ee3`, old baselines) and `36236341612` (`000c80e`) were cancelled by me.

Vercel: `aeb0ee3`, `000c80e` and the first `d58c0de` attempt ERROR (same cause); after the Neon branch was freed, `dpl_F2phqqXnFK8qSU35PdYHwaccThg5` READY and Vercel status `success` on `ffc31b6` and `87d0b51`. **Not verified:** Beranda on Preview itself (needs an authenticated, SSO-protected session; none was used). Mobile evidence is the CI-runner screenshot.

## 6. Security / Production

- Production accessed? **No.**
- Production data modified? **No.**
- Production deployment intentionally triggered? **No** (PR not merged).
- Public access changed? **No.** SSO changed? **No.** OAuth changed? **No.**
- Secrets read or printed? **No** — env var names/types only; Neon connection strings never requested.
- External creator contact? **None.**
- External systems I touched, all read-only except as noted: Vercel deployment metadata/env-var names; Neon project and branch metadata; GitHub Actions (dispatched the documented `Update visual baselines` workflow; cancelled two of my own superseded CI runs); pushes to the PR branch, each of which triggered a Preview attempt.
- I deleted nothing in Neon or on `origin` and deployed nothing; Chris ran every delete and the redeploy.

## 7. Git / PR

- PR: https://github.com/crh/dibayar/pull/14 — OPEN, `mergeStateStatus` CLEAN, MERGEABLE, **not merged**. Title/body rewritten to the final behavior.
- Commits on top of `394bac8`:
  - `aeb0ee3` — heading + docs
  - `000c80e` — 3 Beranda `@visual` baselines
  - `d58c0de` — Preview diagnosis docs and receipt
  - `ffc31b6` — Preview READY, root cause confirmed
  - `87d0b51` — Neon 6/10 recorded
- Final head: `87d0b51`. This receipt is not committed (a commit would start another CI/Preview cycle).
- Merging redeploys Production with the new heading.

## 8. Remaining work

- **Scheduled acceptance (P2-2):** 1 of 2, WAITING FOR SCHEDULE. No manual trigger, no cron change.
- **Chris product decision:** 7-day due-soon, 90-day share lifetime, `createdAt` basis; confirm "Net ditagihkan bulan ini".
- **Chris environment/policy decision:** moderated screen-share vs. Preview policy (`M4-READINESS.md` §3.1). Neon housekeeping: prune merged-PR preview branches periodically (or raise the plan) — branches accumulate one per git branch.
- **Recruitment:** NON-CODE, Chris; nothing contacted.
- **Creator-session execution:** NON-CODE; not started; metrics stay 0.
- **Production authorization:** WAITING FOR PRODUCTION AUTHORIZATION; unchanged. Merging PR #14 is the Production-affecting step.
- **Post-session proceed / iterate / pivot:** Chris, after ≥5 real sessions.
