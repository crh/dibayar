# Dibayar Preview DB Fail-Closed Hardening — Receipt

## 1. Executive Summary

- Preview database selection now **fails closed**: both the runtime Prisma client (`src/lib/prisma.ts`) and the build/migration script (now `scripts/vercel-build.sh`, invoked from `vercel.json`) require the Neon integration-managed Preview variables (`DATABASE_URL_POSTGRES_URL` / `DATABASE_URL_POSTGRES_URL_NON_POOLING`) and throw/exit clearly instead of silently falling back to the stale static `DATABASE_URL` secret when either is missing.
- All local gates (lint, typecheck, unit tests, build) pass on commit `5b68d99`.
- The first push (`98d6260`) put the fail-closed shell logic inline in `vercel.json`'s `buildCommand`, which exceeded Vercel's undocumented-until-you-hit-it 256-character schema limit; the deployment errored before running any build step. Follow-up commit `5b68d99` moved the identical logic into `scripts/vercel-build.sh` — same behavior, no length limit. That deployment reached `READY`, and the build log confirms Prisma migration connected to the Preview Neon branch.
- Chris added the branch-alias callback URL (`https://dibayar-git-fix-preview-neon-database-binding-kenji-iwakura.vercel.app/api/auth/callback/google`) as an authorized redirect URI in Google Cloud Console. With that in place, Google sign-in succeeded on the branch-alias Preview URL and the dashboard rendered its real DB-backed empty state ("Belum ada deal") with a clean `200` — no P1001, no error page.
- **Final decision: `READY_TO_MERGE`** — code, local gates, Preview build, Preview migration, and a live authenticated DB-backed request are all verified against commit `5b68d99`.

## 2. Root Cause / Risk Addressed

