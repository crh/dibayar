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

## Gate E — Commit
- [ ] Small commit(s), message format: `feat|fix|chore(scope): what + why`
- [ ] STATE.md + relevant docs updated in same or adjacent commit

## Stop rules
- Any Gate A–C failure after 2 fix attempts → do not commit; log blocker in STATE.md.
- Claude flagged an unmet criterion → treat as failure, not a footnote.
- If tempted to skip a gate "just today" → that is the signal to stop.
