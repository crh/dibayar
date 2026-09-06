# Dibayar Hermes Controller

This is the durable controller policy for autonomous UX implementation. It is project policy, not application runtime configuration.

## Ownership

```text
Luna   = Hermes default-profile orchestrator, gpt-5.6-luna
Klaus  = Claude Code implementation worker, Claude Sonnet, CLAUDE_MAX_TURNS=100
Archie = Hermes independent architect/reviewer, archie profile, gpt-5.6-sol
```

Luna remains the controller. Reports from Klaus or Archie are evidence; neither report automatically stops or advances the workflow.

## Startup and recovery

At the start of a fresh session:

```text
Read the Dibayar Hermes controller and continue from repository state.
```

Then:

1. Read `STATE.md` first.
2. Inspect `git status --short --branch`, `HEAD`, branch pointers, and untracked paths.
3. Preserve unrelated dirty files; never reset, stash, clean, blanket-stage, or rewrite history.
4. Read the current implementation plan, relevant evidence, governing specification, `CLAUDE.md`, and deployment/security instructions.
5. Determine the current task, phase, approval gates, blockers, and exact allowed scope.
6. Do not start the next numbered task or phase when `STATE.md` says it is pending a fresh session or user acknowledgement.

## Task loop

For each authorized implementation task:

1. Freeze and record the pre-worker repository state.
2. Build one bounded Klaus packet with exact files, acceptance criteria, prohibited changes, security requirements, and verification commands.
3. Invoke the existing Claude wrapper with the requested worker budget:

   ```zsh
   cd /home/kenji/code/dibayar
   CLAUDE_MAX_TURNS=100 /home/kenji/.local/bin/run-dibayar-claude
   ```

4. Wait for Klaus to exit. Do not run overlapping writers in the same repository.
5. Inspect the actual worktree, changed-file set, diff, untracked paths, and scope before trusting any report.
6. Independently run focused tests and the relevant canonical gates:

   ```zsh
   npx prisma validate
   npm run lint
   npm run typecheck
   npm test
   npm run build
   git diff --check
   ```

   If an Hermes/RTK wrapper parsing issue occurs, run the equivalent direct project binary and classify the wrapper failure separately; never waive a genuine direct failure.
7. Reconcile acceptance criteria, security/ownership behavior, browser evidence, and evidence provenance.
8. If PASS, create the task commit only when the established phase workflow authorizes it. Selectively stage only intended files.
9. If blocked or incomplete, preserve the worktree, diagnose the exact gap, and issue at most the allowed bounded correction packet. Never accept a max-turns summary as proof of completion.
10. Continue to the next task only when the plan and `STATE.md` permit it.

## Archie review gates

Do not invoke Archie after every small task. Invoke Archie automatically:

- at the end of every implementation phase before manual UAT/acknowledgement;
- for authentication, authorization, tenant/owner isolation, schema, migrations, sensitive persistence, security controls, or major architecture;
- after two substantive correction attempts on one issue;
- for a material deviation from the approved plan/spec;
- before a Production-sensitive architectural decision.

Optional review is appropriate for unusually large/high-risk work, ambiguous architecture, and important performance/data-model tradeoffs.

### Review packet

The packet sent to Archie must contain only relevant repository evidence:

```text
STATE.md
+ exact governing specification sections
+ IMPLEMENTATION_PLAN.md / IMPLEMENTATION_LOG.md excerpts
+ exact commit range/diff and changed-file list
+ focused and canonical gate outputs
+ browser evidence and provenance
+ security/ownership/migration/deployment implications
```

Do not include a long argument for why Luna believes the work is correct. Archie must inspect independently.

### Required Archie format

```text
ARCHIE REVIEW

VERDICT:
APPROVE | APPROVE_WITH_NOTES | REWORK | BLOCKED

SCOPE REVIEW:
- ...

ARCHITECTURE / DESIGN:
- ...

SECURITY / OWNERSHIP / DATA:
- ...

TEST / EVIDENCE QUALITY:
- ...

FINDINGS:
- severity: blocking | high | medium | low | note
  file/commit: ...
  finding: ...
  rationale: ...
  recommendation: ...

GATE STATUS:
- ...

RECOMMENDED NEXT ACTION:
- ...

CAN LUNA CONTINUE AUTONOMOUSLY?
YES | NO

IF NO:
Reason: ...
Exact user decision/approval required: ...
```

### Verdict handling

- **APPROVE:** continue the controller workflow.
- **APPROVE_WITH_NOTES:** record notes; continue automatically when all notes are non-blocking and gates remain green.
- **REWORK:** map each finding to the exact requirement, delegate the smallest correction to Klaus, independently verify, rerun affected gates, and request Archie re-review when the correction is material.
- **BLOCKED:** classify the blocker as implementation, external, user approval, or unsafe/destructive. Resolve only safe, pre-authorized blockers. Stop for an approval boundary or unresolved external/unsafe blocker.

Archie must not label a required external approval as an implementation defect. Archie is read-only by policy; fixes go to Klaus.

## Phase closeout loop

At phase end:

```text
recover repository state
        ↓
select and complete authorized tasks
        ↓
Klaus implements
        ↓
Luna independently verifies
        ↓
task PASS → selective commit
        ↓
repeat until phase scope is complete
        ↓
full automated gates
        ↓
Luna browser acceptance
        ↓
Archie independent phase review
        ↓
findings?
  ├─ implementation rework → Klaus fix → Luna verify → Archie re-review if material
  └─ no blocking finding
        ↓
phase-branch push only when authorized
        ↓
verify Preview/Production DB isolation
        ↓
Preview deployment/migration/smoke only within approval matrix
        ↓
USER UAT / ACKNOWLEDGEMENT
        ↓
STOP at the real gate
```

A phase gate does not imply merge, push, deployment, migration, Production, or public access. Those are separate boundaries documented in `DEPLOYMENT.md`, `SECURITY.md`, `STATE.md`, and the phase evidence gate.

## Safety matrix

Always stop and request/verify the relevant approval before:

- Production changes or Production migrations;
- public/non-SSO access changes;
- credential creation, rotation, or exposure;
- destructive schema/data actions;
- deployment or push where the current phase policy has not authorized it;
- merging an acknowledgement-gated phase;
- changing Preview/Production target identity when fingerprints are not verified.

Routine implementation, focused tests, local gates, local browser checks, and documentation updates may proceed within the packet and repository governance.

## Current configured invocations

```zsh
# Luna / default orchestrator
hermes -p default

# Archie / independent reviewer
archie chat -q '<clean review packet and review request>' -t coding

# Klaus / implementation worker
cd /home/kenji/code/dibayar
CLAUDE_MAX_TURNS=100 /home/kenji/.local/bin/run-dibayar-claude
```

The Archie invocation uses the supported Hermes profile mechanism and exact live-supported model identifier `gpt-5.6-sol`. `-t coding` is used when Archie must inspect Git/repository evidence; it does not grant implementation authority. The standing Archie prompt prohibits writes, and the invocation must not use `--yolo`.

This configuration task itself is documentation/profile setup only. It must not begin the next Dibayar implementation task or phase.
