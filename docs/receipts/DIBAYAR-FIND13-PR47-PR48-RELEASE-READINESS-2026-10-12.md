# Dibayar — FIND-13 fix, PR #47 and PR #48 reviews, release readiness (2026-10-12, afternoon)

**Verdict: `NO-GO / PENDING_OPERATOR`.**

Three PRs are ready for Chris to merge, none is merged, and nothing in them
is on `staging` yet. `staging` is still `eea298d`, and that commit is green
on every automated check. A release still waits for what only a person can
supply: the three manual checks on real devices, the FIND-10 count on
Production, and Chris's decisions.

This receipt succeeds `DIBAYAR-POST-PR46-RELEASE-READINESS-2026-10-12.md`
(same day, morning), which is kept as written.

Times are WIB (UTC+7). Run IDs link to GitHub.

## 1. What Chris has to do, in order

1. **Merge PR #48**, then **PR #49**, then **PR #47** (§9 says why that
   order, and what to check after each).
2. After the last merge: confirm `CI` on the new `staging` SHA, dispatch
   `Journey coverage (full)` and `CI` on `staging`, confirm the alias serves
   that SHA (§9).
3. **Run the manual checks on that final deployment** and fill in the sheet
   in §7. Doing them before step 1 means doing them twice.
4. **Run the FIND-10 count on Production**, read-only (§6).
5. **Decide**: enabling GitHub secret scanning (§8.1); FIND-14 (§3.4);
   FIND-09 and FIND-11.
6. **Open the release PR** `staging -> main` with the body in §10.

## 2. State of the branches and PRs

| | SHA | State |
|---|---|---|
| `origin/main` | `308a339e7de817aa37378d263d51f25c78ea4f09` | unchanged |
| `origin/staging` | `eea298d94dbf71925a542a8e74d5a36ff4217734` | unchanged; no push, no merge in this session |
| PR #48, test guard and reduced-motion test | `6536661` | **open, not merged.** Review thread answered and resolved. `CI` green |
| PR #49, FIND-13 fix | `41ad8f3` | **open, not merged.** New in this session. `CI`: §3.5 |
| PR #47, documents | this branch | **open, not merged.** Both review threads answered and resolved |
| PR #39, Dependabot, base `main` | `3c8efd0` | not touched |

Ruleset 24837655: active on `main` and `staging`, 0 bypass actors, rules
deletion / non-fast-forward / pull request / required status checks (read
through the API today).

Merge authorization: none was given for this session, so none was
attempted.

## 3. FIND-13: text typed before the page's scripts run was cleared

### 3.1 Cause

`/deal?tambah=1` arrives from the server with the add-deal dialog already
open. On a slow connection the form is on screen, and usable, before the
page's scripts have run. Two things then went wrong when they did run:

1. **The typed text was overwritten.** The form's fields take their value
   from React state, which starts empty. React leaves what is in a field
   alone when it first takes over the page, but the state still says
   "empty", and the next render writes that back. The dialog causes that
   render at once (it removes `?tambah=1` from the address). Result: every
   field typed into before the scripts ran went blank.
2. **The keyboard was moved to the close button.** On opening, the dialog
   moves focus to its first control, which is **×** (Tutup), even when the
   person is already typing in a field. The rest of the word then goes
   nowhere, and a space or Enter presses **Tutup**, which closes the dialog
   and discards the form. This second part was not in the original finding;
   the new test found it.

### 3.2 Fix (PR #49)

| File | Change |
|---|---|
| `src/app/(app)/deal/deal-client.tsx` | once, before the first re-render, take what the fields hold as the form's state |
| `src/components/deals/deal-form.tsx` | `readDealFormFields()`, which does that reading; a `formRef` prop |
| `src/components/deals/add-deal-dialog.tsx` | on opening, do not move focus if it is already inside the dialog |

No change to the API, validation, the save path, the copy or the layout.
When the dialog is opened from inside the app (**+ Deal**, the FAB) the
fields are created from the state, the two always agree, and the new code
changes nothing.

Not done on purpose: no wait for the scripts in any test, no longer
timeout, no `test.fail()`, nothing added to the browser-health guard.

### 3.3 Red, then green

New test file `e2e/deals/add-deal-typed-before-scripts.spec.ts`, tagged
`@critical`, so it runs in the required `e2e-critical` job (Chromium desktop
and Chromium at 390 px) and in the cross-browser job (Firefox, WebKit).

