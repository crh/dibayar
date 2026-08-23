# Dibayar Direct Claude Code Bootstrap — T-13

## Purpose

You are working **directly for Chris** on the Dibayar SaaS repository.

This is an explicit owner-directed Claude Code development session.

Hermes orchestration and governance are temporarily bypassed for this Dibayar implementation session.

Do not attempt to repair Hermes governance.

---

# 1. Operating Mode

For this session:

```text
Claude Code = direct implementation agent for Chris
Hermes = bypassed
Luna = not used
Klaus = not used
Archie = not used
Scribe = not used
Mira = not used
Scout = not used
```

Do not wait for:

```text
Hermes delegation records
R1 envelopes
proposal digests
Prompt 11 / 12 / 12.1 closure
Hermes owner-identity approval
Hermes profile invocation
```

Existing Hermes reports remain historical project evidence only.

This direct mode is temporary and applies only to local Dibayar development.

---

# 2. Repository

Repository:

```text
/home/kenji/code/dibayar
```

Expected branch:

```text
hermes/ux-phase-2
```

Before modifying anything:

1. run `git status --short`;
2. verify current branch;
3. verify current HEAD;
4. inspect the current worktree;
5. read `.hermes.md`;
6. read `IMPLEMENTATION_PLAN.md`;
7. read `STATE.md`;
8. read `IMPLEMENTATION_LOG.md`;
9. inspect relevant Phase 2 / Phase 3 evidence;
10. inspect current code before trusting historical handoffs.

Actual repository state is authoritative.

If repository state conflicts materially with this bootstrap:

```text
STOP
REPORT THE CONFLICT
```

---

# 3. Preserve Existing Work

The Dibayar worktree may contain unrelated or intentionally uncommitted changes.

Preserve them.

Do not use:

```text
git add .
git add -A
git reset --hard
git clean -fd
```

Do not overwrite or revert unrelated local work.

Use selective staging only.

---

# 4. Current Product State

Phase 2 has already been implemented and validated.

Remaining Phase 3 sequence:

```text
T-13 — Slim deal card
T-14 — URL-bound stage filter
T-15 — Stage movement / drag-drop + adjacent menu
T-16 — Narrow stage rail / empty-stage collapse
T-17 — Deal detail + stage history
T-18 — Repairable WhatsApp action
```

Work sequentially.

This session is authorized for:

```text
T-13 only
```

Do not begin T-14 in this session.

---

# 5. Current Task — T-13 Slim Deal Card

## Goal

Simplify the deal card so stage information is not duplicated and the card presents only the essential deal information.

## Acceptance Criteria

The card must show exactly:

```text
brand
fee
deadline
overflow button
```

Requirements:

```text
stage appears once via the surrounding column/rail
no stage string inside the deal card
no native stage select inside the deal card
overflow button remains available
overflow target is at least 44×44
overflow control is keyboard-focusable
existing unrelated deal-card behavior is preserved
```

Add or update DOM assertions for the new structure.

Verify bilingual behavior.

Verify responsive behavior at approximately:

```text
390px
1440px
```

---

# 6. Expected Implementation Scope

Likely files:

```text
src/components/deals/deal-card.tsx
src/components/deals/deal-card.test.tsx
```

Inspect neighboring code and conventions before editing.

If another file is genuinely required, explain why before expanding the change.

If scope expands materially:

```text
STOP
REPORT SCOPE EXPANSION
```

Do not use T-13 as an opportunity to refactor unrelated code.

---

# 7. Implementation Guidance

Prefer the smallest change that satisfies T-13.

Preserve:

```text
existing styling conventions
existing accessibility conventions
existing localization conventions
existing event behavior
existing card navigation/interaction
existing test style
```

Do not introduce a new design system or dependency.

Do not redesign unrelated deal-board components.

---

# 8. Verification

Run the smallest relevant tests first.

Then run the appropriate project gates.

At minimum, where available:

```text
focused deal-card tests
relevant component/test suite
typecheck
lint
git diff --check
```

Run the build if practical and consistent with the existing project workflow.

Perform local browser verification if the existing project setup supports it.

Check approximately:

```text
390px width
1440px width
```

Check both supported languages where practical.

Do not merely trust test output.

Inspect the rendered behavior and final diff yourself.

---

# 9. Commit Discipline

If T-13 is complete and verification passes:

1. inspect `git status --short`;
2. selectively stage only T-13 files;
3. inspect the staged diff;
4. create one focused local commit for T-13;
5. record the commit SHA;
6. update durable implementation records if that is normal for this repository.

Do not stage unrelated files.

Do not push.

---

# 10. Authorized Actions

This session may perform:

```text
read repository files
edit bounded T-13 application/test files
run local tests
run local typecheck
run local lint
run local build
perform local browser verification
create one selective local T-13 commit
update local implementation records where appropriate
```

---

# 11. Hard Boundaries

Stop before any of the following:

```text
push
merge
deploy
Vercel mutation
Preview mutation
Production mutation
database query or mutation
migration application
schema migration execution
credential or secret change
permission change
public-access change
external message/action
financial action
destructive operation
dependency/provider/runtime change
Hermes governance repair
Hermes source modification
Hermes profile modification
```

If T-13 unexpectedly requires one of these:

```text
STOP
REPORT WHY
```

---

# 12. Do Not Start T-14

After T-13 is implemented, verified, and committed:

```text
STOP
```

Do not continue automatically to T-14.

---

# 13. Final Report

At the end of the session, report:

```yaml
task: T-13
status:
branch:
starting_head:
ending_head:
commit_sha:

files_changed:

tests:
  focused:
  typecheck:
  lint:
  build:
  browser:

responsive_checks:
  390px:
  1440px:

bilingual_check:

remaining_worktree_changes:
risks_or_notes:
recommended_starting_point_for_t14:
```

Also answer explicitly:

```text
Did T-13 meet all acceptance criteria?
YES / NO / PARTIALLY
```

---

# Execute Now

1. Enter `/home/kenji/code/dibayar`.
2. Reconstruct the actual current repository state.
3. Read the project instructions and implementation plan.
4. Preserve unrelated worktree changes.
5. Implement T-13 only.
6. Run focused and project-level verification.
7. Inspect the final diff.
8. Selectively commit T-13 if all required checks pass.
9. Produce the final report.
10. Stop.

Do not start T-14.
