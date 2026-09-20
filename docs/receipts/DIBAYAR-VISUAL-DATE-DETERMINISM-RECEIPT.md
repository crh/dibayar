# Dibayar — Receipt: Cleanup Finalization + Invoice Visual Date Determinism

Written 2026-09-08. Repo: `crh/dibayar`. Read
`DIBAYAR-UNCOMMITTED-CLEANUP-RECEIPT.md` first as evidence; everything
below was independently re-verified against the live repository rather
than assumed from it.

## 1. Cleanup finalization

**Cleanup branch:** `chore/cleanup-uncommitted-working-tree`.

**Discrepancy from the expected history:** the prior receipt's own commit
(`ca1d4d6`, "Add investigation receipt...") was the branch tip when this
session started, matching expectations. But a *second* receipt commit had
since been added on top (`b9ac984`, "Add final cleanup receipt..." —
`DIBAYAR-UNCOMMITTED-CLEANUP-RECEIPT.md` itself, produced at the end of
the prior session). Both commits were inspected (`git show --stat`) and
confirmed to contain nothing but a single Markdown receipt file each — no
product code. Both were treated as transient and removed together via
`git reset --soft 8ed8181` (the last substantive commit) followed by
unstaging and deleting the two receipt files, rather than the originally
anticipated single `HEAD~1`.

**Substantive commits retained** (verified via `git show --stat` on each
before merge):
- `b5994b5` — Fix add-deal actions opening dialog
- `7429aa2` — Ignore local developer tool state
- `8ed8181` — Track Next.js generated agent rules

**Re-validation on the cleanup branch** (before merge): `npm run
typecheck` clean, `npm run lint` clean (0/0), `npx vitest run` 749/749,
targeted add-deal `@critical` Playwright grep 10 passed / 2 correctly
skipped — matching the prior receipt's validated state exactly.

**Merge result into `main`:** `git switch main && git pull --ff-only`
reported already up to date with `origin/main` (local `main` was already
1 commit ahead of `origin/main` from before this session — pre-existing,
unrelated to this task). `git merge --no-ff
chore/cleanup-uncommitted-working-tree` succeeded cleanly (merge commit
`1eeb148`), bringing in exactly the three substantive commits above and
nothing else. Post-merge, `main`'s `git status --short` is clean and
re-running `npm run typecheck` / `npm run lint` / `npx vitest run`
reproduced clean/749-passing.

**Pushed:** No. Not explicitly authorized; local `main` remains ahead of
`origin/main`.

## 2. Visual-test investigation

**Confirmed root cause:** `scripts/e2e-fixtures.ts` computed the two
fixture invoices' `dueDate` (and the invoice share's `expiresAt`) as
`now +/- N days` at seed time (`future = now + 14d`, `past = now - 1d`).
`e2e/visual/visual.spec.ts`'s own header comment claimed "All fixture data
here is static ... no relative-time-sensitive fields" — that comment was
stale/wrong; verified by diffing the actual failure screenshots
(`test-results/.../*-diff.png`), which showed the *only* pixels differing
from the checked-in baseline were the rendered due-date/expiry text (and,
for Invoice detail, the resulting wrapped-line height, 921px vs 965px)
-- confirmed twice, both before and after the fix, by direct visual
inspection of the diff images, not just the pixel-count summary.

**Files involved:** `scripts/e2e-fixtures.ts` (source of the relative
dates), `e2e/visual/visual.spec.ts` (the two affected tests + the stale
comment), `e2e/visual/visual.spec.ts-snapshots/invoice-{list,detail}-desktop-chromium-linux.png`
(the two baselines regenerated).

**Other dynamic-date visual risks checked:**
- `src/components/home/follow-up-queue.tsx` (Beranda's "Needs chasing"
  widget) and `src/components/home/nearest-deals.tsx` also format
  `dueDate`/`deadline` as literal text — same latent pattern. Currently
  dormant for the visual suite: `follow-up-queue` only renders an invoice
  once it's within `DUE_SOON_WINDOW_DAYS` (7 days,
  `src/lib/invoice-date-status.ts`) of due, and the fixture invoice sat 14
  days out even before this fix, so the widget stays empty (confirmed by
  the passing Beranda baselines both before and after); `nearest-deals`
  needs a deal `deadline`, and none of the seven fixture deals have one
  set. Not touched, since nothing currently renders through them, but the
  same fixed-date pattern would apply if that ever changes.
- `dealStageTransition.createdAt` (= `now`) is not rendered on any page
  covered by `visual.spec.ts` (deal detail's stage history isn't in the
  visual suite) — no risk found.
- No other `@visual`-tagged test reads a `now`-relative fixture value.

## 3. Fix

**Implementation:** Extracted the two fixture dates into
`src/lib/e2e-fixture-dates.ts` (`FIXTURE_FUTURE_DATE =
2099-12-31T00:00:00.000Z`, `FIXTURE_PAST_DATE = 2020-01-01T00:00:00.000Z`)
as the single non-relative source, imported by `scripts/e2e-fixtures.ts`
and used for the SENT invoice's `dueDate`, the PAID invoice's `dueDate`,
and the invoice share's `expiresAt`. Session-token `expires` is
deliberately left as `now + 14 days` (renamed to `sessionExpiry` for
clarity) — it is never rendered into a screenshot, and must keep
outliving whatever real wall-clock day the suite runs on, which a fixed
date could eventually fail to do.