How it works: it holds back the page's own script files and nothing else,
opens `/deal?tambah=1`, taps or clicks **Nama brand** and types with the
keyboard, moves to **Kontak WhatsApp** and types the start of a number. It
checks the scripts are still held and the address still says `?tambah=1`.
Then it lets the scripts through and waits for the address to become
`/deal`, which is what a person can see of the scripts having run. It
checks both fields still hold their text and the keyboard is still in the
WhatsApp field, types the rest of the number without touching the field,
fills the remaining fields, and saves. It checks one `POST /api/deals`, the
saved values, the card on the board, and the same after a reload. A second
test types before the scripts, then uses **Tutup**, reopens with **+ Deal**
and checks every field is empty and nothing was saved. No field is ever set
from script.

| Run | Chromium | Chromium 390 px | Firefox | WebKit |
|---|---|---|---|---|
| **Before the fix** (`eea298d` + the test only) | 2 of 2 fail | 2 of 2 fail | 2 of 2 fail | 2 of 2 fail |
| **After the fix**, all four projects, 12 runs | 24 of 24 pass | 24 of 24 pass | 24 of 24 pass | 22 of 24 pass; 2 did not start, see below |
| After the fix, WebKit alone, 10 repeats | | | | 20 of 20 pass |

Every failure before the fix is the same line: **Nama brand** expected the
typed brand and held `""` after the scripts ran.

Unit tests (Vitest, real hydration of server-rendered markup): five added
in `deal-client.test.tsx` and `add-deal-dialog.test.tsx`. With the fix
removed, three of them fail (`expected '' to be 'Brand Awal'`, and focus on
the × button instead of the field); with it, 28 of 28 in those two files
pass.

**The two WebKit runs that did not start.** In 2 of the first 24 WebKit
executions the test failed at its first step: the server-rendered dialog
never appeared while the scripts were held. Cause, measured with a
temporary probe (deleted): the document had arrived complete, with the
dialog in it, and React's own inline script was waiting for the browser's
next frame to put it in place. Headless WebKit drew **no frame at all**: 0
`requestAnimationFrame` callbacks after 13 s, in 8 of 20 probe runs that
followed a Firefox project; Playwright's own screenshot of such a page hangs
too. WebKit run alone: 0 of 60. Two guesses were tested and ruled out (a
mouse move, layout read, resize or screenshot does not start the frames;
moving the test's database reseed to before the page exists does not prevent
it). What triggers it is **not established**. It is not the fix: no
application script has run at that point. On such a page nothing can be
typed, so FIND-13 cannot occur on it either.

What the test does about it: in WebKit only, and only when not one frame
was drawn, it reports itself **skipped** with that reason. Any other reason
for the dialog not showing fails as before. In the 6 final four-project
runs (48 executions) the condition did not occur, so the skip path itself
has **not been seen to fire**. A real phone always draws frames; whether
Safari on an iPhone can show this form before its scripts run is covered by
the optional manual check in §7.

### 3.4 Other forms (assessed, not changed)

The same probe (scripts held, one key typed into each field, scripts
released) on the other pages that the server renders with fields:

| Page | Result |
|---|---|
| Pengaturan | the address field went back to its saved value when the scripts ran; the other eight fields kept the typed key for the 3 s watched, but their state has the same gap, so a later re-render or a save would use the old values |
| Deal detail, WhatsApp repair field | kept the typed key for the 3 s watched; same gap in principle |
| Invoice detail, Beranda, Invoice list | no text field in the server-rendered page |

**Proposed FIND-14 (suggested P3, not fixed):** an edit made on Pengaturan
before the page's scripts run can be lost. Lower risk than FIND-13: nobody
is sent to that page to type at once, and nothing wrong is saved. It was
left out of PR #49 to keep that change to the one path with a failing
test. Chromium only, one probe run; it needs its own regression test before
a fix.

### 3.5 Checks on PR #49

