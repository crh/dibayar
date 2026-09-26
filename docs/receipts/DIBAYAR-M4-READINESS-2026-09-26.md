# Dibayar — roadmap resume after PR #12 / M4 readiness — 2026-09-26

Supersedes the earlier same-day state-check note (folded into §1–2).

## 1. Starting state (verified this session)

- `main` = `origin/main` = `a60dfdfd33caad8138547888d4f4d33330b64719` (`git fetch`, `git rev-parse`).
- Working tree clean except pre-existing root-owned untracked `src/generated/` (untouched).
- `gh pr list --state open`: none.
- Latest push CI on `main`: `36111597692` success. Recent `main` runs: `36109870314` (schedule, 09-25, success), `35970637176` (schedule, 09-24, failure), `35833560777` (schedule, 09-23, success).
- The prompt's starting context matched the repo; no newer state was found.

## 2. P2-2 status

- Qualifying scheduled runs under the project convention: `36109870314` (2026-09-25T07:52Z, commit `a59a429`, success, all jobs incl. `e2e-cross-browser`). Streak: **1 of 2**.
- No scheduled run has occurred since (cron `17 2 * * 1-5`; 2026-09-26 is a Saturday). **Not closed.** Next expected: Monday 2026-09-28 (historically ~5h late).
- Not done, by design: no manual trigger, no cron/CI change, no new watcher.

## 3. Roadmap analysis

Source docs read: `ROADMAP.md`, `BACKLOG.md`, `STATE.md`, `DAILY_LOG.md` (tail), `docs/PROJECT-PLAN-2026-09-22.md`, `DEPLOYMENT.md`, `SECURITY.md`, `docs/receipts/DIBAYAR-PROJECT-PLAN-EXECUTION-2026-09-22.md`.

| Item | Status found |
|---|---|
| P0-1/2/3, P1-3 (MFA design), P1-4 (data minimisation), P2-1, P2-3, P2-4 | Already DONE per earlier receipts/`SECURITY.md`; P2-3's last `waitForTimeout` is documented as a real race |
| P1-1 / P1-2 (live cookie/header check) | Needs a live environment — Chris |
| P2-2 | Schedule wait (§2) |
| M4 (≥5 creators, feedback, go/no-go) | Non-code; external contact is a Chris approval gate |
| Three provisional constants | Present in code, unratified |

Executable now: pinning/labelling the provisional behaviour and preparing M4 materials. Decision-blocked: the three constants, Production/public-access intent, OAuth test-user setup, recruiting, go/no-go.

**Discrepancy found:** docs say "issue-date" income basis; code uses `Invoice.createdAt` (no issue-date column) and counts all non-DRAFT statuses, paid or unpaid. Also a test titled "…excluding drafts" asserted only a month boundary. Reported, not resolved.

## 4. Implementation (PR #13, no behaviour change)

- `src/lib/income-summary.ts`, `src/lib/invoice-share.ts`: "Provisional" comments (7-day window already had one).
- `src/lib/income-summary.test.ts`: mislabeled test renamed; added tests for draft exclusion, all non-draft statuses counted, creation-month stability when paid later. Mutation check: changing the filter to `updatedAt` made the creation-month test fail; file restored.
- `docs/validation/M4-READINESS.md`: dependency map, provisional-value table, discrepancy + options, Production/access decision packet (no default recommended), feedback template.
- Reasoning: Phase D forbids treating a provisional value as final and allows documenting/locating it; the constants were already centralised, so no architecture change was warranted.
- Docs reconciled: `STATE.md` (82/120 lines), `DAILY_LOG.md`.

## 5. Validation

| Command | Result |
|---|---|
| `npx vitest run` on the two touched suites | 33 passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 80 files / 771 tests passed (was 768) |
| `npm run build` | exit 0 |
| PR CI run `36207171794` (head `673b83b`) | `lint-typecheck-test`, `e2e-a11y`, `ux-audit`, `e2e-critical` success; `e2e-cross-browser` skipped (not run on PRs) |
| E2E / visual | Not run locally: no UI, route, or navigation change |

## 6. Security / Production

- Production accessed: **no** (no curl, no console; the 2026-09-06 edge finding was only re-read from `DEPLOYMENT.md`).
- Production data modified: no. Deployment: no. Public-access change: no.
- Secrets read or printed: no. External contact: none.

## 7. Git / PR

- Branch `codex/m4-provisional-decisions-readiness` from `origin/main` `a60dfdf`.
- Commit `673b83b` (code + M4 doc) plus a docs-reconciliation commit (STATE/DAILY_LOG/this receipt).
- PR: https://github.com/crh/dibayar/pull/13 — open, not merged. No repository workflow authorises merging this class of change unprompted, so it is left review-ready.

## 8. Remaining work

- **Engineering next step:** none unblocked on the roadmap. After Chris's decisions, implement the chosen income basis (may need a schema field) and update the pinned tests.
- **Scheduled acceptance:** one more successful scheduled `e2e-cross-browser` run (next expected 2026-09-28).
- **Chris decision required:** 7-day window; 90-day share lifetime; income basis (invoiced vs received, and the "issue-date" wording); Production edge/public-access intent; which environment M4 uses; merge PR #13.
- **Production authorization required:** any edge/SSO change, public recipient access (needs the distributed rate limiter first), and the P1-1/P1-2 live checks; Google OAuth test-user/consent-screen setup for creators.
- **Creator-validation / non-code:** recruit ≥5 creators, run sessions, log feedback with the template, update `STATE.md` metrics from real events only.
