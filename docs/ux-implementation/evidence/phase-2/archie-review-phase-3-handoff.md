<!-- Archie execution: model=claude-opus-4-8; effort=high; read-only=bwrap+Read/Glob/Grep -->

# Archie Review

## Verdict
BLOCKED_EXTERNAL

## Scope Reviewed
- Review packet: `docs/ux-implementation/evidence/phase-2/phase-3-architect-review-handoff.md` (scope/evidence index).
- Governance/source-of-truth: `STATE.md`, `CLAUDE.md`, `docs/ux-implementation/IMPLEMENTATION_PLAN.md`, `docs/ux-implementation/evidence/phase-2/GATE.md`, `t-11-report.md`, `ai-review-report.md`.
- Actual repository/Git state under `/review-target`: `.git/HEAD`, `.git/logs/HEAD`, branch `hermes/ux-phase-2`.
- Data model and security-relevant source: `prisma/schema.prisma`, `prisma/migrations/20260809064600_t11_user_settings/migration.sql`, `src/app/api/me/settings/route.ts`, `src/app/api/deals/[id]/route.ts`, `src/lib/deals.ts`, `src/app/(app)/deal/page.tsx`, `src/app/(app)/deal/[id]/page.tsx`, `src/app/(app)/layout.tsx`.
- Phase 2 T-08–T-12 status and the remaining external gate classification; architectural soundness and sequencing of T-13–T-27.
- Read-only review. No files edited/created; no command, Git mutation, build, test run, migration, DB access, deployment, or secret access performed. Some claims (test counts, browser/MCP DOM geometry, disposable-DB smoke) could not be re-executed under read-only tooling and are assessed from artifacts and source, not reproduced.

## Evidence
- **Commit chain verified against `.git/logs/HEAD`:** T-08 `7633904` → T-09 `0bb2f57` → `878d077` (T-09-scope lint fix) → T-10 `261ef05` → `a7da4c0` (docs) → T-11 `4beae09` → T-12 `5696641` → `f1c6144` (docs: agent roles). Linear ancestry on `hermes/ux-phase-2`. Matches the handoff and `ai-review-report.md`.
- **HEAD discrepancy (verified):** `.git/HEAD` → `refs/heads/hermes/ux-phase-2`; the branch tip per `logs/HEAD` is **`f1c6144`**. `STATE.md`, `GATE.md`, and `IMPLEMENTATION_PLAN.md` all state “current HEAD `5696641`” — stale by one documentation-only commit.
- **T-11 migration (`20260809064600_t11_user_settings`):** single additive `CREATE TABLE "UserSettings"`, all business fields nullable, unique index on `userId`, FK `ON DELETE CASCADE`. No NPWP/tax column. No existing table altered. Confirmed checked-in artifact only.
- **`schema.prisma`:** `UserSettings` additive/nullable, no tax fields; `Deal` has `contactWa` (no `contactName` yet — consistent with T-17 additive plan); no `DealStageTransition` model exists yet; `Invoice.deal` retains `onDelete: Restrict` (parent-relation constraint preserved).
- **Security (source-verified):** `/api/me/settings` and `/api/deals/[id]` enforce `auth()`, `isSameOriginRequest` on non-GET, Zod validation, generic error mapping, `Cache-Control: private, no-store`; settings route explicitly avoids logging body/settings. Owner scoping via `session.user.id` throughout `deals.ts`. `(app)/layout.tsx` redirects unauthenticated users for the whole group.
- **External gate (verified from records):** Preview recorded non-isolated from Production (`STATE.md`, `GATE.md`); Chris acknowledgement recorded as pending. Neither re-verifiable by this read-only pass.

## Findings

### Blocking
- **External gate 1 — Preview/Production database fingerprint isolation is unresolved.** Recorded non-isolated; the T-11 migration (and all downstream schema/capture work) must not be applied to Preview until confirmed distinct. Correctly classified as an external/environment blocker, **not an implementation defect**.
- **External gate 2 — Chris explicit acknowledgement of the Phase 2 checkpoint is pending.** Per `IMPLEMENTATION_PLAN.md` §1, Phase 2 is an acknowledgement gate; the branch must not merge and **Phase 3/T-13 must not start** until acknowledged. Correctly classified as an approval boundary (Chris). Both classifications are sound; missing evidence here is not approval.

