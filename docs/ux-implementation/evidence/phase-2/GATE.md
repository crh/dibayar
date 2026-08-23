# Phase 2 Gate Evidence — IA split

**Date:** 2026-08-09
**Scope:** T-08 (Beranda), T-09 (deal route extraction), T-10 (invoice list route), T-11 (settings/issuer/bank/templates), T-12 (remove legacy dashboard composite)
**Branch:** `hermes/ux-phase-2`
**Current HEAD:** `f1c61448d64bcfa749ac9dd7f896db89cfc0ce9e` (`docs: define Luna, Klaus, and Archie agent roles`) — reconciled 2026-08-17 from the stale `5696641` (`T-12: remove legacy dashboard composite`) recorded at this gate's original close; the `5696641→f1c6144` delta is documentation-only (Luna/Klaus/Archie role definitions), with no application/schema/isolation impact. See the 2026-08-17 addendum at the end of this file.

## Status

**Local implementation and local automated/browser validation are complete for T-08 through T-12. This gate is NOT closed for merge: merge and Phase 3 have not started.** Per `IMPLEMENTATION_PLAN.md` §5, the Phase 2 gate requires Preview and Production database fingerprints to differ, and requires Chris's explicit acknowledgement before merge. As of the 2026-08-17 addendum at the end of this file, both criteria are recorded as satisfied — isolation via Chris-accepted equivalent evidence, and acknowledgement as separately recorded in `PROMPT-10-DIBAYAR-R1-PILOT-HANDOFF.md`. **Merge, T-13 execution, migration, and push remain separately not authorized.**

## Task commit chain

| Task | Status | Commit |
|---|---|---|
| T-08 — Beranda | Accepted | `7633904` |
| T-09 — Deal route extraction | Accepted | `0bb2f57` |
| Pre-T-10 correction (T-09-scope lint fix) | Accepted prerequisite | `878d077` |
| T-10 — Invoice list route | Accepted | `261ef05` |
| T-11 — Settings, issuer, bank, templates | Accepted | `4beae09` |
| T-12 — Remove legacy dashboard composite | Accepted | `5696641` |

T-11 was previously stopped by a bounded-worker max-turns exhaustion and recorded NOT ACCEPTED/NOT COMMITTED (see the "History" section below and `docs/ux-implementation/evidence/phase-2/t-11-report.md`). It has since been implemented, independently verified, and committed as `4beae09`. This gate supersedes that earlier stopped-worker status.

## Criterion ledger

| Criterion | Type | Result |
|---|---|---|
| `npm test` (68 files / 616 tests) | Automated | Pass |
| `npm run typecheck` | Automated | Pass |
| `npm run lint` | Automated | Pass |
| `npm run build` | Automated | Pass |
| `npx prisma validate` | Automated | Pass |
| `git diff --check` | Automated | Pass |
| Focused T-12 route/component suite (24/24) | Automated | Pass |
| T-08 focused + canonical gates | Automated | Pass (recorded at T-08 acceptance; see `t-08-report.md`) |
| T-09 focused suite (11/11) + typecheck + diff checks | Automated | Pass (recorded at T-09 acceptance) |
| T-10 isolated/focused/broader suites (10/10, 37/37, 55/55) + typecheck/lint/prisma/diff | Automated | Pass (recorded at T-10 acceptance; see `t-10-report.md`) |
| T-11 settings/API tests, owner isolation, reload persistence, disposable PostgreSQL CRUD/isolation smoke, log-redaction checks | Automated | Pass (independently verified at T-11 acceptance) |
| T-12 import-count grep (no `dashboard-client`/`DashboardClient` reference outside one absence-asserting comment) | Automated | Pass |
| Route/geometry/console browser pass (see below) | Manual/Hermes-captured | Pass |
| Preview/Production database fingerprint isolation | External gate | **Satisfied 2026-08-17 by Chris-accepted equivalent evidence (exact Vercel `DATABASE_URL` scopes + distinct Neon endpoint identifiers); literal symmetric fingerprint pair was never produced — see the 2026-08-17 addendum below** |
| Chris explicit acknowledgement | External gate | **Obtained (recorded in `PROMPT-10-DIBAYAR-R1-PILOT-HANDOFF.md`); the isolation prerequisite that had gated it is satisfied by the 2026-08-17 addendum below** |

## Automated evidence detail (post-T-12, this closeout)

- `npm test`: **68 test files, 616 tests passed**.
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- `npm run build`: **PASS**.
- `npx prisma validate`: **PASS**.
- `git diff --check`: **PASS**.
- Focused T-12 route/component suite: **24 passed, 0 failed**.

