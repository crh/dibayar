# Receipt — FIND-01 + FIND-06: one invoice status rule everywhere, 2026-10-09

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **PR #34 into `staging` is open and not merged.** Nothing was deployed or released. `main` and Production were not touched. No Production, hosted-staging or Neon database was read or written; no Vercel, Neon, OAuth or repository setting was changed; no `preview/*` or Neon branch was created; no migration was added; no visual baseline was updated; no stored status was rewritten. FIND-08 and Batch 3 were not touched.

**Final status: `READY_FOR_CHRIS_REVIEW`** (section 15). Two things to know when you review:

1. I stopped once, as the brief required: the M4 demo seeder depended on the `SENT -> OVERDUE` transition. You chose to seed that invoice as SENT instead (section 2). The demo data already on staging does not change until someone reseeds.
2. I staged the untracked Prisma backup directory by mistake again and caught it before pushing (section 13). Nothing generated is in the branch.

## 1. Verified start state (live, 2026-10-09)

- PR #33 MERGED into `staging` at 2026-10-09T09:51:41Z, merge commit `096a400`, the head of `origin/staging`.
- No open PR and no branch for FIND-01 / FIND-06.
- Live coverage before any change: 95 actions / 94 applicable, real 65/94 = 69.1%, P0 28/30 = 93.3%, 5 outstanding P0/P1.
- Live code matched the findings: `NEXT_ACTIONS.DUE` offered **Tandai terlambat**; `ALLOWED_STATUS_TRANSITIONS` allowed `SENT -> OVERDUE` and `DUE -> OVERDUE`; `InvoiceList` grouped and labelled by `invoice.status`. Nothing was already fixed.
- Branch `fix/invoice-status-consistency-2026-10-09` from `origin/staging` `096a400`. Untracked items (`compose.yml`, two older receipts, `src/generated/`) left as found.

## 2. Product decisions implemented

- **FIND-01:** the user-facing **Tandai terlambat** / **Mark as overdue** action is removed. Overdue comes only from the due date against the Jakarta calendar day.
- **FIND-06:** the invoice list uses the same displayed status as Beranda and invoice detail, for its groups and its chips. One function, `deriveInvoiceDisplayStatus()`; no second derivation was written.
- **Decided in this session:** `scripts/m4-demo-data.ts` builds its demo invoices through `updateInvoiceStatus`, and its "Teh Tarik Nusantara" invoice walked `DRAFT -> SENT -> OVERDUE`. Removing the transition would make the next reseed throw. I stopped and asked; you chose to seed it as `SENT`. It is due 4 days before the seed, so the app shows it as Terlambat and the seeder's own check (`oneOverdue`, via `selectAttentionInvoices`) still counts exactly one.

## 3. Root cause

Both findings came from having two ideas of an invoice's status.

- Invoice detail and Beranda showed `deriveInvoiceDisplayStatus()`: DRAFT and PAID as stored, anything else overdue when its due date is past, and a stored OVERDUE that is not past due shown as sent.
- **FIND-01:** a button and two API transitions could store OVERDUE on an invoice with no past due date. The display rule then showed Terkirim, so the creator asked for "Terlambat" and saw "Terkirim".
- **FIND-06:** the invoice list never called the function. It filtered and labelled by the stored status, so a SENT invoice due yesterday was "Terlambat" on Beranda and its detail page and "Terkirim" in the list.

## 4. Behaviour before and after

| Where | Before | After |
|---|---|---|
| Invoice detail, stored DUE | **Tandai terlambat**, **Tandai lunas** | **Tandai lunas** only |
| Invoice detail, stored SENT, not overdue | **Tandai jatuh tempo**, **Tandai lunas** | unchanged |
| Invoice detail, stored SENT or DUE, due date past | chip Terlambat, but still **Tandai jatuh tempo** (SENT) or **Tandai terlambat** (DUE) | chip Terlambat, **Tandai lunas** only |
| Invoice detail, legacy stored OVERDUE, not past due or no due date | chip Terkirim, **Tandai lunas** | unchanged, and now pinned by tests |
| `PATCH /api/invoices/:id` `{status:"OVERDUE"}` from SENT or DUE | 200, stored OVERDUE | 409 "Status invoice tidak bisa diubah seperti itu." |
| Same from DRAFT or PAID | 409 | 409 |
| `OVERDUE -> PAID`, `SENT -> DUE`, `SENT/DUE -> PAID`, `PAID -> SENT` | allowed | allowed |
| Invoice list, stored SENT or DUE, due yesterday | under Terkirim; chip Terkirim or Jatuh tempo | under Terlambat; chip Terlambat |
| Invoice list, due today or later | under Terkirim | unchanged |
| Invoice list, legacy stored OVERDUE, not past due | under Terlambat | under Terkirim, as on its detail page |
| Invoice list, DRAFT and PAID | own groups | unchanged, whatever the due date |
| Beranda follow-up queue | derived | unchanged |

