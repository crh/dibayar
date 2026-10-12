# Dibayar — post-merge staging acceptance (2026-10-11)

**Release verdict: `NO-GO — PENDING OPERATOR ACCEPTANCE`.**

The candidate is on `staging`, deployed, and green on every required check.
What is missing is what only a person can supply: the three manual gates
(MAN-DUE-01, MAN-AUTH-01, MAN-REL-01), the FIND-10 count on Production, and
Chris's decisions in the release PR. One automated signal is red and is
explained in §3: the Firefox/WebKit run failed, for a test-harness reason.

| | |
|---|---|
| Repository | `crh/dibayar`, local `/home/kenji/code/dibayar` |
| Candidate, `origin/staging` | `fe012816bf3691941600d605dcea589187923d1a` — merge commit of PR #45 (2026-10-11 17:27 WIB), parents `390bc38` (previous `staging`) and `3f27af8` (PR #45 head) |
| `origin/main` | `308a339e7de817aa37378d263d51f25c78ea4f09` — unchanged, before and after this session |
| Deployed on the staging alias | `fe01281`, deployment `dpl_2gyAk5xL9tmoiM1kPwVx2K4BRohd` (§4) |
| Times | Asia/Jakarta unless marked UTC |

> **Addendum, 2026-10-12.** This receipt is a record of 2026-10-11 and is
> left as written. Since then PR #46 was merged (by Chris, 2026-10-12 05:18
> WIB) and `staging` moved from `fe01281` to
> `eea298d94dbf71925a542a8e74d5a36ff4217734`. Statements below such as
> "PR #46 is open" and "the alias serves `fe01281`" were true then and are
> not true now. Current status, runs and deployment for `eea298d`:
> `DIBAYAR-POST-PR46-RELEASE-READINESS-2026-10-12.md`.

## 1. What a person has to do next

1. **Run the three blocking manual checks** on the staging deployment
   (`fe01281`), about 20 minutes: the checklist at the top of
   `DIBAYAR-E2E-REAL-DEVICE-HANDOFF-2026-10-11.md`. Needs a real Android
   phone, a real iPhone and the staging Google test account. Log the rows in
   `docs/testing/MANUAL-UAT.md` (blank rows for this candidate are under the
   run log).
2. **Chris: run the FIND-10 count on Production**, read-only (§5 has the
   exact procedure), then decide whether a repair is planned.
3. **Chris: decide PR #46** (the cross-browser guard fix, §3). Merging it
   moves `staging` past `fe01281`; the checks in §2 then need a rerun on the
   new head, and the manual rows should name the SHA actually deployed.
4. **Chris: open and decide the release PR** `staging -> main` with Gate F
   filled in (draft in §7). Not opened by this session.
5. Merge this receipt's documentation PR into `staging` when convenient; it
   changes documentation only.

## 2. The candidate, and the checks on it

Reconciled from GitHub and Git, not assumed:

- PRs #41, #42, #43, #44 and #45 are all `MERGED` into `staging`. GitHub
  records the same merge commit, `fe01281`, for all five: #45's head
  contained the whole stack, so one merge integrated it. None was re-merged
  or closed by this session.
- `origin/staging` is exactly `fe01281`. Nothing was pushed to it between the
  merge and the end of this session (rechecked after the last run finished).
