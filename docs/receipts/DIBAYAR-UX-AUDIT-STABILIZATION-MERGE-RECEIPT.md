# Dibayar — UX Audit Stabilization — Merge & Deployment Receipt

## 1. PR merged

- Repository: `crh/dibayar`
- PR: [#4](https://github.com/crh/dibayar/pull/4) — "test: stabilize Playwright UX audit baselines"
- Branch: `test/stabilize-playwright-visual-baselines` → `main`
- Merge method: standard merge commit (matches this repo's convention — PR #3 was merged the same way; branch not deleted, matching `delete_branch_on_merge: false`)
- Merged at: `2026-09-14T05:02:04Z`
- Merged by: repository owner's `gh` session (this task)

## 2. Audited head SHA / resulting merge SHA

| | SHA |
|---|---|
| Audited PR head (per the finalize-task packet) | `25ce514d309a967d330cd2febbbee7637e50269b` |
| Actual PR head at merge time (verified in Phase 1) | `25ce514d309a967d330cd2febbbee7637e50269b` — **matched exactly**, no new commits appeared after the audited receipt |
| Resulting merge commit on `main` | `73326065e8848b4f806cadc92b28144a38c6460d` |

Phase 1 pre-merge verification confirmed: PR base `main`, `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`, `state: OPEN`, 5 commits (matching audited history), 0 PR reviews, only 1 PR comment (the Vercel bot deployment comment — not a blocking review). No unresolved blocking review comments existed.

## 3. CI status

Post-merge CI on `main` (run [34808152991](https://github.com/crh/dibayar/actions/runs/34808152991), triggered by the merge commit):

| Job | Result |
|---|---|
| `lint-typecheck-test` | ✅ success |
| `e2e-critical` | ✅ success |
| `ux-audit` | ✅ success |

All three required jobs green on `main` at the new merge commit — this is the first time `ux-audit` has been green on `main` (the two prior merges to `main`, PR #3 and the earlier UX V2 merge, both show CI `failure` on `main`, consistent with `ux-audit` having been broken before this stabilization work).

## 4. Production deployment status

- GitHub deployment record: id `6430788180`, `sha: 7332606` (the new merge commit), `environment: Production`, created `2026-09-14T05:02:37Z`, status **`success`**.
- Deployment URL: `https://dibayar-aq619a0kr-kenji-iwakura.vercel.app`
- Verified via `vercel inspect https://dibayar.vercel.app`: the stable production alias (`dibayar.vercel.app`, plus `dibayar-kenji-iwakura.vercel.app` and `dibayar-git-main-kenji-iwakura.vercel.app`) resolves to deployment `dpl_5qPAjB3hJUz2Esffwid4MKQETqLw`, `target: production`, `status: ● Ready`, created ~10 minutes before the check (i.e., at merge time) — confirming the live production alias corresponds to the new `main` commit, not a stale prior deployment.

## 5. Smoke-test results

Used the repository's existing sanctioned tool for exactly this purpose — `scripts/smoke-deployment.mjs` (non-destructive, read-only, no credentials, requires explicit `--env production`):

```
node scripts/smoke-deployment.mjs --env production --url https://dibayar.vercel.app

  [PASS] root (/) -> 307 location: /api/auth/signin?callbackUrl=%2F
  [PASS] auth signin (/api/auth/signin) -> 200
  [PASS] auth providers (/api/auth/providers) -> 200
  [PASS] auth csrf (/api/auth/csrf) -> 200

SMOKE_TEST_STATUS=PASS
```

**Scope note on the four named surfaces (Beranda, Deal, Invoice, Pengaturan):** all four require an authenticated session to reach — an unauthenticated request to any of them 307-redirects to `/api/auth/signin`, which is exactly what the root check above confirms is working correctly. This repository has no dedicated unauthenticated health endpoint and no existing safe/non-destructive workflow for authenticated production smoke testing (the script's own header and output note this explicitly, and it deliberately never touches real credentials or sessions). Per this task's own guardrail — do not modify real production data unless there is an existing safe test workflow specifically intended for that — no authenticated per-page check was attempted; the closest available non-destructive signal (confirmed here) is that the app is not erroring, the Auth.js pipeline (`signin`/`providers`/`csrf`) responds normally, and root correctly redirects unauthenticated visitors rather than 500ing. This is unchanged in kind from the smoke methodology already recorded elsewhere in `DEPLOYMENT.md` for this production URL.

Database connectivity and migration status are the same "not independently checked, no safe endpoint exists" as documented in the script's own output — not a gap introduced by this task.

## 6. Confirmation: no additional source changes introduced

This finalization task made **zero** application/source code changes. `git status --short` in the working copy is clean; the only actions taken were: read-only verification (`gh pr view`, `gh run view`, `gh api`), the merge itself (`gh pr merge 4 --merge`), a read-only Vercel inspection, and a read-only smoke-test script run using the repository's pre-existing `scripts/smoke-deployment.mjs` (not modified). No Hermes source, no application/product code, no test files, no Playwright config, no CI workflow, and no visual snapshots were touched in this task.

## 7. Confirmation: unrelated stash remains untouched

```
git stash list
stash@{0}: On security/dependabot-remediation-2026-09-13: leftover uncommitted receipts + CLAUDE.md edit from prior security-remediation session (pre stabilize-ux-audit task)
stash@{1}: On test/ux-review-pack-v2: preserve-untracked-review-pack-evidence-2026-09-10
```

Both stash entries are still present, unpopped, unmodified. `stash@{0}` (the one this task's guardrails specifically named) was not touched.

## 8. Known limitations carried forward as backlog

These were documented in `docs/testing/E2E.md` by the stabilization PR and are **not** addressed by this finalization task, per instruction:

1. `chromium-mobile` has no committed `@visual` baseline set for `e2e/visual/visual.spec.ts` — never existed, and neither real CI gate (`e2e-critical` excludes `@visual`; `ux-audit`'s own `@visual` step is `--project=chromium` only) currently exercises that combination.
2. `e2e/visual/visual.spec.ts` does not call `reseedFixtures()`, so the unfiltered `npm run test:e2e` (not itself a CI gate) can expose fixture-order dependence if `settings.spec.ts` runs first in the same invocation.

Neither blocks the current CI path; both remain candidates for separately-scoped future work if `chromium-mobile` visual coverage or full-suite (non-gate) reliability is ever prioritized.

## 9. Recommendation

**Close the UX-audit stabilization workstream.**

All required gates are green on `main` at the new merge commit, production deployment succeeded and corresponds to that commit, and the non-destructive smoke test passed with no anomalies. No current gate is failing, no regression was introduced by this finalization task, and the two known limitations are pre-existing, out-of-band, and non-blocking by design. There is nothing outstanding that warrants another remediation cycle.
