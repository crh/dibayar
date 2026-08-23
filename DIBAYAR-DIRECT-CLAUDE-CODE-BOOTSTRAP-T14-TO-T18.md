# Dibayar Direct Claude Code Bootstrap — T-14 through T-18

## Purpose

You are working **directly for Chris** on the Dibayar SaaS repository.

Hermes orchestration and governance are temporarily bypassed for this Dibayar development sequence.

This is an explicit owner-directed Claude Code implementation session.

Do not invoke or wait for:

```text
Hermes
Luna
Klaus
Archie
Scribe
Mira
Scout
R1 envelopes
delegation ledgers
proposal digests
Prompt 11 / 12 / 12.1 governance closure
Hermes owner-identity approval
```

Existing Hermes artifacts remain historical project evidence only.

Your task is to continue Dibayar Phase 3 from **T-14 through T-18**, sequentially.

---

# 1. Repository

Repository:

```text
/home/kenji/code/dibayar
```

Expected branch:

```text
hermes/ux-phase-2
```

Before modifying anything:

1. enter the repository;
2. run `git status --short`;
3. verify current branch;
4. verify current HEAD;
5. read `.hermes.md`;
6. read `IMPLEMENTATION_PLAN.md`;
7. read `STATE.md`;
8. read `IMPLEMENTATION_LOG.md`;
9. inspect the T-13 commit and final implementation;
10. inspect current Phase 3 code and tests.

Actual repository state is authoritative.

If T-13 is not complete or current repository state materially conflicts with the Phase 3 plan:

```text
STOP
REPORT THE CONFLICT
```

Do not silently repair unrelated historical work.

---

# 2. Preserve Existing Work

The worktree may contain unrelated or intentionally uncommitted files.

Preserve them.

Never use:

```text
git add .
git add -A
git reset --hard
git clean -fd
```

Use selective staging only.

Do not overwrite or revert unrelated local work.

Before and after each task, inspect:

```text
git status --short
git diff --check
```

---

# 3. Operating Method

Work sequentially:

```text
T-14
→ verify
→ focused local commit

T-15
→ verify
→ focused local commit

T-16
→ verify
→ focused local commit

T-17
→ verify
→ focused local commit

T-18
→ verify
→ focused local commit

→ final Phase 3 verification
→ final report
→ STOP
```

Do not combine multiple tasks into one commit.

Do not start the next task until the current task:

```text
meets its acceptance criteria
passes relevant verification
has a reviewed final diff
has one focused local commit
```

If a task requires material scope expansion, stop before expanding it and report why.

---

# 4. Global Development Boundaries

Authorized:

```text
local application source changes
local test changes
local Prisma/schema source changes required by T-17
local migration-file creation where required
local tests
local typecheck
local lint
local build
local browser verification
local disposable development-database verification if already safely configured
selective local commits
durable implementation-log updates
```

Not authorized:

```text
push
merge
deploy
Vercel mutation
Preview mutation
Production mutation
Preview/Production database migration
Preview/Production database query or mutation
credential or secret changes
permission/public-access changes
external messages
actual WhatsApp message sending
financial actions
destructive operations
dependency/provider/runtime changes unless strictly required and explicitly reported first
Hermes repair
Hermes source changes
Hermes profile changes
```

If any task requires one of the prohibited actions:

```text
STOP BEFORE THE ACTION
REPORT WHAT IS REQUIRED
```

---

# 5. T-14 — URL-Bound Stage Filter

## Goal

Make the deal-board stage filter URL-bound so the selected stage is shareable, reload-safe, and browser-navigation friendly.

## Acceptance intent

The selected stage/filter must be represented in the URL using the project's existing routing/search-param conventions.

Expected behavior:

```text
default state remains sensible when no stage filter exists
selecting a stage updates the URL
reloading preserves the selected filter
back/forward navigation restores the correct filter
invalid/unknown stage values fail safely
filter state is not duplicated unnecessarily in conflicting local state
existing bilingual behavior remains intact
existing deal-board functionality remains intact
```

Prefer the repository's existing URL/search-param patterns.

Do not introduce a new routing abstraction unless required.

## Verification

At minimum verify:

```text
initial/default filter
valid stage URL
invalid stage URL
filter interaction updates URL
reload preservation
back/forward behavior where testable
390px behavior
1440px behavior
both supported languages where practical
```

