# Dibayar — Production recovery runbook (release PR #67)

Prepared 2026-10-21 (WIB) by Claude Code for Chris; **revised 2026-10-25** (recovery hardening). **Runbook only: nothing in it has been executed against Production.** `docs/ops/` does not exist, so it sits beside the Neon preflight receipt.

Evidence labels: **OBSERVED** (seen directly, read-only), **OWNER-REPORTED** (Chris said so, not re-checked), **INFERRED** (reasoned from code/docs/vendor behaviour, not observed), **UNVERIFIED** (could not check), **TESTED-LOCAL** (rehearsed on the approved disposable local database with synthetic data; says nothing certain about Production), **VENDOR-DOC** (current Vercel/Neon documentation, read 2026-10-25, not exercised on this project). `BLOCKED_VERIFY_PROCEDURE` = the console steps were not observed, so no click-path is given as fact.

Companion receipts: `docs/receipts/DIBAYAR-PRODUCTION-RECOVERY-READINESS-2026-10-20.md` (original findings), `docs/receipts/DIBAYAR-RECOVERY-HARDENING-2026-10-25.md` (what changed on 2026-10-25 and the evidence), `docs/receipts/DIBAYAR-PR67-OWNER-ACTIONS.md` (what Chris still has to do).

### What changed on 2026-10-25 (read this first)

1. **The application recovery target is no longer the old Production deployment.** Vercel Hobby's Instant Rollback can only return to the *immediately previous* Production deployment (VENDOR-DOC). After the release, that is `dpl_GdBz1…` (`308a339`), which has **no pilot allowlist** and the pre-#68 `next`. The preferred application recovery is now a **staged secure recovery deployment** (§3.0): branch `hotfix/secure-recovery-baseline-2026-10-25` = `308a339` + PR #68 + PR #69 (+ a test-only clock fix). Chris builds it as a staged Production deployment *before* the merge, and an incident promotes it instantly, with no rebuild and no migration. TESTED-LOCAL against the 14-migration release schema: 103 E2E passed / 11 skipped by design / 0 failed, including pilot allow/deny, recipient link and PDF, and cross-owner denial.
2. **Restoring `main` from the child branch `backup-preprod-20261019` is not a documented Neon operation.** Neon's restore-from-another-branch requires a *root* source branch, and the backup was created as a child of `main` (VENDOR-DOC). The documented in-place restore that keeps the connection string is a **Neon snapshot** (Free plan: 1 manual snapshot). The pre-release backup is therefore now a snapshot of `main` **plus** a data+schema child branch (§4.3, §5 item 8).
3. **The Vercel Deployment Protection containment was checked against vendor docs.** "All Deployments" with Vercel Authentication is available on Hobby. It blocks *every* public visitor, including recipients' `/i/…` links and the Google OAuth callback for creators. It is a full outage switch, not a rollback (§2.1).

---

## 0. Fixed facts this runbook depends on

