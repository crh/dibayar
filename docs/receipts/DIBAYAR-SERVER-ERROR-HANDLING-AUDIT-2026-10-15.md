# Dibayar — server error handling audit (#53) — 2026-10-15

**Verdict:** P1 gaps fixed in [PR #54](https://github.com/crh/dibayar/pull/54) → `staging` (fix commit `1dc00db`), CI green · RED/GREEN evidence below · release **NO-GO** (unchanged human gates, last section)

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
| 1 | Add deal — Simpan deal | `deal-client.tsx` `handleSubmit` | `POST /api/deals` | 201, 400 (+`fields`), 401, 403, 500 | **No timeout (spinner forever)**; network/HTML → "Deal belum bisa disimpan." (untrue if stored) | 400+fields → field errors (#52); others generic | TO; unknown → reads `GET /api/deals`, adopts the stored deal if found, else "…belum pasti tersimpan. Tekan Simpan deal lagi: kami periksa dulu…"; next press checks again **before** any POST; if the check fails too, nothing is sent. 401/403 → specific guidance | **High before** (retry after a committed timeout = second deal). After: reconciliation, no schema change | E2E ×6 (502 HTML, abort, no answer, stored-no-answer, real 403, real 401) + U ×6 | **P1 fixed** |
| 2 | Board stage move (menu/drag) | `deal-client.tsx` `handleStageChange` | `PATCH /api/deals/[id]` | 200, 400, 401, 403, 404, 500 | **No timeout**: card pending forever | generic "Deal belum bisa diperbarui. Coba lagi." | TO; unknown → reads the deal back: stored stage → kept, no error; otherwise rolled back + "…belum pasti tersimpan…". 401/403/429 specific | Idempotent PATCH: none | E2E ×2, U ×2 | **P1 fixed** |
| 3 | Board — Buat invoice | `deal-client.tsx` `handleCreateInvoice` | `POST /api/invoices` | 201, 400, 401, 403, 404, 500 | **No timeout**; unknown → "Invoice belum bisa dibuat." | generic | TO; unknown → reads `GET /api/invoices`, adopts the deal's invoice; else "…belum pasti dibuat…"; next press checks first | **High before** (no DB uniqueness per deal: a retry after a committed timeout = second invoice + number). After: reconciliation | E2E ×2, U ×1 | **P1 fixed** |
| 4 | Deal detail — stage buttons | `deal-detail-client.tsx` | `PATCH /api/deals/[id]` | as #2 | **No timeout** | generic | as #2 | none | U ×1 (401); shared helper covered by E2E #2 | **P1 fixed** |
| 5 | Deal detail — Buat invoice | `deal-detail-client.tsx` | `POST /api/invoices` | as #3 | **No timeout** | generic | as #3 | as #3 | U ×2 | **P1 fixed** |
| 6 | Deal detail — contact name / WhatsApp repair | `deal-detail-client.tsx` | `PATCH /api/deals/[id]` (+ read-back GET) | as #2 | **No timeout** | 400 → field message (#52); others "…Coba lagi." | TO (now `fetchWithTimeout`); 401/403/429 specific; other messages unchanged | idempotent | U ×1 (401) + E2E real 401 (`resilience-permissions`, updated) | P2 fixed |
| 7 | Invoice — status (Tandai lunas, …) | `invoice-detail-client.tsx` `updateStatus` | `PATCH /api/invoices/[id]` | 200, 400, 401, 403, 404, 409, 500 | TO ✓; unknown → "Status invoice belum bisa diperbarui." | 409 generic (correct, existing E2E); **401 generic** | 401/403/429 specific; unknown → reads the invoice back (stored → shown, no error) | idempotent-ish; read-back avoids a confusing 409 on retry | E2E (real 401, session-expiry spec, updated) + existing 409 E2E + U ×2 | P2 fixed |
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

Server-side: every route keeps auth → Origin → Zod order, owner scoping, and generic Indonesian error text. The UI never renders the server's `error` text (now asserted in U tests with a sentinel "raw server text"). No route, schema or validation changed.

## What changed

- `src/lib/mutation.ts` (new): `sendMutation()` = `fetchWithTimeout` + classification **ok / rejected (the API's own JSON; the route's transaction rolled back) / unknown (timeout, network, non-JSON 5xx/2xx)**; `mutationErrorKey()` (401 → sign in again, 403 → reload, 429 → wait; everything else keeps the action's own message); `findCreatedDeal()` (new id, same brand/scope/fee/normalized number, compared the way the server stores them) and `findCreatedInvoice()`; `readList()`.
- `deal-client.tsx`, `deal-detail-client.tsx`: create deal, stage moves, invoice create use it; reconciliation as in the matrix. Contact saves on deal detail use `fetchWithTimeout`.
- `settings-form.tsx`, `invoice-detail-client.tsx` (`updateStatus` only): status-specific messages; status change read-back after an unknown outcome.
- `src/lib/i18n.ts`: `error.connection`, `error.sessionExpired`, `error.originRejected`, `error.rateLimited`, `dashboard.saveUnknown`, `dashboard.invoiceUnknown` (id + en).
- `e2e/support/test.ts`: per-test opt-in `expectedFailedRequests` (method + pathname, same narrowness as `expectedErrorResponses`). Nothing else in the guard changed; default is `[]`.
- Tests: `e2e/deals/server-errors.spec.ts` (new, `@critical`), `e2e/auth/session-expiry.spec.ts` (new add-deal 401 test; Tandai lunas 401 now expects the sign-in message), unit tests in `mutation.test.ts`, `deal-client.test.tsx`, `deal-detail-client.test.tsx`, `settings-form.test.tsx`, `invoice-detail-client.test.tsx`.
- Journey inventory: DEAL-CREATE-08…11, DEAL-STAGE-06, DEAL-INV-03 (partial by rule, with an exception entry: the lost answer can only be injected); AUTH-07 expected text updated; `JOURNEY-COVERAGE.md` regenerated.

### Residual risks (accepted, documented)

- Reconciliation is by content, not by an idempotency key (that would need a schema migration). A deal created **in another tab** with the identical brand, scope, fee and number between page load and the retry would be adopted instead of a second identical deal being created.
- A request stored **after** the page's check (server slower than 8 s and slower than the read-back) is still found by the check on the next press, unless the person reloads first; after a reload the board shows it.
- A 500 from the API is treated as "not stored" (the route's handler only answers 500 from its catch, after the transaction rolled back). A platform 504 page is non-JSON and treated as unknown.

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

## Rollback

Revert the fix commit on `staging` (one commit; no schema, route or environment change). The new i18n keys and test opt-in are inert once the callers are reverted.

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
