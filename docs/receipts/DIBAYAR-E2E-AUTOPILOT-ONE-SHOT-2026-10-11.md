# Dibayar — one-shot E2E journey closure autopilot (2026-10-11)

Brief: `DIBAYAR-ONE-SHOT-E2E-JOURNEY-AUTOPILOT-2026-10-11.md` (Chris, 2026-10-11).
Authorization used: branch, commit, push, open PRs into `staging`, merge those
PRs into `staging` after review and green CI. Nothing here touches `main`,
Production, Vercel, Neon or Google OAuth settings.

This file is written in stages, one per PR. A section that says "pending" is
not done.

## 1. Baseline (verified, not assumed)

| | |
|---|---|
| `origin/staging` at start | `390bc38c278c04b7b3062ac6c5caeb544b380705` (PR #36 merge) |
| `origin/main` at start | `308a339e7de817aa37378d263d51f25c78ea4f09` (PR #23 release merge) |
| Ruleset `24837655` | active on `main` and `staging`, no bypass actors; required checks `lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit`; review threads must be resolved; merge or squash only |
| Open PRs at start | #39 (Dependabot, into `main`; not part of this mission, not touched) |
| Standard CI on `390bc38` | run `38091474688`, success |
| Full real-claim run on `390bc38` | dispatched for this mission: run `38105931522`, **PASS**, 131 of 131 real claims (action × project) exercised and passed; E2E 231 passed / 25 skipped, ux-audit 69 passed |
| Inventory | 95 actions, 93 applicable; `automated_real_interaction` 74/93 (79.6%); P0 real 28/30; `not_covered` 8; outstanding P0/P1 4 (INV-DUE-03, DEAL-CREATE-07, INV-DUE-06, A11Y-01) |
| Test database | `127.0.0.1:55432/dibayar_test` only, through `scripts/e2e-fixtures.ts` (target pinned, `E2E_FIXTURE_CONFIRM=non-production`) |

The local workspace had four untracked paths at start (`compose.yml`, two
receipts dated 2026-10-01, `src/generated/`). They were left exactly as they
were and are in no commit of this mission.

## 2. Task ledger

Statuses: TODO / IN_PROGRESS / DONE / BLOCKED. Updated per PR.

| Task | What | Status | Where |
|---|---|---|---|
| B1 | Long journey: deal → paid invoice → recipient | DONE | PR 1, `e2e/journeys/deal-to-paid.spec.ts` |
| B2 | Long journey: settings → recipient | DONE | PR 1, `e2e/journeys/settings-to-recipient.spec.ts` |
| B3 | Long journey: resilience and permissions | DONE | PR 1, `e2e/journeys/resilience-permissions.spec.ts` |
| C1 | NAV-08 route error boundary | TODO | Phase 2 |
| C2 | DEAL-DETAIL-02 contact name | TODO | Phase 2 |
| C3 | DEAL-DETAIL-04 WhatsApp from deal detail | TODO | Phase 2 |
| C4 | INV-STATUS-07 failed status update | TODO | Phase 2 |
| C5 | SET-05 reset template | TODO | Phase 2 |
| C6 | SET-07 incomplete issuer notice | TODO | Phase 2 |
| C7 | SET-08 failed settings save | TODO | Phase 2 |
| C8 | A11Y-04 reduced motion | TODO | Phase 2 |
| A1 | MAN-DUE-01 native picker, real devices | BLOCKED (no device, see §3) | Phase 3 handoff |
| A2 | MAN-AUTH-01 real Google sign-in and sign-out | BLOCKED (needs a person, see §3) | Phase 3 handoff |
| A3 | MAN-REL-01 | BLOCKED (contains A1 and A2) | Phase 3 handoff |
| A4 | MAN-DEAL-01 | BLOCKED (phone) | Phase 3 handoff |
| A5 | MAN-WA-01 | BLOCKED (phone, WhatsApp app) | Phase 3 handoff |
| A6 | MAN-PDF-01 | BLOCKED (phone) | Phase 3 handoff |
| A7 | MAN-SHARE-01 | BLOCKED (phone) | Phase 3 handoff |
| A8 | MAN-A11Y-01 | BLOCKED (screen reader on a phone) | Phase 3 handoff |

## 3. Workstream A — real-device feasibility (inspected once, 2026-10-11)

What this machine (ALPHA, Linux) can reach:

| Route | Found | Usable for a manual check |
|---|---|---|
| Android over `adb` | `adb` is not installed; no phone on USB | No |
| iPhone over `libimobiledevice` | tools installed, `idevice_id -l` cannot reach a device | No |
| Device cloud (BrowserStack, Sauce Labs, LambdaTest, …) | no account, credential or config in the environment or the repository | No, and none was signed up for |
| Emulators / simulators | none installed (and emulation does not count, `MANUAL-UAT.md`) | No |
| Desktop Chrome through the Claude browser extension | one browser connected (Windows, not this machine) | Desktop Chrome only; see Phase 3 |

No phone-based check can be executed from here. Nothing was bought,
installed or signed up for. Every phone check, and the Google sign-in and
sign-out of MAN-AUTH-01 (an interactive third-party login that needs the
account holder), stays `PENDING — requires real device/user action`. They are
handed over in Phase 3; INV-DUE-03 stays `manual_pending`.

## 4. PR 1 — three long cross-page journeys (Workstream B)

Branch `test/creator-cross-page-journeys-2026-10-11`, from `origin/staging`
`390bc38`. Tests, one helper file and docs. No `src/` change, no fixture
change, no inventory change, no CI change, no dependency.

### What was added

| File | Test title | Projects |
|---|---|---|
| `e2e/journeys/deal-to-paid.spec.ts` | a deal created from Beranda becomes an invoice the brand can read and download, and is then marked paid | `chromium`, `chromium-mobile` |
| `e2e/journeys/settings-to-recipient.spec.ts` | issuer, bank and template changes saved in Pengaturan reach the WhatsApp message, both PDFs and the brand's page | `chromium`, `chromium-mobile` |
| `e2e/journeys/resilience-permissions.spec.ts` | an expired session and a revoked link stop every further read and write, and nothing attempted is stored | `chromium`, `chromium-mobile` |
| `e2e/support/journey.ts` | helpers: `press()` (tap on the phone project, click on desktop), `typeInto()`, `responseTo()`, `rupiah()`, `expectNoOwnerControls()` | — |

All three are tagged `@critical`, so the required `e2e-critical` check runs
them in both projects on every PR. Each has one `test.step` per checkpoint;
the checkpoint list is the header comment of each file and
`docs/testing/E2E.md`.

**B1, deal to paid.** Beranda (monthly total Rp 12.700.000) → **+ Deal**
(floating button on the phone, top-bar link on desktop) → six fields typed
(keyboard on the phone) → saved, reload → **Lanjut ke Nego** from the board
card's menu → **Lihat detail** → Deal, Konten, Invoice on deal detail, history
after reload → **Buat invoice** → the draft `INV/yyyy/mm/nnn` for Rp 2.500.000
→ **Tandai sudah dikirim**, reload → **Buat tautan berbagi** → **Kirim lewat
WhatsApp** (local stub): the deal's number, the amount, and exactly the link
the page shows; share requests are `POST /share` then `POST /share/ensure`
(reused, not rotated) → recipient context with no session: number, brand,
contact name, issuer, scope, total, payment terms, bank details, no owner
control (`expectNoOwnerControls`), no sideways scroll, PDF downloaded by
clicking **Unduh PDF** and read with `pdftotext`; `/invoice/<id>` sends the
recipient to sign-in → the owner's PDF text equals the recipient's →
**Tandai lunas**, reload → invoice list (Lunas group) → deal board
(**Lanjut ke Dibayar**, reload) → Beranda Rp 15.200.000, "2 invoice lunas" →
the recipient's link still works.

Due date in B1: the `chromium` project types `15 Jan 2030` with the keyboard
(`focusFieldForTyping`, no `fill()` on the hidden input) and the recipient
page and PDF must print `Jatuh tempo: 15 Januari 2030`. Every other project
(the phone project, and Firefox and WebKit in the scheduled tier) sets no due
date, because choosing a date in a native picker cannot be driven
(MAN-DUE-01) and segment typing differs per engine, and the recipient page
and PDF must print no due date at all.
No fixture stands in for the picker and no picker interaction is claimed.

**B2, settings to recipient.** Beranda → **Pengaturan** → issuer name,
address, WhatsApp number, email, three bank fields and the send template
rewritten → saved, reload (the untouched reminder template is still the
default) → invoice list → seeded sent invoice: no settings notice; the
WhatsApp message is the saved template token by token, addressed to the
deal's contact, and its link is the shown link (`POST /share/ensure` only) →
owner PDF: new issuer and bank lines, none of the old values → recipient
page: the same in the `Dari` and `Pembayaran ke` blocks, none of the old
values, the template text is not on the document, no owner control →
recipient PDF text equals the owner's → recipient reload → Pengaturan again,
Back, Forward.

**B3, resilience and permissions.** Disposable owner session: Beranda →
**Deal** → card menu → deal detail → a contact name entered (`fill()`) →
`expire-disposable-session` (the existing guarded fixture action) →
**Simpan**: 401, "Nama kontak belum bisa disimpan. Coba lagi.", the typed
text still in the field → **Lanjut ke Deal**: 401, "Deal belum bisa
diperbarui. Coba lagi.", stage unchanged → nav link, Back, Forward, reload:
sign-in, none of the owner's data → the same token in a fresh browser
(Auth.js has deleted the expired row by then): sign-in, API 401 → the shared valid session: no contact name, stage Nego,
one history entry → the second user (reads only): empty board, not-found page, API 404 →
recipient: the expired link says expired, the active link shows the invoice,
the owner revokes it through **Cabut tautan** → reload 404, Back (expired
page), Forward (not found, no invoice, no PDF link), PDF API 404.

### Preconditions that come from fixtures

Base seed only (`scripts/e2e-fixtures.ts seed`, unchanged): the fixture
owner, their settings, the seven deals, the two invoices and their two share
rows, the disposable session, the second user. B3 also uses the existing
`expire-disposable-session` action; expiring a session is the precondition
under test there, not an interaction. No interaction under test is seeded.

### Negative controls

Three mutations in `src/`, built with `npm run e2e:build`, run on `chromium`,
then reverted from Git (`git diff -- src` empty afterwards) and rebuilt:

| Mutation | Journey | Failed at |
|---|---|---|
| `createInvoice` stores `feeIdr + 1` | B1 | step "Buat invoice on deal detail creates a draft for the deal's fee" |
| the document model drops the issuer's WhatsApp number | B2 | step "the owner's PDF carries the new issuer and bank details" (`the PDF has the line "628122200033"`) |
| deal detail ignores a failed contact-name save | B3 | step "Simpan and Lanjut ke Deal are refused, and each says so" |

All three passed again on the reverted build.

### What these journeys are not

- Not inventory evidence. No action's status or test list changed; the
  numerator is 74/93 before and after PR 1.
- Not CI evidence for Firefox or WebKit: the scheduled `e2e-cross-browser`
  job runs them there and this PR does not trigger it. They passed there
  locally (3/3 in each engine) after the Codex fix.
- Not real-device evidence, not real WhatsApp, not real Google sign-in.

### Validation

Local, on the PR branch (ALPHA, 2026-10-11):

| Gate | Result |
|---|---|
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 980 / 980 |
| `npm run build` (Turbopack) and `npm run e2e:build` (webpack) | 0 |
| `npm run test:journey-coverage` | 37 / 37 |
| `npm run coverage:journeys` | OK, 95 actions (93 applicable), real 79.6%, P0 real 93.3%, 4 outstanding P0/P1 |
| the three journeys, `--repeat-each=3`, both projects | 18 / 18 |
| `npm run test:e2e` (full, both projects) | 237 passed, 0 failed, 25 skipped (231 before this PR) |
| `coverage:journeys -- --results` on that run | 127 real claims passed; 4 not exercised (NAV-06, DEAL-STAGE-04, DEAL-STAGE-05, INV-WA-03: their evidence is in ux-audit, which this local run did not include) |

Not run locally: `ux:audit`, `@visual`, the a11y job, Firefox and WebKit. The
PR changes no application code; CI runs the first three.

### Independent review (PR #41, head `a515f2d`)

A separate read-only reviewer agent (no access to this session's reasoning,
read the diff from Git objects, ran nothing). Verdict: **approve with nits**,
no P1.

| # | Sev. | Finding | Disposition |
|---|---|---|---|
| P2-1 | P2 | The browser-health guard watches only `page`; the recipient and the other browsers of the journeys were unwatched | Fixed: `watchPageHealth()` in `e2e/support/journey.ts` records page exceptions and HTTP 5xx on every extra page and fails the test at the end |
| P3-1 | P3 | "The share link is never printed" overstated (Playwright's report records `goto` addresses; `toContain` on the message would print it on failure) | Fixed: message checks are booleans; the comment now says what is and is not kept out of failure output |
| P3-2 | P3 | B1's Jakarta-day guard ran after the Beranda total it explains | Fixed: checked at the start of that step too |
| P3-3 | P3 | "Typed" was true for B1 only; B2 and B3 use `fill()` | Fixed in wording (comments, receipt): "entered", `fill()` in both projects |
| P3-4 | P3 | Graphs §7 listed PUB-02 and INV-OWN-01 for B3, which opened no unknown token and wrote nothing as the second user | Fixed: B3 now opens the invalid token too; INV-OWN-01 marked "reads only" |
| P3-5 | P3 | Receipt said seven fields; B1 types six | Fixed |
| P3-6 | P3 | "Not from a cache" proves less than it says (Playwright's Chromium has no back/forward cache); suggested asserting `goForward()` is not null | Comment reworded. The suggested assertion was tried and is wrong here: `goForward()` returns null for App Router's history navigation although the page does move, so the existing URL assertions stay as the proof |
| P3-7 | P3 | B2's old-values list lacked the seeded issuer email | Fixed, and asserted equal to the manifest's |
| P3-8 | P3 | "Same token refused" tests a row Auth.js has already deleted | Wording fixed |
| P3-9 | P3 | Backlog said "see below" for a section above | Fixed |
| P3-10 | P3 | Receipt said "one history entry"; code did not count | Fixed: the history list is asserted to have exactly one item |

After the fixes: typecheck 0, lint 0, the three journeys 12/12 over two
repeats in both projects.

### Codex review (the repository's GitHub reviewer, on `a515f2d`)

Two inline threads, both accepted:

| Sev. | Finding | Disposition |
|---|---|---|
| P1 | B1 typed Chromium's date-segment sequence whenever `isMobile` was false, so the scheduled Firefox/WebKit run would type the wrong date | Fixed: typing and every assertion that depends on it are gated on the `chromium` project, as `due-date-integrity.spec.ts` does. Verified by running the three journeys in `firefox` and `webkit` locally: 12/12 across the four projects |
| P2 | The Jakarta-midnight guard could fail a run that crossed an ordinary midnight, although nothing in B1 depends on the day | Fixed: replaced by a month-boundary guard, the only boundary Beranda's monthly total depends on |

This also corrects the "what these journeys are not" list below: they do run
in Firefox and WebKit in the scheduled tier, and were run there locally once.

CI: pending, filled in below.
