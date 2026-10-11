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
| C2 | DEAL-DETAIL-02 contact name | DONE (real, both projects) | PR 2 (FIND-10 fix), `e2e/deals/patch-keeps-stage.spec.ts` |
| C3 | DEAL-DETAIL-04 WhatsApp from deal detail | DONE (real, both projects) | PR 3 |
| C4 | INV-STATUS-07 failed status update | DONE (real: stub-free 409; plus a partial stubbed test) | PR 3 |
| C5 | SET-05 reset template | DONE (real, both projects) | PR 3 |
| C6 | SET-07 incomplete issuer notice | DONE (real, both projects; fixture precondition) | PR 3 |
| C7 | SET-08 failed settings save | DONE (real: stub-free 400; plus a partial stubbed test) | PR 3 |
| C8 | A11Y-04 reduced motion | DONE (real, both projects; see the classification note) | PR 3 |
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

### CI on PR #41 (final head `d7daa53877c64c0df3c310086d40d01acc630ad8`)

| Run | Workflow | Result |
|---|---|---|
| `38110369609` | `CI` (pull_request) | success: `lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit` all green; `e2e-cross-browser` skipped by design |
| `38110372060` | `Journey coverage (full)` (dispatched on the branch) | **PASS**: 131 of 131 real claims; E2E 237 passed / 0 failed / 0 flaky / 25 skipped; ux-audit 69 passed |

Earlier heads: `a515f2d` (`38108254227`, `38108254433`) and `898d651`
(`38108960056`, `38108962139`), all success. Both Codex threads resolved.

### Merge: not done

`gh pr merge 41 --squash --match-head-commit d7daa53…` was refused by this
session's permission classifier ("Merge Without Review"). It was tried once
and not worked around. PR #41 is therefore green, reviewed and **unmerged**;
`origin/staging` is still `390bc38`. The later PRs of this mission are
stacked on it (each contains the commits of the one before) and are meant to
be merged in order, with **Create a merge commit**, by Chris or by a session
that is allowed to merge.

## 5. PR 2 — FIND-10: a contact edit moved the deal back to Masuk (product fix)

Branch `fix/deal-patch-keeps-stage-2026-10-11`. Found while writing the
DEAL-DETAIL-02 journey; fixed here on its own, as the brief asks for a
product defect. No migration, no data change, no new policy: a PATCH now
changes only what it names.

### The defect

Saving a deal's contact name, or repairing its WhatsApp number (on deal
detail, on invoice detail with **Simpan & kirim**, or in the Beranda queue),
also set the deal's stage to **Masuk** and wrote a `<stage> → Masuk` entry
into its history. The page kept showing the old stage until its next load, so
nothing looked wrong when saving.

Cause: `dealPatchSchema` was `dealInputSchema.partial()`. zod's `partial()`
keeps a field's default, so every `PATCH /api/deals/:id` without a `status`
was parsed as `status: "MASUK"`. The schema line dates from the M1 slice
(`65393b6`, 2026-07-14). The first screen to send such a PATCH was the
Beranda queue's number repair (`7633904`, 2026-08-09); the contact name and
the deal-detail repair came with T-17 (`f696973`, 2026-08-23), which also
introduced the stage history. All three commits are ancestors of
`origin/main`, so the defect is on Production.

Why nothing caught it: the unit test for "a non-status update records no
transition" used a deal already at Masuk, and the contact-repair journey
never read the stage after saving.

### The fix

`src/lib/deal-validation.ts`: the patch schema overrides `status` with a
plain enum before `partial()`, so it has no default. One line and its
comment. No other application file changed.

### Regression tests

| Test | Proves | Red before the fix |
|---|---|---|
| `src/lib/deal-validation.test.ts`, `dealPatchSchema` (3 tests) | a patch without a status parses without one; a sent status still works; other rules kept | yes (1 of 3) |
| `src/lib/deals.test.ts`, "keeps the deal's stage and records no transition when a patch carries … but no status" (4 patch shapes × 5 non-Masuk stages) | `updateDeal` neither changes the stage nor records a transition | yes (4 of 4) |
| `e2e/deals/patch-keeps-stage.spec.ts`, "a contact name typed on deal detail is saved, survives a reload, and leaves the deal's stage and history alone" | DEAL-DETAIL-02 and the bug on a Nego deal: value, stage, history list, board column after reload | yes: PATCH answered `status: "MASUK"` |
| same file, "a WhatsApp number repaired from invoice detail leaves the deal at Invoice" | the costliest path: an invoiced deal at Invoice | yes: `"MASUK"` |
| `e2e/deals/contact-repair.spec.ts` (existing, now also reads stage and history) | the repair on deal detail | yes |

