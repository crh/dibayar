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
<!-- CI-green is not release readiness. These are listed in the release PR body. -->
- [ ] Full `@critical` + `@a11y` CI green on the release head; latest scheduled `e2e-cross-browser` result linked
- [ ] Current `docs/testing/JOURNEY-COVERAGE.md` "Outstanding P0/P1 actions" pasted into the PR; every open **P0** (`blocked`, `manual_pending`, `not_covered`, `automated_partial`) is either fixed or explicitly accepted by Chris
- [ ] `docs/testing/MANUAL-UAT.md` MAN-REL-01 run on staging, plus every P0 manual check, logged with device/browser/date/result
- [ ] Known-defect expected-failure tests (`test.fail`) listed by finding ID — they are open bugs, not coverage

## Stop rules
- Any Gate A–C failure after 2 fix attempts → do not commit; log blocker in STATE.md.
- Claude flagged an unmet criterion → treat as failure, not a footnote.
- If tempted to skip a gate "just today" → that is the signal to stop.