T-11 automated evidence (settings/API tests, owner isolation, reload persistence, disposable local-PostgreSQL CRUD/isolation smoke, log-redaction checks) was independently verified at T-11 acceptance; see the commit `4beae09` diff and `docs/ux-implementation/IMPLEMENTATION_LOG.md` for the exact figures. Prior T-08/T-09/T-10 automated evidence is recorded in their respective `t-08-report.md`, `t-09-report.md`, `t-10-report.md` files and in `IMPLEMENTATION_LOG.md`; it is not restated in full here to avoid inventing numbers not directly reverified in this pass.

## Browser evidence (Hermes-captured, Chrome DevTools MCP, authenticated local `http://localhost:3104`)

**Not Preview or Production.** Routes checked: `/`, `/deal`, `/invoice`, `/pengaturan`, `/dashboard` (redirect), `/dashboard/invoices/cmsjsbrzs0006plb30h4581g7`.

- Emulated viewport widths: 320, 390, 768, 1024, 1440 for the primary page routes. Every checked cell had document/body scroll width no greater than the viewport width — no horizontal overflow found.
- Root (`/`) has exactly three section regions and no legacy dashboard composite landmarks.
- `/deal` exposed the stage controls and populated Invoice stage without overflow.
- `/invoice` exposed the owner invoice link and Sent grouping without overflow.
- `/pengaturan` exposed the language section, ID-only WhatsApp templates, missing-settings notice, and no duplicate language selector in AccountMenu; no overflow.
- Language round-trip: selecting Indonesia produced `document.lang=id` and Indonesian headings; English was then restored.
- AccountMenu opened with only Settings and Sign out.
- `/dashboard` navigated to `/`.
- Invoice detail rendered the dependency notice, withholding-tax display, and no NPWP field; no overflow at any of the five widths.
- Final console error/warn scan: no messages found.
- **No screenshot artifact was captured.** This is recorded honestly; the evidence is the recorded MCP snapshots/DOM geometry, not screenshots.
- Only reversible local language-preference toggling occurred. No invoice/deal/share/payment/message/destructive mutation, deployment, public-access, or credential action occurred.

## Schema and migration

T-11 added one additive, nullable-field table: `UserSettings` (one-to-one with `User`, `onDelete: Cascade`, no NPWP/tax fields), via migration `20260809064600_t11_user_settings`. `npx prisma validate` passes against this schema. This migration exists only as a checked-in artifact; it has not been applied to any Preview or Production database (Phase 2 schema changes remain checked-in-only per `IMPLEMENTATION_PLAN.md` §1 until a separate verified Preview target and approval exists).

## Known issues / deviations

- No screenshot artifacts exist for the Phase 2 browser pass; MCP-recorded DOM/geometry snapshots are the evidence of record instead.
- Comprehensive browser acceptance for T-08–T-10 was originally deferred to "the comprehensive Phase 2 pass after T-12" per their individual reports; that comprehensive pass is the browser evidence recorded in this gate file.
- Preview was recorded elsewhere in the repository (`STATE.md`) as non-isolated from Production as of the last literal fingerprint check; that constraint is superseded as of 2026-08-17 by Chris's explicit acceptance of equivalent evidence (see the addendum below). No literal symmetric fingerprint pair was ever produced.

## Repository instruction updates

`STATE.md`, `docs/ux-implementation/IMPLEMENTATION_PLAN.md`, and `docs/ux-implementation/IMPLEMENTATION_LOG.md` were updated in this same documentation pass to reconcile stale "T-11/T-12 pending" language with the current accepted/committed status recorded here.

## Proceed / correct / stop recommendation

**As of 2026-08-17: both external gate criteria are recorded as satisfied — do not merge and do not start Phase 3 without a separate, explicit merge/execution decision.** All five Phase 2 tasks (T-08–T-12) are implemented, committed, and locally verified by both automated gates and an authenticated local browser pass. The two external blockers recorded at this gate's original close are now resolved:

1. Preview/Production database isolation — satisfied by Chris's explicit acceptance of equivalent evidence (exact Vercel `DATABASE_URL` scopes plus distinct Neon endpoint identifiers); see the 2026-08-17 addendum below.
2. Chris's explicit acknowledgement of the Phase 2 checkpoint — obtained; recorded in `PROMPT-10-DIBAYAR-R1-PILOT-HANDOFF.md`.

Satisfying these two gate criteria is not itself a merge or T-13-execution authorization. **Merge, T-13 implementation, any migration apply, and any push remain not authorized** and require their own separate, explicit go-ahead.

## Acknowledgement status

**Chris's Phase 2 checkpoint acknowledgement is obtained, and the isolation prerequisite that had gated it is satisfied as of the 2026-08-17 addendum below. Phase 3 has not started. No merge has occurred and none is authorized by this record; a separate explicit merge decision is still required.**

---

## History — T-11 stopped-worker attempt (superseded)

