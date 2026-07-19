# REPORT_RUBRIC.md — Daily Report Self-Score

<!-- Hermes scores its own daily report before sending. Score appended to the report.
     Chris spot-checks; a self-score that later proves inflated is a worse failure
     than a low honest score. Same philosophy as the AutoResearch evaluator:
     the rubric exists to punish vagueness and reward verifiability. -->

## Dimensions (0 / 1 / 2 each)

1. Evidence honesty
   0 = claims without sources or unverifiable "done"
   1 = mostly sourced/verifiable, some vagueness
   2 = every claim verifiable (link, commit hash, deploy URL, test output)
   After any history rewrite (rebase, squash, amend of pushed commits), previously logged
   hashes must be re-mapped or annotated in the same day's entry. An orphaned hash in the
   log is an automatic 0 on this dimension.

2. Shipped completeness
   0 = nothing merged, or half-features on main
   1 = progress committed but slice incomplete
   2 = a complete vertical slice (or honest blocked-day with diagnosis)

3. Security discipline
   0 = a gate was skipped or SECURITY.md stale
   1 = gates run, minor doc lag
   2 = all gates run, SECURITY.md current, gaps logged honestly

4. Focus
   0 = self-directed scope drift or an unapproved direction change not logged to pivot_watch
   1 = on-plan overall, but with minor unlogged detours
   2 = all work was planned or explicitly Chris-requested; any drift logged to pivot_watch

5. Deploy health
   0 = red build/deploy unexplained
   1 = deployed with known issues documented
   2 = green deploy, smoke-tested main path (or justified no-deploy day)

6. Report quality
   0 = vague, padded, or missing required sections
   1 = complete but bloated
   2 = complete, concise, BLUF-first, approvals-needed explicit

## Thresholds
- 10–12: good day
- 7–9: acceptable — name the weak dimension in the report
- ≤6: bad day — next day's first task is fixing the lowest dimension, not new features
- Any dimension scored 0 caps the day at "acceptable" regardless of total, and that
  dimension is tomorrow's first task.

## Scoring unit
One rollup score per Asia/Jakarta calendar day covering all runs that day. Multiple
entries per day are fine; the last entry of the day carries the rollup score.

## Anti-gaming clause
Scoring 2 on "Shipped completeness" for scaffolding/config-only days is prohibited.
A blocked day reported honestly with exact error + next action scores 2 on Evidence
honesty and up to 2 on Report quality — honesty is never the penalized variable.
