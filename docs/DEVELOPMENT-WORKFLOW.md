# Dibayar development workflow

This is the single source of truth for **Git branching, promotion, and
environment lifecycle**. It applies to humans, Claude Code (Klaus), and
Hermes (Luna/Archie) alike. Other files point here; they do not restate it.

## Precedence

```text
Git/environment workflow ............ docs/DEVELOPMENT-WORKFLOW.md  (this file)
Deployment mechanics/security gates . DEPLOYMENT.md
Current project status .............. STATE.md
```

If two documents disagree, the file that owns the topic wins and the other is a
bug to fix in the same change. `CLAUDE.md` and `.hermes.md` hold short
invariants and pointers only.

## Rollout status

This document defines the **approved target workflow**. Until the `staging`
branch, its Vercel deployment, its Neon branch, and its OAuth callback exist
(implementation is tracked in `STATE.md`, not here), do not assume they exist:
check `git ls-remote --heads origin staging` and `DEPLOYMENT.md` before acting
on any staging-specific step. Rules that need no new infrastructure (ordinary
branches are CI-only in intent, no per-branch OAuth URIs, cleanup, authorization
boundaries) apply immediately. The PR-target rules below do not apply until the
transition ends; see [Pre-staging transition](#pre-staging-transition).

## Pre-staging transition

Until the transition ends, the [Normal flow](#normal-flow) cannot be used
because its PR target (`staging`) does not exist. Do not improvise a substitute.

```text
New ordinary feature/fix/chore development:
  BLOCKED from starting under the target workflow until staging is provisioned.

Allowed main-targeting exceptions (only these):
  1. already-open legacy PRs that predate the staging workflow
     (PR #14 and PR #15);
  2. the one-time staging-bootstrap / workflow-rollout PR;
  3. urgent Production hotfixes (see Hotfix).

Every merge into main:
  requires Chris's explicit authorization, per PR (merging to main deploys
  Production).
```

The bootstrap is a one-time exception, not ongoing development. `staging` cannot
be its own PR target, so it is the only work that branches from and targets
`main`:

```text
main -> bootstrap/workflow branch -> PR -> main
```

An agent that is handed ordinary feature/fix/chore work while the transition is
open must not open it against `main`. It stops and reports that the work is
blocked on staging, unless Chris explicitly names it as one of the exceptions
above.

**The transition ends only when all of the following are verified** (recorded in
`STATE.md`, with evidence per `DEPLOYMENT.md`):

```text
staging branch exists
AND stable Vercel staging environment is verified
AND stable Neon staging branch is verified
AND staging OAuth redirect is configured
AND feature/fix/chore auto-deploy suppression is verified
AND staging CI path is verified
```

From that point the [Normal flow](#normal-flow) is the only path:

```text
feature|fix|chore/*  -> staging
staging              -> main   (release PR)
```

No ordinary PR targets `main`. Only release PRs, hotfixes, and explicitly
authorized workflow/infrastructure exceptions do.

## Branches

```text
main        Production
staging     long-lived integration / M4 validation environment
feature/*   normal feature work
fix/*       normal bug fixes
chore/*     maintenance (docs, deps, CI, refactors)
preview/*   exceptional isolated full-stack preview
hotfix/*    urgent Production fix
```

- `main` and `staging` are never deleted, force-pushed, or rewritten.
- Agent-prefixed branches that predate this document (`codex/*`, `hermes/*`,
  `claude/*`, `test/*`, `security/*`, `ux/*`) are classified by **purpose**, and
  are ordinary CI-only branches unless they are explicitly `preview/*`. Prefer
  the standard prefixes for new work.
- Branch protection is not available on the repository's current GitHub plan,
  so `main`/`staging` discipline is procedural. Do not push directly to either.
- There is no `release/*` branch. Add release branches only if the project ever
  needs parallel release trains or long stabilization cycles.

## Normal flow

Applies once the [transition](#pre-staging-transition) has ended. Before that,
ordinary work is blocked, not redirected to `main`.

```text
feature|fix|chore/*  --PR-->  staging  --validate-->  PR  -->  main
```

1. Branch from `staging`.
2. Open a PR into `staging`. CI must be green; independent review is recorded
   per `REVIEW_CHECKLIST.md`. Merge only when the task or Chris explicitly
   authorizes the merge; otherwise leave the PR review-ready.
3. Validate on the staging environment (manual smoke, M4 sessions, migrations
   applied to the staging database).
4. `staging -> main` is the **Production release PR**. It needs Chris's
   explicit authorization (see [Authorization](#authorization)).
5. Merge feature/fix/chore PRs into `staging` with squash or merge commit.
   Merge `staging -> main` and `main -> staging` sync PRs with a **merge
   commit only** (never squash or rebase), so the two long-lived branches keep
   shared history and do not diverge.

## Ordinary branches are CI-only

`feature/*`, `fix/*`, `chore/*` (and legacy-prefixed branches) must:

- run CI (lint, typecheck, unit, E2E, UX audit as configured in `.github/`);
- **not** create a Vercel deployment (build) — **live-verified true** as of
  2026-09-27/28: `vercel.json`'s `ignoreCommand` cancels the build in ~4–7s;
- **not** create a Neon branch — **this is the target, not the current
  behavior.** Live-verified 2026-09-27 and again 2026-09-28 (two independent
  ordinary branches): the Vercel↔Neon integration still provisions a Neon
  preview branch for an ordinary branch even though its Vercel build is
  correctly skipped. See `DEPLOYMENT.md` "Ordinary-branch Neon suppression
  gap" and `docs/receipts/DIBAYAR-STAGING-ACTIVATION-R2-SELECTIVE-NEON-2026-09-28.md`
  for the audit and the selective-branching model adopted around this gap.
  Do not claim this bullet is satisfied until a live smoke test shows no new
  Neon branch;
- **not** require a Google OAuth redirect registration.

Mechanism (details in `DEPLOYMENT.md` "Environment mechanics"): the intentional
deployable branches are exactly `main`, `staging`, and `preview/**`.
`vercel.json`'s `git.deploymentEnabled` is the **primary** gate that stops Vercel
creating an automatic deployment for anything else; `ignoreCommand` is only
secondary defense in depth (it runs after a deployment exists, and does not by
itself stop the Neon integration from provisioning a branch). Neon preview
provisioning should therefore only happen after Vercel actually creates an
allowed deployment. This is repo config only until a disposable ordinary branch
is live-verified to create no Vercel deployment and no Neon branch; do not treat
the suppression as verified before then.

Verify behavior locally against the disposable test database
(`docs/testing/E2E.md`), not against a hosted environment. Every hosted
Preview costs a Neon branch (the Vercel/Neon integration creates one per
deployed git branch and the plan has a small hard cap), so hosted previews are
opt-in, never the default. As of 2026-09-28 the project is at the 10-branch
cap; see `DEPLOYMENT.md` "Neon capacity".

## Isolated preview (exception)

Use a `preview/*` branch only when isolation is justified, for example:

- a Prisma/schema migration that must be proven on a real database before
  reaching `staging`;
- an auth or third-party-integration change that cannot be verified locally;
- a destructive or data-sensitive change;
- concurrent work that cannot safely share `staging`.

Rules:

- State the justification in the PR description. "I want to see it live" is not
  sufficient; use `staging` after merge instead.
- A `preview/*` branch gets its own temporary Vercel deployment and Neon
  branch, contains no real customer data, and stays Vercel-SSO protected.
- Default cap: **3 concurrent isolated previews**, so Neon capacity is never the
  reason `main` or `staging` cannot deploy. Chris can raise it.
- Google sign-in on a preview needs a temporary OAuth redirect URI, which is an
  OAuth-console change that requires Chris. Prefer a preview that does not need
  live sign-in.
- Lifecycle: open PR into `staging` -> verify -> merge or close -> delete the
  git branch **and** the Neon branch (see [Cleanup](#cleanup)).

## Hotfix

```text
main -> hotfix/* -> PR -> main
main -> staging   (sync PR, merge commit)
```

- Branch from `main`; keep the fix minimal; CI must be green.
- The PR into `main` still needs Chris's Production authorization. Urgency
  shortens the path, it does not waive the gate.
- Use an isolated `preview/*` first only if the fix touches schema, auth, or
  data; otherwise verify locally and with the post-deploy smoke check.
- Immediately after the hotfix merges, sync `main` into `staging` so the fix is
  not lost or re-conflicted by the next release.

## Environment map

```text
main      -> Production Vercel   + Production Neon         + Production OAuth callback
staging   -> stable staging Vercel + stable staging Neon    + stable staging OAuth callback
preview/* -> temporary isolated Vercel + Neon branch        + no OAuth callback by default
```

- Environments never share a database, secrets, or OAuth client redirect
  entries by accident. Evidence for one environment is never evidence for
  another (`DEPLOYMENT.md`, "Deployment verification record").
- Staging holds synthetic or consented test data only, never a copy of
  Production data unless Chris authorizes it and it is scrubbed.
- Vercel, Neon, environment-variable, and access mechanics live in
  `DEPLOYMENT.md`.

## Google OAuth redirect strategy

Exactly three long-lived callback URIs are registered, and nothing else is
added routinely:

```text
http://localhost:3000/api/auth/callback/google      local development
https://<staging-domain>/api/auth/callback/google   stable staging domain
https://<production-domain>/api/auth/callback/google Production domain
```

Never add a redirect URI for an ordinary feature/fix/chore branch or for a
per-deployment Vercel URL. Vercel generates a new hostname per deployment and
per branch, so a per-branch list grows without bound and widens the OAuth
client's trusted surface. Any change in the Google console needs Chris.

## Cleanup

- Delete merged `feature/*`, `fix/*`, `chore/*`, `hotfix/*`, and `preview/*`
  branches on merge (enable GitHub "Automatically delete head branches" so this
  is not manual).
- When a `preview/*` branch is merged, closed, or abandoned, its Neon branch and
  Vercel deployments must be removed promptly, not "eventually".
- Monitor Neon branch capacity before opening a preview and whenever a
  deployment fails with "Resource provisioning failed" (the observed symptom of
  the cap; see `DEPLOYMENT.md`). The current plan limit is recorded there.
- Never delete `main` or `staging`, their Neon branches, or their Vercel
  environment configuration as part of cleanup.
- Deleting Neon branches, Vercel deployments/env vars, or remote git branches
  belonging to someone else's work is a destructive operation; see
  [Authorization](#authorization). Agents identify candidates and stop.

## Authorization

| Action | Who may do it |
|---|---|
| Branch, commit, push ordinary branches, run CI, local DB work | Routine development; no approval needed |
| Open a PR into `staging` or `main` | Routine; leave review-ready |
| Merge a PR into `staging` | Only when the task or Chris explicitly authorizes the merge |
| Open a `preview/*` branch | Routine, with the justification recorded in the PR |
| Merge/deploy to **Production** (`staging -> main`, `hotfix/* -> main`, and during the [pre-staging transition](#pre-staging-transition) any legacy or bootstrap PR into `main`) | **Chris**, explicit per PR |
| Production data change, production migration outside the build | **Chris**, explicit scope |
| Public / non-SSO access change on any environment | **Chris** |
| Google OAuth console change (add/remove redirect URI, client changes) | **Chris** |
| Destructive Neon/Vercel operation (delete Neon branch, delete deployment, remove or rotate env var, `migrate reset`) | **Chris** (agents propose, do not execute) |
| Creating/changing Vercel or Neon project settings, integrations, ignored-build rules | **Chris** |

Standing autonomy for milestone work (recorded in `STATE.md`) never extends to
the rows marked Chris. Approval given in one context does not carry to the
next PR or environment.

## Migrations

Schema changes ship as checked-in Prisma migrations, applied by the build on the
target environment (`scripts/vercel-build.sh`), forward-only. Destructive or
irreversible migrations need an isolated `preview/*` rehearsal and Chris's
approval before reaching `main`. Never run `migrate reset` or `db push` against
a hosted database.

## Rollback

- **Code:** revert the offending merge with a new PR (or `hotfix/*`) and
  redeploy, or promote the previous known-good Vercel deployment. Never
  force-push `main`/`staging` to roll back.
- **Schema:** migrations are forward-only. Recover with a forward corrective
  migration, or a Neon restore where Chris authorizes it. Plan reversibility
  (expand/contract) before merging a risky migration.
- After any rollback, run `scripts/smoke-deployment.mjs` and record a
  deployment verification record for that environment.
- The verified rollback procedure itself (Vercel/Neon steps) belongs in
  `DEPLOYMENT.md`; do not claim a rollback worked until the resulting
  deployment status and URL were checked directly.
