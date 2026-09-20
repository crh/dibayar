# Dibayar — Next Product UX Workstream — Batch Receipt

## 1. Starting state / branch

- Starting `main` SHA: `73326065e8848b4f806cadc92b28144a38c6460d` (verified clean, matching the prior stabilization workstream's merge commit; working tree clean; only pre-existing unrelated stashes present, none touched).
- Branch: `ux/creator-workflow-next-actions`
- PR: [#5](https://github.com/crh/dibayar/pull/5) — "Deal-invoice continuity: surface next actions and overdue status" — **open, not merged**, `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`.

## 2. User journeys reviewed

All six requested journeys were exercised against a real running build (`next build` + `next start`) with seeded fixture data (`scripts/ux-fixtures.ts` `ux-t00-*` and `scripts/e2e-fixtures.ts` `e2e-t0-*`), authenticated via real Auth.js session cookies — no mocked screens, no production data:

- **A — Daily overview** (Beranda: net income, "Perlu dikejar", "3 deal terdekat")
- **B — Deal lifecycle** (board, stage-transition menu, deal detail page)
- **C — Invoice lifecycle** (create, list, detail, status transitions)
- **D — Share / WhatsApp** (send-via-WhatsApp, share-link creation, invoice PDF)
- **E — Settings** (issuer identity, bank details, WhatsApp templates)
- **F — Navigation/recovery** (mobile nav, empty states, public-invoice error states)

Full journey-by-journey detail is in `artifacts/ux-review-next/JOURNEY-MATRIX.md` (this directory is local/gitignored per repo convention — same as the prior `claude-design-review-v2` pack — not part of the PR diff).

## 3. Evidence captured

`artifacts/ux-review-next/`:
- `README.md`, `JOURNEY-MATRIX.md`, `OBSERVATIONS.md`, `PRIORITIZATION.md`
- `screenshots/desktop/` (11 PNGs) and `screenshots/mobile/` (2 PNGs) — before-state captures plus after-state captures for the implemented batch (see §7).

## 4. Top findings (full detail in `OBSERVATIONS.md` / `PRIORITIZATION.md`)

1. **The action that creates an invoice existed in exactly one place** — a board card's overflow "⋮" menu — absent from the deal's own detail page entirely.
2. **A same-named, always-visible TopBar button didn't create an invoice at all** — it filtered the board, misleading anyone who found it first.
3. **No link back to a just-created invoice** — a generic "Invoice dibuat" toast, nothing else.
4. **Overdue deliverables got no "late" visual treatment anywhere** (Beranda, board, or the deal's own detail page), while overdue invoices already do.
5. **No stage-transition action on a deal's own detail page** — same board-menu-only pattern as #1.
6. Invoice-creation failures all surface identical, non-diagnostic error copy.
7. "Kirim lewat WhatsApp" doesn't mark an invoice sent; a separate click is needed and the connection is implicit.
8. Mobile: the floating "+" button overlaps the last card in Beranda's "3 deal terdekat" list; the mobile stage-filter chip row clips its last chip with no scroll affordance.
9. Long brand names truncate awkwardly in some places, wrap fully in others.
10. **(Found, not a UX issue, flagged separately)** A same-origin-check gap (`isSameOriginRequest` comparing against `request.url`, which resolves to `localhost` regardless of the actual `Host` header under a bare `next start`) causes every mutating API route to reject requests made via any hostname other than exactly `localhost` — reproduced with a plain `curl`, so it's a server-side comparison bug, not a browser quirk. Very likely unreachable on the real Vercel deployment (Vercel's runtime differs from bare `next start`, and this exact `localhost`-vs-`127.0.0.1` class of issue is already documented in `playwright.e2e.config.ts` for the sign-out flow) but **not independently verified against production**. Not touched in this batch.

## 5. Selected batch and rationale

**"Deal → Invoice continuity + status visibility"** — findings #1, #2, #3, #4, #5 above, all instances of the same underlying gap (next actions and status hidden from the surfaces creators actually use), all low-to-medium effort, low regression risk, and directly serving the product's stated core outcomes. This matches the task's own default-preferred batch ("next-action clarity and workflow continuity across Beranda → Deal → Invoice").

Findings #6, #7 are real but are small **behavior** changes (not purely additive/display), better suited to their own focused pass. Findings #8, #9 are legitimate low-effort mobile/visual-consistency items, recommended as the next batch (see §11).

## 6. Files changed (5 commits, 19 files)

| Commit | Files |
|---|---|
| `c94a6a0` fix: stop the TopBar invoice button from promising an action it doesn't perform | `e2e/deals/filter-navigation.spec.ts`, `src/components/layout/top-bar.test.tsx`, `src/lib/i18n.ts` |
| `1c19726` feat: show overdue deliverables on Beranda's nearest-deals list | `src/app/(app)/beranda-client.tsx`, `src/app/(app)/loading.tsx`, `src/components/home/nearest-deals.tsx`, `src/components/home/nearest-deals.test.tsx` |
| `d8e7cba` feat: surface the deal->invoice handoff on the deal detail page itself | `src/lib/invoices.ts` (new `findInvoiceByDealId`), `src/app/(app)/deal/[id]/page.tsx`, `deal-detail-client.tsx`, both test files, `src/lib/i18n.ts` |
| `9f1a8ea` test: regenerate visual baselines for the deal-invoice-continuity UI changes | 7 of 8 `e2e/visual/visual.spec.ts-snapshots/*.png` |
| `8d8ad95` fix: stack the new next-action button row at the 320px XS band | `deal-detail-client.tsx` |

No data-model or API-shape changes. No unrelated refactors.

## 7. Before / after evidence

All in `artifacts/ux-review-next/screenshots/` (local):

- `desktop/04-deal-detail-invoice-pending-no-action-desktop.png` (before) vs. `desktop/09-AFTER-deal-detail-invoice-pending-desktop.png` (after): the same "ready to invoice, none created yet" fixture deal now shows a "Aksi selanjutnya" section with stage buttons and a primary "Buat invoice" button, and the TopBar reads "Deal siap ditagih" instead of the misleading "Buat invoice".
- `desktop/10-AFTER-invoice-created-with-link-desktop.png`: after clicking "Buat invoice", a "Lihat invoice INV/2026/09/001 →" link appears directly in the action row alongside an "Invoice dibuat." success message — verified end to end (network request, DB-backed invoice creation, UI update).
- `desktop/02-deal-detail-overdue-deliverable-desktop.png` (before) vs. `desktop/12-AFTER-deal-detail-overdue-deliverable-desktop.png` (after): the same overdue Konten-stage deal's "Tenggat" now reads "13 Sep 2026 · Telat 2 hari" in red/bold instead of plain gray text, and now has "Kembali ke Deal"/"Lanjut ke Invoice" stage buttons that weren't there before.
- `desktop/01-beranda-normal-desktop.png` (before) vs. `desktop/11-AFTER-beranda-overdue-deliverable-desktop.png` (after): Beranda's "3 deal terdekat" now shows "Telat 2 hari" for the same overdue deliverable, matching the treatment "Perlu dikejar" invoices already had.
- `mobile/13-AFTER-deal-detail-overdue-mobile.png`: confirms the new section and overdue label render cleanly at 390px, buttons meeting the 44px touch-target convention.

## 8. Validation results

| Gate | Local | CI (PR #5, final commit `8d8ad95`) |
|---|---|---|
| `npm run lint` | ✅ | ✅ |
| `npm run typecheck` | ✅ | ✅ |
| `npm test` | ✅ 763/763 (7 new tests for this batch) | ✅ (part of `lint-typecheck-test`) |
| `npm run build` | ✅ | — (implicit in e2e/ux-audit builds) |
| `npm run test:e2e:critical` | ✅ 51 passed / 7 skipped by design / 0 failed | ✅ |
| `npm run ux:audit` | See note below | ✅ (`lint-typecheck-test`, `e2e-critical`, `ux-audit` all green) |

**One real regression was caught and fixed before this receipt was written**: the first CI run on this PR failed `ux-audit` — not from anything visual (all 8 `@visual` checks passed cleanly against the freshly-regenerated baselines), but from `tests/ux-audit`'s own T-27 detector suite: the new "Aksi selanjutnya" button row used `flex-wrap` instead of stacking to a single column at the 320px XS band, unlike this same file's existing action rows (contact-name save, WhatsApp-repair), which already follow a `flex-col` / `min-[360px]:flex-row` convention. Fixed in `8d8ad95` to match that existing pattern; reproduced locally and confirmed fixed before pushing; confirmed green on the next CI run.

Locally, `npm run ux:audit`'s `@visual` step shows 3/8 checks with the same environment-rendering noise documented in `docs/testing/UX_AUDIT.md` (baselines generated on the real CI runner render a handful of pixels differently than this dev machine) — inspected each diff directly and confirmed no content/layout difference, consistent with the prior stabilization workstream's own findings. Real CI is the authoritative check for the visual-regression gate, and it is green.

Visual baselines: 7 of 8 changed (the TopBar label renders on every page); `beranda-mobile` is byte-identical since that button is hidden below the 640px breakpoint. Regenerated via the `update-visual-baselines` GitHub Actions workflow (the real-CI-runner procedure from the prior stabilization work) — every diff inspected before regenerating and confirmed attributable only to the two intentional UI changes in this batch.

A Vercel Preview deployment was triggered for this PR (visible via the `vercel[bot]` PR comment) — not independently inspected further, since Preview verification wasn't in scope for this task's phases.

## 9. Risks / unresolved questions

1. **`isSameOriginRequest` environment gap** (finding #10 above) — potentially high-severity *if* reachable in production, but very likely a `next start`-specific artifact, unverified against the real deployment. Recommend a dedicated follow-up to confirm.
2. `chromium-mobile` has no committed `@visual` baselines (pre-existing, neither real CI gate exercises that combination — see prior stabilization receipt).
3. `e2e/visual/visual.spec.ts` doesn't call `reseedFixtures()` (pre-existing, only surfaces via the unfiltered `npm run test:e2e`, not a CI gate).
4. Mobile FAB overlap on Beranda's nearest-deals list, and mobile stage-filter chip clipping — both pre-existing, not touched in this batch (see §11).

None of these block this PR; all are either pre-existing (carried forward as documented backlog) or explicitly out of scope for a UX-focused batch.

## 10. Recommendation

**MERGE.**

All required gates are green on the real CI runner (including a real regression that was caught, fixed, and re-verified before this receipt). The change is purely additive (new UI section, new label, new display-only styling, one new read-only query) with no data-model or API changes, keeping rollback trivial (a plain revert, no migration or cleanup needed). Per the task's guardrails, this session does not merge PR #5 itself — it is ready for human review and merge.

## 11. Next recommended UX batch

**Mobile polish**: fix the FAB overlapping the last card in Beranda's "3 deal terdekat" (obscures real data — amount and stage badge) and add a scroll-affordance fix for the mobile stage-filter chip row that still clips its last chip. Both are low-effort, low-risk, already evidenced in `OBSERVATIONS.md`/`PRIORITIZATION.md`, and directly serve "mobile usability" — the product's primary usage surface.

A secondary candidate: make "Kirim lewat WhatsApp" and "Tandai sudah dikirim" a single, explicit action (or at least make the connection between them explicit in copy), closing finding #7 — a small, deliberate behavior change rather than a purely additive one, so it deserves its own focused review.

## 12. Claude Design hand-off

`DIBAYAR-UX-NEXT-CLAUDE-DESIGN-BRIEF.md` (repo root, delivered alongside this receipt) is ready to give to Claude Design manually, together with `artifacts/ux-review-next/` (screenshots + journey matrix + observations). No Claude Design feedback has been solicited or received as part of this session — nothing in this receipt should be read as Claude Design's endorsement of anything.