Run focused tests plus relevant project gates.

## Commit

Create one focused local commit for T-14.

Then continue to T-15.

---

# 6. T-15 — Stage Movement: Drag/Drop + Adjacent Menu

## Goal

Enable clear, recoverable stage movement.

T-15 is the highest-complexity UI task in this sequence.

Implement it conservatively.

The intended interaction includes:

```text
drag/drop stage movement
adjacent-stage movement via a menu/control
clear optimistic feedback where appropriate
safe failure/recovery behavior
```

## Required principles

Preserve:

```text
keyboard accessibility
pointer accessibility
mobile usability
existing card semantics
existing stage ordering
data integrity
```

Do not make drag/drop the only way to move a deal.

Provide an accessible non-drag mechanism for stage movement.

The adjacent-stage control should make common movement easy without exposing unnecessary complexity.

## Optimistic behavior

If existing architecture supports optimistic updates:

```text
show immediate movement
retain enough prior state to recover
restore prior state on failure
surface failure clearly
avoid duplicate writes
```

Do not invent a complex global state framework solely for this task.

## Scope checkpoint

Before implementation, inspect the existing deal/stage mutation path.

If T-15 unexpectedly requires:

```text
schema changes
new backend architecture
new third-party drag/drop dependency
database redesign
broad state-management rewrite
```

stop and report before proceeding.

If a small existing dependency or native mechanism already supports the design, prefer that.

## Verification

Test at minimum:

```text
successful stage move
adjacent-stage move
no-op/current-stage handling
failure rollback/recovery
keyboard-accessible alternative
drag/drop behavior where test environment supports it
mobile-width usability
desktop-width usability
no duplicate stage mutations
```

Run focused tests plus relevant project gates.

## Commit

Create one focused local commit for T-15.

Then continue to T-16.

---

# 7. T-16 — Narrow Stage Rail / Empty-Stage Collapse

## Goal

Improve deal-board density and scanning by making the stage rail narrower and handling empty stages more intelligently.

## Acceptance intent

Implement the planned Phase 3 behavior for:

```text
narrower stage rail
empty-stage collapse / compact representation
clear stage identity
usable drop/move target where T-15 requires it
responsive behavior
```

Do not hide information required to understand the board.

An empty/collapsed stage must remain discoverable and usable.

Preserve interaction compatibility with T-15.

## Verification

Check:

```text
stage with deals
empty stage
collapsed empty stage
restoring/opening empty stage if applicable
T-15 move/drop compatibility
390px
1440px
both supported languages where practical
```

Run focused tests plus relevant project gates.

## Commit

Create one focused local commit for T-16.

Then continue to T-17.

---

# 8. T-17 — Deal Detail + Stage History

## Goal

Add the planned deal-detail experience and durable stage-history model.

Known planned additive data changes include:

```text
contactName
DealStageTransition
```

Inspect the current implementation plan and Prisma schema before changing anything.

The actual repository plan is authoritative.

## Data-model principles

Changes must be additive where possible.

Do not destructively alter existing production data assumptions.

Expected conceptual behavior:

```text
deal detail exposes relevant deal information
contactName is supported where planned
stage transitions are represented durably
stage-history entries retain enough information to explain movement
existing deals remain compatible
```

Use existing owner scoping / authorization conventions.

Do not weaken tenant/user isolation.

## Migration boundary

You MAY:

```text
edit Prisma schema locally
create the migration source/files required by the task
run prisma validate
run generated-client/type checks
run migration tests against a disposable LOCAL database if already safely configured
```

You MUST NOT:

```text
apply migration to Preview
apply migration to Production
query Preview/Production merely to test this task
mutate Preview/Production data
change database credentials
```

If migration generation itself would connect to a non-local shared database:

```text
STOP
DO NOT RUN IT
```

Create the schema/code work and report the remaining migration-generation requirement.

## Stage-history integration

Ensure T-15 stage movement uses the final T-17 history mechanism as intended.

Avoid duplicate or contradictory history writes.

Test direct/adjacent/drag stage movement paths as relevant.

## Verification

At minimum:

```text
Prisma/schema validation
relevant generated types
deal-detail tests
contactName behavior
transition-history creation logic
history ordering/display
owner-scope/access tests
existing deal compatibility
T-15 integration regression
typecheck
lint
build where practical
```

## Commit

Create one focused local T-17 commit containing only the local implementation and safe migration artifacts.

