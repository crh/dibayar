# REVIEW_CHECKLIST.md — Pre-Commit Gates

<!-- Hermes runs this on EVERY change returned by Claude, before commit.
     Gates are sequential. A failed gate = STOP: fix or send back with the failure quoted.
     Never "commit now, fix later" on gates A–C. -->

## Gate A — Mechanical (all must pass)
- [ ] `npm install` clean (if deps changed)
- [ ] `lint` green
- [ ] `typecheck` green
- [ ] `test` green (and new tests exist if task required them)
- [ ] `build` green

## Gate B — Secrets & hygiene (all must pass)
- [ ] Diff scanned: no API keys, tokens, DB URLs, credentials, .env contents
- [ ] No new env vars undeclared in the task; Vercel-only secrets
- [ ] No unapproved new dependencies
- [ ] Repo still private

## Gate C — Security review (read the diff, don't skim)
- [ ] Every new query/route scoped to session user
- [ ] Inputs validated; outputs escaped
- [ ] Auth/session/middleware files: if touched, re-read entirely and justify
- [ ] SECURITY.md statuses updated if any control changed

## Gate D — Product quality
- [ ] Acceptance criteria from the task: each one verified, listed pass/fail
- [ ] Mobile check at 390px width (primary), no horizontal overflow
- [ ] Bahasa Indonesia copy natural (no literal-translation English structure)
- [ ] Nothing working was removed/regressed (smoke the main path)
- [ ] User-facing action added/changed → `docs/testing/journey-coverage.json` updated, and a Playwright journey drives the *visible* control (click/tap/keyboard), not only `goto`/`fill()` on a picker/API; `npm run coverage:journeys` green

## Gate E — Commit
- [ ] Small commit(s), message format: `feat|fix|chore(scope): what + why`
- [ ] STATE.md + relevant docs updated in same or adjacent commit
- [ ] DAILY_LOG entry for this run exists and ends with a rubric self-score
- [ ] STATE.md day_count equals the count of Asia/Jakarta calendar days since phase_started with activity

## Gate F — Production release (`staging -> main` PR only)
<!-- CI-green is not release readiness. Each item below is answered in the release PR body.
     Per-action detail (why, evidence, automation outlook) is the generated exception register in
     docs/testing/JOURNEY-COVERAGE.md. No coverage percentage is a gate. -->

**F1 — Automated CI blockers (absolute: a red or missing item stops the release)**
- [ ] Workflow `CI` green on the release head: `lint-typecheck-test` (includes `coverage:journeys`), `e2e-critical`, `e2e-a11y`, `ux-audit`
- [ ] No `test.fail()` expected-failure test covers a P0 action; any that exist are listed by finding ID (they are open bugs, not coverage)

**F2 — Manual sign-off (logged in `docs/testing/MANUAL-UAT.md` with device/browser/date/staging SHA/result)**
- [ ] MAN-REL-01 run on staging against the release candidate
- [ ] Every register entry marked "Blocks a release: Yes" with a manual check is logged PASS (today: MAN-DUE-01 on a real Android Chrome phone and a real iPhone Safari; MAN-AUTH-01 sign-in and sign-out). A FAIL or a missing run blocks the release unless Chris accepts the risk in the PR
- [ ] Every other manual check in the register (today: MAN-DEAL-01, MAN-WA-01, MAN-PDF-01, MAN-SHARE-01) is logged, or listed in the PR as not run. Not run does not block by itself; a FAIL is a finding and is handled as one

**F3 — Product decisions and risk acceptance (Chris, explicit, in the release PR)**
- [ ] Current `docs/testing/JOURNEY-COVERAGE.md` "Outstanding P0/P1 actions" and "Exception register" pasted into the PR
- [ ] Every outstanding **P0** is fixed, signed off under F2, or explicitly accepted by Chris
- [ ] Every "Product decision" register entry (today: none) is decided, or Chris explicitly accepts shipping the current behaviour
- [ ] "Partial by classification rule" entries (today: A11Y-01, INV-DUE-06) need no acceptance while their tests are green under F1; say so, do not report them as covered

**F4 — Informational (linked, never a blocker by themselves)**
- [ ] Latest scheduled `e2e-cross-browser` result (workflow `CI`) linked
- [ ] Latest `Journey coverage (full)` run for the release head linked, with its summary (commit, real-claim count, not exercised); dispatch one if the head has none (`docs/testing/E2E.md`). Not a release gate yet
- [ ] Open low-severity findings (today: FIND-09, FIND-11) and findings fixed on `staging` but still awaiting real-device UAT or a Production data check (e.g. FIND-02/FIND-03: MAN-DUE-01, out-of-range due-date count; FIND-10: count of deals moved back to Masuk by a contact edit) listed with their status, not reported as closed

## Stop rules
- Any Gate A–C failure after 2 fix attempts → do not commit; log blocker in STATE.md.
- Claude flagged an unmet criterion → treat as failure, not a footnote.
- If tempted to skip a gate "just today" → that is the signal to stop.
