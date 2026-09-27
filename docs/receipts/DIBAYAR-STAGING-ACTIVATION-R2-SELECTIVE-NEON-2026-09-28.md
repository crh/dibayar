# Dibayar — Staging Activation R2: Selective Neon Branching

Fresh Claude Code session, 2026-09-28, continuing from the post-merge staging
activation audit. Task packet:
`DIBAYAR-STAGING-ACTIVATION-R2-SELECTIVE-NEON-2026-09-28.md` (uploaded by
Chris this session). Continued on the still-open `chore/staging-activation-2026-09-27`
branch (PR #17) rather than opening a new branch, since PR #17 is the direct,
unmerged continuation of the same staging-activation documentation effort and
Neon is already at capacity (see §3) — opening a second branch would only add
further pressure for no benefit.

**Bottom line: PRE-STAGING TRANSITION STILL NOT COMPLETE.** Gates 1 and 6
remain PASS. Gate 5 remains PARTIAL — re-confirmed unchanged, and now traced
to a specific unresolved question (whether a Neon-integration branch-pattern
allowlist exists) rather than a vague "needs investigation." Gates 2–4 remain
NOT STARTED, all Chris-only. **New and urgent: Neon capacity is now 10/10,
the hard cap** — no further branch (staging or otherwise) can be provisioned
until Chris prunes. No Production, security, or secret-handling issue was
found or introduced. No Neon, Vercel, OAuth, or GitHub setting was changed
this session.

## 1. Integration audit

- **Neon integration mode:** the Vercel-native Neon marketplace integration
  (not a manually-managed connection string only) — confirmed by the
  `DATABASE_URL_POSTGRES_URL`, `DATABASE_URL_POSTGRES_URL_NON_POOLING`,
  `DATABASE_URL_NEON_PROJECT_ID`, etc. `Config`-type variable set that
  `vercel env ls` shows scoped to `Production, Preview, Development`
  together (these are the integration's own managed references, not
  plain secrets).
- **Environments connected:** Production, Preview, and Development all carry
  the integration's `DATABASE_URL_*` Config variables. A separate, explicit
  `DATABASE_URL` Secret also exists for Production (42d old) and generic
  Preview (69d old) — set manually, not by the integration, and this is what
  `scripts/vercel-build.sh`/`src/lib/prisma.ts` actually read per
  `DEPLOYMENT.md`.
- **"Create a database branch for deployment: Preview" setting:** behavior
  is consistent with this being enabled — every pushed Git branch this
  session and the prior one received its own Neon branch, matching the
  documented default. The toggle itself could not be read or confirmed via
  CLI (see below).
- **Branch-pattern/allowlist support for database provisioning specifically:**
  **not found.** Checked `neon branches --help` and the full `neon branches`
  subcommand group (`list`, `create`, `delete`, `rename`, `reset`, `restore`,
  `set-default`, `set-expiration`, `add-compute`, `get`, `schema-diff`) —
  none scope *which* Git branches get an auto-created branch; they only
  operate on branches that already exist. Checked `vercel target list` —
  returns exactly the three built-in targets (`Production`,
  `Preview` = "All unassigned git branches", `Development`); this is
  Vercel's default target set present on every plan and is **not** evidence
  of paid Custom Environments access, and no custom environment (e.g. a
  `staging` target distinct from `Preview`) exists on this project today.
  Neither CLI exposes the Neon↔Vercel integration's own configuration panel.
  **This setting, if it exists, lives only in the Vercel dashboard's
  Integrations page for the Neon integration (or the Neon Console's
  "Connect to Vercel" panel) and needs a Chris dashboard check** — see §11.
- **Automatic branch cleanup capability:** not confirmed either way this
  session; no CLI surface for it was found. Flagged for the same Chris
  dashboard check.

## 2. Architecture

Adopted the target model from the task packet, since no live branch-pattern
allowlist was found (see §1) and none should be invented:

```text
main       -> Production Vercel                    -> persistent Neon main branch
staging    -> stable Vercel Preview branch URL      -> persistent Neon staging branch
                                                        + branch-scoped Vercel Preview env vars
feature/*
fix/*
chore/*    -> GitHub CI only, Vercel build skipped  -> NO Neon branch (target; not yet true, see §7)
preview/*  -> exceptional opt-in Vercel Preview     -> Neon branch provisioned explicitly only
                                                        when isolation is justified, deleted after use
```

This is documented in `DEPLOYMENT.md` ("Ordinary-branch Neon suppression
gap") and `docs/DEVELOPMENT-WORKFLOW.md` ("Ordinary branches are CI-only").
It is the target architecture, not yet the live state: gate 5 is still
PARTIAL (§7) until the Chris dashboard check in §11 either finds and scopes
an allowlist, or confirms none exists and automatic per-Preview Neon
branching is disabled/scoped some other way without touching Production.

## 3. Neon cleanup

- **Before (session start):** **10/10 — at the hard cap.** `main` plus 9
  preview branches.
- **Verified candidates:** the 8 branches verified merged/disposable on
  2026-09-27 are unchanged and re-confirmed via `gh pr list --state all`
  this session: `preview/codex/m4-invoiced-this-month` (PR #14, MERGED),
  `preview/codex/document-development-workflow` (PR #15, MERGED),
  `preview/codex/m4-provisional-decisions-readiness` (PR #13, MERGED),
  `preview/codex/ci-font-self-hosting` (PR #12, MERGED),
  `preview/codex/p2-4-ownership-denial` (PR #11, MERGED),
  `preview/fix/preview-neon-database-binding` (PR #7, MERGED),
  `preview/bootstrap/staging-workflow` (PR #16, MERGED),
  `preview/chore/workflow-ci-only-smoke` (no PR; disposable smoke branch,
  git branch already deleted). None is `main`/`staging`; none is referenced
  by active validation work.
- **New, explicitly excluded from the deletion candidates:**
  `preview/chore/staging-activation-2026-09-27` — created by this session's
  and the prior session's own pushes to PR #17's branch, which is **still
  open, not merged**. Do not delete this one until PR #17 merges or closes.
- **Deleted/not deleted:** **none deleted.** Neon branch deletion is
  Chris-only per `docs/DEVELOPMENT-WORKFLOW.md` "Authorization"; this session
  did not attempt it.
- **After:** unchanged, **10/10**.

## 4. Staging Neon

- Branch: does not exist.
- Parent: not yet created, so n/a; per the task packet it must be `main`'s
  Production Neon branch (`br-still-darkness-aobvo77q`) when created.
- Ready: n/a.
- Capacity: **blocked** — creating `staging` now would require exceeding the
  10-branch cap. Even after all 8 verified-disposable branches are pruned,
  capacity would be `main` + `staging` + the still-open PR #17 branch = 3/10,
  comfortably clear — but pruning must happen first.

## 5. Vercel staging

- Mechanism: not yet decided this session; unchanged from 2026-09-27's
  recommendation (Option A, stable branch Preview/alias for `staging`) —
  plan tier still not confirmed programmatically (`vercel target list`
  showing only the three default targets does not resolve whether Custom
  Environments/Option B is available; see §1).
- Stable URL: none.
- READY: n/a.
- DB isolation evidence: n/a.
- Protection: undecided (SSO), unchanged open question from §9 of the
  2026-09-27 receipt.

## 6. OAuth

- Exact staging callback: `https://<stable-staging-domain>/api/auth/callback/google`
  — confirmed again from `src/auth.ts` (`trustHost: true`, no
  `AUTH_URL`/`NEXTAUTH_URL`, default catch-all route at
  `src/app/api/auth/[...nextauth]/route.ts`). Domain still unknown, blocked
  on §5.
- Configured? No.
- Sign-in verified? No.

## 7. Gate-5 smoke R2

- **Branch used for evidence:** not a fresh disposable branch. `neon branches
  list` already showed a 9th branch, `preview/chore/staging-activation-2026-09-27`,
  created by this same PR #17 branch's own prior push (an ordinary `chore/*`
  branch) — a second, independent live instance of the exact gate-5 pattern,
  captured before this session took any deliberate action.
- **Vercel outcome:** two `Canceled` Preview deployments for this branch,
  `~4–7s` each (`vercel ls`) — the build is correctly skipped, matching the
  2026-09-27 result.
- **Neon outcome:** `preview/chore/staging-activation-2026-09-27` exists,
  `ready` (`neon branches list`) — the Neon branch was created anyway. Gap
  unchanged.
- **A fresh `chore/workflow-ci-only-smoke-r2` branch was deliberately not
  pushed this session.** Neon is already at 10/10; a new push would either
  reproduce the identical, already-proven gap, or fail outright with the
  known "Resource provisioning failed" cap symptom (`DEPLOYMENT.md`,
  "Preview failure mode") — neither outcome would add information beyond
  what the existing corroborating branch and the 2026-09-26 incident already
  establish, and it would consume attention better spent on the real
  blocker (Chris pruning + the dashboard check in §11).
- **Cleanup:** not applicable — the branch used for evidence is this
  session's own active, still-open PR #17 branch, not a disposable one.

## 8. Six gates

```text
Gate 1 — staging Git branch exists                                    PASS
  origin/staging = 4c2f868825ee03c4a6fc84c758c35c157e901246, unchanged.

Gate 2 — stable Vercel staging environment/domain                     NOT STARTED
  Chris-only; blocked on §5 and the plan-tier question.

Gate 3 — stable Neon staging branch                                   NOT STARTED
  Chris-only; blocked on Neon capacity (10/10, §3/§4).

Gate 4 — staging Google OAuth callback                                NOT STARTED
  Chris-only; blocked on gate 2 for the exact domain.

Gate 5 — ordinary branch suppression                                  PARTIAL
  Vercel build suppression: PASS, re-confirmed live a second time (§7).
  Neon branch suppression: FAIL, re-confirmed live a second time (§7).
  Root cause now scoped precisely: no Vercel/Neon-CLI-inspectable
  branch-pattern setting exists for database provisioning (§1); needs a
  Chris dashboard check (§11), not a repo-side fix.

Gate 6 — staging CI push path                                         PASS
  Run 36323868003, unchanged; not re-tested (no CI config change this
  session, so no reason to manufacture a new push per the task packet's
  own guidance).
```

**PRE-STAGING TRANSITION COMPLETE was not declared.**

## 9. Security

- Production data modified? **No.**
- Production environment changed? **No.**
- Secrets printed? **No.** `vercel env ls` output only ever showed `Hidden`
  for `Secret`-type values and the CLI's default truncated reference strings
  for `Config`-type values, exactly as before.
- OAuth secrets printed? **No.**
- Public access weakened? **No.**
- Destructive Neon deletions performed? **No.** Zero Neon branches were
  created, deleted, or modified by this session's own actions (the one new
  branch, `preview/chore/staging-activation-2026-09-27`, was a side effect
  of a prior session's push, observed not caused, by this session).
- No Vercel, Neon, OAuth, or GitHub settings were changed. One `git stash
  drop` (on this session's own, already-applied-to-working-tree stash
  duplicate) was blocked by this session's own tooling ("Irreversible Local
  Destruction"); not retried, and left as an inert, harmless duplicate stash
  entry — no data was at risk since the same content was already committed
  to the working tree and confirmed via `git diff --stat` beforehand.

## 10. Git/docs

- **Files changed:** `DEPLOYMENT.md`, `STATE.md`, `docs/DEVELOPMENT-WORKFLOW.md`,
  this receipt (`docs/receipts/DIBAYAR-STAGING-ACTIVATION-R2-SELECTIVE-NEON-2026-09-28.md`).
- **Branch:** `chore/staging-activation-2026-09-27` (PR #17, still open,
  still needs Chris's explicit authorization to merge into `main` per the
  pre-staging-transition bootstrap exception).
- **Commits:** this session's doc updates, committed on top of the existing
  PR #17 history (see git log).
- **CI:** unchanged from PR #17's existing state; will re-run automatically
  on push per the PR's normal CI trigger.
- **PR:** #17, open — this session adds to it rather than opening a new one.

## 11. Remaining Chris actions (consolidated — supersedes the 2026-09-27 packet)

**1. Neon — prune, then create `staging`** (Neon console/CLI, project
   `neon-dijual`), **urgent — capacity is at the hard cap right now:**
   - Delete these 8 verified disposable preview branches:
     `preview/codex/m4-invoiced-this-month`,
     `preview/codex/document-development-workflow`,
     `preview/codex/m4-provisional-decisions-readiness`,
     `preview/codex/ci-font-self-hosting`,
     `preview/codex/p2-4-ownership-denial`,
     `preview/fix/preview-neon-database-binding`,
     `preview/bootstrap/staging-workflow`,
     `preview/chore/workflow-ci-only-smoke`.
   - Do **not** delete `preview/chore/staging-activation-2026-09-27` yet —
     PR #17 is still open.
   - Then create a persistent branch named `staging`, parented from `main`'s
     Production Neon branch (`br-still-darkness-aobvo77q`). Never auto-prune
     it.

**2. Vercel dashboard — find or rule out a Neon database branch-pattern
   allowlist** (Vercel project `dibayar` → Integrations → Neon, or the Neon
   Console's Vercel-connection panel):
   - If a setting exists that scopes *which* Git branches get an
     auto-provisioned Neon branch (separate from the build-level
     `ignoreCommand`), scope it to `main`, `staging`, `preview/*` — the same
     allowlist `vercel.json`/`scripts/vercel-ignore-build.sh` already uses
     for builds.
   - If no such setting exists, decide whether automatic per-Preview Neon
     branching can be disabled globally without touching the Production
     binding; if the UI cannot isolate that safely, this is a standing
     limitation — periodic pruning remains the mitigation.
   - This is the single action that would actually close gate 5's Neon half;
     everything else in this packet is unblocked by capacity alone.

**3. Vercel — staging environment + stable domain** (project `dibayar`):
   - Decide Option A (stable branch Preview/alias for `staging`,
     recommended) vs. Option B (custom environment) — confirm plan tier
     first; `vercel target list` returning only the three default targets
     did not resolve whether Option B is available on this account.
   - Wire the persistent Neon `staging` branch's connection details to
     whichever environment/branch scope is chosen, using branch-specific
     Vercel Preview environment variables for the `staging` Git branch
     (`vercel env add <VARIABLE> preview staging` or current equivalent),
     plus scoped `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
   - Confirm the final stable URL — the OAuth step below depends on it.

**4. Vercel dashboard — Ignored Build Step check** (still unconfirmed
   programmatically, unchanged from 2026-09-27): Settings → Git → Ignored
   Build Step should be empty/default so `vercel.json`'s `ignoreCommand` is
   authoritative.

**5. Google Cloud Console — staging OAuth redirect:**
   - Add `https://<final-staging-domain-from-step-3>/api/auth/callback/google`
     to the OAuth client's authorized redirect URIs. Do not remove any
     existing URI. Validate with one real Google sign-in once deployed.

**6. GitHub repo settings** (unchanged, still off; this session did not
   retry the previously-blocked API attempt):
   - Settings → General → Pull Requests → enable "Automatically delete head
     branches."

---

*Prior receipts for context: `docs/receipts/DIBAYAR-STAGING-ACTIVATION-2026-09-27.md`
(the six-gate audit this continues), `docs/receipts/DIBAYAR-STAGING-BOOTSTRAP-2026-09-27.md`
(PR #16's bootstrap work, historical).*