- The merged tree is identical to PR #45's head (`git diff 3f27af8
  origin/staging` is empty). It contains the FIND-10 fix
  (`src/lib/deal-validation.ts`: the patch schema has no status default),
  the FIND-12 fix (`src/app/(app)/error.tsx`: `retry()`), and the stack's
  tests (`e2e/journeys/`, `e2e/deals/patch-keeps-stage.spec.ts`, and the rest).
- `main` is not an ancestor of `staging` by one commit: `308a339`, the merge
  commit of the last release PR (#23). Its tree equals its `staging` parent's,
  so no content is missing from `staging`. The release PR will show it; it is
  not a conflict.
- Ruleset `24837655` is active on `main` and `staging` with no bypass actors:
  pull request, required checks, no deletion, no force push. Not changed.
- Open PRs: #39 (dependabot, targets `main`, untouched) and #46 (this
  session, §3).

Runs on `fe012816bf3691941600d605dcea589187923d1a` itself, branch `staging`:

| Run | Trigger | Verdict |
|---|---|---|
| `CI` [38132023042](https://github.com/crh/dibayar/actions/runs/38132023042) | the merge's own push | **success** |
| `Journey coverage (full)` [38132435423](https://github.com/crh/dibayar/actions/runs/38132435423) | dispatched on `staging` by this session | **success** |
| `CI` [38132454448](https://github.com/crh/dibayar/actions/runs/38132454448) | dispatched on `staging` by this session, to get Firefox and WebKit | **failure** — `e2e-cross-browser` only (§3) |

Jobs of the push run, the one the required checks read:

| Job | Result | Counts |
|---|---|---|
| `lint-typecheck-test` | success | unit 989/989 in 85 files; vercel-ignore 48/48; launcher 39/39; coverage self-test 37/37; `coverage:journeys` OK; default build passes |
| `e2e-critical` | success | 252 passed, 28 skipped, 0 failed, 0 flaky (no retry used); 144 of 149 real claims exercised by this tier, the other 5 belong to `ux-audit` and the full run |
| `e2e-a11y` | success | 29 passed, 1 skipped |
| `ux-audit` | success | 69 passed, plus its 9-test self-check |
| `e2e-cross-browser` | **skipped** | by design on a push; not counted as a pass |

Full claim check on the same SHA (run 38132435423): **149 of 149 real claims
passed, 0 not exercised.** 297 passed, 29 skipped, 0 failed, 0 flaky;
ux-audit 69 passed. Evidence artifact `journey-coverage-full-evidence`
(id 11699484577, kept until 2027-01-09). The run before the merge had one
flaky test (the reduced-motion control in Chromium); it did not recur here.

The 28 and 29 skips are tests scoped to one project by the test itself (a
keyboard journey has no phone variant, a typed date is desktop-only). None
was added or changed by this session.

Coverage, unchanged by the merge: real interaction 82/93 (88.2%); P0 real
28/30 (93.3%); manual verified 1; outstanding P0/P1 3 — INV-DUE-03 (P0,
manual pending), DEAL-CREATE-07 (P1, partial plus a manual check), A11Y-01
(P1, partial by rule). No percentage is a gate.

## 3. Firefox and WebKit: red, for a harness reason

Before this session there was no cross-browser evidence for this code: the
scheduled `e2e-cross-browser` runs test `main` (`308a339`), most recently
[37909381951](https://github.com/crh/dibayar/actions/runs/37909381951)
(2026-10-09, success). So the workflow was dispatched on `staging`.

Result on `fe01281` (run 38132454448, job `e2e-cross-browser`, all four
engines): **7 failed, 2 flaky, 574 passed, 69 skipped.** The same run's
`lint-typecheck-test`, `e2e-critical` (252 passed), `e2e-a11y` and
`ux-audit` succeeded again.

| Test | Firefox | WebKit |
|---|---|---|
| `auth/session-expiry.spec.ts:61` reload after the session expired | failed | failed |
| `auth/settings-sign-out.spec.ts:34` sign out from Pengaturan | failed | failed |
| `journeys/resilience-permissions.spec.ts:87` expired session, revoked link | failed | failed |
| `smoke/secondary-nav.spec.ts:138` signed-out `/dashboard` goes to sign-in | flaky | failed |
| `smoke/reduced-motion.spec.ts:118` reduced motion | passed | flaky |

**The seven failures and the Firefox flake have one cause, and it is not in
the product.** Every one of them reaches Auth.js's built-in sign-in page.
That page loads the Google logo from `https://authjs.dev/img/providers/google.svg`.
The test moves on before the image has loaded, Firefox and WebKit report the
cancelled image request, and the suite's browser-health guard fails the test
for it. Chromium reports nothing, which is why the pull-request gate is
green. In all seven, every assertion about the product passed; the only
error is the guard's "Unexpected browser diagnostics" with that one URL.

