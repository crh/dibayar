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

## Batch 1 — P0/P1 gaps with existing fixtures (next PR)

- DEAL-CREATE-01: start the desktop create-deal happy path from the top-bar
  **+ Deal** click, and open the detail through the card menu (covers the
  DEAL-DETAIL-01 desktop path).
- DEAL-STAGE-02: "Kembali ke …" from deal detail and from the card menu,
  with reload and a history entry.
- NAV-02: desktop side-nav/top-bar links to all four sections.
- SET-06: switch language with the **English** button, reload, check that
  invoice detail shows "Due date" / "Not set", then switch back. Reseed
  after, because language is per-user. This is the pairwise language case
  for the whole suite (see JOURNEY-GRAPHS.md §6).
- SET-03: change bank details, reload, and confirm the recipient page
  (`/i/<token>`) shows them.
- SHARE-05: **Salin tautan** with Chromium clipboard permissions granted;
  read the clipboard back.

## Batch 2 — needs small fixture additions (`scripts/e2e-fixtures.ts`)

Dependency: add one overdue invoice (past due date) and one deal with an
invalid WhatsApp number to the deterministic seed, and to the manifest. Keep
IDs `e2e-t0-*` and existing rows unchanged so current tests and the visual
baselines stay valid; check `@visual` after the fixture change.

- INV-STATUS-06: overdue invoice → **Kirim pengingat** uses the chase
  template; **Tandai lunas** persists.
- HOME-03: **Kirim pengingat** from the Beranda follow-up queue (real popup
  plus blocked fallback).
- DEAL-DETAIL-03: repair the invalid number on deal detail, then reload.
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
