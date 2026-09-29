# Dibayar — Vercel pre-deployment branch gate (Gate 5 repo-side fix) — 2026-09-28

Branch: `fix/vercel-predeployment-branch-gate` (from `origin/main` @ `4c2f868`)
Status: **repo-side change complete and locally verified. Gate 5 is PENDING live remote verification — not PASS.**
Not pushed, no PR opened, nothing merged (see §7 for why).

## 1. Root cause and fix

PR #17 proved that `vercel.json`'s `ignoreCommand` is not a sufficient
branch-suppression control: for an ordinary branch Vercel *did* create the
deployment (then cancelled the build in ~4s), and the Vercel↔Neon integration
provisioned a Neon preview branch at deployment creation, before the ignore
script ran. Neon is at its 10/10 cap, so every ordinary branch push is a
capacity risk.

Fix: add Vercel's supported `git.deploymentEnabled` as the **primary**
pre-deployment gate, so Vercel does not create an automatic deployment for a
non-allowlisted branch at all. `ignoreCommand` stays as secondary defense in
depth.

## 2. Deviation from the task prompt's "preferred shape" — `"**"`, not `"*"`

The prompt proposed `"*": false` as the catch-all. Vercel documents that branch
keys use **minimatch** syntax, and in minimatch `*` does **not** match `/`.
Verified with the repo's installed minimatch 3.1.5: `minimatch("chore/x", "*")`
is `false` (and `"main"`/`"staging"` are `true`). With `"*": false`, every
branch containing a slash (`chore/*`, `fix/*`, `feature/*`, `codex/*`,
`hermes/*` — i.e. essentially all ordinary branches) would fall through to
Vercel's default of `true` and still deploy, so the fix would have silently done
nothing. `"**"` matches every branch name. Because Vercel deploys when *any*
matching rule is `true`, `main`, `staging` and `preview/**` still win over the
`"**": false` catch-all.

