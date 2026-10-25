# Dibayar PR #67: owner actions (Chris only)

Prepared 2026-10-25 by Claude Code. This file lists what only Chris can do before release PR #67 (`staging` → `main`) can be merged. Nothing here has been done by Claude Code. Evidence and reasoning:

- `docs/receipts/DIBAYAR-PR67-RELEASE-READINESS-2026-10-25.md`: gates;
- `docs/receipts/DIBAYAR-RECOVERY-HARDENING-2026-10-25.md`: findings and tests;
- `docs/receipts/DIBAYAR-PRODUCTION-RECOVERY-RUNBOOK.md`: procedures.

Rules for every step:

- The repository is public. Never paste email addresses, connection strings, tokens or customer rows into a PR, issue, chat, log or receipt.
- Each Production action needs its own authorization phrase (runbook §1.2). Approving one approves nothing else.
- If a screen or output does not match what is written here, stop and ask. Do not improvise.

Release head at the time of writing: `41085231cf386acb8e0309b83d61086b5a49ef92`. Production: `main` `308a339`, `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5`.

---

## 1. Decide the dependency question (it fixes the release head)

**Why first:** whether the release head moves decides which SHA CI, the manual tests and the recovery candidate must match. If you choose to patch, everything below happens on the new head.

- **Reason:** advisories published after the #68 patch now affect `next` 16.3.8 on the release head and in the recovery candidate:
  - GHSA-2464-fhr4-w9xw, critical, 2026-10-22;
  - GHSA-673q-mjm6-r5xr, critical, 2026-10-22;
  - GHSA-p3m5-59mp-jv5r, high, 2026-10-22;
  - `zod` GHSA-mrhx-c7xc-m3w5, high, 2026-10-01;
  - `fast-uri`, moderate.

  Current Production (`next` 16.3.3, `sharp` 0.35.4) is affected too. None of the preconditions exist in this code: no Server Actions, no `use cache`, no `next/image`, no `z.array`; `sharp` 0.35.5 is the vendor's own workaround for GHSA-2464. So neither is INFERRED exploitable. The vendor still says to upgrade.
- **Options:**
  - (A) Merge PR #70 (`chore/security-deps-2026-10-25`) into `staging`. This bumps `next` to 16.4.2, `zod` to 4.6.7 and `fast-uri` to 3.1.9; the patched tree audits to 0 vulnerabilities. It is a new release head: CI and the F2 rows apply to the new SHA, and the recovery candidate gets the same bump.
  - (B) Release `4108523` as is, then patch.
- **Risk:**
  - (A): `next` 16.3 → 16.4 is a minor upgrade. It is tested locally (hardening receipt §3.4), but the CI run on the PR is the gate.
  - (B): advisories with unmet preconditions remain until the follow-up.
- **Expected evidence:** a PR #67 comment, "Dependencies: (A) …" or "(B) … accepted until <date>".
- **Separate authorization:** no Production action. Merging into `staging` is yours (it deploys the staging environment).

## 2. Re-add `PILOT_ALLOWED_EMAILS` as Sensitive (Production)

- **Reason:** it is stored as **Config** (OBSERVED 2026-10-25, `vercel env ls production`), but `DEPLOYMENT.md` requires it to be sensitive. `PILOT_ACCESS_MODE` is correctly absent.
- **Steps (your terminal; the value is typed at the prompt, never on the command line):**

  ```bash
  vercel env add PILOT_ALLOWED_EMAILS production --sensitive --force
  vercel env ls production | grep PILOT_    # expect: PILOT_ALLOWED_EMAILS  Hidden  Secret  Production
  vercel env ls preview | grep PILOT_       # expect: a Preview entry still exists (staging needs it)
  ```

  If `--force` removed the Preview entry, re-add it with `vercel env add PILOT_ALLOWED_EMAILS preview --sensitive`. Then redeploy staging, or staging denies every creator (fail-closed).
- **Risk:** a typo voids the whole list, so after the release every creator would be denied (fail-closed, recipients unaffected). This is recoverable with §2.4 of the runbook. It reaches only builds made after the change, so Production keeps today's value until the release build.
- **Expected evidence:** the two `grep` lines (names, type and scope only) in a PR #67 comment.
- **Separate authorization:** a Production env change. Your own action; no phrase needed beyond doing it.

## 3. Confirm the Production database identity (tighter wake-up check)

- **Reason:** the 2026-10-25 wake-up check is owner-reported, and it did not record whether `main` was idle beforehand. This check closes that caveat without revealing anything.
- **Steps:** runbook §4.1, "Tighter wake-up check":
  1. Wait until `main`, `backup-preprod-20261019` and `staging` all show Idle in Neon.
  2. Open `https://dibayar.vercel.app/i/dibayar-db-identity-check` in a private window.
  3. Reload Branches. Only `main` should wake.
- **Risk:** none (anonymous, read-only, one `SELECT`).
- **Expected evidence:** a PR #67 comment with the time, "all idle before: yes", "only `main` woke: yes".
- **Separate authorization:** no.

## 4. Fill in or accept the F2 manual-test gaps

- **Reason:** every F2 result for `4108523` is owner-reported with no SHA, device, browser, language or time. The deployment timeline narrows it:
  - the staging alias has served `4108523` since 2026-10-19 07:29 WIB (`dpl_HHDjeX…`), and since 08:50 WIB as `dpl_CxvG7f…`;
  - the pilot allow/deny result could only come from `4108523`, the only staging build with the gate.