Do not apply the migration externally.

Then continue to T-18 if all local checks pass.

---

# 9. T-18 — Repairable WhatsApp Action

## Goal

Implement the planned WhatsApp action so it is useful but remains recoverable and does not silently cause an external side effect.

## Safety principle

The application may prepare/open a WhatsApp intent/link.

The implementation must not automatically send a message.

The user remains the final sender.

## Acceptance intent

Implement the planned repairable WhatsApp behavior using existing deal/contact data.

Expected qualities:

```text
clear action
valid WhatsApp URL/intent construction
safely encoded message parameters
missing/invalid phone data handled cleanly
user can correct/repair data when necessary
no automatic external message is sent
mobile and desktop behavior are sensible
```

Use the project's current product wording and localization conventions.

Do not add external messaging infrastructure if a client-side WhatsApp intent/deep link satisfies the product requirement.

## Verification

Test at minimum:

```text
valid phone number
missing phone number
invalid/repairable phone number
message encoding
expected WhatsApp URL construction
no automatic network/message send in tests
keyboard accessibility
390px
1440px
both supported languages where practical
```

## Commit

Create one focused local commit for T-18.

---

# 10. Per-Task Verification Discipline

For every task T-14 through T-18:

1. run the smallest focused tests first;
2. inspect failures rather than weakening tests;
3. run relevant broader tests;
4. run typecheck;
5. run lint;
6. run `git diff --check`;
7. run build where practical;
8. perform browser verification where the task has visual/interaction acceptance;
9. inspect the final diff yourself;
10. selectively stage;
11. inspect staged diff;
12. create one focused local commit.

Do not claim PASS solely because a command exited zero if the behavior has not been inspected.

---

# 11. Final Phase 3 Verification

After T-18 is committed, run a full Phase 3 verification pass.

At minimum, where available:

```text
full test suite
typecheck
lint
build
prisma validate
git diff --check
```

Also perform a final browser walkthrough across the Phase 3 functionality:

```text
deal card
URL stage filter
stage movement
adjacent-stage control
stage rail / empty stages
deal detail
stage history
WhatsApp action
```

Check approximately:

```text
390px
1440px
```

Check both supported languages where practical.

---

# 12. Final Repository Review

At the end:

```text
git status --short
git log --oneline for T-14 through T-18
git diff --check
```

Confirm:

```text
one focused commit per task
no unrelated changes accidentally committed
no push occurred
no deploy occurred
no external database migration occurred
no external WhatsApp message was sent
```

Preserve unrelated pre-existing worktree changes.

---

# 13. Final Report

Write a concise final report containing:

```yaml
phase: Dibayar Phase 3
mode: direct Claude Code
hermes_used: false

starting_branch:
starting_head:
ending_head:

tasks:
  T-14:
    status:
    commit:
    files:
    verification:
    notes:

  T-15:
    status:
    commit:
    files:
    verification:
    notes:

  T-16:
    status:
    commit:
    files:
    verification:
    notes:

  T-17:
    status:
    commit:
    files:
    verification:
    migration_files_created:
    migration_applied_external: false
    notes:

  T-18:
    status:
    commit:
    files:
    verification:
    external_message_sent: false
    notes:

final_verification:
  tests:
  typecheck:
  lint:
  build:
  prisma_validate:
  diff_check:
  browser_390:
  browser_1440:
  bilingual:

remaining_worktree_changes:
remaining_external_actions:
known_risks:
recommended_next_step:
```

Explicitly answer:

```text
Are T-14 through T-18 locally complete?
YES / NO / PARTIALLY
```

If `PARTIALLY`, identify exactly which task/gate remains.

---

# 14. Stop Boundary

After T-18 and final Phase 3 verification:

```text
STOP
```

Do not:

```text
push
merge
deploy
apply migrations to Preview/Production
perform production database work
send external WhatsApp messages
```

Those are separate owner-directed actions.

---

# Execute Now

1. Reconstruct repository state.
2. Verify T-13 is complete.
3. Implement T-14 and commit.
4. Implement T-15 and commit.
5. Implement T-16 and commit.
6. Implement T-17 and commit local-safe artifacts only.
7. Implement T-18 and commit.
8. Run final Phase 3 verification.
9. Produce the final report.
10. Stop before all external/release actions.

Hermes remains bypassed for this entire sequence.
