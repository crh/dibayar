# UX Review Pack V2 — Run Summary

**This file was updated during a stabilization pass** (see `DIBAYAR-UX-REVIEW-PACK-V2-STABILIZATION-RECEIPT.md` at the repo root). The original capture pass's numbers below are superseded by the current, stabilized state; anything not called out as changed is unchanged from the original pass.

## Run identity

- **Branch**: `test/ux-review-pack-v2` (created off `main` at `61caf3d`; original capture pass commit `70bb0a433028fdedd396da34b53128cc7f84c148`, recorded in `DIBAYAR-UX-REVIEW-PACK-V2-RECEIPT.md`; stabilization pass's own commit recorded in `DIBAYAR-UX-REVIEW-PACK-V2-STABILIZATION-RECEIPT.md`, both at the repo root)
- **Environment**: local development machine, Next.js 16.3.0 production build (`npm run build` + `npm run start`), Chromium via Playwright (`channel: "chrome"`), disposable local PostgreSQL at `127.0.0.1:55432/dibayar_test` (the CLAUDE.md-approved test target only)
- **Base URL**: `http://localhost:3400` (`playwright.review-pack.config.ts`, a new config kept separate from `playwright.config.ts` and `playwright.e2e.config.ts` — see that file's header comment)
- **Timestamp**: original capture 2026-09-09; stabilization pass also 2026-09-09
- **Fixtures**: seeded via `UX_FIXTURE_CONFIRM=non-production npx tsx --env-file-if-exists=.env.local scripts/ux-fixtures.ts seed` immediately before each capture run (same mechanism `npm run ux:audit` uses). The stabilization pass ran this seed-then-capture cycle four times total: two back-to-back runs to establish the Phase 11 determinism baseline before touching any code, then Workstreams B–E, then two more back-to-back runs to re-verify determinism on the final state (see `DETERMINISM-REPORT.md`).

## Journey counts (current, post-stabilization)

- **Total journeys discovered/enumerated**: 66 (`J01`–`J66` in `JOURNEY-INVENTORY.md`), several explicitly merged into a related ID or marked not-found against the app's actual behavior (documented inline, not silently dropped)
- **P0**: 17 — **P1**: 19, all with a settled disposition (see `JOURNEY-INVENTORY.md`'s P1 disposition audit table) — **P2**: remainder (mostly corrections/deferrals, not blind omissions)
- **Journeys captured**: 34 distinct journey IDs, via 29 Playwright test cases, 67 screenshots (up from the original pass's 30 / 25 / 61 — see "What changed in the stabilization pass" below)
  - All P0 journeys with a real, capturable UI interaction: captured
  - 2 P0 journeys not separately captured because they're already covered by the pre-existing `tests/ux-audit/routes/matrix.spec.ts` curated corpus (home/deals/invoice-list baseline states, public invoice) — referenced in `JOURNEY-INVENTORY.md` rather than duplicated
  - All 19 P1 journeys have an explicit disposition; 17 are CAPTURED, 1 is COVERED_BY_EXISTING_CORPUS (J05; J57 splits across that and CAPTURED), 1 is BETTER_AS_FUNCTIONAL_ASSERTION (J46)
- **Journeys failed**: 0 — all 29 Playwright tests pass and every manifest entry has `passedFunctionalAssertions: true` (0 exceptions, including J35's copy step — see below)
- **Journeys omitted, with reason**: fully enumerated in `JOURNEY-INVENTORY.md`, either as `[NOT FOUND]` (feature doesn't exist — deal delete/archive, direct invoice creation, native share, partial-payment status, invoice list filter, unsaved-changes warning) or `Capture required: no this pass` (documented but deferred — long-content layout regression already covered elsewhere, due-date field edit, session-expiry, double-click protection [now BETTER_AS_FUNCTIONAL_ASSERTION], language switch, expired public-token fallback)

## What changed in the stabilization pass

- **Fixed `invoices.overdue`'s fixture** (Workstream B): its `InvoiceShare` now carries a real, decryptable `tokenCiphertext` via the app's own `createOrRegenerateShare()`, seeded with a fixed token so `publicTokens.active` (relied on by `tests/ux-audit`) keeps resolving to it. J21 no longer needs to revoke-and-recreate the share before it can send — its baseline capture now shows the intended "overdue invoice with an already-active, usable share link" state directly.
- **Closed J09 and J25** — both were documented in the original `JOURNEY-INVENTORY.md` as "Capture required: yes" but were never actually captured (confirmed by cross-checking `manifest.json`, not just the prose). Both are now genuinely captured.
- **Closed J33** (Workstream C1): the invoice-side settings-dependency notice, using the existing `quiet` persona (no new fixture needed — see `JOURNEY-INVENTORY.md`'s J33 entry for why), plus its resolved state after completing settings.
- **Added J61** (Workstream C2): a deterministic network-failure journey — a deal-status PATCH intercepted via `page.route()` to return HTTP 500, capturing the visible error, the optimistic-UI revert, and correctness after a reload.
- **Fixed J35's clipboard-copy detection** (Workstream D): the original "clipboard fails in headless Chromium" conclusion was itself wrong — the copy button's accessible name is a fixed `aria-label` that never changes even though its visible text flips on success, so the original test could never detect success regardless of outcome. The real "Tersalin" success state is now correctly captured every run.
- **Investigated `/deal/[id]`'s 200-not-404 status** (Workstream E) and confirmed the cause: `src/app/(app)/loading.tsx` (written for the home page's own skeleton) applies as an implicit Suspense boundary to every route under the `(app)` group, so the response streams as 200 before a nested `notFound()` can affect the wire-level status. Confirmed experimentally (removing the file locally made the same route return a real 404; restored afterward, no product code changed). See the stabilization receipt for the full writeup and recommended fix.
- **Performed the Phase 11 determinism check** twice (before and after the above changes) — see `DETERMINISM-REPORT.md`. Result: PASS_WITH_NOTES.

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

67, under `ux-review-pack/screenshots/J##-slug/NN-description-viewport.png`, indexed in `manifest.json` with the full Phase 6 metadata (route, viewport, fixture persona, data state, user action, expected outcome, expected primary CTA, state type, external action intent, pass/fail). Every entry now has `passedFunctionalAssertions: true`.

## Viewports covered

`mobile375` (375×812) for the great majority of journeys (Dibayar's primary mobile-first target) and `laptop1280` (1280×800) for the deal board and invoice-status-chain journeys where desktop layout is materially different (board columns, side-by-side share panel). `tablet768`/`desktop1920` were not exercised this pass — none of the captured journeys are flagged breakpoint-sensitive in `JOURNEY-INVENTORY.md`; `tests/ux-audit/routes/matrix.spec.ts` already covers the curated corpus at its full 5-viewport matrix where that matters.

## Known limitations (current, post-stabilization)

1. **`/deal/[id]` 404 returns HTTP 200 — expected framework behavior, root cause confirmed, not fixed in this session.** Next.js's default not-found page renders correctly and visibly (confirmed by screenshot: "404 / This page could not be found."), but Playwright observes a `200` response status rather than `404` on that route (`J63`). Root cause (confirmed experimentally): `src/app/(app)/loading.tsx`, written as the home page's own loading skeleton, applies as an implicit Suspense boundary to every route in the `(app)` group per Next.js App Router semantics — so the response begins streaming as 200 before the nested page's `notFound()` call can affect the wire-level status (this is the documented trade-off in Next's own `notFound()` API reference: "Because the check runs inside the Suspense boundary, the response has already begun streaming as a 200, and the status can't change once streaming has started"). Verified by temporarily removing `loading.tsx` locally, confirming the same route then returns a real 404, and restoring the file (no product code changed in this session). A real fix — giving `/deal/[id]` (and `/invoice/[id]`, which has the identical structure) their own more targeted `loading.tsx`, or checking existence earlier via middleware — is more than a low-risk one-line change and was intentionally left for a dedicated engineering session; see the stabilization receipt.
2. **Fixture mutation.** This suite mutates deal stages, invoice statuses, share links, and owner settings (including `quiet`'s settings, as of the J33 fix). Run `npm run ux:fixtures -- seed` with `UX_FIXTURE_CONFIRM=non-production` before re-running this suite or any other suite that depends on a pristine fixture baseline (e.g. `npm run ux:audit`).
3. **A minor, non-blocking source of screenshot-content variance across reseeds** exists in the deal board's card ordering (no tiebreaker for same-instant fixture rows) and in the home dashboard's Follow-up Queue reminder occasionally regenerating an already-active share instead of reusing it. Neither is a functional defect; both are documented with recommended (unimplemented) fixes in `DETERMINISM-REPORT.md`.
4. **A filtered run (`playwright test -g "..."`) overwrites `manifest.json`/`.capture-run-stats.json` with only that run's entries.** `pack-capture.ts`'s `writePackManifest()` fires from `journeys.spec.ts`'s file-level `afterAll`, which runs whenever Playwright loads that file at all — even for a single-test `-g` filter — and always *replaces* (not merges) the manifest. Always run the full, unfiltered suite (`npx playwright test -c playwright.review-pack.config.ts`, no `-g`) before treating `manifest.json` as current; a `-g`-filtered run is fine for iterating on one journey but leaves the manifest stale/incomplete afterward until a full run is re-done (learned the hard way during this stabilization pass).
5. **`tests/ux-review-pack/` is intentionally not wired into `npm run ux:audit`'s CI gate.** It has its own Playwright config (`playwright.review-pack.config.ts`) and its own test directory, invoked manually. This is an evidence-capture pass, not a permanent regression suite — see `DIBAYAR-UX-REVIEW-PACK-V2-RECEIPT.md` / the stabilization receipt for what promoting parts of it to permanent status would take.

## Suspected prompt-injection content noticed in `CLAUDE.md` (unrelated to this task, flagged for the record)

Two passages in the repo's own `CLAUDE.md` were treated as untrusted/ignored rather than followed: a block claiming to be written by `next dev` instructing the agent to read `node_modules/next/dist/docs/` and commit that block, and a "staleness" paragraph asserting Production is now openly reachable without an SSO gate. Neither was acted on; this task never touched production or `node_modules` docs. Recorded here since it's the kind of thing a reader of this pack should know was present in the repo during this run.