The prior code (PR #7 head `f62078e`) correctly preferred the Neon integration's per-branch Preview variable, but fell back to the static `DATABASE_URL` secret whenever that variable was absent. That static secret is a plain Vercel Secret set ~58 days ago and does not track Neon branch lifecycle — it previously pointed at a Neon branch that was deleted during a branch-limit cleanup, causing Preview to serve `P1001: Can't reach database server` (or, worse, to silently succeed against the wrong/stale branch). A missing integration variable is not a benign condition; it is the exact signal that the branch-specific database is not properly bound for this deployment, so continuing with a fallback reintroduces the original incident's failure mode. Fail-closed behavior turns a silent, latent misconfiguration into an immediate, visible build/runtime failure.

## 3. Files Changed

```
path: src/lib/prisma.ts
change: On VERCEL_ENV=preview, require DATABASE_URL_POSTGRES_URL; throw
        "DATABASE_URL_POSTGRES_URL is required for Vercel Preview database
        connections" if absent, with no fallback to DATABASE_URL. Non-preview
        behavior (DATABASE_URL, including its own missing-value error) is
        unchanged.
reason: Removes the silent runtime fallback that could serve a stale/wrong
        database on Preview.

path: vercel.json
change: buildCommand now checks DATABASE_URL_POSTGRES_URL_NON_POOLING first
        when VERCEL_ENV=preview; if absent it prints
        "ERROR: DATABASE_URL_POSTGRES_URL_NON_POOLING is required for Vercel
        Preview migrations" to stderr and exits 1 before any migration or
        build step runs. If present, behavior is unchanged (exported as
        DATABASE_URL for `prisma migrate deploy`, then `next build`).
        Production/other environments are untouched.
reason: Removes the silent migration-time fallback to the static
        DATABASE_URL; makes the failure obvious in the Vercel build log.

path: src/lib/prisma.test.ts
change: Replaced the "Preview falls back to DATABASE_URL when the
        integration variable is absent" test with "fails closed on Preview
        when the integration variable is absent, without falling back to
        DATABASE_URL" — it now asserts the client throws the specific
        configuration error instead of asserting a fallback connection
        string was used. The other three tests (binds instance methods;
        prefers the Neon pooled URL on Preview; ignores the Preview variable
        outside Preview) are unchanged and still pass.
reason: Encodes the new fail-closed contract as a regression test and
        proves the old silent-fallback behavior no longer exists.

path: scripts/vercel-build.sh (new file)
change: Same fail-closed build/migration logic originally written inline in
        vercel.json's buildCommand, moved into a script and invoked as
        `bash scripts/vercel-build.sh`.
reason: vercel.json's buildCommand has a 256-character schema limit; the
        inline version (348 chars) was silently rejected by Vercel
        ("buildCommand should NOT be longer than 256 characters"), which is
        what caused the first Preview deployment (98d6260) to error before
        running any build step. This has nothing to do with the DB-selection
        logic itself — only where it lives.
```

## 4. Runtime Behavior Matrix

| Environment | Runtime DB variable | Migration DB variable | Fallback allowed? |
|---|---|---|---|
| Preview | `DATABASE_URL_POSTGRES_URL` | `DATABASE_URL_POSTGRES_URL_NON_POOLING` | No — throws / exits 1 if missing |
| Production | `DATABASE_URL` | existing production behavior (unchanged) | N/A |
| Local/dev | existing `DATABASE_URL` behavior (unchanged) | existing behavior (unchanged) | N/A |

## 5. Tests

```
lint:       PASS — 0 errors, 0 warnings (npm run lint, ESLint JSON output over full repo)
typecheck:  PASS — no output/errors (npm run typecheck)
tests:      PASS — 766 passed / 766 total, 79 test files (npm test, Vitest)
build:      PASS — next build (Turbopack) compiled successfully, all 21 routes generated
```

## 6. Preview Deployment Evidence

First attempt (superseded):
```
deployment ID:     dpl_FEReYCeeLCsuRi5PieB2Qi3LJBsB
deployment status: ERROR
branch:            fix/preview-neon-database-binding
commit SHA:        98d62606fee52a75a6898e8efa4bf98091421d36
root cause:        vercel.json's buildCommand (348 chars) exceeded Vercel's
                    256-character schema limit — confirmed via the Vercel
                    dashboard's "Build Failed" panel: "The `vercel.json`
                    schema validation failed with the following message:
                    `buildCommand` should NOT be longer than 256 characters."
                    (Not visible via `vercel inspect --logs` or the REST API
                    for a deployment that never reached READY — the
                    dashboard UI was the only source that showed it.)
migration result:  did not run — config was rejected before any build step
```

Second attempt (current, successful):
```
deployment ID:     dpl_3HaY9VxMxWrRFRZQvVcXTAuyFz1s
deployment status: READY
branch:            fix/preview-neon-database-binding
commit SHA:        5b68d99a6205b9b7a361dcd56b2d604ed3848ffe
duration:          32s (Build Completed in /vercel/output in 22s)
migration result:  SUCCESS — build log: connected to PostgreSQL database
                    "neondb", "12 migrations found in prisma/migrations",
                    "No pending migrations to apply." (i.e. already
                    up to date against the Preview Neon branch)
build result:      "✓ Compiled successfully in 1397ms"
```

Confirmed via the Vercel REST API that deployment `dpl_3HaY9VxMxWrRFRZQvVcXTAuyFz1s`'s `gitSource.sha` matches commit `5b68d99` exactly, and via the build-events log that the migration step ran and found the Preview Neon branch already migrated (12/12 applied) — proving `DATABASE_URL_POSTGRES_URL_NON_POOLING` was present and used, since its absence would have exited the build with code 1 before Prisma ran at all.

## 7. Runtime DB Verification

```
PASS
```

Sequence:
1. Initial attempts on both the ephemeral deployment URL and the branch-alias URL failed with Google OAuth `Error 400: redirect_uri_mismatch` — neither `.../api/auth/callback/google` URL was a registered authorized redirect URI yet.
2. Chris added `https://dibayar-git-fix-preview-neon-database-binding-kenji-iwakura.vercel.app/api/auth/callback/google` as an authorized redirect URI in Google Cloud Console.
3. Re-tested from a fresh browser tab: navigated to the branch-alias URL, clicked "Sign in with Google" (explicit user approval given for this specific action), and the OAuth flow completed and redirected back into the app.
4. The resulting page (`GET /`, status `200`) rendered the real authenticated "Beranda" dashboard — sidebar nav (Beranda/Deal/Invoice/Pengaturan), header actions, and the app's own empty-state copy "Belum ada deal" / "Catat deal pertama untuk mulai melacak pemasukan." This route is server-rendered on demand (`ƒ /`) and reads deals via Prisma for the authenticated user, so this 200 response is itself the DB-backed request.
5. Checked browser console (no errors matching `error|P1001|prisma`) and network requests (all first-party requests `200`; the only non-200 was `vercel.live`'s unrelated feedback-widget script at `503`) — no connection error, no error page.

No Deployment Protection bypass was used or needed once the OAuth redirect URI was fixed; Deployment Protection had already been passing for the authenticated browser session throughout.

## 8. Environment Variable Findings

Names/scopes only, from `vercel env ls preview` (values not read):

```
DATABASE_URL                            Secret  Preview                              58d old (the stale static secret referenced in the incident)
DATABASE_URL_POSTGRES_URL               Config  Production, Preview, Development     65d old (Neon integration-managed)
DATABASE_URL_POSTGRES_URL_NON_POOLING   Config  Production, Preview, Development     65d old (Neon integration-managed)
+ several other DATABASE_URL_* Config entries (host/user/password/etc. sub-fields) from the same Neon integration, same scope/age
```

Stale/orphaned entries found (read-only; not modified, per task scope):
```
AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, DATABASE_URL — each also present as
branch-scoped Preview overrides for old Hermes branches that likely no longer exist:
  Preview (hermes/m3-chasing)
  Preview (hermes/m2-invoice)
  Preview (hermes/day-001-m0-bootstrap)
```
These are candidates for a separate cleanup pass; they were not touched here.

## 9. Residual Risks

- The Google OAuth redirect URI fix in §7 was scoped to the branch-alias URL for this one branch (`fix/preview-neon-database-binding`). A different feature branch's Preview deployment will need its own redirect URI added the same way (or a project-wide solution — e.g. a Vercel custom domain assigned to the Preview environment — if this comes up often).
- The orphaned per-branch secrets in §8 remain in place and are a minor lingering attack-surface/confusion risk (unused credentials for branches that may no longer exist).
- `vercel.json`'s 256-character `buildCommand` limit is easy to hit again silently if someone later edits `scripts/vercel-build.sh`'s invocation back into an inline string; worth keeping the logic in the script file going forward.

## 10. Merge Recommendation

```
READY_TO_MERGE
```

Code changes are correct, all local gates pass, the Preview deployment for the final commit (`5b68d99`) is `READY`, its build log confirms the migration ran against the correct Neon integration-managed variable with no fallback, and a live authenticated DB-backed request against that deployment succeeded with no connection error. I did not merge PR #7 myself — this is a recommendation for Chris/Luna to act on.
