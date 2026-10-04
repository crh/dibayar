# Dibayar — Due-date integrity + visible-field picker fix (FIND-03, FIND-02)

**Date:** 2026-10-04 (Asia/Jakarta) · **Worker:** Claude Code (Klaus)
**Branch:** `fix/due-date-input-integrity-2026-10-04` · **Base:** `origin/staging` @ `27d3ab11fdba53ff23404a39d77c1681761093a5`
**Fix commit:** `0bb7314d72d4f704ad2776054745e672dd3fdeb0` (later commits on this branch are docs-only)
**PR:** https://github.com/crh/dibayar/pull/26 (→ `staging`, open) · **CI:** run [`37166145132`](https://github.com/crh/dibayar/actions/runs/37166145132) on `227d8cb`: `lint-typecheck-test` ✅ · `e2e-critical` ✅ · `e2e-a11y` ✅ · `ux-audit` ✅ · `e2e-cross-browser` skipped (by design: schedule/dispatch only). No GitHub deployment and no Vercel commit status were created for the branch (checked via `gh api`). Neon was not inspected (out of authorization scope).
**Status:** PR into `staging`, **not merged**. Nothing deployed. No Production or hosted-staging database touched.

## 1. Recon (verified, not assumed)

- PR #25 (`chore/journey-coverage-2026-10-03` → `staging`, head `80173c8`) is **OPEN, not merged**. So this is a standalone fix branch from `origin/staging`. PR #25's spec was read only as a reference and is **not** included here.
- `origin/staging` = `27d3ab1` (PR #24 merge); `origin/main` = `308a339`. No remote branch for an existing due-date fix (`git ls-remote --heads`).
- The main checkout (`/home/kenji/code/dibayar`) holds someone else's untracked receipts. I left them untouched and worked in a new worktree, `/home/kenji/code/dibayar-due-date-fix`.
- Local DB target verified as `localhost:55432/dibayar_test` (host/db only; no credentials printed). The E2E fixture script refuses any other target.

## 2. Original reproduction (baseline `27d3ab1`, before any change)

PR #25's `due-date-entry.spec.ts` was run with its `test.fail()` lines stripped (temp copy, deleted afterwards), plus a PATCH-capturing probe:

| Defect | Baseline evidence |
|---|---|
| FIND-02 | Click (desktop) and tap (390px mobile) on the visible "Belum ditentukan" text: `:open` stayed `false` on both. |
| FIND-03 | From an empty field, keyboard typing sent `PATCH {"dueDate":"0002-01-15"}` → **200**, stored `0002-01-15T00:00:00.000Z`. Every reload then showed **"Gagal memuat."** (route error boundary). |
| New finding (same root cause) | Typing over an **existing** date (fixture 2099-12-31): the first month digit left the input incomplete (value `""`), which the field saved as `PATCH {"dueDate":null}` → 200. **The saved date was silently cleared.** |

## 3. Root causes

1. `DateField` committed on **every** `change`. A native date input emits a complete-looking value on each intermediate year digit (`0002-`, `0020-`, `0203-`, `2030-`) and `""` while incomplete.
2. `invoiceDueDateUpdateSchema` (and `invoiceCreateSchema`) used `z.coerce.date()`. That accepts year 0002, timestamps, and epoch numbers, and V8 normalizes some impossible days.
3. The read-path crash: `getCalendarDate` emitted an **unpadded year** (`"2-01-15"`), which the strict `formatDate` parser then rejected with a throw during render.
4. Formatter quirk found while testing: `Date.UTC()` maps years 0–99 to 1900–1999, so `formatDate("0002-01-15")` printed "15 Jan **1902**".
5. FIND-02: Chromium opens a date input's picker only from its (invisible, opacity-0) calendar-icon edge. A click on the text area only focuses a segment.

## 4. Decisions

- **Supported range: 2000-01-01 to 2099-12-31, inclusive** (`src/lib/due-date.ts`). There is no business rule beyond "a real, near-term day", so the range is far wider than any real invoice. It still rejects every intermediate value a native input emits while typing (years 0002–0203), stray 5-digit years, and anything below 1900. Every in-range value has a 4-digit year, so all formatters and the strict parser handle it. The E2E fixture date 2099-12-31 sits exactly on the upper bound, and both bounds are tested.
- **Strict wire format:** exactly `yyyy-mm-dd`, a real calendar day, no trimming, no timestamps, no numbers. Out-of-range or invalid input gets a 400 with the message *"Tanggal jatuh tempo tidak valid. Pilih tanggal antara 1 Jan 2000 dan 31 Des 2099."* `null` still clears. A missing `dueDate` key is not a clear.
- **Defense in depth:** `updateInvoiceDueDate` refuses out-of-range Dates before any read or write (`invalid-due-date` → 400). `createInvoice` no longer copies an out-of-range legacy `Deal.deadline` into a new invoice.
- **Commit model (DateField):**
  - Picker choices and the native clear commit immediately.
  - Keyboard segment edits (digits, ↑/↓, Backspace/Delete) only update a draft. They commit on **Enter** or **leaving the field**, and only when the date is complete and in range. Otherwise an inline hint appears and nothing is sent.
  - **Esc** drops the draft and restores the saved date.
  - A partly typed date (`validity.badInput`) is never sent as a clear. A fully emptied input is.
  - Commits are serialized: one request in flight, and only the newest pending intent goes next. The input stays **enabled** while saving (it used to be disabled mid-save, which dropped focus) and is marked `aria-busy`.
- **FIND-02:** `onClick` calls `input.showPicker()`. It is feature-detected and wrapped in try/catch, and runs synchronously inside the real click/tap gesture. Native behavior remains the fallback.
- **Legacy rows:** not repaired, not overwritten, not hidden.
  - The detail page renders normally. The field shows **"Tanggal tidak valid"** with a red border, `aria-invalid`, and an `aria-describedby` hint naming the range.
  - "Kosongkan" is offered, and a new date can be picked or typed.
  - The header line reads "Jatuh tempo: Tanggal tidak valid".
  - The WhatsApp message drops the date line instead of sending "15 Jan 2" to a brand.
  - English strings are included.
- **Deliberately unchanged:** invoice status derivation (`deriveInvoiceDisplayStatus`). A legacy year-0002 row still derives OVERDUE, consistently on the detail page, the list, and Beranda. FIND-01 semantics are untouched.

## 5. Changed files

| File | Change |
|---|---|
| `src/lib/due-date.ts` (new) | Shared contract: bounds, `checkDueDateInput`, `dueDateInputToStoredDate`, never-throwing `storedDueDateToInputValue` / `isSupportedStoredDueDate` |
| `src/lib/invoice-validation.ts` | Strict schema for create and update (no `z.coerce.date()`) |
| `src/lib/invoices.ts` | Adapter range guard (`invalid-due-date`); no inheritance of out-of-range deal deadline |
| `src/app/api/invoices/[id]/route.ts` | 400 with range message for schema or adapter rejection |
| `src/components/date-field.tsx` | Draft/persisted split, intentional-completion commit, Esc, serialized queue, `showPicker()`, invalid-stored + invalid-input states, `min`/`max` |
| `src/app/(app)/invoice/[id]/invoice-detail-client.tsx` | Read-path guard, header/WhatsApp handling, new props |
| `src/lib/format/date.ts` | Zero-padded year in `getCalendarDate`; `setUTCFullYear` instead of `Date.UTC`; `isValidDateOnlyString` |
| `src/lib/i18n.ts` | 3 new keys (id + en) |
| `scripts/e2e-fixtures.ts`, `e2e/support/reseed.ts` | Guarded `legacy-due-date` action and helper (disposable DB only; next `seed` restores) |
| `e2e/invoices/due-date-integrity.spec.ts` (new) | Real-interaction regressions (below) |
| Unit tests | `date-field`, `due-date` (new), `invoice-validation`, `invoices`, `[id]/route`, `format/date`, `invoice-detail-client` |
| `docs/testing/E2E.md` | One table row for the new fixture action |

## 6. Before → after user journeys

| Journey | Before | After |
|---|---|---|
| Click/tap visible empty or filled field | nothing visible happens | native picker opens (`:open` true) on desktop and 390px mobile Chromium |
| Desktop: type `01152030` | PATCH `0002-01-15` → 200 → page dead on every load | **0** PATCHes while typing (asserted after every key, including the observed `0002-01-15` intermediate); Enter → exactly one PATCH `2030-01-15`; leaving afterwards sends nothing more; reload shows 15 Jan 2030; clear → reload empty |
| Desktop: type year `0002`, leave | saved | hint *"Tanggal belum lengkap atau di luar rentang…"*, `aria-invalid`, **no PATCH**, reload unchanged |
| Desktop: start typing over a saved date, Esc | saved date silently cleared | no PATCH; Esc restores 31 Des 2099; reload unchanged |
| Owner opens invoice with legacy year-0002 row | "Gagal memuat." on every load | page renders; "Tanggal tidak valid" + hint; clear or retype works and persists |
| Beranda / invoice list / public `/i/…` with legacy row | rendered (did not crash before either) | still render (regression check, not a fix proof) |

## 7. Validation (all on the committed fix tree unless noted)

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Unit | `npm test` | **882/882** pass, 82 files |
| Build | `npm run build` (Turbopack) | exit 0 |
| Critical E2E | `npm run e2e:build` + `playwright … --project=chromium --project=chromium-mobile --grep @critical` (port 3300) | **96 passed, 0 failed, 16 skipped**. The skips are 11 by-design skips already in the suite plus 5 of this spec's desktop-only / run-once tests on the mobile project. |
| Due-date spec | `e2e/invoices/due-date-integrity.spec.ts`, chromium + chromium-mobile | 13 passed, 5 skipped (by design) |
| Cross-browser | due-date spec + `invoice-journeys.spec.ts`, `--project=firefox --project=webkit` | **22 passed, 0 failed, 10 skipped**. Firefox and WebKit (Playwright builds) also reported `:open` true after the click. |
| a11y | `--grep @a11y`, chromium | 12 passed, 1 skipped |
| Visual | `--grep @visual` | 9/9 differ from the **CI-rendered** baselines by 2–5%. **Staging `27d3ab1` fails identically on this machine** (font rendering). Same-machine comparison, fix vs staging: invoice detail **pixel-identical**, 7 others identical, Deals-filtered differs in a 6×3 px antialiasing patch on a page this PR doesn't touch. No baseline changed. |

Notes on the runs:
- **First critical run note:** on port 3317 two `invoice-journeys` WhatsApp tests failed only because they hardcode `http://localhost:3300/i/`. The re-run on 3300 is the result above.
- **Negative controls** (one build with four mutations: no `showPicker()`; commit every change; `z.coerce.date()` and no adapter guard; no read-path range check). **11 of 13** applicable E2E tests failed, as did 39 unit tests. The 2 that still passed are the Beranda/list/public regression check, which was never a fix proof. All mutations were reverted with `git checkout -- src` and `grep "NEGATIVE CONTROL"` returns 0 hits, giving a clean tree.
- **Network review:** every keyboard test records every due-date PATCH body via `page.on("request")`. Asserted: zero during typing, then exactly the final value. The API test checks 10 invalid inputs (year 0002, 1999-12-31, 2100-01-01, 2026-02-30, month 13, unpadded parts, timestamp, whitespace, empty string, epoch number) against the real DB: each gets a 400 **and the stored value is unchanged**. Both bounds and a leap day get a 200; `null` clears.
- **Not run:** `npm run test:journey-coverage` / `coverage:journeys`. That infrastructure exists only on PR #25's branch, not here, so the coverage inventory was not changed.

## 8. PR #25 integration (it is still open)

This PR merged first, PR #25 then rebased on `staging`. Re-running PR #25's due-date spec against this fix (with `test.fail` removed) gives:

- `clicking or tapping the visible empty due-date field opens the date picker`: **passes** on chromium and chromium-mobile. → **Delete its `test.fail()` line.** Otherwise Playwright reports "expected to fail, but passed" and CI goes red.
- `keyboard date entry after clicking the visible field…`: **fails** against the fixed behavior, for two intended reasons:
  1. The click now opens the picker, so its digits never reach the segments. It needs to press Escape first.
  2. Nothing is saved until Enter or leaving the field, but it expects a PATCH right after typing.
  
  → **Replace it** with this PR's keyboard test, or add Escape + Enter and drop `test.fail()`. Don't leave the `test.fail()` in place: it would keep "failing as expected" for the wrong reason.
- Inventory: INV-DUE-02 and INV-DUE-04 can be marked covered **only** by tests that actually pass. Count `e2e/invoices/due-date-integrity.spec.ts`, not PR #25's expected failures. `MAN-DUE-01` stays manual.
- STATE.md and DAILY_LOG.md: both PRs append, so expect trivial text conflicts.

## 9. Production read-only check (for Chris; **not run** by me)

Schema verified from migrations: table `"Invoice"`, column `"dueDate" TIMESTAMP(3)`; `"Deal"."deadline" TIMESTAMP(3)` feeds new invoices. The query returns counts only. Its syntax was validated on the **local disposable DB**, where it found exactly the one seeded legacy row. It has never been run against any hosted database.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT
  count(*)                                                          AS invoices_total,
  count(*) FILTER (WHERE "dueDate" IS NOT NULL)                     AS with_due_date,
  count(*) FILTER (WHERE "dueDate" < TIMESTAMP '1900-01-01')        AS due_before_1900,
  count(*) FILTER (WHERE "dueDate" < TIMESTAMP '2000-01-01')        AS due_before_2000,
  count(*) FILTER (WHERE "dueDate" >= TIMESTAMP '2100-01-01')       AS due_from_2100,
  count(*) FILTER (WHERE "dueDate" <> date_trunc('day', "dueDate")) AS due_not_utc_midnight
FROM "Invoice";
SELECT count(*) FILTER (WHERE "deadline" < TIMESTAMP '2000-01-01' OR "deadline" >= TIMESTAMP '2100-01-01')
  AS deal_deadline_out_of_range
FROM "Deal";
ROLLBACK;
```

How to run it:
- **Neon dashboard:** SQL Editor → Production branch (`main`) → paste → Run.
- If `due_before_2000 + due_from_2100 > 0` and IDs are needed, use `SELECT id FROM "Invoice" WHERE "dueDate" < '2000-01-01' OR "dueDate" >= '2100-01-01' LIMIT 50;`. It returns IDs only.

After this PR ships, such rows render as "Tanggal tidak valid" and the owner can correct them. Any repair or migration needs a separately reviewed plan and Chris's authorization.

## 10. Manual UAT on real devices (pending; not claimed)

Emulation is not device proof. Run on staging after merge, on a real **Android Chrome** phone and a real **iPhone Safari**:

1. Open an invoice with a due date → tap the visible date text (not the right edge). **Expect:** native date picker opens.
2. Pick a different date → **Expect:** "Menyimpan…" then "Tersimpan"; the field shows the new date in `24 Jul 2026` style. Reload → same date.
3. Tap "Kosongkan" → "Belum ditentukan". Reload → still empty. Tap the empty text → picker opens; pick a date → saved.
4. In the picker, try to scroll to a year before 2000 or after 2099. **Expect:** the picker won't offer it, or if it does, the hint appears and nothing is saved (reload shows the previous value).
5. iOS only: on the wheel picker, spin quickly through several dates, then tap Done. **Expect:** after reload the final date is shown (no stale earlier date).
6. Switch the app language to English and repeat step 1: label "Due date", empty "Not set", picker still opens.

## 11. Residual risks / not done

- **No real-device verification** (Android/iOS): see §10.
- **Production exposure unknown:** the §9 query has not been run.
- **Deal `deadline` input** (`deal-validation.ts`) still uses `z.coerce.date()`. A bad deadline can no longer reach a new invoice, but the deal record itself is unvalidated. That is a follow-up, kept out to hold scope.
- **Legacy-row derived status:** a year-0002 row still derives OVERDUE (status derivation intentionally untouched). Beranda, the list, the public page, and the PDF still render that legacy date literally, e.g. "15 Jan 2". Only the owner detail page shows the invalid state. Nothing crashes.
- **Keyboard draft display:** while typing, the visible text shows the formatted draft, which can briefly read "15 Jan 2" mid-year. Nothing is saved until completion.
- **Keyboard picker interplay:** if someone types digits and then opens the picker *via keyboard* and chooses a date, that choice commits on Enter or leaving the field rather than instantly. Mouse/touch picker choices always commit at once.
- **Segment order:** the E2E keyboard tests rely on Playwright Chromium's month/day/year segment order in this id-ID context (verified in the test via `toHaveValue`). A real Indonesian-locale Chrome may use day/month/year; covered by manual UAT.
- **Firefox/WebKit:** the picker tests ran and passed there, but were not negative-controlled on those engines. Keyboard tests are desktop-Chromium only.
- **Visual baselines:** they can only be meaningfully compared in CI's renderer. The `@visual` suite is not part of PR CI.

## 12. Approvals needed from Chris

1. Review/merge this PR into `staging` (I will not merge).
2. Run (or authorize running) the §9 read-only Production query.
3. Real-device UAT (§10) on staging after merge.
4. Any data repair, if §9 finds rows (separate plan).
5. FIND-01 semantics (still open, untouched).
6. Later `staging → main` release (Production).

## 13. Review follow-up (2026-10-04, two Codex P2 threads on PR #26)

Head before: `9334109`. Both findings reproduced (by test) before fixing.

**A. `src/lib/invoice-validation.ts:18` — demo seed passed a `Date` to the strict schema.**
- *Before:* `scripts/m4-demo-data.ts` called `createInvoice(..., { dueDate: jakartaDateOffset(...) })` (a `Date`). `createInvoice` takes `unknown` and parses with `invoiceCreateSchema`, so typecheck could not catch it; every `m4:demo-data ... seed` would throw a Zod error at the first invoiced demo deal. It was the only such caller: the API route sends JSON strings, and both fixture scripts write through Prisma directly.
- *Fix at the caller, public contract unchanged:* `src/lib/m4-demo-dataset.ts` adds `jakartaDateOnlyOffset()`, which returns the same Jakarta calendar day as `yyyy-mm-dd`, read back from the UTC-midnight `Date`. It also adds `buildM4DemoInvoiceInput()`, the exact payload the script sends. The strict schema was not relaxed. Deal `deadline` still takes a `Date` through `z.coerce.date()`, which is the existing, separately tracked follow-up.
- *Tests:* `src/lib/m4-demo-dataset.test.ts` covers the Jakarta boundary (16:59:59Z → same day; 17:00Z → next day; month rollover). It sends every demo invoice payload through the real `createInvoice` (with an in-memory adapter) at both sides of Jakarta midnight, asserting it is accepted and stored as UTC midnight of exactly the intended day. A regression test confirms the old `Date` payload is rejected and nothing is written.
- *Not run:* the script itself, because its guard (`checkM4DemoTarget`) refuses anything except the Neon staging endpoint. That refusal is correct, and per this task no hosted DB was touched.

**B. `src/components/date-field.tsx:128` — a failed save left the attempted date on screen.**
- *Before:* after a failed picker choice, Enter/blur, or clear, the field kept showing the unsaved date. After a failed clear it showed an empty field. The database still held the old value, and only the error line hinted otherwise.
- *Chosen UX:* the visible value reverts to the last **confirmed** value, the error stays visible (`role="alert"`, unchanged copy "…belum bisa diperbarui. Coba lagi."), and the next pick, Enter/blur, or Kosongkan retries normally. "Confirmed" means the newest request in the commit chain that succeeded, or else the persisted prop. That covers the case where an earlier save in the chain landed and a newer one then failed.
- *Concurrency:* commits stay serialized, with newest-intent-wins. While the chain is saving, the newest intent stays on screen: a parent prop update from an earlier request landing no longer swaps it back to an older date. This was a related display glitch found while writing the tests. A keyboard draft started while the failing request was in flight is newer than the failed intent, so it is never overwritten. Escape still drops it.
- *Picker test tightened (no product change):* on Chromium, the visible-field picker test no longer skips when `:open` is missing. It fails loudly instead. Firefox/WebKit stay feature-detected (both support `:open` and pass).
- *Unit tests* (`src/components/date-field.test.tsx`, "failed saves (PR #26 review)", 7 tests, using a parent harness whose `value` changes only on a confirmed save): failed picker → revert + alert + retry saves; failed Kosongkan → old date back, Kosongkan kept, retry clears; failed native clear → revert; failed Enter → revert + retry; earlier ok / newest fails → earlier confirmed date shown (and the newest intent is shown while saving); earlier fails / newest ok → saved, no alert; mid-flight keyboard draft preserved, Escape restores.
- *Real-browser tests* (`e2e/invoices/due-date-integrity.spec.ts`, "failed saves"): `page.route` fails only the next due-date PATCH with a 409, using the existing narrow `expectedErrorResponses` opt-in rather than a new diagnostics bypass. The stored value is checked through `page.request`, which `page.route` does not intercept.
  - **Failed Kosongkan:** the stored date reappears with the error, then a retry clears it and the empty state survives a reload. Runs on chromium and chromium-mobile.
  - **Failed typed date:** after Enter fails, the stored date reappears; retyping and Enter saves it and it survives a reload. Exactly `["2030-01-15","2030-01-15"]` is sent (nothing partial). Desktop chromium only.
- *Negative controls:* with the pre-fix `date-field.tsx` restored, 5 of the 7 new unit tests fail. The other 2 ("earlier fails / newest ok" and "mid-flight draft preserved") test behavior that was already correct. All 3 new browser journeys fail on a rebuilt pre-fix app. The fix was restored (byte-identical, `cmp`) and rebuilt.

**Validation on the follow-up tree** (local, disposable `127.0.0.1:55432/dibayar_test` only):

| Gate | Result |
|---|---|
| `npm run lint` / `npm run typecheck` / `npm run build` | 0 / 0 / 0 |
| `npm test` | 893/893 (was 882; +11) |
| `npm run test:e2e:critical` (chromium + chromium-mobile) | 99 passed, 0 failed, 17 skipped (was 96/16; +2 chromium, +1 mobile journey; the extra skip is the desktop-only keyboard variant on mobile) |
| Firefox + WebKit, `due-date-integrity.spec.ts` | 10 passed, 0 failed, 12 skipped (Chromium-only keyboard/API tests) |
| Picker tests after the skip tightening, 4 projects | 8/8 passed |
| `npm run test:e2e:a11y` (chromium) | 12 passed, 1 skipped |
| `@visual` | not re-run: no layout change, and local renderer baselines differ (§7) |

One local run of the picker tests failed with `ERR_CONNECTION_REFUSED`. I had started it while the a11y run still owned port 3300 (`reuseExistingServer`). A clean rerun gave 8/8, and that is the one reported above.