For the historical record: on 2026-08-09, an earlier T-11 attempt was delegated to a single bounded Claude Code worker (`CLAUDE_MAX_TURNS=50`), which exhausted its turn bound without a final report or a commit. That attempt's only preserved artifact was a partial, uncommitted `UserSettings` schema/migration. It was documented as NOT ACCEPTED/NOT COMMITTED in `docs/ux-implementation/evidence/phase-2/t-11-report.md` and `docs/ux-implementation/evidence/phase-2/phase-2-recovery-report.md`, both of which remain unchanged as historical evidence of that stopped attempt. T-11 was subsequently restarted, completed, independently verified, and committed as `4beae09`, as recorded in the ledger above. Neither historical report should be read as describing the current, accepted T-11 implementation.

---

## 2026-08-17 reconciliation addendum — external isolation gate satisfied by Chris-accepted equivalent evidence

**Scope of this addendum:** documentation-only. No migration, database query/mutation, Vercel/Neon configuration change, deployment, push, merge, or T-13/T-14 work occurred as part of recording this addendum.

**Owner decision.** Chris explicitly stated: *"I accept the exact Vercel `DATABASE_URL` environment scopes plus distinct Neon endpoint identifiers as equivalent evidence for the Phase 2 isolation criterion. Proceed with documentation-only gate reconciliation."* This is a governed, owner-authorized amendment to how the isolation criterion below may be satisfied for this gate; it does not delete or rewrite the original criterion.

**Original criterion (preserved, unchanged, as the historical/technical standard).** `SECURITY_REVIEW.md` §5 and `IMPLEMENTATION_PLAN.md` §7 require normalized Preview and Production `DATABASE_URL` **fingerprints** (SHA-256 of normalized `host|port|database`) to differ. That literal symmetric fingerprint pair was never produced for Preview vs. Production, and raw `DATABASE_URL` values were never read to compute one. This limitation stands as a permanent, honest record and is not being retroactively claimed as met.

**Equivalent evidence accepted in its place, exactly as recorded in the prior same-day artifacts:**
- Production `DATABASE_URL` exists under exact **Production** environment scope in Vercel.
- Preview `DATABASE_URL` exists under exact **Preview** environment scope, restricted to Git branch `hermes/ux-phase-2`, in Vercel.
- Production/`main` Neon endpoint identifier: `ep-nameless-salad-aoa0saz5`.
- Preview/`hermes/ux-phase-2` Neon endpoint identifier: `ep-sparkling-sea-aon2xrb8` (distinct from the Production endpoint identifier).
- Production deployment `CnHyzTh8Z4Te5Yx7xcRTeUvykow6` is `Ready`, environment `Production`, branch `main`, commit `e92d6e4`, serving `dibayar.vercel.app`.
- Raw `DATABASE_URL` values were **not accessed or recorded** in producing this evidence; only variable names, environment scopes, and Neon endpoint identifiers were observed.
- The Vercel environment-variable configuration and the Production deployment were performed **by Chris, outside Hermes** — Hermes did not change any Vercel/Neon configuration or trigger any deployment.
- Full evidence chain: `docs/ux-implementation/evidence/phase-2/vercel-neon-isolation-check-2026-08-17.md`, `.../vercel-neon-isolation-follow-up-2026-08-17.md`, `.../vercel-runtime-database-mapping-check-2026-08-17.md`, `.../vercel-production-deployment-runtime-follow-up-2026-08-17.md`, `.../archie-review-vercel-neon-isolation-2026-08-17.md` (superseded, annotated in place), `.../archie-review-final-phase2-2026-08-17.md` (final independent review, verdict `BLOCKED_EXTERNAL` pending exactly this Chris decision).

**Deployed commit vs. local branch HEAD — distinct facts, not conflated.** The Production deployment above serves commit `e92d6e4`, which is **not** the current local `hermes/ux-phase-2` branch tip. The local branch HEAD as of this addendum is `f1c61448d64bcfa749ac9dd7f896db89cfc0ce9e` (`docs: define Luna, Klaus, and Archie agent roles`), a later, documentation-only commit than the `5696641` (`T-12: remove legacy dashboard composite`) previously recorded at the top of this file. Neither `e92d6e4` nor `5696641` nor `f1c6144` introduces any application/schema change relevant to the isolation question; the "Current HEAD" field at the top of this file has been reconciled to `f1c6144` to remove the stale reference, and this addendum records both commit identities exactly rather than merging them into one.

**Effect on this gate's criterion ledger.** The "Preview/Production database fingerprint isolation" and "Chris explicit acknowledgement" rows above are updated to **Satisfied** / **Obtained** on the strength of this addendum. This does **not** by itself authorize merge, Phase 3, or T-13 implementation — those remain a separate, explicit decision. `T-13` status remains `NOT_STARTED`; `execution_authorized` remains `false`; no migration apply, push, or merge is authorized by this addendum.
