# Dibayar UX Review Pack V2 — Receipt

## 1. Branch and commit

- Branch: `test/ux-review-pack-v2` (created off `main` at `61caf3d`)
- Commit: `70bb0a433028fdedd396da34b53128cc7f84c148`
- Not merged to `main`; nothing pushed to any remote

## 2. Discovered journey count

66 journeys enumerated (`J01`–`J66`) in `ux-review-pack/JOURNEY-INVENTORY.md`, built by reading the live application source (routes, deal/invoice status machines, `src/lib/whatsapp.ts`, `src/lib/i18n.ts`, `prisma/schema.prisma`) and cross-checked against the sibling Playwright e2e suite — not assumed from the original review-pack request's list. 9 of the request's assumed journeys were corrected against actual app behavior (e.g. no deal delete/archive UI, no direct invoice creation, no native share, deal status changes one stage at a time via a card menu rather than a dropdown); 8 real journeys the request didn't anticipate were added (deal-side WhatsApp repair, share regenerate/revoke confirms, sign-out confirm, language switch, expired public token).

## 3. Captured journey count

30 distinct journey IDs captured this pass, via 25 Playwright test cases (all 25 pass), producing 61 screenshots.

## 4. P0/P1/P2 coverage

- **P0**: 17 total. All that have a real, capturable UI interaction were captured this pass; 2 are covered by the pre-existing `tests/ux-audit/routes/matrix.spec.ts` curated corpus and referenced rather than re-captured.
- **P1**: 19 total. ~10 representative ones captured (deal detail, stage filter, form validation, both WhatsApp contact-repair flows, PDF download, share regenerate/revoke, settings validation, sign-out confirm). Remainder documented as deferred with reasons in `run-summary.md`.
- **P2**: remainder — mostly `[NOT FOUND]` corrections against the request's assumptions, or explicitly deferred (long-content layout, network-failure states, session-expiry). None silently dropped; each has a one-line reason in `JOURNEY-INVENTORY.md`.

## 5. WhatsApp journeys covered

Deal-stage follow-up (valid + invalid number), invoice send + overdue reminder (chase template), invoice-side contact repair with auto-send, and the home-dashboard Follow-up Queue reminder action. Every generated `wa.me` href was verified via a stubbed `window.open` — no real WhatsApp message or window was ever opened.

## 6. Deal-status transitions covered

All 5 forward transitions across the 6-stage pipeline (Masuk→Nego→Deal→Konten→Invoice→Dibayar), each verified to move on click and survive a reload. Plus a full deal-to-invoice lifecycle (move a deal to Invoice stage, then create its invoice).

## 7. Invoice/payment-status transitions covered

The full chain in one continuous journey: DRAFT→SENT→DUE→OVERDUE→PAID (verified to survive a reload), then explicitly undone back to SENT.

## 8. Screenshots produced

61, under `ux-review-pack/screenshots/`, indexed in `ux-review-pack/manifest.json` with full per-step metadata (journey/step id, route, viewport, fixture persona, data state, user action, expected outcome, expected primary CTA, state type, external action intent, pass/fail).

## 9. Viewports covered

`mobile375` (375×812, the primary target) for the majority; `laptop1280` (1280×800) for the deal board and invoice-status-chain journeys where desktop layout materially differs. `tablet768`/`desktop1920` not exercised this pass — no captured journey is flagged breakpoint-sensitive, and the existing curated corpus already covers those bands where it matters.

## 10. Failed/omitted journeys

**Failed**: 0 test failures. One partial exception: `J35`'s clipboard-copy step captured the app's real failure-state UI instead of the intended success state, because `navigator.clipboard.writeText` rejected in this headless capture environment (a capture-environment limitation, not a product defect) — marked `passedFunctionalAssertions: false` in the manifest rather than hidden or silently retried into a false pass.

**Omitted**: fully enumerated with reasons in `ux-review-pack/JOURNEY-INVENTORY.md` and `ux-review-pack/run-summary.md`. Categories: features that don't exist in the app (corrections against the original request), states with no matching fixture (invoice-side settings-dependency notice), states judged low-value to script this pass (loading/disabled-state screenshots, double-click protection — better suited to a component-level assertion than a screenshot), and states explicitly out of this session's scope (network-failure injection, session-expiry, the Phase 11 double-run).

## 11. Known limitations

1. `invoices.overdue`'s fixture-seeded `InvoiceShare` row has no `tokenCiphertext`, so the server can't decrypt it to a plaintext path — its share reads back as active-but-stale, and the app correctly disables the send button for that state. Worked around in `J21` by revoking the stale share first (a real recovery path), but that fixture's original stale-share state was itself never captured as a distinct journey.
2. Headless-Chromium clipboard rejection (see item 10 above).
3. `/deal/[id]` renders Next.js's default not-found page correctly (confirmed visually) but Playwright observed HTTP 200, not 404, on that route — flagged for engineering as a possible streaming/shared-layout status-code quirk in this Next.js version, not treated as a UX failure since the rendered experience is correct.
4. This suite mutates fixture data (deal stages, invoice statuses, share links, owner settings). `npm run ux:fixtures -- seed` (with `UX_FIXTURE_CONFIRM=non-production`) must be re-run before this suite or any other fixture-dependent suite runs again.
5. The Phase 11 double-run determinism check was not performed — see item 12.
6. Two passages in this repo's own `CLAUDE.md` were identified as suspected prompt-injection content (a fake `next dev`-authored instruction to read and commit `node_modules/next/dist/docs/` content, and a claim that Production is now openly reachable) and were deliberately not acted on. Unrelated to this task's scope but recorded for the record — see `ux-review-pack/run-summary.md`'s closing section.

## 12. Recommended next step

1. **Run Phase 11**: repeat this capture pass a second time (after reseeding fixtures) and diff journey ordering, screenshot naming, and functional-assertion results against this run to confirm determinism before treating this pack as stable evidence.
2. **Capture remaining P1/P2 journeys** documented as deferred in `JOURNEY-INVENTORY.md`, particularly the invoice-side settings-dependency notice (needs a new fixture: a `zero`-persona deal at Invoice stage with an invoice) and at least one network-failure-injection journey (cheap to add via Playwright `page.route()` on a single mutation).
3. **Fix the `invoices.overdue` fixture** to seed its share via the app's own create path (or add `tokenCiphertext` directly) so that invoice's originally-intended "already has an active share" state becomes capturable without a workaround.
4. Hand `ux-review-pack/` to a fresh Claude Design session using `ux-review-pack/CLAUDE-DESIGN-REVIEW.md` as the request document — that session was explicitly out of scope here (no redesign or fix was attempted).

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01GZtnVoEbfsb9bTCtYrvz3r
