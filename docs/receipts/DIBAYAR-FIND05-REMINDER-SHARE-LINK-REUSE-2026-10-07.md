# Receipt — FIND-05 reminder share-link reuse, 2026-10-07

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **PR #30 into `staging` is open and not merged.** Nothing was deployed or released. `main` and Production were not touched. No Production, hosted-staging or Neon database was read or written; no Vercel, Neon, OAuth or repository setting was changed; no `preview/*` or Neon branch was created; no visual baseline was updated. All database work used the disposable local `127.0.0.1:55432/dibayar_test`.

## 1. Start gate (verified live, 2026-10-07)

- PR #29 (`fix/whatsapp-popup-fallback-2026-10-05`) MERGED at 2026-10-07T04:29:41Z, merge commit `ac53043`, an ancestor of `origin/staging` (= `ac53043`).
- No open PRs and no branch for FIND-05 or share-token reuse. (`test/ux-fixture-overdue-share-fix` is an old local branch about a UX fixture, unrelated.)
- Read `CLAUDE.md`, `docs/DEVELOPMENT-WORKFLOW.md`, `REVIEW_CHECKLIST.md`, `STATE.md`, `docs/testing/E2E.md` and the journey docs first.
- Branch `fix/reminder-share-link-reuse-2026-10-07` from `origin/staging` `ac53043`, in the main checkout. Its three untracked items were left as found.

## 2. Root cause

`openReminder()` in `src/components/home/follow-up-queue.tsx` called `POST /api/invoices/:id/share`, which runs `createOrRegenerateShare()`: a new token on every call, upserted over the invoice's single `InvoiceShare` row. Each Beranda reminder therefore replaced the token, and the link the brand already had returned 404. Invoice detail did not show this because it reuses the link it loaded.

## 3. Contract for a "usable active share"

Decision (Chris, in the task brief): a reminder reuses a usable active link, creates one only when none is usable, and never extends an expiry; only explicit Regenerate rotates.

`ensureShare(db, invoiceId, userId)` in `src/lib/invoice-share.ts` implements it:

