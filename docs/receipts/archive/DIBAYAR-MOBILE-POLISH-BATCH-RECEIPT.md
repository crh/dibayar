# Dibayar — Mobile Polish Batch — FAB Overlap + Stage-Filter Clipping — Receipt

## 1. Starting `main` SHA

- Confirmed PR #5 ("Deal-invoice continuity: surface next actions and overdue status") merged first: `gh pr view 5` showed `state: MERGED` at `3c5fbfdecd7a35d13619d5abb876556b47b00cf0` before this branch was created.
- Starting `main` SHA (post-PR-#5, local fast-forwarded to match `origin/main` exactly, working tree clean of source changes): `3c5fbfdecd7a35d13619d5abb876556b47b00cf0`.

## 2. Branch / PR

- Branch: `ux/mobile-polish-fab-stage-filter`
- PR: [#6](https://github.com/crh/dibayar/pull/6) — "Mobile polish: prevent FAB overlap and stage-filter clipping" — **open, not merged**, `mergeable: MERGEABLE`.
- Final HEAD: `7347348` (4 commits ahead of `main`).

## 3. Files changed (4 commits)

| Commit | Files |
|---|---|
| `9489a84` fix: prevent the FAB from covering Beranda's last nearest-deal card | `src/app/(app)/beranda-client.tsx`, `src/app/globals.css` |
| `e148d66` fix: make the stage-filter scroll-hint a perceptible affordance | `src/components/deals/stage-filter.tsx` |
| `7ca96d6` test: add regression coverage for the mobile-polish fixes | `tests/ux-audit/routes/mobile-fixed-chrome.spec.ts` |
| `7347348` test: regenerate the beranda-mobile visual baseline for the FAB fix | `e2e/visual/visual.spec.ts-snapshots/beranda-mobile-chromium-linux.png` |

No data-model, API-shape, or unrelated changes.

## 4. Root cause

### A. Beranda FAB overlap

The previous batch's fix (`d4f54c3`, "Fix mobile FAB clearance") reserved FAB clearance via `padding-bottom` on the shared `AppShell` content wrapper. That padding is only ever *revealed by scrolling past it* — it extends the scrollable document, so a user who scrolls all the way to the true bottom of a long page sees clearance below the last item.

It never helped a short, close-to-viewport-height page like Beranda's: at cold load (`scrollTop: 0`, the state a real user sees first, before touching the screen), the last "3 deal terdekat" card renders wherever normal document flow puts it. Live DOM measurement confirmed this: with the seeded `owner` fixture at 390×844, the third card's box was `y: 709.5–790`, while the FAB's fixed box was `y: 716–772` — a real, reachable-at-rest overlap, regardless of how much trailing padding existed further down the document (`scrollHeight` was 942px, i.e. 98px of scrollable room existed below the fold — but nothing about that room affects where content the *first* screen renders).

**Owning component**: Beranda's own `<main>` (`src/app/(app)/beranda-client.tsx`), not `AppShell` — the defect is specific to this one page's content length relative to viewport height, not a shared-chrome concern.

### B. Stage-filter clipping

The row itself was already fully reachable by horizontal scroll (fixed by the previous batch — confirmed by the *existing*, unmodified `mobile-fixed-chrome.spec.ts` reachability test, which already passed before this batch touched anything). What `OBSERVATIONS.md` actually found was that the edge-fade *affordance* was imperceptible: it faded to `--bg` (`oklch(97.5% 0.013 75)`) while sitting over a chip whose own background is `--surface` (`oklch(99% 0.004 75)`) — only 1.5% apart in oklch lightness. Confirmed visually: a zoomed screenshot of the fade at rest shows no discernible shading at all (see evidence below), so the row's intentional "partial next chip" cue reads as a rendering glitch instead.

**Owning component**: `src/components/deals/stage-filter.tsx`'s own scroll-hint elements — a color/contrast fix, not a reachability fix (reachability was already correct).

## 5. Fix

1. **`beranda-client.tsx`**: bounds Beranda's `<main>` to `max-h-[calc(100dvh-var(--mobile-topbar-height)-var(--mobile-fixed-chrome-clearance)-env(safe-area-inset-bottom))]` with `overflow-y: auto`, mobile only (`min-[640px]:max-h-none min-[640px]:overflow-visible` restores the original unbounded behavior at ≥640px). This directly excludes the FAB's reserved band from the page's *visible* rendering area regardless of content length or scroll position — content that would have landed there is clipped out of the initial view and reachable by scrolling within `<main>` instead, matching the same "partial next item" pattern the stage-filter row already uses. Scoped to Beranda only (not the shared `AppShell`), keeping this batch's blast radius to the one page with the reported defect.
2. **`globals.css`**: adds `--mobile-topbar-height: 56px` (TopBar's mobile `h-14`), reused by the calc above — avoids a bare magic number, consistent with the existing `--mobile-fixed-chrome-clearance` token pattern.
3. **`stage-filter.tsx`**: the fade gradient now uses `ink/25` (a real dark tint, contrast-independent of the exact underlying background) instead of `bg`→transparent, plus a small `‹`/`›` chevron glyph inside each hint.

An early implementation attempt reserved the clearance as trailing `padding-bottom` *inside* the newly-bounded `<main>` (i.e. repeating the exact same "only helps once scrolled" mistake one level deeper). Caught via live computed-style inspection before commit (`clientHeight` matched the *unreduced* viewport, not the FAB-excluding one) — the final version subtracts the clearance directly from `max-height` instead.

## 6. Before / after evidence

`artifacts/mobile-polish/screenshots/` (local, gitignored, not part of the PR diff):

- `01/02-BEFORE-beranda-fab-overlap-{390,320}.png`: captured by temporarily stashing the fix and rebuilding against the same seeded `owner` fixture — the FAB visibly covers the last card's amount and stage badge at both widths.
- `03/04-AFTER-beranda-fab-clear-{390,320}.png`: same fixture, FAB now floats in clear space; the next (now off-screen) card peeks partially at the bottom edge, signaling "scroll for more."
- `05-BEFORE-stage-filter-fade-invisible-zoom.png`: 4x-scaled crop of the original fade — no discernible shading at all.
- `07-AFTER-stage-filter-chevron-zoom.png`: same crop after the fix — a clearly visible chevron and tinted shadow.

## 7. Automated tests added/changed

`tests/ux-audit/routes/mobile-fixed-chrome.spec.ts`:

- **Replaced** the old Beranda test ("...not covered by the FAB at scroll rest"), which called `scrollToBottom()` (a `window.scrollTo` to the *document's* bottom). That became a no-op once `<main>` absorbed the overflow instead of the document, and — independent of this batch — it was always a latent false negative for the exact defect being fixed: `boundingBox()` doesn't know an element is hidden by an ancestor's `overflow`, so it kept reporting "overlap" as geometrically true even after a fix made it visually impossible.
- **Added**: a direct geometry invariant (`<main>`'s rendered bottom edge vs. the FAB's top edge) asserted at cold load (no scroll) at **both 390px and 320px** — this is the deterministic proof of the actual fix.
- **Added**: a reachability test that scrolls the content area itself (`scrollIntoViewIfNeeded`, which now targets `<main>` as the nearest scrolling ancestor) and confirms the last card is still reachable and uncovered once scrolled to — preserving the original test's intent for anyone relying on it.
- **Added**: a stage-filter test asserting the scroll-hint is not just structurally present (`data-visible="true"`, already covered by the existing reachability test) but actually perceptible — a rendered chevron glyph and a tinted (not background-matched) gradient stop — guarding against a future revert to the invisible fade.
- The pre-existing invoice-detail and pengaturan tests in this file are untouched (those pages' scroll model wasn't changed).

## 8. Local validation results

| Gate | Result |
|---|---|
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run typecheck` | ✅ |
| `npm test` | ✅ 763/763 (79 files) |
| `npm run build` | ✅ |
| `npm run test:e2e:critical` | ✅ 51 passed / 7 skipped by design / 0 failed |
| `npm run ux:audit` | functional / responsive-layout / state-data: ✅ PASS. Visual: 3 local failures — see below. |

**Local `@visual` failures, all expected/pre-existing (not blockers — see §9 for CI confirmation)**:
- `Beranda mobile` — expected, intentional (this fix's whole point; see §9).
- `Beranda desktop`, `Invoice detail` — small-ratio (0.01, ~20–30 pixels) sub-pixel diffs, the same local-dev-machine font-rendering noise pattern already documented in `docs/testing/UX_AUDIT.md` and PR #5's own receipt. Neither page's desktop CSS was touched by this batch (`git diff --stat` confirms only Beranda's mobile-scoped classes and `stage-filter.tsx` changed).

## 9. GitHub Actions / real-CI results

Per `docs/testing/UX_AUDIT.md`, real CI is authoritative for the visual gate — not the local run above.

**First push** (`7ca96d6`, before baseline regeneration), run [34926493834](https://github.com/crh/dibayar/actions/runs/34926493834):

| Job | Result |
|---|---|
| `lint-typecheck-test` | ✅ success |
| `e2e-critical` | ✅ success |
| `ux-audit` | ❌ failure — **exactly one** check failed: `Beranda mobile @visual`. `Beranda desktop` and `Invoice detail` **passed** on CI, confirming those two local failures were environment noise, unrelated to this batch. |

Regenerated the `beranda-mobile` baseline via the `update-visual-baselines` GitHub Actions workflow (`gh workflow run update-visual-baselines.yml --ref ux/mobile-polish-fab-stage-filter`), run [34926935836](https://github.com/crh/dibayar/actions/runs/34926935836) — the real-CI-runner procedure, not a local regeneration. Diffed all 8 downloaded baselines against the committed ones before touching anything: **only `beranda-mobile` differs; the other 7 are byte-identical**, confirming zero unintended visual impact from this batch. Inspected the new image before applying (§6/§10) — correct content, no regression, only the height change this fix intends.

**Final push** (`7347348`, with the regenerated baseline), run [34927124255](https://github.com/crh/dibayar/actions/runs/34927124255):

| Job | Result |
|---|---|
| `lint-typecheck-test` | ✅ success |
| `e2e-critical` | ✅ success |
| `ux-audit` | ✅ success |

All three required jobs green on the real CI runner at the final commit.

## 10. Visual-baseline change and justification

`e2e/visual/visual.spec.ts-snapshots/beranda-mobile-chromium-linux.png` — **expected, intentional diff**, not a hidden regression:

The fix removes Beranda's previously-unnecessary document-level scroll overflow. Before: the page rendered 863px tall on the e2e fixture (short "Perlu dikejar" empty state + 3 deal cards) — 19px taller than the 844px viewport, all of it unused trailing padding no one would ever scroll to meaningfully. After: it renders exactly 844px, matching true viewport height, since nothing overflows the document anymore (confirmed via `document.documentElement.scrollHeight === clientHeight` in a diagnostic script before committing). The new baseline image was visually inspected (§6, §8) — all three deal cards fully visible with this fixture's shorter data (no clipping needed here; clipping only engages when content is long enough to reach the FAB's band, as reproduced with the `owner` UX-fixture data in §6's before/after set), FAB floating clear.

## 11. Risks / unresolved questions

1. **Nested scroll region on Beranda only**: this batch deliberately scoped the bounded-scroll fix to Beranda's own `<main>` rather than the shared `AppShell`, to keep blast radius to the one page with the reported defect. Other pages with potentially similar short-content-near-viewport-height geometry (e.g. a very short Pengaturan or Invoice list) are **not** covered by this fix and remain on the original document-level-scroll behavior from the previous batch. Not reproduced or investigated for other pages — out of scope per this batch's explicit non-goals ("broad spacing cleanup," "unrelated refactors").
2. Carried forward, unchanged, from PR #5's receipt: no `chromium-mobile` `@visual` baseline set exists for `e2e/visual/visual.spec.ts` (neither CI gate exercises that combination); `e2e/visual/visual.spec.ts` doesn't call `reseedFixtures()`, a pre-existing fixture-order dependency only reachable via the unfiltered (non-gate) `npm run test:e2e`.
3. The `isSameOriginRequest`/`localhost` finding from PR #5's receipt (finding #10) remains unaddressed — explicitly out of scope for this batch (see "Explicit non-goals" in the task prompt).
4. A Vercel Preview deployment was triggered for this PR (visible via the `mergeStateStatus: UNSTABLE` / `vercel[bot]` check) — not independently inspected, consistent with prior receipts' scope boundary (Preview verification not in scope for this task).

None of these block this PR.

## 12. Recommendation

**MERGE.**

All required gates are green on the real CI runner, including the one genuine visual-baseline update (intentional, verified, and isolated to exactly the changed page — the other 7 baselines are byte-identical to what's on `main`). The change is CSS/layout-only plus a decorative color/glyph change — no data-model, API, or auth involvement — keeping rollback trivial (a plain revert of any or all three logical commits, no migration or cleanup needed). Per this task's guardrails, this session does not merge PR #6 itself — it is ready for human review and merge.

## 13. Next recommended UX batch (not started)

Two items surfaced but explicitly deferred by this batch's own non-goals:

1. Make **"Kirim lewat WhatsApp"** and **"Tandai sudah dikirim"** a single, explicit action (or make the connection between them explicit in copy) — a deliberate behavior change (not purely additive/display), flagged as its own focused pass in PR #5's receipt (finding #7) and repeated here since it's still unaddressed.
2. Decide whether the Beranda-only bounded-scroll pattern from this batch (§11.1) should be generalized to `AppShell` for all mobile pages, or left page-scoped as a precedent for future similar defects — a product/architecture call, not something to start without that decision.

Not started, per this task's instructions.
