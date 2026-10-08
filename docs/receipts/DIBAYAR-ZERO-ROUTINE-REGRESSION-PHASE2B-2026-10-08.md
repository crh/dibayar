# Receipt — Zero Routine Manual Regression Testing, Phase 2B (journey Batch 2B), 2026-10-08

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **PR #32 into `staging` is open and not merged.** Nothing was deployed or released. `main` and Production were not touched. No Production, hosted-staging or Neon database was read or written; no Vercel, Neon, OAuth or repository setting was changed; no `preview/*` or Neon branch was created; no visual baseline was updated; no schema migration was needed. All database work used the disposable local `127.0.0.1:55432/dibayar_test`. **No application code (`src/`) changed.**

## 1. Start gate (verified live, 2026-10-08)

- PR #31 MERGED at 2026-10-08T06:54:55Z as `979c3ec`, an ancestor of `origin/staging` (= `979c3ec`).
- **Squash merge confirmed:** `979c3ec` has one parent (`e498ad5`). `src/generated/prisma.root-owned-bak-20260920160728` is in neither the tree nor the history of `origin/staging`, and the commit that added it (`46d0cea`) is not reachable from `staging`.
- No open PRs; no branch for Batch 2B.
- Live coverage before any change: 95 actions / 94 applicable, real 56/94 = 59.6%, P0 28/30 = 93.3%, 13 outstanding P0/P1. Matches the brief.
- Branch `chore/zero-routine-regression-phase2b-2026-10-08` from `origin/staging` `979c3ec`, in the main checkout. Untracked items (including `compose.yml`) left as found.

## 2. Scope: completed and deferred

| Action | Pri | Before | After | Projects claimed | Where |
|---|---|---|---|---|---|
| INV-PDF-01 | P1 | partial | **real** | chromium, chromium-mobile | `e2e/invoices/pdf-download.spec.ts` |
| PUB-05 | P1 | partial | **real** | chromium, chromium-mobile | same |
| PUB-06 | P1 | partial | **real** | chromium, chromium-mobile | same |
| DEAL-CREATE-06 | P1 | not covered | **real** | chromium, chromium-mobile | `e2e/deals/create-validation.spec.ts` |
| DEAL-CREATE-07 | P1 | manual pending | **partial** | — | same |
| SET-04 | P1 | not covered | **real** | chromium, chromium-mobile | `e2e/settings/whatsapp-templates.spec.ts` |
| HOME-01 | P1 | partial | **real** | chromium, chromium-mobile | `e2e/home/monthly-income.spec.ts` |
| AUTH-02 | P1 | partial | **real** | chromium, chromium-mobile | `e2e/auth/sign-in-entry.spec.ts` |
| SHARE-04 | P2 | not covered | **real** | chromium, chromium-mobile | `e2e/invoices/share-cancel.spec.ts` |
| INV-DUE-05 | P1 | partial (unit) | **real** | chromium only | `e2e/invoices/due-date-consistency.spec.ts` |
| A11Y-01 | P1 | partial | partial | chromium | `e2e/smoke/accessibility.spec.ts` |
| INV-DUE-06 | P1 | partial | partial (assessed) | — | — |

Classification notes:

