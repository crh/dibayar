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
| `DATABASE_URL` | Existing Vercel Neon resource `neon-dijual` / Neon Console | The database exists. Current Vercel Preview and Production values are identical. Enable Preview Branching under the resource's Advanced Options → Deployments Configuration; the current Vercel CLI cannot toggle this setting. |
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

After the separate Preview `DATABASE_URL` and Google values are configured, redeploy the branch, pull the Preview env into a temporary local file, and run the checked-in migration only against that Preview database.

## Preview policy

A confidential, access-restricted preview may be used for technical verification only when it contains no real customer or financial data, does not process payments, and is not announced or shared with users. An openly accessible or unrestricted preview requires Chris's approval.

## Production policy

The first production deployment, production-domain assignment, public launch, announcement, or real-user access requires Chris's approval. Routine deployments after explicit approval still require all applicable lint, typecheck, test, build, security, and smoke checks to pass. Destructive migrations, payment processing, new paid services, material data-collection changes, or material security changes require renewed approval.

## Rollback

Rollback procedure and Vercel project identifiers are not yet verified. Do not claim a deployment or rollback until the resulting Vercel status and URL have been checked directly.
