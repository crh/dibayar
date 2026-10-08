# Receipt — FIND-07 expired share state and invoice-detail reminder, 2026-10-08

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **PR #31 into `staging` is open and not merged.** Nothing was deployed or released. `main` and Production were not touched. No Production, hosted-staging or Neon database was read or written; no Vercel, Neon, OAuth or repository setting was changed; no `preview/*` or Neon branch was created; no visual baseline was updated. All database work used the disposable local `127.0.0.1:55432/dibayar_test`.

## 1. Start gate (verified live, 2026-10-08)

- PR #30 (`fix/reminder-share-link-reuse-2026-10-07`) MERGED at 2026-10-07T08:30:56Z, merge commit `e498ad5`, an ancestor of `origin/staging` (= `e498ad5`).
- No open PRs; no branch for FIND-07 or expired-share handling.
- Read `CLAUDE.md`, `docs/DEVELOPMENT-WORKFLOW.md`, `REVIEW_CHECKLIST.md`, `STATE.md`, `SECURITY.md` and the testing docs; re-read the merged share code before changing it. It matched the brief.
- Branch `fix/expired-share-reminder-2026-10-08` from `origin/staging` `e498ad5`, in the main checkout.
- The local test database was down after a host restart; Chris started it. Its schema was gone, so the 12 migrations were re-applied with `prisma migrate deploy` to `localhost:55432/dibayar_test` only.

## 2. Root cause

Two things combined:

1. `getShareState()` reported any existing share row as `active: true`, with its path and past `expiresAt`. Expiry was checked only by the public lookup and, since PR #30, by `ensureShare()`.
2. Invoice detail's `sendWhatsApp()` reused the link the page had loaded whenever the state was active, and only otherwise called the rotating `POST /share`.

So an expired share rendered as "Tautan berbagi aktif. / Tautan aktif sampai 1 Jan 2020." and **Kirim pengingat** sent that dead link.

## 3. Owner-visible share-state contract

`getShareState(db, invoiceId, userId, now)` and `GET /api/invoices/:id/share`:

| Stored share | Library result | GET response | Invoice detail |
|---|---|---|---|
| Invoice not owned | `not-found` | 404 | — |
| No row | `status: "inactive"` | `{ active: false }` | "Belum ada tautan berbagi…", **Buat tautan berbagi** (unchanged) |
| Unexpired, path recoverable | `status: "active"`, path | `{ active: true, path, expiresAt }` | Active UI with the link (unchanged) |
| No expiry, path recoverable | `status: "active"`, path | same, `expiresAt: null` | Active, "tanpa batas waktu" (unchanged) |
| Unexpired, path unrecoverable | `status: "active"`, `path: null` | `{ active: true, path: null, expiresAt }` | Active without a link; WhatsApp button disabled with the existing "buat tautan baru" hint (unchanged) |
| **Expired** (`expiresAt <= now`) | `status: "expired"`, no path | `{ active: false, expired: true, expiresAt }` | **"Tautan berbagi sudah tidak berlaku."** + "Berakhir pada <date>. Penerima tidak bisa lagi membuka invoice lewat tautan ini." + **Buat tautan baru**. No link, regenerate or revoke |

- One rule, `isShareExpired()` (null never expires; expiring exactly now is expired), is used by the owner view, `ensureShare()` and the public lookup. The public lookup's behaviour is unchanged.
- An expired share's path is no longer sent to the browser, and the tab's remembered copy is cleared.
- Reading the state never writes: opening the page does not replace or extend anything.
- `active` in the GET response now always means "opens right now", consistent with the POST and DELETE responses.

