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
2. Desktop browser with popups blocked for the site: press it again.
   Expected: a **Buka WhatsApp** link appears, and opening it works.

Known until FIND-04 is fixed: a **Buka WhatsApp** link also appears after
step 1 even though WhatsApp opened (here and on a Beranda **Kirim pengingat**
row, HOME-03). Record it as FIND-04, not as a new defect; step 2 cannot show
that blocking was *detected*, only that the link works.

### MAN-PDF-01 — PDF download on real devices (P1)

Inventory: INV-PDF-01, PUB-05.

1. Owner: on invoice detail press **Unduh PDF**. Expected: a PDF downloads or
   opens. The totals, tax and bank details match the page.
2. Recipient: open the share link in a private window and use the PDF action.
   Expected: same content as the owner PDF.
3. On iPhone, confirm the PDF opens in the viewer and can be shared/saved.

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
   share link, open it in a private window, then revoke it and reload the
   private window (expected: not found).
3. Confirm `npm run coverage:journeys` output and the outstanding P0/P1 list in
   `docs/testing/JOURNEY-COVERAGE.md` are attached to the release PR, with
   each open P0 explicitly accepted or fixed.

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
