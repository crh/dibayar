# Dibayar — Production recovery readiness receipt (release PR #67)

- **Task:** the 2026-10-20 packet, run 2026-10-21 05:00–06:00 WIB (2026-10-20 ~22:00–23:00Z) by Claude Code.
- **Status:** local, uncommitted.
- **Runbook:** `docs/receipts/DIBAYAR-PRODUCTION-RECOVERY-RUNBOOK.md`. It sits beside the Neon preflight receipt because `docs/ops/` does not exist.

## Status: `BLOCKED_WITH_REASONS`

A runbook now exists, and the app-rollback path is schema-compatible. Neither of those makes the release safe to merge. The open blockers are:

1. ~~Production's database mapping is unverified.~~ Cleared 2026-10-25, owner-reported and corroborated (#12).
2. Rolling the app back would remove the pilot allowlist.
3. The Neon restore procedure has not been observed or tested.
4. The backup is stale.
5. The F2 manual-test metadata is missing.

## Findings

| # | Finding | Evidence | Label |
|---|---|---|---|
| 1 | Refs have not drifted. `staging` = `41085231cf386acb8e0309b83d61086b5a49ef92` and `main` = `308a339e7de817aa37378d263d51f25c78ea4f09`. PR #67 is OPEN and **Draft**, mergeable CLEAN, with no review decision and 0 unresolved threads. | `git fetch` + `git rev-parse`; `gh pr view 67`; GraphQL reviewThreads, 2026-10-20 22:40Z | OBSERVED |
| 2 | Required checks are green on the exact head. On `41085231`: push CI 39181004556 and PR CI 39181008249 both passed `lint-typecheck-test`, `e2e-critical`, `e2e-a11y` and `ux-audit` (`e2e-cross-browser` skipped). Journey coverage (full) 39181008236 passed. | `gh run view` | OBSERVED |
| 3 | What ruleset 24837655 enforces on `main` and `staging`: no deletion, no force-push, PR required, 0 approvals, review threads resolved, the 4 required checks above, merge methods merge or squash, no bypass actors. | `gh api …/rulesets/24837655` | OBSERVED |
| 4 | The PR #67 body is stale. Its baseline and evidence still cite `7aeaa7b`, while the head is `4108523`. All 8 release checkboxes are unchecked. | PR body §1, header | OBSERVED |
| 5 | Live Production deployment: `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5` (`dibayar-2c7u9sbjh-kenji-iwakura.vercel.app`), commit `308a339`, created 2026-10-19 16:27:22 WIB, Ready, aliased to `dibayar.vercel.app`. Its build ran `12 migrations found … No pending migrations to apply`. This is a rebuild of unchanged `main`, right after the allowlist was saved. | `vercel ls --prod`, `vercel inspect` (+ `--logs`, filtered lines only) | OBSERVED |
| 6 | Previous Production deployment: `dpl_54LBdY2Di8sgdjahifpAi5W27AuP` (`dibayar-ibjl0qdqi…`), commit `308a339`, 2026-10-03 07:27 WIB, Ready. About 20 older Production deployments are listed as Ready. | `vercel ls --prod` | OBSERVED |
| 7 | **A Vercel rollback has never been exercised on this project.** No rollback is in progress. The dashboard rollback UI was **not observed**: the Chrome extension was not connected, and the DevTools browser was signed out of Vercel and Neon. No sign-in was attempted. | `vercel rollback status dibayar`; `DEPLOYMENT.md:374-376` | OBSERVED / UNVERIFIED (UI) |
| 8 | **The app rollback is schema-compatible.** I rehearsed it on the approved local disposable DB (`localhost:55432/dibayar_test`), in an isolated schema `rollback_rehearsal_20261021` that I dropped afterwards. I applied staging's 14 migrations first. Running `main`'s 12-migration tree against it, `migrate status` reported "Database schema is up to date!" and `migrate deploy` reported `No pending migrations to apply` (exit 0, nothing changed). `main`'s generated Prisma 7.9.1 client then created, updated, read and deleted synthetic user, deal and invoice rows without error. | Local commands this session; schema-drop confirmed (0 remaining) | OBSERVED (local) / INFERRED (Production) |
| 9 | **Rolling the app back is a security regression.** `308a339` predates PR #69 (the pilot gate) and PR #68 (`next` 16.3.3 → 16.3.8). While rolled back, any Google account can sign in and the #66 advisories return. Decision A snapshots are not enforced, though their rows are preserved. | `git log origin/staging`, `src/lib/pilot-access.ts`, `package.json` diff | OBSERVED (code) / INFERRED (effect) |
| 10 | A Git revert rebuild reruns `migrate deploy`. Per #8 that is a no-op. The real risk is the revert-of-a-merge trap when syncing to `staging`. | `scripts/vercel-build.sh`; runbook §3.4 | OBSERVED / INFERRED |
| 11 | **Production reads the static `DATABASE_URL` Secret** (Production scope, created about 64 days ago), not the Neon-integration `DATABASE_URL_*` Config vars (Production, Preview and Development, about 99 days ago). So the integration's "Production → `main`" mapping does not prove what Production connects to. The build log redacts the host. | `vercel env ls production`; `src/lib/prisma.ts`; build log `Datasource … at "[REDACTED]"` | OBSERVED |
| 12 | **The Production DB → Neon `main` mapping: CLEARED 2026-10-25 (owner-reported, corroborated).** Chris's wake-up check: after loading and signing in to `dibayar.vercel.app`, Neon `main`'s compute was Active while `backup-preprod-20261019` and `staging` stayed Suspended. Caveat: he did not say whether `main` was idle before the load. Combined with the `ep-nameless-salad-aoa0saz5` endpoint ID and the 12-migration match, the evidence is consistent. The host check via `vercel env pull` was not completed. Original finding: Circumstantially consistent: Production sees 12 applied migrations, as does `main`, while `staging` has 14. Runbook §4.1 gives an operator-only check that reveals nothing. **Update 2026-10-25:** Chris reported the endpoint `ep-nameless-salad-aoa0saz5`. The repository already records that ID as Neon `main`'s endpoint: Neon API read in `docs/receipts/DIBAYAR-NEON-VERCEL-PREVIEW-DATABASE-BINDING-RECEIPT.md:103`, and `DAILY_LOG.md:518` (2026-08-17, "Production/`main`"). It is not staging (`ep-gentle-morning-aofsje23`). If Chris read that ID from the host of the Production `DATABASE_URL`, the mapping is confirmed. If he read it from Neon's `main` page, only one side of the comparison is done. Which one he did is pending. | #5, preflight receipt, Chris 2026-10-25 | OWNER-REPORTED (pending: which side) |
| 13 | `PILOT_ALLOWED_EMAILS` is present, scoped to Production and Preview, created about 2 days ago, and its value was not read. Its type is **Config (not Sensitive)**, which contradicts `DEPLOYMENT.md`'s "sensitive". `PILOT_ACCESS_MODE` is absent from Production. | `vercel env ls production` | OBSERVED |
| 14 | Neon project, branch and backup identity are as reported in the preflight receipt: `backup-preprod-20261019`, parent `main`, data and schema, Expires Never, ID `br-mute-glade-aou2i…` (truncated). I did not re-observe them: the console was not signed in and `neonctl` is not installed. | `docs/receipts/DIBAYAR-NEON-PRODUCTION-BACKUP-PREFLIGHT-2026-10-20.md` | OWNER-REPORTED |
| 15 | Plan: Neon Free, 6 h history retention (owner-reported); branch limit 10 (`free_v3`, `DEPLOYMENT.md` 2026-09-26), 3 in use (owner-reported 2026-10-20). | as cited | OWNER-REPORTED / recorded |
| 16 | **A Production restore procedure is neither verified nor tested.** Restore-from-branch and PITR are inferred from Neon's API. The console path is marked `BLOCKED_VERIFY_PROCEDURE`. | runbook §4.3 | UNVERIFIED |
| 17 | F2 manual evidence for `4108523`: owner-reported "1 is done" and allowlist allow/deny PASS (2026-10-19 PR comments). There is no tested SHA, device, browser, language or time. `docs/testing/MANUAL-UAT.md` on `staging` has no row for this candidate. | PR #67 comments; `git show origin/staging:docs/testing/MANUAL-UAT.md` | OWNER-REPORTED / gap OBSERVED |
| 18 | #56 and #57 are OPEN, with dispositions recommended and owner-followed per the 2026-10-18 comment. #68 and #69 are MERGED into `staging`. #66 is still **OPEN** although #68 patched it. #65 is OPEN (it tracks `7aeaa7b`). | `gh issue/pr view` | OBSERVED |

