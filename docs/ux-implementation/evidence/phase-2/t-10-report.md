# T-10 — Grouped owner invoice list

- **Task:** T-10 — Invoice list route
- **Phase:** Phase 2 — IA split
- **Repository:** `/home/kenji/code/dibayar`
- **Branch:** `hermes/ux-phase-2`
- **Commit:** `261ef05ef6255e976dea3e6f4d9e14f42c78abae`
- **Subject:** `T-10: extract grouped owner invoice list`
- **Parent:** `878d077aaacf82a57456f57e82f2523d7dd309cf` (pre-T-10 correction, see below)
- **Verification date:** 2026-08-09

## Result

**Accepted locally after independent verification.** The preserved partial T-10 implementation (recorded as blocked in the prior session, focused suite 36/37) was recovered rather than rewritten: the single remaining failure was diagnosed, fixed, and the recovery pass added one further correction found during independent review.

## Pre-T-10 correction: `878d077`

Before T-10 work resumed, a separate defect in `src/app/(app)/deal/deal-client.tsx` (T-09 scope) was corrected: the one-shot `?tambah=1` dialog-open URL cleanup was calling `router.replace(...)` directly in the render body instead of inside a `useEffect`. This is a lint-flagged render/side-effect violation, not new functional behavior — the fix moves the identical `router.replace` call into `useEffect(..., [initialDialogOpen, router, stageFilter])`. This commit is **not part of T-10's scope**; it is recorded here only because it sits directly on the commit chain between T-09 (`0bb2f57`) and T-10 (`261ef05`) as a prerequisite quality correction.

## Root cause of the prior typography-floor failure

The prior session's blocked focused run failed at `src/components/invoices/invoice-list.test.tsx:116`, the newly added typography-floor assertion (`expected 0 to be greater than 0`). Independent inspection found two compounding causes:

1. **Test defect:** the assertion selected sized text nodes with `container.querySelectorAll('[class*="text-["]')`. The unescaped `[` inside the attribute-value string breaks jsdom's `nwsapi` selector parser, so the selector matched zero elements regardless of markup — the assertion's `toBeGreaterThan(0)` failed before it ever checked a real size. The selector was corrected to escape the bracket: `'[class*="text-\\["]'`.
2. **Real product defect:** once the selector was fixed and could see actual nodes, `StatusChip` (`src/components/design-system.tsx`) was rendering its label at `text-[11px]`, one pixel under the project's 12px typography floor. `StatusChip` is shared across the deal board and invoice views, so this was a genuine, previously-undetected violation, not a T-10-only regression. It was corrected to `text-[12px]`.

## Independent-review correction: empty-group handling

During review, an unused translation key was found: `invoice.groupEmpty` (`src/lib/i18n.ts`, both `id`/`en`) exists but is not referenced anywhere in `invoice-list.tsx` or elsewhere in `src/`. This indicates an earlier assumption — rendering a per-group empty-state message for statuses with zero invoices — that does not match the accepted behavior. The governing task-map criterion ("all statuses, empty groups...") is satisfied instead by **omitting empty status groups from the DOM entirely**: `InvoiceList` filters `INVOICE_GROUPS` down to only groups with at least one invoice before rendering. Focused regression coverage for this was added/kept: `"omits empty status groups from the DOM entirely"` in `invoice-list.test.tsx`, which renders a single `PAID` invoice and asserts the `Terlambat`/`Terkirim`/`Draf` headings are absent while `Lunas` is present. The unused `invoice.groupEmpty` key was left in place (dead but harmless; not a security- or behavior-relevant string) rather than removed as an unrelated cleanup outside T-10's scope.

## Files in the T-10 commit

