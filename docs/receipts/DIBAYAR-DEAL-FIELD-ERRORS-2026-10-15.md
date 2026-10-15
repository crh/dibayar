# Dibayar — field-level save errors (issue #50) — 2026-10-15

**Root cause: CONFIRMED by the tester.** On iPhone Safari, the tester typed a one-digit WhatsApp number. The form's `required` accepted it, and the server refused it: `dealInputSchema.contactWa` requires `min(6)`, giving a 400. The dialog showed only "Deal belum bisa disimpan.", so nothing named the field or the rule. This matches the staging log evidence: 6 × `POST /api/deals` → 400, all after the sign-in and Origin checks (see `DIBAYAR-IOS-SAFARI-DEAL-CREATE-2026-10-15.md`, PR #51 branch).

**Decision (product owner, 2026-10-15):** the WhatsApp field enforces the real WhatsApp rule (`normalizeWhatsAppNumber`: 9–15 digits once normalized) in the form and on the server, not just the old length rule.

## Audit: what the server validates vs. what the user saw

| Form | Field / rule | Before | After |
| --- | --- | --- | --- |
| Add deal | WhatsApp: server min 6, form only `required` | 400 → "Deal belum bisa disimpan." | Rule now = WhatsApp-openable, checked in the form; field message "Nomor WhatsApp belum valid. Contoh: 0812 3456 7890.", focus, nothing sent |
| Add deal | WhatsApp `123456` (passed min 6) | Saved; WhatsApp broken later | Refused with the same message |
| Add deal | Brand / scope only spaces (`trim().min(1)`) | Passed `required` → 400 generic | Field message |
| Add deal | Brand 120, contact 120, scope 500, terms 500 chars | No limit in form → 400 generic | `maxLength` in form; a 400 naming the field marks it |
| Add deal | Fee int, ≥0, ≤10 billion | `step`/`min` native; no `max` → 400 generic | `max` added + form check + field message |
| Add deal | Deadline (`coerce.date`) | Native date input | Unchanged; field message if the server names it |
| Deal detail | WhatsApp repair | 400 → "…belum bisa disimpan. Coba lagi." | Checked before sending; specific message |
| Deal detail | Contact name 120 | No limit → "…Coba lagi." | `maxLength=120`; 400 → "Nama kontak maksimal 120 karakter." |
| Invoice detail | WhatsApp repair | Invalid number sent → "…Coba lagi." | Not sent; specific message |
| Beranda follow-up | WhatsApp repair | Invalid number sent → "Nomor belum bisa disimpan. Coba lagi." | Not sent; specific message |
| Settings | Every field max length | No limit → "Gagal menyimpan. Coba lagi." | `maxLength` = server limits |
| Settings | Email: form pattern vs zod (`budi@contoh..id`) | 400 → "Gagal menyimpan. Coba lagi." | Email field marked "Email tidak valid." |
| Invoice detail | Due date | Form already applies the server's exact rule + own message | Unchanged (no gap) |
| Invoice create, language | No typed input | — | No gap |

Existing deals with an invalid number are untouched and can still be repaired.

## Validation (local, `57cb48a` on `fix/deal-field-errors-2026-10-15`, base staging `b9e9960`)

- `npm run lint`: 0 errors, 0 warnings · `npm run typecheck`: clean · `npm test`: 86 files, 1027 passed
- `npm run e2e:build` + Playwright `--project=chromium --project=chromium-mobile --project=webkit e2e/deals e2e/settings e2e/home e2e/invoices --grep-invert @visual`: **275 passed, 0 failed, 0 flaky**, 40 skipped (existing per-project conditions)
- `npm run coverage:journeys`: OK (DEAL-CREATE-05 and SET-08 updated; report regenerated)
- 390px (chromium-mobile): dialog with the WhatsApp error. Red field border, message under the field, alert at the top, no horizontal overflow.
- RED before the fix: the old `deal-crud.spec.ts` asserted "Deal belum bisa disimpan." for a too-short number, and the new assertions (field message, nothing sent) cannot hold on `b9e9960`. The new unit tests for `validateDealForm` and the client messages target code that did not exist before.

## Still open (human)

1. Merge decision for the fix PR into `staging` (reviewer). PR #51 (diagnostic only) is superseded: recommend closing it unmerged.
2. After merge, on the **physical iPhone**: type `1` in Kontak WhatsApp and confirm the message appears under the field. Then enter `0812 3456 7890`, save once, reload, and confirm exactly one deal.
3. Then iPhone **MAN-DUE-01** (due-date picker), Android **MAN-DUE-01**: NOT_RUN.
4. FIND-10 Production read-only SQL: NOT_RUN (not run from this task).

**Release: NO-GO** until 2–4 are done. No Production, `main`, Vercel, Neon or OAuth change was made.
