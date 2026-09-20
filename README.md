# Dibayar

Dibayar is a mobile-first deal CRM, invoice, and payment-tracking app for solo Indonesian creators. It helps creators track brand deals from negotiation through payment, issue IDR invoices, share recipient-safe invoice links/PDFs, and follow up through WhatsApp.

## Current status

The engineering MVP is implemented on `main`. The latest current-truth summary is [DIBAYAR-CURRENT-TRUTH-AUDIT-2026-09-20.md](docs/status/DIBAYAR-CURRENT-TRUTH-AUDIT-2026-09-20.md). Product validation with real creators (M4) is still outstanding.

## Start here

- [STATE.md](STATE.md) — short operational status and pending decisions
- [PRODUCT.md](PRODUCT.md) — customer, problem, MVP scope, and non-goals
- [ROADMAP.md](ROADMAP.md) — milestone status
- [BACKLOG.md](BACKLOG.md) — deferred work
- [DEPLOYMENT.md](DEPLOYMENT.md) — deployment, migration, and release gates
- [SECURITY.md](SECURITY.md) — security controls and known gaps

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

The application uses Next.js, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Auth.js/Google OAuth, and Vercel. See `package.json` for E2E and UX-audit commands.

## Documentation convention

Root-level `DIBAYAR-*-RECEIPT.md` and handoff files are evidence records, not current status. Prefer `STATE.md` and the current-truth audit for present state, and check the receipt date/commit before relying on deployment claims. Historical evidence should be archived or removed only after confirming it is no longer needed.

Receipt-style evidence is organized under [`docs/receipts/`](docs/receipts/); superseded standalone receipts are under [`docs/receipts/archive/`](docs/receipts/archive/). The current-truth audit is under [`docs/status/`](docs/status/).
