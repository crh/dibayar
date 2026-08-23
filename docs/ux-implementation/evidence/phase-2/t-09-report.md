# T-09 — Deal route extraction and add-deal dialog

- **Task:** T-09 — Deal route extraction
- **Phase:** Phase 2 — IA split
- **Repository:** `/home/kenji/code/dibayar`
- **Branch:** `hermes/ux-phase-2`
- **Commit:** `0bb2f575ab7e6f718007c7e710ed5af713246aa1`
- **Subject:** `T-09: extract deal board and add-deal dialog`
- **Verification date:** 2026-08-09

## Result

**Accepted locally after independent verification.** The existing partial T-09 implementation was preserved. The stale `/deal` placeholder test was replaced with route coverage matching the production route's async `searchParams` signature. Focused `AddDealDialog` regression coverage was added without changing production behavior to satisfy an obsolete test.

T-10, T-11, and T-12 were not started.

## Files in the T-09 commit

- `src/app/(app)/deal/page.tsx`
- `src/app/(app)/deal/page.test.tsx`
- `src/app/(app)/deal/deal-client.tsx`
- `src/components/deals/add-deal-dialog.tsx`
- `src/components/deals/add-deal-dialog.test.tsx`
- `src/components/deals/deal-board.tsx`
- `src/components/deals/deal-card.tsx`
- `src/components/deals/deal-form.tsx`
- `src/components/deals/deal-stages.ts`
- `src/components/deals/stage-filter.tsx`
- `src/lib/i18n.ts` (T-09 additions only; earlier T-08 changes were already committed)

`DAILY_LOG.md` was not staged or modified by the T-09 commit.

## Test coverage added or replaced

### Route: `src/app/(app)/deal/page.test.tsx`

The obsolete placeholder contract was removed. The replacement tests cover:

- authenticated render of the deal board;
- invalid `tahap` fallback to the unfiltered All view;
- unauthenticated redirect to `/api/auth/signin?callbackUrl=%2Fdeal`;
- the actual route signature: `searchParams: Promise<Record<string, string | string[] | undefined>>`.

### Dialog: `src/components/deals/add-deal-dialog.test.tsx`

Focused tests cover:

- closed dialog absence;
- initial focus entering the first focusable control;
- Tab and Shift+Tab containment/wrapping;
- Escape dismissal and focus restoration to the trigger;
- backdrop dismissal;
- close-button dismissal.

## Independent verification

Hermes inspected the complete staged diff and confirmed that:

- the existing route/client/deal component implementation was preserved;
- no production workaround was introduced for the stale test;
- the stale placeholder test was reconciled;
- authentication, invalid-stage handling, and dialog keyboard/focus behavior are covered;
- no T-10/T-11/T-12 paths or behavior were introduced;
- `DAILY_LOG.md` remained unstaged and unrelated local state was preserved.

Commands and results:

```text
npx vitest run 'src/app/(app)/deal' 'src/components/deals'
PASS (11) FAIL (0)

npm run typecheck
PASS — tsc --noEmit

git diff --check
PASS

git diff --no-index --check /dev/null <each new T-09 file>
PASS
```

The focused test command covered 3 files and 11 tests. The T-09 commit was created only after the independent checks passed and after selective staged-diff review.

## Browser and phase-gate status

The T-09 browser acceptance is intentionally deferred to one comprehensive Phase 2 Chrome/DevTools pass after T-12, as required by the phase workflow. No browser data mutation, deployment, migration, Preview/Production action, public-access change, or Phase 3 work occurred.
