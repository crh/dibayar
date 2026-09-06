# Dibayar V6.1 — Production Hardening & Deployment-State Cleanup Handoff

Scope: post-incident hardening after PR #2's merge and the subsequent
Production incident (see `DIBAYAR-V6-1-POST-MERGE-PRODUCTION-HANDOFF.md`).
This session made documentation/tooling changes only. It did not touch
Production configuration, data, or access controls.

Work happened on a new branch/worktree, `hermes/v6-1-production-hardening`
(based on `origin/main` at `b6119d2`), created because the primary
`/home/kenji/code/dibayar` working copy was checked out to an unrelated,
in-progress branch (`hermes/ux-phase-2`) with its own uncommitted work.
Update 2026-09-06 (same day, later): the user created `vercel.json` and
turned off the Vercel dashboard Build Command override; this session then
committed everything (`4dc4082`, `bf57380`) and pushed the branch, which
triggered two real Preview builds — the first failed (see finding F-6), the
fix is now verified on Preview. **The branch is pushed but not yet merged
into `main` — Production has not been touched or redeployed by this
session.**

---

## A. Executive status

```text
PRODUCTION_STATUS=Functional end-to-end (env vars set, all 12 migrations
    applied, real Google sign-in confirmed 2026-09-06); independently
    re-verified this session via unauthenticated curl and
    scripts/smoke-deployment.mjs. NOT confirmed as an intended public launch
    — see finding F-1. Still running under whatever Build Command was in
    effect before the user turned off the dashboard override — not yet
    rebuilt against the new vercel.json (that requires merging to main).
MIGRATION_STRATEGY=vercel.json now checked in and verified live on Preview
    as the authoritative build command (dashboard override off, per the
    user). Command is a guarded variant of the original
    (`if [ -n "$DATABASE_URL" ]; then npx prisma migrate deploy; fi &&
    next build`), not the original unconditional string — an unconditional
    version was pushed first and broke Preview builds for any branch
    without a provisioned database (see finding F-6). NOT YET APPLIED TO
    PRODUCTION — that happens only once this branch is merged to `main`.
POST_DEPLOY_SMOKE_CHECK=Implemented: scripts/smoke-deployment.mjs, validated
    read-only against the real Production URL.
PREVIEW_PRODUCTION_DOC_STATE=Corrected: DEPLOYMENT.md now has a "Current
    verified state" section that supersedes stale Preview/Production claims;
    STATE.md and CLAUDE.md each got a targeted correction pointing there.
    Historical entries were preserved, not rewritten.
PRODUCTION_RELEASE_GATE=Defined in DEPLOYMENT.md (MERGED -> DEPLOYED ->
    SMOKE_VERIFIED -> AUTH_VERIFIED -> MIGRATION_VERIFIED ->
    PRODUCTION_READY). PRODUCTION_READY is explicitly NOT marked, pending
    finding F-1. This branch itself is currently only at MERGED=NO,
    DEPLOYED=Preview-only.
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
FINDING=F-3: The migration fix relied on an undocumented, dashboard-only
    Vercel Build Command override.
EVIDENCE=`vercel inspect <latest production deployment> --logs` (at the time
    of the initial audit) showed `Running "npx prisma migrate deploy &&
    next build"`; no vercel.json existed in the repo; package.json's
    "build" script was still plain `next build`.
IMPACT=The override could be silently changed or reset by anyone with
    Vercel project access, with no code review, diff, or git history.
STATUS=RESOLVED for the mechanism (vercel.json now exists and is verified
    live to be authoritative on Preview — see F-6 for a regression caught
    along the way). NOT YET RESOLVED for Production specifically: Production
    itself has not been rebuilt from vercel.json yet, since this branch has
    not been merged to `main`.
```

```text
FINDING=F-4: This session could not create vercel.json itself.
EVIDENCE=The Write tool call for vercel.json was blocked by this session's
    local auto-mode action classifier ("Blocked by classifier") as a
    deployment-configuration change.
