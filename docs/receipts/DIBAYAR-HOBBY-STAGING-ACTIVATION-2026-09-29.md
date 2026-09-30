# Dibayar — Hobby-compatible staging activation (2026-09-29 → 2026-09-30)

Outcome: **staging ACTIVE and verified.** No secrets appear in this receipt.

## Architecture
- Vercel plan: **Hobby**. No Custom Environment, no second project, no plan change.
- `staging` = Vercel **Preview** deployments of the long-lived Git branch `staging`
  (Vercel's "multiple preview phases" pattern), with branch-scoped Preview env vars.
- Persistent Neon branch `staging`; ordinary `preview/**` branches keep integration-managed Neon branches.
- Gate 5 (`vercel.json` `git.deploymentEnabled`) and Preview fail-closed DB checks unchanged.

## Refs
- PR #18 merge (Gate 5) on `main`: `d9fef8532ffa89271af2e510748f7a334ace3ad7`
- PR #19 `main -> staging` sync, merge commit (authorized by Chris): `cab167f7d1da570546ad732a565ffa257ec469ff`
- `staging` before sync: `4c2f868` (7 behind, 0 ahead)

## Phase 1 — live state (2026-09-29, unchanged vs prior receipt)
Neon `main` only; no staging-scoped Vercel vars; 0 custom domains; Vercel dashboard
`commandForIgnoringBuildStep: null`; GitHub `delete_branch_on_merge: false`.

## Neon `staging`
- Decision (Chris): **schema-only** from `main` — `docs/DEVELOPMENT-WORKFLOW.md` forbids unscrubbed Production copies.
- `neonctl branches create --name staging --parent main --schema-only`
- id `br-late-grass-aoea90yk`, init_source `parent-schema`, endpoint `ep-gentle-morning-aofsje23` (read_write), state ready.
- Row counts before baseline: all 11 application tables 0; `_prisma_migrations` 0.
- Schema parity: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → 0 (empty).
  Fingerprint (cols/idx/constraints sha256) `6b7e5bbcc6aa70fd` before and after baseline.
- Baseline: `prisma migrate resolve --applied` × 12; `migrate status` → up to date; `migrate deploy` → no pending.
- Explicit `--from-migrations` shadow diff not run (local disposable Postgres not running; Docker prohibited);
  parity argued from Production having applied exactly these 12 migrations + empty schema diff.

## Vercel variables (names/scopes only)
Preview, Git branch `staging`, sensitive: `DATABASE_URL_POSTGRES_URL` (pooled),
`DATABASE_URL_POSTGRES_URL_NON_POOLING` (direct), `AUTH_SECRET` (new, staging-only).
`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`: inherited from generic Preview (Chris decision).
Production vars unchanged. Credential scratch files deleted after each use.

## Deployment
- `dpl_CMk3N7bVwEDqRnGps6TrjWFHPjGF`, target preview, READY, build 34s; ref `staging`.
- Stable URL (branch alias): `https://dibayar-git-staging-kenji-iwakura.vercel.app`. No custom domain.
- Build log: `migrate deploy` → 12 found, no pending.

## DB isolation proof
Read-only `pg_stat_user_tables` scan counter on `Session` in Neon `staging`, sampled externally; requests
sent from an authenticated Chrome (Deployment Protection) to the staging alias. Each sample adds +1.

| UTC | event | counter | expected if not staging |
|---|---|---|---|
| 00:13:10 | baseline | 5 | — |
| 00:13:13 | baseline | 6 | — |
| 00:13:40 | after 3 requests (bogus session cookie) | 10 | 7 |
| 00:13:51 | after 3 control requests | 14 | 11 |

Each 3-request batch moved the staging counter by exactly +3 → runtime uses Neon `staging`;
branch-scoped vars beat integration Config vars. (Control did not isolate the cookie as cause; does not
affect identity.) After OAuth sign-in, the User/Account rows landed in Neon `staging`.

## Neon integration side effect
None: after the staging deployment Neon listed only `main` and `staging` (2/10).

## OAuth
Chris added `https://dibayar-git-staging-kenji-iwakura.vercel.app/api/auth/callback/google`
to the generic-Preview OAuth client; Production URIs kept. Observed extra URIs `http://localhost:3103`
and `http://localhost:3001` beyond the three-URI policy — left for Chris.

## Smoke (2026-09-30, non-destructive)
Google sign-in round trip completed (Google auto-continued with Chris's previously-consented account) →
dashboard; `/`, `/deal`, `/invoice`, `/pengaturan` render; no console errors on reload; no links to the
Production host. Staging rows now: User 1, Account 1, Session 2, AuthEvent 3 (Chris's own, consented) — retained.

## Hygiene
- Vercel Ignored Build Step: empty (`null`).
- GitHub `delete_branch_on_merge`: **enabled** 2026-09-30.

## Validation (on `d9fef85`, 2026-09-29)
lint 0 · typecheck 0 · test 0 (80 files / 771 tests) · test:vercel-ignore-build 0 · build 0 · `git diff --check` clean.
PR #19 CI (pull_request/push/schedule): success.

## Remaining
- None for staging. Gate 5 live-verified: push of ordinary `chore/staging-activation-docs-2026-09-30`
  (`ed39128`, 2026-09-30T00:19:57Z) → no Vercel deployment, no commit status, Neon unchanged. Pre-staging
  transition complete.
- Production edge/public-access intent, M4 validation — unchanged, Chris.
