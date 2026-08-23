# T-13 R1 Klaus Delegation Proposal — 002 — 2026-08-17

Documentation-only record of a fresh, exact, digest-bound T-13 ("slim deal card") R1
delegation proposal. This file records the proposal as presented for Chris's approval;
it does not itself authorize Klaus invocation, and no Klaus session has started.

The canonical delegation ledger (outside this repository, under separate Hermes control)
already recorded this exact proposal directly, entered by the parent. This file is a
repository-local evidence copy only and is not the source of truth for approval state;
it is not edited to change that ledger's record.

## Relationship to the prior proposal

The prior delegation `DIBAYAR-T13-R1-20260817-001`
(`proposal_digest 1803473721b47f0e47b768165ed800db07e14b634b49dc11b989a77ef8bc0afb`,
`expires_at 2026-08-17T13:02:22Z`) **expired without execution**. Its full history —
derivation, the approval-consumption rejection (`DelegationLedger.register` returned
`REJECTED`: no authenticated current Chris Hermes session proof, runtime metadata lacked
platform/user identity binding), and expiry — remains historical and is preserved
unchanged in `docs/ux-implementation/evidence/phase-2/t13-r1-delegation-proposal-2026-08-17.md`
and `docs/ux-implementation/evidence/phase-2/t13-r1-approval-consumption-blocker-2026-08-17.md`.
No Klaus session, changed file, or commit ever resulted from `-001`. This `-002` proposal is
a fresh, separate proposal, not a retry or amendment of `-001`.

## Exact proposal

```yaml
delegation_id: DIBAYAR-T13-R1-20260817-002
proposal_digest: 8b3990932dbdb841b2bbb2a172822363f53a4b697943183e985d1eaccbf28b42
created_at: 2026-08-17T13:57:58Z
expires_at: 2026-08-17T14:57:58Z
project: Dibayar
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
  Exactly Dibayar T-13 only. Reversible product UI implementation and focused DOM
  regression tests only. No data-layer, schema, infrastructure, governance, or
  release-operation changes.
expected_commit_subject: "T-13: simplify deal cards to board context"
execution_authorized: false
push: false
deploy: false
migration: false
external_side_effects_authorized: false
```

## Implementation acceptance criteria (Prompt 10 T-13 contract, unchanged from -001)

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

No approval has yet been consumed for `delegation_id DIBAYAR-T13-R1-20260817-002`. No
Klaus session exists. No T-13 implementation has started. The next gate is Chris's exact,
digest-bound approval of `delegation_id: DIBAYAR-T13-R1-20260817-002` /
`proposal_digest: 8b3990932dbdb841b2bbb2a172822363f53a4b697943183e985d1eaccbf28b42`.

## Scope of this record and explicit action boundary

Documentation-only. No application source, test, schema, migration, package, credential,
or environment file was created or edited to produce this proposal. No stage/commit/push/
deploy/migrate/database/credential/governance-policy action occurred. `T-13`
implementation has not started.

**No merge, push, deployment, migration, database, credential, external communication, or
scope-expansion action is allowed under this proposal.** All such actions are outside the
approved allowed actions and scope recorded above (`execution_authorized: false`,
`push/deploy/migration/external_side_effects_authorized: false`, allowed files limited to
exactly `src/components/deals/deal-card.tsx` and `src/components/deals/deal-card.test.tsx`).
Any of those actions would require a separate, explicit, digest-bound authorization beyond
this record.
