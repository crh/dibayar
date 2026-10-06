# Journey coverage backlog

Prioritized, dependency-aware follow-up to the 2026-10-03 inventory
(`docs/testing/journey-coverage.json`). Each batch is one small PR into
`staging`. Every batch updates the inventory, regenerates
`docs/testing/JOURNEY-COVERAGE.md`, and adds no unbounded browser matrix.
Action IDs here are cross-checked by `npm run coverage:journeys`.

## 0. Product fixes (separate PRs, not test infrastructure)

These are defects the pilot found or confirmed. Each fix lands in its own
scoped `fix/*` PR, which also turns the matching expected-failure test into
a positive one.

| Order | Finding | Actions | Status |
|---|---|---|---|
| 1 | FIND-03 (high): keyboard entry saved year 0002 and permanently broke the owner's invoice page | INV-DUE-04 | **Fixed** by PR #26 (merge `b51fba1`, staging). Regression: `e2e/invoices/due-date-integrity.spec.ts`. **Still open for Chris:** the read-only Production count of out-of-range `Invoice.dueDate` / `Deal.deadline` (PR #26 receipt §9). Any data repair is Chris-only. Legacy out-of-range dates still render raw on the list, Beranda, public page, and PDF. Deal `deadline` validation is still `z.coerce.date()`. |
| 2 | FIND-02 (high): click/tap on the visible due-date field did nothing | INV-DUE-02, INV-DUE-03 | **Fixed** by PR #26 (`showPicker()` on click). Proven in Chromium desktop and 390px emulation. **Still open:** MAN-DUE-01 on a real Android Chrome phone and a real iPhone Safari. |
| 3 | FIND-01 (medium): "Tandai terlambat" shows "Terkirim" | INV-STATUS-05 | Open. Needs a product decision from Chris before any code or test. |
| 4 | FIND-04 (medium): blocked-popup detection never works -- `window.open(..., "noopener,noreferrer")` returns null by spec, so the **Buka WhatsApp** fallback shows even after WhatsApp opened (invoice detail and Beranda queue) | HOME-03, INV-WA-02 | Open, found in Phase 2A. Pinned by two `test.fail()` tests (`e2e/home/follow-up-queue.spec.ts`, `e2e/invoices/overdue-invoice.spec.ts`). A `fix/*` PR removes them and lets HOME-03 claim real. |
| 5 | FIND-05 (medium): Beranda **Kirim pengingat** rotates the share token, so a link the brand already has returns 404 | HOME-03 | Open, found in Phase 2A. Needs a product decision (reuse the active link like invoice detail?). No test asserts either behaviour. |
| 6 | FIND-06 (low): the invoice list shows stored status; Beranda/detail derive OVERDUE from the due date | INV-STATUS-06, INV-LIST-01 | Open, found in Phase 2A. Decide together with FIND-01. |

## Batch 1 — P0/P1 gaps with existing fixtures (done, Zero Routine Phase 1)

Delivered on `chore/zero-routine-regression-phase1-2026-10-04` with no
fixture or application change (receipt:
`docs/receipts/DIBAYAR-ZERO-ROUTINE-REGRESSION-PHASE1-2026-10-04.md`).

- DEAL-CREATE-01 (P0): `e2e/deals/desktop-create-entry.spec.ts` — Beranda →
  top-bar **+ Deal** → all visible text fields → save → reload → card menu →
  **Lihat detail** → stored values. Also the DEAL-DETAIL-01 desktop path.
- DEAL-STAGE-02: `e2e/deals/stage-back.spec.ts` — **Kembali ke …** on deal
  detail and in the card menu, with history entry and reload.
- NAV-02: `e2e/smoke/desktop-nav.spec.ts` — SideNav (≥1024px) and the
  top-bar nav (800px).
- SET-06: `e2e/settings/language.spec.ts` — **English**, reload, invoice
  detail "Due date" / **Clear** → "Due: Not set" after reload, back to
  **Indonesia**. Reseeds before and after. The pairwise language case for
  the whole suite (JOURNEY-GRAPHS.md §6).
- SET-03: `e2e/settings/bank-details.spec.ts` — bank fields → save → reload
  → the recipient page (`/i/<token>`, session-less context); plus the
  required-field error. The PDF is left to INV-PDF-01 / PUB-05.
- SHARE-05: `e2e/invoices/share-copy.spec.ts` — **Salin** with clipboard
  permissions for the app origin only; the clipboard must hold the exact
  public link. Phones stay MAN-SHARE-01.
- HOME-03 was assessed and **deferred to Batch 2**: the current seed puts no
  invoice in the follow-up queue (its SENT invoice is due 2099-12-31).

## Batch 2A — follow-up overlay fixtures (done, Zero Routine Phase 2A)

Delivered on `chore/zero-routine-regression-phase2a-2026-10-04` (receipt:
`docs/receipts/DIBAYAR-ZERO-ROUTINE-REGRESSION-PHASE2A-2026-10-04.md`). The
new states are an **opt-in overlay** (`npm run e2e:fixtures --
follow-up-states`, `applyFollowUpStates()` in `e2e/support/reseed.ts`), not
base-seed rows, so the seven-deal / empty-queue base seed and every `@visual`
baseline are unchanged. Due dates are relative to the Jakarta calendar day.

