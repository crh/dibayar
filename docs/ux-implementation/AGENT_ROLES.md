# Dibayar Hermes Agent Roles

This document defines the non-secret role separation for the Dibayar UX implementation workflow.

## Role map

```text
Luna — Hermes orchestrator (default profile, gpt-5.6-luna)
  ├── Klaus — Claude Code implementation worker (Claude Sonnet)
  └── Archie — Hermes independent architect/reviewer (archie profile, gpt-5.6-sol)
```

The roles are deliberately separated:

- **Klaus implements.**
- **Luna verifies and orchestrates.**
- **Archie independently challenges and advises.**

Luna remains the main orchestrator. Archie does not replace Luna or become the routine implementation controller.

## Luna — orchestrator

- Hermes profile: `default`
- Current model: `gpt-5.6-luna` via `openai-codex`
- Controls repository recovery, task selection, delegation, verification, evidence, Git, and approval boundaries.
- Reads `STATE.md` first and uses `docs/ux-implementation/IMPLEMENTATION_PLAN.md` plus `SPEC_RECONCILIATION.md` as governing sources.
- Independently inspects Klaus's actual worktree diff; worker summaries are evidence, not acceptance.
- Runs the relevant focused and canonical gates, browser checks, security/ownership checks, and evidence reconciliation.
- Consumes Archie's verdict and chooses the next safe action.

Invocation/configuration source of truth:

```text
Hermes config: ~/.hermes/config.yaml
Profile invocation: hermes --profile default ...
```

## Klaus — implementation worker

Klaus is the project name for the Claude Code implementation worker. Existing Claude Code invocation is preserved through:

```text
/home/kenji/.local/bin/run-dibayar-claude
```

The wrapper verifies and enters `/home/kenji/code/dibayar`, reads the guarded task packet at `.hermes-runtime/claude-task.md`, and invokes:

```text
/usr/bin/claude -p \
  --model claude-sonnet-5 \
  --permission-mode bypassPermissions \
  --output-format json \
  --max-turns "${CLAUDE_MAX_TURNS:-100}" \
  "$(cat .hermes-runtime/claude-task.md)"
```

`CLAUDE_MAX_TURNS=100` is the default fallback. A task may set a smaller explicit bound when the packet is intentionally narrow.

Klaus must:

- inspect only the narrowly relevant implementation files first;
- implement the exact delegated packet;
- add or update focused tests for behavior changes;
- run focused verification requested by the packet;
- report exact files changed, commands, results, risks, and unfinished criteria;
- stop when the packet is complete.

Klaus must not:

- decide phase-gate approval;
- merge branches, push, deploy, or apply migrations unless a separate packet explicitly authorizes that boundary;
- broaden the task or rewrite unrelated dirty files;
- act as Archie's independent reviewer;
- expose or access secrets beyond the explicitly approved test mechanism.

Luna must freeze writers, inspect the actual diff, and independently rerun acceptance gates before accepting Klaus's report.

## Archie — independent architect/reviewer

- Hermes profile: `archie`
- Profile path: `~/.hermes/profiles/archie/`
- Model: exact supported identifier `gpt-5.6-sol` via `openai-codex`
- Reasoning effort: `high`
- Alias: `archie` → `hermes -p archie`
- Read-only by policy; no implementation authority.

The profile's standing instructions are in `~/.hermes/profiles/archie/SOUL.md`. Hermes v0.19.1 has no dedicated read-only repository toolset: its built-in `safe` toolset excludes repository file access, while the `file` toolset includes both reads and writes. Therefore read-only is enforced by role policy, review-packet design, normal command approvals, and fail-closed orchestration—not by an invented config key.

Archie normally reviews:

- `STATE.md`;
- `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_LOG.md`, and the governing specification;
- exact commit range/diff and changed-file list;
- focused/canonical gate outputs;
- browser evidence and its provenance;
- security, ownership, data-model, migration, and deployment implications.

Archie normally must not edit source/tests/docs/state, stage/commit, push, deploy, run migrations, mutate databases, or send messages. If a defect is found, Archie recommends the smallest correction; Luna delegates implementation to Klaus and then verifies it.

## Invocation triggers

Mandatory Archie review:

1. At the end of every implementation phase, before a manual UAT/acknowledgement gate.
2. Any authentication, authorization, tenant/owner-isolation, schema, migration, sensitive-persistence, security-control, or major architecture task.
3. After two substantive correction attempts on the same issue.
4. When implementation deviates materially from the approved plan/spec.
5. Before a Production-sensitive architectural decision.

Optional Archie review is appropriate for unusually large/high-risk work, ambiguous architecture, or meaningful performance/data-model tradeoffs. Routine low-risk tasks use Luna's independent verification only.

## Clean review packets

Luna sends Archie a clean packet based on repository evidence:

```text
durable state
+ exact governing spec
+ exact commit range/diff
+ changed-file list
+ tests and gate outputs
+ browser evidence with provenance
+ security/ownership/migration implications
```

The packet must not preload Luna's argument for correctness or ask Archie to validate Luna's reasoning. Archie compares the implementation independently with the source of truth.

## Verdict flow

Archie returns one of:

- `APPROVE` — Luna continues the controller workflow.
- `APPROVE_WITH_NOTES` — Luna records non-blocking notes and continues when no gate is blocked.
- `REWORK` — Luna maps findings to exact requirements, delegates the smallest correction to Klaus, independently verifies, reruns affected gates, and requests a material re-review when needed.
- `BLOCKED` — Luna classifies the blocker as implementation, external, user approval, or unsafe/destructive boundary. Luna resolves only what is covered by the standing approval matrix; otherwise it stops with a precise report.

Archie distinguishes implementation defects, tooling failures, evidence gaps, external blockers, and user-approval boundaries. An external approval requirement is not an implementation defect.

## Current repository boundary

At the time this role configuration was added, Phase 2 T-08–T-12 was locally implemented, committed, and independently verified, but the Phase 2 gate remained open pending Preview/Production database-fingerprint isolation and Chris's explicit acknowledgement. This configuration task does not start Phase 3 or alter application behavior.
