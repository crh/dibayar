# Dibayar V6.1 — Receipt for Next-Step Recommendation

**Audience: an independent AI agent (or reviewer) picking this up cold.**
This file is a compact, self-contained status receipt, not a decision — it
exists so you can produce a prioritized next-steps recommendation without
re-deriving the last two sessions' investigation from scratch. Read the
linked evidence for depth; don't take any claim below on faith without
checking the linked source if you're about to act on it.

Written: 2026-09-07. Repo: `crh/dibayar`. This file lives at the root of
worktree `/home/kenji/code/dibayar-v6-1-production-hardening`, branch
`hermes/v6-1-production-hardening` (based on `origin/main`).

---

## 1. How we got here (chronology, oldest first)

1. PR #2 (`hermes/v6-1-account-menu-remediation`, a UI bug fix) merged into
   `main` at `b6119d2` — see `DIBAYAR-V6-1-MERGE-HANDOFF.md` in
   `/home/kenji/code/dibayar-v6-1-account-menu-remediation`.
2. Vercel's existing GitHub integration auto-deployed that merge to
   Production. This surfaced two **pre-existing, unrelated** gaps: Production
   had no `AUTH_SECRET`/Google OAuth env vars, and zero applied Prisma
   migrations (Production had never been migrated, ever). Both were fixed at
   the user's explicit direction. Full incident narrative, verified against
   real SHAs/deployment IDs/build logs:
   `/home/kenji/code/dibayar-v6-1-account-menu-remediation/DIBAYAR-V6-1-POST-MERGE-PRODUCTION-HANDOFF.md`.
3. A follow-up "production hardening" session (this branch) was asked to
   make Preview/Production state undconflatable in docs, formalize a
   migration strategy, add a smoke check, and define a release gate. Full
   detail, findings F-1 through F-6, validation evidence:
   `docs/receipts/DIBAYAR-V6-1-PRODUCTION-HARDENING-HANDOFF.md` (same directory as this
   file).
4. Along the way, moving the Production migration fix from an undocumented
   Vercel-dashboard Build Command override into a checked-in `vercel.json`
   surfaced a real regression (unconditional `prisma migrate deploy` broke
   any Preview branch without a provisioned database) — caught by actually
   pushing and reading a real Preview build log, not by review alone. Fixed,
   re-verified on Preview. Detail: finding F-6 in the hardening handoff.

## 2. What is verified true right now

```text
main @ b6119d2 (unchanged since PR #2's merge)
hermes/v6-1-production-hardening @ 05f1e87 (3 commits ahead of main,
    pushed to origin, NOT merged)
Production (https://dibayar.vercel.app):
  - functional end-to-end (auth working, schema migrated, real Google
    sign-in completed by the user) — verified 2026-09-06 via curl and
    scripts/smoke-deployment.mjs, not merely inferred from the incident
    report
  - reachable at the Vercel edge with NO SSO/Deployment-Protection gate —
    verified live via unauthenticated curl, not assumed. This directly
    contradicts DEPLOYMENT.md's older "Production policy"/"Preview policy"
    text and several STATE.md entries, which describe Production as still
    SSO-gated. NOT confirmed as an intentional public-launch decision by
    either session. This is finding F-1 and is the single most consequential
    open fact in this whole chain.
  - still building under whatever Build Command was configured before the
    user turned off the dashboard override on 2026-09-06 — has NOT yet been
    rebuilt from the new vercel.json, because that only happens once
    hermes/v6-1-production-hardening merges into main
Preview (this branch): vercel.json verified live to be authoritative
    (dashboard override off); the DATABASE_URL-guarded build command builds
    successfully for a branch with no provisioned database
    (https://dibayar-bnb9o467r-kenji-iwakura.vercel.app, Ready, 21s)
```

## 3. Open decisions (in the order I'd weigh them, not a mandate)

Each of these needs a human (Chris) decision, not an agent's unilateral
action — flag them, don't resolve them.

1. **F-1 — is Production's public, no-SSO reachability intentional?**
   Highest-stakes because it's already live, not proposed. If "no": needs an
   actual Vercel access-control change (out of any agent's authority without
   explicit sign-off). If "yes": the in-memory/per-instance rate-limiter gap
   on public invoice-share routes (`SECURITY.md`) should probably be
   reprioritized from "tracked, not yet actioned" to active.
2. **Merge `hermes/v6-1-production-hardening` into `main`?** This is what
   actually makes Production build from the fixed `vercel.json`. Low
   technical risk (Preview-verified, doc-only diff plus one guarded build
   command), but merging to `main` auto-deploys Production per the existing
   Vercel integration — treat as a real Production-affecting action needing
   explicit go-ahead, and re-verify Production's *next* build log afterward
   rather than assuming the Preview result carries over unchanged.
3. **Keep `prisma migrate deploy` in the build command permanently, or plan
   to remove it later?** Recommended in `DEPLOYMENT.md` "Migration strategy"
   to keep permanently (idempotent, lock-guarded, now DATABASE_URL-guarded
   too) — flagged here as still a call for a human to affirm, not settle by
   default.
4. **11 Dependabot vulnerabilities (10 high, 1 moderate)** were flagged by
   GitHub on push, unrelated to this task's scope, not investigated by
   either session.
5. Carried-forward, pre-existing `STATE.md` items, unrelated to this
   incident, still open: Phase 5 (T-22–T-24) acknowledgement, merge decision
   for `hermes/ux-phase-2` overall, M4 validation/go-no-go, the provisional
   7-day due-soon window. Listed for completeness — do not treat as part of
   this hardening thread's scope.
6. Recommended (not blocking): confirm the Google OAuth client's redirect
   URIs actually include `https://dibayar.vercel.app/api/auth/callback/google`
   by checking Google Cloud Console directly (only ever inferred from the
   sign-in working); add a minimal unauthenticated DB-backed `/api/health`
   route so `scripts/smoke-deployment.mjs` can check database connectivity
   directly instead of inferring it from build logs.
7. `STATE.md`/`CLAUDE.md` on `main` are stale relative to the actual repo
   (predate T-27, the Playwright E2E suite, and PR #2 itself) beyond the
   narrow Preview/Production corrections this session made — a broader
   staleness problem, flagged as out of this session's scope, not fixed.

## 4. What I'm asking you to do

Read `docs/receipts/DIBAYAR-V6-1-PRODUCTION-HARDENING-HANDOFF.md` (findings F-1–F-6, full
validation evidence) and `DEPLOYMENT.md`'s "Current verified state",
"Migration strategy", and "Production release gate" sections for depth, then
produce a prioritized next-steps recommendation. Distinguish clearly between:

- items that need Chris's explicit decision (do not act on these — surface
  them),
- routine follow-up work an agent could reasonably do next with standing
  authorization (e.g. the health-endpoint addition), and
- anything you believe is now stale or wrong in the receipt above — say so
  rather than silently working around it.

Do not merge `hermes/v6-1-production-hardening` into `main`, do not touch
Vercel access-control/environment settings, and do not treat this receipt's
"verified true right now" section as still accurate without re-checking
anything you're about to act on — it was accurate as of 2026-09-07 but
Production is live infrastructure that can change independent of this repo.
