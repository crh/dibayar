<!-- Archie execution: model=claude-opus-4-8; effort=high; read-only=bwrap+Read/Glob/Grep -->

> **Superseded note (2026-08-17, documentation-only annotation — Luna/Klaus, not Archie):** This review's `404 FetchBranchWithParent` and "no Production-scoped `DATABASE_URL`" findings were superseded the same day by `vercel-neon-isolation-follow-up-2026-08-17.md`, `vercel-runtime-database-mapping-check-2026-08-17.md`, and `vercel-production-deployment-runtime-follow-up-2026-08-17.md`, and by the later `archie-review-final-phase2-2026-08-17.md` (verdict `BLOCKED_EXTERNAL`, pending exactly the Chris equivalent-evidence decision this file's own findings called for). That decision was subsequently made by Chris and is recorded in `docs/ux-implementation/evidence/phase-2/GATE.md`'s 2026-08-17 addendum. This file's original verdict, evidence, and findings below are preserved unchanged as the historical record of that point in the investigation and are not rewritten.

The plan-file and workflow tools are not available in this read-only session (only Glob/Grep/Read are enabled). Since the mandated deliverable is the review verdict itself, I am returning it directly. Evidence metadata is preserved exactly as recorded in the artifacts.

# Archie Review

## Verdict
BLOCKED_EXTERNAL

## Scope Reviewed
Independent, strictly read-only architecture/governance review of the Dibayar Phase 2 Preview/Production database-isolation blocker and the evidence/configuration mismatch it exposes. Inspected under working root `/review-target`:

- Durable isolation evidence: `docs/ux-implementation/evidence/phase-2/vercel-neon-isolation-check-2026-08-17.md`
- Prompt 10 handoff: `PROMPT-10-DIBAYAR-R1-PILOT-HANDOFF.md`
- Prior Archie verdict: `docs/ux-implementation/evidence/phase-2/archie-review-phase-3-handoff.md`
- Phase 2 gate + Phase 3 handoff: `docs/ux-implementation/evidence/phase-2/GATE.md`, `.../phase-3-architect-review-handoff.md`
- Governance/source-of-truth: `STATE.md`, `docs/ux-implementation/IMPLEMENTATION_PLAN.md` (§1, §7), `docs/ux-implementation/SECURITY_REVIEW.md` (§4/§5), `docs/ux-implementation/AGENT_ROLES.md`
- Application DB wiring: `src/lib/prisma.ts`, `prisma.config.ts`
- Git ground truth: `.git/logs/HEAD`

Boundary honored: read-only. No files edited/created, no commands, no Git mutation, no deployment, no migration, no database query, no Vercel/Neon config change, no secret values read or reproduced, no external contact; T-13/T-14 not started. Live env-var values, live Neon branch state, and browser-MCP captures cannot be re-executed under read-only tooling and are assessed from the artifacts, not reproduced.

## Evidence

**Verified (from artifacts/repository)**
- **Vercel mapping.** Production = branch `main` → `dibayar.vercel.app`, production source commit `e92d6e4`. Preview = branch `hermes/ux-phase-2` → `dibayar-git-hermes-ux-phase-2-kenji-iwakura.vercel.app`, deployment `AvthM1nwQ`, from commit `5696641`. Both `Ready`. Proves domain/deployment separation only.
- **Env-var metadata.** 35 visible records, `hiddenProductionEnvCount: 0`. A Preview-scoped `DATABASE_URL` exists for Git branch `hermes/ux-phase-2`; the Production filter shows **no Production-specific `DATABASE_URL`**. Neon-derived `DATABASE_URL_PGHOST`, `DATABASE_URL_PGDATABASE`, `DATABASE_URL_UNPOOLED` and related variables are **shared** across `production`, `preview`, `development`. Values not read.
- **Neon list vs detail contradiction.** List (HTTP 200) shows `main` (`br-still-darkness-aobvo77q`) and `preview/hermes/ux-phase-2` (`br-holy-pond-aod80hs`, parent `main`). `main` detail = 200, but `preview/hermes/ux-phase-2` detail/Overview/Computes = **404 `FetchBranchWithParent`**.
- **Application DB consumption.** `src/lib/prisma.ts:11` and `prisma.config.ts:12` consume `process.env.DATABASE_URL` **exclusively**; neither runtime nor migration path reads the shared `DATABASE_URL_PG*`/`_UNPOOLED` variables. Migrations target whatever `DATABASE_URL` is scoped to the executing environment.
- **Deployment/commit drift.** Inspected Preview = commit `5696641`; live branch tip (`.git/logs/HEAD`) = `f1c6144` (`docs: define Luna, Klaus, and Archie agent roles`), documentation-only. `STATE.md`, `GATE.md`, `IMPLEMENTATION_PLAN.md` still record HEAD `5696641`.
- **Gate criterion.** `SECURITY_REVIEW.md` §5 / `IMPLEMENTATION_PLAN.md` §7: earlier normalized Preview and Production fingerprints **matched**; Phase 2 is blocked until they differ; isolation remediation is a separate track. Fingerprint = normalize `host|port|database`, SHA-256 (no raw-value exposure; e.g. §4 records the local target hash `e598e921…67e368`).
- **Governance state.** Prompt 10: `status: BLOCKED`; `execution_authorized`/production/autonomous/unattended all false; Chris's Phase 2 checkpoint acknowledgement recorded for the current session, but the isolation prerequisite is explicitly `DURABLE_CHECK_CAPTURED_GATE_NOT_SATISFIED`. No delegation, no Klaus session, no T-13. Negative controls hold.

