# Dibayar V6.1 — Production Hardening & Deployment-State Cleanup Handoff

Scope: post-incident hardening after PR #2's merge and the subsequent
Production incident (see `DIBAYAR-V6-1-POST-MERGE-PRODUCTION-HANDOFF.md`).
This session made documentation/tooling changes only. It did not touch
Production configuration, data, or access controls.

Work happened on a new branch/worktree, `hermes/v6-1-production-hardening`
(based on `origin/main` at `b6119d2`), created because the primary
`/home/kenji/code/dibayar` working copy was checked out to an unrelated,
in-progress branch (`hermes/ux-phase-2`) with its own uncommitted work. This
branch's changes are **not yet committed or pushed** — left for review first.

---

## A. Executive status

```text
PRODUCTION_STATUS=Functional end-to-end (env vars set, all 12 migrations
    applied, real Google sign-in confirmed 2026-09-06); independently
    re-verified this session via unauthenticated curl and
    scripts/smoke-deployment.mjs. NOT confirmed as an intended public launch
    — see finding F-1.
MIGRATION_STRATEGY=Currently a Vercel-dashboard-only Build Command override
    (`npx prisma migrate deploy && next build`), confirmed still active.
    Recommended: make it permanent and move it into a checked-in
    vercel.json. NOT YET IMPLEMENTED — creating vercel.json was blocked by
    this session's own tooling (see finding F-4); documented as a
    recommendation only.
POST_DEPLOY_SMOKE_CHECK=Implemented: scripts/smoke-deployment.mjs, validated
    read-only against the real Production URL.
PREVIEW_PRODUCTION_DOC_STATE=Corrected: DEPLOYMENT.md now has a "Current
    verified state" section that supersedes stale Preview/Production claims;
    STATE.md and CLAUDE.md each got a targeted correction pointing there.
    Historical entries were preserved, not rewritten.
PRODUCTION_RELEASE_GATE=Defined in DEPLOYMENT.md (MERGED -> DEPLOYED ->
    SMOKE_VERIFIED -> AUTH_VERIFIED -> MIGRATION_VERIFIED ->
    PRODUCTION_READY). PRODUCTION_READY is explicitly NOT marked, pending
    finding F-1.
```

---

## B. Findings

```text
FINDING=F-1: Production is reachable at the Vercel edge with no SSO/
    Deployment-Protection gate right now.
EVIDENCE=`curl -sD - https://dibayar.vercel.app/` returns the app's own
    Auth.js 307 redirect (not a Vercel-login 401/redirect), verified live
    2026-09-06. DEPLOYMENT.md's existing "Production policy"/"Preview
    policy" sections, and several STATE.md/SECURITY.md entries, describe
    Production as SSO-protected and assume public/non-SSO access is a
    separate, not-yet-made decision.
IMPACT=Production is effectively publicly launched (reachable, authable,
    schema-migrated) without the explicit "first production deployment,
    public launch, or real-user access" approval DEPLOYMENT.md's own
    Production policy requires. This also means the known in-memory/
    per-instance rate-limiter gap on public invoice-share routes
    (SECURITY.md) is no longer a "neither condition holds" future concern —
    the condition it was tracking against may now hold.
STATUS=OPEN — flagged in DEPLOYMENT.md, STATE.md; requires Chris's explicit
    confirmation of intent. Not fixed by this session (would require a
    Vercel access-control change, out of this session's authority without
    explicit authorization).
```

```text
FINDING=F-2: Production had zero applied Prisma migrations for its entire
    history until 2026-09-06, and was missing AUTH_SECRET/Google OAuth env
    vars — both pre-existing gaps unrelated to PR #2's actual diff
    (account-menu component only).
EVIDENCE=DIBAYAR-V6-1-POST-MERGE-PRODUCTION-HANDOFF.md §2.1-2.6; this
    session's own `vercel inspect <production-url> --logs` reconfirms the
    Build Command override still applies all 12 migrations on the latest
    deploy.
IMPACT=STATE.md's prior claims of "Production confirmed working since
    2026-08-17" and multiple "authenticated Chrome-MCP smoke" entries were,
    on inspection, evidence about Preview deployments, not this Production
    database — the docs did not distinguish which environment each success
    applied to.
STATUS=RESOLVED (the incident); the documentation gap that caused the
    confusion is addressed by this session's new "Deployment verification
    record" convention and the explicit ENVIRONMENT field it requires.
```

```text
FINDING=F-3: The migration fix relies on an undocumented, dashboard-only
    Vercel Build Command override.
