# Dibayar — field-level save errors (issue #50) — 2026-10-15

**Verdict:** fix ready for review in PR #52 · root cause **CONFIRMED** · CI **green** on `346dc1a` · release **NO-GO** (human gates below)

## State

| Item | Value |
| --- | --- |
| `origin/staging` | `b9e9960` (unchanged during this work) |
| `origin/main` | `308a339` (untouched) |
| Fix branch | `fix/deal-field-errors-2026-10-15`, head `346dc1a` (plus this receipt) |
| Fix PR | [#52](https://github.com/crh/dibayar/pull/52) → `staging`, OPEN, mergeable, **not merged** |
| Diagnostic PR | [#51](https://github.com/crh/dibayar/pull/51), OPEN, superseded by #52: recommend closing unmerged |
| Issue | [#50](https://github.com/crh/dibayar/issues/50), OPEN; comments posted with the evidence and the fix |

## Root cause

On a physical iPhone in Safari, the tester typed a **one-digit WhatsApp number** into the add-deal form. That form only had `required`, so it sent the number. The server (`dealInputSchema.contactWa: min(6)`) answered **400**. The dialog showed only "Deal belum bisa disimpan." and named neither the field nor the rule.

Evidence:
- Staging alias `dpl_8gp6DL4Ax69gowtcYruWsV27zqbb` = `b9e9960`.
- Vercel logs, 2026-10-15 00:30–00:47 UTC: 6 × `POST /api/deals` → 400, all past the sign-in and Origin checks.
- None of them wrote a row, so there are no duplicates.
- The tester confirmed the one-digit input.
- Not reproducible with valid data: WebKit iPhone 13 emulation returned 201 on every path.

**Product decision (2026-10-15):** enforce the real WhatsApp rule (`normalizeWhatsAppNumber`: 9–15 digits once normalized) in both the form and the server, not just the old length rule.

## Audit: server rule vs. what the user saw

| Form | Field / rule | Before | After |
| --- | --- | --- | --- |
| Add deal | WhatsApp: server min 6; form only `required` | 400 → "Deal belum bisa disimpan." | WhatsApp-openable rule checked in the form; field message "Nomor WhatsApp belum valid. Contoh: 0812 3456 7890."; focus moves to the field; nothing is sent |
| Add deal | WhatsApp `123456` (passed min 6) | Saved; the WhatsApp button failed later | Refused, same message |
| Add deal | Brand / scope only spaces (`trim().min(1)`) | Passed `required` → generic 400 | Field message |
| Add deal | Brand 120, contact 120, scope 500, terms 500 chars | No form limit → generic 400 | `maxLength`; a 400 naming a field marks that field |
| Add deal | Fee: integer, ≥ 0, ≤ 10 billion | No `max` → generic 400 | `max`, form check, field message |
| Deal detail | WhatsApp repair | "…belum bisa disimpan. Coba lagi." | Checked before sending; specific message |
| Deal detail | Contact name 120 | No limit → "…Coba lagi." | `maxLength=120`; 400 → "Nama kontak maksimal 120 karakter." |
| Invoice detail | WhatsApp repair | Invalid number sent → "…Coba lagi." | Not sent; specific message |
| Beranda follow-up | WhatsApp repair | Invalid number sent → "Nomor belum bisa disimpan. Coba lagi." | Not sent; specific message |
| Settings | Every field's max length | No limit → "Gagal menyimpan. Coba lagi." | `maxLength` = server limits |
| Settings | Email where the form pattern and zod disagree (`budi@contoh..id`) | "Gagal menyimpan. Coba lagi." | Email field marked "Email tidak valid." |
| Invoice detail | Due date | Already applies the server's exact rule with its own message | No gap |
| Invoice create, language | No typed input | — | No gap |

Deals already holding an invalid number are untouched and can still be repaired.

## Commits on PR #52

| SHA | What |
| --- | --- |
| `57cb48a` | The fix: rule, form checks, field messages, repair forms, Settings limits, tests, journey inventory (DEAL-CREATE-05, SET-08) |
| `9f392b9` | Receipt (first version) |
| `346dc1a` | ux-audit T-27: restore the `not-a-phone` fixture in the DB (new `restore-invalid-contact` action), because the API now refuses it. The read-back still goes through the API. |

## Validation

**CI on `346dc1a`: all green**
- CI run 38684552924: lint-typecheck-test ✅ · e2e-critical ✅ · e2e-a11y ✅ · ux-audit ✅ · e2e-cross-browser skipped (workflow rule for PRs)
- Journey coverage (full) run 38684552944: ✅

**Earlier CI on `9f392b9` (failed, now fixed):** runs 38682270771 and 38682270831 failed only at ux-audit T-27, whose cleanup PATCH tried to write `not-a-phone` and got a 400 from the new rule. It was fixed in `346dc1a`; no product code changed.

**Local**
- lint: 0 errors, 0 warnings · typecheck: clean · unit: 86 files, **1027 passed**
- Playwright chromium + chromium-mobile + webkit, `e2e/deals e2e/settings e2e/home e2e/invoices`: **275 passed, 0 failed, 0 flaky**, 40 skipped (existing per-project conditions)
- `npm run coverage:journeys`: OK
- `npm run ux:audit` on `346dc1a`:
  - tests/ux-audit: **69 passed**.
  - The 9 `@visual` snapshots differ on this machine for every page, including unchanged ones (font rendering). CI ran the same 9 and all passed, so this is not counted as a regression.
- 390px (chromium-mobile), add-deal dialog with the WhatsApp error: red field border, message under the field, alert at the top, no horizontal overflow.

**RED/GREEN**
- On `b9e9960` a one-digit number reaches the server and only the generic message is shown.
- The new `deal-crud.spec.ts` assertions (field message, focus, nothing sent, then exactly one deal after correcting) and the new unit tests (`validateDealForm`, `dealFormErrorsFromServer`, client and repair messages, schema cases `"1"` and `"123456"`) cannot pass there.

## Risks and rollback

- The server is stricter for `contactWa` on create and on PATCH. The only clients are this app's forms, and they check first.
- Rollback: revert `57cb48a` and `346dc1a`.

## Human gates — still open

| Gate | Status |
| --- | --- |
| Review and merge PR #52 into `staging` (not `main`) | PENDING |
| Close PR #51 unmerged | PENDING (recommended) |
| Physical iPhone, after #52 is on staging: type `1` → message under the field; then `0812 3456 7890`, save once, reload → exactly one deal | NOT_RUN |
| iPhone MAN-DUE-01 (due-date picker) | BLOCKED until the iPhone deal creation passes |
| Android MAN-DUE-01 | NOT_RUN |
| FIND-10 Production read-only SQL | NOT_RUN (not run from this task) |
| Desktop authentication | PASS (tester-reported) |

**Release: NO-GO** until the gates above are done. No Production, `main`, Vercel, Neon or OAuth change was made.
