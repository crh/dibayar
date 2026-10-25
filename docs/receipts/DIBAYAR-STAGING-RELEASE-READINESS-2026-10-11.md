# Dibayar — staging integration and release readiness (2026-10-11)

**Status: `BLOCKED_PARTIAL`. Release recommendation: `NO-GO — BLOCKED`.**

The engineering work is done and green on its pull requests. Nothing is on
`staging`: this session's permission check refused the merge of PR #44, and
the refusal was not worked around. So there is no release candidate on the
protected branch, none deployed, and no real-device or real-sign-in check has
been run.

| | |
|---|---|
| Repository | `crh/dibayar`, local `/home/kenji/code/dibayar` |
| `origin/main` | `308a339e7de817aa37378d263d51f25c78ea4f09` (unchanged by this session) |
| `origin/staging` | `390bc38c278c04b7b3062ac6c5caeb544b380705` (unchanged; PR #36 merge, 2026-10-10) |
| Deployed on the staging alias | `390bc38` — verified, see §4. It does **not** contain PRs #41–#45 |
| Candidate (unmerged) | PR #45 head; it is #44's head `b3cadd2` plus this session's commits |
| Times | Asia/Jakarta unless marked UTC |

## 1. What a person has to do next

1. **Chris: merge PR #44 into `staging` with a merge commit**, head
   `b3cadd231d53386ba56f0ef2f81a2c9e12869a26`. It contains #41, #42 and #43
   (a linear stack), so one merge integrates all four. Then merge **PR #45**
   (squash or merge commit). Close or let GitHub mark #41–#43 afterwards.
2. After the `staging` push: confirm the `CI` run on the new `staging` SHA,
   and dispatch the full claim check on it:
   `gh workflow run journey-coverage-full.yml --ref staging`.
3. When Vercel has deployed that SHA to the staging alias: run the
   real-device work order
   (`DIBAYAR-E2E-REAL-DEVICE-HANDOFF-2026-10-11.md`, about 45 minutes) and log
   the rows in `docs/testing/MANUAL-UAT.md`.
4. Chris: run the read-only FIND-10 count on Production (§5), then decide
   whether a repair is needed.
5. Only then: a `staging -> main` release PR with Gate F filled in (draft in
   §7). Not opened by this session.

## 2. Phase 0 and 1 — repository state and the blocked merge

Verified at the start (2026-10-11, `git fetch --all --prune`, `gh`):

- PRs #41, #42, #43, #44: all `OPEN`, base `staging`, `MERGEABLE` / `CLEAN`,
  heads as in the brief (`d7daa53`, `709ba14`, `9415dd2`, `b3cadd2`).
- The stack is linear on top of `staging`: merge base `390bc38` for all four,
  `staging` 0 commits ahead of any of them, and #41 ⊂ #42 ⊂ #43 ⊂ #44 by
  ancestry (4, 8, 11, 14 commits). Nothing newer had superseded them.
- Ruleset `24837655` on `main` and `staging`: pull request required, 0
  approvals, review threads must be resolved, required checks
  `lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit`; merge and
  squash allowed; no bypass.
- #44's head had all four required checks green on that exact SHA (CI run
  `38118524910`; `e2e-cross-browser` was **skipped**, by design on PRs), the
  full claim run `38118524905` green, and no unresolved review thread on any
  of the four PRs (#41 has two, both resolved).
- The cumulative diff of #44 against `staging` (32 files) was read: tests,
  fixtures, docs, and exactly two product changes (below). Nothing unrelated.

**The merge.** `gh pr merge 44 --merge --match-head-commit b3cadd2…` was
refused before it reached GitHub, by Claude Code's auto-mode permission check,
reason given: `Merge Without Review`. It was attempted once and not retried
in any other form (no direct push, no API call, no other account). GitHub's
own rules were never the obstacle: the PR is mergeable under them.

**Product fixes reviewed in context.**

- FIND-10 (`src/lib/deal-validation.ts`): the patch schema now has no status
  default, so a patch changes only what it names. Unit tests cover every
  non-Masuk stage against four patch shapes; `e2e/deals/patch-keeps-stage.spec.ts`
  reads the stage and the history after a reload. Sound.
- FIND-12 (`src/app/(app)/error.tsx`): uses `retry`, not `reset`. Checked
  against the documentation shipped with the installed Next.js **16.3.3**
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`):
  `retry()` re-fetches and re-renders the boundary's children; `reset()`
  re-renders without re-fetching. It is the only error boundary in `src/`.
  The proof is not the mocked component test: `e2e/smoke/route-error-retry.spec.ts`
  makes a server component really throw and recover, and it passed in both
  projects in the full run on this session's head (§3).

## 3. Phase 2 — engineering follow-up (PR #45)

Branch `test/release-readiness-p1-2026-10-11`, based on #44's head
(**not** the protected staging SHA). PR
[#45](https://github.com/crh/dibayar/pull/45) into `staging`, stacked on #44.
Tests, one fixture action pair, one option of the browser-health guard,
inventory and docs. **No application code.**

| Commit | Content |
|---|---|
| `f18d1e8` | tests, fixture action, guard option |
| `c586cc6` | inventory, docs, read-only SQL |
| `57f98d7` | inventory: one reference listed as partial (see CI below); handoff update |
| the commit that adds this file | reduced-motion control stabilised; this receipt, `STATE.md`, `DAILY_LOG.md` |

### INV-DUE-06 — a due-date save that fails on the server: now real

A new guarded fixture action (`invoice-write-refusal` /
`end-invoice-write-refusal`, `scripts/e2e-fixtures.ts`) adds a row trigger to
the disposable test database that rejects every UPDATE of the one seeded SENT
invoice. Nothing is intercepted in the browser: the PATCH reaches the app's
handler, the handler reaches the database, the write fails there, and the app
answers 500 itself. `e2e/invoices/due-date-integrity.spec.ts`, "saves the
database refuses":

- **Kosongkan** (chromium and chromium-mobile): error shown, stored date back
  in the field, a second try fails the same way, a reload shows the stored
  date, and after the trigger is removed the same button clears the date for
  good (checked after another reload).
- A **typed date + Enter** (desktop chromium): the same, ending with the
  retyped date saved.

Isolation, compared with the NAV-08 table rename: one row, writes only,
nothing renamed or deleted, reads untouched, so it cannot break a spec that
does not update that invoice. It is removed in the test's `finally`, in
`afterEach`, and by every other fixture action before it does anything else
(crash recovery); removing it takes no lock when it is not there; adding and
removing it give up after 5 s instead of waiting on a lock. The suite still
runs with one worker. The fixture script's existing guards apply (only
`127.0.0.1:55432/dibayar_test`, explicit non-production flag).

Negative control (local, reverted from Git, rebuilt): with the field's
failure branch changed to report success, the new tests fail in all three
runs. The two older `page.route` tests stay, as partial references.

To let one deliberate 500 through without hiding others,
`expectedErrorResponses` (`e2e/support/test.ts`) takes an optional `status`.
Without it an opt-in still covers 4xx only. The guard's self-test proves the
named 500 is suppressed, a 500 on an address opted in without a status still
fails, and a 503 on an address opted in for 500 still fails.

Classification: `automated_real_interaction`, exception-register entry
removed. Honest limits, written into the inventory: on the phone project the
failing change is Kosongkan, because a date chosen in a phone's native picker
cannot be driven (that is INV-DUE-03 / MAN-DUE-01); a save that never reaches
the server (offline, timeout) is covered only by the `page.route` tests.

### DEAL-CREATE-07 — optional fields and the deadline: stronger, still partial

`e2e/deals/create-validation.spec.ts`: the deadline is typed with real keys
into the native date input on desktop chromium; the deal's card and detail
show it after a reload; it survives the stage moves; the invoice created from
the deal starts with it as its due date and keeps it after a reload. A second
value (29 Feb 2028) and the no-deadline case (card and detail say `Tanpa
tenggat`, the invoice starts with no due date) are covered too.

Not done, on purpose: no test sets a deadline in the phone project. No
`fill()`, no script assignment, no picker shim. The OS date picker is
**MAN-DEAL-01, pending**; the action stays `automated_partial` and keeps its
register entry.

### A11Y-01 — accessibility: wider scans, still partial by rule

New `e2e/smoke/accessibility-states.spec.ts` (`@a11y`, runs in CI job
`e2e-a11y`): deal detail (plain, invoiced, with the number-repair form open),
invoice detail with the repair form open and with an expired share, Settings
with field errors, the main pages in English (language switched with the
Settings button; `html lang` checked), the phone layout at 390px (six
states), one keyboard-only journey (Tab, Enter and typing: add a deal, forward
focus wrap inside the dialog, card menu, open detail), and a control that
proves the scan fails on a page with known problems.

Result: **zero serious or critical findings.** Nothing excluded, no rule
switched off, so there was nothing to fix. The action stays
`automated_partial`: an axe scan is rendering evidence. No test operates a
screen reader; **MAN-A11Y-01 (TalkBack / VoiceOver) stays pending**. The
390px scans are desktop Chromium, not a phone.

### A11Y-04 — reduced motion: reclassified to partial

Reviewed as asked. The measurement is sound and has a negative control: one
global rule in `globals.css` cuts every animation and transition to 0.01 ms,
sets the iteration count to 1 and `scroll-behavior: auto`, and the app has no
script-driven motion. No defect.

The classification did not hold against the written rule, which asks for the
control a person uses and a user-observable outcome. Here the preference is
switched by Playwright's media emulation, not the OS setting, and "nothing
moves" is inferred from computed styles and animation events read with
`page.evaluate`. **`automated_real_interaction` → `automated_partial`.** The
test now also records cancelled animations and transitions. P2, so no
register entry is required.

One real flake surfaced in this test's *control* (CI run `38127790377`,
chromium-mobile, passed on retry): it measured 2000 ms instead of 200 ms
because Beranda's loading placeholders, which pulse on a 2 s animation, were
still on the page. The control now waits until they are gone (16/16 over four
repeats in both projects locally). The assertion is unchanged.

### Numbers

| | Before (#44 head) | After (PR #45) |
|---|---|---|
| Real-interaction coverage | 82/93 = 88.2% | 82/93 = 88.2% (INV-DUE-06 up, A11Y-04 down) |
| P0 real | 28/30 | 28/30 |
| Real claims (action × project) | 149 | 149 |
| Outstanding P0/P1 | 4 | **3**: INV-DUE-03 (P0, manual pending), DEAL-CREATE-07 (P1, partial + manual), A11Y-01 (P1, partial by rule) |
| `not_covered` | 0 | 0 |

No test was skipped, weakened or given a longer timeout to pass. Two new
tests are skipped in the phone project because they are keyboard journeys;
they say so. FIND-10, FIND-12, the cross-page journeys, permissions and
settings regressions all ran and passed in the full run below.

FIND-11 (a saved contact name cannot be cleared) is triaged in
`JOURNEY-BACKLOG.md` and the inventory: recommended **P3, after the release,
not a blocker**, with the repro and a recommended fix. Not changed.

### CI on PR #45

| Head | Run | Verdict |
|---|---|---|
| `c586cc6` | `CI` [38126656353](https://github.com/crh/dibayar/actions/runs/38126656353) | **failure** — every test passed (e2e-critical 252 passed); the claim check failed: INV-DUE-06's typed-date test was listed as a real reference but is skipped on chromium-mobile |
| `c586cc6` | `Journey coverage (full)` [38126656350](https://github.com/crh/dibayar/actions/runs/38126656350) | **failure** — same single cause |
| `57f98d7` | `CI` [38127790375](https://github.com/crh/dibayar/actions/runs/38127790375) | **success** — `lint-typecheck-test` success (unit 989/989); `e2e-critical` success (252 passed, 28 skipped); `e2e-a11y` success (29 passed, 1 skipped); `ux-audit` success (69 passed); `e2e-cross-browser` **skipped** (not run on PRs) |
| `57f98d7` | `Journey coverage (full)` [38127790377](https://github.com/crh/dibayar/actions/runs/38127790377) | **success** — 296 passed, 0 failed, **1 flaky** (the reduced-motion control, above), 29 skipped; ux-audit 69 passed; **real claims 149/149 passed, 0 not exercised**. Ran on the PR merge ref `0de43bb`, i.e. this head merged into `staging` `390bc38` |

The fix for the first pair was to the inventory, not to a test: the Kosongkan
test (both projects) is the real reference; the desktop-only typed-date test
is listed as partial with that reason, as INV-DUE-01 already does.

The commit that adds this receipt comes after `57f98d7`; its own `CI` run is
on PR #45's checks and in the session's final report, not in this file.

Local, on this branch: lint, typecheck, build pass; unit 989/989; coverage
self-test 37/37; guard self-test pass. Full `npm run test:e2e`: 297 passed,
28 skipped, 1 failed (the new keyboard journey in the phone project, where
the desktop top bar it starts from does not exist; scoped to desktop
afterwards). Firefox and WebKit were **not run** for the new tests.

## 4. Phase 3 — final staging SHA: not reached

There is no final staging SHA, so none of this was done **on `staging`**:
post-merge `CI`, a dispatched `Journey coverage (full)` on `staging`, a
deployment of the candidate, a hosted smoke check. The runs in §3 are
PR-head evidence (the full run on the PR's merge ref), not staging evidence.

Hosted staging, verified read-only:

- GitHub deployment `6987749307`: environment Preview, SHA
  `390bc38c278c04b7b3062ac6c5caeb544b380705`, state success (2026-10-10
  22:28 UTC).
- `vercel inspect` of the alias `dibayar-git-staging-kenji-iwakura.vercel.app`
  resolves to deployment `dibayar-339v892gv`, status Ready, target preview —
  the same deployment.
- The alias answers 302 to Vercel's sign-in: SSO protection is on. Not
  changed, not bypassed.

**Deployed staging SHA: `390bc38` (verified). Deployed candidate: none.**
No hosted smoke test was run: the candidate is not deployed, and signing in
needs the account holder. No environment variable was read or changed.

## 5. Phase 4 — FIND-10 Production impact: unknown

**Certainty: UNKNOWN. Not zero. No Production query was run.**

No approved read-only Production database role or channel is configured on
this machine; earlier Production reads in this project were run by Chris in
the Neon SQL editor. No credential was looked for.

What the schema can tell (read from `prisma/schema.prisma` and the code):

- Every stage move writes one `DealStageTransition` row (from, to, time) in
  the same transaction as the deal. It does **not** record which fields the
  request carried. An accidental `<stage> → MASUK` row is therefore identical
  to a deliberate one. No row can be called definitely accidental.
- The app's buttons move one stage at a time; a jump of two or more stages
  back to Masuk can only be made on purpose by desktop drag-and-drop. So:
  - **probable**: `DEAL`/`KONTEN`/`INVOICE`/`DIBAYAR → MASUK`, or any move to
    Masuk of a deal that already had an invoice;
  - **possible**: `NEGO → MASUK` without an invoice (the same row **Kembali
    ke Masuk** writes);
  - a deal deleted since has no history left and cannot be counted.
- Exposure window in Production: the screens that send such a patch and the
  stage history reached `main` in the same merge, `b6119d2`
  (2026-09-06 11:35 WIB = 04:35:07 UTC). So every Production reset has a
  history row; there is no unrecorded earlier period there. The window is
  still open: the fix is not on `main`.
- Counting every deal currently at Masuk would be wrong and is not done.

The query: `docs/receipts/sql/DIBAYAR-FIND-10-IMPACT-READONLY-2026-10-11.sql`.
`BEGIN TRANSACTION READ ONLY`, 15 s statement timeout, schema-qualified,
window as two parameters in one place, aggregates only (rows, deals, accounts
per bucket; how many are still at Masuk; scale figures). No brand, number,
name, id or token is selected. Checked for syntax and behaviour against the
local disposable test database only.

Recommended next step (Chris): run it with a read-only role on the verified
Production database. If `probable` is not zero, plan a **separately reviewed**
repair: per deal, the stage to restore is the `fromStatus` of its latest reset
row, applied only where the deal is still at Masuk and has not been moved
since, with a compensating history row rather than a deleted one, rehearsed
on a Neon branch first. `possible` rows need the owner's word, not a script.
Nothing was repaired and no repair migration was written.

## 6. Phase 5 — real-device and sign-in checks: all pending

Checked on this machine: no `adb`, no phone on USB, `idevice_id` lists no
iPhone. No Google sign-in was attempted. Emulation was not used as a
substitute, and nothing was logged in `MANUAL-UAT.md`.

| Check | Covers | Blocks a release | Status |
|---|---|---|---|
| MAN-DUE-01 | INV-DUE-03: native due-date picker, real Android Chrome and real iPhone Safari (incl. the fast wheel step) | **Yes** | PENDING — not run |
| MAN-AUTH-01 | AUTH-03: Google sign-in **and sign-out**, then a protected route asks to sign in | **Yes** | PENDING — not run for this candidate (the 2026-09-30 row is sign-in only, on `cab167f`) |
| MAN-REL-01 | release smoke incl. link revoke | **Yes** | PENDING — not run |
| MAN-DEAL-01 | deadline picker on a phone | No | PENDING — not run |
| MAN-WA-01 | hand-off to WhatsApp on phones | No | PENDING — not run |
| MAN-PDF-01 | PDF on phones | No | PENDING — not run |
| MAN-SHARE-01 | copy link on phones | No | PENDING — not run |
| MAN-A11Y-01 | TalkBack / VoiceOver | No | PENDING — not run |

The 45-minute work order, with URL, data, steps, evidence and privacy rules:
`DIBAYAR-E2E-REAL-DEVICE-HANDOFF-2026-10-11.md` (updated today with the
deployment finding above). It must be run on the staging deployment **after**
#44 and #45 are merged, and the deployment's SHA written in each row.

## 7. Phase 6 — release decision

**`NO-GO — BLOCKED`.**

| Gate | State | Who |
|---|---|---|
| Candidate on `staging` | No — #44 and #45 unmerged | Chris merges |
| `CI` on the final staging SHA | Not run | automatic after the merge |
| Full claim run on the final staging SHA | Not run | dispatch after the merge |
| Candidate deployed to staging, SHA verified | No | automatic; then verify |
| MAN-DUE-01, MAN-AUTH-01, MAN-REL-01 on that SHA | Pending | person with the devices and the test account |
| FIND-10 Production impact | Unknown | Chris runs the read-only query |
| Gate F3 risk acceptance | None given, none assumed | Chris |

No release PR was opened. Draft for the `staging -> main` PR body, to be
completed only when the rows above are closed:

```
Release: staging -> main (merge commit only; do not delete `staging`)

Contains: PR #41 (cross-page journeys), #42 (FIND-10 fix), #43 (six P2
journeys), #44 (FIND-12 fix, NAV-08), #45 (INV-DUE-06 real, a11y states)
plus <anything merged since 308a339>.
Product changes: src/lib/deal-validation.ts (FIND-10),
src/app/(app)/error.tsx (FIND-12). No migration.