- **Steps:** use the template in the readiness report, §F2. For each row, write what you remember, or "not recorded; I accept this gap". If you choose option 1(A), the rows must name the new head.
- **Risk:** the P0 rows (MAN-REL-01, MAN-AUTH-01, MAN-AUTH-02, MAN-DUE-01) block the release unless accepted.
- **Expected evidence:** rows added to `docs/testing/MANUAL-UAT.md` through a PR into `staging`, or the acceptance wording in a PR #67 comment.
- **Separate authorization:** no.

## 5. State product dispositions on the exact head

- **Reason:** #56 and #57 have no disposition stated for `4108523`. #66 is still OPEN although #68 patched it. #65 tracks `7aeaa7b`.
- **Steps:** post the wording in readiness report §C (moderated pilot only, communicated limitations). Then close #66 with a reference to #68, and to step 1 if you choose (A). Close #65 as superseded by this release review, or keep it open as the F2 tracker.
- **Expected evidence:** PR #67 comment; issue states.
- **Separate authorization:** no.

## 6. Build the staged secure recovery deployment (before the merge)

- **Reason:** after the release, Hobby's Instant Rollback can only go back to `dpl_GdBz1…`, which lets every Google account sign in. A staged build of `hotfix/secure-recovery-baseline-2026-10-25` gives an instant recovery target that keeps the allowlist.
- **Prerequisite:** step 2 is done, and step 1 is decided. With (A), Claude Code re-cuts the candidate with the same bump and gives you the new SHA.
- **Authorization phrase:** `I authorize a staged Production build (vercel deploy --prod --skip-domain) of hotfix/secure-recovery-baseline-2026-10-25 at <full SHA>. It runs prisma migrate deploy against Production (expected: no pending migrations) and must not take the production domain.`
- **Steps:** runbook §3.0, "Build it before the merge", then the 5 read-only checks. The most important checks:
  - `dibayar.vercel.app` still points at `dpl_GdBz1…`;
  - `autoAssignCustomDomains` is still `true`;
  - the build log shows `No pending migrations to apply` and no `Applying`.
- **Risk:** this is a Production build. The migration step is a no-op (12 vs 12) and was rehearsed locally; the domain must not move.
  - If the domain moves anyway, promote `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5` back. Same code plus the allowlist and patches, so this is low impact, but it is an incident to log.
  - If `--skip-domain` is unavailable on Hobby, do not continue. Accept the insecure Instant Rollback in writing instead (step 8).
- **Expected evidence:** the `dpl_…` ID, the output of the 5 checks, and the time, in a PR #67 comment.
- **Separate authorization:** yes (phrase above).

## 7. Take the pre-release backup, within about an hour before the merge

- **Reason:** `backup-preprod-20261019` is about 5 days old. It is also a child branch, which Neon does not document as a restore source. Free-plan point-in-time restore covers only 6 h.
- **Steps (runbook §5 item 8):**
  1. Neon → `neon-dijual` → Backup & restore → **Create snapshot** of `main`, named `prerelease-<YYYYMMDD-HHMM>`. CLI alternative: `neon snapshots create --branch main --name prerelease-<YYYYMMDD-HHMM>`.
  2. Branches → New branch → parent `main`, current point in time, data + schema, Expires = Never, named `backup-prerelease-<YYYYMMDD-HHMM>`.
  3. Read-only on the new branch and on `main`, aggregates only: `_prisma_migrations` 12/0/0 and the same invoice count.
  4. Count branches (must be ≤ 10).
  5. Keep `backup-preprod-20261019`.
- **Risk:** Free plan allows 1 manual snapshot. If one already exists, decide whether to replace it; do not delete anything else.
- **Expected evidence:** for both, the name, full ID, source, creation time with timezone and expiry; the aggregates; the branch count.
- **Separate authorization:** you are creating backups; no phrase, but record it.

## 8. Accept recovery time and data loss in writing

- **Reason:** no restore has ever run on this project, so downtime is UNKNOWN. Data loss equals the time since the step 7 snapshot.
- **Wording to post in PR #67:**

  > Recovery acceptance for PR #67 at `<SHA>`:
  > - Application recovery is the staged deployment `<dpl_id>` (or, if absent, I accept that Instant Rollback to `dpl_GdBz1…` opens sign-in to every Google account until a fix is deployed).
  > - Database restore source is snapshot `<name>` taken at `<time>`.
  > - I accept unknown restore downtime, and the loss of every write after that snapshot if I ever restore: sessions, new creators, deals, invoices, share links (recipients would get 404) and snapshots made since.
  > - I will not restore without the runbook §4.4 gates and a separate restore authorization.
- **Separate authorization:** this is the risk acceptance itself.

## 9. Same-day baseline and release authorization

- **Steps:**
  1. Runbook §3.3 steps 1–3 on current Production. The 2026-10-25 08:37Z baseline was PASS, but redo it on the day.
  2. Re-check that the head has not moved (`gh pr view 67`).
  3. Lift Draft.
  4. Give the release phrase from runbook §1.2 for the exact SHA.
  5. Merge with a merge commit; never "Delete branch".
- **Then:** runbook §6. A Claude Code session can run the read-only post-merge checks (§6.1, the anonymous parts of §3.3) if you ask.
- **Separate authorization:** yes (release phrase).