**Sending from invoice detail** now calls `POST /share/ensure` (unchanged from PR #30): reuse a usable link, issue a new one only when there is none or it has expired. The server decides at click time, so a page that loaded before the expiry still never sends a dead link. `POST /share` is unchanged; **Buat ulang tautan** still rotates.

**Single-row consequence (as the brief anticipated):** replacing an expired link overwrites the invoice's one share row, so the old URL then shows generic not-found (404) instead of the expired page. No migration was added.

**Kept on purpose:** if the server cannot recover a legacy share's path but this tab still remembers the link, the send uses the remembered link and does not call the server, which could only replace it. Covered by a unit test.

## 4. Changed files

| File | Why |
|---|---|
| `src/lib/invoice-share.ts` | `isShareExpired()`; `getShareState()` returns `status` and takes `now`; `ensureShare()` and the public lookup use the same rule |
| `src/app/api/invoices/[id]/share/route.ts` | GET maps the three states; expired carries no path |
| `src/app/(app)/invoice/[id]/invoice-detail-client.tsx` | `expired` share state and UI; `ensureLink()` beside `createOrRegenerate()` (one shared request helper); send uses `ensureLink()` |
| `src/lib/i18n.ts` | `invoice.shareExpired`, `invoice.shareExpiredOn`, `invoice.createNew` (ID + EN) |
| `scripts/ux-fixtures.ts` | One read of `getShareState()` updated to `status` |
| `src/lib/invoice-share.test.ts`, `share/route.test.ts`, `invoice-detail-client.test.tsx` | Unit tests (§6) |
| `e2e/invoices/expired-share.spec.ts` (new) | The journeys in §6 |
| `e2e/support/share-links.ts` (new), `e2e/invoices/reminder-share-link.spec.ts` | Share-link helpers moved out of the FIND-05 spec so both specs use them; the FIND-05 assertions are unchanged |
| `e2e/whatsapp/popup-blocker.spec.ts` | A comment that said the click sends no share request |
| `SECURITY.md`, `docs/testing/*` | §8 |

No schema, migration, dependency, config, CI or fixture-topology change (the PR #30 expired-share fixture is reused).

**Mistake, corrected:** commit `46d0cea` also added the untracked local directory `src/generated/prisma.root-owned-bak-20260920160728/` (a generated Prisma client backup, no secrets) because I used `git add -A src`. Follow-up commit `876437f` untracks it; the PR's net diff is the 19 intended files plus the receipt/state docs. The blobs remain in this branch's history, so a **squash merge** keeps them out of `staging`. History was not rewritten.

## 5. Before / after

| Journey | Before | After |
|---|---|---|
| Open an invoice whose share expired | "Tautan berbagi aktif. Tautan aktif sampai 1 Jan 2020." with the dead link | "Tautan berbagi sudah tidak berlaku." with the end date and **Buat tautan baru** |
| **Kirim pengingat** on that invoice | Sends the expired link | Sends a new working link; the page then shows it as active |
| Send again | Same dead link | Same new link (no rotation) |
| **Kirim pengingat** with a usable link | Reuses it | Reuses it (now confirmed by the server) |
| **Buat ulang tautan** | Rotates | Rotates (unchanged) |
| Beranda reminder (FIND-05) | Reuse / create when needed | Unchanged |
| WhatsApp hand-off (FIND-04) | One tab; fallback only when blocked | Unchanged |

## 6. Tests

`e2e/invoices/expired-share.spec.ts`, `@critical`, chromium and chromium-mobile; visible controls; session-less recipient; links compared as booleans; WhatsApp answered by the local stub.

| Brief | Test | Proves |
|---|---|---|
| A | "an expired share link is shown as expired, not active, in Indonesian and in English" | From the Beranda row: expired text and date, no active text, no link, no regenerate/revoke; same after reload; then English through the real Settings control |
| B, C | "Kirim pengingat on invoice detail replaces an expired link with a working one, and the next reminder reuses it" | Recipient sees the expired page first; the reminder carries a different link that opens; only `POST /share/ensure` sent; shown as active, also after reload; old URL then not-found; second send carries the same link |
| — | "Buat tautan baru on an expired share creates a working link in one step" | `POST /share`; active state; link opens and survives reload |
| D | "Kirim pengingat on invoice detail sends the active link that already exists and does not rotate it" | Two sends carry the existing link; only `POST /share/ensure`; link still opens and is still shown |
| E | "after Buat ulang tautan, the old link is dead and invoice detail reminders send the new one without rotating it again" | `POST /share`; old link 404; new link opens; two reminders carry the new link |
| F | `e2e/invoices/reminder-share-link.spec.ts` (FIND-05) | 5/5 on both projects |
| G | FIND-04 tests in `follow-up-queue.spec.ts`, `overdue-invoice.spec.ts`, `invoice-journeys.spec.ts`, `popup-blocker.spec.ts` | All pass inside the critical and full runs |

Unit, 944/944 in total (was 929):

- `getShareState`: active recoverable; null expiry active; expired → expired with no path; expiring exactly now vs one millisecond later; expired and unrecoverable; unrecoverable active → null path; never writes; owner mismatch → not-found. These tests now pass a fixed `now`; before, they silently depended on today being before 2026-10-14.
- GET route: inactive; expired → `{ active: false, expired: true, expiresAt }` with no path.
- Invoice detail: expired UI in ID and EN; **Buat tautan baru** sends `POST /share` and shows the active link; failure keeps the expired state; a contradictory payload is a load error; send with an expired share uses `/share/ensure` and shows the new link; the server's link wins over the loaded one; failure closes the tab and sends nothing; remembered-link exception sends without any request.
- From PR #30, still passing: `ensureShare` reuse without extending expiry, replace when expired, explicit regenerate rotates.

## 7. Negative controls

One mutation at a time, rebuilt, run on chromium, reverted with `git checkout`.

| Mutation | Unit | E2E (`expired-share.spec.ts`) |
|---|---|---|
| 1. Owner state treats expired as active | 3 `getShareState` tests fail | A, B and "Buat tautan baru" fail at the expired-state check; D, E pass |
| 2. Reminder link source reuses an expired share | 2 `ensureShare` tests fail | Only B fails, at "the reminder must not carry the expired link" |
| 3. Invoice detail's send always regenerates | 5 detail tests fail | B fails at the request list; D at "carries the existing link"; E at "carries the regenerated link" |
| 4. Explicit Regenerate reuses | 3 route tests fail | E fails at "the shown link changes", as do the FIND-05 regenerate test and the create/regenerate/revoke journey |

Control 1's first mutation did not compile, so its browser run never executed; it was redone with a compiling mutation and the result above is from that run. After the last revert: no `NEGATIVE-CONTROL` marker in `src`, `e2e` or `scripts`; only doc edits in `git status`; rebuilt before the gate run.

## 8. Coverage inventory

- FIND-07 → fixed (PR open). FIND-05's status now names PR #30's merge.
- INV-STATUS-06 (overdue reminder on invoice detail): tests B/C and D added as `real`. The tests click **Kirim pengingat**; the non-overdue label **Kirim lewat WhatsApp** (INV-WA-01) runs the same handler but was not separately driven for these cases, so INV-WA-01 gained no test reference, only a note.
- SHARE-01: expired-state and **Buat tautan baru** tests added. SHARE-02: test E added.
- No action added. Totals unchanged: real 56/94 (59.6%), P0 28/30, outstanding P0/P1 13.
- `JOURNEY-COVERAGE.md` regenerated; `JOURNEY-GRAPHS.md` §3, `JOURNEY-BACKLOG.md`, `MANUAL-UAT.md`, `E2E.md`, `SECURITY.md` updated. An expired link cannot be produced by hand on staging (90-day lifetime), so that case is automation-only; phone and WhatsApp-app hand-off stay manual.

## 9. Local validation (2026-10-08)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 944 passed, 84 files |
| `npm run build` | exit 0 |
| `npm run e2e:build` | exit 0 |
| `npm run test:journey-coverage` | pass |
| `npm run coverage:journeys` | OK, 95 actions, 13 outstanding P0/P1 |
| `npm run test:diagnostics-selftest` | pass |
| New spec + FIND-05 spec, chromium + chromium-mobile | 20 passed |
| `npm run test:e2e:critical` | 157 passed, 0 failed, 23 skipped |
| `npm run test:e2e` | 169 passed, 0 failed, 23 skipped |
| `npm run test:e2e:a11y` | 12 passed, 1 skipped |
| `npm run ux:audit` | specs 69/69; functional, responsive, state PASS; `@visual` 9/9 fail → overall FAIL locally |
| `coverage:journeys --results <full E2E> --results <ux-audit> --require-results` | 96 real claims passed, 0 not exercised |
| Firefox + WebKit: `expired-share`, `reminder-share-link`, `follow-up-queue`, `invoice-journeys`, `overdue-invoice` | 46 passed (informational, not claimed) |

**`@visual` locally:** the nine diff pixel counts (17557, 15200, 13708, 10584, 13943, 9743, 27355, 39880, 12367) are the same as on PR #30, where CI's renderer passed all nine. Host font drift; no baseline touched. No visual baseline captures an expired share.

The gates ran on the tree before the untrack commit and the receipt/state commits; those change no source, test or config file.

## 10. CI and review

See §13, recorded after the run on the pushed head.

## 11. Residual risks and open items

- **Extra request per send:** every send from invoice detail now waits for one `POST /share/ensure` before WhatsApp opens. The blank tab is opened inside the click, so popup blocking is unaffected, but on a slow connection the "Membuka WhatsApp…" tab shows a little longer. If the request fails, the tab closes and the page shows "Tautan berbagi belum bisa dibuat. Coba lagi."
- **Expired state not checked at 390px by eye:** it is covered by the chromium-mobile journey (390×844) and uses the same layout as the no-share state, but I did not take a screenshot or run an a11y scan on that specific state.
- **Remembered legacy link:** the exception in §3 sends a link the server cannot verify beyond "the row is unexpired at page load".
- **Concurrent `ensure` calls** on an invoice with no usable share can still race (open since PR #30).
- **Old expired URL after replacement** shows not-found, not expired (§3).
- **Real devices:** MAN-WA-01 still needed on phones.
- Not in this PR: Chris added an untracked `compose.yml` to the working tree during this session; it was left alone and is not committed. `CLAUDE.md` still forbids agents from invoking Docker.
- `STATE.md` `day_count` left at 12, unverified, as in the PR #30 receipt.

## 12. Status

PR #31 (`fix/expired-share-reminder-2026-10-08` → `staging`) is **open and not merged**, waiting for Chris's explicit merge authorization. `main` and Production are untouched.

## 13. CI and review (recorded 2026-10-08)

- CI run `37720223508` on head `59793f4` (all code, tests and docs except this section): **success**. `lint-typecheck-test`, `e2e-critical`, `e2e-a11y` and `ux-audit` succeeded; `e2e-cross-browser` skipped by design. `ux-audit` includes `@visual`, so the nine local visual failures in §9 were host drift.
- Codex reviewed `d034f2c` and left one P2 comment: remove the committed Prisma backup tree. That is the mistake described in §4; it was already removed from the tree by `876437f`, which Codex had not yet seen. No reply was posted on the PR. No other comments; no human review yet.
- The commit that adds this section is docs-only and starts one more CI run; its result is not recorded here.
