# Receipt — Zero Routine Manual Regression Testing, Phase 2A (journey Batch 2A), 2026-10-04

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **The PR into `staging` is open and not merged** (§10). Nothing was deployed or released. No Production, hosted-staging or Neon database was read or written. No Vercel, Neon or OAuth setting was changed. No Preview or Neon branch was created, and no visual baseline was updated. All fixture work used the disposable local `127.0.0.1:55432/dibayar_test` through the existing guarded `scripts/e2e-fixtures.ts`. No credential or share token was printed. Tokens in failure output were redacted or compared as booleans.

## 1. Start gate (verified live)

- **PR #27 merged.** `gh pr view 27` showed MERGED at 2026-10-04T11:18:02Z, merge commit `e83cf1a1172369cba99dfc7ba1eb84aa5ac88cb1`. `git merge-base --is-ancestor e83cf1a origin/staging` succeeded, and `origin/staging` = `e83cf1a`.
- There were no other open PRs. The main checkout (`/home/kenji/code/dibayar`, branch `chore/journey-coverage-2026-10-03`) has three untracked items owned by others: two 2026-10-01 receipts and `src/generated/`. They were not touched. Other agents' worktrees were not touched either; the Phase 1 worktree was used read-only as a same-host clean-staging control (§8).
- New worktree `/home/kenji/code/dibayar-zero-routine-phase2a` on `chore/zero-routine-regression-phase2a-2026-10-04`, from `origin/staging` `e83cf1a` (upstream unset, so nothing can push to `staging`). There is no `preview/*` branch. `.env.local` was copied in (gitignored, contents not printed).
- `AGENTS.md` does not exist. `CLAUDE.md`, `docs/DEVELOPMENT-WORKFLOW.md`, `REVIEW_CHECKLIST.md`, `docs/testing/*` and the relevant specs, fixtures and app code were read.
- The baseline matched the brief: 95 actions / 94 applicable, real 52/94 = 55.3%, P0 28/30 = 93.3%, 17 outstanding P0/P1.

## 2. What changed

| Commit | Content |
|---|---|
| `9c4697a` | Fixture overlay `e2e-fixtures.ts follow-up-states` plus `applyFollowUpStates()`; additive manifest key `followUp`; `e2e/support/follow-up.ts` (Jakarta date helpers with an independent month table, queue locators, `keepWhatsAppLocal()`). |
| `26e57ea` | Specs: `e2e/home/follow-up-queue.spec.ts`, `e2e/invoices/overdue-invoice.spec.ts`, `e2e/deals/contact-repair.spec.ts` (including two FIND-04 `test.fail()` tests). |
| `5d3c7ca` | Flake fix: hydration wait in `invoice-journeys.spec.ts` "due date edits and clears persist after reload" (§7). |
| `903dc4b` | Inventory, generated `JOURNEY-COVERAGE.md`, `JOURNEY-GRAPHS.md`, `JOURNEY-BACKLOG.md`, `MANUAL-UAT.md`, `E2E.md`. |
| `b9b553f` | HOME-03 test waits for invoice detail to settle before reloading (needed by Firefox/WebKit, §9). |
| (last commit) | `STATE.md`, `DAILY_LOG.md`, this receipt. |

`git diff origin/staging -- src prisma package.json package-lock.json .github playwright.e2e.config.ts playwright.config.ts e2e/visual e2e/support/test.ts` is **empty**. There is no application, migration, dependency, CI, config or snapshot change. Existing fixture IDs, brands, rows and manifest keys are unchanged.

### Fixture design: an opt-in overlay, not new base-seed rows

Adding rows to the base seed would have put invoices into Beranda's follow-up queue and three or more cards onto the deal board. Both are captured by `@visual` baselines (Beranda, Deals, Invoice list), and the read-only specs never reseed. So, following the existing `legacy-due-date` pattern, `follow-up-states`:

- runs only on top of a **fresh** base seed. It refuses otherwise: running it twice gave "needs a fresh seed first (found 13 owner deals)".
- adds, relative to the **Asia/Jakarta calendar date at apply time**, five invoices, each on its own `INVOICE` deal:
  - `e2e-t0-invoice-overdue-stored`: stored **OVERDUE**, due −5 days. This is the state whose only status action is **Tandai lunas**.
  - `…-overdue-sent`: stored **SENT**, due −1 day, overdue by derivation only. Its actions still follow SENT.
  - `…-due-today`: due 0 days.
  - `…-due-window-edge`: due +7 days, the last day of `DUE_SOON_WINDOW_DAYS`.
  - `…-due-outside-window`: due +8 days.
  - None has an `InvoiceShare` row.
