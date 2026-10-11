# Dibayar — real-device and real-sign-in verification handoff (2026-10-11)

**Status of every check below: `PENDING — requires real device/user action`.**
Nothing in this file is a result. It is the work order for the person who
holds the phones and the Google test account.

Why it is handed over: the one-shot E2E autopilot inspected the machine it
ran on (ALPHA) and found no Android device (`adb` not installed, nothing on
USB), no reachable iPhone, no device-cloud account and no emulator. The only
real browser it could reach was one desktop Chrome (Windows) through the
Claude browser extension. That was not used either: it cannot stand in for a
phone, the sign-in of MAN-AUTH-01 needs the account holder at the Google
page, and the staging deployment was still the commit from before this work
(the session could not merge), so nothing run there would have counted for
the candidate. Details: `DIBAYAR-E2E-AUTOPILOT-ONE-SHOT-2026-10-11.md` §3
and §8.

**Release gate.** A `staging -> main` release is blocked until MAN-REL-01,
MAN-DUE-01 (real Android Chrome and real iPhone Safari) and MAN-AUTH-01
(sign-in **and** sign-out) are logged PASS for the release candidate, or
Chris accepts the risk in the release PR (`REVIEW_CHECKLIST.md` Gate F2).
INV-DUE-03 stays `manual_pending` until then. The 2026-09-30 MAN-AUTH-01 entry
covers sign-in only, on commit `cab167f`; it is not a sign-out PASS and not
evidence for this candidate.

## 1. What to test, and on what

| | |
|---|---|
| URL | `https://dibayar-git-staging-kenji-iwakura.vercel.app` (Vercel SSO stays on; do not make it public) |
| Commit under test | The `staging` deployment **after** the autopilot's PRs (#41, #42, #43 and the NAV-08 PR) are merged. When this file was written none was merged and `origin/staging` was still `390bc38c278c04b7b3062ac6c5caeb544b380705`; a PASS on that commit is not evidence for the candidate that contains this work. Before starting, open the Vercel deployment of the `staging` branch, note its commit SHA, and write that SHA in the log. |
| Account | the consented staging Google test account. Never a customer's, never Production. |
| Data | synthetic only: invented brand names and amounts, your own WhatsApp number as the contact. |

Device matrix (`docs/testing/MANUAL-UAT.md`):

| # | Device | Needed for |
|---|---|---|
| D1 | Android phone, Chrome (current) | MAN-DUE-01, MAN-DEAL-01, MAN-WA-01, MAN-PDF-01, MAN-SHARE-01, MAN-A11Y-01 (TalkBack) |
| D2 | iPhone, Safari (current iOS) | the same, plus MAN-DUE-01 step 10 (fast wheel picker) and MAN-PDF-01 step 3 |
| D3 | Desktop Chrome (macOS or Windows) | MAN-AUTH-01, MAN-DUE-01, MAN-WA-01 step 2 (popups blocked) |
| D4 | Desktop Safari or Firefox | MAN-DUE-01, MAN-PDF-01 |

## 2. Synthetic data to create first (once, on D3)

1. Sign in (this is MAN-AUTH-01 steps 1–2; note the result).
2. **+ Deal**: brand `UAT Brand <today's date>`, WhatsApp = your own test
   number, scope `UAT satu video`, fee `1500000`. Save.
3. Open the deal, press **Lanjut ke …** until it reads `Tahap saat ini:
   Invoice`, then **Buat invoice** and follow **Lihat invoice … →**.
4. Press **Tandai sudah dikirim**. Leave the due date empty. Press **Buat
   tautan berbagi**.

That one invoice serves every check below. Create a second one the same way
if a check leaves it in a state the next check cannot use.

## 3. The checks, in the order that wastes least time

Follow the numbered steps in `docs/testing/MANUAL-UAT.md` exactly; this list
only says where and adds what to watch for.

| Order | Check | Devices | Steps | Blocks a release |
|---|---|---|---|---|
| 1 | MAN-AUTH-01 | D3, private window | 1–3. Step 3 is the part never logged: sign out from the account menu, then open `/deal` and confirm it asks you to sign in again. | Yes |
| 2 | MAN-DUE-01 | D1, D2, D3, D4 | 1–9 on each; step 10 on D2. Tap or click **on the words** `Belum ditentukan`, not the right edge. | Yes (D1 and D2) |
| 3 | MAN-REL-01 | D1 (FAB) + D3 | 1–3. Steps 1 and 2 reuse checks 1 and 2 above; add the revoke: **Cabut tautan**, then reload the private window and expect "Tautan ini tidak ditemukan." | Yes |
| 4 | MAN-DEAL-01 | D1, D2 | 1–3 (deadline picker in the add-deal dialog; the invoice's due date must default to it). | No |
| 5 | MAN-WA-01 | D1, D2, D3 | 1–4. Send only to yourself. | No |
| 6 | MAN-PDF-01 | D1, D2, D4 | 1–3. | No |
| 7 | MAN-SHARE-01 | D1, D2 | 1–2. | No |
| 8 | MAN-A11Y-01 | D1 (TalkBack) or D2 (VoiceOver) | 1–3. | No |

Two things change on staging once this autopilot's PRs are merged that are
worth a glance while you are there (neither is a manual check, both have automated
regressions):

- FIND-10 (fixed): after saving a deal's **Nama kontak**, reload the deal.
  It must still be in the stage it was in.
- FIND-12 (fixed): the **Coba lagi** button on the "Gagal memuat." error
  card now asks the server again. It cannot be provoked by hand on staging;
  nothing to check, it is listed so the change is not a surprise.

## 4. What to capture, and what to keep out of it

For each check and device: one screenshot or a short screen recording of the
decisive moment (the picker open, the saved date after reload, the sign-in
page after sign-out).

Before saving a capture, make sure it does **not** show: the address bar of a
public invoice link (`/i/…` is a bearer token), a share link in the link
field, a Google account chooser with other accounts, your password manager,
any notification with personal content, or browser DevTools with cookies.
Crop or blur if it does. Do not record the Google password screen at all.
Store captures outside the repository unless they are clean; a clean one may
go under `docs/receipts/evidence/` in the PR that logs the run.

## 5. How to file the result

Add one row per check and device to the run log at the bottom of
`docs/testing/MANUAL-UAT.md`:

```
| <date WIB> | <MAN-ID, steps run> | <your name> | <device model / OS version / browser + version> | <id or en> | <staging SHA> | PASS or FAIL | <capture file or note; for a FAIL: what happened at which step> |
```

"Signed" means your name in the Tester column of a row you commit yourself.
Then, in the same PR into `staging`:

- MAN-DUE-01 PASS on D1 **and** D2: in `docs/testing/journey-coverage.json`
  set INV-DUE-03 `status` to `manual_verified` and add an `evidence` line
  naming the date, devices and SHA; run `npm run coverage:journeys:report`
  and `npm run coverage:journeys`.
- MAN-AUTH-01 PASS including sign-out: update AUTH-03's `evidence` the same
  way (it is already `manual_verified` for sign-in only).
- Any FAIL: do not change a status. Describe it as a finding (steps, device,
  what you saw) and tell Chris; a FAIL on MAN-DUE-01 or MAN-AUTH-01 blocks
  the release.
- A check you did not run stays pending. Say so in the release PR.

## 6. What only a person can do next

1. Get D1 and D2 in hand (and D4 if no Mac or Firefox is around).
2. Run §2 and §3. Budget about 45 minutes for all eight checks.
3. File the rows (§5).
4. Chris: decide the Production release separately, in a `staging -> main`
   PR with Gate F filled in. Nothing in this autopilot opened one.