- HOME-02 (real, both projects): `e2e/home/follow-up-queue.spec.ts` -- order,
  reasons on the Jakarta-date boundaries, row → detail, back, reload.
- INV-STATUS-06 (real, both projects): `e2e/invoices/overdue-invoice.spec.ts`
  -- list → overdue detail → **Kirim pengingat** (chase template) →
  **Tandai lunas** → reload → list and Beranda.
- DEAL-DETAIL-03 (real, both projects): `e2e/deals/contact-repair.spec.ts`.
- HOME-03: the hand-off is driven for real in both projects, but the action
  stays **partial** while FIND-04 is pinned by an expected-failure test.
- INV-WA-02 reclassified to partial (stubbed `window.open`, and FIND-04 means
  it cannot tell blocked from opened).
- Flake fix: the `fill()`-based due-date test in `invoice-journeys.spec.ts`
  now waits for hydration (reproduced with CPU throttling; see receipt).

## Batch 2B — remaining Batch 2 items (separate PR)

- INV-PDF-01 / PUB-05: click **Unduh PDF** and the recipient PDF action, and
  assert the `download` event (not `page.request`).
- DEAL-CREATE-06 / DEAL-CREATE-07: empty-submit validation; optional text
  fields. The deadline picker stays manual (MAN-DEAL-01).
- SET-04: edit the send template, then send from invoice; the message uses
  the edit.
- HOME-01: assert the rendered month total against fixture invoices.
- A11Y-01: add invoice detail and the add-deal dialog's open state to the axe scan.
- AUTH-02: click the landing CTA; assert the Auth.js sign-in page (no Google).
- SHARE-04, INV-DUE-05.

## Batch 3 — P2 navigation and resilience

AUTH-06, AUTH-07, AUTH-08, NAV-07, NAV-09, NAV-10, HOME-05, HOME-06,
HOME-07, DEAL-DETAIL-02, DEAL-DETAIL-04, SET-05, SET-07, SET-08,
INV-STATUS-07 (`page.route` failure injection is acceptable here: the
interaction is real, and only the server response is stubbed), A11Y-04.
NAV-08 waits for a safe failure-injection seam.

## Next phase — Zero Routine Manual Regression Testing

Goal: no routine release needs a human to re-click a P0/P1 flow. Start only
after PR #25 is integrated and its metrics are trustworthy (the validator now
resolves references through Playwright's registry and checks the @critical
run's results). Batches 1–3 above are the action-level work and are not
repeated here; these are the program-level steps around them.

1. **Close the P0/P1 real-interaction gap.** Work Batches 1 and 2 until every
   P0/P1 action is `automated_real_interaction` or a recorded, justified
   `manual_*`/`blocked` entry. Track the outstanding list in
   `JOURNEY-COVERAGE.md`; no percentage target until Chris sets one.
2. **Verify every real claim, not only @critical ones.** Add a scheduled (or
   pre-release) full `test:e2e` run that feeds
   `coverage:journeys -- --results <results.json> --require-results`, so a
   non-@critical real claim that stops passing is caught. Firefox/WebKit
   results join once those projects are in a claim's scope.
3. **State-transition coverage.** For each graph in `JOURNEY-GRAPHS.md`
   (deal stages, invoice status, share-link lifecycle, due-date edits),
   automate every edge marked UNTESTED: forward, back, reload, and
   browser-history on each. Failure-injection edges use `page.route` as in
   Batch 3 (the interaction stays real).
4. **Critical journeys end to end.** Two or three long journeys (deal →
   invoice → share → recipient → paid; settings change visible on the
   recipient page) that cross pages and reloads, in `chromium` and
   `chromium-mobile`.
5. **Device automation strategy.** Decide (Chris) between a hosted
   real-device service and a scripted emulator lane for the parts emulation
   can't prove: native date picker choice (MAN-DUE-01), WhatsApp hand-off
   (MAN-WA-01), PDF open/save (MAN-PDF-01). Until then these stay manual and
   are logged per release in `MANUAL-UAT.md`; never counted as automated.
6. **Trustworthy release gate.** Once 1–2 are green for a few weeks: a
   pre-release checklist that requires the full-run results check, zero
   `expected_failure` entries on P0 actions (there are none as of
   2026-10-04), and the manual-only items from 5
   signed off. A CI coverage threshold is a separate Chris decision.
7. **Keep the inventory honest.** Every PR that adds or changes a user-facing
   action updates `journey-coverage.json` (`REVIEW_CHECKLIST.md`); a fixed
   defect's `test.fail()` removal now forces the inventory update
   automatically.

## Manual (before the next `staging -> main` release)

MAN-REL-01, MAN-DUE-01 (all four device targets), MAN-AUTH-01 (including
sign-out), MAN-WA-01, MAN-PDF-01, MAN-SHARE-01. Log the results in
`docs/testing/MANUAL-UAT.md`.

## Not planned

- DEAL-DELETE-01: no UI exists. Re-inventory if one ships.
- Exhaustive browser × viewport × language × state products (see JOURNEY-GRAPHS.md §6).
- A coverage-percentage CI gate: only after this inventory has been reviewed
  and Chris approves a policy.