Stored statuses are not rewritten by any of this.

## 5. Inventory treatment of INV-STATUS-05

"Mark a DUE invoice as overdue" no longer exists, so it is **`not_applicable`**, the status the inventory already uses for a route with no user-facing control (DEAL-DELETE-01). It is not counted as automated. Its reason records the decision, and that the control's absence is asserted by the INV-STATUS-02 journey and the rejected transitions by unit tests.

- Its `product_decision` entry is removed from the exception register (8 entries left). The Phase 2C validator requires this: with the entry left in place it reports that the action is not `blocked` and that nothing remains outstanding.
- The new journeys are attached to existing actions: INV-STATUS-06 (three real tests) and INV-LIST-01 (two real, plus the list-rendering journey and the component test as partial, because they assert rendering only).
- INV-STATUS-02's expected result now includes "the only status action then offered is Tandai lunas".
- FIND-01 and FIND-06 are marked fixed, with PR #34.

## 6. Changed files and why

| File | Why |
|---|---|
| `src/lib/invoices.ts` | `SENT/DUE -> OVERDUE` removed from `ALLOWED_STATUS_TRANSITIONS`; the table is exported so tests use the real one |
| `src/app/(app)/invoice/[id]/invoice-detail-client.tsx` | **Tandai terlambat** removed; **Tandai jatuh tempo** not offered once the invoice is shown as overdue |
| `src/lib/i18n.ts` | unused `invoice.markOverdue` strings removed (id, en) |
| `src/components/invoices/invoice-list.tsx`, `src/app/(app)/invoice/page.tsx` | groups and chips from `deriveInvoiceDisplayStatus()`, against the page's render time passed as `now` |
| `src/lib/m4-demo-dataset.ts`, `docs/validation/M4-READINESS.md` | demo overdue invoice seeded as SENT (section 2) |
| `src/lib/*.test.ts`, `invoice-list.test.tsx`, `invoice-detail-client.test.tsx` | unit and component tests (section 7). One existing test depended on the wall clock and now passes a fixed `now` |
| `scripts/e2e-fixtures.ts`, `e2e/support/reseed.ts`, `e2e/support/manifest.ts` | opt-in `status-consistency` overlay: five invoices on top of `follow-up-states` |
| `e2e/invoices/status-consistency.spec.ts` (new) | the list / detail / Beranda journeys |
| `e2e/invoices/status-lifecycle.spec.ts`, `overdue-invoice.spec.ts` | lifecycle asserts the complete action set at each step; stale comments corrected |
| `docs/testing/journey-coverage.json`, `JOURNEY-COVERAGE.md` (generated), `JOURNEY-GRAPHS.md`, `JOURNEY-BACKLOG.md`, `E2E.md` | inventory and docs |
| `REVIEW_CHECKLIST.md` | Gate F's "today" examples: no product-decision entry left; FIND-08 the only open low finding. Policy unchanged |
| `SECURITY.md` | known-gaps entry: the status route accepts less than before |
| `STATE.md`, `DAILY_LOG.md`, this receipt | record |

## 7. Positive tests

**Browser, chromium and chromium-mobile, `@critical`** (`e2e/invoices/status-consistency.spec.ts`):

- The list shows all four groups with every row's chip, before and after reload: stored SENT, DUE and OVERDUE due in the past under Terlambat; due today, in 7 days and in 8 days under Terkirim; legacy stored OVERDUE (due in 8 days, and with no due date) under Terkirim; DRAFT and PAID with a past due date unmoved.
- Stored SENT due yesterday, and stored DUE due yesterday (one test each): found under Terlambat, opened by its row; detail shows Terlambat, the due date, **Kirim pengingat**, and **Tandai lunas** as the only status action; the same after reload, Back and Forward; Beranda shows "Telat 1 hari".
- Legacy stored OVERDUE: Terkirim on list and detail, **Kirim lewat WhatsApp** rather than the reminder, not in the Beranda queue; **Tandai lunas** is accepted by the server and shows Lunas after reload and in the list.