**Rationale for the specific dates chosen:** far enough out/back that
`daysUntilDue` (`src/lib/invoice-date-status.ts`) against either invoice
will never fall inside `DUE_SOON_WINDOW_DAYS`, so the invoices' derived
display status (`SENT`, never `OVERDUE`; `PAID` is terminal regardless of
due date) stays exactly what it already was — this is a strictly narrower
change than "make the date fixed"; it also guarantees the same
overdue/not-overdue classification forever, not just today. Verified with
a unit test (see below) rather than only by inspection.

**Also fixed:** the inaccurate "all fixture data is static" comment atop
`e2e/visual/visual.spec.ts`, replaced with an accurate explanation of
why these specific dates are fixed and where.

**Requirements check:**
1. Invoice visual screenshots stable across days — yes, dates are fixed constants, not `now`-derived.
2. Production code untouched — yes, only `scripts/e2e-fixtures.ts` (a dev/test fixture script), `src/lib/e2e-fixture-dates.ts` (new, fixture-only), and test files changed.
3. Assertions not weakened — no existing assertion was changed; the two regenerated baselines are pixel-accurate captures of the new (still-correct) rendered state.
4. Baselines not merely regenerated around nondeterminism — the nondeterminism was removed at its source (the fixture data) before any baseline was touched; the two regenerated baselines were inspected via diff images first to confirm only the intended date text changed, nothing else.
5. Refactoring stayed minimal — one new 20-line constants file, a 3-line import/usage change in the fixture script, no changes to `vitest.config.ts` (an earlier attempt to add a test path there was reverted once the test module was relocated to `src/lib`, which needed no config change).
6. Shared E2E fixture assumptions remain valid — confirmed by running the full `@critical` E2E suite (not just visual) after the fix: 51 passed, 7 correctly skipped, no regressions from the fixture-date change.

## 4. Regression protection

Added `src/lib/e2e-fixture-dates.test.ts` (Vitest), asserting:
- `formatDate(FIXTURE_FUTURE_DATE)` / `formatDate(FIXTURE_PAST_DATE)`
  equal fixed strings ("31 Des 2099" / "1 Jan 2020") — fails immediately,
  deterministically, and every run if either constant is ever changed
  back to a `now`-relative computation, rather than relying on the visual
  suite to *occasionally* flake depending on which day it happens to run.
- `daysUntilDue(FIXTURE_FUTURE_DATE, ...)` exceeds `DUE_SOON_WINDOW_DAYS`
  both against real "now" and against a date decades out — guards the
  invariant the visual (and Beranda follow-up-queue dormancy) depends on
  indefinitely, not just today.

Placed under `src/lib/` rather than alongside its sibling
`e2e/support/fixture-ids.ts`: an earlier attempt at
`e2e/support/fixture-dates.test.ts` was picked up by Playwright's default
`testMatch` (which also matches `*.test.ts` under its `e2e/` `testDir`),
crashing with a "Vitest cannot be imported... CommonJS" error when
`npm run test:e2e:visual` ran. Moving it to `src/lib` avoided both that
collision and any change to `vitest.config.ts` or Playwright's config.

## 5. Validation

| Check | Result |
|---|---|
| `npm run typecheck` | Clean (exit 0) |
| `npm run lint` | Clean, 0 errors / 0 warnings (exit 0) |
| `npx vitest run` | 752/752 passing (78 files; +3 tests / +1 file over the pre-fix 749/77 — the new `e2e-fixture-dates.test.ts`) |
| `npm run test:e2e:visual` | **8/8 passing** — the two previously-failing tests (Invoice list, Invoice detail) now pass, with baselines regenerated and inspected |
| `npm run test:e2e:critical` (extra check, both projects) | 51 passed, 7 correctly skipped, no regressions from the fixture-date change |

`npm run test:e2e:visual` passes fully without any snapshot update tied to
today's date — the two baselines it now carries encode `2099-12-31`/
`2020-01-01`, which will render identically regardless of which day the
suite runs on.

## 6. Git state

```
$ git status --short
(no output)

$ git log --oneline --decorate -8
f171156 (HEAD -> test/fix-invoice-visual-date-determinism) Make invoice visual fixtures deterministic
1eeb148 (main) Merge branch 'chore/cleanup-uncommitted-working-tree'
8ed8181 (chore/cleanup-uncommitted-working-tree) Track Next.js generated agent rules
7429aa2 Ignore local developer tool state
b5994b5 Fix add-deal actions opening dialog
3e99355 Fix desktop deals board scrollbar; clarify empty chase queue
11ad375 (origin/main, origin/hermes/v6-1-production-hardening, hermes/v6-1-production-hardening) Add next-steps receipt for an independent agent to pick up
05f1e87 Document the vercel.json regression caught during Preview verification
```

Final structure:
```
main
  └─ 1eeb148 merge, containing exactly the three substantive cleanup commits
     (b5994b5, 7429aa2, 8ed8181) -- no transient receipt commits

test/fix-invoice-visual-date-determinism  (branched from main, not merged)
  └─ f171156 the deterministic visual-fixture fix only
```

No push, deploy, migration, production-database change, or secret change
was performed. The `chore/cleanup-uncommitted-working-tree` branch was
left in place (now fully contained in `main`); it can be deleted at
Chris's discretion since it's fully merged.

## 7. Recommendation

```
READY_FOR_REVIEW
```
