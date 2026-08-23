<!-- Archie execution: model=claude-opus-4-8; effort=high; read-only=bwrap+Read/Glob/Grep -->

I now have sufficient first-hand and artifact evidence to render the mandated verdict. This is a strictly read-only review; the deliverable is the review itself, which I return directly.

# Archie Review

## Verdict
BLOCKED_EXTERNAL

## Scope Reviewed
Independent, strictly read-only Phase 2 external-gate review of the Dibayar Preview/Production database-isolation gate, conducted after the owner-performed (Chris, outside Hermes) Vercel Production `DATABASE_URL` configuration and the new Production deployment. Working root `/review-target`, branch `hermes/ux-phase-2`. Inspected:

- Latest evidence: `docs/ux-implementation/evidence/phase-2/vercel-production-deployment-runtime-follow-up-2026-08-17.md`, `.../vercel-runtime-database-mapping-check-2026-08-17.md`, `.../vercel-neon-isolation-follow-up-2026-08-17.md`, `.../vercel-neon-isolation-check-2026-08-17.md`, `.../archie-review-vercel-neon-isolation-2026-08-17.md`
- Gate/governance: `.../phase-2/GATE.md`, `docs/ux-implementation/SECURITY_REVIEW.md` (§5), `docs/ux-implementation/IMPLEMENTATION_PLAN.md` (§1/§7 gate lines), `STATE.md`, `PROMPT-10-DIBAYAR-R1-PILOT-HANDOFF.md`
- Application DB wiring: `src/lib/prisma.ts`, `prisma.config.ts`
- Git ground truth: `.git/logs/HEAD`

Boundary honored: read-only. No files edited/created, no commands, no Git mutation, no deployment, migration, database query, Vercel/Neon config change, credential use, or secret value read/reproduced. No delegation, no T-13/T-14 start. Live Vercel env-var values, live Neon compute state, and browser-MCP captures cannot be re-executed under read-only tooling and are assessed from the recorded artifacts, not independently reproduced.

## Evidence

**Verified (first-hand from repo)**
- **App DB consumption.** `src/lib/prisma.ts:11` (runtime) and `prisma.config.ts:12` (migration datasource) consume `process.env.DATABASE_URL` **exclusively**; neither reads the shared `DATABASE_URL_PG*`/`_UNPOOLED` variables. Migrations target whatever `DATABASE_URL` is scoped to the executing environment.
- **Durable gate criterion.** `SECURITY_REVIEW.md` §5 and `IMPLEMENTATION_PLAN.md` (lines 57, 204): "Phase 2 is blocked until normalized Preview and Production **fingerprints differ**"; schema changes remain checked-in-only until a verified Preview target and approval exist.
- **Git HEAD ground truth.** `.git/logs/HEAD` final entry: `5696641 → f1c6144  docs: define Luna, Klaus, and Archie agent roles`. Live tip is `f1c6144`; the `5696641→f1c6144` delta is a single documentation-only commit.
- **Stale HEAD in durable docs.** `STATE.md` records `active_branch … HEAD 5696641`; `GATE.md` records `Current HEAD: 5696641…`. Not reconciled to `f1c6144`.
- **Governance state.** `PROMPT-10` records `execution_authorized: false`, `production_authorized: false`, autonomous/unattended false, `klaus_session: NOT_STARTED`, `delegation_id: NOT_CREATED`; Chris acknowledgement `ACKNOWLEDGED_CURRENT_SESSION` with isolation prerequisite `DURABLE_CHECK_CAPTURED_PENDING_FINAL_REVIEW`; submission of Prompt 10 explicitly not treated as acknowledgement.

