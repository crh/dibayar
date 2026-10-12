# Dibayar — release readiness after PR #46, 2026-10-12

**Verdict: `NO-GO / BLOCKED_PENDING_OPERATOR`** for

- `staging` SHA `eea298d94dbf71925a542a8e74d5a36ff4217734`
- deployed SHA `eea298d94dbf71925a542a8e74d5a36ff4217734` (staging alias)

Every automated check on that SHA is green. The release is blocked only by
things no tool in this session can do: the three manual checks on real
devices and a real Google account, and the Production count for FIND-10.
Nothing was merged, and `main` and Production were not touched.

This receipt succeeds `DIBAYAR-POST-MERGE-STAGING-ACCEPTANCE-2026-10-11.md`,
which describes the earlier candidate `fe01281` and is kept as written.

All times are WIB (UTC+7) unless a run ID's own UTC time is quoted.

> **Status update, 2026-10-12 (afternoon).** This receipt records the
> morning and is left as written. What has changed since, none of it merged:
>
> - **PR #48** has a new head, `6536661`: the guard self-test now runs its
>   Auth.js logo controls in Chromium, Firefox and WebKit (§3.6 and §4.1
>   below describe the earlier, Chromium-only version at `1f44c77`).
> - **FIND-13** (§3.2, "Not changed, on purpose") now has a fix and a
>   failing-first regression test in **PR #49**, open and **unmerged**. It is
>   not on `staging`.
> - §1 step 3 says a merge of #47 or #48 moves `staging` and that `CI` then
>   runs by itself. That is true and not enough: the full journey run, the
>   cross-browser run, the deployed SHA and the manual rows must also be
>   shown for the new head (`REVIEW_CHECKLIST.md` Gate F, "Release head").
> - Gate B's "Repo still private" (§8) has been replaced with a
>   public-repository guardrail.
> - Manual checks: still `NOT_RUN`. FIND-10 Production count: still
>   `NOT_RUN`, impact unknown.
>
> Current status, merge order and the manual sheet:
> `DIBAYAR-FIND13-PR47-PR48-RELEASE-READINESS-2026-10-12.md`.

## 1. What Chris has to do next

1. Run **MAN-AUTH-01**, **MAN-DUE-01** (a real Android phone with Chrome and
   a real iPhone with Safari) and **MAN-REL-01** on the staging alias, and
   fill in the `eea298d` rows at the end of `docs/testing/MANUAL-UAT.md`.
   Steps: the top of `DIBAYAR-E2E-REAL-DEVICE-HANDOFF-2026-10-11.md`.
2. Run the FIND-10 query on Production, read-only (§6), and record the two
   result grids.
3. Decide PR #48 (test-only) and PR #47 (documents). Either merge moves
   `staging`; the required `CI` then runs on the new head by itself.
4. Decide the three findings in §3 that were left unchanged.
5. Open the `staging -> main` release PR with the body in §8, once 1 and 2
   are recorded.

## 2. The candidate and the automated checks on it

| | |
|---|---|
| `origin/staging` | `eea298d94dbf71925a542a8e74d5a36ff4217734`, merge commit of PR #46, 2026-10-12 05:18. Has not moved during this session |
| `origin/main` | `308a339e7de817aa37378d263d51f25c78ea4f09`, unchanged |
| Difference from `fe01281` | one file, `e2e/support/test.ts`, 13 lines added. No application code |
| `staging` ahead of `main` | 106 commits. No change under `prisma/migrations` |
| Ruleset 24837655 | active on `main` and `staging`, no bypass actors; rules: deletion, non-fast-forward, pull request, required status checks |

Runs on `eea298d`. Each run's head SHA was read from the run itself.