- `src/app/(app)/invoice/page.tsx` — authenticated route: redirects unauthenticated visitors to `/api/auth/signin?callbackUrl=%2Finvoice`, otherwise loads the owner-scoped, deal-brand-joined invoice list and renders `InvoiceList`.
- `src/app/(app)/invoice/page.test.tsx` — replaces the stale placeholder test with authenticated-render and unauthenticated-redirect coverage.
- `src/components/invoices/invoice-list.tsx` — new grouped list component: four fixed semantic groups (Overdue, Sent [folds in `DUE`], Draft, Paid) in that order, empty groups omitted, whole-list empty state when there are no invoices at all, each row linking to `/invoice/{id}`.
- `src/components/invoices/invoice-list.test.tsx` — new focused suite (grouping/ordering, DUE-folded-into-Sent, one-status-one-heading matrix, empty-group omission, whole-list empty state, row link target, typography/touch-target floor).
- `src/components/design-system.tsx` — `StatusChip` label size corrected from `text-[11px]` to `text-[12px]`.
- `src/lib/invoices.ts` — new `listInvoicesWithDealBrand(db, userId)` and `InvoiceWithDealBrand`/`InvoiceListDb` types; owner-scoped `findMany` projection joining the related deal's `brand`, ordered by `status`, then `dueDate`, then `createdAt` descending. Kept separate from the existing `listInvoices` so its callers/return shape are untouched.
- `src/lib/invoices.test.ts` — new coverage for `listInvoicesWithDealBrand`: owner-scoped inclusion with brand, and exclusion of a second owner's invoices.
- `src/lib/i18n.ts` — added `invoice.groupEmpty` (id/en); see the dead-key note above.

`DAILY_LOG.md` was not staged or modified by the T-10 commit.

## Independent verification

Hermes inspected the complete diff for both `878d077` and `261ef05` and confirmed the same-origin, owner-scoped projection, the corrected typography floor, and the empty-group omission behavior described above; no unrelated files were touched.

Commands and results:

```text
npx vitest run src/components/invoices/invoice-list.test.tsx
Test Files  1 passed (1)
Tests       10 passed (10)

npx vitest run src/components/invoices/invoice-list.test.tsx src/lib/invoices.test.ts "src/app/(app)/invoice/page.test.tsx"
Test Files  3 passed (3)
Tests       37 passed (37)

npx vitest run src/components/invoices src/lib/invoices.test.ts "src/app/(app)/invoice"
Test Files  5 passed (5)
Tests       55 passed (55)

npm run typecheck
PASS — tsc --noEmit

git diff --check
PASS

node_modules/.bin/eslint .
PASS (direct invocation)

node_modules/.bin/prisma validate
PASS — "The schema at prisma/schema.prisma is valid"
```

**Tooling note, not a product failure:** during the T-10 verification pass, the wrapped `npm run lint` invocation hit the known Hermes/RTK JSON EOF parsing error documented for earlier tasks (see the T-07 entry in `IMPLEMENTATION_LOG.md`). This is classified as a tooling/orchestration issue with the wrapper layer, not a lint or product defect — the direct `node_modules/.bin/eslint .` invocation above passed cleanly, which is the qualifying evidence.

- Isolated `invoice-list.test.tsx`: **10/10 PASS**.
- Exact focused T-10 files (`invoice-list.test.tsx`, `invoices.test.ts`, `invoice/page.test.tsx`): **37/37 PASS**.
- Broader invoice-area (`src/components/invoices/*`, `src/lib/invoices.test.ts`, `src/app/(app)/invoice/*`): **55/55 PASS**.
- `npm run typecheck`: **PASS**.
- `git diff --check`: **PASS**.
- Direct ESLint (after `878d077`): **PASS**.
- Direct `prisma validate`: **PASS**.

## Browser and phase-gate status

No browser acceptance was performed for T-10. As with T-08/T-09, browser acceptance is intentionally deferred to one comprehensive Phase 2 Chrome/DevTools pass after T-12. No deployment, migration, Preview/Production action, or public-access change occurred in this session. `DAILY_LOG.md` and other unrelated/local worktree state were preserved untouched. T-11, T-12, and Phase 3 have not started.