- adds one `NEGO` deal `…-deal-invalid-contact` with `contactWa` `12345678`. The API accepts that (zod min 6) and stores it as typed, but `normalizeWhatsAppNumber` rejects it (fewer than 9 digits), so a person can reach this state by typing a short number.
- is removed by the next `seed`, because the rows hang off the fixture owner and `cleanupRows()` cascades. Every overlay spec reseeds in `afterEach`.
- **Stored vs derived (checked first):** `deriveInvoiceDisplayStatus` shows OVERDUE for any non-DRAFT/PAID invoice with a past Jakarta due date, but `NEXT_ACTIONS` keys off the **stored** status. Hence the two explicitly named overdue rows.

## 3. Action by action (before → after)

| Action | Pri | Before | After | Test(s) and projects | What the test proves |
|---|---|---|---|---|---|
| HOME-02 | P1 | partial (ux-audit render) | **real** — chromium, chromium-mobile | `home/follow-up-queue.spec.ts` "lists overdue and due-soon invoices with their reasons in order, and keeps them after reload" | Arrives via `/invoice` and the primary nav **Beranda**. "Perlu dikejar" has exactly 4 rows in order: due −1 "Telat 1 hari", due −5 "Telat 5 hari", "Jatuh tempo hari ini", "Jatuh tempo 7 hari lagi". Each row shows its formatted due date, the exact `Rp 9.000.000`-style amount and a **Kirim pengingat** button. The +8-day invoice, the base 2099 SENT invoice and the PAID invoice are absent, and the empty state is absent. Clicking the first row opens that invoice with chip **Terlambat**, "Jatuh tempo: <date>" and **Kirim pengingat**. Browser back and a reload show the same queue. Expected dates come from an independent month table, not the app's formatter. If a run straddles Jakarta midnight, the test fails with an explicit message instead of a label mismatch. |
| HOME-03 | P1 | partial (component test) | **partial** (held by FIND-04) | same file: hand-off test (listed `partial`, see note), stubbed-blocker fallback (`partial`), FIND-04 `expected_failure` | **Real interaction in both projects:** clicking the row's visible **Kirim pengingat** sends POST `/share` (2xx) and opens a real popup to `https://wa.me/628110000008?text=…`. A local route stub answers it, so nothing reaches WhatsApp. The message is exactly the overdue wording, with invoice number, amount, due date and `<origin>/i/<token>`. No alert. After navigating and **reloading**, invoice detail shows that same link (boolean compare), and a session-less recipient context opens it and sees E2E/OVERDUE/003 and Rp 8.000.000. **It is not claimed as real:** the validator forbids a real claim on an action that carries an expected failure, and FIND-04 (a spurious fallback link after the popup opened) is pinned by one. Removing `test.fail()` after a fix flips it. The blocked-popup alternate stubs `window.open → null` and is partial. Inventory text corrected: the queue uses a fixed message (`buildWhatsAppReminderMessage`), **not** the Settings chase template, and POST `/share` always rotates the token (FIND-05). |
| INV-STATUS-06 | P1 | not covered | **real** — chromium, chromium-mobile | `invoices/overdue-invoice.spec.ts` "an overdue invoice sends the chase reminder, then Tandai lunas persists across detail, list and Beranda" | Beranda → nav **Invoice** → the invoice under the list's **Terlambat** group → detail: amount heading, chip **Terlambat**, due line, **Kirim pengingat** enabled, no "Kirim lewat WhatsApp", **Tandai lunas** present, no "Tandai jatuh tempo". The reminder popup (stubbed locally) carries exactly the **default Settings chase template** ("Halo <brand>, izin mengingatkan … Mohon dibantu prosesnya ya. Detail: <link> …"). **Tandai lunas** sends a PATCH (2xx) and shows the "Lunas — invoice ini sudah selesai." status. Chip **Lunas ✓**, **Batalkan status lunas**, and neither Tandai lunas nor Kirim pengingat, both before and **after reload**. Nav **Invoice**: the brand appears exactly once, under **Lunas**. Nav **Beranda**: gone from the queue while other rows remain. FIND-01 is untouched. |
| DEAL-DETAIL-03 | P1 | not covered | **real** — chromium, chromium-mobile | `deals/contact-repair.spec.ts` "an invalid number opens the repair form; the repaired number is saved, survives reload, and is used by Buka WhatsApp" | Board card menu → **Lihat detail**. The contact shows `+123-456-78`. **Buka WhatsApp** opens **no** popup (counted) and shows the "Nomor WhatsApp belum valid" alert, with the **Perbaiki nomor WhatsApp** field focused and holding the stored value. The test types `0812-3456-7890` and clicks **Simpan nomor** (PATCH 2xx): "Nomor WhatsApp disimpan", the contact shows `+62 812-3456-7890`, the form is gone and still no popup. **Reload**: the same number with no alert. The next **Buka WhatsApp** opens exactly `https://wa.me/6281234567890` (stubbed locally). No external contact. |
| INV-WA-02 | P1 | real | **partial** (reclassified) | `invoice-journeys.spec.ts` blocked-popup test (`partial`), FIND-04 `expected_failure` on invoice detail | The test stubs `window.open`, which the inventory's own rules call partial. FIND-04 also shows the fallback appears whether or not the popup was blocked, so the test cannot prove blocked-popup detection. **This lowers the real count by one; please review.** |