The E2E "red" runs were made against a build of the unfixed schema (fix
stashed, `npm run e2e:build`, 3 of 3 failed), then the fix was restored and
rebuilt: 12 of 12 over two repeats in both projects.

### Inventory

- DEAL-DETAIL-02: `not_covered` → `automated_real_interaction`, `chromium` and
  `chromium-mobile`. Visible control: the **Nama kontak** field and
  **Simpan** on deal detail, reached through the board card menu. Outcome:
  "Nama kontak disimpan". Persistence: value after reload and after
  re-entering from the board; stage, history and board column unchanged.
  Negative control: the unfixed build (above).
- INV-WA-03 (already real through ux-audit): the invoice-detail repair test
  added as a second real reference. DEAL-DETAIL-03: unchanged apart from
  the stage assertions in its existing test.
- The Beranda queue's repair (HOME-04, `automated_partial`) gets no browser
  regression here; that path is covered at repository level by
  `src/lib/deals.test.ts`.
- FIND-10 (high, fixed) and FIND-11 (low, open) added.
- Real: 75/93 (80.6%), was 74/93. P0 28/30, outstanding P0/P1 4, unchanged.

### Not done, on purpose

- No stored row is repaired. Deals already moved to Masuk this way stay
  there. One reset since T-17 (2026-08-23) has a `→ Masuk` history entry at
  the time of the edit; a Beranda repair between 2026-08-09 and T-17 left
  none. A read-only Production count of such entries is therefore a lower
  bound, and it needs Chris.
- Two older quirks of the same schema, reached by no screen today: a PATCH
  with `feeIdr` null or empty stores 0, and `deadline: null` stores
  1970-01-01 (`z.coerce`). "A patch changes only what it names" holds for
  omitted keys; these two are named keys with a surprising meaning.
- FIND-11 (low, open): a saved contact name cannot be removed. Emptying the
  field sends an empty PATCH, the page says "Nama kontak disimpan" and puts
  the old name back (verified in the browser). Needs a small decision.

### Validation

Local, on the PR branch (ALPHA, 2026-10-11), with the fix:

| Gate | Result |
|---|---|
| lint / typecheck | 0 / 0 |
| `npm test` | 987 / 987 (980 before; +3 schema tests, +4 repository tests) |
| build and e2e:build | 0 |
| journey self-test, `coverage:journeys` | 37 / 37; OK, real 80.6%, P0 real 93.3%, 4 outstanding P0/P1 |
| the three regression E2E tests, two repeats, both projects | 12 / 12 |
| full `test:e2e`, both projects | 241 passed, 0 failed, 25 skipped |
| `coverage:journeys -- --results` on that run | 129 real claims passed; 4 not exercised (the ux-audit ones) |

### Independent review (PR #42, head `a4c0e60`)

A separate read-only reviewer agent. Verdict: **approve with nits**, no P1;
it reproduced the zod behaviour itself and confirmed the fix, the create
path, the six PATCH callers (two send a status, four do not) and that no
other schema has the pattern.

| # | Sev. | Finding | Disposition |
|---|---|---|---|
| P2-a | P2 | "Each affected deal has a `→ Masuk` history entry" is wrong for Beranda repairs made before the stage history existed; the count for Chris is a lower bound; "since `65393b6`" is the schema line, not the first trigger | Fixed in the receipt, inventory, backlog and STATE.md |
| P2-b | P2 | The invoice-detail repair test was attached to DEAL-DETAIL-03, whose control it never touches; FIND-10's action list lacked INV-WA-03 and HOME-04 | Fixed: reference moved to INV-WA-03, both actions listed; the missing Beranda browser regression is stated |
| P3-a | P3 | `stageHistory()` had a dead conditional and no auto-wait | Fixed: a retried `toHaveText([...])` on the history labels |
| P3-b | P3 | Pre-existing `z.coerce` quirks in the patch schema (fee null → 0, deadline null → 1970) | Not changed (no screen sends them); recorded above and in FIND-10 |
| P3-c | P3 | The second E2E test had no timeout headroom | Fixed: `test.setTimeout(60_000)` |
| P3-e | P3 | This section said "pending" | This table |

Checking the reviewer's "nothing Chromium-only, by reading" in the browsers
themselves found two more things, both fixed before the push:

