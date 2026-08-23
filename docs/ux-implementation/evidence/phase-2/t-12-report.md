# T-12 — Remove legacy dashboard composite — evidence report

**Status: ACCEPTED, COMMITTED as `5696641fb1b4503ec3f44dad2430f79f3fbb332d` (`T-12: remove legacy dashboard composite`), parent `4beae097dcf645a11e90c9688d5b1b3031d071f6` (T-11).**

## Scope of the commit

Exactly two files, both deletions, 1,308 lines removed:

- `src/app/dashboard-client.tsx` (606 lines removed)
- `src/app/dashboard-client.test.tsx` (702 lines removed)

No other file changed in this commit — cleanup-only, matching the task-map packet ("cleanup only; no behavior/refactor beyond dead composite removal").

## Import-count grep

`grep -rn "dashboard-client" src/` after the commit returns exactly one hit, a comment in `src/app/(app)/beranda-client.test.tsx:78` asserting the *absence* of legacy dashboard-client landmarks:

```
// No leftover board/invoice-list/add-deal-form landmarks from the old dashboard-client.
```

`grep -rln "DashboardClient" src/` returns no hits. No remaining import, JSX usage, or route reference to the deleted composite exists anywhere in `src/`.

## Redirect preservation

The old `/dashboard` route remains an explicit 302 redirect to `/` (unchanged by this commit — no redirect-handler file appears in the diff). `/dashboard/invoices/[id]` remains the compatibility detail route (unchanged by this commit; it was already extended by T-11 to pass `hasIncompleteIssuer`).

## Verified automated evidence after T-12 (Hermes-independent, this closeout)

| Check | Result |
|---|---|
| `npm test` | 68 test files, 616 tests passed |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npx prisma validate` | PASS |
| `git diff --check` | PASS |
| Focused T-12 route/component suite | 24 passed, 0 failed |

## Verified browser evidence (Hermes-captured, Chrome DevTools MCP, authenticated local `http://localhost:3104`)

Routes checked: `/`, `/deal`, `/invoice`, `/pengaturan`, `/dashboard` (redirect), `/dashboard/invoices/cmsjsbrzs0006plb30h4581g7`.

- Root (`/`) has exactly three section regions and no legacy dashboard composite landmarks.
- `/dashboard` navigates to `/` (redirect preserved).
- No horizontal overflow at any of the five checked widths (320/390/768/1024/1440) on any of the primary page routes.
- Final console error/warn scan across the pass: no messages found.
- No screenshot artifact was captured; this is recorded honestly rather than claimed. Evidence is the recorded MCP snapshots/DOM geometry, not screenshots.

This browser pass also covered T-11 surfaces in the same session (see `docs/ux-implementation/evidence/phase-2/t-11-report.md` for the T-11-specific detail); only reversible local language-preference toggling occurred, no invoice/deal/share/payment/message/destructive mutation, deployment, public-access, or credential action occurred.

## No action beyond the allowlisted scope

No stage, push, deploy, migration apply, or public-access change occurred as part of this report. The T-12 commit itself was already present on `hermes/ux-phase-2` HEAD before this documentation closeout began.

## Next steps

T-08 through T-12 are all committed and accepted. Phase 2's remaining gate is the Preview/Production database fingerprint isolation check plus Chris's explicit acknowledgement before merge — see `docs/ux-implementation/evidence/phase-2/GATE.md`.