**Inference (not proven)**
- With no Production-scoped `DATABASE_URL`, Production most likely resolves `DATABASE_URL` from a shared/default Neon integration value (the `main` branch); Preview has its own branch-scoped value. They *could* differ, but this is unconfirmed because values were not read.
- The `404 FetchBranchWithParent` indicates a broken parent linkage / partially-deleted branch, or a console/API fault; either way the Preview branch cannot presently be confirmed as a live, distinct compute endpoint.

**Unknowns**
- Actual normalized fingerprint of Preview `DATABASE_URL` vs Production's effective `DATABASE_URL`.
- Whether Preview `DATABASE_URL` resolves to a live Neon compute distinct from `main`'s endpoint host.
- Which concrete variable/scope supplies `DATABASE_URL` in the Production runtime.

## Findings

### Blocking
- **Isolation gate not satisfied (external).** The 2026-08-17 check proves Vercel domain/deployment separation only; it does not produce the required symmetric normalized fingerprint pair, so Preview≠Production database targets are **not proven**. Per `SECURITY_REVIEW.md` §5 / `IMPLEMENTATION_PLAN.md` §7 the Phase 2 gate stays blocked. External/environment blocker, not an implementation defect. Missing evidence is not approval.
- **Root cause of the evidence/configuration mismatch (two compounding causes):**
  1. **Asymmetric env configuration.** A Preview-scoped `DATABASE_URL` exists but there is no comparable Production-scoped `DATABASE_URL`; the only Production-visible DB variables are the *shared* Neon-derived ones. There is thus no symmetric, normalizable Production target to fingerprint against the Preview one — the comparison the gate requires cannot be constructed from current config.
  2. **Broken/indeterminate Neon Preview branch.** The branch backing the Preview `DATABASE_URL` (`preview/hermes/ux-phase-2`) fails its detail/compute lookup (`404 FetchBranchWithParent`), so even the Preview side cannot be confirmed as a live distinct database. The recorded prior state ("earlier fingerprints matched") remains the fail-closed operative constraint until proven otherwise.

### High
- **Fail-closed migration risk.** Because both `src/lib/prisma.ts` and `prisma.config.ts` use only `process.env.DATABASE_URL`, any migration/capture run in an environment whose `DATABASE_URL` is not proven distinct could reach Production. No migration, seed, or capture may run against Preview until isolation is proven. The T-11 `UserSettings` (and later T-17) migrations correctly remain checked-in-only.
- **Shared Neon variable footgun.** The shared `DATABASE_URL_PG*`/`_UNPOOLED` variables span all environments. The app does not read them today, but any future code/build/tool deriving a connection from them would collapse Preview onto the shared/Production target. Should be scoped/removed on the remediation track.

### Medium
- **Documentation HEAD drift.** `STATE.md`, `GATE.md`, `IMPLEMENTATION_PLAN.md` record HEAD `5696641`; live tip is `f1c6144`. The `5696641→f1c6144` delta is documentation-only (agent roles) — no application/schema drift, no isolation impact — but durable state must be reconciled to `f1c6144` before Phase 3.
- **Stale Preview provenance.** Inspected Preview is `5696641`, not live HEAD `f1c6144`. Immaterial to isolation (docs-only delta); the artifact honestly notes this.

