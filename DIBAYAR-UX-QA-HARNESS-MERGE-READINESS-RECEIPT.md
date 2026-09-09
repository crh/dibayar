# Dibayar UX QA Harness — Merge-Readiness Fix Receipt

## 1. Final verdict

**READY_TO_MERGE**

## 2. Branch / commits

Branch: `test/ux-qa-harness`

```
4bf2514 Fix stale UX baseline regression and remove serial cascade
64e9c80 Fix false-green gate: ux:audit can silently pass on infra failure
2b8978d Add UX QA harness: route/state/viewport matrix, deterministic detectors, CI gate
179802c Merge branch 'security/dependabot-triage-deepmerge-major'   <- main
```

`main` was not touched. Nothing was merged or pushed. The one pre-existing, unrelated untracked file (`DIBAYAR-VISUAL-DATE-PUSH-RECEIPT.md`) remains untouched and untracked, as found.

## 3. Reviewer fix integration

Commit `782b6d7` from `review/ux-qa-harness` was brought onto `test/ux-qa-harness` with a clean `git cherry-pick 782b6d7` (no conflicts) — it now exists as `64e9c80`. `git diff` between the two branches for `scripts/ux-audit.ts`/`scripts/ux-report.ts` is empty: the code is byte-identical to the independently-reviewed and verified version. No manual reapplication was needed.

## 4. Legacy `/dashboard` remediation

**What was stale**: `tests/ux-audit/fixtures.baseline.spec.ts`'s `test.describe.serial(...)` block had one known-failing test ("captures populated owner dashboard at five widths in ID and EN") and five siblings that had never actually run (skipped by the serial cascade, per the independent review). Un-serializing the suite to let them run for the first time revealed that **four of those five were also stale**, each in a different, specific way:

