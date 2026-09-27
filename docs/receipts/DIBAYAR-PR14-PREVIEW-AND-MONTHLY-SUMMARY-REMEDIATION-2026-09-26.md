# Dibayar — PR #14 remediation: Preview failure diagnosis and monthly-summary heading (2026-09-26)

Status (updated 2026-09-27, see §9): **PR #14 is now merge-ready pending Chris.** The
Preview was blocked by the Neon branch limit; Chris freed one branch and the
Preview is READY. The heading fix, docs, tests and visual baselines are done and
green. Sections 1–8 below describe the state at the end of 2026-09-26.

## 1. Starting state

- `main` = `origin/main` = `86eff1d` (PR #13 merge).
- PR #14: OPEN, `codex/m4-invoiced-this-month`, head `394bac8`, MERGEABLE,
  `mergeStateStatus` UNSTABLE (Vercel Preview failing only).
- Required CI on `394bac8`: run `36221739312` green (`lint-typecheck-test`,
  `e2e-a11y`, `e2e-critical`, `ux-audit`; `e2e-cross-browser` skipped on PRs).
- Vercel Preview `dpl_3mdSyjC3kH93eWk4YkmTdXkCbaJP`: ERROR.
- Untracked and left alone: `src/generated/` (root-owned Prisma output) and the
  earlier `docs/receipts/DIBAYAR-M4-NEXT-MOVE-2026-09-26.md`.

## 2. Preview diagnosis

**Classification: `HIGH_CONFIDENCE_CAUSE_BUT_NOT_DIRECTLY_CONFIRMED`.**

The hand-off's hypothesis (missing per-branch `DATABASE_URL_POSTGRES_URL_NON_POOLING`)
is **not supported**. Evidence (all read-only; env var *names* only, no values):

| Check | Result |
|---|---|
| Vercel deployment API | `readyState` ERROR, `errorCode` `BUILD_FAILED`, `errorMessage` **"Resource provisioning failed"**, `buildCommand` null |
| Integration step | `integrations.status` = `error`, started→completed in ~1.5 s |
| Build step | `vercel inspect`: `Builds ╶ . [0ms]`; `vercel logs`: "never reached READY" — **`scripts/vercel-build.sh` never ran** |
| `DATABASE_URL_POSTGRES_URL_NON_POOLING` | Exists as a Config var for Production, Preview, Development (74 d old) — not missing |
| Which deployments fail | Every one for this git branch (`38bfb7b`, `4ad0594`, `394bac8`, `aeb0ee3`, `000c80e`, and the docs commit pushed with this receipt); the last two Ready Previews were PR #13's; earlier branches were Ready |
| Repo content | Diff from PR #13's last Ready commit to `38bfb7b` is copy/tests/docs only; commit author identical to Ready ones |
| Neon (`neon-dijual`) | `owner.subscription_type` `free_v3`, `branches_limit` **10**; exactly **10** branches (8 ready, 2 archived); **no** `preview/codex/m4-invoiced-this-month` branch |

Why not "confirmed": Neon/Vercel do not expose the provisioning error text. The
limit being exactly reached, no branch being created for this git branch, and
every failure sharing the same pre-build integration error make it the leading
explanation, but I could not read the integration's own message.

**Remediation performed: none, deliberately.** No repo change can affect a
failure that occurs before the build runs, so a repo workaround would be
fabricated. Deleting Neon or `origin` branches is irreversible external action
that was not authorized. PR #14 was not merged.

### Chris action packet — free Neon branch capacity

- **Missing/blocked:** the Vercel↔Neon integration cannot create the per-git-branch
  database `preview/codex/m4-invoiced-this-month` because `neon-dijual` is at its
  10-branch free-plan limit.
- **Candidates (all belong to merged PRs; their git branches still exist on
  `origin`, which is a likely reason the Neon branches persist — not verified
  that the integration auto-deletes on git-branch delete):**
  `preview/codex/m4-provisional-decisions-readiness` (PR #13),
  `preview/codex/ci-font-self-hosting` (#12),
  `preview/codex/p2-4-ownership-denial` (#11),
  `preview/codex/post-pr9-hardening` (#10),
  `preview/codex/post-pr8-hardening` (#9),
  `preview/codex/e2e-improvement-plan` (#8),
  `preview/fix/preview-neon-database-binding` (#7).
  Two archived branches (`preview/test/ux-review-pack-v2`,
  `preview/claude/dibayar-week-2026-09-07`) have no PR and are probably also
  countable toward the limit. Do **not** delete `main` (the default branch, which
  is the Production database).
- **Where:** Neon Console → project `neon-dijual` → Branches, or delete the merged
  git branches on `origin` and check whether the integration prunes the Neon
  branch. Deleting only as many as needed (1 is enough for this PR) is enough; a
  plan upgrade is the alternative.
- **Why needed:** without a Preview DB branch, no Preview deploys, so PR #14's
  Preview and the moderated M4 sessions (which run on a protected Preview)
  cannot happen.
- **Verify after:** push an empty commit or redeploy the latest PR #14 Preview;
  `vercel api /v13/deployments/<id>` should show `integrations.status` `ready`,
  then `READY`; `neon branches list` shows `preview/codex/m4-invoiced-this-month`.
- **Rollback:** Neon branch deletion is not reversible from Neon's side beyond
  its history-retention window (`history_retention_seconds` 21600 = 6 h on this
  plan); merged branches hold only test/fixture data, but confirm before deleting.
  Recreating a deleted git branch from its merge SHA is always possible.

## 3. Monthly-summary semantic audit

Traced from `src/lib/income-summary.ts`, `src/components/home/monthly-income.tsx`,
`income-summary.test.ts`, `monthly-income.test.tsx`:

| Question | Answer |
|---|---|
| Source | `invoices` array passed to `summarizeMonthlyIncome` |
| Date basis / timezone | `Invoice.createdAt`, Asia/Jakarta calendar month (UTC+7 bounds) |
| Status filter | every status except `DRAFT` (SENT/DUE/OVERDUE/PAID) |
| Draft counted? | No |
| Sent/unpaid counted? | **Yes** |
| Paid counted? | Yes |
| Created last month, paid this month | Counted in the **creation** month (last month) |
| Gross vs net | Figure shown is `netIdr = Σ subtotalIdr − Σ round(subtotalIdr × rate)` — **net of estimated PPh** (rates NONE 0, PPh 21 5%, PPh 23 2%) |
| Helper line | `{month label} · {N} invoice lunas` (N = PAID invoices created this month). The `dashboard.income*` copy is unused in `src/` |

Copy: previous PR #14 heading "Ditagihkan bulan ini" / "Invoiced this month"
implied gross invoiced and dropped the "net" the original "Net bulan ini" /
"Net this month" carried. **Final:** "Net ditagihkan bulan ini" / "Net invoiced
this month" — "ditagihkan" says unpaid counts, "Net" says PPh is already
deducted; "Net" also matches existing product copy ("Net estimasi"). No helper
line added: `M4-READINESS.md` task 4 asks whether creators notice it is net of
PPh, and an explanatory line would pre-empt that. The unused `dashboard.income`
label was set to the same string. **Calculation, schema, PPh rates unchanged**
(only a code comment in `income-summary.ts` was reworded). Alternative if Chris
prefers a different phrasing: "Invoice bulan ini" plus a helper "Setelah estimasi
PPh; termasuk yang belum dibayar" — needs a new visible line and baseline change.

## 4. M4 policy / readiness

- Mode remains **moderated Preview**; Production/public access not touched.
- **Preview-policy ambiguity remains open — Chris decision needed.**
  `DEPLOYMENT.md` "Preview policy" allows an access-restricted preview for
  "technical verification only… not announced or shared with users". A
  moderated creator screen-share is product validation, and a creator is a
  prospective user. Packaged as `M4-READINESS.md` §3.1 (Options A/B, wording).
  Policy text not changed.
- New M4 blocker: no READY Preview (§2 above). Added to the §5 checklist and §6
  vocabulary.
- Provisional: 7-day due-soon (`DUE_SOON_WINDOW_DAYS`) and 90-day share lifetime
  (`DEFAULT_SHARE_LIFETIME_DAYS`) unchanged, still WAITING FOR PRODUCT DECISION,
  as is ratification of the `createdAt` basis.
- Feedback template (§4), moderator checklist (§5) and tracker preserved;
  tracker has no PII and was not edited. `users_shown` / `feedback_logged` /
  `wtp_signals` remain 0.

## 5. Validation

Local, on the heading change:

| Command | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 80 files, 771 tests pass |
| `npm run build` | pass |

Visual: `Update visual baselines` workflow run `36236175674` (success).
Only `beranda-desktop`, `beranda-mobile`, `beranda-true-mobile` changed, at
identical dimensions (1280×720, 390×844); the other six are byte-identical; the
390 px render was viewed — heading fits on one line, nothing else moved.

GitHub CI: run `36236173560` (on `aeb0ee3`, old baselines, superseded),
`36236341612` (on `000c80e`, with new baselines); final head's run is recorded
on the PR. Vercel Preview: **ERROR on every new commit, same cause (§2)** — the
Preview/Beranda page and its mobile rendering could not be inspected on Vercel;
mobile was verified from the CI-runner screenshot above. Protection was not
weakened.

## 6. Security / Production

- Production accessed? **No** (Vercel/Neon access was to the Preview-side
  deployment metadata and the Neon project's branch list only; read-only).
- Production data modified? **No.**
- Production deployment intentionally triggered? **No.** PR #14 not merged.
- Public access / SSO / OAuth changed? **No / No / No.**
- Secrets read or printed? **No values** — only env var names/types were listed;
  Neon connection strings were never requested.
- External creator contact? **None.**
- Pushes to the PR branch caused Vercel Preview attempts that failed as above;
  GitHub Actions `Update visual baselines` was dispatched (documented process).

## 7. Git / PR

- Commits on top of `394bac8`: `aeb0ee3` (heading + docs), `000c80e` (3 baselines),
  and the docs/receipt commit containing this file.
- PR: https://github.com/crh/dibayar/pull/14 — OPEN, MERGEABLE, **not merged**.

## 8. Remaining work

- **Scheduled acceptance (P2-2):** 1 of 2, WAITING FOR SCHEDULE; no manual run.
- **Chris environment decision:** free Neon branch capacity (§2) so Preview deploys — BLOCKED.
- **Chris policy decision:** moderated screen-share vs Preview policy (§4).
- **Chris product decision:** 7-day due-soon, 90-day share lifetime, `createdAt` basis; confirm the "Net ditagihkan bulan ini" wording.
- **Recruitment / creator-session execution:** NON-CODE, Chris; nothing contacted.
- **Production authorization:** unchanged (WAITING FOR PRODUCTION AUTHORIZATION).
- **Post-session proceed / iterate / pivot:** Chris, after ≥5 real sessions.

## 9. Addendum 2026-09-27 — Preview unblocked, cause confirmed

- Chris deleted Neon branch `preview/claude/dibayar-week-2026-09-07` (`br-dry-sunset-aos4tyln`, the oldest, archived, no PR) and redeployed from the Vercel dashboard. (Both actions were blocked by the auto-mode classifier when attempted from Claude Code, so I did not perform them.)
- Verified by me afterwards: `dpl_F2phqqXnFK8qSU35PdYHwaccThg5` READY on `d58c0de`; commit status `success`; Neon now has `preview/codex/m4-invoiced-this-month`; Preview and alias 302 to Vercel SSO unauthenticated; PR #14 `mergeStateStatus` CLEAN, MERGEABLE; CI `36236499806` green.
- **Classification upgraded to `CONFIRMED_ROOT_CAUSE`** (by intervention: freeing exactly one branch flipped provisioning from failing to succeeding).
- **Capacity update (later 2026-09-27):** Neon was at 10/10 right after the redeploy; Chris then deleted four more (5 total). Verified read-only: **6/10**, 4 free slots; remaining preview branches are for PR #7, #11, #12, #13 and #14. The risk recurs as branches accumulate (one per git branch), so prune merged-PR ones periodically or raise the plan. I performed no deletions.
- Not verified: the Beranda page on Preview (needs an authenticated, SSO-protected session; none used). Mobile rendering evidence is the CI-runner screenshot in §5.
- Merge status: not merged. Merging redeploys Production with the new heading; that is Chris's call.
