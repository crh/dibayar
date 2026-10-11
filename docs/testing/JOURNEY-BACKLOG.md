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
| 3 | FIND-01 (medium): "Tandai terlambat" shows "Terkirim" | INV-STATUS-05, INV-STATUS-02, INV-STATUS-06 | **Fixed** by PR #34 (staging). Chris's decision: overdue is never set by hand. The button is gone and the status API rejects any move to OVERDUE; INV-STATUS-05 is now not applicable. Regression: `e2e/invoices/status-lifecycle.spec.ts`, `e2e/invoices/status-consistency.spec.ts`. Stored rows are not rewritten. |
| 4 | FIND-04 (medium): blocked-popup detection never works -- `window.open(..., "noopener,noreferrer")` returns null by spec, so the **Buka WhatsApp** fallback shows even after WhatsApp opened (invoice detail and Beranda queue) | HOME-03, INV-WA-02 | **Fixed** by PR #29 (merge `ac53043`, staging). Both surfaces open a blank tab on the click, cut its opener and navigate it with no Referer (`src/lib/whatsapp-popup.ts`). The two `test.fail()` tests are now positive regressions, and `e2e/whatsapp/popup-blocker.spec.ts` proves the fallback under a real Chromium blocker. HOME-03 and INV-WA-02 are real. **Still open:** MAN-WA-01 on real phones. |
| 5 | FIND-05 (medium): Beranda **Kirim pengingat** rotated the share token, so a link the brand already had returned 404 | HOME-03, SHARE-02 | **Fixed** by PR #30 (merge `e498ad5`, staging). Chris's decision: reminders reuse a usable active link; only **Buat ulang tautan** rotates. Beranda calls `POST /share/ensure` (`ensureShare`). Regression: `e2e/invoices/reminder-share-link.spec.ts` (reuse, repeat, no share, expired, Regenerate still rotates). |
| 6 | FIND-06 (low): the invoice list shows stored status; Beranda/detail derive OVERDUE from the due date | INV-STATUS-06, INV-LIST-01 | **Fixed** by PR #34 (staging), together with FIND-01. The list groups and labels by the same displayed status as Beranda and detail. Regression: `e2e/invoices/status-consistency.spec.ts`. |
| 7 | FIND-07 (medium): invoice detail showed an expired share as "Tautan aktif sampai <past date>" and its WhatsApp action sent that expired link | INV-STATUS-06, INV-WA-01, SHARE-01, SHARE-02 | **Fixed** by PR #31 (squash merge `979c3ec`, staging). The owner's share state is now inactive / active / expired; invoice detail shows an expired state with **Buat tautan baru** and sends through `POST /share/ensure`. Regression: `e2e/invoices/expired-share.spec.ts`. |
| 8 | FIND-08 (low): the recipient's invoice page and PDF print the due date only inside the payment-terms block, so a deal without payment terms shows the recipient no due date | INV-DUE-05, PUB-01, PUB-05, PUB-06 | **Fixed** by PR #35 (staging). Chris's decision: a due date is shown to the recipient whenever it exists, with or without payment terms; no payment-terms text is invented. Payment terms and the due date are independent in the canonical document model. Regression: `e2e/public/due-date-without-terms.spec.ts`, and the four-combination tests in `src/components/documents/invoice-document/`. |
| 9 | FIND-09 (low): the invoice document prints `Tanggal terbit` as the UTC day of `createdAt`, so an invoice created between 00:00 and 06:59 WIB shows the previous day | PUB-01, INV-PDF-01 | Open, noticed 2026-10-10 during the FIND-08 work. Not changed; needs a product decision. No browser test asserts either behaviour. |
| 10 | FIND-10 (high): every change to a deal that named no stage (contact name, repaired WhatsApp number on deal detail, invoice detail or Beranda) also moved the deal back to Masuk and wrote a `<stage> → Masuk` history entry | DEAL-DETAIL-02, DEAL-DETAIL-03 | **Fixed** on `fix/deal-patch-keeps-stage-2026-10-11` (staging). The PATCH schema was the create schema made `partial()`, which keeps its `status: "MASUK"` default; it now has no status default. On `main`/Production since 2026-07-14. Regression: `src/lib/deal-validation.test.ts`, `src/lib/deals.test.ts`, `e2e/deals/patch-keeps-stage.spec.ts`, `e2e/deals/contact-repair.spec.ts`. **Still open for Chris:** a read-only Production count of `→ Masuk` transitions that coincide with a contact edit; stored rows are not repaired. |
| 11 | FIND-11 (low): a saved contact name cannot be removed on deal detail (emptying the field sends an empty PATCH, the page says saved and puts the old name back) | DEAL-DETAIL-02 | Open, noticed 2026-10-11. Not changed; needs a small decision. No browser test asserts either behaviour. |

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
  (Real since the FIND-04 fix, `fix/whatsapp-popup-fallback-2026-10-05`.)
- INV-WA-02 reclassified to partial (stubbed `window.open`, and FIND-04 means
  it cannot tell blocked from opened). (Real again since the FIND-04 fix: a
  real Chromium blocker test plus "popup opened -> no fallback".)