- WebKit, about every second run: the invoice-detail repair test opened the
  add-deal dialog by address (`/deal?tambah=1`) and filled it before React
  had attached, so **Simpan deal** sent nothing and the test timed out. It
  now opens the dialog through the visible **+ Deal** from Beranda. (A test
  problem, not the product's: a person cannot type that fast.)
- Firefox, about one run in eight: the browser cancels its own
  `favicon.ico` fetch when a link is clicked right after a page load, and
  the browser-health guard reported it as a failed request. The guard
  (`e2e/support/test.ts`) now drops a *cancelled* favicon fetch only; any
  other favicon failure and every 5xx are still reported, and
  `npm run test:diagnostics-selftest` still passes.

After that: the two regression tests 32/32 over four repeats in chromium,
chromium-mobile, firefox and webkit, and 20/20 over ten more in Firefox.

CI on the first head `a4c0e60`: `CI` `38111441524` and
`Journey coverage (full)` `38111441540`, both success.

CI: pending, filled in below.

## 6. PR 3 — six P2 actions (Workstream C, part 1)

Branch `test/p2-detail-settings-status-a11y-2026-10-11`, stacked on PR #42.
Tests, one fixture action, inventory and docs. No `src/` change.

| Action | Registered test (file → title) | Projects | Visible control | Outcome asserted | Persistence / no mutation | Classification |
|---|---|---|---|---|---|---|
| DEAL-DETAIL-04 | `e2e/deals/deal-whatsapp.spec.ts` → "Buka WhatsApp on deal detail opens one chat with the deal's own number" | chromium, chromium-mobile | **Buka WhatsApp** on deal detail (reached through the board card menu) | one new tab at exactly `https://wa.me/628110000002`, one request, no Referer, `window.opener` null | the deal page is unchanged (no repair form, no error) | real |
| INV-STATUS-07 | `e2e/invoices/status-failure.spec.ts` → "a status change the server refuses (the invoice was paid in another tab) shows an error and changes nothing" | both | **Tandai jatuh tempo** in a tab that still shows Terkirim | server answers 409 itself; alert "Status invoice belum bisa diperbarui."; chip and actions unchanged; no paid moment | reload shows Lunas (the other tab's change) and never Jatuh tempo | real |
| | same file → "a failed Tandai lunas shows an error, keeps the status after a reload, and a second try works" | both | **Tandai lunas** | alert; chip unchanged; retry succeeds | stored status read through the API is SENT; reload shows Terkirim | partial (failure injected with `page.route`) |
| SET-05 | `e2e/settings/template-reset.spec.ts` → "Kembalikan ke bawaan restores one template's default, leaves everything else, and the next message uses it" | both | **Kembalikan ke bawaan** under each template | that template is the default text; "Tersimpan" | reload; the other template and issuer/bank fields unchanged; the next WhatsApp message (local stub) is the default text | real |
| SET-07 | `e2e/settings/incomplete-issuer.spec.ts` → "missing issuer and bank details warn on invoice detail, in Pengaturan and on the brand's page, until they are saved" | both | nav → Invoice → invoice; nav → Pengaturan; **Simpan pengaturan** | notice on invoice detail and in Pengaturan; "Detail rekening belum lengkap." for the recipient; an incomplete form is refused with three field errors and sends no request | after a complete save all three notices are gone, also after reload | real (the starting state is a fixture precondition) |
| SET-08 | `e2e/settings/save-failure.spec.ts` → "a save the server rejects (WhatsApp number too long) shows an error, keeps what was typed, and stores nothing" | both | **Simpan pengaturan** | server answers 400 itself; alert "Gagal menyimpan. Coba lagi."; no "Tersimpan"; typed values still in the form | reload shows the seeded values, including the fields that were valid; the corrected form then saves | real |
| | same file → "a failed save shows an error and keeps the form; pressing Simpan again saves it" | both | **Simpan pengaturan** | alert; form kept; retry saves | stored settings read through the API are the seeded ones | partial (`page.route`) |
| A11Y-04 | `e2e/smoke/reduced-motion.spec.ts` → "opening the account menu and the add-deal dialog, and marking an invoice paid, all work with no motion" | both | **Menu akun**, Escape, **+ Deal**, **Tutup**, nav → Invoice, **Tandai lunas** | each control works; after each step the longest running animation and the longest computed animation/transition duration on the page are ≤ 0.01 ms; the menu is at opacity 1, no transform | paid status after reload | real |
| | same file → "control: with no motion preference the account menu animates and buttons have transitions" | both | **Menu akun** | the same measurement reports 200 ms and ≥ 150 ms | — | partial (the measurement's control) |

### Classification notes

- INV-STATUS-07 and SET-08 are real because of the stub-free test in each
  file. The backlog had expected `page.route` here; that version is kept as
  a second, partial reference. Had only the stubbed test existed, both would
  be `automated_partial`, as INV-DUE-06 is.
- A11Y-04 is classed real, and this is the one judgement call: the rules
  class "screenshots, axe scans, text presence" as partial. This test is
  none of those. It drives the controls and asserts their outcomes, and what
  it asserts about motion is the browser's own animation state after each
  interaction. If Chris reads the rule more strictly, the inventory status
  is the only thing to change.
- SET-07: the state "never saved Pengaturan" cannot be produced through the
  form (it refuses an empty required field), so it is the documented
  fixture precondition `incomplete-issuer-settings` (deletes the fixture
  owner's `UserSettings` row on the guarded database; the next seed restores
  it). Nothing after it is seeded.

### Negative controls

Six mutations in `src/`, one build, run on `chromium`, reverted from Git
(`git diff -- src` empty), rebuilt:

| Mutation | Fails |
|---|---|
| deal detail opens WhatsApp twice | DEAL-DETAIL-04 (tab list) |
| `updateStatus` swallows the error | both INV-STATUS-07 tests (no alert) |
| `resetTemplate` saves the form unchanged | SET-05 (value) |
| invoice detail ignores `hasIncompleteIssuer` | SET-07 (no notice) |
| settings form shows "saved" on a failed response | both SET-08 tests (no alert) |
| the reduced-motion rule removed from `globals.css` | A11Y-04 (motion > 0.01 ms); its control still passes |

### Cross-browser

The scheduled `e2e-cross-browser` job runs every spec in Firefox and WebKit
too, so the six files were run there locally. Two things surfaced and were
fixed in the tests: WebKit sends an empty `Referer` header where the others
send none (asserted as "no referring address"), and one Firefox run in about
eight reported an aborted request when the reduced-motion test jumped to
`/invoice` with `page.goto`; it now uses the nav link. After that: 60/60
over five repeats of those two files in four engines.

### Observations, not changed

- The invoice-detail notice says "di Pengaturan" but is plain text, not a
  link.
- **Kembalikan ke bawaan** saves the whole form at once, so an unsaved edit
  in another field is saved with it.
- The issuer WhatsApp field has no length limit in the form; the server's
  limit (32) surfaces only as the generic "Gagal menyimpan. Coba lagi.".

### Inventory after this PR

Real 81/93 (87.1%), was 75/93 after PR 2 and 74/93 at the start. P0 real
28/30, outstanding P0/P1 4, both unchanged. `not_covered` 1 (NAV-08).

### Validation

Local, on the PR branch (ALPHA, 2026-10-11):

| Gate | Result |
|---|---|
| lint / typecheck | 0 / 0 |
| `npm test` | 987 / 987 |
| build and e2e:build | 0 |
| journey self-test, `coverage:journeys` | 37 / 37; OK, real 87.1%, P0 real 93.3%, 4 outstanding P0/P1 |
| the six new files, four engines | 36 tests: chromium and chromium-mobile 18/18; Firefox and WebKit 18/18 after the two fixes above |
| full `test:e2e`, both projects | 259 passed, 0 failed, 25 skipped |
| `coverage:journeys -- --results` on that run | 141 real claims passed; 4 not exercised (the ux-audit ones) |

### Independent review (PR #43, head `5e0bc37`)

A separate read-only reviewer agent. Verdict: **approve with nits**, no P1.
It confirmed the stub-free claims, the fixture action's guards, the title
references and the counts, and that the added settings saves (10 per project,
up from 4) stay under the 20-per-minute limiter.

| # | Sev. | Finding | Disposition |
|---|---|---|---|
| P2-1 | P2 | After `page.reload()`, `template-reset` clicked and `save-failure` typed before React could have attached (a hang or a lost value, not a false pass) | Fixed: both re-enter Pengaturan through the navigation before the next interaction |
| P2-2 | P2 | A11Y-04 as real is borderline; `getAnimations()` cannot see an animation that already finished, the comment claimed it could, and the control did not cover that leg | Kept real, strengthened: every page now records the browser's `animationend` / `transitionend` events with how long each ran. Under the preference the menu's animation must be seen to end and nothing may have run longer than 0.01 ms; the control must see one that ran 200 ms. Comment corrected. The classification stays a disclosed judgement call |
| P3 | P3 | The second tab of the 409 test was outside the health guard | Fixed: `watchPageHealth()` |
| P3 | P3 | `template-reset` could print the message, share link included, on failure | Fixed: the link is replaced before the comparison |
| P3 | P3 | `deal-whatsapp` relied on spec order | Fixed: reseeds first |
| P3 | P3 | Clicks right after `goto` could land before hydration (unconfirmed; same pattern as existing specs) | Not changed; passed 64/64 below |

After the fixes: the five touched files 64/64 over two repeats in chromium,
chromium-mobile, firefox and webkit.

CI: pending, filled in below.
