# Dibayar — server error handling audit (#53) — 2026-10-15

**Verdict:** P1 gaps fixed in [PR #54](https://github.com/crh/dibayar/pull/54) → `staging` (fix commit `1dc00db`; review follow-up 2026-10-16, see the section of that name) · RED/GREEN evidence below · release **NO-GO** (unchanged human gates, last section)

> **2026-10-16 update.** The three Codex review threads on #54 were right: a read of the board cannot prove that a timed-out create will not commit later, a JSON 5xx from a gateway is not proof of a refusal, and matching by content can adopt the wrong deal. Deal and invoice creates now carry an **`Idempotency-Key`** enforced by a unique database index (**adds a migration**). Rows 1, 3, 5 and 7 of the matrix and "What changed" / "Residual risks" / "Rollback" below are updated for it; the original 2026-10-15 text that no longer holds is struck through or replaced.

## State at start

| Item | Value |
| --- | --- |
| `origin/staging` | `c3af215` = merge of PR #52 (field-level errors for #50, **including** the "clear the summary after the last corrected field" fix `4dd5fcf` + test `5f4ec95`) |
| `origin/main` | `308a339` (untouched) |
| PR #52 | **MERGED** 2026-10-15 11:39 UTC. Its review thread is resolved on `staging`; nothing of #52 is repeated here |
| PR #51 | OPEN, temporary diagnostic for #50, superseded by #52 (its own receipt recommends closing it unmerged). Overlaps this branch in `deal-client.tsx` (`handleSubmit`), its test and `i18n.ts` (`api/deals/route.ts` is untouched here); `git merge-tree` shows #51 **already conflicts with `staging`** (since #52) in `deal-client.tsx`, its test, `deal-crud.spec.ts` and `i18n.ts`, and the same four files conflict with this branch, so this branch adds no new obstacle. Recommended: close #51 unmerged |
| PR #39 | Dependabot → `main`, unrelated |
| Branch | `fix/server-error-handling-2026-10-15` from `c3af215`, worktree `../dibayar-server-errors` |

## Scope of the audit

Every client-side write to the app's own API (`grep fetch(` over `src/`, excluding tests), each read against its route's actual contract. Statuses listed are only the ones the route can really return.

Abbreviations: **TO** = bounded by `fetchWithTimeout` (8 s). **Unknown** = no answer / dropped connection / non-JSON gateway page (the write may or may not have been stored).

## Matrix

"Before" = `staging` `c3af215`. "After" = this branch. Evidence: **E2E** = Playwright (real browser), **U** = Vitest component/unit, **CR** = code-reviewed only.

| # | Action (UI) | Client | API | Route statuses | Before: timeout / unknown | Before: 401 / 403 / 429 / other | After | Dup-write risk & handling | Evidence | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Add deal — Simpan deal | `deal-client.tsx` `handleSubmit` | `POST /api/deals` | 201, 200 (repeat of a stored key), 400 (+`fields`; malformed key), 401, 403, 409 (key reused for other content), 500 | **No timeout (spinner forever)**; network/HTML → "Deal belum bisa disimpan." (untrue if stored) | 400+fields → field errors (#52); others generic | TO; unknown (no answer, network, **any 5xx**) → "…belum pasti tersimpan. Tekan Simpan deal lagi tanpa mengubah isinya: deal ini tidak akan tersimpan dua kali."; form kept; the next press sends the **same body with the same `Idempotency-Key`**, and the server returns the stored deal (200) or stores it once (201). Changed content = new key. 401/403/429 → specific guidance | **High before** (retry after a committed timeout = second deal). After: unique `(userId, idempotencyKey)` index; a concurrent or late repeat waits on the index and gets the stored row | E2E ×9 UI (502 HTML, 502 JSON, abort, no answer, stored-no-answer, stored + JSON 504, late original, real 403, real 401) + E2E ×2 API on the real DB (6 concurrent repeats → 1 row; reused key → 409) + U | **P1 fixed** |
| 2 | Board stage move (menu/drag) | `deal-client.tsx` `handleStageChange` | `PATCH /api/deals/[id]` | 200, 400, 401, 403, 404, 500 | **No timeout**: card pending forever | generic "Deal belum bisa diperbarui. Coba lagi." | TO; unknown → reads the deal back: stored stage → kept, no error; otherwise rolled back + "…belum pasti tersimpan…". 401/403/429 specific | Idempotent PATCH: none | E2E ×2, U ×2 | **P1 fixed** |
| 3 | Board — Buat invoice | `deal-client.tsx` `handleCreateInvoice` | `POST /api/invoices` | 201, 200 (repeat), 400, 401, 403, 404, 409 (key reused for another deal/tax type), 500 | **No timeout**; unknown → "Invoice belum bisa dibuat." | generic | TO; unknown (incl. any 5xx) → "…belum pasti dibuat. Tekan Buat invoice lagi: invoice ini tidak akan dibuat dua kali."; the next press resends with the same key per deal | **High before** (no DB uniqueness per deal: a retry after a committed timeout = second invoice + number). After: same unique key index on `Invoice`; a repeat consumes no invoice number | E2E ×2 UI + E2E ×1 API (6 concurrent repeats → 1 invoice), U | **P1 fixed** |
| 4 | Deal detail — stage buttons | `deal-detail-client.tsx` | `PATCH /api/deals/[id]` | as #2 | **No timeout** | generic | as #2 | none | U ×1 (401); shared helper covered by E2E #2 | **P1 fixed** |
| 5 | Deal detail — Buat invoice | `deal-detail-client.tsx` | `POST /api/invoices` | as #3 | **No timeout** | generic | as #3 (same key handling) | as #3 | U ×4 (no answer, 502 HTML, JSON 504, new key after a refusal) | **P1 fixed** |
| 6 | Deal detail — contact name / WhatsApp repair | `deal-detail-client.tsx` | `PATCH /api/deals/[id]` (+ read-back GET) | as #2 | **No timeout** | 400 → field message (#52); others "…Coba lagi." | TO (now `fetchWithTimeout`); 401/403/429 specific; other messages unchanged | idempotent | U ×1 (401) + E2E real 401 (`resilience-permissions`, updated) | P2 fixed |
| 7 | Invoice — status (Tandai lunas, …) | `invoice-detail-client.tsx` `updateStatus` | `PATCH /api/invoices/[id]` | 200, 400, 401, 403, 404, 409, 500 | TO ✓; unknown → "Status invoice belum bisa diperbarui." | 409 generic (correct, existing E2E); **401 generic** | 401/403/429 specific; unknown **or any 5xx** (2026-10-16) → reads the invoice back (stored → shown, no error) | idempotent-ish; read-back avoids a confusing 409 on retry, and a gateway's JSON 5xx no longer reports "failed" for a payment that was stored | E2E (real 401, session-expiry spec, updated) + existing 409 E2E + U ×2 | P2 fixed |
| 8 | Invoice — due date | `invoice-detail-client.tsx` `saveDueDate` → `DateField` | `PATCH /api/invoices/[id]` | 200, 400, 401, 403, 404, 500 | TO ✓; `{ok:false}` → `DateField` restores stored date + `role=alert` | generic for all | unchanged | idempotent | existing E2E (`due-date-integrity`: 409 stub, real 500) | P3 deferred (401 guidance) |
| 9 | Invoice — create/regenerate/ensure share link | `useShareState.requestLink` | `POST …/share`, `POST …/share/ensure` | 200, 401, 403, 404, 500 | TO ✓; operation message | generic | unchanged | ensure: idempotent. regenerate: a retry rotates again — one active link per invoice (`invoiceId @unique`), no duplicates | existing E2E (share specs) | P3 deferred |
| 10 | Invoice — revoke share | `useShareState.revoke` | `DELETE …/share` | 200, 401, 403, 404, 500 | TO ✓; operation message | generic | unchanged | idempotent | existing E2E | P3 deferred |
| 11 | Invoice — WhatsApp repair | `invoice-detail-client.tsx` | `PATCH /api/deals/[id]` + GET | as #2 | TO ✓ | 400 → field message (#52) | unchanged | idempotent | existing E2E/U | OK |
| 12 | Beranda — Kirim pengingat / repair | `follow-up-queue.tsx` | `POST …/share/ensure`, `PATCH /api/deals/[id]` | as #9/#2 | TO ✓; row error, popup closed | generic | unchanged | idempotent | existing E2E | P3 deferred |
| 13 | Settings — Simpan pengaturan / reset template | `settings-form.tsx` | `PATCH /api/me/settings` | 200, 400 (+`fields`), 401, 403, 429, 500 | TO ✓; "Gagal menyimpan. Coba lagi." (untrue if stored) | 400 → field errors (#52); **401/403/429 generic** | 401/403/429 specific; unknown → "…belum pasti tersimpan…"; form kept | idempotent | U ×4; existing E2E (real 400, 409 stub) | P2 fixed |
| 14 | Language toggle | `language-switcher.tsx` | `PATCH /api/me/language` | 200, 400, 401, 403, 429, 500 | plain `fetch`, `.catch(() => undefined)`: **silent** | silent | unchanged | idempotent | CR | P3 deferred (local preference still applies; only the stored preference can lag) |
| 15 | Unduh PDF (owner) | `<a href>` | `GET /api/invoices/[id]/pdf` | 200, 401, 404, 500 | browser navigation | a 500 shows the route's raw JSON (`{"error":"PDF invoice belum bisa dibuat. Coba lagi."}`) as a page — no secrets, but not a designed page | unchanged | read-only | existing E2E (happy path) | P3 deferred |
| 16 | Delete deal | — | `DELETE /api/deals/[id]` (204/404/409) | — | **no UI** | — | — | — | — | N/A |
| 17 | Sign in / sign out | Auth.js | `/api/auth/*` | Auth.js-owned | Auth.js pages | — | unchanged | — | existing E2E (session, sign-out, expiry) | out of scope |
| 18 | Page load failure | `src/app/(app)/error.tsx` | server components | — | covers every page in the `(app)` group (Beranda, Deal, Invoice, Pengaturan, details): `role=alert` + **Coba lagi** (FIND-12). It never sees mutation errors — those are inline above | — | unchanged | — | existing E2E (`e2e/smoke/route-error-retry.spec.ts`) | OK |

Server-side: every route keeps auth → Origin → Zod order, owner scoping, and generic Indonesian error text. The UI never renders the server's `error` text (now asserted in U tests with a sentinel "raw server text"). ~~No route, schema or validation changed.~~ 2026-10-16: `POST /api/deals` and `POST /api/invoices` read an optional `Idempotency-Key` header after the Origin check; the schema gains two nullable columns and two unique indexes (see the follow-up section). Other routes, validation and owner scoping are unchanged.

## What changed

- `src/lib/mutation.ts` (new): `sendMutation()` = `fetchWithTimeout` + classification **ok / rejected (the API's own JSON; the route's transaction rolled back) / unknown (timeout, network, non-JSON 5xx/2xx)**; `mutationErrorKey()` (401 → sign in again, 403 → reload, 429 → wait; everything else keeps the action's own message); `findCreatedDeal()` (new id, same brand/scope/fee/normalized number, compared the way the server stores them) and `findCreatedInvoice()`; `readList()`.
- `deal-client.tsx`, `deal-detail-client.tsx`: create deal, stage moves, invoice create use it; reconciliation as in the matrix. Contact saves on deal detail use `fetchWithTimeout`.
- `settings-form.tsx`, `invoice-detail-client.tsx` (`updateStatus` only): status-specific messages; status change read-back after an unknown outcome.
- `src/lib/i18n.ts`: `error.connection`, `error.sessionExpired`, `error.originRejected`, `error.rateLimited`, `dashboard.saveUnknown`, `dashboard.invoiceUnknown` (id + en).
- `e2e/support/test.ts`: per-test opt-in `expectedFailedRequests` (method + pathname, same narrowness as `expectedErrorResponses`). Nothing else in the guard changed; default is `[]`.
- Tests: `e2e/deals/server-errors.spec.ts` (new, `@critical`), `e2e/auth/session-expiry.spec.ts` (new add-deal 401 test; Tandai lunas 401 now expects the sign-in message), unit tests in `mutation.test.ts`, `deal-client.test.tsx`, `deal-detail-client.test.tsx`, `settings-form.test.tsx`, `invoice-detail-client.test.tsx`.
- Journey inventory: DEAL-CREATE-08…11, DEAL-STAGE-06, DEAL-INV-03 (partial by rule, with an exception entry: the lost answer can only be injected); AUTH-07 expected text updated; `JOURNEY-COVERAGE.md` regenerated.

### Residual risks (accepted, documented)

~~Reconciliation by content; a request stored after the page's check; an API 500 treated as "not stored".~~ All three were superseded on 2026-10-16 by the idempotency key; they were the #54 review findings. What remains:

- The key lives in the page's memory. **Reloading** after an unknown outcome loses it; the reloaded board then shows whether the deal was stored, so a second save is a visible, deliberate choice, not a silent duplicate.
- **Editing** the form after an unknown outcome makes it a new submission (new key). If the first attempt was stored, the person can end up with the old and the corrected deal. The alert says to press Simpan deal again *without changing it*.
- A repeat returns the stored deal even after its stage was moved (the stage is not compared). Contact fields edited on the detail page before a late repeat would make that repeat a `409` (refused, nothing written; the page says to reload).
- Requests without the header (older open tabs during a deploy, scripts) behave exactly as before, with no protection.
- Owner-scoped API responses now include the owner's own `idempotencyKey` (a random UUID). The public invoice page and PDF use an explicit field `select` and do not.

## RED / GREEN

**RED** (`c3af215` code, new tests):
- E2E chromium, `server-errors.spec.ts` (9 tests): **9 failed** — "Deal belum bisa disimpan." instead of the unknown-outcome message (502, abort); no alert at all after 15 s (no answer: endless spinner); dialog still open (stored-no-answer); board stage move: no alert, card menu still disabled after 15 s; board invoice: generic message / nothing after 15 s.
- E2E chromium, Origin 403 (real server 403) and the two real-401 session-expiry tests: **3 failed** (generic messages).
- Vitest: with the implementation files stashed, **17 of the new component tests failed** (165 run in the touched files; the other 148 passed).

**GREEN** (this branch): see Validation.

## Validation

| Gate | Result |
| --- | --- |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | clean |
| `npm test` | 87 files, **1069 passed** (after the last unit test was added) |
| `npm run build` (Turbopack) | OK |
| `npm run coverage:journeys` / `test:journey-coverage` / `test:diagnostics-selftest` | OK / 37 pass / 1 pass |
| Playwright chromium + chromium-mobile + webkit, `server-errors.spec.ts` + `session-expiry.spec.ts` | **39 passed**, 0 failed, 0 flaky, 0 retries |
| `npm run test:e2e:critical` (chromium + chromium-mobile) | on `1dc00db`: **278 passed, 0 failed, 0 flaky**, 28 skipped (existing per-project conditions), 23.1 min. The earlier run on the previous working state had 276 passed and 2 failed: `resilience-permissions` (chromium, chromium-mobile) still asserted the old 401 text. That was an intended behavior change, so the assertion was updated in `1dc00db` |
| WebKit (local), `e2e/deals e2e/invoices e2e/settings e2e/auth`, no `@visual` | **99 passed, 0 failed**, 16 skipped (existing per-project conditions) |
| Firefox | NOT_RUN (CI `e2e-cross-browser` is skipped for PRs by workflow rule; it runs on `staging` after merge) |
| 390px (chromium-mobile) | the dialog alert for an unknown outcome sits above the fields, the form is kept, `scrollWidth - clientWidth = 0` |
| `npm run ux:audit` local | NOT_RUN locally (CI ux-audit green) |
| CI on PR #54 at `1dc00db` | [run 38746164839](https://github.com/crh/dibayar/actions/runs/38746164839): lint-typecheck-test ✅ · e2e-critical ✅ · e2e-a11y ✅ · ux-audit ✅ · e2e-cross-browser skipped (PR rule). [Journey coverage (full) 38746164866](https://github.com/crh/dibayar/actions/runs/38746164866) ✅ |

## Review follow-up (2026-10-16): idempotency key

### State at start

| Item | Value |
| --- | --- |
| `origin/staging` | `c3af215` (unchanged since 2026-10-15) |
| `origin/main` | `308a339` (untouched) |
| PR #54 head | `96f1a7f`, CI green ([38751704726](https://github.com/crh/dibayar/actions/runs/38751704726), [journey 38751704730](https://github.com/crh/dibayar/actions/runs/38751704730)), **3 unresolved Codex review threads** on `1dc00db` |
| PR #52 | merged (`c3af215`); no dependency |
| PR #51 | open, still conflicts with `staging`; recommendation to close unchanged |

### The three threads, and what answers each

| Thread | Finding | Verified? | Fix |
| --- | --- | --- | --- |
| `deal-client.tsx:318` (P1) | A timed-out create can still commit **after** the page's read-back and after the retry's own check, so the retry's POST makes a second deal/invoice. | Yes: RED test below, 6 concurrent creates → 6 deals | `Idempotency-Key` header, stored under `@@unique([userId, idempotencyKey])` on `Deal` and `Invoice`. A repeat finds the row; a concurrent repeat's insert waits on the index for the first transaction, fails with P2002, and reads the winner (`src/lib/idempotency.ts` `createOnce`) |
| `mutation.ts:35` (P1) | A gateway's JSON 502/503/504 parses fine and was classed "rejected", which cleared the unconfirmed marker | Yes: unit RED for JSON 500/502/503/504; E2E RED for JSON 502 and stored + JSON 504 | Every 5xx is `unknown`. That is safe now because the retry is idempotent. Same rule applied to Tandai lunas/status (`invoice-detail-client.tsx`), which reads the invoice back |
| `mutation.ts:76` (P2) | Content matching ignores optional fields and can adopt another tab's deal | Yes (by construction) | Content matching removed (`findCreatedDeal`, `findCreatedInvoice`, `readList` deleted). The key names the submission. The server compares every typed field of a replayed deal (brand, number, name, scope, fee, deadline, terms; not the stage) and dealId + tax type for an invoice; a mismatch is `409`, nothing written |

### Contract

- Client (`src/lib/mutation.ts` `idempotencyKeyFor`): one `crypto.randomUUID()` per submission. The key is kept while the outcome is unknown and the body is byte-identical, and dropped on any definite answer (2xx or 4xx). Invoice keys are kept per deal.
- Server (`readIdempotencyKey`): the header is optional (no header = old behaviour); if present it must match `^[A-Za-z0-9-]{16,100}$`, else `400` before anything is read. Read after auth and the Origin check, so it never widens either.
- Answers: `201` new · `200` repeat of the stored row (same JSON shape) · `409` key used for other content.
- Migration `20261016000000_create_idempotency_keys`: two nullable `TEXT` columns + two unique indexes, additive only (NULLs never collide). `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → 0 on the local test database after `migrate deploy`.

### RED / GREEN (2026-10-16)

RED = this follow-up's tests on the previous PR head `96f1a7f`'s implementation (implementation files stashed, migration applied so the old code ran against the same database).

| Suite | RED | GREEN |
| --- | --- | --- |
| Vitest, the 8 touched test files | **58 failed** / 223 (new `createDealOnce`/`createInvoiceOnce`/`createOnce`/key-header/route/JSON-5xx/same-key-retry tests) | all pass |
| Vitest, `invoice-detail-client` Tandai lunas JSON 5xx | **4 failed** | 6/6 #53 cases pass |
| E2E chromium, `server-errors.spec.ts` (15 tests) | **8 failed**: JSON 502 → "Deal belum bisa disimpan." (definite, untrue); stored-no-answer and stored + JSON 504 → no same-key retry; late original → no key sent; **6 concurrent creates → `[201 ×6]`, i.e. six deals**; reused key → `201` instead of `409`; 6 concurrent invoice creates → six invoices; invoice stored-no-answer | **30 passed** (15 × chromium, chromium-mobile), 0 failed, 0 flaky |

### Validation (2026-10-16, local, final working tree; CI on the pushed head is linked on the PR)

| Gate | Result |
| --- | --- |
| `npm run lint` / `npm run typecheck` | 0 errors, 0 warnings / clean |
| `npm test` | 88 files, **1118 passed**, 0 failed |
| `npm run build` (Turbopack) / `npm run e2e:build` (webpack) | OK / OK |
| `prisma migrate deploy` + `migrate diff --exit-code` on `127.0.0.1:55432/dibayar_test` | applied; no drift (exit 0) |
| `coverage:journeys` / `test:journey-coverage` / `test:diagnostics-selftest` | OK (102 actions; new DEAL-CREATE-12; 8 outstanding P0/P1, all in the exception register) / 37 pass / 1 pass |
| `@critical`, chromium + chromium-mobile | **290 passed, 0 failed, 0 flaky**, 28 skipped (existing per-project conditions), 23.7 min. Built before the Tandai lunas 5xx change, so the invoice suites were re-run on the final build (next row) |
| `e2e/invoices` + `server-errors.spec.ts`, chromium + chromium-mobile, final build | **112 passed, 0 failed**, 12 skipped |
| WebKit: `e2e/deals e2e/invoices e2e/settings e2e/auth`, no `@visual` | **105 passed, 0 failed**, 16 skipped |
| `@a11y`, chromium | **29 passed**, 1 skipped |
| Retries | none needed; no test reported flaky |
| Firefox | NOT_RUN (CI `e2e-cross-browser` runs on `staging` after merge) |
| UX audit | NOT_RUN locally (CI `ux-audit` on the PR) |

## Rollback

- **Code:** revert the PR's commits on `staging`. Pages and routes then ignore the key.
- **Schema:** migration `20261016000000_create_idempotency_keys` is additive (two nullable `TEXT` columns, two unique indexes). Migrations are forward-only (`docs/DEVELOPMENT-WORKFLOW.md`), and the reverted code neither reads nor writes these columns, so they can stay. Removing them would need a new down-migration PR (`DROP INDEX "Deal_userId_idempotencyKey_key"`, `DROP INDEX "Invoice_userId_idempotencyKey_key"`, then `ALTER TABLE … DROP COLUMN "idempotencyKey"` on both). Do not hand-edit `_prisma_migrations`.
- Merging to `staging` applies the migration to the staging database through `scripts/vercel-build.sh` (`prisma migrate deploy`). It reaches Production only with a later, separately authorized `staging → main` release.

## Human gates — unchanged by this work

| Gate | Status |
| --- | --- |
| Review/merge this PR into `staging` (not `main`) | PENDING |
| Close PR #51 unmerged | PENDING (recommended; already conflicts with `staging`) |
| #50 physical-iPhone PASS on staging after #52 | NOT_RUN (not inferred from this audit) |
| iPhone / Android MAN-DUE-01 | NOT_RUN |
| FIND-10 Production read-only check | NOT_RUN |
| Release authorization | NOT GIVEN |

**Release: NO-GO.** No Production, `main`, Vercel, Neon, OAuth or GitHub-settings change was made.

## Operator handoff (manual, optional)

After PR #54 is merged, on the staging deployment of **that merge commit's SHA** (record it), on a phone:
1. Add deal, switch the phone to airplane mode, press **Simpan deal** → within ~8 s the dialog says the deal "belum pasti tersimpan", the form is kept. Turn the network back on, press **Simpan deal** → saved once; reload → exactly one deal.
2. Nothing else needs a manual pass; the rest is covered by the automated tests above.
