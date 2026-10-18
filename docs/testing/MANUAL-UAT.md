# Manual acceptance checks (browser/OS-dependent controls)

These checks cover what Playwright cannot reliably observe or drive: native
pickers on real devices, real Google OAuth, real popup blockers, and
download/share behaviour. Each check has a stable `MAN-*` ID referenced from
`docs/testing/journey-coverage.json`. `npm run coverage:journeys` fails if an
inventory entry points at a check that is not defined here.

## Rules

- **Staging only, synthetic data.** Use `https://dibayar-git-staging-kenji-iwakura.vercel.app`
  with a test account and invented brands/amounts. Never use Production or real
  customer data. Do not run irreversible hosted actions beyond creating and
  editing your own synthetic records.
- **Record every run** in the log at the bottom (or in a receipt under
  `docs/receipts/`), then update the matching inventory entry: `manual_pending` → `manual_verified` with
  the evidence line, or record a finding if it failed. A check with no
  recorded run stays `manual_pending`.
- Record: date (WIB), tester, device model, OS version, browser + version,
  interface language, the staging commit SHA (Vercel deployment), result
  (PASS/FAIL), and a screenshot or screen recording when it is safe (no
  tokens, cookies, or personal data on screen).
- A FAIL on a P0 check blocks a Production release until it is fixed or
  Chris explicitly accepts the risk.
- Which checks a release waits for is in the exception register
  (`docs/testing/JOURNEY-COVERAGE.md`, generated from the inventory) and
  `REVIEW_CHECKLIST.md` Gate F. In short:

  | Check | Why it is manual | A release without a logged PASS |
  |---|---|---|
  | MAN-REL-01 | Release smoke on the hosted environment | Blocked |
  | MAN-DUE-01 (P0) | Native date picker on real phones | Blocked, unless Chris accepts the risk in the release PR |
  | MAN-AUTH-01 (P0) | Real Google sign-in, a third party | Blocked, unless Chris accepts the risk in the release PR |
  | MAN-DEAL-01, MAN-DEAL-02, MAN-WA-01, MAN-PDF-01, MAN-SHARE-01 (P1) | Phone-only remainder of flows that are automated on Chromium | Not blocked; the release PR lists each one as run or not run |
  | MAN-A11Y-01 (P2) | Screen reader | Not blocked |

  A FAIL on any of them is a finding, whatever the table says about a
  missing run.

## Device matrix (minimum before a Production release)

| Target | Why |
|---|---|
| Android phone, Chrome (current) | Primary audience; native date dialog |
| iPhone, Safari (current iOS) | Different picker and popup behaviour |
| Desktop Chrome (macOS or Windows) | Reproduces the Production due-date report |
| Desktop Safari or Firefox | Second desktop engine for pickers and downloads |

## Checks

### MAN-DUE-01 — Due date: open picker, choose, save, reload (P0)

Inventory: INV-DUE-02, INV-DUE-03. FIND-02 (picker not opening) and FIND-03
(keyboard entry saving year 0002) were fixed by PR #26 (merge `b51fba1`, on
`staging`). Automation proves the picker opens only in Chromium (desktop and
390px emulation). This check is the real-device proof, and it is still
**pending** on Android Chrome and iPhone Safari. Emulation does not count.

1. Sign in on staging. Open a synthetic invoice with no due date (or press
   **Kosongkan** / **Clear** on one), reload.
2. Confirm the field shows **Belum ditentukan** (Indonesian) or **Not set** (English).
3. Click (desktop) or tap (phone) **directly on that text**, not on the far right edge.
   - Expected: a date picker opens. Record exactly what happened if it did not.
4. Choose a date about one month ahead. Expected: the field shows that date
   (for example `15 Nov 2026`) and **Tersimpan** / **Saved** appears briefly.
5. Reload. Expected: the same date is shown, and the header shows `Jatuh tempo: <date>`.
6. Tap the field again, choose a different date, reload. Expected: the new date.
7. Press **Kosongkan** / **Clear**, reload. Expected: back to the empty label.
8. Repeat steps 2–5 once in the other interface language (Pengaturan → Bahasa antarmuka).
9. In the picker, try to reach a year before 2000 or after 2099. Expected: the
   picker doesn't offer it, or a hint appears and nothing is saved (reload
   shows the previous value).