## 4. Coverage (generated, `npm run coverage:journeys`)

| Metric | Before (`e83cf1a`) | After (this branch) |
|---|---|---|
| Real interaction | 52/94 = 55.3% | **54/94 = 57.4%** |
| P0 real | 28/30 = 93.3% | 28/30 = 93.3% |
| P1 real | 22/38 | **24/38** |
| P2 real | 2/26 | 2/26 |
| Outstanding P0/P1 | 17 | **15** |
| Real action × project pairs | 90 (chromium 43, chromium-mobile 41, 6 ux-audit/manual) | **94** (chromium 45, chromium-mobile 43) |
| Real claims verified by an actual run (`--require-results`, full E2E + ux-audit) | 88 (Phase 1) | **92/92, 0 not exercised** |

Net: +HOME-02, +INV-STATUS-06, +DEAL-DETAIL-03, −INV-WA-02. Remaining outstanding P0/P1: INV-DUE-03 (manual pending), A11Y-01, AUTH-02, DEAL-CREATE-06, DEAL-CREATE-07, HOME-01, HOME-03 (FIND-04), INV-DUE-05, INV-DUE-06, INV-PDF-01, INV-STATUS-05 (blocked, FIND-01), INV-WA-02 (FIND-04), PUB-05, PUB-06, SET-04.

## 5. Findings (product code not changed)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| FIND-04 | medium | Blocked-popup detection never works. Invoice detail (`sendWhatsApp`) and the Beranda queue (`openReminder`) call `window.open(href, "_blank", "noopener,noreferrer")` and treat `null` as blocked, but the HTML spec makes `window.open()` return `null` whenever `noopener` is set. So after WhatsApp opens, a **Buka WhatsApp** fallback still appears (a second tap opens a second chat), and a real block is indistinguishable. | Expected-failure tests on Beranda and invoice detail fail at exactly "fallback link count 0, received 1" after a real popup, in chromium, chromium-mobile, firefox and webkit. |
| FIND-05 | medium | Beranda **Kirim pengingat** always rotates the share token (POST `/share` → `createOrRegenerateShare`), while invoice detail reuses the active link. A link the brand already received then returns 404. | Temporary probe (deleted): created a link on detail, then a reminder from Beranda gave `sameLink=false oldStatus=404 oldShowsInvoice=false newStatus=200`. No test asserts either behaviour (product decision). |
| FIND-06 | low | The invoice list groups and labels by **stored** status; Beranda and detail derive OVERDUE. A SENT invoice due yesterday shows "Telat 1 hari" and **Terlambat** elsewhere, but **Terkirim / TERKIRIM** in the list. | Temporary probe: `listGroup=["Terkirim"]`, list row chip TERKIRIM; HOME-02 asserts **Terlambat** on detail. Related to FIND-01. No test asserts the list's grouping. |

