# Journey coverage backlog

Prioritized, dependency-aware follow-up to the 2026-10-03 inventory
(`docs/testing/journey-coverage.json`). Each batch is one small PR into
`staging`. Every batch updates the inventory, regenerates
`docs/testing/JOURNEY-COVERAGE.md`, and adds no unbounded browser matrix.
Action IDs here are cross-checked by `npm run coverage:journeys`.

## 0. Product fixes (separate PRs, not test infrastructure)

These are defects the pilot found or confirmed. Fix them in their own scoped
`fix/*` PRs, and remove the matching `test.fail()` line in the same PR.

| Order | Finding | Actions | Why first |
|---|---|---|---|
| 1 | FIND-03 (high) — keyboard entry saves year 0002 and permanently breaks the owner's invoice page | INV-DUE-04 | Corrupts data, and the only repair UI is on the page it breaks. Server-side range validation on `dueDate` is the minimum. The invoice page should also render rather than throw for an out-of-range stored date. **Chris:** a read-only Production check for `dueDate < 1900-01-01` is worth doing; any data repair is Chris-only. |
| 2 | FIND-02 (high) — click/tap on the visible empty due-date field does nothing | INV-DUE-02, INV-DUE-03 | The Production report. One option is `showPicker()` on click. It was verified locally to flip the expected-failure test, but only as a negative-control exercise, not as a reviewed fix. Run MAN-DUE-01 on real devices after the fix. |
| 3 | FIND-01 (medium) — "Tandai terlambat" shows "Terkirim" | INV-STATUS-05 | Needs a product decision from Chris before any code or test. |

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

## Manual (before the next `staging -> main` release)

MAN-REL-01, MAN-DUE-01 (all four device targets), MAN-AUTH-01 (including
sign-out), MAN-WA-01, MAN-PDF-01, MAN-SHARE-01. Log the results in
`docs/testing/MANUAL-UAT.md`.

## Not planned

- DEAL-DELETE-01: no UI exists. Re-inventory if one ships.
- Exhaustive browser × viewport × language × state products (see JOURNEY-GRAPHS.md §6).
- A coverage-percentage CI gate: only after this inventory has been reviewed
  and Chris approves a policy.