- Flake fix: the `fill()`-based due-date test in `invoice-journeys.spec.ts`
  now waits for hydration (reproduced with CPU throttling; see receipt).

## Batch 2B — remaining Batch 2 items (done, Zero Routine Phase 2B)

Delivered on `chore/zero-routine-regression-phase2b-2026-10-08` (receipt:
`docs/receipts/DIBAYAR-ZERO-ROUTINE-REGRESSION-PHASE2B-2026-10-08.md`). No
application code changed.

- INV-PDF-01, PUB-05, PUB-06 (real, both projects):
  `e2e/invoices/pdf-download.spec.ts` -- **Unduh PDF** clicked by the owner
  and by a session-less recipient, the browser's download event, text read
  with `pdftotext` (`e2e/support/pdf.ts`), bank details edited in Settings
  first, owner and recipient text compared for equality.
- DEAL-CREATE-06 (real, both projects) and the text fields of DEAL-CREATE-07:
  `e2e/deals/create-validation.spec.ts`. DEAL-CREATE-07 stays **partial**:
  the deadline's native picker is not driven (MAN-DEAL-01).
- SET-04 (real, both projects): `e2e/settings/whatsapp-templates.spec.ts` --
  both templates edited, then sent from a non-overdue and an overdue invoice.
- HOME-01 (real, both projects): `e2e/home/monthly-income.spec.ts` on the new
  opt-in `income-boundaries` overlay (draft, 1 ms before the month, first
  instant of the month, first instant of next month).
- AUTH-02 (real, both projects): `e2e/auth/sign-in-entry.spec.ts` -- landing
  CTA -> Auth.js page -> the redirect to Google read without following it.
- SHARE-04 (real, both projects): `e2e/invoices/share-cancel.spec.ts`.
- INV-DUE-05 (real, desktop Chromium): `e2e/invoices/due-date-consistency.spec.ts`
  in an Asia/Jakarta and a Pacific/Honolulu browser.
- A11Y-01: invoice detail (plain, and with the regenerate confirmation open)
  added to the axe scan; stays **partial** by rule.
- INV-DUE-06: assessed, left **partial** (the failure can only be injected
  with a stub).
- CI: `poppler-utils` installed in the E2E jobs; new manual-dispatch
  `journey-coverage-full` job (full E2E + ux-audit +
  `coverage:journeys --require-results`).

## Phase 2C — reliability and release-readiness infrastructure (done)

Delivered on `chore/zero-routine-regression-phase2c-2026-10-09` (receipt:
`docs/receipts/DIBAYAR-ZERO-ROUTINE-REGRESSION-PHASE2C-2026-10-09.md`). CI,
validator and docs only: no application code, no new journey, and no action
changed status.

- The full real-claim check is its own workflow, `Journey coverage (full)`
  (`.github/workflows/journey-coverage-full.yml`): dispatch, a
  Monday/Wednesday/Friday schedule, and PRs that change the lane itself
  or the inventory. It
  no longer shares a workflow run with the scheduled `e2e-cross-browser`
  acceptance runs. The schedule starts only when the file reaches `main`.
- Each run states what it proved (commit, real-claim count, not exercised) on
  its summary page and in a 90-day evidence artifact
  (`docs/testing/E2E.md`, "Full real-claim verification").
- Exception register for P0/P1 actions that are not fully automated, in the
  inventory (`exceptions`), validated by `npm run coverage:journeys` and
  rendered into `JOURNEY-COVERAGE.md`.
- `REVIEW_CHECKLIST.md` Gate F now separates automated CI blockers, manual
  sign-off, product decisions, and informational items.

## Carried forward from 2B (not done in 2C)

- DEAL-CREATE-07 deadline and INV-DUE-03 on real phones (MAN-DEAL-01,
  MAN-DUE-01); MAN-PDF-01 for phone PDF viewers.
- A11Y-01: deal detail, the expired-share and contact-repair states of
  invoice detail, Settings validation errors.
- AUTH-02: the English landing CTA.
- Decisions (Chris): FIND-09, FIND-11. (FIND-01 and FIND-06 were decided and fixed
  on `fix/invoice-status-consistency-2026-10-09`; FIND-08 on
  `fix/recipient-due-date-without-payment-terms-2026-10-09`.)

## Batch 3 — P2 navigation and resilience

### Batch A (done, Staging Autopilot v2, 2026-10-10)

Delivered on `chore/journey-batch-a-nav-session-2026-10-10` (receipt:
`docs/receipts/DIBAYAR-AUTOPILOT-BATCH-A-NAV-SESSION-2026-10-10.md`). Tests
and one fixture action only; no application code changed. All nine are real
in `chromium` and `chromium-mobile`.

- AUTH-06: `e2e/auth/settings-sign-out.spec.ts` -- Pengaturan **Keluar**,
  **Batal** (session survives a reload), **Ya, keluar**, and the same token
  refused from a fresh browser.
- AUTH-07: `e2e/auth/session-expiry.spec.ts` -- a session that expires with a
  page open (new fixture action `expire-disposable-session`): reload, Back,
  an in-app link, and **Tandai lunas** (401, visible error, nothing stored).