EVIDENCE=`vercel inspect <latest production deployment> --logs` shows
    `Running "npx prisma migrate deploy && next build"`; no vercel.json
    exists in the repo; package.json's "build" script is still plain
    `next build`.
IMPACT=The override can be silently changed or reset by anyone with Vercel
    project access, with no code review, diff, or git history — exactly the
    "manual dashboard override" risk this task was scoped to close.
STATUS=OPEN — recommendation written into DEPLOYMENT.md's "Migration
    strategy" section; not implemented (see F-4).
```

```text
FINDING=F-4: This session could not create vercel.json.
EVIDENCE=The Write tool call for vercel.json was blocked by this session's
    local auto-mode action classifier ("Blocked by classifier") as a
    deployment-configuration change.
IMPACT=The migration-strategy recommendation in DEPLOYMENT.md is written up
    but not applied. Per the task's own guardrails (don't route around a
    denial), this session did not retry via another tool.
STATUS=OPEN — needs either the user creating vercel.json directly, or
    granting this session permission to write deployment-config files, or an
    explicit decision to keep the dashboard-only override as-is (with the
    documented risk).
```

```text
FINDING=F-5: STATE.md and CLAUDE.md on `main` are both significantly stale
    relative to the actual repository (CLAUDE.md still describes T-00–T-03
    as current with "T-04 is next"; STATE.md predates T-27, the Playwright
    E2E suite, and PR #2 entirely).
EVIDENCE=Direct read of both files on `origin/main`, compared against
    `git log --oneline origin/main` (which shows T-27, E2E, and the v6.1
    merge all present).
IMPACT=Neither document reliably reflects current UX-phase or Production
    state without cross-checking git history — this is a pre-existing,
    broader staleness problem, not one this session's narrow production-
    hardening scope should fix wholesale.
STATUS=PARTIALLY ADDRESSED — this session corrected only the specific
    Preview/Production claims relevant to this audit (see section C), and
    left a pointer in each file to DEPLOYMENT.md as the current source of
    truth for deployment state. The broader UX-phase narrative staleness is
    out of scope and flagged as an open item for whoever owns STATE.md's
    Hermes-driven update process.
```

---

## C. Changes made

- `scripts/smoke-deployment.mjs` (new) — dependency-free, non-destructive
  Preview/Production smoke check; requires explicit `--env`/`--url`, never
  defaults to Production. Validated read-only against
  `https://dibayar.vercel.app` (all 4 checks PASS).
- `DEPLOYMENT.md` (modified) — added a "Current verified state" section
  (supersedes stale Preview/Production claims, does not delete history);
  added "Migration strategy" (documents the current dashboard override,
  recommends moving it into `vercel.json`, explains why that's not yet
  done); added "Deployment verification record" convention; added
  "Post-deploy smoke check" documentation; added "Production release gate".
- `STATE.md` (modified) — marked the `production:` line stale, added a
  `production_2026-09-06:` entry with the real incident/fix summary and
  evidence; added an urgent item to `pending_from_chris` about the SSO
  finding (F-1). Left the UX-phase narrative untouched (81 -> 84 lines,
  still under the 120-line cap).
- `CLAUDE.md` (modified) — added a short correction note under "Current
  status" and under "Deployment workflow" pointing to `DEPLOYMENT.md` as
  current source of truth; did not rewrite the stale UX-phase narrative
  itself (out of scope, Hermes/`STATE.md`-owned).
- `vercel.json` — **attempted, not created** (see finding F-4).

No application source code, tests, migrations, or Production configuration
were changed by this session.

---

## D. Validation evidence

```text
$ node scripts/smoke-deployment.mjs
ERROR: --env must be exactly "preview" or "production"
(usage printed, exit 2 — confirms it never silently defaults to Production)

$ node scripts/smoke-deployment.mjs --env production --url https://dibayar.vercel.app
  [PASS] root (/) -> 307 location: /api/auth/signin?callbackUrl=%2F
  [PASS] auth signin (/api/auth/signin) -> 200
  [PASS] auth providers (/api/auth/providers) -> 200
  [PASS] auth csrf (/api/auth/csrf) -> 200
SMOKE_TEST_STATUS=PASS
```

`vercel inspect https://dibayar-mlqctm6x8-kenji-iwakura.vercel.app --logs`
(the current live Production deployment, created 2026-09-06T09:01Z, aliased
to `dibayar.vercel.app`) confirms the build ran
`Running "npx prisma migrate deploy && next build"` and all 12 migrations
re-applied cleanly (idempotent no-op, schema already current).

This session did not run `npm install`/`npm test`/`npm run lint`/
`npm run typecheck`/`npm run build` in the new worktree: the diff touches
only Markdown documentation and one new standalone Node script (no
`package.json`, application source, or test changes), and the script itself
was executed directly and behaves correctly (above). If preferred, these
gates can still be run before merging — flagging this rather than claiming
they were run.

No secret value was read, printed, or included in any file this session
touched.

---

## E. Production changes

```text
PRODUCTION_CHANGES_PERFORMED=NONE
```

All Production changes described in this handoff (env vars, migrations)
were performed in the *prior* session
(`DIBAYAR-V6-1-POST-MERGE-PRODUCTION-HANDOFF.md`), by the user or via
Vercel's own build process, not by this session. This session only read
Production's public HTTP responses and Vercel's build/deployment metadata
(no secret values, no writes).

---

## F. Remaining open items

**Blockers (need a decision before the release gate can close):**

1. F-1 — confirm whether Production being edge-reachable without SSO is
   intended. This is the single most important open item: it determines
   whether "PRODUCTION_READY" can ever be marked, and whether the
   in-memory rate-limiter gap on public invoice routes (`SECURITY.md`)
   needs to be treated as live rather than deferred.
2. F-4 — vercel.json could not be created by this session; someone needs to
   create it directly, or grant this session write access to deployment
   config, or explicitly decide to keep the dashboard-only override.
3. Decide whether to keep `npx prisma migrate deploy &&` in the build
   command permanently (recommended) or revert it now that the one-time
   backfill is done (see `DEPLOYMENT.md` "Migration strategy" for the
   tradeoffs) — not decided by either session.

**Recommended improvements (not blockers):**

- Add a minimal unauthenticated `/api/health` route (e.g. a bare `SELECT 1`)
  so `scripts/smoke-deployment.mjs` can actually check database
  connectivity instead of only inferring it from build logs.
- Confirm the Google Cloud OAuth client's authorized redirect URIs actually
  include `https://dibayar.vercel.app/api/auth/callback/google` by checking
  the Google Cloud Console directly — the prior session only inferred this
  from the sign-in working, never confirmed it directly (see that handoff's
  §5, BLOCKER_2).

**Optional future work:**

- Consider whether the distributed (non-per-instance) rate-limiting gap on
  public invoice-share routes should be prioritized now, contingent on the
  F-1 decision.
- This session's `DIBAYAR-INTERVIEW-CANDIDATE-*`, `PROMPT-*`,
  `POST_INTERVIEW_BACKLOG.md`, and similar loose files sitting untracked at
  repo root (seen in `git status` on the `hermes/ux-phase-2` working copy)
  are unrelated to this hardening task and were not touched or reviewed —
  flagging their existence only, not their content.

---

## Summary for the user

1. **What I found:** The uploaded prompt's incident narrative checked out
   against independent evidence (PR #2, merge SHA, deployment IDs, build
   logs) — it was accurate, not fabricated. Beyond that: Production is
   currently reachable at the Vercel edge with **no SSO gate at all**
   (verified live, not assumed), which none of the existing docs expected
   and which was never an explicit launch decision (finding F-1) — this is
   the one thing I'd want you to look at first.
2. **What I changed:** Added `scripts/smoke-deployment.mjs` (validated
   against real Production, read-only), and updated `DEPLOYMENT.md` /
   `STATE.md` / `CLAUDE.md` with a corrected, dated "current verified state"
   section, a Deployment Verification Record convention, and an explicit
   Production release gate — all on an unpushed local branch,
   `hermes/v6-1-production-hardening`, based on `origin/main`.
3. **What still needs a decision from you:** whether the current public,
   no-SSO reachability of Production is intentional (F-1); whether to keep
   `prisma migrate deploy` in the build command permanently, and where to
   define it (I recommend `vercel.json`, but couldn't create that file
   myself — my own tooling blocked it as a deployment-config change, see
   F-4).
4. **Is the repo safer against a repeat of this incident?** Somewhat — the
   verification-record convention and release gate exist now, so a future
   session has a documented way to tell Preview evidence apart from
   Production evidence and won't casually mark Production healthy from a
   merge alone. But the actual migration-strategy fix is still sitting in
   an unaudited Vercel dashboard setting, and Production's SSO exposure is
   still unresolved — this handoff exists specifically so those don't get
   silently carried forward again.
