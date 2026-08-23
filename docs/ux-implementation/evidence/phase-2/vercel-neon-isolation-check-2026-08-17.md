# Phase 2 Preview/Production Isolation Check — Chrome Evidence

- **Captured:** 2026-08-17 15:23:46 +07:00
- **Method:** authenticated Chrome Windows MCP, read-only inspection
- **Project:** Dibayar / `crh/dibayar`
- **Vercel project:** `kenji-iwakura/dibayar`
- **Neon project:** `neon-dijual` (`wispy-king-47867708`)
- **Secrets:** no values, connection strings, passwords, cookies, or tokens were revealed or recorded

## Vercel deployment mapping

| Environment | Git branch | Deployment state | Domain / deployment evidence |
|---|---|---|---|
| Production | `main` | Ready | `dibayar.vercel.app`; production deployment source commit `e92d6e4` |
| Preview | `hermes/ux-phase-2` | Ready | `dibayar-git-hermes-ux-phase-2-kenji-iwakura.vercel.app`; deployment `AvthM1nwQ`; immutable deployment domain also observed |

Vercel deployment detail source:

- `https://vercel.com/kenji-iwakura/dibayar/AvthM1nwQ4wiLUWsuCzUxSVf2QLD`
- The Preview deployment is explicitly labelled `Preview` and source branch `hermes/ux-phase-2`.
- The inspected Preview deployment is from commit `5696641`, not the local checkout HEAD `f1c6144`.

## Vercel environment-variable metadata

The authenticated Vercel environment-variable API returned 35 visible records and `hiddenProductionEnvCount: 0`. Only names and scope metadata were inspected; values were discarded/not requested.

Observed records:

- Preview-specific `DATABASE_URL` exists for Git branch `hermes/ux-phase-2`.
- The Production filter shows no Production-specific `DATABASE_URL` record.
- Neon-derived variables including `DATABASE_URL_PGHOST`, `DATABASE_URL_PGDATABASE`, `DATABASE_URL_UNPOOLED`, and related variables are shared targets for `production`, `preview`, and `development`.
- The shared variable values were not revealed.

Repository usage confirms the application consumes `process.env.DATABASE_URL`:

- `src/lib/prisma.ts:11`
- `prisma.config.ts:12`

## Neon project/branch metadata

Neon project branch list returned HTTP 200 and showed:

- `main`, branch ID `br-still-darkness-aobvo77q`
- `preview/hermes/ux-phase-2`, branch ID `br-holy-pond-aod80hs`, parent `main`
- Other historical Preview branches were also listed.

The Neon `main` branch detail endpoint returned HTTP 200.

The listed `preview/hermes/ux-phase-2` branch detail endpoint returned:

- HTTP status: `404`
- Error: `FetchBranchWithParent`

The Neon branch-specific Overview and Computes pages displayed the same `FetchBranchWithParent` failure. No SQL editor was used and no database query or mutation was performed.

## Gate conclusion

```yaml
status: BLOCKED_NOT_PROVEN
preview_production_isolation: not_verified
reason:
  - "Vercel confirms distinct branch/deployment scopes, but does not expose a comparable Production-specific DATABASE_URL."
  - "Production has no visible DATABASE_URL record; only shared Neon-derived variables are visible."
  - "Neon lists preview/hermes/ux-phase-2, but its branch detail API returns 404 FetchBranchWithParent."
  - "Preview deployment is stale relative to the local checkout: 5696641 versus f1c6144."
secrets_exposed: false
settings_changed: false
database_touched: false
production_touched: false
```

Different Vercel hostnames prove deployment/domain separation only. They do **not** prove that the application database targets are different. The current live evidence is therefore insufficient to pass the Phase 2 database-isolation gate and does not authorize T-13 delegation.

## Required owner decision

Chris must resolve the configuration/evidence mismatch through one of these separately governed paths:

1. Provide a durable, current evidence source showing normalized Preview and Production database host/database fingerprints differ; or
2. Authorize a bounded configuration reconciliation that establishes explicit, separate Preview and Production `DATABASE_URL` targets, followed by a new read-only fingerprint check.

No Vercel setting, environment variable, Neon branch, deployment, or database was changed during this check.
