# T-13 R1 Klaus Delegation Proposal — 2026-08-17

Documentation-only record of the exact, digest-bound T-13 ("slim deal card") R1 delegation
proposal derived under Prompt 10 stage 2. This file records the proposal as presented for
Chris's approval; it does not itself authorize Klaus invocation, and no Klaus session has
started.

The canonical delegation ledger (outside this repository, under separate Hermes control)
has already recorded this exact proposal. This file is a repository-local evidence copy
only and is not the source of truth for approval state; it is not edited to change that
ledger's record.

## Exact proposal

```yaml
delegation_id: DIBAYAR-T13-R1-20260817-001
proposal_digest: 1803473721b47f0e47b768165ed800db07e14b634b49dc11b989a77ef8bc0afb
created_at: 2026-08-17T12:02:22Z
expires_at: 2026-08-17T13:02:22Z
target_agent: Klaus
task: T-13 Slim deal card
repository: /home/kenji/code/dibayar
branch: hermes/ux-phase-2
base_head: f1c61448d64bcfa749ac9dd7f896db89cfc0ce9e
risk: R1
change_class: software_implementation
allowed_files:
  - src/components/deals/deal-card.tsx
  - src/components/deals/deal-card.test.tsx
scope: >
  Only reversible product UI implementation and focused DOM regression tests.
  No data-layer, schema, infrastructure, governance, or release-operation changes.
expected_commit_subject: "T-13: simplify deal cards to board context"
execution_authorized: false
push: false
deploy: false
migration: false
external_side_effects_authorized: false
```

## Implementation acceptance criteria (Prompt 10 T-13 contract)

- A deal's stage appears exactly once, represented by the board column or rail — not
  duplicated inside the card.
- The card contains exactly: brand, fee, deadline, and an overflow button.
- No stage string appears in the card DOM.
- No native `<select>` element is present.
- The overflow button is at least 44×44px and keyboard-focusable.
- DOM regression coverage exists at 390px and 1440px, in both Indonesian and English.

## Current status

```yaml
delegation_approval: AWAITING_CHRIS_R1_DELEGATION_APPROVAL
klaus_session: NOT_STARTED
changed_files: []
commit: NONE
focused_tests: PENDING_APPROVAL
push: false
deploy: false
migration: false
external_side_effects_authorized: false
```

Chris's exact, digest-bound approval of `delegation_id: DIBAYAR-T13-R1-20260817-001` /
`proposal_digest: 1803473721b47f0e47b768165ed800db07e14b634b49dc11b989a77ef8bc0afb` remains
required. Prompt 10 must stop at this boundary — no Klaus session may be invoked, and no
`src/`, `prisma/`, test, or package file may change, until that approval is given.

## Scope of this record

Documentation-only. No application source, test, schema, migration, package, credential,
or environment file was created or edited to produce this proposal. No stage/commit/push/
deploy/migrate/database/credential/governance-policy action occurred. `T-13` implementation
has not started.

## 2026-08-17 update — approval-consumption blocker

A chat-session approval from Chris was checked and matched this exact proposal
(`delegation_id`/`proposal_digest` above), but the canonical `DelegationLedger.register`
call rejected it: an authenticated current Chris Hermes session proof was unavailable and
runtime metadata lacked platform and user identity binding; no synthetic authority was
used. The canonical ledger remains `status: awaiting_approval`,
`execution_authorized: false`, `consumed: false`; no Klaus session, no changed files, no
commit. Full record: `docs/ux-implementation/evidence/phase-2/t13-r1-approval-consumption-blocker-2026-08-17.md`.
**Next safe action:** retry this same proposal (do not create a replacement) via a
supported authenticated Hermes session with non-empty human source and durable matching
Chris user identity, before `expires_at 2026-08-17T13:02:22Z`.