IMPACT=None in the end — the user created the file directly and turned off
    the dashboard override themselves; this session did not need to route
    around the block.
STATUS=RESOLVED (worked around by the user taking the action directly, not
    by this session bypassing its own restriction).
```

```text
FINDING=F-6: The first vercel.json (unconditional `npx prisma migrate
    deploy && next build`) broke Preview builds for any branch without a
    provisioned database.
EVIDENCE=Pushing branch `hermes/v6-1-production-hardening` triggered Preview
    deployment `https://dibayar-ehi9sg174-kenji-iwakura.vercel.app`, which
    failed in 9s: `Error: The datasource.url property is required in your
    Prisma config file when using prisma migrate deploy.` `vercel env ls
    --project dibayar preview` confirmed `DATABASE_URL` is scoped only to
    three specific named branches (`hermes/ux-phase-2`, `hermes/m2-invoice`,
    `hermes/day-001-m0-bootstrap`), not to Preview generally; `prisma.config.ts`
    reads `process.env["DATABASE_URL"]` directly, which is `undefined` for
    any other branch.
IMPACT=Had this shipped as originally recommended, every future new feature
    branch — the normal case in this repo's per-branch workflow — would have
    had a broken Preview build from the first push, until someone
    provisioned a database for it. This was caught specifically because
    this hardening effort insists on a real Preview-build verification step
    before merging, rather than trusting the recommendation on paper.
STATUS=RESOLVED — vercel.json's buildCommand now guards the migration step
    with `if [ -n "$DATABASE_URL" ]; then npx prisma migrate deploy; fi`,
    so branches without a provisioned database build exactly as they did
    before vercel.json existed. Re-verified live: a second Preview build
    (`https://dibayar-bnb9o467r-kenji-iwakura.vercel.app`) completed
    successfully in 21s with the migration step visibly skipped in the
    build log.
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
  added "Migration strategy" documenting both the original dashboard
  override and the vercel.json fix, including the F-6 regression found and
  fixed via Preview-build verification; added "Deployment verification
  record" convention; added "Post-deploy smoke check" documentation; added
  "Production release gate".
- `STATE.md` (modified) — marked the `production:` line stale, added a
  `production_2026-09-06:` entry with the real incident/fix summary and
  evidence; added an urgent item to `pending_from_chris` about the SSO
  finding (F-1). Left the UX-phase narrative untouched (81 -> 84 lines,
  still under the 120-line cap).
- `CLAUDE.md` (modified) — added a short correction note under "Current
  status" and under "Deployment workflow" pointing to `DEPLOYMENT.md` as
  current source of truth; did not rewrite the stale UX-phase narrative
  itself (out of scope, Hermes/`STATE.md`-owned).
- `vercel.json` (new) — created by the user (this session was blocked from
  creating it — F-4), then fixed by this session after the F-6 regression:
  final content is
  `{"buildCommand": "if [ -n \"$DATABASE_URL\" ]; then npx prisma migrate deploy; fi && next build"}`.
- Committed as `4dc4082` (docs/script) and `bf57380` (vercel.json fix) on
  `hermes/v6-1-production-hardening`, pushed to `origin`. **Not merged into
  `main`** — Production has not been redeployed or otherwise touched.

No application source code, tests, or migrations were changed. Two Vercel
Production **configuration reads** were performed (env var names/types only,
`vercel env ls`, `vercel inspect --logs`) — no values were read or printed.
The one Production **configuration change** (turning off the dashboard Build
Command override) was made by the user, not this session.

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
(the live Production deployment as of the start of this audit, created
2026-09-06T09:01Z, aliased to `dibayar.vercel.app`, built under the
dashboard override before it was turned off) confirmed the build ran
`Running "npx prisma migrate deploy && next build"` and all 12 migrations
re-applied cleanly (idempotent no-op, schema already current).