| Check | Run | Result | Counts |
|---|---|---|---|
| `CI`, push to `staging` | [38179909526](https://github.com/crh/dibayar/actions/runs/38179909526) | success | see next four rows |
| `lint-typecheck-test` | same | success | unit tests 989 of 989 |
| `e2e-critical` | same | success | 252 passed, 28 skipped, 0 flaky |
| `e2e-a11y` | same | success | 29 passed, 1 skipped |
| `ux-audit` | same | success | 69 passed; detector self-tests 9 passed |
| `e2e-cross-browser` in the push run | same | **skipped** by design (it runs on schedule and on manual dispatch only). Not counted as a pass |
| `Journey coverage (full)`, dispatched on `staging` | [38199672597](https://github.com/crh/dibayar/actions/runs/38199672597) | success | **149 of 149 real claims passed, 0 not exercised**; 297 passed, 29 skipped, 0 flaky |
| `CI`, dispatched on `staging` (adds `e2e-cross-browser`) | [38199675216](https://github.com/crh/dibayar/actions/runs/38199675216) | success | Chromium, Chromium mobile, Firefox, WebKit: **581 passed, 0 failed, 2 flaky, 69 skipped**. The four required jobs passed again in this run |

Inventory figures printed by the run: 95 actions, 93 applicable, 82 real
(88.2%), P0 real 28 of 30, 3 outstanding P0/P1 (INV-DUE-03, DEAL-CREATE-07,
A11Y-01). Unchanged from 2026-10-11.

No `test.fail()` exists anywhere under `e2e/`.

The two tests that needed a retry in run 38199675216 are not the two from
the earlier runs. Both are in §3.

## 3. Intermittent cross-browser failures

Five have now been seen. One has a proven cause and a fix in PR #48. Four
are open. None was hidden, skipped or given a longer timeout.

| # | Test | Engine | Seen | Class | State |
|---|---|---|---|---|---|
| 1 | `smoke/reduced-motion.spec.ts:118` account menu state | WebKit | CI 2 of 3 dispatched runs; local probe 3 of 40 | test timing | **Cause proven. Fix in PR #48, not merged** |
| 2 | `deals/deal-crud.spec.ts:13` create a deal | WebKit | CI 1 of 3; local 1 of 40 | **product behaviour**, low severity | **New finding FIND-13. Not changed** |
| 3 | `invoices/due-date-integrity.spec.ts:96` (filled) field in viewport | Firefox | CI 1 of 3; local 1 of about 79 | unknown | Open |
| 4 | `invoices/due-date-integrity.spec.ts:259` legacy due date | Firefox | CI 0 of 3; local 2 of 19 | test guard, probable | Open, proposal below |
| 5 | `security/ownership-denial.spec.ts:52` | Firefox | CI 1 of 3 | environment | Open, low concern |

### 3.1 WebKit, reduced motion (fixed in PR #48)

What failed: with the reduced-motion preference on, the test opened the
account menu and read its style as opacity 0, shifted down 146.5 px (the
menu's own height), where it expects opacity 1 and no shift.

Cause, measured with a temporary probe (40 WebKit runs, events and computed
style logged with timestamps, probe then deleted):

- The test waited for "any animation or transition has ended" before
  reading the style. Beranda's seven loading placeholders end their
  shortened pulse while the page loads, so the wait was already satisfied
  before the menu opened.
- WebKit holds a new animation at its first keyframe until its next frame.
  In 37 runs the menu's animation ended within 0 to 3 ms of starting. In 3
  runs it took 118, 125 and 235 ms, and the first style read in those runs
  was the start state: opacity 0, 146.5 px down. That is the CI failure.
- The animation's own reported duration was 0.01 ms every time. Nothing
  moved.

Change: the test waits for the end of the menu's own `slideUp` animation.
All assertions are as before, and the no-preference control test is
untouched. After the change: 60 of 60 WebKit runs pass; all four browsers
8 of 8.

What a person would notice: with Reduce Motion on, under load, the menu can
appear a fraction of a second after the tap. It does not slide. This was
measured in headless WebKit on Linux. Whether an iPhone shows any pause is
not known; an optional check was added to the handoff.

Seen in passing, not a failure: on Beranda at desktop width the menu opens
at the bottom right of the window (top 565.5 px of 720), far from its ⋮
button, because the collision logic moves it below the "Perlu dikejar"
column. It may be intended. Chromium was not compared.

### 3.2 FIND-13, new: text typed before the page finishes loading is cleared

What failed: on the first attempt in WebKit the add-deal dialog was still
open 5 s after **Simpan deal**. The page snapshot shows **Nama brand** empty
and focused, with the WhatsApp field still holding its value.

Cause, proven with a temporary probe in Chromium, Firefox and WebKit (probe
then deleted): `/deal?tambah=1` arrives from the server with the dialog
already open. Text typed before the page's scripts have run is cleared when
they run. With the scripts held back, "Typed Before Scripts" was in the
field before release and the field was empty after, in all three engines.
The test typed the first field inside that window; the form then refused to
save because the required brand was empty.

Who it affects: someone who opens or reloads `/deal?tambah=1` directly and
starts typing at once on a slow phone or connection. They lose the first
characters or the first field. Nothing wrong is saved; the form asks for
the brand again. The **+ Deal** button inside the app navigates without a
full page load, so it is probably not affected; that was not tested.
Other forms rendered open by the server may behave the same; not tested.

Not changed, on purpose. A fix means changing how the deal form holds its
values, which is application code touching the main create path a day
before a release decision. Making the test wait for the scripts would hide
the behaviour. The test is left as it is, so it will fail again now and
then in WebKit until this is decided. Suggested severity: P2.

### 3.3 Firefox, due-date field not in the viewport (open)

What failed: after `scrollIntoViewIfNeeded()`, the visible due-date text
reported a viewport ratio of 0 for the full 5 s. The CI screenshot shows the
page at the very top, with the field starting 18 px below the 720 px window.

Found: 60 isolated runs passed. It failed once when the whole `invoices`
folder ran three times in order, and not again in 16 more runs of the file
with scroll positions logged (every logged run scrolled from 0 to 201 px and
stayed there). So either the scroll did not happen or it was undone, and
only with other tests before it. The cause is not established.

Impact on a person: none identified. The field is reached by ordinary
scrolling, and the same test passes in Chromium, Chromium mobile and WebKit.
The timeout was not raised and Firefox was not skipped.

### 3.4 Firefox, `NS_BASE_STREAM_CLOSED` on a superseded `_rsc` request (open)

What failed, locally only: the guard reported
`/invoice?_rsc=… — NS_BASE_STREAM_CLOSED` in the test that visits `/`, then
`/invoice`, then a public invoice, one straight after the other.

Reading: Next.js starts fetching `/invoice` data for the menu link, the test
navigates away, and Firefox reports the abandoned request with this text
when the response body had already started, instead of `NS_BINDING_ABORTED`.
The guard already drops abandoned `_rsc` requests under the three texts it
knows.

Not changed, because it would widen what the guard ignores. If a reviewer
agrees, the narrow form is: accept `NS_BASE_STREAM_CLOSED` only together
with the `_rsc` marker, not for the favicon or logo rules, with a self-test
beside the others. It has not failed in any of the three CI runs.

### 3.5 Firefox, connection reset (open, low concern)

`apiRequestContext.get: read ECONNRESET` on `GET /api/deals/…`. This request
is sent by the test runner, not the browser, to the server on the same
machine. The retry passed. One occurrence; classed as environment.

### 3.6 The PR #46 guard rule

The rule drops a failed request only when all three hold: the browser
cancelled it, the host is `https://authjs.dev`, the path starts with
`/img/providers/`. The guard's self-test had no case for it. PR #48 adds
five, and each behaves as required:

| Case | Required | Observed |
|---|---|---|
| Cancelled `authjs.dev/img/providers/google.svg` | test passes | passes |
| Same logo, connection refused | test fails | fails |
| Same logo, HTTP 503 | test fails | fails |
| Cancelled `authjs.dev` request that is not a provider logo | test fails | fails |
| Cancelled logo path on another host | test fails | fails |

## 4. Pull requests and branches

| PR | State | Head | Notes |
|---|---|---|---|
| #41–#45 | merged into `staging` at `fe01281`, 2026-10-11 | | not touched |
| #46 guard rule | **merged** into `staging` at `eea298d`, 2026-10-12 05:18, by Chris | `acad376` | not touched; not re-merged |
| #47 documents | **open**, base `staging` | this branch | holds the 2026-10-11 receipt (kept, with a dated addendum) and this receipt |
| #48 test fix and guard self-tests | **open**, base `staging`, not merged | `1f44c77` | CI: see §4.1 |
| #39 Dependabot | open, base `main` | `3c8efd0` | not touched |

No merge was attempted in this session, so no permission refusal occurred.
A fix in an open PR is not on `staging`: until #48 is merged, flake 1 can
still appear in a cross-browser run of `staging`.

### 4.1 Checks on PR #48 (`1f44c77`)

| Run | Result | Counts |
|---|---|---|
| `CI`, pull request, [38203661660](https://github.com/crh/dibayar/actions/runs/38203661660) | success | four required jobs passed: unit 989 of 989 (as before), `e2e-critical` 252 passed / 28 skipped, `e2e-a11y` 29 passed / 1 skipped, `ux-audit` 69 passed. `e2e-cross-browser` skipped by design |
| `CI`, dispatched on the branch, [38203660931](https://github.com/crh/dibayar/actions/runs/38203660931) | success | `e2e-cross-browser`: **583 passed, 0 failed, 0 flaky, 69 skipped** |

One clean run does not show that flakes 2 to 5 are gone. They are
intermittent and none of them was changed.

Local, on that commit: lint 0, typecheck 0, guard self-test pass,
`coverage:journeys` OK with unchanged counts, reduced-motion spec 8 of 8
across the four browsers, WebKit repeat 60 of 60.

## 5. Hosted staging

| Field | Value |
|---|---|
| ENVIRONMENT | Vercel Preview, branch `staging` |
| COMMIT_SHA | `eea298d94dbf71925a542a8e74d5a36ff4217734` (build log: `Branch: staging, Commit: eea298d`; `vercel ls` filtered by the full SHA returns this one deployment) |
| DEPLOYMENT_URL | `https://dibayar-nupuh3q1n-kenji-iwakura.vercel.app`; alias `https://dibayar-git-staging-kenji-iwakura.vercel.app` resolves to it |
| DEPLOYMENT_ID | `dpl_GiHE9tbkVA9uDmuNxXDcMVq4VuJR`; GitHub deployment 7002625412, environment Preview, status success |
| DEPLOYED_AT | 2026-10-12 05:18:45 WIB; status Ready |
| MIGRATION_STATUS | build log: 12 migrations found, "No pending migrations to apply." |
| AUTH_STATUS | **NOT_RUN.** Unauthenticated request to the alias: 302 to Vercel SSO. That is the protection working, not an application result |
| DATABASE_CONNECTIVITY | not verified at run time. The build's migration step reached the staging database; no page was loaded |
| SMOKE_TEST_STATUS | **BLOCKED.** Neither browser tool had a session signed in to Vercel this time (one extension was not connected, the other landed on the Vercel login page). No sign-in was attempted and SSO was not bypassed |

Unlike 2026-10-11, there is no read-only look at the hosted pages for this
SHA. What is known is the deployment's identity, not that a person can use
it. MAN-REL-01 covers that.

## 6. FIND-10 on Production

**Status: `NOT_RUN`. Impact: `UNKNOWN`, not zero.**

No approved read-only Production route exists for this session. None was
looked for and no connection was attempted. Production still runs the code
with the bug; the fix is on `staging` only.

The query, `docs/receipts/sql/DIBAYAR-FIND-10-IMPACT-READONLY-2026-10-11.sql`,
is unchanged since `c586cc6`. Its review stands: one
`BEGIN TRANSACTION READ ONLY … ROLLBACK`, two `SELECT`s, `statement_timeout`
15 s and `lock_timeout` 2 s set locally, counts only, no names or ids.

Procedure:

1. Neon Console → the project behind `neon-dijual` → SQL Editor.
2. Branch: `main` (Production). Confirm it is not `staging`
   (`br-late-grass-aoea90yk`). Select a read-only role if one exists.
3. Paste the whole file unchanged and run it once.
4. Copy the two result grids (buckets `probable` and `possible`; one row of
   scale figures) into a private record and the release PR.
5. Stop. Repair nothing from the editor.

Reading the result: `probable` is a move to Masuk that skipped a stage or
hit a deal that already had an invoice. `possible` is Nego to Masuk without
an invoice, which the **Kembali ke Masuk** button also writes. Neither
proves an accident, because the history does not record which field was
edited, and a deal deleted since is not counted. If `probable` is above zero
and those deals are still at Masuk, a separate, reviewed repair plan
rehearsed on a Neon branch is warranted. No repair was written or run.

## 7. Manual checks

All `NOT_RUN` for `eea298d`. ALPHA had no phone attached and no Google
sign-in or sign-out was performed.

| Check | Blocks a release | Status |
|---|---|---|
| MAN-DUE-01, Android Chrome | yes | NOT_RUN |
| MAN-DUE-01, iPhone Safari, incl. fast wheel | yes | NOT_RUN |
| MAN-AUTH-01, sign-in **and** sign-out, then `/deal` asks to sign in | yes | NOT_RUN. The sign-in-only record on `cab167f` does not count |
| MAN-REL-01, deal to invoice to sent to due date to share to revoke | yes | NOT_RUN |
| MAN-DEAL-01, MAN-WA-01, MAN-PDF-01, MAN-SHARE-01, MAN-A11Y-01 | no | NOT_RUN |
| Reduce Motion on an iPhone (optional, §3.1) | no | NOT_RUN |

The handoff's top block and the `MANUAL-UAT.md` rows now name `eea298d`.
The earlier `fe01281` block and rows are kept and marked superseded.

## 8. Release decision

| Gate | Item | State |
|---|---|---|
| F1 | `CI` green on the release head, four required jobs | **Met** for `eea298d` (38179909526) |
| F1 | no `test.fail()` on a P0 | **Met**, none exist |
| F2 | MAN-REL-01 on the candidate | **Missing** |
| F2 | MAN-DUE-01 both phones, MAN-AUTH-01 in and out | **Missing** |
| F2 | other manual checks logged or listed as not run | not run; listed in §7 |
| F3 | outstanding P0 INV-DUE-03 fixed, signed off or accepted | **Open**; closes with MAN-DUE-01 or Chris's written acceptance |
| F3 | DEAL-CREATE-07 (P1), A11Y-01 (P1, partial by rule) | open; A11Y-01 needs no acceptance while its tests are green, and is not reported as covered |
| F3 | risk acceptance by Chris | **None given, none assumed** |
| F4 | full claim run on the head | 149 of 149 (38199672597) |
| F4 | cross-browser | dispatched on the head: success, 2 flaky (38199675216). Latest scheduled run, on `main`: success (37909381951, 2026-10-09) |
| F4 | open findings | FIND-09, FIND-11 (low); FIND-13 (new, §3.2); flakes 3 to 5 (§3) |
| F4 | FIND-10 Production count | **UNKNOWN**, query not run |
| F4 | deployment provenance | alias → `dpl_GiHE9tbkVA9uDmuNxXDcMVq4VuJR` → `eea298d` |

F2 and F3 are not met, so the verdict is `NO-GO / BLOCKED_PENDING_OPERATOR`.
A release PR can be opened as soon as the F2 rows exist; it was not opened
here, and nothing was merged to `main`.

One more point for Chris, reported and not changed: the repository is
**public** (`visibility: public`, checked through the GitHub API today).
`REVIEW_CHECKLIST.md` Gate B still has the line "Repo still private". Going
public looks deliberate: PR #38 "reserve Dibayar source-code rights before
public visibility" and PR #40 "update Git safeguards for public repository
ruleset" were merged on 2026-10-10, and `docs/DEVELOPMENT-WORKFLOW.md` says
"The public repository has an active server-side branch ruleset". The
checklist line is out of date and cannot be ticked as written. It needs
Chris's wording; the visibility was not touched.

Draft body for the release PR. Not opened.

```
Release: staging -> main (merge commit only; do not delete `staging`)

Head: <staging SHA; eea298d94dbf71925a542a8e74d5a36ff4217734 unless #47,
#48 or anything else has merged since. If it moved, replace every run
below with the runs on the new head.>
Contains: PR #41 (cross-page journeys), #42 (FIND-10 fix), #43 (six P2
journeys), #44 (FIND-12 fix, NAV-08), #45 (INV-DUE-06 real, a11y states),
#46 (test guard: Auth.js logo), and everything else on staging since
308a339 (106 commits at eea298d).
Product changes in this stack: src/lib/deal-validation.ts (FIND-10),
src/app/(app)/error.tsx (FIND-12). No migration: nothing changed under
prisma/migrations; staging's build reports 12 migrations, none pending.

F1  CI on eea298d: https://github.com/crh/dibayar/actions/runs/38179909526
    lint-typecheck-test / e2e-critical / e2e-a11y / ux-audit: success.
    No test.fail() exists.
F2  MAN-REL-01: <row>.
    MAN-DUE-01 Android Chrome: <row>; iPhone Safari: <row>.
    MAN-AUTH-01 sign-in + sign-out: <row>.
    Not run: <MAN-DEAL-01 / MAN-WA-01 / MAN-PDF-01 / MAN-SHARE-01 / MAN-A11Y-01>.
F3  Outstanding P0/P1 and exception register pasted from JOURNEY-COVERAGE.md.
    Outstanding P0: INV-DUE-03 — <signed off under F2 | accepted by Chris>.
    A11Y-01: partial by rule, tests green under F1; not reported as covered.
    FIND-13 (typed text cleared before scripts load): <accepted for this
    release | fixed in #…>.
F4  Journey coverage (full) on eea298d:
    https://github.com/crh/dibayar/actions/runs/38199672597 — 149/149 real
    claims, 0 not exercised.
    e2e-cross-browser dispatched on eea298d:
    https://github.com/crh/dibayar/actions/runs/38199675216 — 581 passed,
    0 failed, 2 flaky (WebKit deal create: FIND-13; Firefox ECONNRESET).
    e2e-cross-browser, scheduled (main): run 37909381951, success.
    Open intermittent failures: receipt 2026-10-12 §3. WebKit
    reduced-motion: test fix in PR #48 <merged | not merged>.
    Open low findings: FIND-09, FIND-11.
    FIND-10: fixed in code; Production count <probable / possible | not
    run>; repair <not needed | planned separately>.
    Gate B "Repo still private": the repository is public; <Chris's note>.

Rollback: revert this merge with a new PR and let Vercel redeploy, or
promote the previous Production deployment in Vercel (Chris). Never
force-push. No schema change, so no database step.
```

After any further merge into `staging`: confirm the push `CI` run on the new
SHA, dispatch `Journey coverage (full)` and `CI` on `staging`, and confirm
with `vercel inspect` that the alias serves the new SHA.

After a release, for later use and not run now: Production deployment Ready
on the merge SHA; `scripts/smoke-deployment.mjs` against Production; sign in
and out once; edit a contact on a deal past Masuk and confirm the stage
stays (FIND-10); open an error card and use **Coba lagi** if one can be
reached safely (FIND-12); file a deployment verification record.

## 9. Safety record

| Item | State |
|---|---|
| `main` | unchanged, `308a339` |
| `staging` | unchanged by this session, `eea298d`. No direct push, no merge |
| Production, its database, Neon branches, Vercel settings, Google OAuth, SSO, the ruleset, repository visibility | not touched |
| Secrets | none read, printed or looked for |
| Databases used | only the disposable test database on `127.0.0.1:55432`. Docker was not used |
| Hosted staging | deployment metadata and build log read. One unauthenticated request (302). No sign-in, no data created |
| Workflows dispatched | `Journey coverage (full)` and `CI` on `staging`; `CI` on the PR #48 branch |
| Branches created | `test/e2e-cross-browser-flakes-2026-10-12` (PR #48) |
| Commits | PR #48: `1f44c77`. PR #47: this receipt, the addendum to the 2026-10-11 receipt, handoff, `MANUAL-UAT.md`, `STATE.md`, `DAILY_LOG.md` |
| Temporary probes | two throwaway spec files and one diagnostic edit to `e2e/support/due-date.ts`; all removed before committing |
| Pre-existing untracked files | `compose.yml`, two 2026-10-01 receipts, `src/generated/`: left as they were |
| Not attempted | merging any PR, opening a release PR, any Production access, any repair |
