# Dibayar PR #7 Post-Merge Production Verification — Receipt

## 1. Executive Summary

PR #7 (`fix: point Preview DB connections at the Neon-integration variable`) was merged manually by Chris (`crh`) into `main` via a true merge commit `f55b320`, containing the previously verified head SHA `5b68d99` as a direct parent. A new Vercel Production deployment (`dpl_FgjjknFDq5zWvcb9pudJQUb7xi1q`) was built directly from that exact commit — confirmed by the build log's own `Cloning github.com/crh/dibayar (Branch: main, Commit: f55b320)` line, not inferred. The build succeeded, the Prisma migration step ran cleanly against the Production database with no connectivity failure, and the public runtime is healthy (root correctly redirects to sign-in, Google OAuth provider is configured, no 500s, no `P1001`). Authenticated, DB-backed dashboard verification could not be completed in this session because no browser session (Claude in Chrome extension not connected) or credentials were available, and Google OAuth sign-in is an interactive action only Chris can perform.

**Final state: `MERGED_PRODUCTION_PARTIALLY_VERIFIED`**

## 2. Merge Evidence

| Field | Value |
|---|---|
| PR number | #7 |
| PR final state | `MERGED` |
| PR head SHA | `5b68d99a6205b9b7a361dcd56b2d604ed3848ffe` |
| Merge timestamp | `2026-09-18T22:46:04Z` |
| Merged by | `crh` (Christian H) |
| Merge method | True merge commit (2 parents; not squash, not rebase) |
| Merge commit / resulting `main` SHA | `f55b3205b66b88145f17a7d5cc8a2e30910a340a` |
| Merge commit parents | `282dcdeb5fd1f7d6ccce03b9710a3a83b157f3a8` (prior `main`), `5b68d99a6205b9b7a361dcd56b2d604ed3848ffe` (PR #7 head) |

**Ancestry/provenance verification:**
- `git merge-base --is-ancestor 5b68d99 origin/main` → confirmed ancestor.
- `git diff 5b68d99 f55b320 --stat` → empty (merge introduced no content drift from the verified head).
- `gh pr view 7` reports `mergeCommit.oid = f55b320...`, matching `origin/main` exactly.

## 3. Production Deployment Evidence

| Field | Value |
|---|---|
| Deployment ID | `dpl_FgjjknFDq5zWvcb9pudJQUb7xi1q` |
| Environment | Production |
| Source branch | `main` |
| Source Git SHA | `f55b320` (from build log clone step) |
| Deployment creation time | `2026-09-19T05:46:07+07:00` (`2026-09-18T22:46:09Z`) — 3 seconds after `mergedAt` |
| Deployment status | `READY` |
| Aliases | `dibayar.vercel.app`, `dibayar-kenji-iwakura.vercel.app`, `dibayar-git-main-kenji-iwakura.vercel.app` |
| Provenance match to merged `main` | Confirmed directly (build log clone line) and corroborated by content (build command match, see below) |

**Corroborating content evidence:** the deployment's resolved `vercelConfig.buildCommand` is `bash scripts/vercel-build.sh`, which exactly matches `vercel.json` at `5b68d99`/`f55b320`. The prior baseline deployment (`dpl_678ZRYXPmbt2S62MzUFwLRpC1HUz`, created `2026-09-15T16:27:46+07:00`, matching the known baseline exactly) used the old inline command (`if [ -n "$DATABASE_URL" ]; then npx prisma migrate deploy; fi && next build`, i.e. `vercel.json` at `282dcde`). This is the change PR #7 made (moving build/migration logic out of `vercel.json` into `scripts/vercel-build.sh`), so the new deployment's build command is independent confirmation it was built post-merge, not from the old baseline.

No newer Production deployment exists after `dpl_FgjjknFDq5zWvcb9pudJQUb7xi1q` — it is the current top-of-list, live deployment for all three Production aliases.

## 4. Production Build / Migration Verification

| Check | Result | Evidence |
|---|---|---|
| Deployment READY | ✅ Pass | `vercel inspect` → `status: ● Ready`, `readyState: READY` |
| Build | ✅ Pass | `✓ Compiled successfully in 2.1s`; `Finished TypeScript in 8.3s`; `Build Completed in /vercel/output [27s]` |
| Prisma migration | ✅ Pass | `12 migrations found in prisma/migrations` → `No pending migrations to apply.` (clean, already-current schema) |
| DB connectivity | ✅ Pass | `Datasource "db": PostgreSQL database "neondb", schema "public" at "[REDACTED]"` resolved without error |
| P1001 absent | ✅ Pass | No `P1001` or any Prisma error string in build log |
| App compilation | ✅ Pass | Next.js 16.3.3 (Turbopack) build completed; all 20 routes compiled; static pages generated 9/9 |

Full build log source-cloning line (verbatim, non-secret):
```
2026-09-18T22:46:09.881Z  Cloning github.com/crh/dibayar (Branch: main, Commit: f55b320)
```

## 5. Merged Source Regression Check

Confirmed by reading source at the merged commit (`5b68d99`, identical content to `f55b320`):

- **Preview runtime** (`src/lib/prisma.ts:18-24`): `if (process.env.VERCEL_ENV === "preview")` requires `DATABASE_URL_POSTGRES_URL`; throws `"DATABASE_URL_POSTGRES_URL is required for Vercel Preview database connections"` if absent. No fallback to static `DATABASE_URL`. ✅ Intact.
- **Preview migration/build** (`scripts/vercel-build.sh`): `if [ "$VERCEL_ENV" = "preview" ]` requires `DATABASE_URL_POSTGRES_URL_NON_POOLING`; exits 1 with an explicit error if absent. No fallback to static `DATABASE_URL`. ✅ Intact.
- **Production DB behavior**: unchanged — `src/lib/prisma.ts` `else` branch uses `process.env.DATABASE_URL` directly (throws only if genuinely unset); `scripts/vercel-build.sh` runs `npx prisma migrate deploy` unconditionally against whatever `DATABASE_URL` is set to when not on Preview. Production was **not** switched to Preview-specific Neon variables. ✅ Confirmed by this deployment's successful migration/build/runtime against Production's own `DATABASE_URL`.

## 6. Production Runtime Smoke Test

| Item | Result |
|---|---|
| Canonical URL | `https://dibayar.vercel.app` |
| HTTP result | `200` (final), `307` redirect `/` → `/api/auth/signin?callbackUrl=%2F` (expected auth-gated behavior) |
| Application render | ✅ Full HTML page renders (Auth.js sign-in template, CSP/HSTS/security headers present, `server: Vercel`) |
| Sign-in entry point | ✅ Renders — `<title>Sign In</title>`, `Sign in with Google` button present |
| `/api/auth/providers` | ✅ Returns Google OIDC provider config with correct `signinUrl`/`callbackUrl` |
| `/api/auth/session` (unauthenticated) | ✅ `null`, HTTP `200` (expected, no session) |
| `/dashboard` (unauthenticated) | ✅ `302` redirect (auth-gated, not a `500`) |
| Authenticated dashboard result | **Not tested** — no browser session or credentials available |
| DB-backed route result (authenticated) | **Not tested** — same limitation |
| Console/network/server errors | One `error`-level runtime log entry, self-caused: a `HEAD /api/auth/signin` request from this session's own `curl -I` probe, correctly rejected by Auth.js (`UnknownAction: Only GET and POST requests are supported`). No `P1001`, no `500`, no error from any real `GET`/`POST` traffic in the runtime log window inspected. |

**Explicitly not tested:** authenticated (Google OAuth) sign-in and any DB-backed route behind auth (e.g. Beranda/dashboard content, invoice data). This requires either an already-authenticated browser session or Chris performing an interactive Google sign-in — neither was available, and initiating OAuth sign-in on Chris's behalf is out of scope for this session regardless.

## 7. Residual Risks / Follow-ups

Carried forward only, not actioned in this session:

1. Orphaned branch-scoped Preview secrets.
2. Preview OAuth callback strategy.
3. Keep build logic in `scripts/vercel-build.sh`.
4. Local machine memory pressure affecting full local test runs.

## 8. Final Decision

```text
MERGED_PRODUCTION_PARTIALLY_VERIFIED
```

Merge provenance is verified directly (build-log clone line + ancestry + content match). The matching Production deployment is verified and successful (build, migration, DB connectivity all clean). Public Production runtime is healthy. Authenticated, DB-backed verification could not be completed: it requires an interactive Google OAuth sign-in that only Chris can perform (no browser session or credentials were available to this session). **Required next action for Chris:** sign in to `https://dibayar.vercel.app` with Google and confirm the Beranda/dashboard loads without a Prisma/database error, to upgrade this to `MERGED_AND_PRODUCTION_VERIFIED`.