### Low / Notes
- Chris's Phase 2 checkpoint acknowledgement is recorded, but acknowledgement does **not** satisfy the separate isolation prerequisite; both must hold before merge. Submission of Prompt 10 is correctly not treated as acknowledgement.
- Evidence-artifact hygiene is good: no secret values/connection strings/passwords/cookies/tokens recorded; `secrets_exposed/settings_changed/database_touched/production_touched` all false. Preserve this standard in the follow-up.

## Required Actions

**Exact next read-only evidence steps (no mutation, no secret disclosure)**
1. **Symmetric normalized fingerprints.** Produce the SHA-256 of normalized `host|port|database` for the *effective* `DATABASE_URL` resolved in (a) Production and (b) the Preview `hermes/ux-phase-2` environment, using the existing mechanism (`SECURITY_REVIEW.md` §4/§5). Report only the two hashes and whether they differ — never raw values.
2. **Determine Production's `DATABASE_URL` source.** Read-only, confirm which variable/scope populates `DATABASE_URL` in Production (explicit Production var vs shared Neon integration var), given no Production-specific record is visible.
3. **Resolve the Neon 404.** Re-query, read-only, the `preview/hermes/ux-phase-2` branch status, operations, and endpoint/compute list; confirm whether it has a live compute whose host differs from `main`'s, or is deleting/orphaned. Distinguish a genuine broken branch from a console/API fault.
4. **Confirm drift is immaterial.** Confirm (already indicated by `.git/logs/HEAD`) that `5696641→f1c6144` is documentation-only, so no redeploy is required for the isolation question.

**Configuration reconciliation requiring Chris approval (separate governed track — do NOT self-execute)**
5. Establish an explicit, separate Production `DATABASE_URL` and a Preview `DATABASE_URL` bound to a **live, distinct** Neon branch/endpoint; and/or repair/recreate `preview/hermes/ux-phase-2` so its detail/computes resolve. Any Vercel env-var or Neon branch change is a mutation on the isolation-remediation track and needs Chris authorization.
6. Reconcile stale HEAD references (`5696641`→`f1c6144`) in `STATE.md`/`GATE.md`/`IMPLEMENTATION_PLAN.md` (documentation-only; Luna→Klaus, not Archie).

**Required safeguards**
- Fail-closed: no migration/seed/capture against Preview until fingerprints are proven distinct AND the Preview Neon branch is confirmed live.
- Normalized hashes only; never reveal or log raw `DATABASE_URL`/secret values.
- No deploy/merge/push/public-access change; do not start T-13 or T-14.
- Preserve the intentionally dirty worktree; never stage `DAILY_LOG.md`.

**Pass criteria to reopen the Phase 2 gate**
- A single durable, current check records normalized Preview `DATABASE_URL` fingerprint **≠** Production `DATABASE_URL` fingerprint.
- Neon `preview/hermes/ux-phase-2` branch detail/computes return 200 with an endpoint host distinct from `main`'s.
- Production's `DATABASE_URL` source is determinate and resolves to the Production/`main` database; Preview resolves to the preview branch — proven, not inferred.
- Durable evidence artifact updated with the same no-secrets metadata standard; HEAD references reconciled to `f1c6144`; Chris's recorded acknowledgement then applies to a *satisfied* isolation prerequisite.

## Safe Next Step
Hold at the Phase 2 external gate. Execute the four read-only evidence steps (symmetric fingerprints, Production source, Neon branch resolution, drift confirmation) and record them in a durable follow-up artifact preserving the existing no-secrets metadata. Route the isolation-remediation/env-var changes and the HEAD-reconciliation documentation edit to Chris/Luna as separately governed work. Phase 2 T-08–T-12 implementation remains locally sound and needs no code rework to clear this gate.

## Prohibited Next Steps
Do not treat domain/deployment separation, Chris's checkpoint acknowledgement, this review, or missing external evidence as isolation proof or Phase 2 approval. Do not change any Vercel env var or Neon branch, do not deploy, merge, push, apply any migration/seed/capture against Preview/Production, do not query or mutate databases, do not read/reveal secret values, do not contact external parties, do not modify repository source/tests/schema/state or `DAILY_LOG.md`, and do not start T-13 or T-14. `execution_authorized` remains false; status remains blocked.
