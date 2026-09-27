# Dibayar — PR #15 Pre-Staging Transition Fix: Receipt (2026-09-27)

PR: https://github.com/crh/dibayar/pull/15 (`codex/document-development-workflow` -> `main`), review-ready, **not merged**.

## 1. Starting state
- PR #15 head `fc5a31e2a7420bb4323db024b8be46c35f6eb652`, OPEN, MERGEABLE/CLEAN, base `main`. `origin/main` = `86eff1d`; repo had not advanced.
- Checks: both CI runs on the head completed `success` (`gh run list`); Vercel status `success`. (`gh pr checks` and the check-runs API are blocked by the PAT's scope, so CI was read via `gh run list` and the commit status API.)
- Unresolved review: one Codex P2 thread (`PRRT_kwDOTVT6hM6mXER4`) on `docs/DEVELOPMENT-WORKFLOW.md` (Normal flow).
- Open PRs: #14, #15. `staging` does not exist on `origin`.
- Untracked, left untouched: two PR #14 receipts, `src/generated/`.

## 2. Review finding
Normal flow step 1 had a pre-staging fallback for the *branch source* ("from `main` only while `staging` does not yet exist") but step 2 still required a PR into the nonexistent `staging`. The PR target was undefined during rollout, so an agent could improvise a PR into `main`, which auto-deploys Production. Valid: no transitional PR-target or Production-authorization rule existed anywhere.

## 3. Transition rule implemented
- **Ordinary work blocked:** new feature/fix/chore development may not start under the target workflow until staging is provisioned; agents stop and report rather than target `main`.
- **Allowed `main` exceptions (only):** already-open legacy PRs (#14, #15); the one-time staging-bootstrap/workflow-rollout PR (`main -> bootstrap/workflow branch -> PR -> main`, explicitly a one-time exception); urgent hotfixes.
- **Authorization:** every merge into `main` needs Chris's explicit authorization, per PR (also added to the Authorization table).
- **Transition ends only when all verified:** staging branch exists AND stable Vercel staging verified AND stable Neon staging branch verified AND staging OAuth redirect configured AND ordinary-branch auto-deploy suppression verified AND staging CI path verified. Recorded in `STATE.md`.
- **After:** `feature|fix|chore/* -> staging`, `staging -> main` release PR; no ordinary PR targets `main`.
- Removed the "from `main` while staging is absent" fallback from Normal flow, which now applies only after the transition.

## 4. Files changed
- `docs/DEVELOPMENT-WORKFLOW.md` — new "Pre-staging transition" section; Rollout status pointer; Normal flow scoping + step 1; Authorization row.
- `DEPLOYMENT.md` — one-sentence pointer under the environment table; transitional clause in the Production-authorization sentence. No policy duplicated.
- `CLAUDE.md` — one invariant bullet.
- `.hermes.md` — one appended sentence.
- This receipt.
- Not changed: `README.md`, `STATE.md` (Hermes-owned; still needs the rollout tracking noted in the prior receipt).

## 5. Validation
- `git diff --check`: clean.
- Anchors/links added (`#pre-staging-transition`, `#normal-flow`, `#authorization`) resolve to headings in the same file; referenced files exist.
- Grep found no remaining "while staging is absent -> main" wording in workflow, DEPLOYMENT, CLAUDE, `.hermes.md`, README.
- No secrets, no app/config changes. No docs validator exists; app suites not run (docs-only).
- CI after push: see section 7 (re-checked after push).

## 6. Review thread
Reply posted to the Codex comment and thread resolved — status recorded in section 7 once done.

## 7. Git / PR
- Fix commit: `638ad20` `docs: define pre-staging transition rules` (this receipt is committed on top of it).
- Final head, CI, mergeability and thread status: see the session report; verified after push.
- Merge status: **not merged**; awaiting Chris's explicit authorization (merging deploys Production; docs-only).

## 8. Next step after Chris merges PR #15
```text
Implement the staging/bootstrap workflow:
- create staging branch;
- provision stable Vercel staging environment/domain;
- provision stable Neon staging branch;
- configure staging OAuth callback;
- suppress ordinary feature/fix/chore deployments;
- verify staging CI;
- enable/implement cleanup;
- update STATE.md;
- then declare the transition complete.
```
Most of these are Chris-only actions (Vercel/Neon/OAuth settings); the bootstrap PR itself follows the `main -> bootstrap/workflow branch -> PR -> main` exception. Also: delete the Neon branch created by PR #15's push after merge (Chris).