| test | what was stale | current behavior asserted instead |
| --- | --- | --- |
| "captures populated owner dashboard..." | The whole page (`/dashboard` showing a deal card + an invoice number together) no longer exists — T-08/T-12 split it into `/`, `/deal`, `/invoice`. | **Retired.** No replacement assertion — see coverage map below. |
| "second-owner invoice isolation" | Asserted `response.status() === 404`. Every route under the `(app)` group is wrapped in `src/app/(app)/loading.tsx`, which — per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md` and `.../loading.md#status-codes` — makes Next.js commit to a streamed `200` before `notFound()`'s render can flip the status. Verified directly with `curl` (no test framework involved) that `other` viewing `owner`'s draft invoice, and vice versa, both return HTTP 200 with Next's default not-found page body (`<meta name="robots" content="noindex">`, "This page could not be found.") and no leaked invoice data. | Asserts on the rendered not-found content and the absence of the other owner's invoice number, not on `response.status()`. |
| invoice-detail "Bagikan via WhatsApp is disabled" | That button/label was removed in the T-19 header reorder (`invoice-detail-client.tsx`'s own comment: "the per-share WhatsApp button that used to live here is gone"). F15 also deliberately made the current primary action button *never* disabled for an invalid contact — it reveals a contact-repair panel instead, by design. | Asserts the current button ("Kirim lewat WhatsApp") is enabled, clicks it, and asserts the repair panel's invalid-number message appears. |
| public-invoice active-token number visibility | Used an exact-text locator, but T-22/T-23's document markup (`src/components/documents/invoice-document/blocks.tsx`) renders the invoice number inline in the same paragraph as its "Nomor invoice: " label, not as its own text node. | Same assertion, non-exact match. |
| public-invoice expired-token behavior | Asserted `404`. T-23 (`src/app/i/[token]/page.tsx`) deliberately gives an expired share link its own honest `200` state ("Tautan ini sudah tidak berlaku.") instead of `notFound()` — "the one case that can only ever be observed by someone who already holds a real, previously valid link." | Asserts `200` + the current honest-expiry message. The "invalid" token check is untouched — confirmed still a genuine, non-streamed `404` (this route has no `loading.tsx`). |
| "PDF/HTML parity" | The HTML-field extraction (`main.querySelectorAll("header p")`, `"dl > div"`) assumed a DOM shape T-22/T-23 replaced with plain `<p>`/`<h2>` blocks — every field always extracted as `""`. | **Narrowed, not fixed as-is**: the full field-by-field parity check is already covered, more thoroughly and against the *current* markup, by `t27.verification.spec.ts` (same `publicTokens.active` token; extracts issuer/client/description/amount/total/tax/terms/dueDate/bank/footer — more fields than this test ever did). Rebuilding that extraction here would be a second, drifting copy of the same logic. Kept only the coverage that check does *not* have: the owner-authenticated PDF endpoint itself works, the public PDF endpoint is reachable by a genuinely unauthenticated request context, and both produce byte-for-byte-equivalent (post `pdftotext`) output for the same invoice. |

**What was retired vs. retargeted**: Only the composite-dashboard test was retired outright (with a comment, not `.skip()`) — its literal invariant no longer has a canonical-route equivalent, and re-asserting "the overdue invoice is visible with the right urgency" on `/` would have been a blind duplicate of `states/needs-chasing.spec.ts`'s "actionable" case. Every other test was retargeted to the current canonical route/behavior; none were deleted.

**Why the underlying invariants remain protected** — full coverage map:

- Overdue-invoice visibility + urgency → `states/needs-chasing.spec.ts` ("actionable").
- Populated Beranda / invoice-detail visual regression → `e2e/visual/visual.spec.ts`.
- Long-content / overdue invoice-detail geometry → `routes/matrix.spec.ts`.
- PDF/HTML field-by-field parity (current markup) → `t27.verification.spec.ts`.
- Cross-owner invoice authorization → this file's own retargeted isolation test (now content-verified, not status-code-verified) plus the existing Vitest unit test (`src/app/(app)/invoice/[id]/page.test.tsx`).
- Owner-authenticated PDF download + unauthenticated public PDF download + their equivalence → this file's narrowed PDF test (previously untested by anything else in the suite).
- Invoice-detail invalid-phone/no-tax and tax-bearing states, in both languages → this file's retargeted invoice-detail test (not covered by `routes/matrix.spec.ts`, which only captures the overdue+long-content state).

No product code was changed. Every fix here is a test-assertion correction against already-existing, already-shipped, already-documented (T-19/T-22/T-23) product behavior.

## 5. Serial-cascade remediation

`test.describe.serial(...)` was removed in favor of a plain `test.describe(...)`. Verified there was no real cross-test ordering dependency: every test logs in with its own session and only reads/navigates; the one place a test mutates shared per-user state (`setLanguage`'s PATCH) always resets it back to `"id"` before the test ends, independent of other tests.

Confirmed all 5 remaining tests in the file now execute and pass, across two independent runs after re-seeding fixtures fresh each time (checking for flakiness, not just a single lucky pass):

```
✓ captures zero-state owner and proves no cross-owner cards
✓ enforces second-owner invoice isolation in both directions
✓ captures no-tax/empty-date/invalid-phone and tax-bearing invoice detail
✓ records active, expired, and invalid public-token behavior
✓ downloads owner and public PDFs for the same invoice and confirms they match
5 passed (15.6s) / 5 passed (15.8s)
```

## 6. False-green verification

Two controlled infrastructure-failure simulations were run against the fixed `scripts/ux-audit.ts` / `scripts/ux-report.ts` (temporary changes only, nothing committed, all state restored afterward — the good `results.json`/`e2e/results.json` were backed up before each simulation and restored after):

1. **webServer fails to start** (`UX_PORT=1 npx playwright test -c playwright.config.ts detectors.selftest.spec.ts`): Playwright exited 1 and wrote a `results.json` with `suites: []` and a top-level `errors` entry ("Process from config.webServer was not able to start"). `npx tsx scripts/ux-report.ts` correctly reported `functionalStatus`/`responsiveLayoutStatus`/`stateDataStatus` all `FAIL`, emitted a `CRITICAL`/`infrastructure-failure` finding (`UX-INFRA-tests-ux-audit`), `overallStatus: FAIL`, and **exited 1**.
2. **`results.json` never produced at all** (pointed the same `runPlaywrightOrAbort` helper at a nonexistent Playwright config): the process exited 1 with no JSON output at all, and `scripts/ux-audit.ts`'s own guard (deletes the target `results.json` before each run, checks it exists after) correctly detected the missing file and **aborted immediately with exit 1** and a clear message, before ever reaching the report step.

After both simulations, the backed-up good `results.json`/`e2e/results.json` were restored and `npx tsx scripts/ux-report.ts` was re-run to confirm the report returned to its correct clean state (`overallStatus: PASS`, exit 0) — the repository was left exactly as the real, successful validation run left it.

## 7. Validation results

All run directly against the repository (disposable local Postgres, `127.0.0.1:55432/dibayar_test`), on the final committed state (`4bf2514`):

| command | result |
| --- | --- |
| `npm run typecheck` | clean, no output |
| `npm run lint` | clean — 0 errors, 0 warnings (summed across every file's own reported counts) |
| `npx vitest run` | **752/752 passed** (78 files) |
| `npm run test:e2e:critical` | **51 passed, 7 skipped** (pre-existing, unrelated skips), 0 failed |
| `npm run test:e2e:visual` | **8/8 passed** |
| `npm run ux:audit` | **61/61 tests/ux-audit passed** + **8/8 visual** — exits **0** |
| `npm run ux:report` | regenerates the same report from existing JSON without re-running anything; confirmed idempotent |
| `npm run build` | succeeds — Next.js 16.3.0, 21 routes |

The `ux:audit` full-suite run and its report were reproduced twice (once immediately after the fix, once again after committing, from a fresh fixture reseed each time) with identical results both times.

## 8. Final UX audit status

```
Functional status:          PASS
Responsive/Layout status:   PASS
State/Data status:          PASS
Visual Regression status:   PASS
Overall status:             PASS
```

`artifacts/ux-audit/UX-AUDIT-REPORT.md`: "No findings." `npm run ux:audit` exit code: `0`.

## 9. Remaining non-blocking follow-ups

Carried forward from the independent review, not implemented here (none were trivial; all require either product-code changes or a deliberate scope decision beyond this remediation):

- Production wiring for `detectHiddenRequiredControls` — no component in `src/` currently carries `data-ux-required`.
- Production wiring for `detectEmptyStateInconsistency` — no component currently carries `data-ux-item-count`/`data-ux-item`/`data-ux-empty-state`.
- Broader viewport coverage outside `/deal` — the generic route×state matrix (`routes/matrix.spec.ts`) only exercises `mobile375`/`desktop1440`; `tablet768`/`laptop1280`/`desktop1920` are only validated for the Deals board.
- The `fullPage: true` screenshot-capture mode's compositing artifact around fixed page chrome (e.g., the mobile bottom nav appearing to overlap content mid-page in a stitched screenshot) — pre-existing `capture.ts` behavior, not something this task's scope touched.
- No generalized vertical/z-index occlusion detector exists in the harness (only horizontal-overflow and touch-target detectors do geometry checks).

## 10. Merge recommendation

`test/ux-qa-harness` is ready to merge into `main` after normal code review.

Every gate is green for real, verified reasons: the false-green infrastructure-failure mechanism is fixed and re-proven with two independent controlled failure simulations; the previously-stale legacy suite is fully repaired (not suppressed) with each fix traced to the specific product change (T-19/T-22/T-23) that made the old assertion stale, and its serial-cascade risk is removed; and the full local validation suite — typecheck, lint, unit tests, both E2E tiers, the UX audit gate, and the production build — all pass cleanly on the final committed state, reproduced more than once.