Also observed: when the server silently ignores a `contactWa` change, deal detail still says "Nomor WhatsApp disimpan", because its read-back compares two equally stale values. This came up only under an artificial mutation (§6), so it is not filed as a finding.

## 6. Negative controls (applied together in one build, then reverted)

| Mutation (temporary) | Test | Failed at |
|---|---|---|
| `DUE_SOON_WINDOW_DAYS` 7 → 6 | HOME-02 | row count: expected 4, received 3 |
| Queue reminder always `kind: "due-soon"` | HOME-03 hand-off and fallback tests | the message regex (got "jatuh tempo pada …") and `toContain("sudah melewati jatuh tempo")` |
| Invoice PATCH returns PAID but writes OVERDUE back | INV-STATUS-06 | line 99, the **post-reload** `expectPaidDetail()` (the in-session check passed) |
| `toPatchData` drops `contactWa` | DEAL-DETAIL-03 | the contact text right after save (`+123-456-78`) |
| …plus the client optimistically showing the new number | DEAL-DETAIL-03 | line 65, right **after `page.reload()`** |

The FIND-04 expected-failure tests still failed only on the fallback assertion. After `git checkout -- src` the `src` diff vs `origin/staging` was empty, with 0 `NC-TEMP` markers; `e2e:build` was re-run, and the new specs passed 14/14.

## 7. Intermittent due-date `fill()` failure (Section C): root cause found and fixed

- **Reproduced on demand.** With CDP `Emulation.setCPUThrottlingRate` at 20× and 50×, a temporary probe failed **6/6** with `patch=none value=2099-12-31`, exactly the Phase 1 failure snapshot. The same probe waiting for **Kirim lewat WhatsApp** to be enabled passed **6/6**. Delaying JS chunks alone did *not* reproduce it, because `goto` waits for `load`.
- **Cause.** `fill()` lands on the server-rendered input before React hydrates; hydration restores the controlled value and no PATCH is sent.
- **Fix** (`5d3c7ca`, test-only). Before `fill()`, wait for **Kirim lewat WhatsApp** to be enabled. It is server-rendered disabled and enabled only by client effects (contact and share fetches). There is no sleep, no retry, no assertion change, and no reclassification: it remains a `partial` reference.
- **Proof.** In the real test at 20× throttle it passed **5/5** with the fix and failed **3/3** with the wait removed (PATCH timeout). Unthrottled ×10: 10/10. The file was restored to fix-only (+10 lines).

## 8. Local validation (all on this worktree; nothing else running concurrently)

| Gate | Result |
|---|---|
| `npm run lint` / `npm run typecheck` | 0 / 0 |
| `npm test` (Vitest) | 893/893 |
| `npm run build` (default Turbopack) / `npm run e2e:build` | 0 / 0 |
| `npm run test:journey-coverage` / `npm run coverage:journeys` | pass / OK |
| `npm run test:diagnostics-selftest` | 1/1 |
| `npm run test:e2e` (full non-visual, chromium + chromium-mobile) on `903dc4b` | 145 expected (141 passed + 4 FIND-04 expected failures), **0 unexpected, 0 flaky**, 23 skipped (pre-existing project skips) |
| Same, final test head `b9b553f` | **145 expected, 0 unexpected, 0 flaky, 23 skipped**; `--require-results` with the ux-audit results: **92/92 real claims passed, 0 not exercised** |
| `npm run test:e2e:critical` | 133 expected, 0 unexpected, 0 flaky, 23 skipped; `--results`: 87 real claims passed, 5 not exercised (4 ux-audit, A11Y-02) |
| `npm run test:e2e:a11y` | 12 passed, 1 skipped |
| `npm run ux:audit` | ux-audit specs **69/69**; functional, responsive and state PASS. `@visual` 9/9 fail **locally** (below), so overall FAIL locally. |
| `coverage:journeys -- --results <full e2e> --results <ux-audit> --require-results` | **92 real claims passed, 0 not exercised** |
| Order/repeat: new specs + `filter-navigation` + `add-deal-dialog` + `session` at `--repeat-each=2` | default order 96/0 (12 skipped); CLI-reversed 96/0 (Playwright still ran chromium first); **truly reversed** via a temporary config with the project array reversed (deleted) 96/0, chromium-mobile first. 0 flaky. |

