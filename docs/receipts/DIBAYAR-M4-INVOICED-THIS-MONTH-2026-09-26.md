# Dibayar — PR #13 merge, "Ditagihkan bulan ini" relabel, M4 moderated-Preview kit — 2026-09-26

## 1. Starting state (verified)

- Session start: `main` = `origin/main` = `a60dfdf`; PR #13 OPEN (head `c95b4ec`, MERGEABLE/CLEAN). Phase A gate failed, so work stopped and the state was reported. The earlier `gh pr merge 13` had been denied by the auto-mode classifier ("Merge Without Review"); it was not retried until Chris wrote "Merge is authorized".
- PR #13 merged `2026-09-26T02:42:06Z`, merge commit **`86eff1d75719727745541320ee9b0cde98a71197`**. Local `main` fast-forwarded to it.
- Open PRs before this work: only #13. Now: #14 (this work).
- Working tree: only pre-existing untracked paths — root-owned `src/generated/` (untouched) and `docs/receipts/DIBAYAR-M4-NEXT-MOVE-2026-09-26.md` (left over from the prior session, not part of this PR).
- CI on `main` before the merge: push `36111597692` and schedule `36109870314` green. The post-merge push run for `86eff1d` (`36212514770`) was in progress at last look and was **not** re-checked to completion.

## 2. P2-2

- Scheduled `e2e-cross-browser` runs checked via `gh run list --workflow CI --event schedule`. Newest is still `36109870314` (2026-09-25T07:52Z, success). 2026-09-26 is a Saturday; the cron is weekday-only.
- Streak **1 of 2**. Status: **WAITING FOR SCHEDULE**. No manual trigger, no cron change, no watcher.

## 3. Monthly summary semantics

- Previous: heading `home.netThisMonth` = "Net bulan ini" / "Net this month"; docs called it "income".
- New: **"Ditagihkan bulan ini"** / **"Invoiced this month"**.
- Calculation preserved: `Invoice.createdAt`, Asia/Jakarta, all non-DRAFT statuses, no paid-date field, no schema change. `src/lib/income-summary.ts`, `invoice-share.ts`, `invoice-date-status.ts` and `prisma/` have no diff. The pinned tests pass: draft excluded; all non-draft statuses counted; creation month decides the bucket; later payment does not move an invoice.
- Files changed: `src/lib/i18n.ts` (heading in both languages; unused `dashboard.income` label), `src/app/(app)/beranda-client.test.tsx`, `src/components/home/monthly-income.test.tsx`, `e2e/auth/session.spec.ts`, `e2e/visual/visual.spec.ts`, `tests/ux-audit/routes/matrix.spec.ts`, `docs/ux-implementation/dibayar-implementation-spec.md` (string table and section names), three Beranda `@visual` baselines.
- Deliberately not changed: internal identifiers (`home.netThisMonth` key, `home-net-bulan-ini` id used by the t27 audit, component/function names); helper notes that are already accurate (`dashboard.incomeUnpaidNote` etc.); general copy "melacak pemasukan" (`home.emptySubtitle`); historical evidence/receipt docs.
- **Caveat for Chris:** the figure is still *net of estimated PPh*, but the new heading no longer says "Net". Session task 5 asks creators how they read it; the checklist also prompts whether they noticed the net-of-PPh nuance.

## 4. M4 readiness

- Moderated Preview is reflected in `docs/validation/M4-READINESS.md` (§2 row, §3, §5, §6).
- Moderator checklist: `docs/validation/M4-READINESS.md` §5.
- Recruitment/session tracker: `docs/validation/M4-SESSION-TRACKER.md` (C1–C5, anonymized, no PII, all "not contacted").
- Canonical feedback template: `M4-READINESS.md` §4, preserved; only Task 4's wording and the "monthly-summary basis" label were updated. No second feedback framework.
- **Open question for Chris:** `DEPLOYMENT.md` "Preview policy" permits a protected Preview only with no real customer/financial data and "not announced or shared with users". The checklist therefore uses demo data driven by the moderator. Whether a moderated screen-share is within that policy is not decided here.

## 5. PR #13 documentation correction