```text
$ git push origin hermes/v6-1-production-hardening   # commit 4dc4082
-> triggered Preview deployment https://dibayar-ehi9sg174-kenji-iwakura.vercel.app
-> FAILED in 9s: "The datasource.url property is required ... when using prisma migrate deploy"
   (finding F-6 — unconditional migrate deploy breaks a branch with no DATABASE_URL)

# fixed vercel.json's buildCommand with a DATABASE_URL guard, committed bf57380, pushed again
$ git push origin hermes/v6-1-production-hardening   # commit bf57380
-> triggered Preview deployment https://dibayar-bnb9o467r-kenji-iwakura.vercel.app
-> READY in 21s. Build log:
     Running "if [ -n "$DATABASE_URL" ]; then npx prisma migrate deploy; fi && next build"
     Build Completed in /vercel/output [21s]
   (no "Applying migration" lines — correctly skipped, this branch has no DATABASE_URL)
```

This is real evidence the fix works and that the earlier version would not
have: caught before merge, via the exact "verify on Preview before touching
Production" discipline this hardening effort is meant to establish.

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

All Production changes described in this handoff (env vars, migrations from
the prior incident, and turning off the Build Command dashboard override
during this session) were performed by the user, not this session, or via
Vercel's own build process. This session only read Production's public HTTP
responses and Vercel's build/deployment metadata (no secret values, no
writes), created a new branch and pushed it (Preview-only impact), and
committed doc/tooling changes. `main` has not been touched; Production has
not been redeployed by this session or as a result of anything in it.

---

## F. Remaining open items

**Blockers (need a decision before the release gate can close):**

1. F-1 — confirm whether Production being edge-reachable without SSO is
   intended. This is the single most important open item: it determines
   whether "PRODUCTION_READY" can ever be marked, and whether the
   in-memory rate-limiter gap on public invoice routes (`SECURITY.md`)
   needs to be treated as live rather than deferred.
2. Merge `hermes/v6-1-production-hardening` into `main` (a real,
   Production-affecting decision — this session did not do this itself) and
   then verify Production's *next* build actually uses the new vercel.json
   (`vercel inspect <new production url> --logs`) rather than assuming it
   from the Preview result alone.
3. GitHub flagged 11 Dependabot vulnerabilities (10 high, 1 moderate) on the
   default branch when this branch was pushed — out of scope for this
   session, not investigated, but worth a look separately.

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
   against real Production, read-only); updated `DEPLOYMENT.md` / `STATE.md`
   / `CLAUDE.md` with a corrected "current verified state" section, a
   Deployment Verification Record convention, and a Production release
   gate. You created `vercel.json` and turned off the dashboard Build
   Command override yourself; I then caught and fixed a real regression in
   it (finding F-6 — the unconditional command would have broken every
   future new Preview branch) by pushing the branch twice and reading the
   actual Preview build logs each time, not just reasoning about it. All of
   this is committed (`4dc4082`, `bf57380`) and pushed to `origin` on
   `hermes/v6-1-production-hardening` — **not merged into `main`**.
3. **What still needs a decision from you:** whether the current public,
   no-SSO reachability of Production is intentional (F-1) — this is the one
   I'd resolve first, independent of everything else; and whether/when to
   merge this branch into `main`, which is the step that will actually make
   Production build from the new `vercel.json` (verify that build's logs
   afterward rather than assuming the Preview result carries over).
4. **Is the repo safer against a repeat of this incident?** Yes, more than
   at the last checkpoint: the migration-strategy fix is no longer a
   dashboard-only setting — it's in git, and a real bug in it was caught by
   the Preview-verification discipline this hardening effort establishes,
   before it could reach Production. What's still open: Production hasn't
   actually rebuilt from the fixed config yet (needs the merge), and
   Production's SSO exposure (F-1) is still unresolved and is arguably the
   bigger issue of the two.