**Verified (from current artifacts; not reproducible read-only)**
- **Neon endpoint separation (item 1).** `main` (branch `br-still-darkness-aobvo77q`) → `ep-nameless-salad-aoa0saz5` (ACTIVE); `preview/hermes/ux-phase-2` (corrected branch `br-holy-pond-aod80hsj`, parent `main`, Git branch `hermes/ux-phase-2`) → `ep-sparkling-sea-aon2xrb8` (SUSPENDED). Identifiers differ, owner-supplied and independently displayed in the Neon console; the earlier `404 FetchBranchWithParent` is superseded as a branch-ID transcription error.
- **Vercel env-var scope (item 2).** `DATABASE_URL` now present under exact **Production** scope; separate `DATABASE_URL` present under **Preview**, Branch `hermes/ux-phase-2`. Both under the exact variable name the app consumes.
- **New Production deployment (item 3).** Deployment `CnHyzTh8Z4Te5Yx7xcRTeUvykow6`, Status `Ready`, Environment `Production`, branch `main`, commit `e92d6e4`, domain `dibayar.vercel.app`.
- **No mutation (item 4).** All 2026-08-17 artifacts record `migration_applied: false`, `database_touched: false`, `settings_changed_by_hermes: false`; the T-11 `UserSettings` migration remains checked-in-only.
- **Evidence hygiene.** No connection strings/passwords/tokens recorded; values not accessed.

**Inference (not proven)**
- The Production `DATABASE_URL` value resolves to `main`/`ep-nameless-salad-aoa0saz5` and the Preview value resolves to `preview`/`ep-sparkling-sea-aon2xrb8`. Plausible given the two distinct scopes and two distinct endpoints, but the **value→endpoint binding was not read or fingerprinted**.

**Unknowns / limitations**
- No symmetric normalized `host|port|database` fingerprint pair was produced (the 17:58 artifact states this explicitly), so value-level Preview≠Production difference is not proven.
- Which concrete value populates Production `DATABASE_URL` was confirmed only as "Production-scoped record present," not as resolving to the `main` endpoint host.
- Preview compute is SUSPENDED (normal Neon idle), so no live connection to the preview endpoint was exercised.

## Findings

### Blocking
- **Isolation gate criterion not literally satisfied (external).** The durable gate (`SECURITY_REVIEW.md` §5 / `IMPLEMENTATION_PLAN.md`) requires normalized Preview and Production **fingerprints to differ**. The latest package produces distinct Vercel *scopes* and distinct Neon *endpoint identifiers*, but **no fingerprint pair / value-level binding proof**. By the gate's own repeatedly-stated logic ("distinct hostnames/scopes prove deployment separation only, not database-target separation"), two separately-scoped `DATABASE_URL` records likewise prove scope separation, not that their values point to different databases. The Production-record→`main` and Preview-record→preview bindings remain inferred. Missing required evidence is not approval. This is an external evidence gap, not a worktree defect.
- **Acceptance of "equivalent non-secret evidence" is an owner/governance boundary.** Whether exact env-var scope + independently verified distinct Neon endpoint identifiers may stand in for the fingerprint pair is a decision to amend/interpret the durable gate standard. That belongs to Chris/Luna, not to this independent review; I cannot unilaterally lower the recorded criterion. Until Chris explicitly accepts that equivalence (or a fingerprint/value-binding check is produced), the gate cannot be marked satisfied.

### High
- **Fail-closed migration risk.** `src/lib/prisma.ts` and `prisma.config.ts` use only `process.env.DATABASE_URL`; any migration/seed/capture run in an environment whose `DATABASE_URL` value is not proven distinct could reach Production. No migration/seed/capture may run against Preview or Production until value-level isolation is proven. The checked-in-only posture for the `UserSettings` migration correctly holds.