| Fact | Value | Label |
|---|---|---|
| Release PR | #67 `staging` → `main`, **Draft**, head `41085231cf386acb8e0309b83d61086b5a49ef92` | OBSERVED (`gh pr view 67`, 2026-10-20 22:40Z) |
| Production code | `main` = `308a339e7de817aa37378d263d51f25c78ea4f09` (PR #23 merge, 2026-10-03) | OBSERVED (`git fetch`) |
| Live Production deployment | `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5`, `https://dibayar-2c7u9sbjh-kenji-iwakura.vercel.app`, built from `main` @ `308a339`, created 2026-10-19 16:27:22 WIB, Ready, aliased to `dibayar.vercel.app` | OBSERVED (`vercel ls --prod`, `vercel inspect`, build log `Cloning … Commit: 308a339`) |
| Previous Production deployment | `dpl_54LBdY2Di8sgdjahifpAi5W27AuP`, `https://dibayar-ibjl0qdqi-kenji-iwakura.vercel.app`, also `308a339`, created 2026-10-03 07:27 WIB, Ready | OBSERVED |
| Build runs migrations | `vercel.json` → `scripts/vercel-build.sh` → `npx prisma migrate deploy` when `DATABASE_URL` is set, then `next build` | OBSERVED (`origin/staging`) |
| Production DB variable | runtime and build both use `DATABASE_URL` (static **Secret**, Production scope, created ~64 days ago); the Neon-integration `DATABASE_URL_*` Config vars are **not** what Production reads | OBSERVED (`vercel env ls production`, `src/lib/prisma.ts`, `scripts/vercel-build.sh`) |
| Which Neon branch that secret points at | `main` (`br-still-darkness-aobvo77q`), endpoint `ep-nameless-salad-aoa0saz5`. Chris reported this endpoint on 2026-10-25; the repository records it as `main`'s endpoint | **CLEARED 2026-10-25** (OWNER-REPORTED, corroborated): the host check via `vercel env pull` was not completed; the §4.1 compute wake-up check showed `main` Active and `backup-preprod-20261019` and `staging` Suspended after a Production sign-in |
| Pending migrations | `20261016000000_create_idempotency_keys`, `20261018000000_invoice_document_snapshot` (additive; snapshot backfill; UPDATE-rejecting trigger) | OBSERVED (`git diff origin/main origin/staging`) |
| Neon recovery branch | `backup-preprod-20261019`, parent `main`, data + schema, Expires Never, created 2026-10-20 11:06:27 (console time) | OWNER-REPORTED (preflight receipt); not re-observed |
| Neon plan | Free; history retention 6 h | OWNER-REPORTED (preflight receipt) |
| Re-check 2026-10-25 08:30Z | no drift: `main` `308a339`, `staging` `4108523`, PR #67 Draft/CLEAN, live Production `dpl_GdBz1…`, no rollback in progress | OBSERVED (`git fetch`, `gh pr view 67`, `vercel ls --prod`, `vercel inspect`, `vercel rollback status`) |
| Vercel rollback on Hobby | Instant Rollback reaches only the immediately previous Production deployment; after a rollback, auto-assignment of production domains is turned off until a deployment is promoted | VENDOR-DOC (`vercel.com/docs/instant-rollback`) |
| Staged production deployment | `vercel deploy --prod --skip-domain` builds a Production deployment without assigning the domain; `vercel promote <id>` later makes it current **without a rebuild**; a deployment that was promoted once cannot be promoted again | VENDOR-DOC (`docs/cli/deploying-from-cli`, `docs/deployments/promoting-a-deployment`). Not exercised on this project |
| Project protection and domain assignment | `ssoProtection.deploymentType = prod_deployment_urls_and_all_previews` (Standard Protection: generated deployment URLs need a Vercel login, `dibayar.vercel.app` is public); `autoAssignCustomDomains = true` | OBSERVED (Vercel project API, read-only, 2026-10-25) |
| Secure recovery candidate | `hotfix/secure-recovery-baseline-2026-10-25` @ `59388146acc8935c898bdd3de5cfb69562ada6d7` (12 migrations, `prisma/` identical to `main`) | OBSERVED (pushed 2026-10-25; no Vercel deployment created, because `vercel.json` disables Git deployments for `hotfix/*`) |
| Neon restore rules | restore from another branch needs a **root** source branch; a snapshot one-step restore keeps branch name and connection string (branch ID changes; the old branch is kept as `<name> (old)`); restores briefly interrupt connections; Free plan: 6 h history, 1 manual snapshot, 10 branches | VENDOR-DOC (`neon.com/docs/introduction/branch-restore`, `/docs/guides/backup-restore`, `/docs/introduction/plans`) |

---

## 1. Roles, authority, escalation

### 1.1 Roles

- **Chris: accountable release and rollback operator.** Only Chris decides go/no-go and performs (or explicitly authorizes) a Production merge, an application rollback, a database restore or cutover, and any Production env-var or secret change.
- **Claude Code: preparer and assistant, not an emergency operator.** It may read, observe, run local non-destructive checks, draft commands and checklists, and check results afterwards. Its permission layer has denied `gh pr merge` and Neon shared-resource actions before (2026-10-03/11/18/20). Plan on the assumption that **Chris performs every Production action by hand.**
- **ChatGPT: independent reviewer** of evidence and go/no-go. Not on call and not an operator.

### 1.2 Authorization phrases (separate, per action, never blanket)

Chris gives each one in chat or in a PR #67 comment, filling in the brackets. Approving one does not approve any other.

| Action | Exact phrase |
|---|---|
| Release | `I authorize merging PR #67 at head <full SHA> into main, which deploys Production and applies migrations 20261016000000 and 20261018000000.` |
| Build the staged secure recovery deployment (before the merge) | `I authorize a staged Production build (vercel deploy --prod --skip-domain) of hotfix/secure-recovery-baseline-2026-10-25 at <full SHA>. It runs prisma migrate deploy against Production (expected: no pending migrations) and must not take the production domain.` |
| Promote the secure recovery deployment (incident) | `I authorize promoting staged deployment <dpl_id> (commit <sha>) to Production. No database change.` |
| App rollback (Vercel Instant Rollback, insecure fallback) | `I authorize an application rollback of Production to deployment <dpl_id> (commit <sha>), accepting that while it serves, any Google account can sign in and the #66 advisories are back. No database change.` |
| App revert (Git) | `I authorize a hotfix/revert PR into main reverting <merge sha>. Its build will run prisma migrate deploy.` |
| Forward data repair | `I authorize the forward data repair <script/receipt path> on Production Neon main, scope: <tables/rows>.` |
| Database restore / cutover | `I authorize restoring Production database <branch> from <source>, accepting the loss of writes after <timestamp>.` |

A database restore always needs its own phrase, even after an app-rollback approval.

### 1.3 What counts as a confirmed problem

Confirmed means it is reproduced by Chris or shown by direct evidence: a Vercel deployment state, a build-log line, a smoke-check FAIL, an HTTP status, or a read-only aggregate query. A single user's report is a lead and has to be reproduced first. Anything else is "suspected". Suspected problems get observation, not rollback.

### 1.4 Stop and escalate (do not improvise)

Stop and escalate if:

- a step would need an action not written here;
- a console screen does not match this runbook;
- a permission prompt blocks a step;
- a value would have to be revealed to continue;
- anyone proposes `prisma migrate reset`, `prisma db push`, hand-editing `_prisma_migrations`, dropping `InvoiceSnapshot`, or running reverse migration SQL.

### 1.5 Evidence trail and communication

- Open an incident note: `docs/receipts/DIBAYAR-PRODUCTION-INCIDENT-<YYYY-MM-DD>.md`, a PR #67 comment, or a new issue.
- Record in WIB and UTC: detection time, symptoms, the deployment ID and SHA that were live, every decision with its authorization phrase, every action, and every verification.
- Add the `DEPLOYMENT.md` Deployment Verification Record for each environment you touch.
- Pilot creators: Chris tells them directly (WhatsApp or email, outside the app) when an incident affects them, and again on resolution. If invoice links or data may be lost, name the window.
- Never include email addresses, tokens, connection strings or customer rows in any of these records. The repository is public.

---

## 2. Emergency assessment and decision tree

### 2.1 Stabilize first (no destructive action)

1. Note the time and the live deployment: `vercel ls dibayar --prod` (first row) and `vercel inspect https://dibayar.vercel.app`, which shows the `id` and the aliases.
2. Make sure nothing else is changing:
   - `vercel rollback status dibayar` and `vercel promote status dibayar`;
   - `gh run list --branch main --limit 5`;
   - no second merge in flight.
3. Limit risky activity with capabilities that really exist:
   - Ask the pilot creators to stop issuing or sharing invoices until told otherwise (out-of-band message).
   - **Last resort, Chris only:** remove one person from `PILOT_ALLOWED_EMAILS` and redeploy, or empty it, which denies every creator because the list fails closed. This is an env change plus a new build, and the new build reruns `migrate deploy`. Recipient `/i/[token]` links are unaffected.
   - There is **no** maintenance mode or read-only switch in the app. Do not invent one mid-incident.
   - **Full-outage containment, Chris only, for active data exposure:** Vercel → `dibayar` → Settings → Deployment Protection → Vercel Authentication → **All Deployments** (VENDOR-DOC: available on all plans; API equivalent `ssoProtection.deploymentType = "all"`). Effect: every URL, including `dibayar.vercel.app`, then admits only logged-in Vercel users with access to the project. Pilot creators, the Google OAuth callback, and brands opening `/i/…` links and PDFs are **all** blocked; Hobby allows one external Vercel user. It changes no code and no data and needs no redeploy (INFERRED from the docs; not exercised here). Revert by selecting Standard Protection again (the current setting, OBSERVED). Use it only to stop a confirmed leak while a fix is prepared; it is not a recovery.
4. Triage with the probes below (read-only).

| Probe | How | Healthy |
|---|---|---|
| Reachable | `node scripts/smoke-deployment.mjs --env production --url https://dibayar.vercel.app` | all PASS |
| Build and migrations | `vercel inspect <deployment url> --logs \| grep -E "migrations found\|Applying migration\|No pending\|Error\|Build Completed"` | `14 migrations found`, both new migrations applied or `No pending`, `Build Completed` |
| Auth | Chris signs in with an allowlisted account and a denied account (MAN-AUTH-10 pattern) | allowed one gets in; denied one stays out |
| Deals and invoices | Chris, own pilot account: open Beranda, a deal, an invoice; create a test deal only with synthetic data | pages render, no 500 |
| Recipient link and PDF | open one known active `/i/<token>` link and its PDF in a private window | 200, correct document |
| DB integrity (Chris, Neon SQL Editor, read-only) | §6.2 queries, aggregates only | 14 finished / 0 unfinished; snapshot counts plausible |

### 2.2 Decision tree

```text
Is the problem confirmed (1.3)?
 ├─ no  → observe; re-probe; no rollback.
 └─ yes → did the Production build for the merge commit fail?
      ├─ yes → Vercel keeps serving the previous deployment (308a339).
      │        Read the log: did any migration apply?
      │        ├─ none applied, or the whole migration rolled back → app is unchanged; fix forward on staging. No rollback needed.
      │        └─ partial / unfinished row in _prisma_migrations → MIGRATION FAILURE (2.5).
      └─ no (new deployment is live) → is data wrong or lost?
           ├─ no  → APP-ONLY FAILURE (2.3)
           └─ yes → DATA CORRUPTION (2.6)
```

### 2.3 App-only failure (schema and data healthy)

Prefer, in this order:

1. **Forward hotfix** (`hotfix/*` → `main`), if the fix is small and fast. This keeps everything. Time: CI (~20 min for `e2e-critical` on the release head, OBSERVED run 39181004556) plus a ~1 min Vercel build plus Chris's merge.
2. **Promote the staged secure recovery deployment** (§3.0), if users are being harmed now. Instant, no rebuild, no migration; keeps the pilot allowlist and the #68 dependency patches. Prerequisite: Chris built it before the merge (§5 item 9). Consequences: the Decision A and idempotency bullets below apply; the pilot-allowlist and `next` bullets do not.
3. **Vercel Instant Rollback** to `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5` (§3.2): **insecure fallback** only if (2) does not exist or fails, and only with the explicit acceptance in the phrase (§1.2).

Accept these consequences of (3) explicitly before choosing it:

- **Schema compatibility: OK.**
  - INFERRED from the migration SQL: additive only.
  - Also rehearsed locally this session on the disposable test DB: `main`'s Prisma 7.9.1 client did create/update/read/delete against the 14-migration schema without error.
  - Instant rollback does not rebuild, so it runs no migrations.
- **Security regression: the pilot allowlist disappears.**
  - `308a339` predates PR #69, so **every Google account can sign in and create a creator account** while rolled back.
  - It also brings back `next` 16.3.3 (the #66 advisories that #68 patched).
  - Chris must accept this. Otherwise, contain exposure first, which is a Chris-only Vercel settings change (for example Deployment Protection on Production).
- **Decision A not enforced while rolled back.**
  - Invoice documents render live deal and Settings values again.
  - Existing `InvoiceSnapshot` rows stay in place untouched.
  - Invoices issued or shared during the rollback get no snapshot; after rolling forward they freeze as `RECONSTRUCTED_LATE` on first read. TESTED-LOCAL 2026-10-25 (`scripts/recovery-compat-probe.ts`, 9/9): late capture happens once, a Draft never exposed stays live, the database trigger rejects any UPDATE of a snapshot, and a deal edit after the freeze does not reach the document. **Gap while rolled back:** a deal or Settings edit made *during* the recovery window, before the invoice's first read after rolling forward, is what that late snapshot captures. That window is the Decision A exposure, and it applies to (2) as well as (3).
- **Idempotency keys are not sent** by the old client. The columns stay NULL, which is harmless.
- **Never** drop `InvoiceSnapshot`, its trigger, or the `idempotencyKey` columns to "match" the old code.

### 2.4 Allowlist configuration failure (sign-in denied for everyone after release)

This is likely a value or scope problem with `PILOT_ALLOWED_EMAILS`. The gate fails closed when the list is unset, empty or malformed, and one bad entry voids the whole list. It is **not** a reason to roll back (rolling back opens sign-in to everyone).

Chris fixes the value in Vercel (Production scope, mark it Sensitive). The fix only reaches a new build, so Chris then redeploys `main`. That rebuild runs `migrate deploy`, which is a no-op once the 14 migrations are applied.

### 2.5 Migration or schema failure

- Do not redeploy repeatedly. Do not run `migrate reset`, `db push` or `migrate resolve`, and do not edit `_prisma_migrations`.
- Each migration file runs as one transaction (INFERRED, Prisma/PostgreSQL), so a failure normally leaves nothing half-applied. The failure is recorded as an unfinished row, and later `migrate deploy` runs refuse to continue (P3009).
- The previous deployment keeps serving. It is compatible with the 12-migration schema and with any finished additive subset.
- Escalate to Chris with the build log excerpt (no secrets) and the read-only `_prisma_migrations` aggregate.
- The fix is forward-only:
  - a corrective migration through `staging`;
  - only after diagnosis, and with Chris's explicit scope, `prisma migrate resolve --rolled-back <name>` to clear a failed row that verifiably applied nothing.
- A database restore is only for data damage, never to fix a migration record.

### 2.6 Data corruption

A restore from backup is a **separate, high-risk decision** (§4). Before proposing one:

1. Measure the damage with read-only aggregates: which tables, how many rows, since when.
2. Measure what a restore would lose: every write to `main` after the backup time (§4.3). That includes new users, sessions, deals, invoices, numbering sequences, share links (recipients get 404) and stage history.
3. Compare the two routes:
   - **(a) Forward repair:** a targeted script, rehearsed on a non-Production copy with synthetic data, then reviewed.
   - **(b) Restore:** §4.
   Prefer (a) whenever the damage is bounded and known.
4. Chris approves using the restore phrase in §1.2.

---

## 3. Application rollback path (runbook only, not executed)

### 3.0 Secure recovery deployment (preferred; prepared before the merge)

**What it is.** Branch `hotfix/secure-recovery-baseline-2026-10-25` @ `59388146acc8935c898bdd3de5cfb69562ada6d7`:

- `308a339`, the code Production runs today;
- \+ PR #68: `next` 16.3.8, `sharp` 0.35.5, `fast-uri` 3.1.8 and `source-map-js`;
- \+ PR #69: the pilot allowlist, unchanged;
- \+ `4209e83`: a test-only clock fix.

It ships `main`'s 12 migrations, so it runs on both the 12-migration (pre-release or restored) schema and the 14-migration release schema.

**Evidence (TESTED-LOCAL, 2026-10-25, synthetic data, approved disposable DB `127.0.0.1:55432/dibayar_test`):**

| Step | Result |
|---|---|
| empty DB → `main`'s 12 migrations → synthetic seed (2 non-Draft invoices, 2 shares) | applied in 1.9 s |
| release `migrate deploy` (`staging` tree) | 2 migrations applied in 1.5 s; backfill 2 × `RECONSTRUCTED_ON_MIGRATION` |
| recovery tree `migrate status` / `migrate deploy` on the 14-migration DB (what its Vercel build runs) | "Database schema is up to date!" / `No pending migrations to apply.`, both exit 0 |
| recovery app full non-visual E2E (`npm run test:e2e`, chromium + chromium-mobile 390 px) on the 14-migration DB | **103 passed, 11 skipped (viewport-scoped by design), 0 failed**. Includes `e2e/security/pilot-access.spec.ts` (uninvited existing session → invite-only page, owner APIs refuse it, invited owner works, recipients keep link + PDF), `e2e/security/ownership-denial.spec.ts`, `e2e/public/invoice.spec.ts` (link, PDF, expired, revoked, invalid) |
| release code reads what the recovery app wrote (`scripts/recovery-compat-probe.ts`) | 9/9 PASS |
| logical restore stand-in (not Neon): back to 12 migrations in 2.0 s; release client then fails (`idempotencyKey` missing); recovery app `e2e:critical` 91 passed / 0 failed; release migrations re-applied in 1.5 s, probe 9/9 | hardening receipt §5.4 |
| release app `npm run test:e2e:critical` on the same DB afterwards (roll-forward) | **334 passed, 28 skipped, 0 failed**, matching CI on `4108523` |
| recovery branch unit tests, lint, typecheck | 825/825; lint 0 errors (1 pre-existing warning from #69's test file); typecheck clean |
| CI on the exact recovery SHA | dispatched run 40177453189: **all five jobs success** (lint-typecheck-test 825/825, e2e-critical 91 passed / 11 skipped, e2e-a11y, ux-audit, e2e-cross-browser 209 / 19 skipped) |

**What it covers:** an application defect in the release code that does not damage data; pilot creators keep access, uninvited accounts stay out, and recipient links and PDFs keep working.

**What it does not cover:**

- **Data damage.** Go to §2.6 and §4.
- **A defect that also exists in the old code.** The recovery app runs the same code as Production today, apart from the gate and the dependency updates.
- **Decision A enforcement.** The recovery app renders invoices from live deal and Settings values, as Production does today. Snapshots made before the window are never touched (the database rejects UPDATE); invoices exposed during the window freeze late after rolling forward.
- **#56 and #57**, which are unchanged.
- **The 2026-10-22 `next` advisories (GHSA-2464, GHSA-673q, GHSA-p3m5).** They affect `next` 16.3.8 in both the release and the recovery candidate. Preconditions are not met in this code, so neither is INFERRED exploitable, but re-cut the candidate if the dependency patch lands (hardening receipt §3.4).

**Build it before the merge (Chris; needs the "Build the staged secure recovery deployment" phrase, §1.2).**

The build runs `scripts/vercel-build.sh` with Production variables, so it runs `prisma migrate deploy` against Production:

- before the release this is 12 vs 12 migrations, `No pending migrations`;
- after it, 12 vs 14, also a no-op (TESTED-LOCAL).

It captures the environment values as they are at build time. Build it **after** `PILOT_ALLOWED_EMAILS` has its final value (§5 item 6), and rebuild it if the list changes.

```bash
# In a throwaway directory, from a clean clone, so no local .env file or
# untracked file is uploaded. Detached HEAD is deliberate: with no branch
# name, scripts/vercel-ignore-build.sh builds (fail open) instead of skipping
# the hotfix/* ref (INFERRED; check the build log line in step 4).
git clone --no-tags https://github.com/crh/dibayar.git dibayar-recovery-build
cd dibayar-recovery-build
git checkout --detach 59388146acc8935c898bdd3de5cfb69562ada6d7
vercel link --yes --project dibayar --scope kenji-iwakura
vercel deploy --prod --skip-domain --scope kenji-iwakura   # prints the deployment URL
```

**Then check, read-only. Every item must hold; otherwise stop.**

1. `vercel inspect <printed url>`: `target production`, Ready, and **no** `dibayar.vercel.app` alias.
2. `vercel inspect https://dibayar.vercel.app`: still the current Production deployment (unchanged).
3. `vercel api /v9/projects/dibayar | grep -o '"autoAssignCustomDomains":[a-z]*'` → `true`. If it is `false`, the release merge would not go live on its own. Stop and ask.
4. `vercel inspect <printed url> --logs | grep -E "vercel-ignore-build|migrations found|No pending|Applying|Build Completed"`:
   - the ignore line is absent or says "building";
   - `12 migrations found`;
   - `No pending migrations to apply`;
   - **no** `Applying`.
5. Record the `dpl_…` ID in PR #67. Its generated URL is behind Standard Protection, so it stays private until promoted.

**During an incident (Chris; "Promote the secure recovery deployment" phrase):**

1. `vercel promote <dpl_id> --scope kenji-iwakura` (VENDOR-DOC: no rebuild).
2. Run §3.3.
3. `vercel promote status dibayar`.

After a promote, auto-assignment stays on (VENDOR-DOC: promote restores it). The next merge to `main` therefore goes live by itself: that is the roll-forward path.

Hobby plan specifics for `--skip-domain` and `promote` are not documented separately: UNVERIFIED until step 1 of the check above succeeds.

A staged deployment can be promoted only once. After use, build a new one.

### 3.1 Target (Instant Rollback, insecure fallback)

| | Value | Label |
|---|---|---|
| Known-good target after release | `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5` (`dibayar-2c7u9sbjh-kenji-iwakura.vercel.app`, `308a339`) | OBSERVED; it is the current live Production deployment |
| Fallback target | `dpl_54LBdY2Di8sgdjahifpAi5W27AuP` (`dibayar-ibjl0qdqi…`, `308a339`) | OBSERVED, Ready |
| "Known good" basis | serving Production since 2026-10-19; anonymous smoke 4/4 PASS and DB-reaching `404` probe on 2026-10-25 08:37Z | OBSERVED (anonymous checks only; no signed-in check recorded) |
| Rollback actually exercised on this project | never | OBSERVED (`DEPLOYMENT.md` §Rollback "not yet verified"). A deployment that exists is not a proven rollback |
| Expected downtime | UNKNOWN. Vercel re-points the alias without a rebuild, typically seconds (INFERRED from vendor behaviour, not measured here) | INFERRED |

### 3.2 Steps (Chris)

**Pre-checks:**

1. Confirm the incident is confirmed (§1.3) and that §2.3's consequences are accepted.
2. Record the current live `dpl_…` (it will be the PR #67 build).
3. Confirm no rollback or promote is pending: `vercel rollback status dibayar`.

**Option A, dashboard** (`BLOCKED_VERIFY_PROCEDURE`: the Vercel UI was not observable this session because the browser was not signed in):

1. Open Vercel → `dibayar` → Deployments, filter Production.
2. Find the row `dibayar-2c7u9sbjh` / commit `308a339`.
3. Open its "⋯" menu and choose the action Vercel labels **Instant Rollback** (or **Promote**).
4. The confirmation dialog is the **irreversible boundary**. Check the deployment ID and commit in the dialog before you confirm.
5. VENDOR-DOC (2026-10-25, not observed): on the Hobby plan Instant Rollback offers only the immediately previous Production deployment. After the release that is exactly `dpl_GdBz1…`, the insecure one. If the UI offers something else, stop.

**Option B, CLI** (same effect; Chris's terminal): `vercel rollback dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5 --scope kenji-iwakura`, then `vercel rollback status dibayar`.

**After a rollback** (INFERRED vendor behaviour, verify in UI): Vercel stops auto-assigning the Production domain to new `main` deployments until the rollback is undone or a deployment is promoted. Any later hotfix merge therefore builds but does **not** go live on its own. Plan the roll-forward as an explicit promote, which needs its own authorization.

**Post-checks:** §3.3.

### 3.3 Before and after checks

Run each before the release (on `dpl_GdBz1…`, to establish the baseline) and after any rollback:

1. `node scripts/smoke-deployment.mjs --env production --url https://dibayar.vercel.app` → all PASS. Record a Deployment Verification Record.
   - **Baseline taken 2026-10-25 08:37:55Z on `dpl_GdBz1…` (OBSERVED):** 4/4 PASS. HSTS, CSP and `X-Frame-Options: DENY` were present.
2. Database reachable, anonymous and read-only. The script does not check this.
   - Run `T=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))'); curl -s -o /dev/null -w '%{http_code}\n' "https://dibayar.vercel.app/i/$T"` → `404`.
   - Repeat with `/api/public/invoices/$T/pdf` → `404`.
   - Every token, valid or not, is hashed and looked up with one `SELECT` (`getPublicInvoiceDocumentByToken`). A `500` therefore means the database or the schema failed.
   - Caveat: a request refused by the in-memory rate limiter also gets `404` without touching the database. Run it once, not in a loop.
   - Baseline 2026-10-25: both `404` (OBSERVED).
3. `vercel inspect https://dibayar.vercel.app` → `id` equals the intended `dpl_…`.
4. Google sign-in:
   - On the release build **and on the secure recovery deployment (§3.0)**: allowed gets in, denied stays out.
   - On `308a339` (`dpl_GdBz1…`, insecure fallback): allowlisted **and** non-listed accounts both get in. This is the expected regression; record it.
5. Owner pages: Beranda, deal detail and invoice detail render for Chris's account.
6. Owner APIs: no 5xx in Vercel runtime logs for `/api/*` during the check (status codes only).
7. Invoice render and PDF: owner PDF downloads; one recipient `/i/<token>` and its PDF return 200; a revoked token returns the same 404 as an unknown one.
8. Migrations: read-only `_prisma_migrations` aggregate is unchanged by the rollback (still 14 finished / 0 unfinished).

### 3.4 Git revert / hotfix alternative

`main` history is merge-only, with force-push and deletion blocked: ruleset 24837655 (OBSERVED: `deletion`, `non_fast_forward`, PR required, 4 required checks) plus the local pre-push guard. Production auto-deploys from `main` (`git.deploymentEnabled.main: true`, OBSERVED in `vercel.json`).

1. Branch `hotfix/revert-pr67-<date>` from `main`, then `git revert -m 1 <PR #67 merge sha>`. Open a PR into `main` and wait for CI green. Chris authorizes it with the App revert phrase in §1.2.
2. **The revert build reruns `prisma migrate deploy`.** Rehearsed locally this session, with the same Prisma 7.9.1 on the disposable test DB in an isolated schema that was then dropped:
   - `main`'s 12-migration tree against a database holding all 14 migrations gives `No pending migrations to apply`, exit 0, nothing changed;
   - `migrate status` reported "Database schema is up to date!".
   So the revert build is schema-safe (OBSERVED locally; INFERRED for Production). It produces the same app state as §3.2, including the allowlist regression.
3. Reverting a merge has a trap. After syncing `main` → `staging`, `staging` also loses the reverted changes, and merging the original branch again later will **not** bring them back. Re-releasing needs a "revert of the revert". Because of this, prefer §3.2 plus a forward fix over a Git revert.

---

## 4. Neon database recovery path (runbook only, not executed)

### 4.1 Verified state, and what is not verified

| Item | State | Label |
|---|---|---|
| Project `neon-dijual` / `wispy-king-47867708`, Free plan, Singapore | as reported | OWNER-REPORTED (2026-10-20 receipt). Not re-observed: the Neon console was not reachable signed-in this session |
| Production branch `main` / `br-still-darkness-aobvo77q`, Default, Expires Never | as reported | OWNER-REPORTED |
| Backup `backup-preprod-20261019`, parent `main`, data + schema, Expires Never, ID `br-mute-glade-aou2i…` (truncated) | as reported | OWNER-REPORTED. Full ID UNVERIFIED |
| Integration maps Vercel Production → Neon `main` | as reported | OWNER-REPORTED. It governs the `DATABASE_URL_*` Config vars, **not** the static `DATABASE_URL` Secret that Production actually uses (OBSERVED) |
| Static Production `DATABASE_URL` → Neon `main` endpoint | `ep-nameless-salad-aoa0saz5` | **OWNER-REPORTED + corroborated (2026-10-25), not directly observed.** Chris's compute wake-up check: `main` Active, `backup-preprod-20261019` and `staging` Suspended after a Production sign-in. Open caveats: whether `main` was idle before the load, and which side the reported endpoint ID was read from. The host comparison was not completed. Claude Code cannot close this without seeing the secret (not done) or a signed-in Neon session (the `neon` CLI is installed but unauthenticated, 2026-10-25) |
| Indirect evidence for that mapping | Production build 2026-10-19 09:27Z: `12 migrations found … No pending migrations to apply`; the 2026-10-20 SQL on `main` showed 12/12 finished. Consistent with `main`, and rules out `staging` (14). Does not rule out another 12-migration branch such as `backup-preprod-20261019` (also 12) | INFERRED |
| Free-plan history retention 6 h, so PITR to before the backup is impossible after ~6 h | as reported | OWNER-REPORTED |
| Branch limit | 10 on `free_v3` (2026-09-26 API read in `DEPLOYMENT.md`); 3 in use on 2026-10-20 | Recorded / OWNER-REPORTED |

**Safe operator check of the DB mapping (Chris only; nothing is revealed to Claude, nothing is pasted anywhere):**

1. In Neon → `neon-dijual` → Branches → `main` → Computes, note the endpoint ID (`ep-…`).
2. In his own terminal, print only the host part of the Production secret:
   `vercel env pull --environment=production .vercel/.env.prod.tmp && grep '^DATABASE_URL=' .vercel/.env.prod.tmp | sed -E 's#^[^@]*@([^/:?]+).*#\1#'; rm -f .vercel/.env.prod.tmp`
   - The printed host should start with that `ep-…` (with `-pooler` if it is the pooled URL).
   - If `pull` returns an empty value for this legacy Secret type, mark it UNVERIFIED and use the wake-up check below.
   - Never paste the URL or file contents into chat.

**Tighter wake-up check (2026-10-25; anonymous, read-only; closes the "was `main` idle before?" caveat):**

1. Neon → `neon-dijual` → Branches. Wait until `main`, `backup-preprod-20261019` and `staging` **all** show their compute as Idle/Suspended. Free-plan computes suspend after 5 min without traffic (VENDOR-DOC). Pick a quiet time; a pilot creator's request also wakes `main`.
2. Note the time. In a private window open `https://dibayar.vercel.app/i/dibayar-db-identity-check`. Expected: the "not found" page.
   - That URL runs exactly one `SELECT` on `InvoiceShare` (`getPublicInvoiceDocumentByToken` hashes any token and looks it up; OBSERVED in `308a339`).
   - It writes nothing, needs no sign-in, and shows no data.
3. Reload the Branches page. Expected: **only** `main` became Active; the other two stay Idle.
4. Record in PR #67: the time; "all idle before: yes"; "only `main` woke: yes". No IDs or URLs are needed beyond branch names.

If another branch wakes as well, or `main` does not wake, the mapping is **not** confirmed. Stop the release.

### 4.2 Never restore Production just to test

A rehearsal, if Chris wants one later:

- uses a **separate** non-Production Neon branch seeded with synthetic data only (for example a schema-only branch of `staging`, plus `npm run m4:demo-data`);
- never uses a copy of Production;
- is never attached to a Vercel Preview;
- needs its own explicit approval;
- has its timings recorded as the RTO measurement.

### 4.3 Recovery options (procedures `BLOCKED_VERIFY_PROCEDURE`)

| Option | What it does | Changes the Production branch/connection? | Loses | Notes |
|---|---|---|---|---|
| R0 Forward repair | targeted, rehearsed SQL/script | no | nothing beyond the bug's own effect | preferred for bounded damage (§2.6) |
| R1 Point-in-time restore of `main` | rewinds `main` to a timestamp within the 6 h history window | yes (data in place; connection details unchanged, VENDOR-DOC); Neon keeps the pre-restore state as `main_old_<timestamp>`, which counts against the 10-branch limit | writes after that timestamp | supported: `main` is a root branch (VENDOR-DOC). Only useful if the damage is caught within ~6 h of the bad write |
| R2a Restore `main` from the pre-release **snapshot** (one-step restore) | replaces `main` with the snapshot's state | yes (branch name and connection string unchanged; **branch ID changes**; old branch kept as `main (old)`, VENDOR-DOC) | every write after the snapshot, including the release migrations | **preferred restore source.** Requires the snapshot from §5 item 8. Free plan: 1 manual snapshot, so delete nothing to make room without Chris. Instant PITR is not available on the restored branch until the snapshot restore finishes (VENDOR-DOC) |
| R2b Restore `main` from the child branch `backup-preprod-20261019` (or a later backup *branch*) | — | — | — | **Not a documented operation.** Restore-from-another-branch requires a root source branch, and these backups are children of `main` (VENDOR-DOC). `BLOCKED_VERIFY_PROCEDURE`; do not plan on it. A child backup branch is still useful for read-only comparison and as the R3 target |
| R3 Cutover: point Production `DATABASE_URL` at the backup branch's endpoint | Production reads the backup branch | **yes: Production secret change + redeploy** | same as R2a | the redeploy runs `migrate deploy` against the backup: with release code it **re-applies both migrations and the backfill there**; with `308a339` or the secure recovery candidate (§3.0) it is a no-op (TESTED-LOCAL). The backup then stops being a pristine copy, so branch it first. Highest-risk path |

**Restore loss window:**

- With only `backup-preprod-20261019`: all Production writes after 2026-10-20 ~04:06Z. As of 2026-10-25 that window is about 5 days, and R2b is not a documented operation anyway.
- With the pre-release snapshot from §5 item 8: the time between that snapshot and the incident.

**Downtime: UNKNOWN until measured.** The local logical rehearsal (hardening receipt §5.4) measured database steps in seconds: apply 12 migrations ~1.9 s, apply the 2 release migrations ~1.5 s. It cannot measure a Neon restore. Neon says restores "typically take a few seconds" and interrupt existing connections (VENDOR-DOC). Vercel functions reconnect on the next request; existing pooled connections error once (INFERRED).

**After R1/R2a rewinds `main` to a 12-migration state while the release build is live:** the release code reads tables and columns that no longer exist, so snapshot reads fail closed (`InvoiceSnapshotMissingError` or a relation error). Two ways out:

- Promote the secure recovery deployment (§3.0) first. It runs on 12 migrations without any migration (TESTED-LOCAL: its E2E was green on the 14-migration DB; its tree is `main`'s, which has served the 12-migration DB in Production since 2026-10-03).
- Or redeploy the release, which re-applies both migrations and the backfill.

### 4.4 Decision gates before any reset, restore, cutover or URL change

Every gate must be answered in the incident note. Any "unknown" requires Chris's written risk acceptance.

1. Is the damage confirmed and scoped (tables, rows, start time)? Has R0 been considered and rejected, with the reason recorded?
2. **Keep the damaged state:** both R1 and R2a preserve the pre-restore `main` automatically (`main_old_<timestamp>` or `main (old)`, VENDOR-DOC); confirm the restore dialog says so. For R3, create a data + schema branch of the damaged `main` (Expires Never) first. Each of these counts against the 10-branch limit: count branches before starting. Do not delete old backups to make room without Chris's approval.
3. Backup integrity: the pre-release snapshot (R2a) or backup branch exists, and its source (`main`) and creation time match the release record. For a branch, read-only aggregates on it are plausible (`_prisma_migrations` 12, invoice count), without opening customer rows.
4. Post-backup write window: count rows created after the backup time on `main`, aggregates only, per table (`User`, `Session`, `Deal`, `Invoice`, `InvoiceShare`, `InvoiceSnapshot`, `DealStageTransition`, `InvoiceSequence`). These are what will be lost.
5. Downtime estimate, or `UNKNOWN`.
6. Permissions: Chris is signed in to Neon and Vercel with the rights to restore and, for R3, to edit Production env; nobody else is mid-change.
7. Secrets: R1 and R2 need no secret change (INFERRED). R3 needs a new Production `DATABASE_URL`, which Chris sets directly in Vercel and never pastes anywhere.
8. Auth impact:
   - `Session` rows created after the backup disappear, so those users must sign in again.
   - Creator accounts created after the backup disappear. Their next sign-in creates a new user if they are allowlisted.
9. Pool and connection impact: expect brief errors; run the smoke check right after.
10. Schema/app match after restore. R2 rewinds to 12 migrations while the release app (14) may still be live:
    - either roll the app back first (§3), or plan the redeploy that re-applies both migrations;
    - **never** leave the release build serving a 12-migration database, because snapshot reads would fail closed (`InvoiceSnapshotMissingError`).
11. Notification: tell pilot creators which window was lost; brands' links created in that window will 404.
12. Post-recovery reconciliation: from the branch in gate 2, list (aggregates first, then per-owner only as needed) the records lost, and agree with each affected creator how to re-enter them.

Then Chris gives the restore phrase (§1.2) and performs the console action. The Neon console's confirm button is the irreversible boundary.

---

## 5. Pre-merge release checklist (all Chris unless noted; none done here)

Each item names its gate in `docs/receipts/DIBAYAR-PR67-RELEASE-READINESS-2026-10-25.md`; Chris's steps, in order, are in `docs/receipts/DIBAYAR-PR67-OWNER-ACTIONS.md`.

1. **Head and drift.** `git fetch` and `gh pr view 67`: head = `staging` = `41085231…`, `main` = `308a339…` (unchanged as of 2026-10-25 08:30Z). If either has moved, stop and redo this list; a docs-only merge is a new head too. The PR body was refreshed on 2026-10-25 to name `4108523`.
2. **CI on the exact head.** The 4 required checks and `Journey coverage (full)` are green on `41085231` (OBSERVED 2026-10-25, runs from 2026-10-19: 39181004556 push, 39181008249 PR, 39181008236 journey). Counts: unit 1245/1245; `e2e-critical` 334 passed / 28 skipped; `e2e-a11y` 29 / 1 skipped; `ux-audit` 69 + 9; journey full 379 / 29 skipped; `e2e-cross-browser` job skipped (schedule/dispatch only). If the head changes, these do not carry over.
3. **Review and draft.**
   - The ruleset requires a PR, 0 approvals, and resolved review threads (OBSERVED: 0 unresolved). It also has `require_extra_approval_for_unattributed_changes: true` (OBSERVED; effect on this PR UNVERIFIED).
   - The Draft state must be lifted by Chris.
   - Merge commit only; never squash; never "Delete branch".
4. **Product deferrals and dependencies.**
   - #56 and #57: a moderated pilot only, per the 2026-10-18 owner comment; restate it for `4108523`.
   - #66: patched by #68 (`next` 16.3.8), but still OPEN; close it or state its disposition.
   - **New since the 2026-10-20 review:** `npm audit --omit=dev` on `4108523` now reports advisories published 2026-10-01 and 2026-10-22:
     - `next` ≤ 16.4.0: GHSA-2464-fhr4-w9xw (critical), GHSA-673q-mjm6-r5xr (critical), GHSA-p3m5-59mp-jv5r (high);
     - `zod` < 4.6.6: GHSA-mrhx-c7xc-m3w5 (high);
     - `fast-uri` < 3.1.9 (moderate).
   - Their preconditions are absent from this code (INFERRED; hardening receipt §3.4). Chris decides: patch before the release (PR #70, hardening receipt §3.4), or release and patch next.
5. **F2 manual UAT.**
   - Formal rows are missing for `4108523`: tested SHA, device/OS/browser, language and time. Everything is owner-reported ("1 is done").
   - The evidence template and the deployment timeline that narrows which SHA was live (`4108523` since 2026-10-19 07:29 WIB) are in the readiness report, §F2.
   - Either fill the rows in or post an explicit risk acceptance in PR #67.
6. **Pilot env.**
   - `PILOT_ALLOWED_EMAILS` is present, scope Production + Preview (OBSERVED 2026-10-25, value not read).
   - Its type is **Config, not Sensitive** (OBSERVED 2026-10-25), contrary to `DEPLOYMENT.md`. Chris re-adds it as Sensitive (Production) before the merge **and before building the staged recovery deployment (item 9)**, so both builds pick it up.
   - `PILOT_ACCESS_MODE` is absent from Production (OBSERVED 2026-10-25). Keep it that way; it is ignored on Production anyway.
7. **DB identity.** Run §4.1's tighter wake-up check (anonymous `/i/` request, all computes idle first). Re-run the read-only `_prisma_migrations` aggregate on `main` (expect 12/0/0) only if separately authorized; otherwise rely on the 2026-10-20 baseline and say so.
8. **Fresh backup, within about an hour before merging.** Two parts:
   - (a) A **manual snapshot** of `main` (Neon → `neon-dijual` → Backup & restore → Create snapshot; or `neon snapshots create --branch main --name prerelease-<YYYYMMDD-HHMM>`; VENDOR-DOC, console path not observed). This is the restore source for R2a. Free plan: one manual snapshot. If one already exists, Chris decides whether to replace it.
   - (b) A data + schema branch of `main`: `backup-prerelease-<YYYYMMDD-HHMM>`, Expires = Never. It serves read-only comparison and R3.
   - Record: name, full ID, source `main`, creation time (state the timezone), expiry, and the branch count afterwards (≤ 10).
   - Integrity check, read-only aggregates only, on the new branch: `_prisma_migrations` 12/0/0 and the invoice count equal to the same query on `main` taken just before.
   - Keep `backup-preprod-20261019` (about 5 days old on 2026-10-25, and a child branch, so not a documented restore source).
9. **Rollback readiness.**
   - Chris has read §2–§4.
   - **Staged secure recovery deployment built and checked (§3.0)**, with its `dpl_…` recorded in PR #67. If it is not built, the only fast app recovery is the insecure Instant Rollback, which Chris must accept in writing instead.
   - Read-only check that the Neon "Restore" and "Backup & restore" screens exist and what they offer (do not confirm).
   - RTO: UNKNOWN. RPO: the time since the snapshot in item 8.
   - Chris accepts both in writing (wording in the owner-actions file).
10. **Baseline smoke on the current Production** (§3.3 steps 1–3) on the merge day. Taken 2026-10-25 08:37Z: PASS (OBSERVED); repeat on the day.
11. **Authorization.** Release phrase (§1.2) for the exact PR and SHA. The merge starts the Production build, and with it both migrations and the backfill.

---

## 6. After-merge smoke and rollback triggers (future use, not executed)

### 6.1 Deployment

- `vercel ls dibayar --prod`: the newest row is Ready.
- `vercel inspect <url> --logs`:
  - `Cloning … Commit: <merge sha>`;
  - `14 migrations found`;
  - `Applying migration 20261016000000_create_idempotency_keys` and `…20261018000000_invoice_document_snapshot`;
  - `Build Completed`.
- `vercel inspect https://dibayar.vercel.app` → the new `dpl_…`.
- DB target: §4.1 operator check, if not done before the merge.

### 6.2 Database (Chris, Neon SQL Editor on `main`; read-only, aggregates only)

```sql
BEGIN TRANSACTION READ ONLY;
SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS finished,
       count(*) FILTER (WHERE finished_at IS NULL) AS unfinished,
       count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back
FROM "_prisma_migrations";                              -- expect 14 / 0 / 0
SELECT "provenance", "trigger", count(*) FROM "InvoiceSnapshot" GROUP BY 1, 2;
-- expect RECONSTRUCTED_ON_MIGRATION/MIGRATION = in-scope count at migration time
-- (2 on 2026-10-20, adjusted for invoices issued or shared since); no CAPTURED_ON_ISSUE
-- row with capturedAt before the deploy
ROLLBACK;
```

Re-run the FIND-10 query (`docs/receipts/sql/DIBAYAR-FIND-10-IMPACT-READONLY-2026-10-11.sql`) with `window_end` = deploy time, and the FIND-03 out-of-range count. Aggregates only.

### 6.3 Functional (Chris, real phone at 390 px)

- Allowlisted sign-in succeeds; a denied account is refused; sign-out works.
- Owner isolation: a second pilot account sees none of the first account's data.
- Invoice: issue → share → recipient page and PDF in a private window → revoke → the link returns 404.
- Snapshot immutability: edit the deal's brand or contact after issuing; the issued invoice PDF is unchanged.

### 6.4 Rollback triggers (decide, log, do not auto-restore)

| Trigger | Action |
|---|---|
| Production build failed | no rollback needed (old deployment serves); §2.5 if any migration row is unfinished |
| Smoke FAIL, or 5xx on core owner pages for 2+ consecutive checks over 10 min | §2.3: hotfix if fast, otherwise promote the secure recovery deployment (§3.0, Chris phrase); Instant Rollback to `dpl_GdBz1…` only as the accepted insecure fallback |
| Allowlisted sign-in fails for everyone, denied works | §2.4 (env fix + redeploy), **not** rollback |
| Denied account can sign in | containment: Chris empties or corrects `PILOT_ALLOWED_EMAILS` and redeploys (fails closed), or, for an active leak, Deployment Protection "All Deployments" (§2.1); then hotfix. The secure recovery deployment has the same gate code, so promoting it only helps if the cause is the release's other code. Never Instant-Rollback (opens sign-in to all) |
| Recipient links or PDFs 404/500 for active tokens | app issue → §2.3 |
| `_prisma_migrations` unfinished > 0 | §2.5, escalate |
| Wrong or missing invoice data, cross-tenant data visible | stop new activity (§2.1), §2.6; a restore only with its own phrase |

Log every decision (time, trigger, chosen branch, authorization phrase) in the incident note.