- **DEAL-CREATE-07 stays partial.** Contact name and payment terms are typed, saved, and read back on the detail page after reloads, on both projects. The action also includes picking a deadline in a native date picker, which no test drives, so the action as a whole is not real. MAN-DEAL-01 still covers the picker.
- **A11Y-01 stays partial** by rule (an axe scan is rendering evidence). Two scans added: invoice detail, and invoice detail with the regenerate confirmation open. The public page and add-deal dialog scans already existed and are now listed on the action.
- **INV-DUE-06 left partial.** The only way to make the save fail in a browser is to intercept the PATCH, which the rules class as a stub. No maintainable stub-free path exists without a server that fails on demand.
- **AUTH-02 is real** for what the action expects (the CTA leads to Auth.js's Google sign-in with `callbackUrl=/dashboard`): that part is unstubbed. The further check, that choosing Google redirects to Google's authorization endpoint with this app's callback, reads Auth.js's 302 without following it.
- **HOME-01** is "view a page", so its interaction is the navigation; the outcome is the exact amount. Classified like HOME-02 in Phase 2A.
- **INV-DUE-05** is claimed for desktop Chromium only, like INV-DUE-04: the date is typed with the keyboard, which a phone does not offer.

Not touched, as instructed: FIND-01, FIND-06, INV-DUE-03 on real devices, AUTH-03, any production-data task.

## 3. PDF extraction and parity design

- The owner and a session-less recipient each **click the visible Unduh PDF**. The file arrives through the browser's `download` event and is saved only under the test's output directory.
- Text is read with **`pdftotext -layout`** (poppler, the tool the ux-audit specs already use) through `e2e/support/pdf.ts`. Lines are whitespace-normalized, including the non-breaking space after "Rp".
- Content is checked against **literal expected lines** written in the spec: invoice number, issuer name/address/WhatsApp, brand, description and amount, total, tax, payment terms, due date, and the three bank fields.
- The owner **edits the bank details in Settings first**, so the PDF must show values that exist nowhere in the seed; the replaced values must be absent.
- **Parity (PUB-06):** the two extracted texts must be equal, line for line and in order. Not byte-for-byte, because PDF metadata differs per render. On mismatch the test reports only the differing lines.
- The helper also requires **`Content-Disposition: attachment`**. Headless Chromium has no PDF viewer and "downloads" an inline PDF too, which the first negative control exposed.
- The suggested filename (`E2E-SENT-001.pdf`) is asserted.
- A clicked download makes the browser report the navigation request as failed. The browser-health guard (`e2e/support/test.ts`) now drops that one report, and only when the same page really received a download for that exact URL. Its self-test still passes.
- CI: `poppler-utils` is installed in `e2e-critical` and `e2e-cross-browser` (the ux-audit job already had it). No npm dependency added.

## 4. Other journeys, briefly

- **DEAL-CREATE-06:** dialog opened from Beranda by the control each viewport shows (top bar, or the floating button). Empty submit: nothing sent, the first missing field focused, all four required fields invalid, dialog still open. Then one field at a time, then a successful save and exactly one card after reload. The validation bubble is browser chrome and not in the DOM, so the test checks focus and validity state instead.
- **SET-04:** both templates rewritten with every token in an order the defaults never use; saved, reloaded; then the whole message from a non-overdue invoice (send template) and an overdue one (reminder template) is matched.
- **HOME-01:** new opt-in fixture action `income-boundaries` adds a draft (Rp 50.000.000), an invoice created 1 ms before this Jakarta month (Rp 40.000.000), one at the month's first instant with PPh 23 (Rp 2.000.000, the only one counted), and one at the first instant of next month (Rp 30.000.000). Expected totals are computed in the spec from literals: Rp 12.700.000 on the base seed, Rp 14.660.000 with the overlay.
- **SHARE-04:** Batal on both confirmations; zero share requests; same link shown and still opening for a recipient, also after reload.
- **INV-DUE-05:** a date three Jakarta days ahead is typed on invoice detail, then read on the header, the field (also after reload), the list row, the Beranda row with "Jatuh tempo 3 hari lagi", and both WhatsApp messages. The journey runs in an **Asia/Jakarta** browser and in a **Pacific/Honolulu** browser (UTC-10, a calendar day behind Jakarta most of the day) to catch dates formatted or counted in the viewer's timezone. Both pass.

## 5. Coverage metrics

| | Before | After |
|---|---|---|
| Actions / applicable | 95 / 94 | 95 / 94 |
| Real interaction | 56/94 = 59.6% | **65/94 = 69.1%** |
| P0 real | 28/30 = 93.3% | 28/30 = 93.3% |
| Outstanding P0/P1 | 13 | **5** |
| Real claims verified by `--require-results` | 96 | **113**, 0 not exercised |

No action was added or removed. No threshold was introduced.

**Remaining outstanding P0/P1:**

| ID | Pri | Status | Why |
|---|---|---|---|
| INV-DUE-03 | P0 | manual pending | Choosing a date inside a native picker cannot be driven; needs real phones (MAN-DUE-01) |
| A11Y-01 | P1 | partial | By rule |
| DEAL-CREATE-07 | P1 | partial | Deadline picker (MAN-DEAL-01) |
| INV-DUE-06 | P1 | partial | Failure needs a stub |
| INV-STATUS-05 | P1 | blocked | FIND-01 decision |

(The second P0 not counted as real is AUTH-03, recorded as manually verified.)

## 6. Negative controls

One mutation of application code at a time, rebuilt, the matching spec run on chromium, reverted with `git checkout`.

| # | Mutation | Result |
|---|---|---|
| 1a | Owner PDF served `inline` | **First attempt passed** (headless Chromium still fired a download). Helper tightened to require `attachment`; rerun: both PDF tests fail on the header check |
| 1b | Owner Unduh PDF link points nowhere | Both PDF tests fail waiting for the download |
| 2 | `noValidate` on the deal form | DEAL-CREATE-06 fails at "Nama brand is focused"; the two optional-field tests pass |
| 3 | Invoice detail ignores the saved templates | SET-04 fails at the send-template match |
| 4 | Drafts counted in the monthly total | HOME-01 fails; the card read Rp 64.660.000 |
| 5 | Landing CTA no longer goes to Auth.js | AUTH-02 fails at the sign-in URL |
| 6 | Batal on regenerate regenerates | SHARE-04 fails at "the link is unchanged after cancelling regenerate" |
| 7 | Invoice list shows the due date one day early | INV-DUE-05 fails at the list row in both timezone runs |

After the last revert: no `NEGATIVE-CONTROL` marker in `src`, `e2e` or `scripts`; `git status` showed only intended files; the app was rebuilt before the gates.

## 7. CI-lane decision

Added job **`journey-coverage-full`** to `.github/workflows/e2e.yml`: full non-visual E2E, `ux:audit`, then `coverage:journeys --results <full E2E> --results <ux-audit> --require-results`.

- **Manual dispatch only** (Actions → CI → Run workflow). It roughly doubles E2E time, so it does not run on PRs.
- **Not on the weekday schedule yet.** It would share a workflow run with the scheduled `e2e-cross-browser` job that the P2-2 acceptance watches, and a failure here would mark that run failed. Scheduling it is listed as Phase 2C, after a few green manual runs and a decision on that interaction.
- No percentage threshold; not a release gate.
- Verification in CI: see §12.

## 8. Findings and observations

- **FIND-08 (new, low, open).** The recipient's invoice page and PDF print the due date only inside the payment-terms block. A deal with no payment terms shows the recipient no due date, though the owner set one and it appears everywhere on the owner's side. This is documented behaviour (`model.test.ts`: "omits the entire terms block when payment terms are empty, even with a due date set"). Needs a product decision. For this reason the INV-DUE-05 journey does not check the recipient page.
- **Auth.js's built-in sign-in page loads the Google logo from `authjs.dev`.** That is a third-party request from the sign-in page, in Production too. Not changed; noted in case it matters for the CSP or privacy review.
- FIND-07 and FIND-04 statuses in the docs now name their merged PRs (#31 `979c3ec`, #29 `ac53043`).

## 9. Incidents during the work (disclosed)

- **A draft of the AUTH-02 test reached Google.** I first relied on routing `accounts.google.com` to a local stub. Playwright does not intercept the later hops of a redirect, so on one run (two projects) the browser followed Auth.js's redirect and loaded Google's real authorization page. No credentials were entered and nothing was submitted; the local client id was sent as part of the URL, as in any sign-in attempt. The committed test reads the redirect with `route.fetch({ maxRedirects: 0 })`, never follows it, answers the `authjs.dev` logo locally, and asserts that nothing was sent to Google. `docs/testing/E2E.md` now warns about this.
- **Negative control 1** passed on its first attempt (see §6), which exposed a real weakness in the test and was fixed.
- **Firefox/WebKit:** the first cross-browser run had 4 failures in my new specs (WebKit reports a download navigation differently; the `authjs.dev` logo request was cancelled on navigation). Fixed. A second run had 1 Firefox failure (a favicon request cut short by a reload in my optional-fields test); fixed by waiting for the page to finish loading, then 27/27 over three repeats on Firefox and both Chromium projects.

## 10. Local validation (2026-10-08)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 944 passed, 84 files |
| `npm run build` | exit 0 |
| `npm run e2e:build` | exit 0 |
| `npm run test:journey-coverage` | pass |
| `npm run coverage:journeys` | OK, 95 actions, 5 outstanding P0/P1 |
| `npm run test:diagnostics-selftest` | pass (rerun after the guard change) |
| Each new spec, chromium + chromium-mobile | pass |
| `npm run test:e2e:critical` | 177 passed, 0 failed, 25 skipped |
| `coverage:journeys --results <critical>` | 108 real claims passed, 5 not exercised (non-critical or ux-audit claims, as designed) |
| `npm run test:e2e` | 193 passed, 0 failed, 25 skipped |
| `npm run test:e2e:a11y` | 14 passed, 1 skipped |
| `npm run ux:audit` | specs 69/69; functional, responsive, state PASS; `@visual` 9/9 fail → overall FAIL locally |
| `coverage:journeys --results <full E2E> --results <ux-audit> --require-results` | 113 real claims passed, 0 not exercised |
| Firefox + WebKit, new and touched specs | final run 43 passed, 1 failed, 16 skipped; the failure fixed and verified (§9). Informational, not claimed |

Critical, full, a11y and the results check were run twice: once before and once after the last change to the shared guard. The table shows the second run. The final Firefox fix (a one-line wait in one test) was verified by its targeted repeats only.

**`@visual`:** compared on the same host as instructed. This branch: 17557, 15200, 13708, 10584, 13943, 9743, 27355, 39880, 12367 differing pixels. Clean `origin/staging` (`979c3ec`), run right after: the same nine numbers. Host font drift; no baseline touched; the base seed's rendered state is unchanged by this PR.

## 11. Residual manual and device items

- MAN-DUE-01 (INV-DUE-03, P0): native date picker on a real Android Chrome phone and a real iPhone.
- MAN-DEAL-01: deal deadline picker on a phone.
- MAN-PDF-01: how a real phone hands the PDF to its viewer or downloads.
- MAN-WA-01, MAN-SHARE-01: WhatsApp app hand-off and copy on phones.
- MAN-AUTH-01 (AUTH-03): real Google sign-in.
- Decisions: FIND-01, FIND-06, FIND-08.
- `STATE.md` `day_count` is still 12. Its rule ("Asia/Jakarta calendar days since `phase_started` with activity") cannot be verified from the repository alone and the value has not been maintained since 2026-09-22; left unchanged and flagged again.
- `compose.yml` remains untracked and uncommitted; `CLAUDE.md` still forbids agents from invoking Docker.

## 12. CI and review

Recorded at the end of this file (§14) after the run on the pushed head.

## 13. Commit history note

No generated or untracked tree entered this branch's history (checked: no path containing `generated` in the PR diff). A squash merge is **not required** for hygiene; either merge style is fine.
