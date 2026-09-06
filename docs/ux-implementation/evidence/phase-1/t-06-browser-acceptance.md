# T-06 — ShareLinkField browser acceptance (correction pass)

Documentation-only evidence record. This file supplements, and does not reopen or restate as newly-closed, the already-closed Phase 1 T-04/T-05 checkpoint (`docs/ux-implementation/evidence/phase-1/GATE.md`). Scope here is T-06 (ShareLinkField) only.

## Provenance

- Repository: `/home/kenji/code/dibayar`, branch `hermes/ux-phase-0`, HEAD `7846f20b0932bee8b1c99f2df000f26e480e1be7`.
- Worktree: intentionally dirty, preserved as-is. No stage/commit/push/deploy/migrate/reset/stash/clean action taken by this closeout.
- Browser evidence in this file is **Hermes-captured** (Chrome DevTools MCP, authenticated, local `http://localhost:3103`, invoice detail route, 390px emulation) unless explicitly marked otherwise. **No screenshot artifact was captured; no screenshot claim is made anywhere in this document.**
- A prior T-06 baseline (not reproduced verbatim here) was already independently verified separately at 320/390/768/1024/1440, Indonesian and English, continuous resize down to 320px, and clipboard success. This entry does not re-run or restate that full matrix; it **rechecks** the failure contract at 390px in both languages and **rechecks** the English success path, and records only what was directly observed in this pass. Facts below are marked baseline (prior, not reproduced here) vs. rechecked (this Hermes-captured pass).

## Criterion ledger

| Criterion | Method | Result |
|---|---|---|
| Constrain/truncate share link at multiple widths | baseline (prior pass, not reproduced here) | met — full baseline was verified in the preceding T-06 browser checkpoint/session context; not reproduced as a checked-in artifact in this evidence file |
| Clipboard success (English) | rechecked, Hermes-captured | met |
| Clipboard failure copy (Indonesian) | rechecked, Hermes-captured | met |
| Clipboard failure copy (English) | rechecked, Hermes-captured | met |
| Failure-path manual fallback usable (readOnly, select-all, in-field) | rechecked, Hermes-captured | met |
| No horizontal page overflow at 390px | rechecked, Hermes-captured | met |
| Field height stays 44px in both success and failure states | rechecked, Hermes-captured | met |
| No console errors after final reload | rechecked, Hermes-captured | met |
| Token secrecy / no invoice mutation during check | rechecked, Hermes-captured | met (same-origin language-preference PATCH only; see Side effects below) |

## Commands and results (final automated gates, this closeout)

```
npx vitest run src/components/invoices/share-link-field.test.tsx   # 16/16 passed
npx vitest run src/app/dashboard/invoices/[id]/invoice-detail-client.test.tsx  # 64/64 passed
npm test        # 58 files / 572 tests passed
node_modules/.bin/eslint .     # passed (direct ESLint invocation)
npm run typecheck  # passed
npm run build      # passed
node_modules/.bin/prisma validate  # passed
git diff --check     # passed
```

## Browser recheck detail (Hermes-captured, 390px emulation)

### Indonesian, failure path
- Alert text (exact): `Gagal menyalin. Tekan lama untuk salin manual.`
- Share-link field height: 44px.
- Title-bearing display span: `scrollWidth` ≤ `clientWidth` (no internal text overflow).
- Page: no horizontal overflow.
- Fallback: a native manual `<input>` carrying the full value is present, `readOnly`, select-all on focus, positioned inside the share-link track, vertically within the same field.

### English, failure path
- Alert text (exact, product string): `Couldn't copy. Long-press to copy manually.`
- Same geometry/overflow/selectability results as the Indonesian failure path above.

### English, success path
- Captured clipboard payload matched the full title URL exactly.
- Button label changed to `Copied`, then reverted to `Copy` after approximately 2 seconds.
- Field height remained 44px; page had no horizontal overflow.

### Console
- After the final reload, no console messages were present.

## Side effects and boundaries

- The only mutation performed during this browser recheck was a same-origin local language-preference `PATCH` used to switch the UI between Indonesian and English, and to restore Indonesian at the end of the session.
- No invoice, deal, or share-link mutation; no message send; no payment action; no share-link revoke or delete; no credential operation.
- No commit, push, deploy, migration, reseed, reset, stash, or clean action occurred as part of this evidence pass.

## Fresh-session handoff

- T-06 (ShareLinkField) is recorded as **locally accepted/verified** by this closeout: implementation present in the dirty worktree, automated gates green, and the browser failure/success contract rechecked at 390px in both languages as detailed above.
- **T-07 (retire inline action card, add phone FAB) remains explicitly pending and not started.** It must not be started as part of this closeout and must begin only in a fresh Hermes session.
- This closeout does not reopen, restate as newly-closed, or alter the scope of the already-closed Phase 1 T-04/T-05 checkpoint recorded in `docs/ux-implementation/evidence/phase-1/GATE.md`.
- No Preview or Production deployment, migration, or public-access change occurred or is implied by this record.