10. iPhone only: spin the wheel picker quickly through several dates, then tap
    Done and reload. Expected: the final date is shown, not an earlier one.

### MAN-DEAL-01 — Deal deadline picker in the add-deal dialog (P1)

Inventory: DEAL-CREATE-07.

1. On a phone, tap the floating **+** button. In the dialog, fill the required
   fields, then tap **Deadline** and choose a date in the picker.
2. Save. Open the new deal. Expected: the deadline matches the chosen date.
3. Open the deal's stage menu until it reaches Invoice, create an invoice.
   Expected: the invoice's due date defaults to the deadline.

Automated since Zero Routine Phase 2B: the required-field check and the
optional text fields (`e2e/deals/create-validation.spec.ts`). Only the
deadline picker still needs this check.

### MAN-DEAL-02 — Edit a saved deal on a phone (P1)

Inventory: DEAL-EDIT-01 (#55). Run on a physical iPhone (Safari) and a
physical Android phone (Chrome), in id and en.

1. On the deal board, tap a card's **⋮** and then **Ubah deal**. Expected:
   a full-screen dialog titled **Ubah deal** with every field filled in from
   the deal; nothing sticks out sideways; the keyboard does not hide the
   field being typed in; **Simpan perubahan** and **Batal** are reachable by
   scrolling the dialog and are easy to tap.
2. Change the brand, the WhatsApp number (to another valid number), the fee
   and the payment terms. Tap **Tenggat** and choose a different date in the
   phone's own picker. Save. Expected: "Perubahan deal disimpan.", the card
   shows the new brand and fee, the deal is still in the same column.
3. Reload. Open the deal (⋮ → Lihat detail). Expected: every changed value,
   the chosen deadline, the same stage, no new stage-history entry.
4. On deal detail tap **Ubah deal**, clear the deadline with the picker's own
   clear/reset control (if the phone offers one), clear the payment terms,
   save, reload. Expected: both are empty. Note on the run log if the picker
   has no way to clear a date.
5. Tap **Ubah deal**, change the brand, tap **Batal**. Expected: "Buang
   perubahan yang belum disimpan?" with **Lanjut mengubah** and **Buang
   perubahan**; the first keeps the typed brand, the second closes without
   saving (reload shows the old brand).
6. On a deal that already has an invoice, open **Ubah deal**. Expected: the
   note naming the invoice. Change the fee and save; open the invoice and the
   brand's link: amount, number, PPh and due date are unchanged.

Automated (Chromium desktop and 390 px, and WebKit 390 px emulation):
`e2e/deals/deal-edit.spec.ts` and `e2e/deals/deal-change-keeps-invoice.spec.ts`.
Only the real phones, their keyboards and their date pickers need this check.

### MAN-AUTH-01 — Real Google sign-in and sign-out (P0)

Inventory: AUTH-03.

1. In a private window, open staging. Expected: Google sign-in is offered.
2. Sign in with the staging test Google account. Expected: Beranda loads, no
   console errors, nothing that points at the Production host.
3. Sign out via the account menu. Expected: the next visit to `/deal` asks you
   to sign in again.

### MAN-WA-01 — WhatsApp hand-off and real popup blocker (P1)

Inventory: INV-WA-01, INV-WA-02, HOME-03.

1. On a synthetic invoice whose deal has your own test WhatsApp number, press
   **Kirim lewat WhatsApp**. Expected: WhatsApp (app or web) opens with the
   template text, amount, invoice number and a `/i/` link. **Do not send** to
   anyone other than yourself.
   Expected: exactly one new tab or app hand-off, and **no Buka WhatsApp**
   link on the invoice page afterwards (FIND-04, fixed by
   `fix/whatsapp-popup-fallback-2026-10-05`; check only on a build that
   includes it). Repeat from a Beranda
   **Kirim pengingat** row (HOME-03): same result, no link on the row.
2. Desktop browser with popups blocked for the site: press it again.
   Expected: no tab opens, a **Buka WhatsApp** link appears, and opening it
   works.
3. On a phone (Android Chrome, iPhone Safari), repeat step 1. Expected: a
   brief "Membuka WhatsApp…" tab that turns into WhatsApp, not a blank tab
   left behind, and no **Buka WhatsApp** link. If a phone browser or in-app
   browser (for example Instagram's) blocks the tab, the link must appear
   instead.
4. Link reuse (FIND-05, fixed by `fix/reminder-share-link-reuse-2026-10-07`;
   check only on a build that includes it): open the `/i/` link from step 1 in
   a private window, then send a **Kirim pengingat** from the Beranda row
   twice. Expected: both messages carry that same link, and reloading the
   private window still shows the invoice. Then **Buat ulang tautan** on the
   invoice and reload the private window. Expected: not found.
   Since the FIND-07 fix (`fix/expired-share-reminder-2026-10-08`) the same
   holds for **Kirim pengingat** / **Kirim lewat WhatsApp** on the invoice
   page itself. An expired link cannot be produced by hand on staging (links
   last 90 days); that case is covered by automation only.

Automated since the FIND-04 fix: "popup opened -> one tab, no link" and a
real Chromium blocker (`e2e/whatsapp/popup-blocker.spec.ts`). What still needs
this check: the WhatsApp app itself, and real phone and in-app browsers.

### MAN-PDF-01 — PDF download on real devices (P1)

Inventory: INV-PDF-01, PUB-05.

1. Owner: on invoice detail press **Unduh PDF**. Expected: a PDF downloads or
   opens. The totals, tax and bank details match the page.
2. Recipient: open the share link in a private window and use the PDF action.
   Expected: same content as the owner PDF.
3. On iPhone, confirm the PDF opens in the viewer and can be shared/saved.

Automated since Zero Routine Phase 2B: the click, the download and the PDF's
text for owner and recipient, including parity, in desktop and 390px
Chromium (`e2e/invoices/pdf-download.spec.ts`). What still needs this check
is how a real phone's browser hands the file to its viewer or downloads.

### MAN-SHARE-01 — Copy share link on phones (P1)

Inventory: SHARE-05.

1. On a phone, open an invoice with an active share link, press **Salin** (the
   copy button in the link field; screen readers announce "Salin tautan invoice").
   Expected: the button briefly reads **Tersalin**, and pasting into notes gives
   the full `/i/` link. Desktop Chromium is automated
   (`e2e/invoices/share-copy.spec.ts`); phones are not.
2. If the copy is refused, expected: the manual-copy fallback is shown and the
   link can be long-pressed to copy.

### MAN-A11Y-01 — Screen reader on invoice detail (P2)

Inventory: A11Y-03.

1. With TalkBack (Android) or VoiceOver (iOS), move to the due-date field.
   Expected: it is announced as **Tanggal jatuh tempo** with its value or the empty state.
2. Activate it. Expected: the picker opens and a date can be chosen.
3. Expected: the saved state is announced. Status buttons are announced with their labels.

### MAN-REL-01 — Staging release smoke (before every staging → main PR)

1. Run MAN-AUTH-01 on desktop.
2. Create a synthetic deal from the phone FAB, move it to Invoice, create
   the invoice, mark it sent, set a due date (MAN-DUE-01 steps 3–5), create a
   share link, open it in a private window (expected: the invoice, without
   signing in). Then revoke it on the owner's page: **Cabut tautan**, then
   **Ya, cabut tautan** in the confirmation that opens. The first button
   only asks; nothing is revoked until the second. Expected on the owner's
   page: "Belum ada tautan berbagi untuk invoice ini." and **Buat tautan
   berbagi** is offered again. Then
   reload the private window (expected: "Tautan ini tidak ditemukan.").
3. Confirm `npm run coverage:journeys` output and the outstanding P0/P1 list
   and exception register in `docs/testing/JOURNEY-COVERAGE.md` are attached
   to the release PR, with each open P0 explicitly accepted or fixed
   (`REVIEW_CHECKLIST.md` Gate F).

## Exploratory testing charter (each new feature)

Time-box 30–45 minutes on staging with synthetic data. Note anything surprising
as a finding with steps, then turn every reproducible defect into an automated
regression test (in `e2e/`) before the fix is promoted.

- Reach the feature by every route a person could take: bottom nav, FAB,
  top bar, deep link, Back/Forward, a link shared from WhatsApp.
- Abandon halfway: close the dialog, navigate away, reload mid-save, lose
  the network (DevTools offline) and retry.
- Repeat actions: double-click/double-tap primary buttons, and press
  Back after saving.
- Switch interface language and viewport (390px ↔ desktop) in the middle of the flow.
- Empty, long and odd inputs: empty optional fields, 120-character brand,
  emoji, very large fees, dates around month ends and year boundaries.
- Errors: invalid WhatsApp numbers, revoked or expired links, and a second
  account trying the first account's URLs.

## Run log

| Date (WIB) | Check | Tester | Device / OS / Browser | Lang | Staging SHA | Result | Evidence / notes |
|---|---|---|---|---|---|---|---|
| 2026-09-30 | MAN-AUTH-01 steps 1–2 (sign-in round trip; sign-out not recorded) | see receipt | desktop browser, Chris's consented Google account | id | `cab167f` | PASS | `docs/receipts/DIBAYAR-HOBBY-STAGING-ACTIVATION-2026-09-29.md` §Smoke |

No run is logged for the 2026-10-11 release candidate. The candidate is
`origin/staging` = `fe012816bf3691941600d605dcea589187923d1a` (PR #45's merge
commit, carrying #41–#44), deployed to the staging alias as
`dpl_2gyAk5xL9tmoiM1kPwVx2K4BRohd` (verified 2026-10-11). Every check above
is still pending for it: the machine that validated it had no phone, and no
Google sign-in or sign-out was performed. The work order is
`docs/receipts/DIBAYAR-E2E-REAL-DEVICE-HANDOFF-2026-10-11.md`.

Rows to fill in for that candidate. They are **not results**: copy a row into
the run log above only when the check has been run, with every field filled.
If the staging deployment no longer reads `fe01281`, write the SHA it does read.

| Date (WIB) | Check | Tester | Device / OS / Browser | Lang | Staging SHA | Result | Evidence / notes |
|---|---|---|---|---|---|---|---|
| | MAN-AUTH-01 steps 1–3 (sign-in **and** sign-out, then `/deal` asks to sign in) — blocks a release | | desktop Chrome, private window | id | `fe01281` | | |
| | MAN-DUE-01 steps 1–9 — blocks a release | | Android phone / Chrome | id + en | `fe01281` | | |
| | MAN-DUE-01 steps 1–10 (incl. fast wheel) — blocks a release | | iPhone / Safari | id + en | `fe01281` | | |
| | MAN-REL-01 steps 1–3 (incl. link revoke) — blocks a release | | phone (FAB) + desktop | id | `fe01281` | | |
| | MAN-DUE-01 steps 1–9 | | desktop Chrome; desktop Safari or Firefox | id | `fe01281` | | |
| | MAN-DEAL-01 | | Android, iPhone | id | `fe01281` | | |
| | MAN-WA-01 | | Android, iPhone, desktop (popups blocked) | id | `fe01281` | | |
| | MAN-PDF-01 | | Android, iPhone, desktop Safari or Firefox | id | `fe01281` | | |
| | MAN-SHARE-01 | | Android, iPhone | id | `fe01281` | | |
| | MAN-A11Y-01 | | TalkBack or VoiceOver | id | `fe01281` | | |

**2026-10-12: `staging` moved to `eea298d`** (merge of PR #46, a test-support
change only; deployed as `dpl_GiHE9tbkVA9uDmuNxXDcMVq4VuJR`, verified
2026-10-12). The `fe01281` rows above were never filled in and are
superseded: use the rows below. They are **not results** either. Every check
is `NOT_RUN` for `eea298d` until a person runs it and fills in every field.

| Date (WIB) | Check | Tester | Device / OS / Browser | Lang | Staging SHA | Result | Evidence / notes |
|---|---|---|---|---|---|---|---|
| | MAN-AUTH-01 steps 1–3 (sign-in **and** sign-out, then `/deal` asks to sign in) — blocks a release | | desktop Chrome, private window | id | `eea298d` | | |
| | MAN-DUE-01 steps 1–9 — blocks a release | | Android phone / Chrome | id + en | `eea298d` | | |
| | MAN-DUE-01 steps 1–10 (incl. fast wheel) — blocks a release | | iPhone / Safari | id + en | `eea298d` | | |
| | MAN-REL-01 steps 1–3 (incl. link revoke, checked in a private window) — blocks a release | | phone (FAB) + desktop | id | `eea298d` | | |
| | MAN-DUE-01 steps 1–9 | | desktop Chrome; desktop Safari or Firefox | id | `eea298d` | | |
| | MAN-DEAL-01 | | Android, iPhone | id | `eea298d` | | |
| | MAN-WA-01 | | Android, iPhone, desktop (popups blocked) | id | `eea298d` | | |
| | MAN-PDF-01 | | Android, iPhone, desktop Safari or Firefox | id | `eea298d` | | |
| | MAN-SHARE-01 | | Android, iPhone | id | `eea298d` | | |
| | MAN-A11Y-01 | | TalkBack or VoiceOver | id | `eea298d` | | |
| | Reduce Motion: account menu appears in place, no slide (optional, not a register entry) | | iPhone / Safari, Reduce Motion on | id | `eea298d` | | |

**2026-10-12 (afternoon): the candidate is not final yet.** PR #48 (tests),
PR #49 (FIND-13 fix, application code) and PR #47 (documents) are open
against `staging`, and each merge makes a new candidate SHA, a
documentation-only merge included (`REVIEW_CHECKLIST.md` Gate F, "Release
head"). The `eea298d` rows above were never filled in. Run the checks on the
deployment the alias serves after those merges, and write **that** SHA in
every row; the sheet with expected results is §7 of
`docs/receipts/DIBAYAR-FIND13-PR47-PR48-RELEASE-READINESS-2026-10-12.md`. A
row counts for the SHA it names. If `staging` moves after a check was run,
rerun it, or Chris states in the release PR why it still applies.

The rows below are **not results**. Every check is `NOT_RUN` until a person
runs it and fills in every field.

| Date (WIB) | Check | Tester | Device / OS / Browser | Lang | Staging SHA | Result | Evidence / notes |
|---|---|---|---|---|---|---|---|
| | MAN-AUTH-01 steps 1–3 (sign-in **and** sign-out, then `/deal` asks to sign in) — blocks a release | | desktop Chrome, private window | id | _deployed SHA_ | | |
| | MAN-DUE-01 steps 1–9 — blocks a release | | Android phone / Chrome | id + en | _deployed SHA_ | | |
| | MAN-DUE-01 steps 1–10 (incl. fast wheel) — blocks a release | | iPhone / Safari | id + en | _deployed SHA_ | | |
| | MAN-REL-01 steps 1–3 (revoke with **Cabut tautan** → **Ya, cabut tautan**, then reload the private window) — blocks a release | | phone (FAB) + desktop | id | _deployed SHA_ | | |
| | MAN-DEAL-01 | | Android, iPhone | id | _deployed SHA_ | | |
| | MAN-WA-01 | | Android, iPhone, desktop (popups blocked) | id | _deployed SHA_ | | |
| | MAN-PDF-01 | | Android, iPhone, desktop Safari or Firefox | id | _deployed SHA_ | | |
| | MAN-SHARE-01 | | Android, iPhone | id | _deployed SHA_ | | |
| | MAN-A11Y-01 | | TalkBack or VoiceOver | id | _deployed SHA_ | | |
| | Reduce Motion: account menu appears in place, no slide (optional, not a register entry) | | iPhone / Safari, Reduce Motion on | id | _deployed SHA_ | | |
| | FIND-13: on a slow connection open `/deal?tambah=1` and type the brand at once; the text and the keyboard stay, the deal saves once (optional, not a register entry; needs PR #49 deployed) | | phone | id | _deployed SHA_ | | |
