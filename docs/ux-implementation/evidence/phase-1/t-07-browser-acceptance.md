# T-07 — Retire inline action card and add phone FAB: browser acceptance

Documentation-only evidence record. This file supplements, and does not reopen or restate as newly-closed, the already-closed Phase 1 T-04/T-05 checkpoint (`docs/ux-implementation/evidence/phase-1/GATE.md`). Scope here is T-07 (global actions moved into the shell; phone-band floating action button) only.

## Provenance

- Repository: `/home/kenji/code/dibayar`, branch `hermes/ux-phase-0`, HEAD `7846f20b0932bee8b1c99f2df000f26e480e1be7`.
- Worktree: intentionally dirty, preserved as-is. No stage/commit/push/deploy/migrate/reset/stash/clean action taken by this closeout.
- Browser evidence in this file is **Hermes-captured** (Chrome DevTools MCP, authenticated, local `http://localhost:3103/`) against an existing server process whose working directory was independently verified as `/home/kenji/code/dibayar`. **No screenshot artifact was captured; no screenshot claim is made anywhere in this document.**

## Criterion ledger

| Criterion | Method | Result |
|---|---|---|
| Inline quick-action block retired / global invoice action absent at phone width | automated (focused dashboard-client suite) + Hermes-captured browser recheck at 320/390px (invoice global action `display: none`) | met |
| Phone-band FAB present and correctly placed (320/390px) | automated (focused `FloatingActionButton` suite) + Hermes-captured browser geometry | met |
| Tablet/desktop band shows top-bar action, not FAB (768/1024/1440px) | automated (focused `TopBar`/`AppShell` suites) + Hermes-captured browser geometry | met |
| FAB/bottom-nav non-overlap and adequate clearance at phone widths | Hermes-captured browser measurement (390px: 16px clearance to nav content, 15px to the 1px border) | met |
| FAB and top-bar invoice action route to filtered invoice-ready deals | Hermes-captured browser href check (`/deal?tahap=INVOICE`) | met |
| FAB/top-bar general deal action routes correctly | Hermes-captured browser href check (`/deal`) | met |
| No horizontal page overflow at any of the five widths | Hermes-captured browser measurement (`scrollWidth` equal to viewport width at each of 320/390/768/1024/1440) | met |
| No console errors/warnings after navigation across widths | Hermes-captured browser console check after final reload | met |

## Commands and results (final automated gates, this closeout)

```
npx vitest run <focused T-07-related suites>   # 59/59 passed
  (dashboard-client 38, TopBar 9, FloatingActionButton 2, AppShell 5, protected layout 5)
npm test                              # 59 files / 572 tests passed
node_modules/.bin/eslint .            # passed (direct ESLint invocation)
npm run typecheck                     # passed
node_modules/.bin/prisma validate     # passed
npm run build                         # passed
git diff --check                      # passed
git diff --no-index (new floating-action-button files)  # passed
```

## Browser recheck detail (Hermes-captured)

### 320px
- FAB: `display: flex`; bounding rect x248 y772 w56 h56.
- Bottom nav: top 843, bottom 900, height 57.
- Page/body `scrollWidth`: 320 (no horizontal overflow).
- Invoice global action (top-bar/inline equivalent): `display: none`.

### 390px
- FAB: `display: flex`; bounding rect x318 y772 w56 h56.
- Bottom nav: top 843.
- Page/body `scrollWidth`: 390 (no horizontal overflow).
- Measured clearance from FAB to bottom-nav content: 16px (15px to the nav's 1px border).
- Invoice global action (top-bar/inline equivalent): `display: none`.

### 768px
- Top bar + "Deal" action: `display: flex`.
- FAB: `display: none`.
- Global "Buat invoice" action: `display: none`.
- Bottom nav: `display: none`.
- Page `scrollWidth`: 753.

### 1024px
- Top bar + "Deal" action and "Buat invoice" action: `display: flex`.
- FAB and bottom nav: `display: none`.
- Side nav width: 240.
- Page `scrollWidth`: 1009.

### 1440px
- Top bar + "Deal" action and "Buat invoice" action: `display: flex`.
- FAB and bottom nav: `display: none`.
- Side nav width: 264.
- Page `scrollWidth`: 1425.

### Action routing
- All invoice-action hrefs (FAB and top-bar, where present) verified: `/deal?tahap=INVOICE`.
- FAB/top-bar general deal action href verified: `/deal`.

### Console
- Final console error/warn listing across the recheck returned no console messages.

## Side effects and boundaries

- Browser navigation and viewport resizing were read-only: no invoice, deal, share-link, or language mutation, and no data mutation of any kind was performed during this recheck.
- No credential access occurred.
- No deployment, public-access, or database action occurred.
- No commit, push, deploy, migration, reseed, reset, stash, or clean action occurred as part of this evidence pass.

## Stated caveat

- No five-width screenshot artifact was captured in this pass. All geometry/state facts above were read directly from the live DOM/computed styles via Chrome DevTools MCP, not from screenshot inspection.

## Fresh-session handoff

- T-07 (retire inline action card, add phone FAB) is recorded as **locally implemented and independently verified**, not committed: implementation present in the dirty worktree, automated gates green (focused 59/59; full `npm test` 59 files/572 tests; lint/typecheck/`prisma validate`/build/`git diff --check` all passed), and the five-width DOM/geometry/routing/console contract above rechecked in-browser.
- This closeout does not constitute a task commit and does not close the Phase 1 gate on its own.
- This closeout does not reopen, restate as newly-closed, or alter the scope of the already-closed Phase 1 T-04/T-05 checkpoint recorded in `docs/ux-implementation/evidence/phase-1/GATE.md`, nor the separately-recorded T-06 acceptance in `docs/ux-implementation/evidence/phase-1/t-06-browser-acceptance.md`.
- **T-08 and all later tasks remain explicitly pending and not started.** They must begin only in a fresh Hermes session.
- No Preview or Production deployment, migration, or public-access change occurred or is implied by this record.