- Old (§3): "Code/config that would change: none for either option in the repo. Option A is a Vercel/Google console change plus (before public recipient access) a distributed rate limiter."
- New: Option B needs no repo code/config change and no public-access change; Option A needs a Vercel/Google console change **and**, before public/non-SSO recipient access, a distributed rate limiter — a repo code change that does not exist yet (in-memory limiter is per instance). Explicitly not a Production authorization.
- No limiter was implemented: it would only matter for opening public access, which is out of scope and unauthorized.

## 6. Validation

Local (before push):

| Command | Result |
|---|---|
| `npm run lint` | exit 0, 0 errors / 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | 80 files / 771 tests passed |
| `npm run build` | exit 0 |
| focused: `income-summary.test.ts`, `src/components/home`, `beranda-client.test.tsx` | 5 files / 25 tests passed |

CI:

- `36212894657` (PR #14, first push): `lint-typecheck-test`, `e2e-a11y`, `e2e-critical` success; `e2e-cross-browser` skipped (by design on PR); `ux-audit` **failure** — 69 passed, only the three Beranda `@visual` tests failed (761 differing pixels each, heading text). Real, intentional diff, not a flake.
- `36213322701` (`Update visual baselines`, `workflow_dispatch` on the branch, success): regenerated baselines. Only the three Beranda PNGs differed; the other six were byte-identical. Inspected the new mobile baseline against the old one before accepting: only the heading changed and it stays on one line at 390px.
- Final PR CI after the baseline commit: see PR #14 checks (addendum below if recorded).

## 7. Security / Production

- Production accessed? **No.**
- Production data modified? **No.**
- Deployment intentionally performed? **No.** Note: per `STATE.md` and prior receipts, merging to `main` triggers Vercel's normal GitHub-integration Production redeploy. That is inferred from earlier documented behaviour (PR #2, PR #7), **not verified** for PR #13's merge (Vercel was not inspected). PR #13 was docs/tests/comments only, so the redeploy would carry no behaviour change. **PR #14 changes user-visible text**, so merging it will redeploy a changed heading to Production — a Chris decision; PR #14 was not merged.
- Branch pushes also create protected Preview builds via the Git integration (normal repo behaviour).
- Public access changed? **No.** SSO changed? **No.** OAuth changed? **No.**
- Secrets read/printed? **No.** (Lint/test logs were reviewed; no `.env` opened.)
- External creator contact? **No.**
- Actions taken beyond the code: merged PR #13 (explicitly authorized); dispatched the documented `Update visual baselines` workflow on this branch once (no separate instruction — it is the repo's documented procedure and only produces an artifact; flagged here in case Chris wants that authorization explicit).

## 8. Git / PR

- Branch: `codex/m4-invoiced-this-month` (from `main` @ `86eff1d`).
- Commits: `58e00b2` relabel; `38bfb7b` docs (§3 fix, checklist, tracker); `aa956fb` baselines; plus a state/receipt commit.
- PR: https://github.com/crh/dibayar/pull/14 — OPEN, **not merged**.
- Merge status: left review-ready; merge authorization for #14 was not given (Chris's authorization covered PR #13).

## 9. Remaining work

- **Scheduled acceptance:** one more consecutive scheduled `e2e-cross-browser` success (next expected Mon 2026-09-28, historically ~5h late) closes P2-2.
- **Chris product decisions:** 7-day due-soon window; 90-day share lifetime; ratify the `createdAt` "invoiced this month" basis (or choose paid-date / issue-date, which needs a schema change); whether the heading should mention net-of-PPh.
- **Chris recruitment action:** recruit ≥5 creators (external contact is an approval gate); confirm moderated screen-share is within the Preview policy.
- **Creator-session execution:** run sessions per §5, log §4 entries in `DAILY_LOG.md`, update the tracker, then increment `users_shown` / `feedback_logged` / `wtp_signals` from real sessions only (all still 0).
- **Production authorization:** whether Production's non-SSO edge is intended; public recipient access (needs the distributed rate limiter first); P1-1/P1-2 live checks; Google OAuth consent-screen state.
- **Post-session proceed / iterate / pivot decision:** Chris.
