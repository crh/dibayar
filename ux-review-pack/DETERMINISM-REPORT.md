# UX Review Pack V2 — Determinism Report (Phase 11)

## Result: **PASS_WITH_NOTES**

Two independent, full capture passes were run against a freshly reseeded fixture database each time, using the exact same suite (`npx playwright test -c playwright.review-pack.config.ts`, after `UX_FIXTURE_CONFIRM=non-production npx tsx scripts/ux-fixtures.ts seed`). This was done twice in this session:

1. **Before** the Workstream B–E fixes (baseline check, to confirm the pack was reproducible before touching anything): 25 test cases, 30 journey IDs, 61 screenshots.
2. **After** the Workstream B–E fixes (the pack's current, final state — this is the run that matters for "is this pack stable evidence now"): 29 test cases, 34 journey IDs, 67 screenshots. Reported in detail below.

Both passes independently showed the same determinism pattern: everything structural is identical between runs; a small, fully-explained set of screenshots differ in pixel content for reasons that are themselves deterministic mechanisms (not the *value* is reproducible, but the *reason for variance* is), and none of them reflect a functional or visual regression.

## What was compared (final, post-fix runs)

| Signal | Run 1 | Run 2 | Match? |
|---|---|---|---|
| Test cases run | 29 | 29 | Yes |
| Test execution order | identical | identical | Yes |
| Pass/fail per test | 29/29 pass | 29/29 pass | Yes |
| Journey IDs captured | 34 (same set) | 34 (same set) | Yes |
| Screenshot count | 67 | 67 | Yes |
| Screenshot filenames | identical set | identical set | Yes (byte-for-byte filename diff: none) |
| `manifest.json` structure/ordering | identical | identical | Yes |
| `manifest.json` field values (route, viewport, fixturePersona, dataState, userAction, expectedOutcome, expectedPrimaryCta, stateType, `passedFunctionalAssertions`) | identical | identical | Yes |
| `.capture-run-stats.json` (entry count, journey ID list, failed journeys) | identical | identical | Yes |
| `passedFunctionalAssertions: false` entries | none | none | Yes (0 in both runs) |

`manifest.json` differed in exactly **3 fields**, all `externalActionIntent` (the captured `wa.me` href), all for the reason below.

## Screenshot-level differences (pixel content, not structure)

Comparing checked-in Run 1 screenshots against Run 2 byte-for-byte, ~30–45% of screenshots differ at the pixel level (varies slightly run to run). Every diff traces to one of three known, deterministic-in-mechanism sources — confirmed by direct crop/pixel-diff inspection, not assumed:

1. **A live timestamp embedded in test data.** J08 ("create first deal") intentionally names its test deal `Review Pack Brand ${Date.now()}` to guarantee uniqueness across runs. That literal digit string then appears in every later screenshot of the deal board that happens to include that card (J08, J11a–e, J13, J23 board-view steps). Confirmed by cropping the differing region: only the digit string differs, nothing else in the frame.
2. **Non-deterministic ordering among same-instant fixture rows.** The "many-deals" density fixture inserts several `MASUK`-stage deals in one `createMany()` call, so they share an identical `createdAt` (and all have no `deadline`). The board's sort (`status asc, deadline asc, createdAt desc`) has no tiebreaker for rows that are equal on all three keys, so Postgres may return them in a different relative order across separate seed runs. This is a real (if narrow) source of visual non-determinism in the fixture/query, not a rendering bug — the deals shown are all real and correctly placed in their column, just not always in the same relative position within it. **Recommendation for a future pass:** add `id: "asc"` as a final tiebreaker to the board's `orderBy` in `src/lib/deals.ts`, or give the many-deals fixture rows distinct `createdAt` values a few milliseconds apart. Not implemented in this session — it's a product-code change outside this evidence-capture pass's scope, and it doesn't affect any journey's functional correctness (cards are located by brand text, never by position).
3. **Freshly generated random share tokens.** Creating a new invoice share (J20's auto-create-on-send, J22's repair-then-auto-send) always mints a new cryptographically random token (`generateShareToken()`), by design — so the `wa.me` link text shown on screen, and the corresponding `externalActionIntent` in `manifest.json`, legitimately differs every run. `invoices.overdue`'s share (J21) no longer falls in this category on its own (see Workstream B below — it's now seeded with a **fixed** token and stays stable run-to-run when nothing regenerates it), but in a full-suite run its share can still end up regenerated later in the run by the home dashboard's Follow-up Queue reminder (J42), which — unlike the invoice-detail page's own reminder button — does not wait for the existing share to finish loading before allowing the click, so it can occasionally take the "no active link yet, create one" branch instead of reusing the already-active one. This is a real, if minor, product behavior worth a look (see Recommendation below) but not a capture defect: either branch produces a working, correct WhatsApp message.

None of the three sources involve a missing element, a broken layout, a wrong status, or a stale/incorrect UI state. Per the task's own instruction not to require byte-for-byte equality as the sole determinism criterion, and given every structural/functional signal above matched exactly across both runs, this pack is classified **PASS_WITH_NOTES** rather than FAIL: it is reproducible in every way that matters for treating it as stable UX evidence, with the specific, understood sources of pixel variance documented here so a reviewer isn't confused by them.

**Recommendation (not implemented this session, low-risk, product code):** the home dashboard's Follow-up Queue reminder button (`src/app/(app)/page.tsx` / its client component) could wait for the target invoice's share state to resolve before enabling its reminder action, the same way the invoice-detail page's own reminder button does (`canShareViaWhatsApp` gates on `shareState.share.kind !== "loading"`) — this would make the "reuse an existing active share" path reliable from the dashboard too, not just from the invoice detail page.

## Workstream B: `invoices.overdue`'s share fixture

Fixed and independently verified — see the stabilization receipt for detail. Confirmed via a dedicated fixture-verification check (`overdueShareRecoverable` in `scripts/ux-fixtures.ts`'s `verify()`) that runs on every seed, and via direct DB inspection immediately after seeding: `getShareState()` returns `{ active: true, path: "/i/<the fixed publicTokens.active token>" }` with a real, decryptable `tokenCiphertext` — not the previous "active but stale" state that forced J21 to revoke-and-recreate before it could exercise the real send flow.
