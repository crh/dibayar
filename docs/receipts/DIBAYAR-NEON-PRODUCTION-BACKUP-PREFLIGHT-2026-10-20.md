# Dibayar — Neon Production recovery branch + read-only preflight — operator receipt

Date: 2026-10-20 (WIB). Execution was split between two people:
- **Claude Code** did the read-only identity checks through Claude in Chrome. Its permission system then blocked it from clicking New Branch and from opening the SQL Editor ("Modify Shared Resources").
- **Chris (operator)** then created the branch and ran the SQL by hand in the Neon Console, guided step by step, and sent screenshots.
- **Claude Code** verified those screenshots and checked them against the repository.

## Overall status: `PASS_PREFLIGHT`

The verified recovery branch exists. Every baseline check passed.

## Identity

| Item | Value | Label |
|---|---|---|
| Neon org / account | "Vercel: kenji" (Vercel Native Integration) | OBSERVED (Claude) |
| Project | `neon-dijual`, ID `wispy-king-47867708`, AWS Asia Pacific 1 (Singapore), Free plan | OBSERVED (Claude + operator screenshot) |
| Production branch | `main`, ID `br-still-darkness-aobvo77q`, Default, Expires Never | OBSERVED (Claude) |
| Production mapping | Neon → Integrations → Vercel → Production branch = `main` (viewed only; not saved) | OBSERVED (Claude) |
| Compare against Vercel's own Production env config | Not done | UNVERIFIED |

## Step 1 — recovery branch: SUCCESS

| Field | Value | Label |
|---|---|---|
| Name | `backup-preprod-20261019` (created on 2026-10-20 under the authorized name) | OBSERVED (operator screenshot) |
| ID | `br-mute-glade-aou2i…` (truncated in the UI) | OBSERVED, partial |
| Parent | `main` | OBSERVED |
| Mode | Branch data and schema (current point in time; not schema-only, not historical) | OBSERVED (create dialog) |
| Auto-delete / Expires | Dialog defaulted to "After 7 days"; changed on advice; overview shows **Never** | OBSERVED |
| Created | 2026-10-20 11:06:27, in the console's local time | OBSERVED; WIB is INFERRED (≈ 04:06:27 UTC if WIB) |
| Branch count | 3 (`main`, `staging`, `backup-preprod-20261019`); the plan limit was not shown | OBSERVED (limit UNVERIFIED) |
| Compute | 1 default compute at 0.25 CU, 0 CU-hrs used; no extra compute added | OBSERVED |

Caveats:
- **History retention is 6 hours** (Free plan). This branch is the only restore point older than 6 hours.
- The branch contains Production PII. Keep it private and never attach it to a Vercel Preview.
- Never click "Reset from parent" on it.

## Step 2 — read-only aggregate preflight on `main`: PASS

- Target: project `neon-dijual`, database `neondb`, compute "Primary". The editor's toolbar crop did not show the branch name; the **operator reported branch `main`**.
- Execution mode: the full packet SQL ran as **one batch** of 6 statements (BEGIN READ ONLY → SET → SET → SELECT → SELECT → ROLLBACK). Each statement has its own result tab. The batch ended in ROLLBACK.

| Metric | Value | Expected | Result |
|---|---|---|---|
| finished_migrations | **12** | 12 | PASS |
| unfinished_migrations | **0** | 0 | PASS |
| rolled_back_migrations | **0** | 0 | PASS |
| migration_rows_total | **12** | 12 | PASS |
| invoices_to_backfill | **2** | ≥ 0 | Recorded (no inference about correctness) |

Repository cross-check (Claude, read-only `git ls-tree`):
- `origin/main` @ `308a339e7de817aa37378d263d51f25c78ea4f09` has **12** migration directories, which matches the database.
- `origin/staging` @ `41085231cf386acb8e0309b83d61086b5a49ef92` has **14**.
- The 2 extra are exactly `20261016000000_create_idempotency_keys` and `20261018000000_invoice_document_snapshot`, the expected pending Production migrations.
- Both SHAs match the starting context in the packet.

## Attestation

- No Production data mutation. No database migration. No restore or reset.
- Exactly one new branch was created; nothing was deleted or renamed.
- No Vercel configuration change. The integration panel was opened and closed without Save.
- No merge or deploy. No source commit or push.
- No credentials, connection strings or customer rows were viewed or recorded.
- Claude's browser tab was closed.

## Risk

- This is a current-time recovery branch, not a **tested restoration**. Restoring from it has not been rehearsed.
- Data written to `main` after 2026-10-20 11:06 is not covered by it.
- Still needs review: a named rollback owner, and a documented restore procedure (point the Production database URL at the backup branch, or restore `main` from it) with its expected downtime.

## Release-gate status (re-checked 2026-10-20 after the preflight)

| Check | Result | Label |
|---|---|---|
| PR #67 `staging` → `main` | OPEN, **draft**, mergeable = MERGEABLE, reviewDecision empty | OBSERVED (`gh pr view 67`) |
| PR #67 head | `41085231cf386acb8e0309b83d61086b5a49ef92` (same as `origin/staging`) | OBSERVED |
| `origin/main` | `308a339e7de817aa37378d263d51f25c78ea4f09`, so nothing has been released | OBSERVED (`git ls-remote`) |
| CI on `41085231` | CI (push) success; CI (pull_request) success; Journey coverage (full) success | OBSERVED (`gh run list --commit`) |

**Blocked?** There are no technical blockers. These approval steps remain:

1. **Release authorization.** Chris decides on and performs the PR #67 merge, which deploys Production and applies the 2 pending migrations. The auto-mode classifier denies `gh pr merge` for Claude Code.
2. **Review requirement.** PR #67 has no recorded review decision. If the `main` ruleset requires an approval, one is needed before merging.
3. **Rollback readiness (recommended before merging).** Name a rollback owner. Document the restore path that uses `backup-preprod-20261019` and its expected downtime.
4. **Backup freshness.** The backup is from 2026-10-20 11:06 (console time), and Production writes after that are not covered. If the merge is significantly delayed, create a fresh data+schema branch from `main` (Auto-delete = Never) first.

## Post-release checks (separate task, after the merge)

- `_prisma_migrations` on `main` shows **14 finished / 0 unfinished / 0 rolled back**.
- The snapshot backfill covers the 2 invoices counted above. Verify with aggregate counts only.
- Run the FIND-10 / FIND-03 release checks.
- Production smoke check at 390px.

**PR #67 was not merged by this task.**