| Stored share | Result |
|---|---|
| Invoice not owned by the user | `not-found`; no share read or write |
| Unexpired and path recoverable | `reused`: same path, same `expiresAt`, nothing written |
| `expiresAt` null and path recoverable | `reused` (the public lookup also treats null as never expiring) |
| No row | `created`: new token, 90-day expiry |
| Expired (`expiresAt <= now`, the public lookup's rule) | `created`; the expired link is never sent |
| Unexpired but `tokenCiphertext` missing, corrupt, or written under an older `AUTH_SECRET` | `created`, because the link cannot be put in a message |

Exposed as `POST /api/invoices/:id/share/ensure`. `POST /api/invoices/:id/share` and `createOrRegenerateShare()` behave exactly as before, so **Buat ulang tautan** still rotates.

`getShareState()` is unchanged: it still reports an expired row as active with its past expiry. That is now stated in a comment and pinned by a unit test instead of being broadened silently. See FIND-07 in §11.

**Differs from the brief in one detail:** the brief expected the old expired URL to "remain expired" after a reminder replaces it. An invoice has one share row, so the replacement overwrites the old hash and the old URL then shows the generic not-found page (404), not the expired page. It stays unusable either way. Keeping the expired page would need more than one share row per invoice, which is a schema change and out of scope.

## 4. Changed files

| File | Why |
|---|---|
| `src/lib/invoice-share.ts` | `ensureShare()`; token issuing extracted to a private `issueShare()` shared with `createOrRegenerateShare()`; comment on `getShareState()`'s expiry contract |
| `src/app/api/invoices/[id]/share/ensure/route.ts` (new) | Owner-scoped, same-origin `POST` for `ensureShare()` |
| `src/components/home/follow-up-queue.tsx` | One line: the reminder calls `/share/ensure` |
| `src/lib/invoice-share.test.ts`, `ensure/route.test.ts` (new), `follow-up-queue.test.tsx` | Unit tests (§6) |
| `scripts/e2e-fixtures.ts`, `e2e/support/reseed.ts`, `e2e/support/manifest.ts` | Opt-in `follow-up-expired-share` fixture action and `applyFollowUpExpiredShare()` |
| `e2e/invoices/reminder-share-link.spec.ts` (new) | The five journeys in §6 |
| `e2e/home/follow-up-queue.spec.ts`, `e2e/whatsapp/popup-blocker.spec.ts` | Wait on the `/share/ensure` response instead of `/share` |
| `e2e/invoices/invoice-journeys.spec.ts` | The regenerate assertion printed the link on failure; now compared as a boolean |
| `SECURITY.md`, `docs/testing/*` | §8 and the new route's controls |

No schema, migration, dependency, config or CI change.

## 5. Before / after

| Journey | Before | After |
|---|---|---|
| Link exists, send a Beranda reminder | New token; old link 404 | Same link in the message; old link still opens |
| Send a second reminder | Token rotated again | Same link again |
| No link yet | Link created | Link created once, then reused |
| Link expired | New link (by rotation) | New link; the expired one is not sent |
| **Buat ulang tautan** on invoice detail | Rotates | Rotates (unchanged) |
| WhatsApp hand-off (FIND-04) | One tab, fallback only when blocked | Unchanged |

## 6. Tests

`e2e/invoices/reminder-share-link.spec.ts`, `@critical`, chromium and chromium-mobile. Every step uses the visible control; the recipient is a page in its own context with no session; links are compared as booleans; WhatsApp is answered by the local stub.

| Brief | Test | Proves |
|---|---|---|
| A | "reuses the invoice's active share link, which keeps working for the recipient" | Link made with **Buat tautan berbagi**, opens for the recipient; Beranda reminder carries the same link; the page sent only `POST /share/ensure`; link still opens; same link on detail after two reloads |
| B | "sending the reminder twice sends the same link both times" | Both messages carry the existing link; it opens after the second; detail still shows it |
| C | "with no share link yet, the first reminder creates one and the next reuses it" | Starts from "Belum ada tautan berbagi"; created link opens; second reminder reuses it; detail shows it after reload |
| D | "an expired share link is not sent: the reminder makes a new working link" | Old URL shows the expired page first; reminder carries a different link that opens; old URL is then not-found; next reminder reuses the new link |
| E | "Buat ulang tautan on invoice detail still replaces the link: the old one stops working, the new one opens" | Page sent `POST /share`; new link differs; old link 404 for the recipient; new link opens and survives reload; a later reminder carries the new link |
| F | Existing FIND-04 tests in `follow-up-queue.spec.ts`, `overdue-invoice.spec.ts`, `popup-blocker.spec.ts` | All pass (one tab, no spurious fallback, real-blocker fallback) |

Unit, 929/929 in total:

- `ensureShare` (11): every row of the §3 table, plus "expiring exactly now is expired", "one millisecond before expiry is reused without extending it", and "two calls never rotate".
- `createOrRegenerateShare`: rotates even when the existing share is usable.
- `getShareState`: expired row still reported active (pinned contract).
- `POST .../share/ensure` (7): 401, cross-origin 403, missing Origin 403, 404, reused, created, controlled 500.
- Queue component: two reminders call only `POST .../share/ensure`. Its fetch stub answers 404 to the rotating endpoint.

## 7. Negative controls

One mutation at a time, each followed by a rebuild and a chromium run, then reverted with `git checkout`.

| Mutation | Unit | E2E |
|---|---|---|
| Beranda calls the rotating `POST /share` | 4 queue tests fail | All 5 new tests fail. A and B at "the reminder carries the existing link"; C and D at "the next reminder reuses"; E at its final reminder step |
| `ensureShare` ignores expiry | 2 fail (expired; expiring exactly now) | Only D fails, at "the reminder must not carry the expired link" |
| `POST /share` reuses instead of rotating | 3 route tests fail | E fails at "the shown link changes"; the existing create/regenerate/revoke journey fails too; A–D pass |

After the last revert: no `NEGATIVE-CONTROL` marker in `src`, `e2e` or `scripts`; `git status` showed only the intended doc edits; the app was rebuilt before the gate run in §9.

## 8. Coverage inventory

- FIND-05 → fixed (PR open). FIND-04's status now names PR #29's merge.
- HOME-03: expected/persisted text rewritten for reuse; tests A–D added as `real`.
- SHARE-02: test E added as `real`; expected text now includes the recipient's view.
- New FIND-07 (open), attached to INV-WA-01.
- No action was added. Totals are unchanged: real 56/94 (59.6%), P0 28/30, outstanding P0/P1 13.
- `JOURNEY-COVERAGE.md` regenerated; `JOURNEY-GRAPHS.md` §3, `JOURNEY-BACKLOG.md`, `MANUAL-UAT.md` (MAN-WA-01 step 4) and `E2E.md` updated. Phone and WhatsApp-app hand-off stay manual.

## 9. Local validation (2026-10-07, on the tree pushed as PR #30)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 929 passed, 84 files |
| `npm run build` | exit 0 |
| `npm run e2e:build` | exit 0 |
| `npm run test:journey-coverage` | pass |
| `npm run coverage:journeys` | OK, 95 actions, 13 outstanding P0/P1 |
| `npm run test:diagnostics-selftest` | pass |
| New spec + Beranda + popup-blocker, chromium + chromium-mobile | 22 passed |
| `npm run test:e2e:critical` | 147 passed, 0 failed, 23 skipped |
| `npm run test:e2e` | 159 passed, 0 failed, 23 skipped |
| `npm run test:e2e:a11y` | 12 passed, 1 skipped |
| `npm run ux:audit` | specs 69/69; functional, responsive, state PASS; `@visual` 9/9 fail → overall FAIL locally |
| `coverage:journeys --results <full E2E> --results <ux-audit> --require-results` | 96 real claims passed, 0 not exercised |
| Firefox + WebKit: new spec, `follow-up-queue`, `invoice-journeys`, `overdue-invoice` | 36 passed (informational, not claimed) |

**`@visual` locally:** the nine diff pixel counts (17557, 15200, 13708, 10584, 13943, 9743, 27355, 39880, 12367) are identical to the clean-`staging` counts recorded on this host in the PR #29 and Phase 2A receipts. Clean `staging` was not re-run today; the comparison rests on those recorded numbers. This PR changes no rendered state in the base seed. No baseline was touched; CI's renderer decides.

## 10. CI and review

See the end of this file (§13), recorded after the run on the latest head.

## 11. Residual risks and open items

- **FIND-07 (new, medium, open):** invoice detail shows an expired share as "Tautan aktif sampai 1 Jan 2020." and **Kirim pengingat** there sends that expired link. Verified with a throwaway spec on the expired-share fixture (not committed). The recipient sees the expired page, so nothing is exposed, but the reminder is useless. Not fixed here, to keep this PR to the Beranda flow. The likely fix is for invoice detail's send to use `/share/ensure` too, plus a decision on how the share section presents an expired link.
- **Unrecoverable path differs by surface:** Beranda now replaces an unexpired share whose path cannot be recovered (allowed by the brief), while invoice detail disables its WhatsApp button and asks for an explicit regenerate. A brand holding such a legacy link would lose it on a Beranda reminder. That was also true before this fix. Covered at unit level only.
- **Concurrent first reminders:** two simultaneous `ensure` calls on an invoice with no usable share each issue a token and the later write wins. The row blocks a second tap while sending; two devices could still race. Not addressed.
- **Expired link after replacement** shows not-found, not expired (§3).
- **Real devices:** MAN-WA-01 (now with a link-reuse step) is still needed on phones.
- `STATE.md` `day_count` was left at 12; it has not been maintained since 2026-09-22 and I could not verify the right value.

## 12. Status

PR #30 (`fix/reminder-share-link-reuse-2026-10-07` → `staging`) is **open and not merged**, waiting for Chris's explicit merge authorization. `main` and Production are untouched.
