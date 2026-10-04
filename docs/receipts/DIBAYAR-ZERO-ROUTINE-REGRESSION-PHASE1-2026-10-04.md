# Receipt — Zero Routine Manual Regression Testing, Phase 1 (journey Batch 1), 2026-10-04

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **PR #27 is open and not merged.** Nothing was deployed or released. No Production, hosted-staging or Neon database was read or written. No Vercel, Neon or OAuth setting was changed, and no visual baseline was updated. All database work used the disposable local `localhost:55432/dibayar_test` (the fixture guard normalises it to `127.0.0.1`). I checked host, port and database before any run, and no credential was printed. The fixture scripts' own guards are unchanged.

## 1. Starting state (verified live)

- `git fetch`: `origin/staging` = `a11b8a4d701d8f7c2348cbec19d6aa31bb036510` (PR #25 merge, on top of PR #26 `b51fba1`). `origin/main` = `308a339`.
- Open PRs: none. No remote or local branch overlapped this batch (searched for journey/regression/batch/zero branches; only the merged PR #25 branch exists). No one else had implemented any Batch 1 action.
- Main checkout (`/home/kenji/code/dibayar`, on the merged PR #25 branch) has three untracked items owned by others: two 2026-10-01 receipts and `src/generated/`. They were not touched. The work happened in a new worktree, `/home/kenji/code/dibayar-zero-routine-phase1`, on `chore/zero-routine-regression-phase1-2026-10-04` from `origin/staging` `a11b8a4`. `.env.local` was copied in (it is gitignored, and its contents were not printed).
- The inventory baseline (`npm run coverage:journeys` on `a11b8a4`) matched the brief's snapshot exactly: 95 actions, 94 applicable, real 46/94 = 48.9%, P0 27/30 = 90.0%, 23 outstanding P0/P1.

## 2. What changed

| Commit | Content |
|---|---|
| `d6d5305` | 6 new specs and 1 helper (`e2e/support/nav.ts`, the visible primary nav for any viewport). Test-only. |
| `849045a` | Inventory, generated `JOURNEY-COVERAGE.md`, `JOURNEY-GRAPHS.md`, `JOURNEY-BACKLOG.md`, `E2E.md`, `MANUAL-UAT.md`, `STATE.md` |
| (follow-up commit) | Review fixes (`bank-details.spec.ts` device emulation; SET-03 narrowed, PDF requirement moved to INV-PDF-01), this receipt, `DAILY_LOG.md` |

`git diff origin/staging -- src prisma scripts public next.config.ts package.json package-lock.json e2e/visual e2e/support/test.ts e2e/support/reseed.ts e2e/global-setup.ts playwright.e2e.config.ts playwright.config.ts tests .github` is **empty**. No application, fixture, manifest, config, CI or dependency change, and no snapshot was touched.

## 3. Action by action (before → after)

| Action | Pri | Before | After | Real test(s) and claimed projects | What the test proves |
|---|---|---|---|---|---|
| DEAL-CREATE-01 | P0 | partial (`goto(/deal?tambah=1)`) | **real** | `deals/desktop-create-entry.spec.ts` "clicking the top-bar + Deal from Beranda creates a deal…" — chromium | Starts on Beranda and clicks the visible top-bar **+ Deal**. It fills brand, WhatsApp, contact name, scope, fee (and sees the live `≈ Rp 4.750.000` preview) and payment terms, then saves (POST 2xx, "Deal disimpan"). After a **reload** the card is on the board. Card menu → **Lihat detail** shows the brand heading, stage Masuk, fee (exact `Rp 4.750.000` characters), scope, terms, contact name, `+62 817-7000-010` and the creation history entry. The deadline is a native picker and stays MAN-DEAL-01. The old URL test stays as a `partial` reference, and NAV-03 is not re-credited. |
| DEAL-STAGE-02 | P1 | not covered | **real** | `deals/stage-back.spec.ts`, two tests — chromium, chromium-mobile | **Detail path:** Deal fixture, reached via card menu → **Kembali ke Nego** (PATCH 2xx). The next buttons become "Kembali ke Masuk" / "Lanjut ke Deal". After a reload the stage is still Nego, the history shows "Deal → Nego" with the original entry, and the board's Nego/Deal filters agree. **Card-menu path:** Konten fixture → **Kembali ke Deal**. The card leaves the Konten column and appears under Deal, also after a reload, and the detail history shows "Konten → Deal". |
| DEAL-DETAIL-01 | P1 | real (chromium-mobile) | real (**chromium + chromium-mobile**) | `stage-back.spec.ts` detail test | Card menu → **Lihat detail** in both projects. It checks the URL, brand, stage, seeded fee `Rp 3.000.000` and scope. |
| NAV-02 | P1 | not covered | **real** | `smoke/desktop-nav.spec.ts`, two tests — chromium | The SideNav at 1280px and the TopBar inline nav at 800px (a viewport override inside the chromium project). Each link is clicked: Deal → Invoice → Pengaturan → Beranda. Each click checks the route, that section's own content (the Beranda check is its "Net ditagihkan bulan ini" heading, not top-bar chrome), `aria-current` on exactly one item, and that the other variant is hidden. |
| SET-06 | P1 | partial (`page.evaluate` fetch) | **real** | `settings/language.spec.ts` — chromium, chromium-mobile | Clicks **English** (PATCH `/api/me/language` 2xx, `<html lang="en">`) and reloads: English stays pressed, and the "Payment account" and "Save settings" labels show. The English nav leads to **Invoices** → invoice detail, which shows "Due date". **Clear** gives "Due: Not set", which survives a reload. The nav then leads to **Settings** → **Indonesia**, and after a reload Indonesian is pressed and the invoice shows "Jatuh tempo: Belum ditentukan". Reseeds in `beforeEach` and `afterEach`, so a mid-test failure can't leave the shared owner in English. This is one targeted language pair, not a matrix. |
| SET-03 | P1 | not covered | **real** | `settings/bank-details.spec.ts`, two tests — chromium, chromium-mobile | Goes to Pengaturan through the nav, fills the three bank fields with synthetic values, saves (PATCH 2xx, "Tersimpan") and reloads, and the values persist. The nav then leads to Invoice → the invoice, and the share link is taken from the field. A **separate context with no session**, but with the project's own device emulation (390px, touch and mobile UA in `chromium-mobile`, which the test asserts), opens it. The recipient's **Pembayaran ke** block shows the new bank, number and holder, and the page has no horizontal overflow. The old bank name is gone and there is no "incomplete" alert. **Alternate:** emptying "Nomor rekening" gives the "Wajib diisi." field error and `aria-invalid`, sends **no** PATCH, and the seeded values come back after a reload. Reseeds before and after. **The PDF is not checked.** react-pdf output is compressed, and `pdftotext` is installed only in CI's `ux-audit` job, not in `e2e-critical`. After review (§9), SET-03 was narrowed to what is proven: persistence plus the recipient page. The requirement that edited bank details appear in the PDF moved to **INV-PDF-01**, which stays partial and outstanding. The owner's own invoice page does not render bank details at all. |
| SHARE-05 | P1 | partial (component test) | **real** | `invoices/share-copy.spec.ts` "Salin copies the exact public invoice link…" — chromium (+ `manual: phones`) | Goes through the invoice list to the invoice. `clipboard-read`/`clipboard-write` are granted **only to this test's context, for the app origin only**, and the clipboard is primed with a sentinel first. The test clicks the visible **Salin** (accessible name "Salin tautan invoice"). The button reads **Tersalin**. The system clipboard, read back, must equal `<page origin>/i/<seeded active token>` and the field's own link. The comparison is a boolean, so a failure never prints the token, and the origin comes from the page, not a hard-coded port. The feedback reverts to "Salin". **Alternate** (`partial`): `writeText` is stubbed to reject, a real click shows the alert and a manual-copy field with the exact link. MAN-SHARE-01 (phones) is unchanged. |
| HOME-03 | P1 | partial | partial (**deferred to Batch 2**) | — | The current seed's only unpaid invoice is due 2099-12-31, and the other is PAID, so `selectAttentionInvoices` returns nothing and the follow-up queue has no **Kirim pengingat**. Exercising it would need a fixture-topology change, which is out of scope here. Note: the backlog already listed HOME-03 under Batch 2, and only the inventory's `followUp` said "Batch 1". That is now reconciled. |

Documentation correction found while testing: the inventory's SHARE-05 `expected` and MAN-SHARE-01 described a **"Tautan disalin."** toast. The live UI (`share-link-field.tsx`) changes the button text to **"Tersalin"**, and the `invoice.copySuccess` string is not rendered anywhere. Both docs now describe what the product does. No product code changed.

## 4. Coverage (generated, `npm run coverage:journeys`)

| Metric | Before (`a11b8a4`) | After (this branch) |
|---|---|---|
| Actions / applicable | 95 / 94 | 95 / 94 |
| Real interaction, all | 46/94 = **48.9%** | 52/94 = **55.3%** |
| P0 real | 27/30 = 90.0% | **28/30 = 93.3%** |
| P1 real | 17/38 | **22/38** |
| P2 real | 2/26 | 2/26 |
| Outstanding P0/P1 | **23** (P0 2, P1 21) | **17** (P0 1, P1 16) |
| Real claims (action × project) verified against actual runs | 78 | **88** |

**P0s not automated:** **INV-DUE-03** means choosing a date in the native picker, then save and reload. It is `manual_pending` (MAN-DUE-01). The emulated 390px project is not physical-device proof, so it is not claimed. **AUTH-03** is the real Google OAuth round trip. It is `manual_verified` (staging 2026-09-30) and must be re-run per release. Neither is implied covered.

Outstanding P1 (16): AUTH-02, HOME-01, HOME-02, HOME-03, DEAL-CREATE-06, DEAL-CREATE-07, DEAL-DETAIL-03, INV-DUE-05, INV-DUE-06, INV-STATUS-05 (blocked, FIND-01), INV-STATUS-06, INV-PDF-01, PUB-05, PUB-06, SET-04, A11Y-01.

## 5. Validator safeguards (preserved, re-proved)

- Negative control on the real inventory: adding `chromium-mobile` to DEAL-CREATE-01, SHARE-05 and NAV-02 was rejected for all three ("no real test runs as a pass in chromium-mobile … skipped"). This shows the AST evaluates the new `isMobile` / `browserName` skip conditions. The file was then restored.
- **Validator behaviour worth knowing (not changed here):** I first claimed DEAL-DETAIL-01 in both projects with one real reference per project (the desktop create test and the mobile FAB test). The **static** check accepted that, because each project had a runnable real test. The **run-results** check rejected it, because a real reference that *ran but was skipped* in a claimed project is an error even when another reference passed there. I fixed the inventory instead of the engine: DEAL-DETAIL-01's single real reference is now the stage-back detail test, which runs in both projects, and the create journeys are named in `evidence`. A future engine change could align the static and run-results rules. That is out of this PR's scope.

## 6. Negative controls (P0 desktop deal entry)

Run on a disposable local build. Each mutation was reverted with `git checkout`, then `git diff --quiet -- src` was confirmed empty and the app rebuilt.

| Mutation in `src/components/layout/top-bar.tsx` | Result of the new DEAL-CREATE-01 test |
|---|---|
| `pointer-events-none` on the top-bar **+ Deal** link (visible but untappable) | **Failed**, as expected: `locator.click` timeout, "`<div …>` intercepts pointer events" |
| `href="/deal"` instead of `/deal?tambah=1` (the historical "+ Deal does nothing" bug) | **Failed**, as expected: `getByRole('dialog', { name: 'Tambah deal' })` not found |
| Reverted, rebuilt | Passed |

## 7. Local validation (`849045a`, plus the review-fix tree for the rows marked; nothing run concurrently)

| Command | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings (274 files) |
| `npm run typecheck` | 0 |
| `npm test` | 82 files, **893/893** |
| `npm run build` (Turbopack) | 0 |
| `npm run test:journey-coverage` | 24/24 |
| `npm run coverage:journeys` | OK (55.3%, P0 93.3%, 17 outstanding) |
| `npm run test:diagnostics-selftest` | 1/1 |
| New specs, both projects, plus `--repeat-each=2` run separately as mobile-first then desktop | 10 passed + 10 intended skips (mobile); 20/20 (desktop) |
| `npm run test:e2e` (full non-visual) | **131 passed, 0 failed, 23 skipped** (was 116/0/18). Three times, identical, the last after the review fix (§9) |
| `npm run test:e2e:critical` | **119 passed, 0 failed, 23 skipped** |
| `coverage:journeys -- --results test-results/e2e/results.json` (as CI) | OK: 83 real claims passed; 5 not exercised (NAV-06, DEAL-STAGE-04, DEAL-STAGE-05, INV-WA-03 [ux-audit]; A11Y-02 [chromium]); the same non-@critical set as before |
| `coverage:journeys -- --results <full e2e> --results test-results/ux-audit/results.json --require-results` | **OK: 88 real claims passed, 0 not exercised**, on `849045a` and again on the review-fix tree |
| `npm run ux:audit` | `tests/ux-audit` **69/69**; functional, responsive and state-data PASS; `@visual` 9/9 differ, so exit FAIL (§8) |
| `npm run test:e2e:a11y` | 12 passed, 0 failed, 1 skipped |
| Firefox + WebKit, new specs only | 16 passed, 4 skipped (`share-copy` is Chromium-only by design). Informational; **not claimed** |

**Skips:** all 23 in the full run are intended viewport/browser scope (5 new: DEAL-CREATE-01, the two NAV-02 tests and the two SHARE-05 tests in chromium-mobile; 18 pre-existing). **Expected failures:** 0. There is no `test.fail(` or `.fixme(` in `e2e/` or `tests/ux-audit/`. Retries: 0.

**One intermittent failure, pre-existing and not caused by this branch:** in the *first* `test:e2e:critical` run, `invoices/invoice-journeys.spec.ts` "due date edits and clears persist after reload" [chromium] timed out waiting for its PATCH. The failure snapshot shows the input still at `2099-12-31`: `fill()` did not take, which fits a fill before React hydration. Across this session it ran 12 times and failed once: 2 full runs, 2 critical runs and 8 repeats. The 8 repeats overlapped the `tests/ux-audit` stage of `ux:audit` (a different port and fixture users). This branch does not touch that test or the date field. It is only a `partial` reference, for server persistence via `fill()` on a picker. Not fixed here; noted for Phase 2.

**Test-hygiene note (not changed):** `e2e/deals/mobile-create-entry.spec.ts`'s `NBSP` constant is a plain space (0x20), not U+00A0. `getByText` normalises whitespace, so that test can't detect a lost non-breaking space after "Rp". The new specs use `" "`, and DEAL-CREATE-01 checks the exact characters once.

## 8. `@visual` locally

The 9/9 `@visual` diffs are the same set PR #25 recorded as host renderer drift and reproduced on clean staging. 8 have the same dimensions, with 0.02–0.05 of pixels differing. "Pengaturan main state" is 1997→1996px tall. Its diff image shows glyph-level shifts across every text run with **identical content** (seeded `Bank E2E Fixture`, `1234509876`, language "Indonesia"). That rules out leftover state from the new settings tests, and the 1px comes from cumulative line-height rounding. This branch has no app, fixture or visual-test diff. CI's renderer is authoritative (§9). No baseline was regenerated.

## 9. CI (PR #27)

Run [`37195759733`](https://github.com/crh/dibayar/actions/runs/37195759733) on head `849045a`: **success**.

| Job | Result |
|---|---|
| lint-typecheck-test | success; `coverage:journeys` OK (55.3%, P0 93.3%, 17 outstanding) |
| e2e-critical | success; 118 passed. The `--results` check: **83 real claims passed**, 5 not exercised (the same non-@critical set as locally) |
| ux-audit | success; `tests/ux-audit` 69 passed, **`@visual` 9 passed under CI's renderer**, `overallStatus: PASS`, 0 findings. This confirms §8 is local drift |
| e2e-a11y | success; 12 passed |
| e2e-cross-browser | skipped (by design on PRs) |

**Review (Codex, on `849045a`): two P2 comments, both accepted.**
1. *The recipient context in `bank-details.spec.ts` did not inherit mobile emulation.* That was correct: `browser.newContext()` uses desktop defaults, so SET-03's `chromium-mobile` claim checked the recipient page at 1280px. Fixed: the context now gets the project's `viewport`, `isMobile`, `hasTouch`, `userAgent`, `locale` and `timezoneId`. The test asserts the viewport and touch support, and adds a no-horizontal-overflow check.
2. *SET-03 said "invoice/PDF" but only the HTML page is checked.* Also correct. SET-03 is narrowed to persistence plus the recipient page, which is what the backlog's Batch 1 line and the brief asked for. The PDF requirement moved to INV-PDF-01's `expected`/`followUp`, which is still `automated_partial` and in the outstanding list. Metrics are unchanged.

The latest head's CI result is recorded in the PR conversation after the push.

## 10. Residual risks (still open, not implied covered)

- **FIND-01 / INV-STATUS-05:** "Tandai terlambat" displays as Terkirim. Blocked on Chris's product decision; untouched.
- **MAN-DUE-01 / INV-DUE-03:** native date selection on a real Android Chrome phone and a real iPhone Safari. Emulation is not device proof.
- Real Google OAuth (AUTH-03 / MAN-AUTH-01), WhatsApp hand-off (MAN-WA-01), PDF open/save on devices (MAN-PDF-01), copy on phones (MAN-SHARE-01): manual.
- The PR #26 follow-up is still open: the read-only Production count of out-of-range `Invoice.dueDate` / `Deal.deadline` (Chris only), plus legacy out-of-range rendering outside the owner page and Deal `deadline` validation.
- SET-06's rate-limited (429) alternate and SET-03's PDF rendering are not exercised in a browser.
- The pre-existing intermittent due-date `fill()` test (§7).
- **This is not release readiness, and routine manual regression is not eliminated.** No CI coverage threshold was added.

## 11. Proposed Phase 2 (next steps only; not implemented)

1. **Batch 2 fixture work** in `scripts/e2e-fixtures.ts`. Add one overdue SENT invoice and one deal with an invalid WhatsApp number. Keep `e2e-t0-*` IDs and existing rows unchanged, and re-run `@visual` in CI. Then: INV-STATUS-06, HOME-03 (real popup plus blocked fallback), DEAL-DETAIL-03, INV-PDF-01 / PUB-05 (`download` event; parse the text with the existing `pdftotext` the ux-audit job already installs, which would also close SET-03's PDF half), DEAL-CREATE-06/07, SET-04, HOME-01, A11Y-01, AUTH-02.
2. **Full-run results lane:** a scheduled or pre-release `test:e2e` plus `ux:audit` job that feeds `coverage:journeys -- --results … --require-results`, so the non-@critical claims are verified in CI and not just locally. Today every new Batch 1 test is `@critical`, so all of them are verified on every PR.
3. **Flake hardening:** a hydration-safe wait for the `fill()`-based due-date persistence test (§7).
4. **Validator consistency:** decide (with review) whether the static and run-results checks should agree on per-project real references (§5).
5. Still Chris's decisions: FIND-01, the device-automation strategy, and any coverage-threshold policy.

## 12. Final state

- Branch `chore/zero-routine-regression-phase1-2026-10-04`, pushed; PR #27 into `staging`, **open, not merged**.
- Worktree `/home/kenji/code/dibayar-zero-routine-phase1`. Before this receipt commit it was clean apart from ignored build and test output (`.next`, `test-results/`, `playwright-report/`, `artifacts/`) and the ignored `.env.local`. The main checkout's untracked files were left as they were.
- The local DB fixtures were left seeded by the last run's global teardown, on the disposable target only.
- Untouched: `main`, Production, hosted staging and Neon databases, Vercel and Neon settings, OAuth console, secrets, repository visibility, other people's branches. No merge happened, and no `preview/*` branch was created.
