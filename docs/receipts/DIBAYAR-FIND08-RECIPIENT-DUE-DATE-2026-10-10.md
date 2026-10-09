# Receipt — FIND-08: the recipient sees the due date without payment terms, 2026-10-10

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **PR #35 into `staging` is open and not merged.** Nothing was deployed or released. `main` and Production were not touched. No Production, hosted-staging or Neon database was read or written; no Vercel, Neon, OAuth or repository setting was changed. Local runs used only the guarded disposable database `127.0.0.1:55432/dibayar_test`. No Google or WhatsApp traffic.

**Final status: see section 14.** Two things to know when you review:

1. With a due date and no payment terms, the document shows the line `Jatuh tempo: <date>` on its own, without the `Syarat pembayaran` heading (section 3). That is my reading of "no placeholder payment-terms text"; say so if you want a heading above it.
2. I found a separate date issue and did not change it: the document's issue date is the UTC day, so an invoice created before 07:00 WIB prints the previous day. Recorded as FIND-09 for your decision (section 9).

## 1. Verified start state (live, 2026-10-10)

- PR #33 (Phase 2C) MERGED into `staging` 2026-10-09T09:51:41Z.
- PR #34 (FIND-01 + FIND-06) MERGED into `staging` 2026-10-09T20:52:49Z; merge commit `dbf9e73` is the head of `origin/staging`.
- No open PR at all, and no branch for FIND-08.
- Live code matched the finding: `model.ts` built `terms` only when payment terms existed, and `model.test.ts`, `html.test.tsx` and `pdf.test.tsx` each pinned "omits the entire terms block when payment terms are empty, even with a due date set".
- Branch `fix/recipient-due-date-without-payment-terms-2026-10-09` from `origin/staging` `dbf9e73`. Untracked items (`compose.yml`, two older receipts, `src/generated/`) left as found.

## 2. Root cause

`buildInvoiceDocumentModel` (`src/components/documents/invoice-document/model.ts`) returned

```ts
terms: paymentTerms ? { text: paymentTerms, dueDateLabel } : null
```

The due date existed only inside a block that existed only with payment terms. The recipient page (`/i/[token]`), the recipient PDF and the owner PDF all render that one model, so all three dropped the due date together.

## 3. Canonical document model, before and after

| | Before | After |
|---|---|---|
| Type | `terms: { text: string; dueDateLabel: string \| null } \| null` | `terms: { text: string \| null; dueDateLabel: string \| null } \| null` |
| Rule | block exists only with payment terms | block is null only when both values are absent |

I kept one block with a nullable terms text, the smaller of the two shapes the brief allowed: the due date stays where it was in the document order (after tax, before bank), and the renderers still test one field.

Renderers (`blocks.tsx` `TermsBlock`, `pdf.tsx`): the `Syarat pembayaran` heading and the terms text render only when `terms.text` exists; the `Jatuh tempo:` line renders whenever `terms.dueDateLabel` exists. Neither renderer looks at the deal or the invoice; the rule is in the model once. Date formatting is unchanged (`formatDateLong`, UTC calendar day of a date stored at UTC midnight).

No schema migration, no route, query, authorization or fixture change.

## 4. The four combinations

| Payment terms | Due date | Model `terms` | Document |
|---|---|---|---|
| present | present | `{ text, dueDateLabel }` | heading, terms, `Jatuh tempo` line |
| present | absent | `{ text, dueDateLabel: null }` | heading and terms only |
| absent | present | `{ text: null, dueDateLabel }` | `Jatuh tempo` line only |
| absent | absent | `null` | nothing |

Pinned by one `it.each` table in `model.test.ts`, plus blank and whitespace-only terms (treated as absent) and a `Date` at UTC midnight. Each adapter has its own tests for due-date-only (date present, no heading, no empty element, still between tax and bank), terms-only, and neither; terms + due date is the existing full-document test in each. The three superseded "omits the entire terms block..." tests were replaced.

## 5. Recipient HTML evidence

`e2e/public/due-date-without-terms.spec.ts`, chromium and chromium-mobile, in an Asia/Jakarta and a Pacific/Honolulu browser (4 runs, all pass):