**FIND-01 in the browser** (`status-lifecycle.spec.ts`, both projects): at each step the journey asserts the complete set of status actions, so at DUE it requires **Tandai lunas** and the absence of **Tandai terlambat** and every other status action, before and after reload.

**Unit and component (973 tests after the review fix, was 944):**

- Contract: OVERDUE rejected from DRAFT, SENT, DUE and PAID without a write; no status lists OVERDUE as a target; `SENT -> DUE`, `SENT -> PAID`, `DUE -> PAID` still allowed; legacy `OVERDUE -> PAID` still allowed. Ownership (not-found) tests unchanged and passing.
- List: stored SENT / DUE / OVERDUE due yesterday under Terlambat with that chip; due today, tomorrow and no due date not overdue; legacy stored OVERDUE as Terkirim; DRAFT and PAID unmoved; the Jakarta midnight boundary; English.
- Detail: no manual overdue on a DUE invoice in either language; only **Tandai lunas** on a stored SENT or DUE invoice shown as overdue; **Tandai jatuh tempo** still offered when not overdue.
- Derivation: stored OVERDUE with a past due date stays OVERDUE (the fallback cases were already covered).
- M4 dataset: its status paths are checked against the real transition table.

**Informational:** the two status specs in Firefox and WebKit: 10 passed, 0 failed. These engines are not claimed in the inventory.

## 8. Negative controls

One at a time; each reverted with `git checkout -- src`, after which the tree was clean. The app was rebuilt for each browser control and again before the final runs.

| # | Mutation | Result |
|---|---|---|
| 1 | Manual **Tandai terlambat** restored on DUE (action + strings) | `status-lifecycle` journey fails: `"Tandai terlambat" must not be offered`, expected 0, received 1. 3 component tests fail |
| 2 | `DUE -> OVERDUE` re-allowed in the contract | 2 contract tests fail: "rejects a manual DUE to OVERDUE transition" and "allows no transition into OVERDUE" |
| 3 | List groups by the stored status again | All 4 `status-consistency` journeys fail (first: the stored-SENT row has no Terlambat chip). 6 component tests fail |
| 4 | Future-due SENT invoices forced into the overdue group | The list journey fails: Terlambat has 6 rows, expected 3. 3 component tests fail |

## 9. Coverage metrics, as generated by the validator

| | Before | After |
|---|---|---|
| Actions / applicable | 95 / 94 | 95 / 93 |
| Automated real interaction | 65/94 = 69.1% | 65/93 = 69.9% |
| P0 real | 28/30 = 93.3% | 28/30 = 93.3% |
| Outstanding P0/P1 | 5 | 4 (INV-DUE-03, A11Y-01, DEAL-CREATE-07, INV-DUE-06) |
| Exception register entries | 9 | 8 |
| Real claims checked by `--require-results` | 113 | 113 |

The percentage rose only because a removed action left the denominator. No action became automated in this PR, and no threshold exists.

## 10. Local validation (2026-10-09)

Run on `4b63e57` (code, tests, fixtures and inventory before the review fix; what was re-run for the fix is in section 11).

| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 972/972 (84 files) |
| `npm run build` | pass |
| `npm run e2e:build` | pass |
| `npm run test:journey-coverage` | 37/37 |
| `npm run coverage:journeys` | OK: 95 actions, 93 applicable, 69.9%, P0 93.3%, 4 outstanding |
| `npm run test:diagnostics-selftest` | pass |
| Targeted status specs, chromium + chromium-mobile | 8 passed (`status-consistency`), plus lifecycle and overdue specs 6 passed |
| `npm run test:e2e:critical` | 185 passed, 0 failed, 25 skipped |
| `npm run test:e2e` | 201 passed, 0 failed, 25 skipped |
| `npm run test:e2e:a11y` | 14 passed, 1 skipped |
| `npm run ux:audit` | specs 69/69; functional, responsive, state PASS; `@visual` 9/9 fail → overall FAIL locally |
| full E2E + ux-audit → `coverage:journeys --require-results` | 113 passed, 0 not exercised, 0 failed |
| Firefox + WebKit, the two status specs | 10 passed (informational) |

