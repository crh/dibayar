# Phase 2 Preview/Production Isolation Follow-up — Neon Endpoint Verification

- **Captured:** 2026-08-17 16:52:34 +07:00
- **Method:** authenticated Chrome Windows MCP, read-only Neon console inspection
- **Project:** `neon-dijual` (`wispy-king-47867708`)
- **Secrets:** no connection strings, passwords, cookies, tokens, or secret values were revealed or recorded

## Owner-supplied identifiers

Chris supplied these identifiers in the current session:

- Production/main: `ep-nameless-salad-aoa0saz5`
- Preview `hermes/ux-phase-2`: `ep-sparkling-sea-aon2xrb8`

The Neon console independently displayed the same identifiers.

## Neon verification

### Production

- Branch: `main`
- Branch ID: `br-still-darkness-aobvo77q`
- Postgres service: enabled
- Primary compute: `ep-nameless-salad-aoa0saz5`
- Compute status: `ACTIVE`
- Branch detail/Computes page: loaded successfully

### Preview

- Branch: `preview/hermes/ux-phase-2`
- Correct branch ID: `br-holy-pond-aod80hsj`
- Parent branch: `main`
- Git branch: `hermes/ux-phase-2`
- Git commit: `5696641`
- Neon-linked Preview deployment: present
- Primary compute: `ep-sparkling-sea-aon2xrb8`
- Compute status: `SUSPENDED`
- Branch detail/Computes page: loaded successfully

## Correction to the earlier check

The earlier 404 result used an incorrectly transcribed branch ID that omitted the trailing `j` (`br-holy-pond-aod80hs`). The correct ID is `br-holy-pond-aod80hsj`, and its branch detail/Computes page now returns successfully. The earlier 404 therefore does not establish a broken Neon branch; it was an evidence-collection transcription error and is superseded by this follow-up.

## What this proves

- Neon has separate `main` and `preview/hermes/ux-phase-2` branches.
- Their primary compute/endpoint identifiers differ:

```text
main:                  ep-nameless-salad-aoa0saz5
preview/hermes/ux-phase-2: ep-sparkling-sea-aon2xrb8
```

- The Preview branch is linked to the expected Vercel Git branch and deployment commit.
- This is strong, current evidence of Neon control-plane endpoint separation.

## Remaining application-target limitation

The Vercel environment metadata check remains asymmetric:

- Preview has a branch-specific `DATABASE_URL` for `hermes/ux-phase-2`.
- No Production-specific `DATABASE_URL` record was visible.
- Shared Neon-derived variables target Production, Preview, and Development.
- The application consumes `process.env.DATABASE_URL`.

Therefore, the current evidence proves distinct Neon branch/compute identities, but does not yet prove the effective runtime mapping:

```text
Production process.env.DATABASE_URL -> main / ep-nameless-salad-aoa0saz5
Preview process.env.DATABASE_URL    -> preview/hermes/ux-phase-2 / ep-sparkling-sea-aon2xrb8
```

No secret value was revealed to establish this mapping. The strict Phase 2 gate remains blocked pending either a privacy-preserving effective-target fingerprint pair or an equivalent durable Vercel-to-Neon mapping.

```yaml
neon_endpoint_separation: CONFIRMED
preview_branch_live_in_console: CONFIRMED
previous_neon_404: SUPERSEDED_TRANSCRIPTION_ERROR
runtime_database_mapping: NOT_PROVEN
phase2_gate: BLOCKED_MAPPING_NOT_FULLY_PROVEN
settings_changed: false
database_touched: false
production_touched: false
```

## Safe next step

Use Vercel’s authenticated read-only environment/deployment metadata to establish the effective `DATABASE_URL` source for Production and Preview. Record only normalized host/port/database fingerprints or endpoint identifiers; never reveal raw connection strings. Do not change Vercel variables, Neon branches, deployments, migrations, or databases without separate approval.