Reproduced locally on `fe01281` in both engines, then fixed in the guard:
a cancelled `/img/providers/` image from `https://authjs.dev` is dropped,
next to the existing rule for a cancelled favicon. Nothing else is relaxed.
**PR #46** (`fix/e2e-guard-authjs-logo-cancel-2026-10-11`, commit `acad376`),
into `staging`, not merged. Its checks on `acad376`:
`CI` [38135536711](https://github.com/crh/dibayar/actions/runs/38135536711)
(pull request) success on all four required jobs, and a dispatched `CI`
[38135536022](https://github.com/crh/dibayar/actions/runs/38135536022) whose
`e2e-cross-browser` **succeeded: 581 passed, 0 failed, 2 flaky, 69 skipped.**
That run is evidence for `acad376` (the candidate plus the guard rule), not
for `fe01281`.

Left open, stated rather than retried away:

- **WebKit reduced-motion flake, recurring: 2 of 2 cross-browser runs.**
  `smoke/reduced-motion.spec.ts:118` failed its first attempt in both runs
  with the same values: with reduced motion requested, the account menu
  measured `opacity: 0` and a 146.5px offset where the test expects it at
  rest. The retry passed both times. Cause not established: it may be the
  test reading one frame too early, or WebKit really showing the menu's
  start state for a moment. It belongs to A11Y-04, already classified
  partial. PR #45 fixed a similar flake of this control in Chromium; this
  one is not fixed and should be looked at before A11Y-04 is relied on in
  Safari.
- **Firefox due-date flake, seen once** (run 38135536022 only):
  `invoices/due-date-integrity.spec.ts:96`, the filled due-date text was not
  in the viewport within 5 s after scrolling to it; the retry passed. It did
  not occur in the run on `fe01281`. Firefox is not a claimed project for
  INV-DUE-02; noted, not investigated.
- **`smoke/secondary-nav.spec.ts:85` fails on this machine only**, in Firefox
  (`page.reload: NS_BINDING_ABORTED`) and WebKit (a cancelled
  `_next/static` chunk on the reload), twice, with and without the guard
  change. In CI it passed at the first attempt in all four engines. Not
  investigated further; not a CI finding.
- **Product observation, not changed:** the sign-in page fetches an image
  from a third-party host (`authjs.dev`). Self-hosting the logo or a custom
  sign-in page is a product decision.

For the release: `e2e-cross-browser` is Gate F4, informational, and the
required four checks are green. The red run is still a red run on the
candidate and goes in the release PR as such.

## 4. Hosted staging

| | |
|---|---|
| Alias | `https://dibayar-git-staging-kenji-iwakura.vercel.app` |
| Deployment | `dpl_2gyAk5xL9tmoiM1kPwVx2K4BRohd`, `https://dibayar-j67dyrst2-kenji-iwakura.vercel.app`, target preview, **Ready** |
| Commit | `fe012816bf3691941600d605dcea589187923d1a` — GitHub deployment `6994209621` (environment Preview, that SHA, state success, 2026-10-11 10:28:21 UTC), and the build log's own line `Cloning github.com/crh/dibayar (Branch: staging, Commit: fe01281)` |
| Created | 2026-10-11 17:27:41 WIB; completed 17:28:20 |
| Alias → deployment | `vercel inspect` of the alias resolves to that deployment (the alias had served `390bc38` before the merge) |
| Migrations | build log: `12 migrations found`, `No pending migrations to apply` (this release has no migration) |
| Protection | Vercel SSO on: the alias answers `302` to `vercel.com/sso-api`. Not changed, not bypassed |

"Ready" is a build state. What was checked beyond it, and how:

**`scripts/smoke-deployment.mjs` without a session: BLOCKED, not a result.**
Run against the alias it prints `SMOKE_TEST_STATUS=FAIL`: all four requests
are answered by Vercel's SSO redirect before they reach the app. Its
`[PASS] root (/)` line is the same redirect and proves nothing about the
product. This is the access limit, not a product failure.

**Read-only look through an authorized browser: no problem found.** The
desktop Chrome connected to this session already held the account holder's
Vercel SSO session and an app session for staging. Nothing was signed in or
out, nothing was written, no setting was touched. Through it, on the alias,
between 17:40 and 18:00 WIB:

| Check | Result |
|---|---|
| `/api/auth/providers` | 200; Google provider; callback on the staging host |
| `/api/auth/signin`, `/api/auth/csrf` | 200; a CSRF value is issued (not recorded) |
| `/api/auth/session` | 200; a signed-in user is present (not recorded) |
| `/`, `/deal`, `/invoice`, `/pengaturan` | 200 each, at their own address; no "Gagal memuat." card; no reference to a Production host in the HTML |
| Console on `/` and `/deal` after load | no errors |

These are the smoke script's four checks plus four page loads, as a
signed-in user. They are **not** MAN-REL-01: no deal or invoice was created,
no link revoked, no phone used, and no sign-in or sign-out performed. The
interface language of that session was English.

```
ENVIRONMENT=preview (staging)
COMMIT_SHA=fe012816bf3691941600d605dcea589187923d1a
DEPLOYMENT_URL=https://dibayar-git-staging-kenji-iwakura.vercel.app (dpl_2gyAk5xL9tmoiM1kPwVx2K4BRohd)
DEPLOYED_AT=2026-10-11T10:28:20Z
AUTH_STATUS=OK through an existing authorized browser session (signin/providers/csrf 200); unauthenticated script blocked by Vercel SSO
DATABASE_CONNECTIVITY=signed-in pages render (session lookup and page queries answered); no dedicated health endpoint
MIGRATION_STATUS=12 found, none pending (build log)
SMOKE_TEST_STATUS=script BLOCKED by SSO; read-only authorized-browser equivalent PASS; MAN-REL-01 PENDING
VERIFIED_BY=Claude Code session, 2026-10-11
```

Production was not deployed, inspected or contacted. Nothing here says
Production is updated: it is not, `main` is still `308a339`.

## 5. FIND-10 Production impact

**Status: `NOT RUN — operator action required`. Impact: UNKNOWN, not zero.**

No approved read-only Production role or access route is configured for
this session. No credential was looked for and no Production connection was
attempted. Production still runs the code with the bug: the fix is on
`staging` only, so the exposure window is open until the release.

The query, `docs/receipts/sql/DIBAYAR-FIND-10-IMPACT-READONLY-2026-10-11.sql`
(unchanged since `c586cc6`), reviewed again:

| Property | Finding |
|---|---|
| Read-only | `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`; two `SELECT`s; no DDL, DML or function call that writes |
| Bounded | `statement_timeout` 15 s, `lock_timeout` 2 s, idle-in-transaction 60 s, all `SET LOCAL` |
| Window | start `2026-09-06 04:35:07+00` (merge `b6119d2`, when both the triggering screens and the stage history reached `main`); end `now()`, in one `params` block per statement |
| Output | counts only, per bucket, plus four scale figures. No brand, name, number, id or token is selected |
| Types | `DealStageTransition.createdAt` is `timestamptz`; `Invoice.createdAt` is zone-less and is converted with `AT TIME ZONE 'UTC'`; checked against `prisma/schema.prisma` |
| Caveat | with few accounts a count can still point at one person; treat the result as internal |

What the result can and cannot say. The history records from, to and time,
not which fields the request carried. So no row is a confirmed accident.

- **probable**: a move to Masuk that skipped at least one stage, or of a deal
  that already had an invoice. The buttons go one stage at a time; only a
  desktop drag onto the Masuk column does this on purpose.
- **possible**: `NEGO → MASUK` without an invoice, the same row the
  **Kembali ke Masuk** button writes. Only the owner knows.
- **confirmed**: none can exist from this data. A deal deleted since has no
  history and is not counted.

Procedure for Chris, the route earlier Production reads in this project used:

1. Neon Console → project of `neon-dijual` → **SQL Editor**.
2. Branch selector: `main` (Production). Confirm it is not `staging`
   (`br-late-grass-aoea90yk`). If a read-only role exists, select it.
3. Paste the whole file as one batch and run it once. Do not edit it, and do
   not run a part of it.
4. Copy the two result grids (first: one row per bucket, `probable` /
   `possible`; second: one row of scale figures) into the release PR. No
   screenshot of anything else.
5. Stop there. Nothing in the file repairs anything, and nothing should be
   repaired from the editor.

Recommendation, for Chris to decide after the count:

- `probable` = 0 and `possible` = 0: no recovery plan. Record the result and
  close FIND-10's data question.
- `probable` > 0 with `deals_at_masuk_now` > 0: a **separately reviewed**
  recovery plan is warranted. Per deal, restore the `fromStatus` of its
  latest reset row, only where the deal is still at Masuk and has not been
  moved since, with a compensating history row rather than a deleted one,
  rehearsed on a Neon branch first, under its own approval.
- `probable` > 0 but every deal has moved on (`deals_moved_on_since`): the
  owners already corrected them; only a misleading history line is left. No
  repair recommended.
- Only `possible` > 0: no script. Ask the account owners, or leave it.

No repair was written, rehearsed or applied.

## 6. Manual gates

Rechecked on this machine: `adb` is not installed, `idevice_id` lists no
iPhone. No Google sign-in or sign-out was performed. Emulation was not used
as a substitute. Nothing was logged as a result in `MANUAL-UAT.md`.

Blocking (Gate F2):

| Check | Covers | Status for `fe01281` |
|---|---|---|
| MAN-DUE-01 | INV-DUE-03: native due-date picker on a real Android Chrome phone and a real iPhone Safari, incl. the fast wheel and persistence after reload | **MANUAL PENDING** — not run |
| MAN-AUTH-01 | AUTH-03: Google sign-in **and sign-out**; a protected route asks to sign in afterwards | **MANUAL PENDING** — not run. The only logged row is sign-in only, on `cab167f` (2026-09-30) |
| MAN-REL-01 | hosted smoke: deal → invoice → sent → due date → share link → revoke | **MANUAL PENDING** — not run. §4's read-only look is not this check |

Not blocking; each must be listed in the release PR as run or not run:

| Check | Status | Risk while not run |
|---|---|---|
| MAN-DEAL-01 | not run | the deadline picker in the add-deal dialog is proven on desktop Chromium by typing only; a phone picker fault would go unseen |
| MAN-WA-01 | not run | the hand-off to the WhatsApp app and real phone or in-app-browser popup blocking are unproven; Chromium is automated |
| MAN-PDF-01 | not run | how a phone hands the PDF to its viewer is unproven; the file and its text are automated |
| MAN-SHARE-01 | not run | clipboard copy on phones is unproven; desktop Chromium is automated |
| MAN-A11Y-01 | not run | no screen-reader evidence for the due-date field |

Handoff refreshed for this SHA: `DIBAYAR-E2E-REAL-DEVICE-HANDOFF-2026-10-11.md`
has a new dated update with the deployment identity and a three-check
checklist (steps, expected outcome, evidence). Its earlier text is kept.
`docs/testing/MANUAL-UAT.md` has blank rows for the candidate under the run
log, marked as not results.

## 7. Release decision

**`NO-GO — PENDING OPERATOR ACCEPTANCE`.**

| Gate | State | Who |
|---|---|---|
| Candidate on `staging` | **Yes**, `fe01281` | done |
| F1: `CI` on the release head | **Green**, run 38132023042, all four required jobs | done |
| F1: no `test.fail()` on a P0 | none (`coverage:journeys` passes; it rejects one) | done |
| F2: MAN-REL-01, MAN-DUE-01 (both phones), MAN-AUTH-01 (in and out) | **Pending** | person with the devices and the test account |
| F2: other manual checks | not run; to be listed | same |
| F3: outstanding P0 INV-DUE-03 | open until MAN-DUE-01 passes, or Chris accepts it | Chris |
| F3: risk acceptance | none given, none assumed | Chris |
| F4: full claim run on the head | **149/149**, run 38132435423 | done |
| F4: cross-browser | scheduled, on `main`: success (37909381951). Dispatched, on the head: **failure**, harness cause, fix in PR #46 | Chris decides #46 |
| F4: FIND-10 Production count | **Not run** | Chris |
| Candidate deployed, SHA verified | **Yes** (§4) | done |

No release PR was opened. Draft body for `staging -> main`:

```
Release: staging -> main (merge commit only; do not delete `staging`)

Head: <staging SHA; fe012816bf3691941600d605dcea589187923d1a unless #46 or
anything else has merged since>
Contains: PR #41 (cross-page journeys), #42 (FIND-10 fix), #43 (six P2
journeys), #44 (FIND-12 fix, NAV-08), #45 (INV-DUE-06 real, a11y states),
and everything else on staging since 308a339 (104 commits at fe01281).
Product changes in this stack: src/lib/deal-validation.ts (FIND-10),
src/app/(app)/error.tsx (FIND-12). No migration in this stack: staging's
build reports 12 migrations, none pending.

F1  CI on fe01281: https://github.com/crh/dibayar/actions/runs/38132023042
    lint-typecheck-test / e2e-critical / e2e-a11y / ux-audit: success.
    No test.fail() covers a P0.
F2  MAN-REL-01: <row>.
    MAN-DUE-01 Android Chrome: <row>; iPhone Safari: <row>.
    MAN-AUTH-01 sign-in + sign-out: <row>.
    Not run: <MAN-DEAL-01 / MAN-WA-01 / MAN-PDF-01 / MAN-SHARE-01 / MAN-A11Y-01>.
F3  Outstanding P0/P1 and exception register pasted from JOURNEY-COVERAGE.md.
    Outstanding P0: INV-DUE-03 — <signed off under F2 | accepted by Chris>.
    A11Y-01: partial by rule, tests green under F1; not reported as covered.
F4  Journey coverage (full) on fe01281:
    https://github.com/crh/dibayar/actions/runs/38132435423 — 149/149 real
    claims, 0 not exercised.
    e2e-cross-browser, scheduled (main): run 37909381951, success.
    e2e-cross-browser, dispatched on fe01281: run 38132454448, FAILURE,
    7 failed / 2 flaky; cause: the test guard and Auth.js's third-party
    logo; fix PR #46 <merged | not merged>; with the fix (acad376), run
    38135536022: 581 passed, 0 failed, 2 flaky.
    Open: WebKit reduced-motion flake, 2 of 2 runs (A11Y-04, partial).
    Open low findings: FIND-09, FIND-11 (triaged P3).
    FIND-10: fixed in code; Production count <probable / possible | not
    run>; repair <not needed | planned separately>.

Rollback: revert this merge with a new PR and redeploy, or promote the
previous Production deployment in Vercel; never force-push. No schema change,
so no database step. Afterwards run scripts/smoke-deployment.mjs and file a
deployment verification record.
```

## 8. What this session changed

| Where | Change |
|---|---|
| GitHub Actions | dispatched `Journey coverage (full)` on `staging` (38132435423); dispatched `CI` on `staging` (38132454448) and on the fix branch (38135536022). No run was cancelled or re-run |
| Branch `fix/e2e-guard-authjs-logo-cancel-2026-10-11` | new, from `fe01281`; one commit `acad376` (`e2e/support/test.ts`); **PR #46** into `staging`, open |
| Branch `chore/post-merge-staging-acceptance-2026-10-11` | new, from `fe01281`; this receipt, the handoff update, the `MANUAL-UAT.md` rows, `STATE.md`, `DAILY_LOG.md`; documentation PR into `staging`, open |
| Local test database | the E2E fixture seeded and reset `localhost:55432/dibayar_test` for the local Firefox/WebKit runs |
| Staging, through the browser | reads only (§4) |

Not changed: `main`, `staging` (no push, no merge), Production and its
database, Neon branches, Vercel settings and environment variables, Google
OAuth, SSO protection, the branch ruleset, any PR other than the two opened
here. No secret was read or printed. Unrelated untracked files in the
working tree (`compose.yml`, two older receipts, `src/generated/`) were left
as found.
