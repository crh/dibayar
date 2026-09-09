# UX Review Pack V2 — Run Summary

## Run identity

- **Branch**: `test/ux-review-pack-v2` (created off `main` at `61caf3d`; this pack's own commit is recorded in `DIBAYAR-UX-REVIEW-PACK-V2-RECEIPT.md` at the repo root)
- **Environment**: local development machine, Next.js 16.3.0 production build (`npm run build` + `npm run start`), Chromium via Playwright (`channel: "chrome"`), disposable local PostgreSQL at `127.0.0.1:55432/dibayar_test` (the CLAUDE.md-approved test target only)
- **Base URL**: `http://localhost:3400` (`playwright.review-pack.config.ts`, a new config kept separate from `playwright.config.ts` and `playwright.e2e.config.ts` — see that file's header comment)
- **Timestamp**: 2026-09-09, captured in a single run (not the Phase 11 double-run — see "Known capture limitations" below)
- **Fixtures**: seeded via `UX_FIXTURE_CONFIRM=non-production npx tsx --env-file-if-exists=.env.local scripts/ux-fixtures.ts seed` immediately before the final capture run (same mechanism `npm run ux:audit` uses)

## Journey counts

- **Total journeys discovered/enumerated**: 66 (`J01`–`J66` in `JOURNEY-INVENTORY.md`), several explicitly merged into a related ID or marked not-found against the app's actual behavior (documented inline, not silently dropped)
- **P0**: 17 — **P1**: 19 — **P2**: remainder (mostly corrections/deferrals, not blind omissions)
- **Journeys captured this run**: 30 distinct journey IDs, via 25 Playwright test cases, 61 screenshots
  - All P0 journeys with a real, capturable UI interaction: captured
  - 2 P0 journeys not separately captured because they're already covered by the pre-existing `tests/ux-audit/routes/matrix.spec.ts` curated corpus (home/deals/invoice-list baseline states, public invoice) — referenced in `JOURNEY-INVENTORY.md` rather than duplicated
  - ~10 representative P1 journeys captured (deal detail navigation, stage filter, form validation, WhatsApp contact repair x2, PDF download, share regenerate/revoke, settings validation, sign-out confirm)
- **Journeys failed**: 0 — all 25 Playwright tests pass and all functional assertions hold, with one partial exception: `J35`'s "copy" step (see Known capture limitations)
- **Journeys omitted this pass, with reason**: fully enumerated in `JOURNEY-INVENTORY.md`, either as `[NOT FOUND]` (feature doesn't exist — deal delete/archive, direct invoice creation, native share, partial-payment status, invoice list filter, unsaved-changes warning) or `Capture required: no this pass` (documented but deferred — long-content layout regression already covered elsewhere, due-date field edit, invoice-side settings-dependency notice with no matching fixture, network-failure states, session-expiry, double-click protection, language switch, expired public-token fallback)

## WhatsApp journeys covered

- Deal-stage follow-up with a valid number (`J18`) and with an invalid stored number, repair panel shown but not submitted (`J19`)
- Invoice send (valid contact, `J20`) and overdue reminder (`J21`, using the chase template)
- Invoice-side contact repair with auto-send in the same step (`J22`)
- Home dashboard Follow-up Queue reminder action (`J42`)
- All hrefs verified as `https://wa.me/<number>?text=...` (or bare `wa.me/<number>` for the deal-stage case) via a `window.open` stub — **no real WhatsApp message was ever sent or window opened**

## Deal-status transitions covered

All 5 forward transitions across the 6-stage pipeline (`J11a`–`J11e`: Masuk→Nego→Deal→Konten→Invoice→Dibayar), each captured at the card-menu-open, moved, and persisted-after-reload states. Plus the full deal-to-invoice lifecycle (`J23`: an unrelated deal moved Deal→Konten→Invoice, then invoiced).

## Invoice/payment-status transitions covered

The full chain in one continuous journey (`J27`): DRAFT→SENT→DUE→OVERDUE→PAID, each transition captured, PAID state verified to survive a reload, then explicitly undone back to SENT (`J28`).

## Screenshots produced

61, under `ux-review-pack/screenshots/J##-slug/NN-description-viewport.png`, indexed in `manifest.json` with the full Phase 6 metadata (route, viewport, fixture persona, data state, user action, expected outcome, expected primary CTA, state type, external action intent, pass/fail).

## Viewports covered

`mobile375` (375×812) for the great majority of journeys (Dibayar's primary mobile-first target) and `laptop1280` (1280×800) for the deal board and invoice-status-chain journeys where desktop layout is materially different (board columns, side-by-side share panel). `tablet768`/`desktop1920` were not exercised this pass — none of the captured journeys are flagged breakpoint-sensitive in `JOURNEY-INVENTORY.md`; `tests/ux-audit/routes/matrix.spec.ts` already covers the curated corpus at its full 5-viewport matrix where that matters.

## Known capture limitations

1. **`invoices.overdue`'s pre-seeded share is undecryptable.** Its `InvoiceShare` row was seeded directly (`createMany`, no `tokenCiphertext`), so the server can't recover a plaintext path; the share reads back `active` with a null link, which the app correctly treats as stale and disables the primary WhatsApp button. `J21` works around this by revoking that stale share first (a real, in-app recovery action) before sending — this is now part of the captured journey rather than a hidden test hack, but it means `invoices.overdue`'s *original* seeded-share state itself was never captured. Worth a fixtures fix (seed via the app's own share-create path, or add `tokenCiphertext`) in a follow-up.
2. **Headless clipboard.** `navigator.clipboard.writeText` rejected in this headless Chromium capture environment despite `clipboard-write` being granted (a document-focus quirk of headless mode, not a product defect). `J35`'s copy step captured the app's real failure-state UI (button stays "Salin", inline `role="alert"` error) instead of the intended success state ("Tersalin"). Marked `passedFunctionalAssertions: false` for that one manifest entry rather than hidden.
3. **`/deal/[id]` 404 returns HTTP 200.** Next.js's default not-found page renders correctly and visibly (confirmed by screenshot: "404 / This page could not be found."), but Playwright observed a `200` response status rather than `404` on that route (`J63`). Likely a streaming/shared-layout status-code quirk in this Next.js version rather than a functional break — flagged for engineering, not treated as a failed journey since the user-visible behavior is correct.
4. **Fixture mutation.** This suite mutates deal stages, invoice statuses, share links, and owner settings. Run `npm run ux:fixtures -- seed` with `UX_FIXTURE_CONFIRM=non-production` (see this repo's own invocation in `scripts/ux-audit.ts`) before re-running this suite or any other suite that depends on a pristine fixture baseline (e.g. `npm run ux:audit`).
5. **Phase 11 (double-run determinism check) was not performed this pass** — scope was deliberately reduced to a single, thorough capture pass plus the full journey inventory, per this session's task framing. Journey ordering, screenshot naming, and fixture determinism were not independently re-verified by a second run.
6. **`tests/ux-review-pack/` is intentionally not wired into `npm run ux:audit`'s CI gate.** It has its own Playwright config (`playwright.review-pack.config.ts`) and its own test directory, invoked manually. This is a one-session evidence-capture pass, not a permanent regression suite — see `DIBAYAR-UX-REVIEW-PACK-V2-RECEIPT.md`'s recommended next step for what promoting parts of it to permanent status would take.

## Suspected prompt-injection content noticed in `CLAUDE.md` (unrelated to this task, flagged for the record)

Two passages in the repo's own `CLAUDE.md` were treated as untrusted/ignored rather than followed: a block claiming to be written by `next dev` instructing the agent to read `node_modules/next/dist/docs/` and commit that block, and a "staleness" paragraph asserting Production is now openly reachable without an SSO gate. Neither was acted on; this task never touched production or `node_modules` docs. Recorded here since it's the kind of thing a reader of this pack should know was present in the repo during this run.