F1  CI on release head <SHA>: <run URL> — lint-typecheck-test / e2e-critical
    / e2e-a11y / ux-audit: <verdicts>. No test.fail() covers a P0.
F2  MAN-REL-01: <row>. MAN-DUE-01 Android Chrome: <row>; iPhone Safari: <row>.
    MAN-AUTH-01 sign-in + sign-out: <row>.
    Not run: <MAN-DEAL-01 / MAN-WA-01 / MAN-PDF-01 / MAN-SHARE-01 / MAN-A11Y-01>.
F3  Outstanding P0/P1 and exception register pasted from JOURNEY-COVERAGE.md.
    Outstanding P0: INV-DUE-03 — <signed off under F2 | accepted by Chris>.
F4  Latest scheduled e2e-cross-browser: <run>. Journey coverage (full) on
    the release head: <run, claims passed / expected>.
    Open low findings: FIND-09, FIND-11 (triaged P3).
    FIND-10: fixed in code; Production count <result of the read-only
    query | not run>; repair <not needed | planned separately>.

Rollback: revert this merge with a new PR and redeploy, or promote the
previous Production deployment in Vercel; never force-push. No schema change
in this release, so no database step. Afterwards run
scripts/smoke-deployment.mjs and file a deployment verification record.
```

## 8. Task ledger

| Phase | Item | Result |
|---|---|---|
| 0 | Repo, branches, PRs, rules, checks reconciled | Done |
| 1 | Merge #44 into `staging` | **Blocked** (session permission check); not bypassed |
| 1 | FIND-10 / FIND-12 reviewed; `retry()` checked against Next 16.3.3 | Done |
| 2 | INV-DUE-06 real server failure | Done, real |
| 2 | DEAL-CREATE-07 strengthened | Done, stays partial; MAN-DEAL-01 pending |
| 2 | A11Y-01 rechecked and widened | Done, no findings, stays partial; MAN-A11Y-01 pending |
| 2 | A11Y-04 reviewed | Reclassified to partial |
| 2 | FIND-11 triaged | Done (P3 recommended) |
| 2 | PR, CI | PR #45; green on `57f98d7` |
| 3 | Merge #45; validate final staging SHA | **Not done** (depends on the merge) |
| 3 | Staging deployment identity | Verified: `390bc38`, not the candidate |
| 4 | FIND-10 read-only SQL | Written and locally checked; **not run on Production**; impact unknown |
| 5 | Real-device and sign-in checks | **Pending**, none run; handoff updated |
| 6 | Release decision | NO-GO — BLOCKED; draft checklist above |

Untouched: `main`, Production, hosted settings, Vercel SSO, Google OAuth,
Neon, branch rules. Unrelated untracked files in the working tree
(`compose.yml`, two older receipts, `src/generated/`) were left as found.