## 3. Final `git.deploymentEnabled` rules (`vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "bash scripts/vercel-build.sh",
  "ignoreCommand": "bash scripts/vercel-ignore-build.sh",
  "git": {
    "deploymentEnabled": {
      "**": false,
      "main": true,
      "staging": true,
      "preview/**": true
    }
  }
}
```

`buildCommand` and `ignoreCommand` are unchanged. `$schema` was added.

## 4. Files changed

- `vercel.json` — added `$schema` and the `git.deploymentEnabled` allowlist.
- `scripts/vercel-ignore-build.sh` — comments only, plus a clarifying comment and log strings (`preview/**`). Allowlist logic and exit codes unchanged. Comments no longer claim the script prevents Neon provisioning, and name `git.deploymentEnabled` as primary. The Bash `case` pattern `preview/*` already matches nested names (`*` crosses `/` in `case`); now covered by a test.
- `scripts/vercel-ignore-build.test.mjs` — shared deploy/CI-only branch lists; new config-level tests (below).
- `DEPLOYMENT.md` — "other branches" table row, "CI-only ordinary branches" mechanics bullet, and the deployment-filtering rollback paragraph rewritten; removed the stale claim that skipping the build is expected to stop Neon provisioning.
- `docs/DEVELOPMENT-WORKFLOW.md` — added a "Mechanism" paragraph under "Ordinary branches are CI-only".
- `docs/receipts/DIBAYAR-VERCEL-PREDEPLOYMENT-GATE5-FIX-2026-09-28.md` — this file.

## 5. Validation (all run against this branch's working tree)

| Check | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` (Vitest) | 80 files / 771 tests passed |
| `npm run test:vercel-ignore-build` | 48 / 48 passed (was 12) |
| `git diff --check` | clean |
| `vercel.json` vs Vercel's published JSON schema (`https://openapi.vercel.sh/vercel.json`, fetched 2026-09-28, validated with the repo's ajv 6) | valid; negative control (`"**": "no"`) correctly rejected |
| Rule set evaluated with the **real** minimatch 3.1.5 (independent of the test's inline matcher) for 16 refs | matches expectation for all 16 |

Not run: `npm run build` and Playwright E2E — this change touches no application
code, only Vercel config, a shell script, its tests and docs.

New tests: exact-rule-set assertion; `ignoreCommand` retained; deploy refs
(`main`, `staging`, `preview/foo`, `preview/hermes-1`,
`preview/codex/m4-invoiced-this-month`) and CI-only refs
(`chore/workflow-ci-only-smoke`, `fix/example`, `feature/example`,
`codex/example`, `hermes/example`, an unseen prefix, `previewish-branch`,
`preview`, `main-backup`, `staging/old`, ...) against **both** layers; a
regression test showing a bare `"*"` would leave `chore/foo` deployable; and a
cross-check that both layers agree on every reviewed ref. No new dependency: the
test uses a ~15-line inline glob matcher covering only literal names, `*` and
`**`. Caveat: that matcher approximates minimatch for the constructs in use; the
real-minimatch cross-check above is a one-off, not a permanent test.

## 6. Live verification — NOT performed

No push, no Vercel/Neon access, no disposable branch. Neon is 10/10 and the
prompt forbids consuming that capacity. **Gate 5 remains pending** until, after
Chris has freed Neon capacity, a disposable ordinary branch (e.g.
`chore/vercel-predeployment-gate-smoke`) is pushed and shows:

1. no Vercel deployment created for it, and
2. no Neon preview branch created for it,

and a `preview/**` or `staging` push is shown to still deploy. Unverified
assumptions this rests on: that Vercel reads `git.deploymentEnabled` from the
pushed commit's `vercel.json` (so a branch that already carries this commit is
gated by it), and that the Neon integration only provisions on deployments
Vercel actually creates.

## 7. Why nothing was pushed

The repo's Vercel↔Neon integration currently provisions a Neon branch for
every pushed branch (that is the bug being fixed). Pushing
`fix/vercel-predeployment-branch-gate` before this lands on `main` risks
consuming Neon capacity or hitting "Resource provisioning failed" at 10/10.
Pushing/opening the PR is left for Chris after capacity is freed, or an explicit
go-ahead. Also per `CLAUDE.md`/`docs/DEVELOPMENT-WORKFLOW.md`, merging to `main`
needs Chris's authorization.

## 8. Interaction with open PR #17

PR #17 (`chore/staging-activation-2026-09-27`) rewrites the same regions of
`STATE.md`, `DEPLOYMENT.md` and `docs/DEVELOPMENT-WORKFLOW.md`. Expect merge
conflicts in whichever lands second; resolve by keeping PR #17's live-evidence
history and this branch's mechanism wording. Follow-ups deliberately **not**
made here (they are PR #17 content, absent from `main`):

- PR #17's `STATE.md` line saying closing the gap "needs a Chris dashboard check
  of the Neon-Vercel integration's own settings" and its R2 receipt's
  selective-Neon-branching workaround are now partly superseded: the repo-side
  primary gate exists; the dashboard check and workaround remain relevant only
  until live verification passes.
- `STATE.md` here still says "NOT YET LIVE-VERIFIED" for the `ignoreCommand`
  item; that remains accurate and I did not edit `STATE.md` (120-line cap, and
  it is the file PR #17 changes most).

## 9. Remaining manual steps (all Chris-only)

1. Free Neon capacity (prune the 8 merged-PR preview branches per the R2 receipt).
2. Authorize pushing this branch / opening its PR, and its merge to `main`.
3. After merge: push a disposable ordinary branch, confirm no Vercel deployment
   and no Neon branch; confirm `staging`/`preview/**` still deploy; then delete
   the disposable git branch.
4. Confirm the Vercel dashboard "Ignored Build Step" field is empty/default.
5. Remaining staging-activation items from the R2 receipt (staging Neon branch,
   Vercel staging domain, Google OAuth staging redirect, GitHub auto-delete
   head branches).
6. Only then update `STATE.md`/`docs/DEVELOPMENT-WORKFLOW.md` to mark Gate 5 verified.

## 10. Guardrails honored

No production/Neon data touched, no Neon branch created or deleted, no Vercel
env-var or dashboard changes, no OAuth or GitHub setting changes, no merge, no
push, no secrets read or printed. The only network access was two read-only
GETs of public Vercel docs/schema.
