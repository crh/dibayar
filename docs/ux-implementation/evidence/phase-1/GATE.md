# Phase 1 Gate Evidence

**Date:** 2026-08-08
**Scope:** T-04 (AppShell) and T-05 (account menu) — shell and blocking-findings checkpoint

## Accepted scope and commit status

| Task | Implementation status | Task commit |
|---|---|---|
| T-04 — AppShell (top bar/side nav/bottom nav/route title) | Implemented, independently verified locally | none — uncommitted in the intentionally dirty worktree |
| T-05 — Account menu (responsive, focus-safe) | Implemented, independently verified locally | none — uncommitted in the intentionally dirty worktree |

No task commit exists for T-04 or T-05 as of this gate. This closeout records verified evidence and a Chris approval decision; it does not stage, commit, push, deploy, or migrate anything.

## Criterion ledger

| Criterion | Type | Result |
|---|---|---|
| Full `npm test` (57 test files / 556 tests) | Automated | Pass |
| Focused T-05 suite (29/29) | Automated | Pass |
| `npm run typecheck` | Automated | Pass |
| `npm run lint` | Automated | Pass |
| `npm run build` | Automated | Pass |
| `git diff --check` | Automated | Pass |
| Mobile bottom sheet | Manual | Pass — **Chris-reported manual browser checkpoint** |
| Desktop popover | Manual | Pass — **Chris-reported manual browser checkpoint** |
| 639px/640px breakpoint transition | Manual | Pass — **Chris-reported manual browser checkpoint** |
| Focus entry | Manual | Pass — **Chris-reported manual browser checkpoint** |
| Tab and Shift+Tab trapping | Manual | Pass — **Chris-reported manual browser checkpoint** |
| Escape dismissal | Manual | Pass — **Chris-reported manual browser checkpoint** |
| Focus restoration | Manual | Pass — **Chris-reported manual browser checkpoint** |
| Settings/navigation dismissal | Manual | Pass — **Chris-reported manual browser checkpoint** |
| No duplicate account trigger | Manual | Pass — **Chris-reported manual browser checkpoint** |
| Correct menu contents | Manual | Pass — **Chris-reported manual browser checkpoint** |
| No obvious console regression | Manual | Pass — **Chris-reported manual browser checkpoint** |
| Preview/Production/public-access/migration changes | Manual | None made |

## Automated evidence detail

- Full `npm test`: **57 test files / 556 tests** passed.
- Focused T-05 suite: **29/29** passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

This automated evidence was independently verified after the approved six-test reconciliation.

## Manual checkpoint

- Chris personally completed the manual T-05 browser checkpoint and reported verdict **PASS**.
- Tested and accepted: mobile bottom sheet; desktop popover; 639px/640px breakpoint transition; focus entry; Tab and Shift+Tab trapping; Escape dismissal; focus restoration; Settings/navigation dismissal; no duplicate account trigger; correct menu contents; no obvious console regression.
- **Provenance: Chris-reported manual browser checkpoint.** Hermes did not capture screenshots and did not independently perform this browser checkpoint. No artifact/screenshot path is recorded here because none was produced by this closeout — none is invented.

## Worktree state (exact)

- Timestamp: `2026-08-08T10:03:13+07:00`.
- Branch: `hermes/ux-phase-0`.
- HEAD: `7846f20b0932bee8b1c99f2df000f26e480e1be7`.
- Modified tracked paths: `DAILY_LOG.md`; `src/app/(app)/layout.test.tsx`; `src/app/(app)/layout.tsx`; `src/app/(app)/page.tsx`; `src/app/dashboard-client.test.tsx`; `src/app/dashboard-client.tsx`; `src/app/dashboard/invoices/[id]/invoice-detail-client.test.tsx`; `src/app/dashboard/invoices/[id]/invoice-detail-client.tsx`; `src/components/account-menu.test.tsx`; `src/components/account-menu.tsx`; `src/lib/i18n.test.ts`; `src/lib/i18n.ts`.
- Untracked paths: `.hermes/`; `src/app/(app)/page.test.tsx`; `src/components/layout/app-shell.test.tsx`; `src/components/layout/app-shell.tsx`; `src/components/layout/bottom-nav.test.tsx`; `src/components/layout/bottom-nav.tsx`; `src/components/layout/nav-items.ts`; `src/components/layout/route-title.test.tsx`; `src/components/layout/route-title.tsx`; `src/components/layout/side-nav.test.tsx`; `src/components/layout/side-nav.tsx`; `src/components/layout/top-bar.test.tsx`; `src/components/layout/top-bar.tsx`; `uat/`.
- All of the above paths were preserved untouched by this closeout. No stage/commit/push/deploy/migrate/reseed/reset/stash/clean action was taken.

## Deployment and environment boundary

