# T-13 R1 Klaus Delegation Proposal — 001 — 2026-08-18

Documentation-only record of a fresh, exact, digest-bound T-13 ("slim deal card") R1
delegation proposal. This file records the proposal as presented for Chris's approval;
it does not itself authorize Klaus invocation, and no Klaus session has started.

The canonical delegation ledger (outside this repository, under separate Hermes control)
already recorded this exact proposal directly, entered by the parent. This file is a
repository-local evidence copy only and is not the source of truth for approval state;
it is not edited to change that ledger's record.

## Relationship to prior proposals

Two prior T-13 R1 delegation proposals exist and are both historical, preserved unchanged
and not rewritten:

- `DIBAYAR-T13-R1-20260817-001` (`proposal_digest 1803473721b47f0e47b768165ed800db07e14b634b49dc11b989a77ef8bc0afb`,
  `expires_at 2026-08-17T13:02:22Z`) — derived 2026-08-17, hit an approval-consumption
  rejection (canonical `DelegationLedger.register` returned `REJECTED`: no authenticated
  current Chris Hermes session proof, runtime metadata lacked platform/user identity
  binding; no synthetic authority used), then **expired without execution**. Full history:
  `docs/ux-implementation/evidence/phase-2/t13-r1-delegation-proposal-2026-08-17.md`,
  `docs/ux-implementation/evidence/phase-2/t13-r1-approval-consumption-blocker-2026-08-17.md`.
- `DIBAYAR-T13-R1-20260817-002` (`proposal_digest 8b3990932dbdb841b2bbb2a172822363f53a4b697943183e985d1eaccbf28b42`,
  `created_at 2026-08-17T13:57:58Z`, `expires_at 2026-08-17T14:57:58Z`) — a fresh,
  separate proposal recorded directly in the canonical ledger by the parent. No approval
  was ever consumed for it before its window closed; it **expired without execution**.
  Full record: `docs/ux-implementation/evidence/phase-2/t13-r1-delegation-proposal-2026-08-17-002.md`.

No Klaus session, changed file, or commit ever resulted from either `-001` or `-002`. This
`2026-08-18-001` proposal is a fresh, separate proposal, not a retry or amendment of either
prior one.

## Exact proposal

```yaml
delegation_id: DIBAYAR-T13-R1-20260818-001
proposal_digest: 192640d5a5298af4e23df36df84e16c40fde2723a31b111dd059d75281a2d9b2
created_at: 2026-08-18T00:46:13Z
expires_at: 2026-08-18T01:46:13Z
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

Prohibited actions explicitly carried over from the parent's authoritative record: scope
expansion, deployment, Preview deployment, Production deployment, migration, credential
changes/access, external communication, agent activation, model/provider/runtime changes,
destructive actions, R2/R3 actions, chained delegation, merge, push, public access changes,
database access/mutation, schema changes, Prisma changes, `DAILY_LOG.md` changes, and scope
expansion without a new proposal.

## Prompt 10 implementation acceptance criteria (T-13 contract, unchanged since -001)

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

No approval has been consumed for `delegation_id DIBAYAR-T13-R1-20260818-001`. No Klaus
session exists. No T-13 implementation has started. The next gate is Chris's exact,
digest-bound approval of `delegation_id: DIBAYAR-T13-R1-20260818-001` /
`proposal_digest: 192640d5a5298af4e23df36df84e16c40fde2723a31b111dd059d75281a2d9b2`, bound
to this exact digest and expiration window.

## Expiration

`expires_at: 2026-08-18T01:46:13Z`. If this window closes without a consumed approval,
this proposal expires without execution, exactly as `-20260817-001` and `-20260817-002`
did before it, and a further fresh proposal (not a retry of this one) would be required
before any Klaus session could be considered.

## Scope of this record and explicit no-side-effect boundary

Documentation-only. No application source, test, schema, migration, package, credential,
or environment file was created or edited to produce this proposal. No stage/commit/push/
deploy/migrate/database/credential/governance-policy action occurred, no Klaus session was
invoked or created, and no T-13 implementation has started.

**No merge, push, deployment, migration, database, credential, external communication,
agent activation, model/provider/runtime change, destructive action, R2/R3 action, chained
delegation, public access change, or scope-expansion action is allowed under this
proposal.** All such actions are outside the approved allowed actions and scope recorded
above (`execution_authorized: false`, `push/deploy/migration/external_side_effects_authorized: false`,
allowed files limited to exactly `src/components/deals/deal-card.tsx` and
`src/components/deals/deal-card.test.tsx`). Any of those actions would require a separate,
explicit, digest-bound authorization beyond this record.