**`@visual` locally:** 17557, 15200, 13708, 10584, 13943, 9743, 27355, 39880, 12367 differing pixels, the same nine numbers recorded for clean `staging` on this host in Phase 2B and 2C. Host font drift. The base seed is unchanged by this PR (the new rows are an opt-in overlay), and CI's `ux-audit` job, which includes `@visual`, is green on this branch. No baseline touched.

## 11. Latest-head CI and Journey coverage (full)

On `4b63e57`, the head with all code, tests, fixtures and inventory:

- Workflow `CI`, PR run `37936711111`: **success**. `lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit` succeeded; `e2e-cross-browser` skipped by design.
- Workflow `Journey coverage (full)`, PR run `37936711040`: **success**. It was triggered by the inventory change, as intended since Phase 2C: 113 real claims, all exercised and passed.
- Also green on the first pushed commit `36d4240` (code and tests, before the inventory change): `CI` `37936617463`.

Commits after `bc2546a` change `STATE.md`, `DAILY_LOG.md` and this receipt only; their runs are on the PR.

On `bc2546a`, the review fix (section 12) and the head with all code:

- Workflow `CI`, PR run `37944103648`: **success**.
- Workflow `Journey coverage (full)`, PR run `37944103636`: **success**.

Local on `bc2546a`: lint, typecheck, unit 973/973, build, `e2e:build`, and the status-consistency and invoice-list journeys on chromium + chromium-mobile (21 passed, 1 skipped by design). The full local browser suites in section 10 were not repeated for this one-prop change; CI ran the critical suite and the full-coverage lane on it.

## 12. Review-thread status

Codex reviewed `4b63e57` and raised one finding (P2), which was valid:

- **The list derived "now" twice.** `InvoiceList` called `new Date()` on the server and again in the browser. A page rendered just before Jakarta midnight and hydrated just after would put an invoice due that day under Terkirim on the server and Terlambat in the browser, a hydration mismatch in headings, counts and rows. I had listed this as a pre-existing pattern rather than fixing it; for a list whose structure depends on the status, that was the wrong call.
- **Fix (`bc2546a`):** the page captures one timestamp and passes it as `now`, as the deal detail page already does. New test in `src/app/(app)/invoice/page.test.tsx`: page rendered at 23:59 Jakarta, clock moved past midnight, returned tree rendered, server grouping required. It fails without the fix.

The thread is answered and resolved. Codex's re-review of `bc2546a` found no issues. No unresolved review threads.

## 13. Residual risks and legacy stored-status behaviour

- **Legacy stored OVERDUE rows are left as they are.** With a past due date they show Terlambat, as before. Without one (or with a future one) they show Terkirim on every surface and offer **Tandai lunas**; they cannot be moved to DUE. How many such rows exist in Production or staging was not checked (no hosted database was read).
- **The list change moves legacy rows.** A stored OVERDUE that is not past due used to sit under Terlambat in the list and now sits under Terkirim, matching its detail page.
- **M4 demo data on staging is stale until reseeded.** Its overdue invoice is still stored OVERDUE there; it displays and behaves the same. Reseeding is a hosted-database action and is yours.
- **`DUE` remains a manual state** (**Tandai jatuh tempo** on a SENT invoice that is not overdue). The brief kept it; it has no effect on overdue.
- **A tab left open across Jakarta midnight** keeps the previous day's statuses until its next load. No refresh timer was added. Beranda and invoice detail still take their own "now" in the browser and can disagree with the server render for a moment at midnight; only the list was changed (section 12).
- **Disclosed mistake:** `git add -A src` staged the untracked `src/generated/prisma.root-owned-bak-20260920160728/` directory (the same slip as PR #31). I saw it in the commit's file list, the commit was local only, and I redid it without those files. `git ls-files` shows none of them. The directory is still untracked and not gitignored; whether to remove or ignore it is your call.
- `STATE.md` `day_count` is still 12 and still unverifiable from the repository; left unchanged.
- The local test database had its schema this time; no migration was re-applied.

## 14. What was not touched

`main`, Production, the hosted staging environment, Neon, Vercel, Google OAuth and repository settings were not changed or read. No migration, no dependency, no visual baseline, no stored status. No `preview/*` branch. FIND-08, Batch 3 and coverage thresholds were left alone. The Gate F policy text is unchanged apart from its "today" examples. The PR is not merged.

## 15. Final status

**`READY_FOR_CHRIS_REVIEW`.** Stopped before merge. Merging PR #34 into `staging` needs your explicit authorization.
