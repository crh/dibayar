# Dibayar deployment

## Current status

- Target: Vercel.
- M0 local scaffold: verified.
- Vercel project: `https://vercel.com/kenji-iwakura/dibayar`.
- GitHub linkage: Chris-confirmed connection to `https://github.com/crh/dibayar`.
- Dashboard inspection: not independently verified in the current browser session because Vercel required login.
- Production URL: `https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/`.
- Production access: URL reachable, but Vercel Authentication redirects unauthenticated visitors to Vercel login.
- Authenticated smoke: Chris confirmed the Dibayar title, Bahasa coming-soon content, absence of the default Next.js template, and approximately 390px mobile layout.
- Preview deployment: not separately recorded.
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

The repository is already linked to Vercel and the protected production page has passed authenticated smoke. Keep it protected; do not make it public without Chris's explicit approval.

## Preview policy

A confidential, access-restricted preview may be used for technical verification only when it contains no real customer or financial data, does not process payments, and is not announced or shared with users. An openly accessible or unrestricted preview requires Chris's approval.

## Production policy

The first production deployment, production-domain assignment, public launch, announcement, or real-user access requires Chris's approval. Routine deployments after explicit approval still require all applicable lint, typecheck, test, build, security, and smoke checks to pass. Destructive migrations, payment processing, new paid services, material data-collection changes, or material security changes require renewed approval.

## Rollback

Rollback procedure and Vercel project identifiers are not yet verified. Do not claim a deployment or rollback until the resulting Vercel status and URL have been checked directly.