### High
- **T-17 dependency gap for stage-history integrity.** T-15 introduces the new stage-move mutation paths (drag + adjacent-stage menu) reusing `updateDeal` (`src/lib/deals.ts`), which today performs a bare `db.deal.update` with no transition record. The `DealStageTransition` model only arrives in T-17, yet T-17 is declared to depend on **T-09 and T-13, not T-15**. As sequenced, T-15’s stage writes will not be instrumented for history, and T-17’s requirement that “current and future stage writes must be covered” cannot be met without re-opening T-15’s code. Add T-15 as an explicit T-17 dependency (or resequence the history model ahead of/with the movement work).
- **Stage change + history write must be atomic.** The plan does not state transactional integrity for T-17. A status update and its `DealStageTransition` insert (including the T-15 optimistic-move and undo/failure-revert paths) must occur in one transaction, or history can drift from `Deal.status`. Specify transactional writes and define whether a failed/undone move records nothing vs. a compensating entry.

### Medium
- **Browser-acceptance evidence is not reproducible from artifacts.** Phase 2 browser acceptance has **no persisted screenshot/PDF artifacts**; only session Chrome-DevTools-MCP DOM/geometry snapshots exist (honestly disclosed). T-04/T-05 manual checkpoint provenance is Chris-reported, not independently captured. This deviates from the plan §2 manual-evidence model (named artifact path). Acceptable to disclose, but the geometry/console claims cannot be independently re-verified until the T-27 capture matrix produces durable artifacts; do not treat them as reproducible gate evidence.
- **The fingerprint-isolation gate is a cross-phase prerequisite, not just a Phase 2 merge condition.** Unapplied migrations are accumulating (T-11 `UserSettings`; upcoming T-17 `contactName` + `DealStageTransition`; T-22 projections). Every downstream schema/Preview-capture task inherits this single external gate. Track it as a cross-phase blocker, not solely a Phase 2 merge item.
- **T-17 “history backfill” wording risks over-claiming.** Current data holds only `status` + `updatedAt`; past transitions cannot be reconstructed. Constrain the requirement to seeding a single synthetic current-stage entry and forbid fabricating prior transition dates.
- **T-15 and T-16 co-modify the deal board on divergent branches** (T-15←T-13 drag columns; T-16←T-14 snap-rail + empty-stage collapse). Desktop drag inside a collapsing/snapping rail is an interaction most likely to regress. Require explicit joint integration verification where both land, not just isolated per-task evidence.

### Low / Notes
- **`STATE.md` (declared single source of truth) is stale:** it, `GATE.md`, and `IMPLEMENTATION_PLAN.md` record HEAD `5696641`, but the branch tip is `f1c6144`. One documentation commit is unrepresented. Reconcile before Phase 3.
- **`/deal/[id]` is a placeholder** that echoes the URL id and is auth-gated only by the `(app)` group layout; a signed-in user requesting another owner’s deal id sees no data leak but also no 404 until T-17. Acceptable pending T-17, which correctly mandates second-owner 404.
- **In-memory, per-instance rate limiters** (`userSettingsRateLimiter` and family) — pre-existing, documented; revisit with a shared store before multi-instance reliance.
- **Worktree cleanliness could not be independently confirmed** (`git status` unavailable under read-only tooling); relied on the handoff’s listed dirty paths, all documentation/evidence files. `DAILY_LOG.md` preservation constraint noted.

## Required Actions
1. Resolve and record a fresh Preview≠Production fingerprint check; do not apply the T-11 migration or any Preview capture until confirmed. (External)
2. Route the `GATE.md` package to Chris for explicit Phase 2 acknowledgement; do not merge `hermes/ux-phase-2` or start T-13 before it. (Chris)
3. Before Phase 3 begins: add T-15 as a dependency of T-17 (or resequence) so stage-move mutations are covered by `DealStageTransition`, and specify atomic (transactional) status+history writes plus explicit undo/failure history semantics.
4. Reconcile the stale HEAD pointer in `STATE.md`/`GATE.md`/`IMPLEMENTATION_PLAN.md` to `f1c6144`.
5. Clarify T-17 backfill language (single current-stage seed only) and require joint T-15/T-16 board-integration evidence and durable capture artifacts (aligning Phase 2 browser claims with the T-27 matrix).

## Safe Next Step
Hold at the Phase 2 external gate: obtain the Preview/Production fingerprint-isolation confirmation and Chris’s explicit acknowledgement, and apply the plan corrections above (T-17 dependency/atomicity, backfill wording, HEAD reconciliation) to the plan documents only. Phase 2 T-08–T-12 implementation is locally sound (scope, ownership/auth, CSRF, validation, additive/nullable migration, no tax fields, restrict-delete preserved) and needs no code rework to clear this gate.

## Prohibited Next Steps
Do not merge `hermes/ux-phase-2`; do not start T-13 or any Phase 3 work; do not apply the T-11 (or any) migration to Preview/Production; do not push, deploy, or enable public/non-SSO access; do not mutate databases or access secrets; do not modify `DAILY_LOG.md` or repository source/tests/schema; and do not treat this review, the internal `ai-review-report.md`, or missing external evidence as Phase 2 approval.