## Recovery specifics

- **Previous deployment for app rollback after release:** `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5` / `308a339`. It is schema-compatible (#8) but security-regressive (#9). No Production smoke has been recorded for it yet.
- **Backup:** `backup-preprod-20261019`, created 2026-10-20 11:06:27 console time (≈ 04:06:27Z if the console showed WIB), expiry Never. About **18.5 h old** at the time of writing.
  - A restore from it loses every Production write made after that time.
  - Free-plan PITR (6 h) can no longer reach back before it.
  - **Refresh procedure (Chris, within about 1 h before merge):** Neon → `neon-dijual` → Branches → New branch → parent `main`, current point in time, data and schema, Expires/Auto-delete = Never, name `backup-prerelease-<YYYYMMDD-HHMM>` → record the full ID and creation time. Keep the old backup.
- **Downtime:** UNKNOWN for both app rollback and restore. Neither has been measured.

## Blocked access and manual steps

- **Chrome extension** not connected. The **DevTools browser** is not signed in to Vercel or Neon. I did not sign in (credential entry is prohibited). Every console UI observation is therefore UNVERIFIED, and Chris must do the read-only UI checks in runbook §5.9.
- No **Neon CLI** is installed, so I could not read branch data independently.
- Every Production action is Chris's: merge, rollback or promote, env change (allowlist to Sensitive), backup refresh, restore, and SQL in the Neon editor. Claude Code's permission layer has denied merges and Neon shared-resource actions before.

## Remaining gaps

- **F2:** formal metadata for `4108523`, or Chris's written acceptance of the gap.
- **Review:** PR still in Draft; body stale (`7aeaa7b`); #66 disposition; #56/#57 restated for this head.
- **Rollback:** dashboard path unobserved; rollback never exercised; allowlist regression on rollback needs explicit acceptance or a containment plan; RTO unknown.
- **Backup freshness:** a refresh is required close to merge.
- **Production env mapping:** static `DATABASE_URL` → `main` is cleared (owner-reported, corroborated; #12). Separately, `PILOT_ALLOWED_EMAILS` should be Sensitive.
- **Re-check 2026-10-25 08:06Z:** refs are unchanged (`main` `308a339`, `staging` `4108523`) and PR #67 is still Draft. The backup is now about 5 days old, so it must be refreshed before merging.

## Attestation

No Production writes, merge, deploy, promote, rollback, restore, branch creation, env change, PR, Git commit or push, and no secret or customer-data exposure. Everything I ran was read-only:

- `git fetch`;
- `gh` reads;
- `vercel ls`, `inspect`, `env ls` (names and scopes only), `project inspect`, `rollback status`;
- build-log lines filtered to commit and migration messages.

The only database writes were synthetic rows in a throwaway schema on the local disposable test DB, and that schema was dropped. Two browser pages were opened to the Vercel and Neon login screens; both were left signed out, and the one I created was closed.

## Smallest next action for Chris

*Updated 2026-10-25, after the DB mapping was cleared.*

The next step is a decision, not the backup refresh (that belongs within about an hour before the merge). Post in PR #67 whether you accept that an app rollback to `308a339` reopens sign-in to every Google account (runbook §2.3). If you do not accept it, name the containment step (for example Vercel Deployment Protection on Production during a rollback). This decides whether the app-rollback path is usable at all.

<details><summary>Original next action (2026-10-21, done)</summary>


Run the runbook **§4.1 operator check**: compare the host of the Production `DATABASE_URL` with Neon `main`'s `ep-…` endpoint ID, in your own terminal, pasting nothing. It is the highest-risk unknown: every backup, restore and post-merge verification step assumes Production is on Neon `main`, and nothing has proved that yet.

</details>