1. Follow-up overlay invoice `E2E/DUE/006`: its deal has no payment terms and it is due seven Jakarta days from today.
2. Owner: nav → invoice list → the invoice; **Buat tautan berbagi**; the link shown on the page is what the recipient opens.
3. Recipient in its own context with no cookies: HTTP 200, exactly one `Jatuh tempo:` line, visible, reading `Jatuh tempo: 17 Oktober 2026` on this run (expected value built from a fixed month table, not the app's formatter).
4. No `Syarat pembayaran` anywhere in the document, the due date's block holds that one line, no empty `p`/`h2`, no button, input or form, no owner chrome.
5. Reload: the same assertions again.

## 6. PDF download and extraction evidence

Same test. The recipient clicks the visible **Unduh PDF**; `downloadPdfByClick()` takes the browser's download event (attachment response, `E2E-DUE-006.pdf`) and `pdftotext -layout` reads it. The text has the line `Jatuh tempo: 17 Oktober 2026`, placed after `Pajak potong` and before `Pembayaran ke`, and no `Syarat pembayaran`.

## 7. Owner/recipient parity

Same test: the owner's PDF is downloaded by clicking **Unduh PDF** on invoice detail. It has the same due-date line, and its extracted text equals the recipient's (per-line diff first, then whole-text equality), the same strategy as `e2e/invoices/pdf-download.spec.ts`. That existing spec (deal with terms + due date) still passes unchanged. `tests/ux-audit/t27.verification.spec.ts` compared HTML and PDF fields but found the HTML due date only under the terms heading; its parser now reads the due date on its own, as its PDF side already did (69/69 ux-audit specs pass).

## 8. Negative controls

Each was a temporary edit, run against a fresh build, then reverted with `git checkout`.

| Mutation | Result |
|---|---|
| Model back to `paymentTerms ? {...} : null` | 6 unit tests fail (4 model, 1 HTML, 1 PDF); the recipient journey fails: 0 `Jatuh tempo` lines, expected 1 |
| HTML `TermsBlock` omits the due date without terms | 1 HTML unit test fails; the journey fails at the recipient page |
| PDF adapter omits the due date without terms | 1 PDF unit test fails; the journey fails at `the recipient's PDF has the line "Jatuh tempo: 17 Oktober 2026"` |

After reverting: no `NEGATIVE-CONTROL` marker in `src` or `e2e`, working tree clean, rebuilt before the final runs.

## 9. Inventory and findings

- FIND-08 → fixed (PR #35). Actions now INV-DUE-05, PUB-01, PUB-05, PUB-06.
- New test references on INV-DUE-05, PUB-01 (both timezone runs), PUB-05 and PUB-06. No classification changed and no action was added: 95 actions, 93 applicable, real 65/93 = 69.9%, P0 28/30, 4 outstanding P0/P1.
- **FIND-09 (new, low, open, not changed):** the document prints `Tanggal terbit` as the UTC calendar day of `Invoice.createdAt`. An invoice created between 00:00 and 06:59 WIB shows the previous day as its issue date. Seen during this work at about 04:00 WIB on 10 October: the PDF said `Tanggal terbit: 9 Oktober 2026`. Due dates are not affected. It needs your decision (print the Jakarta day, or keep).
- Updated: `journey-coverage.json`, generated `JOURNEY-COVERAGE.md`, `JOURNEY-BACKLOG.md`, `JOURNEY-GRAPHS.md`, `E2E.md`, `REVIEW_CHECKLIST.md` (F4 now names FIND-09), `dibayar-implementation-spec.md` §5.3 terms row, `STATE.md`, `DAILY_LOG.md`.

## 10. Local validation (2026-10-10)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 84 files, 980/980 |
| `npm run build` | exit 0 |
| `npm run e2e:build` | exit 0 |
| `npm run test:journey-coverage` | 37/37 |
| `npm run coverage:journeys` | OK |
| `npm run test:diagnostics-selftest` | pass |
| Targeted document tests (`src/components/documents`) | 44/44 |
| Targeted recipient journey, chromium + chromium-mobile | 4/4 |
| `npm run test:e2e:critical` | 189 passed, 0 failed, 25 skipped |
| `npm run test:e2e` | 205 passed, 0 failed, 25 skipped |
| `npm run test:e2e:a11y` | 14 passed, 1 skipped |
| `npm run ux:audit` | exit 1: ux-audit specs 69/69 pass; `@visual` 9/9 fail (below) |
| `coverage:journeys --results ... --require-results` | 113 real claims passed, 0 not exercised |
| Firefox + WebKit, new journey + `pdf-download.spec.ts` | 8/8 (informational) |

**`@visual` locally:** 17557, 15200, 13708, 10584, 13943, 9743, 27355, 39880, 12367 differing pixels, the same nine numbers recorded for clean `staging` on this host in the last three receipts. Host font drift. No seeded page changes with this PR: the seeded invoice has payment terms, so its document renders as before. No baseline touched. CI's `ux-audit` job is the check that counts (section 11).

## 11. Latest-head CI and full-coverage workflow

The inventory changed, so both workflows run on this PR.

- First head `7314524`: `CI` `37995112761`: `lint-typecheck-test`, `e2e-critical`, `ux-audit` (includes `@visual`) success; `e2e-a11y` failed before any test ran. `Journey coverage (full)` `37995112912` failed the same way. Both failures are the runner's `Initialize containers` step timing out while pulling `postgres:16` from Docker Hub ("Docker pull failed with exit code 1"); no test executed in either job.
- Head `54ed5d0` (the same code plus this receipt): `CI` `37996895961` success: `lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit` all success (`e2e-cross-browser` skipped by design on PRs). `Journey coverage (full)` `37996895809` success (113 real claim(s) passed in the run, 0 not exercised by it).
- The commit after `54ed5d0` only fills in sections 11, 12 and 14 of this receipt. Its runs are reported on the PR, not here.

## 12. Review-thread status

Codex reviewed `7314524` and raised one P2 on `STATE.md`: the receipt it points to was not in the branch. Valid: this receipt was written but not yet committed when the PR opened. Fixed by committing it. in `54ed5d0`, and replied on the thread. No other finding on that review. No human review yet.

## 13. Untouched

`main`, Production, hosted staging, Neon, Vercel, Google OAuth and repository settings were not touched. No migration. No visual baseline updated. No FIND-01/FIND-06 or Batch 3 work. No secret or share token appears in logs or in this receipt.

## 14. Final status

**`READY_FOR_CHRIS_REVIEW`.** PR #35 is open into `staging` and is not merged; merging needs your explicit authorization.

For you to decide:

1. Merge PR #35.
2. Whether the due date without payment terms should stand alone as `Jatuh tempo: <date>` (as built) or sit under a heading.
3. FIND-09: print the issue date as the Jakarta day, or keep the UTC day.
