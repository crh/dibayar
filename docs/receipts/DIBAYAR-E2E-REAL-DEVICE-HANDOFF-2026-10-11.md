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

**Update, release-readiness session, 2026-10-11 (later the same day).**
Still `PENDING`, all eight checks. Rechecked on ALPHA: no `adb`, no phone on
USB, no iPhone reachable (`idevice_id` lists none); no Google sign-in was
attempted. The staging alias was verified read-only (GitHub deployment record
and `vercel inspect`): it serves deployment `dibayar-339v892gv`, built from
`390bc38c278c04b7b3062ac6c5caeb544b380705`, with Vercel SSO on. That is
`staging` from **before** the autopilot's work, because PRs #41–#44 and the
follow-up #45 are still unmerged (the session's permission check refused the
merge). So there is no deployed release candidate yet, and a run on today's
staging deployment is not evidence for it. Order of work: Chris merges #44
(merge commit; it carries #41–#43) and then #45 → wait for the `staging`
deployment → note its commit SHA → run §2 and §3 below. Nothing else in this
file changed. Receipt: `DIBAYAR-STAGING-RELEASE-READINESS-2026-10-11.md`.

**Update, post-merge staging acceptance, 2026-10-11 (evening).** The
candidate now exists and is deployed. Still `PENDING`, all eight checks:
nothing below has been run by a person on a device.

| | |
|---|---|
| Candidate (`origin/staging`) | `fe012816bf3691941600d605dcea589187923d1a` — merge commit of PR #45, 2026-10-11 17:27 WIB; it carries #41–#44 |
| Staging alias | `https://dibayar-git-staging-kenji-iwakura.vercel.app` (Vercel SSO on) |
| Deployment the alias serves | `dpl_2gyAk5xL9tmoiM1kPwVx2K4BRohd`, `https://dibayar-j67dyrst2-kenji-iwakura.vercel.app`, Ready, built from `fe01281` (build log: `Branch: staging, Commit: fe01281`), created 2026-10-11 17:27 WIB |
| SHA to write in every run-log row | `fe01281` — unless `staging` has moved since; check first (step 0 below) |

Rechecked on ALPHA: no `adb`, `idevice_id` lists no iPhone. No Google
sign-in or sign-out was attempted. A read-only look through the desktop
Chrome that was already signed in (pages load, no error card, no console
error) is recorded in `DIBAYAR-POST-MERGE-STAGING-ACCEPTANCE-2026-10-11.md`
§4; it is not a run of any check in this file.

The three checks a release waits for, as one sitting (about 20 minutes; the
numbered steps are in `docs/testing/MANUAL-UAT.md`, the full order of work
with the optional checks is §3 below):

0. **Confirm the commit.** Vercel → project `dibayar` → Deployments → the
   newest `staging` Preview deployment: its commit must read `fe01281`. If
   it reads something else, write down that SHA and use it in every row.
1. **MAN-AUTH-01** — desktop Chrome, private window.
   - Open the staging URL, pass Vercel SSO. Expected: Google sign-in is offered.
   - Sign in with the staging test account. Expected: Beranda loads; no
     console error; no address pointing at the Production host.
   - Account menu → sign out. Then open `/deal`. Expected: it asks you to
     sign in again, and shows no deal.
   - Evidence: screenshot of the sign-in page reached from `/deal` after sign-out.
2. **MAN-DUE-01** — real Android phone (Chrome), then real iPhone (Safari).
   Use the synthetic invoice of §2 with no due date.
   - Tap **on the words** `Belum ditentukan`. Expected: the phone's own date picker opens.
   - Choose a date about a month ahead. Expected: the field shows it and `Tersimpan` appears.
   - Reload. Expected: the same date, and `Jatuh tempo: <date>` in the header.
   - Choose a different date, reload. Expected: the new date.
   - **Kosongkan**, reload. Expected: `Belum ditentukan` again.
   - Once in English (Pengaturan → Bahasa antarmuka): steps 2–5 of the check.
   - Try a year before 2000 or after 2099. Expected: not offered, or a hint and nothing saved.
   - iPhone only: spin the wheel quickly through several dates, tap Done,
     reload. Expected: the last date shown, not an earlier one.
   - Evidence, per phone: one capture of the picker open, one of the saved
     date after the reload.
3. **MAN-REL-01** — phone for the FAB, desktop for the private window.
   - Phone: **+** → synthetic deal → **Lanjut ke …** until Invoice → **Buat
     invoice** → **Tandai sudah dikirim** → set a due date → **Buat tautan berbagi**.
   - Open the link in a private window. Expected: the invoice, without signing in.
   - **Cabut tautan**, reload the private window. Expected: "Tautan ini tidak ditemukan."
   - While there (FIND-10, fixed): save the deal's **Nama kontak**, reload.
     Expected: the deal is still at Invoice, not back at Masuk.
   - Evidence: capture of the not-found page (crop the address bar: `/i/…` is a bearer token).

File each result as a row in the run log (§5). Blank rows for this candidate
are under the run log in `docs/testing/MANUAL-UAT.md`.

## 1. What to test, and on what

| | |
|---|---|
| URL | `https://dibayar-git-staging-kenji-iwakura.vercel.app` (Vercel SSO stays on; do not make it public) |
| Commit under test | **Now `fe012816bf3691941600d605dcea589187923d1a`, deployed (see the update above).** Written before the merge: the `staging` deployment **after** the autopilot's PRs (#41, #42, #43 and the NAV-08 PR) are merged. When this file was written none was merged and `origin/staging` was still `390bc38c278c04b7b3062ac6c5caeb544b380705`; a PASS on that commit is not evidence for the candidate that contains this work. Before starting, open the Vercel deployment of the `staging` branch, note its commit SHA, and write that SHA in the log. |
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