- NAV-07, NAV-09, NAV-10, AUTH-08: `e2e/smoke/secondary-nav.spec.ts` -- the
  account menu's **Pengaturan** (click and keyboard), both detail back links
  with reload/Back/Forward, and the legacy `/dashboard` addresses signed in
  and signed out.
- HOME-05, HOME-06, HOME-07: `e2e/home/beranda-links.spec.ts` -- every
  follow-up row and every deal-terdekat row opens its own record; both
  **Lihat semua** links.

### Batch D — long cross-page journeys (done, one-shot autopilot, 2026-10-11)

Delivered on `test/creator-cross-page-journeys-2026-10-11` (receipt:
`docs/receipts/DIBAYAR-E2E-AUTOPILOT-ONE-SHOT-2026-10-11.md`). Tests, one
helper file and docs only; no application code, fixture, inventory status or
CI change. All three are `@critical` and run in `chromium` and
`chromium-mobile`; `docs/testing/E2E.md` lists their checkpoints and
`JOURNEY-GRAPHS.md` §7 the graph edges each one walks.

- `e2e/journeys/deal-to-paid.spec.ts` -- deal → every stage → invoice → sent
  → share → WhatsApp (local stub) → recipient page and PDF → paid → list,
  board and Beranda.
- `e2e/journeys/settings-to-recipient.spec.ts` -- issuer, bank and send
  template → WhatsApp message, owner PDF, recipient page and PDF.
- `e2e/journeys/resilience-permissions.spec.ts` -- session expiry while a deal
  is being edited, the reused token, the second user, and a link revoked
  while the recipient has it open.

They are not inventory evidence: no action's status or test list changed.

### Still open

DEAL-DETAIL-04, SET-05, SET-07, SET-08,
INV-STATUS-07 (`page.route` failure injection is acceptable here: the
interaction is real, and only the server response is stubbed), A11Y-04.
NAV-08 waits for a safe failure-injection seam. (DEAL-DETAIL-02 is real since
the FIND-10 fix, 2026-10-11: `e2e/deals/patch-keeps-stage.spec.ts`.)

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
2. **Verify every real claim, not only @critical ones.** (Done in Phase 2C:
   the `Journey coverage (full)` workflow, scheduled and dispatchable.) A
   full `test:e2e` run feeds
   `coverage:journeys -- --results <results.json> --require-results`, so a
   non-@critical real claim that stops passing is caught. Still open: the
   schedule only runs once the workflow is on `main`, and its scheduled
   reliability is unproven until it has run there. Firefox/WebKit
   results join once those projects are in a claim's scope.
3. **State-transition coverage.** For each graph in `JOURNEY-GRAPHS.md`
   (deal stages, invoice status, share-link lifecycle, due-date edits),
   automate every edge marked UNTESTED: forward, back, reload, and
   browser-history on each. Failure-injection edges use `page.route` as in
   Batch 3 (the interaction stays real).
4. **Critical journeys end to end.** (Done 2026-10-11, Batch D: three long
   journeys in `e2e/journeys/`, `chromium` and `chromium-mobile`, see "Batch D"
   above.)
   Two or three long journeys (deal →
   invoice → share → recipient → paid; settings change visible on the
   recipient page) that cross pages and reloads, in `chromium` and
   `chromium-mobile`.
5. **Device automation strategy.** Decide (Chris) between a hosted
   real-device service and a scripted emulator lane for the parts emulation
   can't prove: native date picker choice (MAN-DUE-01), WhatsApp hand-off
   (MAN-WA-01), PDF open/save (MAN-PDF-01). Until then these stay manual and
   are logged per release in `MANUAL-UAT.md`; never counted as automated.
6. **Trustworthy release gate.** The checklist exists since Phase 2C
   (`REVIEW_CHECKLIST.md` Gate F: CI blockers, manual sign-off, product
   decisions, informational). The full-run results check is informational
   there. Once 1–2 are green for a few weeks, Chris decides whether it
   becomes a blocker. There are no `expected_failure` entries on P0 actions
   (none as of 2026-10-09). A CI coverage threshold is a separate Chris
   decision.
7. **Keep the inventory honest.** Every PR that adds or changes a user-facing
   action updates `journey-coverage.json` (`REVIEW_CHECKLIST.md`); a fixed
   defect's `test.fail()` removal now forces the inventory update
   automatically.

## Manual (before the next `staging -> main` release)

MAN-REL-01, MAN-DUE-01 (all four device targets), MAN-AUTH-01 (including
sign-out), MAN-DEAL-01, MAN-WA-01, MAN-PDF-01, MAN-SHARE-01. Log the results in
`docs/testing/MANUAL-UAT.md`. Which of these block a release and which are
expected but not blocking is in the exception register
(`docs/testing/JOURNEY-COVERAGE.md`) and `REVIEW_CHECKLIST.md` Gate F.

## Not planned

- DEAL-DELETE-01: no UI exists. Re-inventory if one ships.
- Exhaustive browser × viewport × language × state products (see JOURNEY-GRAPHS.md §6).
- A coverage-percentage CI gate: only after this inventory has been reviewed
  and Chris approves a policy.