### Medium
- **Documentation HEAD drift (item 5).** `STATE.md` and `GATE.md` (and per the handoff, `IMPLEMENTATION_PLAN.md`) record HEAD `5696641`; live tip is `f1c6144`. Confirmed via `.git/logs/HEAD` to be a single documentation-only commit (agent roles) — no application/schema/isolation impact. Correctly classed as a documentation-reconciliation item; must be reconciled to `f1c6144` (Luna→Klaus) before Phase 3, and the Vercel-inspected Preview provenance (`5696641`) is stale-but-immaterial for the isolation question.
- **Superseded content in a live evidence artifact.** `archie-review-vercel-neon-isolation-2026-08-17.md` still treats the Neon `404` and the absent Production `DATABASE_URL` as open blockers; both are superseded by the 16:52 and 17:58 follow-ups. It should be annotated as superseded to avoid future misreading. No contradiction once read in timestamp order.

### Low / Notes
- Chris's checkpoint acknowledgement is recorded but is explicitly gated on the isolation prerequisite; acknowledgement alone does not satisfy isolation. Both must hold before merge.
- Handoff `phase2_external_gate.status: READY_FOR_FINAL_EVIDENCE_REVIEW` and `current_record` language is a readiness marker, not gate satisfaction; it must not be read as approval. Consistent with `existing_phase2_archie_result: BLOCKED_EXTERNAL`.
- Phase 2 implementation (T-08–T-12) local evidence remains sound and needs no code rework to clear this gate.

## Required Actions
**Read-only evidence to close the gap (no mutation, no secret disclosure)**
1. Produce the SHA-256 of normalized `host|port|database` for the *effective* `DATABASE_URL` in (a) Production and (b) the Preview `hermes/ux-phase-2` environment, using the existing mechanism (`SECURITY_REVIEW.md` §4/§5). Report only the two hashes and whether they differ — never raw values. This is the direct, gate-literal proof.
2. If a fingerprint pair is infeasible, durably record the value→endpoint binding read-only (which scoped value resolves to `ep-nameless-salad-aoa0saz5` vs `ep-sparkling-sea-aon2xrb8`) so the inference becomes verified.

**Owner/governance decisions (do NOT self-execute)**
3. Chris/Luna: either accept "exact env-var scope + distinct Neon endpoint identifiers" as equivalent non-secret evidence and record that amendment against the `SECURITY_REVIEW.md` §5 criterion, or require Action 1/2 before the gate is marked satisfied.
4. Reconcile stale HEAD `5696641`→`f1c6144` in `STATE.md`/`GATE.md`/`IMPLEMENTATION_PLAN.md` (documentation-only; Luna→Klaus, not Archie), per the handoff's stated T-13 precondition.

**Pass criteria to mark the gate satisfied**
- Preview `DATABASE_URL` fingerprint **≠** Production `DATABASE_URL` fingerprint (or an equivalent, Chris-accepted, durably-recorded value→endpoint binding); Production resolves to `main`, Preview to the preview branch — proven, not inferred.
- HEAD references reconciled to `f1c6144`; Chris's recorded acknowledgement then applies to a *satisfied* isolation prerequisite.
- No-secrets evidence hygiene preserved.

## Safe Next Step
Hold at the Phase 2 external gate. Capture the symmetric fingerprint pair (or Chris-accepted equivalent value→endpoint binding) in a durable follow-up artifact preserving the existing no-secrets metadata, and route the gate-standard acceptance decision plus the `5696641→f1c6144` documentation reconciliation to Chris/Luna as separately governed work. Only after the isolation gate is marked satisfied and HEAD is reconciled should the exact digest-bound T-13 Klaus delegation proposal be derived.

## Prohibited Next Steps
Do not treat domain/deployment separation, distinct env-var scopes, distinct Neon endpoint identifiers, Chris's checkpoint acknowledgement, the handoff "ready for review" marker, or this review as isolation proof or Phase 2 approval. Do not change any Vercel env var or Neon branch; do not deploy, merge, push, or apply any migration/seed/capture against Preview or Production; do not query or mutate databases; do not read or reveal secret values; do not modify repository source/tests/schema/state or `DAILY_LOG.md`; do not start T-13 or T-14; do not create a delegation/digest or invoke Klaus. `execution_authorized` remains false; status remains blocked pending external evidence and the Chris/Luna acceptance boundary.