- No Preview environment changes.
- No Production environment changes.
- No public-access changes.
- No database migrations, reseed, or reset executed as part of this gate.
- No credentials were accessed.
- No `package.json` change was made.

## Rollback and safety statement

No irreversible actions were taken. T-04 and T-05 remain uncommitted in the dirty implementation worktree and can be reviewed, amended, or discarded without any external system having been altered. No migrations were applied and no Preview/Production/public-access configuration changed.

## Repository instructions and status

`STATE.md`, `IMPLEMENTATION_PLAN.md`, and `IMPLEMENTATION_LOG.md` were updated as part of this closeout to reflect that the Phase 1 shell/blocking-findings checkpoint (T-04/T-05 scope) is gated as described here. `CLAUDE.md` already reflects Phase 0 T-00–T-03 accepted; it is not amended by this documentation-only closeout.

## Scope boundary: T-06 and T-07

At the time of this T-04/T-05 gate closure (`2026-08-08T10:03:13+07:00`), T-06 (ShareLinkField) and T-07 (retire inline action card, add FAB) were unchanged, neither marked complete, and both `pending` per `IMPLEMENTATION_PLAN.md`.

**Superseded:** T-06 and T-07 have since been separately accepted locally the same day, each implemented, independently verified, and left uncommitted. Neither reopened or altered this closed T-04/T-05 checkpoint. Provenance differs from the checkpoint above: the T-04/T-05 manual browser checkpoint was **Chris-reported**; the T-06 and T-07 browser evidence was **Hermes-captured** via authenticated local Chrome DevTools (MCP), with no screenshots captured in either case. See `docs/ux-implementation/evidence/phase-1/t-06-browser-acceptance.md`, `docs/ux-implementation/evidence/phase-1/t-07-browser-acceptance.md`, and the Final Phase 1 Addendum below.

## Recommendation

The Phase 1 shell/blocking-findings checkpoint (T-04/T-05 scope) is **approved and closed** per the criterion ledger above. At the time of this closure, T-06 was required to start only in a fresh Hermes session — since satisfied; T-06 and T-07 were subsequently accepted locally the same day. See the Final Phase 1 Addendum below for the final closeout status.

## Chris checkpoint acknowledgement

Chris completed the manual T-05 browser checkpoint personally and reported verdict PASS, approving and closing this checkpoint on 2026-08-08. This evidence record closes the Phase 1 shell/blocking-findings checkpoint for T-04/T-05 scope.

**Phase checkpoint approved and closed. Start a fresh Hermes session before beginning the next phase.**

---

## Final Phase 1 Addendum — 2026-08-08 (documentation-only closeout)

This addendum is appended to the original T-04/T-05 gate record above without altering it. The original criterion ledger, manual checkpoint record, worktree snapshot, and recommendation above remain unchanged as historical evidence of the T-04/T-05 checkpoint closed on `2026-08-08T10:03:13+07:00`.

### Final Phase 1 task status

| Task | Status | Browser-evidence provenance | Evidence |
|---|---|---|---|
| T-04 — AppShell | Approved/accepted locally, independently verified, uncommitted | **Chris-reported** manual browser checkpoint | This file (ledger above) |
| T-05 — Account menu | Approved/accepted locally, independently verified, uncommitted | **Chris-reported** manual browser checkpoint | This file (ledger above) |
| T-06 — ShareLinkField | Accepted locally, independently verified, uncommitted | **Hermes-captured**, authenticated local Chrome DevTools (MCP); no screenshot captured | `docs/ux-implementation/evidence/phase-1/t-06-browser-acceptance.md` |
| T-07 — Retire inline action card, add phone FAB | Accepted locally, independently verified, uncommitted | **Hermes-captured**, authenticated local Chrome DevTools (MCP); no screenshot captured | `docs/ux-implementation/evidence/phase-1/t-07-browser-acceptance.md` |

All four tasks (T-04, T-05, T-06, T-07) remain **uncommitted** in the intentionally dirty worktree on branch `hermes/ux-phase-0`, HEAD `7846f20b0932bee8b1c99f2df000f26e480e1be7`. No stage/commit/push/deploy/migrate/reseed/reset/stash/clean action has been taken for any of them.

### Phase 1 closure

T-07 is the final task of the current Phase 1 (shell and blocking findings) per `docs/ux-implementation/IMPLEMENTATION_PLAN.md` §5. With T-04, T-05, T-06, and T-07 all approved/accepted locally and independently verified, **Phase 1 is finally closed**.

### Next task

T-08 (Beranda focused money view) is the next pending task per `IMPLEMENTATION_PLAN.md` and remains `pending` — not started. **T-08 must begin only in a fresh Hermes session.**

### Side effects

None. This addendum is documentation-only and confined to this file: no commit, push, deploy, migration, reseed, reset, stash, clean, credential access, or source/test/`package.json` change occurred.
