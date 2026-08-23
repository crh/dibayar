# Phase 2 Runtime Database Mapping Check — Vercel Environment Scope

- **Captured:** 2026-08-17 17:04:20 +07:00
- **Method:** authenticated Vercel console, read-only environment-variable scope inspection
- **Authorization:** Chris authorized a privacy-preserving Vercel `DATABASE_URL` hash check
- **Secrets:** no raw values, connection strings, passwords, cookies, or tokens were revealed, returned, or stored

## Results

### Preview

- Variable: `DATABASE_URL`
- Environment: `Preview`
- Branch scope: `hermes/ux-phase-2`
- Record: **present**
- Sensitive value: Vercel UI did not provide a non-mutating reveal/hash path; raw value was not accessed or recorded

### Production

- Variable: `DATABASE_URL`
- Environment: `Production`
- Record: **not present** in the Project environment-variable view

### Shared integration variables

- `DATABASE_URL_DATABASE_URL` exists with `All Environments` scope.
- The application reads `process.env.DATABASE_URL` at `src/lib/prisma.ts` and `prisma.config.ts`.
- `DATABASE_URL_DATABASE_URL` is therefore not evidence that the application receives a Production `DATABASE_URL`; it is a different variable name.

## Conclusion

```yaml
preview_database_url_record: PRESENT_BRANCH_SCOPED
production_database_url_record: ABSENT
preview_runtime_target_fingerprint: NOT_COMPUTED_SECRET_UI_BLOCKED
production_runtime_target_fingerprint: NOT_COMPUTED_NO_DATABASE_URL_RECORD
neon_endpoint_separation: CONFIRMED
runtime_mapping: NOT_PROVEN
configuration_mismatch: CONFIRMED
phase2_gate: BLOCKED_CONFIGURATION_MISMATCH
settings_changed: false
database_touched: false
production_touched: false
```

The Neon control plane shows separate endpoints, but the current Vercel project configuration does not expose an explicit Production `DATABASE_URL` matching the application’s variable name. The authorized read-only evidence step is complete. No Vercel variable, deployment, Neon branch, database, migration, credential, or production resource was changed.

## Required next action

A separate configuration change is required: define an explicit Production `DATABASE_URL` targeting the Neon `main` branch/endpoint while preserving the Preview branch-scoped `DATABASE_URL`. This is not covered by the read-only hash-check authorization and must be separately approved before execution. Afterward, redeploy or otherwise refresh the affected deployment as required by Vercel, then repeat the privacy-preserving mapping check.