**`@visual` locally.** 9/9 fail on this branch. The clean-staging tree (Phase 1 worktree `49f86eb`, tree-identical to `e83cf1a`) fails **with identical diff pixel counts** on this host: Beranda desktop 17557, Beranda mobile 15200, Deals 13708, Deals/Invoice 10584, Add Deal 13943, Invoice list 9743, Invoice detail 27355, Pengaturan 39880 (1997 vs 1996px), Beranda true mobile 12367. That is host font drift, as in PR #25 and Phase 1. The overlay is opt-in, so the base state the baselines capture is unchanged. No baseline was touched; CI's renderer decides (§10).

## 9. Firefox / WebKit (targeted, not claimed)

The new specs and `invoice-journeys.spec.ts` ran on `firefox` and `webkit`. The first run exposed a **test** race: HOME-03 reloaded while the client navigation's chunks and RSC, then the page's contact/share fetches, were in flight, and Firefox/WebKit report those as failed requests. `b9b553f` waits for the amount heading and an enabled **Kirim pengingat**. After that, all four projects ran the new specs ×2 and gave **56/56 as expected** (40 passed + 16 FIND-04 expected failures), 0 flaky. FIND-04 reproduces in every engine. Scope stays `chromium` + `chromium-mobile`: the PR gate runs only those, and Firefox/WebKit join through the scheduled `e2e-cross-browser` lane. Nothing is claimed from emulation as physical-device evidence.

## 10. PR and CI

- **PR:** https://github.com/crh/dibayar/pull/28 (`chore/zero-routine-regression-phase2a-2026-10-04` → `staging`), open, **not merged**.
- **CI run `37205285661`** on head `6f839b6c2425b6839affcbd308a4e0b40030a87e`: **success**.
  - `lint-typecheck-test`: success.
  - `e2e-critical`: success, 133 passed, 23 skipped; `coverage:journeys --results` = 87 real claims passed, 5 not exercised by the @critical run (4 ux-audit, A11Y-02), the same split as local.
  - `e2e-a11y`: success, 12 passed, 1 skipped.
  - `ux-audit`: success, specs 69/69; **`@visual` 9/9 passed under CI's renderer**, overall PASS, 0 findings. That confirms the local failures were host drift.
  - `e2e-cross-browser`: skipped by design (scheduled lane).
- This receipt's own follow-up commit is docs-only; its CI run is recorded in the PR conversation, not here.
- **Review threads:** none at the time of writing (0 threads, 0 reviews).
- **No Preview or hosted DB:** the head SHA has no commit statuses and 0 GitHub deployments (by SHA and by branch), so Vercel did not deploy this ordinary `chore/*` branch. No Neon branch was created by this work; Neon itself was not inspected (no access, Chris-only).

## 11. Residual risks and limits

- HOME-03 and INV-WA-02 stay partial until FIND-04 is fixed in a separate `fix/*` PR. FIND-05 and FIND-06 need Chris's product decisions, as does FIND-01 (untouched).
- The overlay's dates are relative to the run's Jakarta day. A run straddling Jakarta midnight fails with an explicit message (not silently); the window is about 10 s per test.
- The older `invoice-journeys.spec.ts` WhatsApp test still lets its popup load the real `wa.me` redirect. It sends nothing, but it is not hermetic; the new specs stub WhatsApp locally.
- Still manual or device-only: MAN-DUE-01 (native pickers), MAN-WA-01 (WhatsApp app hand-off, now noting FIND-04), MAN-PDF-01, MAN-SHARE-01, AUTH-03.
- Deferred to Batch 2B (separate PR, not started): INV-PDF-01, PUB-05, PUB-06, DEAL-CREATE-06/07, SET-04, HOME-01, A11Y-01, AUTH-02, SHARE-04, INV-DUE-05, and the full-results CI lane. No PDF dependency or CI change was made.

## 12. Final state

- Branch `chore/zero-routine-regression-phase2a-2026-10-04`; last CI-verified code head `6f839b6` (§10), followed only by this docs commit. The PR into `staging` is review-ready and **not merged**; merging needs Chris.
- No Preview, Neon branch, hosted DB, `main`, Production, OAuth or repository-setting change.
- Local disposable DB: fixtures cleaned up by global teardown after the last run.
