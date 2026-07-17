# Dibayar deployment

## Current status

- Target: Vercel.
- M0 local scaffold: verified.
- M1 local vertical slice: implemented; 21 tests, lint, typecheck, production build, and local HTTP smoke verified.
- M1 Preview deployment: `https://dibayar-kwpldc7bh-kenji-iwakura.vercel.app` is Ready and Vercel-Authentication protected; branch alias: `https://dibayar-git-hermes-day-001-m0-bootstrap-kenji-iwakura.vercel.app`.
- Vercel project: `https://vercel.com/kenji-iwakura/dibayar`.
- GitHub linkage: Chris-confirmed connection to `https://github.com/crh/dibayar`.
- Dashboard inspection: not independently verified in the current browser session because Vercel required login.
- Production URL: `https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/`.
- Production access: URL reachable, but Vercel Authentication redirects unauthenticated visitors to Vercel login.
- Authenticated smoke: Chris confirmed the Dibayar title, Bahasa coming-soon content, absence of the default Next.js template, and approximately 390px mobile layout.
- Preview deployment: Ready; the existing Vercel Neon resource `neon-dijual` is available, but Preview and Production currently resolve to the same Neon `DATABASE_URL`; do not migrate until Preview has a separate database/branch.
- Production launch and real-user access require Chris's explicit approval.

## Local verification

From `/home/kenji/code/dibayar`:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

The M0 page is static and does not require a live PostgreSQL database, OAuth credentials, or production services to build. Prisma is configured for PostgreSQL; database migrations and user data are later-milestone work.

## Environment variables

`.env.example` contains synthetic placeholders only. For local work, copy it to `.env.local` only after confirming `.env.local` is ignored by Git:

```bash
git check-ignore .env.local
```

Never commit `.env.local`, real credentials, database URLs, OAuth secrets, or tokens. Vercel environment variables must be configured through the approved deployment environment, not source control.

## Next deployment step

The repository is already linked to Vercel and the protected production page has passed authenticated smoke. Keep it protected; do not make it public without Chris's explicit approval. Before applying M1 migrations, configure a separate Preview database and then configure `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` in the approved Vercel environment.

## Where environment values come from

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Existing Vercel Neon resource `neon-dijual` / Neon Console | Preview uses a branch-scoped connection string. The checked-in M1 migration was applied successfully to that Preview database. |
| `AUTH_SECRET` | Generate locally with `openssl rand -base64 48` | Already generated and stored as a sensitive Preview branch variable. Never commit or paste it into chat. |
| `AUTH_GOOGLE_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs | Create a **Web application** client. This is the client ID, not the secret. |
| `AUTH_GOOGLE_SECRET` | Same Google Cloud OAuth Web application | Store only in Vercel as a sensitive value. |

Google OAuth redirect URIs to add:

```text
https://dibayar-git-hermes-day-001-m0-bootstrap-kenji-iwakura.vercel.app/api/auth/callback/google
https://dibayar-kwpldc7bh-kenji-iwakura.vercel.app/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

Google setup path:

1. Open https://console.cloud.google.com/projectselector2/home/dashboard and select/create the project.
2. Configure the OAuth consent screen under **Google Auth Platform**; keep it in Testing and add Chris as a test user while validating.
3. Open https://console.cloud.google.com/apis/credentials → **Create credentials** → **OAuth client ID** → **Web application**.
4. Add the redirect URIs above and copy the generated client ID and client secret.

Add the Google values without sending them through chat:

```bash
read -rp 'Google client ID: ' GOOGLE_ID
read -rsp 'Google client secret: ' GOOGLE_SECRET; printf '\n'
vercel env add AUTH_GOOGLE_ID preview hermes/day-001-m0-bootstrap --sensitive --yes --value "$GOOGLE_ID"
vercel env add AUTH_GOOGLE_SECRET preview hermes/day-001-m0-bootstrap --sensitive --yes --value "$GOOGLE_SECRET"
unset GOOGLE_ID GOOGLE_SECRET
```

The Preview branch deployment is configured and Ready. The checked-in M1 migration was applied successfully to the Preview database. Google provider preflight reaches `accounts.google.com`; complete one real test-user login before claiming authenticated CRUD smoke.

## Preview policy

A confidential, access-restricted preview may be used for technical verification only when it contains no real customer or financial data, does not process payments, and is not announced or shared with users. An openly accessible or unrestricted preview requires Chris's approval.

## Production policy

The first production deployment, production-domain assignment, public launch, announcement, or real-user access requires Chris's approval. Routine deployments after explicit approval still require all applicable lint, typecheck, test, build, security, and smoke checks to pass. Destructive migrations, payment processing, new paid services, material data-collection changes, or material security changes require renewed approval.

## Rollback

Rollback procedure and Vercel project identifiers are not yet verified. Do not claim a deployment or rollback until the resulting Vercel status and URL have been checked directly.

## Cron preflight guard (Task E)

`scripts/cron-guard.mjs` is a dependency-free Node preflight + wrapper intended for a **future** unattended Hermes/Claude cron execution. It is not itself scheduled or enabled by this task — no cron job exists yet.

```bash
node scripts/cron-guard.mjs --check-only
node scripts/cron-guard.mjs -- <command> [args...]   # runs <command> only if READY
```

It inspects, without modifying the repo:

- the repo is a Git worktree on branch `hermes/m2-invoice` (default; `--repo`/`--date`/`--expected-branch` exist only for deterministic testing);
- the tracked/untracked working tree is clean;
- local `HEAD` equals `origin/hermes/m2-invoice` exactly (no implicit fetch — an absent, ahead, behind, or diverged remote ref fails closed);
- `STATE.md` exists and is at most 120 lines;
- the last `DAILY_LOG.md` rubric rollup for the requested Asia/Jakarta calendar day exists, all six dimensions from `REPORT_RUBRIC.md` are present exactly once as an integer `x/2`, their sum equals the reported `Total x/12`, the total is at least 10, and no dimension is `0` (a single `0` blocks regardless of total, matching the rubric's anti-gaming clause).

On any failure it prints `BLOCKED` with every failed rule name and reason and exits nonzero **without ever invoking the child command**. On success it prints `READY` and exits 0 (`--check-only`) or execs the child command via argv (no shell), from the verified repo root (the Git top-level the guard just confirmed, not the caller's `process.cwd()`), and propagates its exit code/signal. `--check-only` combined with `-- <command>` is rejected as a usage error (exit 2) before any check runs, since the command would silently never execute — that combination is ambiguous, not a no-op. Output never includes file contents, remote URLs, environment values, or credentials.

This guard is necessary but not sufficient for unattended execution: it never fetches, pushes, deploys, touches a database, or schedules/creates a cron job itself, and it says nothing about the correctness of the command it is asked to wrap. Any future cron wrapper must invoke it first and must still route all real work through the standard approval gates in this document and `REVIEW_CHECKLIST.md`.

Hardening in `50099ba` (after the initial `bee8283`): the child previously inherited the caller's `process.cwd()` instead of the verified repo root, so a cron invoked from an unrelated directory could pass the repo guard but run its command against the wrong tree; it now always runs at `repoRoot` (never printed).

Focused tests: `npm run test:cron-guard` — 28/28 passing (isolated temp Git repos and fixture files only — never the real repo). This is separate from and does not replace canonical `npm run test`.