| Check on `41ad8f3` | Result |
|---|---|
| `CI`, pull request, [38236333374](https://github.com/crh/dibayar/actions/runs/38236333374) | success. `lint-typecheck-test` (unit tests, build); `e2e-critical` **256 passed**, 28 skipped (252 before, plus the 4 new executions); `e2e-a11y` 29 passed, 1 skipped; `ux-audit` 69 passed. `e2e-cross-browser` skipped by design |
| `CI`, dispatched, [38236332238](https://github.com/crh/dibayar/actions/runs/38236332238) | success. `e2e-cross-browser`: **588 passed, 0 failed, 3 flaky, 69 skipped**. The new test passed in Chromium, Chromium 390 px, Firefox and WebKit, first attempt, not skipped |
| Local | lint 0; typecheck 0; unit tests 994 of 994 (989 plus 5); default build passes; `e2e-critical` 256 passed, 28 skipped; `coverage:journeys` against that run: 144 real claims passed, 5 not exercised by a critical-only run, as before; `e2e-a11y`: 29 passed, 1 skipped |

The three flaky tests in the dispatched run are not in the add-deal path.
Each passed on retry; none was changed and the guard was not widened:

- WebKit `smoke/reduced-motion.spec.ts:118`: failure 1 in §5; its fix is in
  PR #48, which this branch does not contain.
- Firefox `smoke/secondary-nav.spec.ts:85`: `page.reload: NS_BINDING_ABORTED`.
  New; the same test as failure 6, a different engine and symptom.
- WebKit `invoices/status-lifecycle.spec.ts:51`: the guard reported the
  document request `/` as `Load request cancelled`. New.

One local `e2e-critical` run before this one was **invalid and discarded**:
it reused a test server left running by a probe that had been killed, over
a build directory that had since been rebuilt, and failed from test 133 on.
It says nothing about the code; the clean rerun is the row above.

Risk before Production: the change is on the main create path. It runs
once, when the page loads with the dialog open; opening the dialog from
inside the app is unaffected (existing tests for that path pass). Rollback:
revert the PR's merge commit with a new PR; no schema or data change.

Inventory: no user action was added or reclassified, so
`docs/testing/journey-coverage.json` and the generated report are
unchanged.

## 4. PR #48: the guard's self-test now runs in three engines

Review finding: the control for the cancelled Auth.js logo ran in Chromium
only, so removing Firefox's or WebKit's wording from the guard would have
left it green.

What was found first: re-running the old control per engine would not have
worked. It cancelled the request with `route.abort("aborted")`, which
Firefox reports as `NS_ERROR_ABORT` and WebKit as `Blocked by Web
Inspector`. Neither is the wording the guard exempts.

What was done (`6536661`):

- Firefox and WebKit now cancel the image themselves: a page showing the
  logo is left for another page while the image is loading. They report
  `NS_BINDING_ABORTED` and `Load request cancelled`, and the test asserts the
  wording it got. Chromium reports nothing for an image dropped that way,
  so there the routed abort stays (`net::ERR_ABORTED`).
- The four negative controls run in all three engines.
- The self-test fails if any of them was skipped, so a missing browser is
  not a pass.
- The required `e2e-critical` job installs Firefox and WebKit for this.
- The guard itself, `e2e/support/test.ts`, is unchanged, and the PR #46 rule
  is as narrow as before.

| Removed from the guard's list (then restored) | Self-test |
|---|---|
| `net::ERR_ABORTED` | fails, names chromium |
| `NS_BINDING_ABORTED` | fails, names firefox |
| `Load request cancelled` | fails, names webkit |
| nothing | passes, 9 of 9 local runs |

| Still fails the guard, in each of the three engines | |
|---|---|
| the logo, connection refused | yes |
| the logo, HTTP 503 | yes |
| a cancelled `authjs.dev` request outside `/img/providers/` | yes |
| a cancelled logo path on another host | yes |

Reduced-motion test (unchanged in this round, still waits for the menu's
own `slideUp` end): both tests, four projects, 8 of 8; Firefox and WebKit
repeated 10 times, 40 of 40.

| Run on `6536661` | Result | Counts |
|---|---|---|
| `CI`, pull request, [38229369831](https://github.com/crh/dibayar/actions/runs/38229369831) | success | `e2e-critical` 252 passed, 28 skipped; self-test passed with all three engines; `e2e-a11y` 29 passed, 1 skipped; `ux-audit` 69 passed. `e2e-cross-browser` skipped by design |
| `CI`, dispatched, [38229379531](https://github.com/crh/dibayar/actions/runs/38229379531) | success | `e2e-cross-browser`: **582 passed, 0 failed, 1 flaky, 69 skipped** |

The flaky test is not from this PR and had not been seen before: WebKit,
`smoke/secondary-nav.spec.ts:85`. Its first attempt was failed by the guard
for `…/chunks/app/(app)/page-….js — Load request cancelled`: a page script
WebKit dropped when Back/Forward replaced the page. The retry passed. The
guard was **not** widened. It is intermittent failure 6 in §5.

## 5. Intermittent cross-browser failures, current list

| # | Test | Engine | State |
|---|---|---|---|
| 1 | reduced motion, account menu | WebKit | cause proven; test fix in PR #48, **not merged** |
| 2 | `deals/deal-crud.spec.ts:13`, create a deal | WebKit | it was FIND-13; fix in PR #49, **not merged** |
| 3 | due-date field not in the viewport | Firefox | open, cause not established |
| 4 | `NS_BASE_STREAM_CLOSED` on a replaced `_rsc` request | Firefox | open; guard not widened; proposal in the morning receipt §3.4 |
| 5 | `ECONNRESET` on the test runner's own request | Firefox | open, classed as environment |
| 6 | `smoke/secondary-nav.spec.ts:85`, cancelled page script | WebKit | **new today**, 1 of 1 dispatched runs; open; guard not widened |
| 7 | new FIND-13 test, WebKit draws no frame | WebKit | harness condition, §3.3; reported as a skip, never as a pass |
| 8 | `smoke/secondary-nav.spec.ts:85`, `page.reload: NS_BINDING_ABORTED` | Firefox | **new today**, 1 of 1 dispatched runs of PR #49; open |
| 9 | `invoices/status-lifecycle.spec.ts:51`, document request cancelled | WebKit | **new today**, 1 of 1 dispatched runs of PR #49; open; guard not widened |

Until #48 and 49 are merged, 1 and 2 can still appear on `staging`.

## 6. Evidence for `staging` as it is now (`eea298d`)

Each run's head SHA was read from the run today.

| Check | Run | Head | Result |
|---|---|---|---|
| `CI`, push | [38179909526](https://github.com/crh/dibayar/actions/runs/38179909526) | `eea298d` | success, four required jobs |
| `Journey coverage (full)`, dispatched | [38199672597](https://github.com/crh/dibayar/actions/runs/38199672597) | `eea298d` | success, 149 of 149 real claims |
| `CI`, dispatched (cross-browser) | [38199675216](https://github.com/crh/dibayar/actions/runs/38199675216) | `eea298d` | success, 581 passed, 0 failed, 2 flaky, 69 skipped |
| `e2e-cross-browser`, scheduled | [38228826606](https://github.com/crh/dibayar/actions/runs/38228826606) | `main` `308a339` | success, today |

Nothing was redispatched on `staging`: the SHA has not changed since those
runs. They stop being release evidence the moment anything merges.

| Hosted staging | |
|---|---|
| Alias | `https://dibayar-git-staging-kenji-iwakura.vercel.app` |
| Serves | `dpl_GiHE9tbkVA9uDmuNxXDcMVq4VuJR` (`dibayar-nupuh3q1n-…`), Ready, created 2026-10-12 05:18:45 (`vercel inspect`, today) |
| Commit | `eea298d`: GitHub deployment 7002625412 for that SHA, environment Preview, status success, same URL |
| Migrations | 12, none pending (build log, read this morning; no deployment since) |
| Unauthenticated request | 302 to Vercel SSO. That is the protection working, not an app result |
| Signed-in smoke | **BLOCKED.** No signed-in browser session existed: one browser tool was not connected, the other landed on the Vercel login page. No sign-in was attempted |

### FIND-10 on Production — action card for Chris

**Status `NOT_RUN`. Impact `UNKNOWN`, not zero.** Production was not
queried, no credential was looked for, nothing was repaired.

1. Neon Console → the Dibayar project → SQL Editor.
2. Branch `main` (Production). Check it is not the staging branch. Use a
   read-only role if one exists.
3. Paste `docs/receipts/sql/DIBAYAR-FIND-10-IMPACT-READONLY-2026-10-11.sql`
   whole, unchanged (last changed in `c586cc6`), and run it once. It is one
   `BEGIN TRANSACTION READ ONLY … ROLLBACK` with short timeouts and returns
   counts only.
4. Copy the result grids into a private note and the release PR.
5. Stop. Repair nothing from the editor.

Reading it: `probable` and `possible` are degrees of likelihood, not
confirmed accidents; the history does not record which field was edited,
and a deleted deal is not counted. Nothing is restored automatically. If
`probable` is above zero and those deals are still at Masuk, write a
separate repair plan and rehearse it on a Neon branch first.

## 7. Manual UAT sheet for the final candidate

Run these on the deployment the alias serves **after** the merges in §9.
Staging test account, invented data, your own number as the contact. Do not
paste screenshots of a signed-in account or any `/i/…` address into a
public PR; keep evidence private and write where it is.

**Step 0.** Vercel → `dibayar` → Deployments → newest `staging` Preview.
Write its commit SHA here and in every row: `____________`

Result is `PASS`, `FAIL` or `NOT_RUN`. All are `NOT_RUN` today.

### Blocking

| Check | Steps | Expected | Device | SHA | Result | Evidence |
|---|---|---|---|---|---|---|
| **MAN-AUTH-01** | Private window: open the alias, pass Vercel SSO, sign in with Google | Beranda loads; no console error; no address on the Production host | desktop Chrome | | NOT_RUN | |
| | Account menu → sign out, then open `/deal` | asks to sign in; shows no deal | | | NOT_RUN | |
| **MAN-DUE-01** Android | On an invoice with no due date, tap the words `Belum ditentukan` | the phone's date picker opens | Android, Chrome | | NOT_RUN | |
| | Open the picker, cancel | nothing changes | | | NOT_RUN | |
| | Choose a date about a month ahead; reload | field shows it, `Tersimpan`; after reload the same date and `Jatuh tempo: <date>` | | | NOT_RUN | |
| | Choose a different date; reload | the new date | | | NOT_RUN | |
| | **Kosongkan**; reload | `Belum ditentukan` | | | NOT_RUN | |
| **MAN-DUE-01** iPhone | The five rows above | the same | iPhone, Safari | | NOT_RUN | |
| | Spin the wheel fast through several dates, Done, reload | the last date shown, not an earlier one | | | NOT_RUN | |
| **MAN-REL-01** | Phone: **+** → invented deal → **Lanjut ke …** until Invoice → **Buat invoice** → **Tandai sudah dikirim** → set a due date → **Buat tautan berbagi** | each step saves; a link is shown | phone + desktop | | NOT_RUN | |
| | Open the link in a private window | the invoice, without signing in | | | NOT_RUN | |
| | Owner page: **Cabut tautan**, then **Ya, cabut tautan** | "Belum ada tautan berbagi untuk invoice ini." | | | NOT_RUN | |
| | Reload the private window | "Tautan ini tidak ditemukan." | | | NOT_RUN | |
| | Save the deal's **Nama kontak**, reload (FIND-10) | the deal is still at Invoice | | | NOT_RUN | |

### Not blocking

| Check | What | Device | SHA | Result | Evidence |
|---|---|---|---|---|---|
| MAN-DEAL-01 | deadline picker in the add-deal dialog; the invoice's due date defaults to it | Android, iPhone | | NOT_RUN | |
| MAN-WA-01 | WhatsApp opens with the message; send only to yourself | Android, iPhone, desktop | | NOT_RUN | |
| MAN-PDF-01 | invoice PDF downloads and opens | Android, iPhone, desktop Safari or Firefox | | NOT_RUN | |
| MAN-SHARE-01 | copy the share link; fallback if copying is refused | Android, iPhone | | NOT_RUN | |
| MAN-A11Y-01 | due-date field with TalkBack or VoiceOver | phone | | NOT_RUN | |
| Reduce Motion (optional) | account menu appears in place, no slide | iPhone, Reduce Motion on | | NOT_RUN | |
| FIND-13 (optional, if feasible) | throttle the phone's connection (or use a weak one), open `/deal?tambah=1` directly, type the brand at once and keep typing | the text stays; the keyboard stays in the field; the deal saves once | phone | | NOT_RUN | |

Numbered steps for each check: `docs/testing/MANUAL-UAT.md`. Copy finished
rows into its run log.

## 8. Gate F, and one point on Gate B

### 8.1 Gate B and the public repository

The repository is public, deliberately: PR #38 ("clarify proprietary
source-code rights before public visibility") and PR #40 ("update Git
safeguards for public repository ruleset") were merged by Chris on
2026-10-10, and `docs/DEVELOPMENT-WORKFLOW.md` describes "the public
repository". So the stale line "Repo still private" was replaced, in PR
#47, with a public-repository guardrail: everything pushed is
world-readable (diff, messages, PR text, CI logs, artifacts); scan the diff
yourself; synthetic test data only; protections untouched. `SECURITY.md`'s
"Repo private" line now records the change. Visibility and settings were
not touched.

**For Chris:** GitHub **secret scanning and push protection both read as
`disabled`** through the API today. On a public repository that is the
cheapest safeguard not in use. Turning them on is a settings change and is
yours.

### 8.2 Gate F for `eea298d` (today's `staging`)

| Gate | Item | State |
|---|---|---|
| F1 | `CI` green on the head, four required jobs | met for `eea298d` (38179909526) |
| F1 | no `test.fail()` on a P0 | met; none exist |
| F2 | MAN-REL-01 | **missing**, NOT_RUN |
| F2 | MAN-DUE-01 both phones, MAN-AUTH-01 in and out | **missing**, NOT_RUN |
| F2 | other manual checks | not run; listed in §7 |
| F3 | outstanding P0 INV-DUE-03 | **open**; closes with MAN-DUE-01 or Chris's written acceptance |
| F3 | DEAL-CREATE-07 (P1), A11Y-01 (P1, partial by rule) | open; A11Y-01 needs no acceptance while green, and is not reported as covered |
| F3 | risk acceptance | **none given, none assumed** |
| F4 | full claim run on the head | 149 of 149 (38199672597) |
| F4 | cross-browser | on the head: success, 2 flaky (38199675216); scheduled, `main`: success (38228826606) |
| F4 | open findings | FIND-09, FIND-11 (low); FIND-13 fixed in an unmerged PR; FIND-14 proposed; FIND-10 fixed on `staging`, Production count UNKNOWN; intermittent failures §5 |

**NO-GO.** F2 and F3 are not met, and the head will change with the
merges in §9, after which F1 and F4 must be shown again for the new SHA.
The coverage percentage is not a gate and was not used as one.

## 9. Merge order, and what to refresh after each merge

Every merge into `staging` makes a new candidate SHA, documentation
included (`REVIEW_CHECKLIST.md` Gate F, "Release head").

| Order | PR | Why here | After merging |
|---|---|---|---|
| 1 | [#48](https://github.com/crh/dibayar/pull/48) test guard, reduced-motion test | test-only; makes the self-test three-engine before anything else lands | push `CI` on `staging` green |
| 2 | [#49](https://github.com/crh/dibayar/pull/49) FIND-13 fix | the only application change; lands on a base whose tests are already fixed | push `CI` green; this is the commit whose behaviour the manual checks must see |
| 3 | [#47](https://github.com/crh/dibayar/pull/47) documents | last, so the documents describe a state that exists, and so no code lands after the final evidence | push `CI` green |

The three PRs touch different files and none depends on another to be
valid. Use a merge commit or squash; do not delete `staging`; do not use
"Delete branch" on anything targeting `main`.

After the **last** merge, on the resulting SHA:

1. `gh run list --branch staging --limit 3`: the push `CI` run's head is the
   new SHA and it is green.
2. `gh workflow run journey-coverage-full.yml --ref staging` and
   `gh workflow run e2e.yml --ref staging`; record run IDs, counts, flaky
   and skipped.
3. `vercel inspect https://dibayar-git-staging-kenji-iwakura.vercel.app`:
   the deployment is Ready and built from the new SHA; the build log says
   no pending migrations.
4. Then the manual checks (§7), each row naming that SHA.

If anything merges after a manual check was run, either rerun the check or
state in the release PR why it still applies. Never reuse a sign-off
silently.

## 10. Draft body for the release PR (not opened)

```
Release: staging -> main (merge commit only; do not delete `staging`)
Status: NO-GO / PENDING_OPERATOR until every <…> below is filled in.

Head: <staging SHA after #48, #49 and #47; every run below is on it>
Contains: everything on staging since 308a339, including PR #41-#46, #48
(test guard, three-engine self-test), #49 (FIND-13 fix), #47 (documents).
Product changes: src/lib/deal-validation.ts (FIND-10), src/app/(app)/error.tsx
(FIND-12), deal-client.tsx / deal-form.tsx / add-deal-dialog.tsx (FIND-13).
No migration: nothing changed under prisma/migrations.

F1  CI on <SHA>: <run URL>. lint-typecheck-test / e2e-critical / e2e-a11y /
    ux-audit: <success>. No test.fail() exists.
F2  MAN-REL-01 (incl. Cabut tautan -> Ya, cabut tautan): <row, SHA>.
    MAN-DUE-01 Android Chrome: <row, SHA>; iPhone Safari incl. fast wheel: <row, SHA>.
    MAN-AUTH-01 sign-in + sign-out: <row, SHA>.
    Not run: <MAN-DEAL-01 / MAN-WA-01 / MAN-PDF-01 / MAN-SHARE-01 / MAN-A11Y-01>.
    Any row on an earlier SHA: <why it still applies, by Chris | rerun>.
F3  Outstanding P0/P1 and exception register pasted from JOURNEY-COVERAGE.md.
    INV-DUE-03 (P0): <signed off under F2 | accepted by Chris>.
    A11Y-01: partial by rule, tests green under F1; not reported as covered.
    Risk accepted by Chris: <list, or "none">.
F4  Journey coverage (full) on <SHA>: <run URL, n/n real claims>.
    e2e-cross-browser dispatched on <SHA>: <run URL; passed/failed/flaky/skipped>.
    e2e-cross-browser scheduled (main): <run URL>.
    Staging alias -> <dpl id> -> <SHA>; hosted smoke: <PASS by whom | BLOCKED>.
    FIND-09, FIND-11: open, low.
    FIND-13: fixed in #49 <merged>; optional phone check <row | not run>.
    FIND-14 (Pengaturan edit before scripts load, proposed P3): <decision>.
    FIND-10: fixed in code; Production count <probable / possible | NOT_RUN,
    impact UNKNOWN>; repair <not needed | planned separately>.
    Intermittent cross-browser failures: receipt 2026-10-12 afternoon, §5.
    GitHub secret scanning / push protection: <enabled | accepted as off>.

Rollback: revert this merge with a new PR and let Vercel redeploy, or
promote the previous Production deployment in Vercel (Chris). Never
force-push. No schema change, so no database step.
```

## 11. Review threads

| PR | Thread | What was done | State |
|---|---|---|---|
| #48 | run the cancellation control in the affected engines | §4; reply with the red/green table and run links | resolved |
| #47 | revalidate after merging the documentation PR | "Release head" rule in Gate F; dated addendum on the 2026-10-11 receipt (its text left as written); §9 here; handoff and `MANUAL-UAT.md` say which SHA to test | resolved |
| #47 | include the confirmation step when revoking | **Ya, cabut tautan** added to the handoff (both places) and `MANUAL-UAT.md`, with the owner-page and recipient-page results, checked against `src/lib/i18n.ts`, `src/app/i/[token]/not-found.tsx` and the invoice journey tests | resolved |

## 12. Limits, and what was not done

- Nothing was merged. Nothing here is on `staging`, and nothing is deployed.
- No manual check was run: no phone, no Google sign-in. Hosted pages were
  not opened (no signed-in session).
- Production, its database, Neon, Vercel settings, Google OAuth, SSO, the
  ruleset and the repository's visibility and settings: not touched.
- The FIND-13 test's WebKit skip path has not been seen to fire, and what
  makes headless WebKit stop drawing frames is not established (§3.3).
- A reload of `/deal?tambah=1` was not tested separately from opening it:
  both ask the server for the same page, and holding scripts across a
  reload makes the browser cancel them, which the guard reports.
- FIND-14 rests on one Chromium probe run.
- Intermittent failures 3 to 6, 8 and 9 in §5 are open and unchanged. Three of them were first seen today, each once; none was investigated beyond its error text.
- Local databases: only the disposable test database on `127.0.0.1:55432`.
  Docker was not used. No secret was read or printed; `.env.local` was
  linked into two new worktrees, not opened.
- Worktrees created: `/home/kenji/code/dibayar-pr48`,
  `/home/kenji/code/dibayar-find13`. Branch created:
  `fix/find-13-add-deal-prehydration-input-2026-10-12`. Temporary probes
  (throwaway spec files, three mutations of the guard's list) were all
  removed or restored before committing. Pre-existing untracked files in
  the main checkout were left as they were.
- Workflows dispatched: `CI` on the PR #48 branch and on the PR #49 branch. None on `staging`.
