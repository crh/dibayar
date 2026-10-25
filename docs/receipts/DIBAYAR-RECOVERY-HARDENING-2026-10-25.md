# Dibayar — Production recovery hardening for release PR #67 (2026-10-25)

- **Run:** 2026-10-25, about 08:15–10:30Z (15:15–17:30 WIB), by Claude Code.
- **Branches:**
  - this receipt, the probe and the guard test: `chore/recovery-hardening-2026-10-25`, from `staging`;
  - the recovery candidate: `hotfix/secure-recovery-baseline-2026-10-25`, from `main`;
  - the dependency patch: `chore/security-deps-2026-10-25`, from `staging`.

  None of them is merged. PR #67's head did not change.
- **Companions:**
  - `DIBAYAR-PRODUCTION-RECOVERY-RUNBOOK.md` (revised today);
  - `DIBAYAR-PR67-RELEASE-READINESS-2026-10-25.md` (gates);
  - `DIBAYAR-PR67-OWNER-ACTIONS.md` (Chris's steps);
  - `DIBAYAR-PRODUCTION-RECOVERY-READINESS-2026-10-20.md` (the earlier findings this builds on).

Labels as in the runbook: OBSERVED, OWNER-REPORTED, INFERRED, UNVERIFIED, TESTED-LOCAL, VENDOR-DOC.

## 1. Baseline (Phase 0)

| Item | Value 2026-10-25 | Drift vs. historical | Label |
|---|---|---|---|
| `main` | `308a339e7de817aa37378d263d51f25c78ea4f09` | none | OBSERVED (`git fetch --all --prune`) |
| `staging` = PR #67 head | `41085231cf386acb8e0309b83d61086b5a49ef92` | none | OBSERVED |
| PR #67 | OPEN, Draft, MERGEABLE/CLEAN, no review decision; body still cites `7aeaa7b` (refreshed today, §4) | none | OBSERVED (`gh pr view 67`) |
| Production deployment | `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5`, `308a339`, Ready, alias `dibayar.vercel.app`; previous `dpl_54LBdY2Di8sgdjahifpAi5W27AuP`; no rollback in progress | none | OBSERVED (`vercel ls --prod`, `vercel inspect`, `vercel rollback status`, project API `targets.production`) |
| Issues/PRs | #56, #57, #65, #66 OPEN; #68 and #69 MERGED into `staging` (`796e558`, `4108523`); #39 (dependabot → `main`) OPEN, unrelated | none | OBSERVED |
| Migrations | Production baseline 12 (`main`, last `20260901034508_invoice_share_token_ciphertext`); release 14 (adds `20261016000000_create_idempotency_keys`, `20261018000000_invoice_document_snapshot`) | none | OBSERVED (`git diff --name-status origin/main origin/staging -- prisma/`) |
| Build and migrations | `vercel.json` `buildCommand` → `scripts/vercel-build.sh`: on Preview it requires `DATABASE_URL_POSTGRES_URL_NON_POOLING`; otherwise, if `DATABASE_URL` is set, it runs `npx prisma migrate deploy`, then `next build`. Git deployments only for `main`, `staging`, `preview/**` | none | OBSERVED |
| Production env (names, types, scopes only) | `DATABASE_URL` Secret/Production; `AUTH_*` Secret/Production; `PILOT_ALLOWED_EMAILS` **Config**/Production+Preview; `PILOT_ACCESS_MODE` absent; Neon integration `DATABASE_URL_*` Config/all three environments | none | OBSERVED (`vercel env ls production`) |
| Project protection | `ssoProtection.deploymentType = prod_deployment_urls_and_all_previews` (Standard); `autoAssignCustomDomains = true` | new observation | OBSERVED (Vercel project API GET) |
| Existing improvements in repo | none for recovery; runbook and 2026-10-20 receipts existed only as untracked files in the main checkout (committed on this branch) | — | OBSERVED |

## 2. Findings

| # | Finding | Evidence | Label |
|---|---|---|---|
| F1 | **Hobby Instant Rollback can only target the immediately previous Production deployment.** After the release that is `dpl_GdBz1…` (`308a339`: no allowlist, `next` 16.3.3). The 2026-10-21 runbook's app-rollback target was therefore always the insecure one; no other target was reachable by rollback | `vercel.com/docs/instant-rollback` ("Hobby users can roll back to the immediately previous deployment") | VENDOR-DOC |
| F2 | **A staged Production deployment can be built ahead and promoted instantly.** `vercel deploy --prod --skip-domain`, then `vercel promote <id>` assigns the domain without a rebuild. This makes a pre-built *secure* recovery target possible | `docs/cli/deploying-from-cli`, `docs/deployments/promoting-a-deployment` | VENDOR-DOC; not exercised |
| F3 | **The secure recovery candidate works on the release schema.** `308a339` + #68 + #69 (+ test clock fix), 12 migrations. On the 14-migration DB: `migrate status` up to date, `migrate deploy` no-op; full non-visual E2E 103 passed / 11 skipped / 0 failed. Unit 825/825; CI on its exact SHA green (§5) | §5.1–§5.2 | TESTED-LOCAL; CI OBSERVED |
| F4 | **Roll-forward after a recovery window is safe at the data level.** The release code freezes invoices exposed by the snapshot-unaware app once, as `RECONSTRUCTED_LATE`; snapshot UPDATE is rejected by the trigger; cascade deletes still work; a cross-tenant freeze writes nothing | `scripts/recovery-compat-probe.ts` 9/9 | TESTED-LOCAL |
| F5 | **`backup-preprod-20261019` is not a documented restore source.** Neon restores a branch from another branch only when the source is a root branch; the backup is a child of `main`. The documented in-place restore (same connection string) is a snapshot one-step restore; PITR on `main` is supported within 6 h | `neon.com/docs/introduction/branch-restore`, `/docs/guides/backup-restore`, `/docs/introduction/plans` (Free: 6 h, 1 manual snapshot, 10 branches) | VENDOR-DOC |
| F6 | **Deployment Protection "All Deployments" (Vercel Authentication) is available on Hobby but is a total outage.** It protects every URL including `dibayar.vercel.app`, so pilot creators, the OAuth callback and recipients' `/i/…` links and PDFs are all blocked; there are no path exceptions; Hobby allows one external Vercel user | `docs/deployment-protection`, `…/vercel-authentication` | VENDOR-DOC; not exercised |
| F7 | **New dependency advisories on the release head and the recovery candidate.** `next` 16.3.8: GHSA-2464-fhr4-w9xw (critical; image-optimizer RCE via an upstream `sharp` issue, glibc), GHSA-673q-mjm6-r5xr (critical; `use cache` returning typed arrays), GHSA-p3m5-59mp-jv5r (high; Server Actions DoS), all published 2026-10-22, patched in 16.4.1. `zod` 4.4.3: GHSA-mrhx-c7xc-m3w5 (high; unbounded `z.array`). `fast-uri` 3.1.8: moderate. Current Production (`next` 16.3.3, `sharp` 0.35.4) is also affected | `npm audit --omit=dev --json`; `gh api /advisories/<id>` | OBSERVED |
| F8 | F7's preconditions are absent: no `"use server"` / `"use cache"`, no `next/image`, no `z.array` outside tests; `sharp` 0.35.5 is the advisory's own workaround for GHSA-2464 | `grep` over `src/`, `e2e/`, `scripts/`; lockfile | INFERRED (code read, not a pen test) |
| F9 | Production database identity is still owner-reported. The `neon` CLI (4.13.0) is now installed but unauthenticated; it opened a browser OAuth URL, which was not completed (credential entry is not permitted). No secret value was read | `neon projects list` | OBSERVED (blocker) |
| F10 | An anonymous, read-only request that provably reaches the database exists: every `/i/<token>` and `/api/public/invoices/<token>/pdf` hashes the token and runs one `SELECT` on `InvoiceShare` before answering 404. This makes a tighter wake-up identity check, and a DB-health smoke step, possible without sign-in or data | `src/lib/invoice-share.ts` (`getPublicInvoiceDocumentByToken`) in `308a339` | OBSERVED (code) |
| F11 | Production anonymous baseline 2026-10-25 08:37:55Z: smoke 4/4 PASS; unknown-token page and PDF → 404 (2.8 s, cold); HSTS, CSP, `X-Frame-Options: DENY`; `x-vercel-id` shows `iad1` functions | smoke script; `curl` | OBSERVED |
| F12 | `PILOT_ALLOWED_EMAILS` is still Config, not Sensitive; `PILOT_ACCESS_MODE` still absent | `vercel env ls production` | OBSERVED |
| F13 | F2 timeline: the staging alias served `4108523` from 2026-10-19 00:29Z (`dpl_HHDjeX…`), rebuilt 01:50Z (`dpl_CxvG7f…`, still current). The allow/deny result reported at 02:16Z can only have come from `4108523` (the only staging build with the gate) | Vercel deployments API; PR #67 comments | OBSERVED / INFERRED |
| F14 | `main`'s own unit suite fails today: two `invoice-share.test.ts` tests use a fixed share expiry of 2026-10-17 with the real clock. This is pre-existing on `main`; `staging` fixed it in `4209e83`, which the recovery branch cherry-picks | local `vitest` on the cherry-picked tree before/after | OBSERVED |

## 3. Implemented changes

### 3.1 `hotfix/secure-recovery-baseline-2026-10-25` @ `59388146acc8935c898bdd3de5cfb69562ada6d7` (pushed; no PR, not for merge)

| Commit | Content |
|---|---|
| `3725356` | cherry-pick of PR #68 (`796e558 -m 1`): `next` 16.3.8, `eslint-config-next` 16.3.8, `sharp` 0.35.5, `fast-uri` 3.1.8, lockfile. `SECURITY.md` conflict: kept only the #66 entry |
| `c4a2b18` | cherry-pick of PR #69 (`4108523 -m 1`): `src/lib/pilot-access.ts`, `src/auth.ts`, `/akses-terbatas`, the layout redirect, the E2E fixture and spec, `DEPLOYMENT.md`/`SECURITY.md` entries. Dropped 4 staging-only docs that do not exist on `main`; resolved the `e2e/support/auth.ts` import list. Application code is byte-identical to #69's |
| `5938814` | cherry-pick of `4209e83` (test-only clock fix, F14) |

`prisma/` is identical to `main` (`git diff --quiet 308a339 HEAD -- prisma/`). Pushing it created no Vercel deployment (`vercel.json`: `"**": false`; `vercel ls` unchanged). It is a recovery artifact for a staged Production build (runbook §3.0), not a hotfix PR.

### 3.2 `chore/recovery-hardening-2026-10-25` (PR into `staging`, not merged)

- `scripts/recovery-compat-probe.ts`: the database-level recovery checks (F4). It uses the same guardrails as `scripts/e2e-fixtures.ts`: only `127.0.0.1:55432/dibayar_test`, `E2E_FIXTURE_CONFIRM=non-production`, and its own probe user, removed at the end. The immutability check counts only the trigger's own refusal; an unrelated error fails it. Run:

  ```bash
  E2E_FIXTURE_CONFIRM=non-production npx tsx --env-file-if-exists=.env.local scripts/recovery-compat-probe.ts
  ```

- `src/lib/migration-rollback-compat.test.ts` (Vitest, runs in `npm test`). Every migration after `main`'s last one must be additive, or carry an explicit `-- rollback-incompatible: <reason>` line, because the recovery candidate only works on schemas its old code can use.
  - It flags drops, renames, type changes, `SET NOT NULL`, new required columns without a default, `ALTER TYPE … ADD VALUE`, triggers on existing tables, `TRUNCATE` and `DELETE`.
  - It ignores comments and plpgsql bodies.
  - 13 tests: the two release migrations pass, and each hazard has a positive case.
- `docs/receipts/DIBAYAR-PRODUCTION-RECOVERY-RUNBOOK.md`: revised (§0 facts, §1.2 phrases, §2.1 containment, §2.3 order, new §3.0, §3.3 DB probe, §4.1 identity check, §4.3 restore options, §4.4 gates, §5 checklist, §6.4 triggers).
- First commit of `DIBAYAR-PRODUCTION-RECOVERY-READINESS-2026-10-20.md` and `DIBAYAR-NEON-PRODUCTION-BACKUP-PREFLIGHT-2026-10-20.md` (unchanged; reviewed for secrets: none).
- This receipt, the readiness report, and the owner-actions file.

### 3.3 PR #67 description

Refreshed via `gh api -X PATCH` (`gh pr edit` fails silently in this repo). It now has a current-state section for `4108523` with the gate table and links, and the 2026-10-18 `7aeaa7b` review is kept below as history. No checkbox was ticked.

### 3.4 `chore/security-deps-2026-10-25` @ `f9bcee0` (PR #70 into `staging`, Draft, not merged)

`next` 16.3.8 → **16.4.2** (patched; published 2026-10-15, older than 16.4.3 of 2026-10-23), `eslint-config-next` → 16.4.2, `zod` `^4.4.3` → `^4.6.7`, `overrides.fast-uri` 3.1.8 → 3.1.9; `sharp` stays 0.35.5. `npm audit --omit=dev`: **0 vulnerabilities**. Local gates: lint 0 errors (same pre-existing warning), typecheck clean, Vitest 94 files **1245/1245**, `npm run build` (Turbopack, Next.js 16.4.2) green. Browser suites: PR #70's own CI (run 40179308245); not run locally, because the local runner was in use for the rehearsal.

It is a minor `next` upgrade and therefore a new release head if merged: Chris's decision (owner actions §1). If it lands, the recovery candidate must be re-cut with the same versions and re-tested.

## 4. Recovery strategies evaluated (Phase 1)

| | S1 Forward hotfix | **S2 Staged secure recovery deployment (recommended)** | S3 Deployment Protection "All Deployments" | S4 Instant Rollback to `dpl_GdBz1…` | S5 Allowlist containment (empty/correct list + redeploy) |
|---|---|---|---|---|---|
| Time to activate | CI ~20 min (`e2e-critical` 17.8 min on the release head) + ~1 min build + Chris's merge | seconds (`vercel promote`, no rebuild; VENDOR-DOC). Prepared before the merge | seconds, a settings toggle (VENDOR-DOC) | seconds | ~1–2 min build (`vercel redeploy` or new env + redeploy) |
| Pilot creators | unaffected | keep access (allowlist enforced; TESTED-LOCAL) | **all blocked** (need a Vercel login with project access) | keep access, **and so does every Google account** | blocked (empty list) or restored (corrected list) |
| Recipient `/i/` links and PDFs | unaffected | work (TESTED-LOCAL E2E) | **all blocked** | work | unaffected |
| 14-migration schema | yes | yes (no-op migrate; E2E green) | n/a | yes (2026-10-21 rehearsal) | yes |
| Snapshot integrity / Decision A | kept | snapshots untouched (DB trigger); new exposures not frozen until roll-forward, then frozen once as `RECONSTRUCTED_LATE` (probe) | n/a | same as S2 | kept |
| Auth and tenant isolation | kept | kept: pilot gate + ownership-denial E2E green | n/a (nobody gets in) | **regressed** (open sign-up) and pre-#68 `next` | kept |
| Production configuration change | none | none at incident time; one staged Production build beforehand | project setting change | none | env change |
| Rollback of the recovery itself | n/a | promote the release deployment again, or merge a fix (auto-assignment stays on after promote, VENDOR-DOC) | toggle back to Standard | "Undo Rollback"/promote | restore the list + redeploy |
| Limits | needs a known fix and green CI | does not fix data; same old-code defects; Decision A gap in the window; must be rebuilt if the allowlist value or the dependency set changes; Hobby behaviour of `--skip-domain`/`promote` UNVERIFIED until built | outage, not recovery | security regression | only addresses access, not app defects |

**Recommendation: S2** for app-only failures that harm users now, with S1 as the default when a fix is quick. Keep S3 as a last-resort containment for an active data leak, and S5 for access problems. S4 only with Chris's written acceptance of the regression. Nothing in S1–S5 drops migrations or bypasses pilot authentication.

**Failure scenarios covered by S2:**

- a release-code bug in pages, APIs or PDFs, with healthy data;
- a release-code crash loop;
- a Decision A rendering bug;
- the release's idempotency path misbehaving.

**Not covered:**

- data corruption (§7 matrix);
- schema or migration failure (runbook §2.5: the previous deployment keeps serving if the build fails);
- a pilot-gate bug, which shares the same code (use S5/S3);
- old-code bugs;
- infrastructure outages (Vercel, Neon, Google).

**Threat model for application rollback:**

| Threat during rollback | S2 | S4 |
|---|---|---|
| Uninvited Google account signs up and gets a creator account | prevented (gate in `signIn`, before any row) | **possible** |
| Existing session of a removed creator | denied on next request | **allowed** |
| Known `next` advisories (#66 set) | patched (16.3.8) | **present** (16.3.3) |
| 2026-10-22 `next` advisories | present, preconditions unmet | present, preconditions unmet; plus `sharp` 0.35.4 lacks the GHSA-2464 workaround |
| Cross-tenant read/write | denied (ownership E2E) | denied (same code) |
| Snapshot rewrite | blocked by DB trigger | blocked by DB trigger |
| Issued invoice changes after a deal edit during the window | yes, until roll-forward | yes |

**Status: SECURE_ROLLBACK is not blocked.** It is ready on the code side and needs one owner action (the staged build). Until Chris builds it, the only instant app rollback is S4, the insecure one.

## 5. Local tests and rehearsal (Phase 1C/2/5)

All on the approved disposable DB `127.0.0.1:55432/dibayar_test` (PostgreSQL 17.10), with synthetic fixtures only; it was empty at the start. Production was never connected.

### 5.1 Forward rehearsal

| Step | Result | Elapsed |
|---|---|---|
| recovery tree `migrate deploy` on the empty DB (12) | all applied | 1.9 s |
| recovery tree E2E fixture seed (3 users, 8 deals, invoices SENT+PAID, 2 shares) | verified | — |
| `staging` tree `migrate deploy` (release) | `20261016000000…` and `20261018000000…` applied; backfill `RECONSTRUCTED_ON_MIGRATION` × 2; `_prisma_migrations` 14/0 | 1.5 s |
| recovery tree `migrate status` / `migrate deploy` (= its Vercel build step) | "Database schema is up to date!" / `No pending migrations to apply.`, exit 0/0 | — |

### 5.2 Recovery app on the release schema

`npm run test:e2e` in the recovery tree (production build `next build --webpack` + `next start`; chromium and chromium-mobile 390×844; pilot gate on with the E2E allowlist): **103 passed, 11 skipped, 0 failed** (3.5 min). The skips are viewport-scoped by design: 4 desktop tests that only run at 390 px and 7 mobile tests that only run on desktop.

Included:

- `e2e/security/pilot-access.spec.ts`, 4 tests × 2 projects:
  - an uninvited existing session sees the invite-only page and no data;
  - owner APIs refuse it, reads and writes alike;
  - an invited owner works;
  - recipients open the link and PDF with no session;
  - AccessDenied names no account;
- `e2e/security/ownership-denial.spec.ts`: a second user cannot view, read or edit the first user's deal or invoice;
- `e2e/public/invoice.spec.ts`: valid link and PDF, invalid, expired, revoked.

Unit tests 825/825, lint 0 errors (1 pre-existing warning in #69's `src/auth.test.ts`), typecheck clean.

**CI on `5938814`** (dispatch 40177453189): **all five jobs success** (run log counts: unit 825/825; e2e-critical 91 passed / 11 skipped; e2e-a11y 12 / 1 skipped; ux-audit 69 + 9; e2e-cross-browser 209 passed / 19 skipped).

`npm audit --omit=dev`: the F7 set (same as the release head).

### 5.3 Database-level checks and roll-forward

`scripts/recovery-compat-probe.ts` (release code), on the DB the recovery app had just used: 9/9 PASS.

- 14/0 migrations;
- an old-app SENT invoice has no snapshot;
- the first release read freezes it as `RECONSTRUCTED_LATE`/`DOCUMENT_READ`, exactly once;
- an unexposed Draft stays live;
- raw and client UPDATE are both rejected by the trigger;
- a later deal edit does not reach the frozen document;
- a cross-tenant freeze writes 0 rows;
- deleting the owner cascades.

Release app `npm run test:e2e:critical` (`staging` tree, its own fresh server on :3300; no server was left running beforehand) on the same DB afterwards: **334 passed, 28 skipped, 0 failed** (27.8 min, one worker). These are exactly the counts of CI's `e2e-critical` on `4108523`. Rolling forward after a recovery window is therefore TESTED-LOCAL.

### 5.4 Logical restore rehearsal (local stand-in, **not** Neon)

A stand-in for "Neon snapshot → release → incident → restore to the snapshot". **Not Neon's mechanism.**

How the stand-in works:

- The "snapshot" is a text-typed copy of every `public` table, in a side schema of the same disposable DB.
- The "restore" drops `public`, re-applies the recovery tree's 12 migrations, and copies the rows back with type casts.

The helper script lives in the session scratchpad and is not committed; this is a one-off rehearsal, not a tool.

| Step | Result | Elapsed |
|---|---|---|
| reset; recovery tree 12 migrations; fixture seed | 12 migrations, 3 users, 8 deals, 2 invoices, 2 shares, 4 sessions | — |
| "snapshot" | copied | 0.1 s |
| release `migrate deploy` + seed + one post-release write by release code (new user, deal, invoice frozen `CAPTURED_ON_ISSUE`, then SENT) | 14 migrations; 4 users, 9 deals, 3 invoices, 3 snapshots | 1.5 s (migrations) |
| **incident: restore to the snapshot** | 12 migrations; 3 users, 8 deals, 2 invoices, `InvoiceSnapshot` absent. **The post-release user, deal, invoice and all snapshots are gone**: the RPO effect | **2.0 s end to end** |
| release code against the restored DB (`recovery-compat-probe.ts`) | **FAIL as expected**: 12/0 migrations, and `prisma.deal.create()` throws, because the release client writes `idempotencyKey`, which no longer exists. A live release build would fail writes as well as snapshot reads | — |
| recovery app `npm run test:e2e:critical` on the restored DB | **91 passed, 11 skipped, 0 failed** (3.1 min), same counts as its CI `e2e-critical` | — |
| roll forward again: release `migrate deploy` | both migrations re-applied, 14/0; backfill found nothing to freeze (the E2E teardown had removed the fixture rows); probe 9/9 | 1.5 s |
| cleanup | side schema dropped (0 left) | — |

**What this shows:**

- After a restore to the pre-release state, the order that works is: promote the secure recovery deployment first, then roll forward with a release build that re-applies the migrations.
- Serving the release build against a restored 12-migration database breaks it.
- The database-side steps take seconds locally.

**What it does not show:** Neon's restore time, connection interruption, branch-ID or integration effects, or anything about Production data volume. **RTO stays UNKNOWN.**

The first two attempts failed on a defect in the stand-in itself, not in the app:

1. Column order differed between the copy and the rebuilt tables. Fixed with explicit column lists.
2. `DROP SCHEMA public CASCADE` also dropped the copy's enum-typed columns. Fixed by copying as text.

Both attempts rolled back and were rerun from an empty schema.

### 5.5 New guard test

`npx vitest run src/lib/migration-rollback-compat.test.ts`: 13/13. Full `npm test` on the docs branch: **95 files, 1258/1258** (1245 + 13). `npm run lint`: 0 errors, 1 pre-existing warning. `npm run typecheck`: clean; it covers `scripts/*.ts` through `tsconfig.json` `**/*.ts`.

## 6. Failures and their classification

| Failure | Class | Handling |
|---|---|---|
| 2 unit tests on the cherry-picked `main` tree (`invoice-share.test.ts`, "expired" instead of "ok") | **existing** (on `main` since 2026-10-17; F14) | fixed on the recovery branch by cherry-picking `staging`'s test-only fix `4209e83`; not weakened |
| `npm audit` F7 | **environment/dependency** (new upstream advisories) | analysed (F8); patch branch prepared (§3.4); Chris decides |
| lint warning `_config` unused in `src/auth.test.ts` | existing (#69) | left as is (warning, not error; identical on `staging`) |
| `neon` CLI unauthenticated | environment limitation | owner procedure instead (runbook §4.1) |
| none introduced by this work | — | — |

## 7. Database recovery matrix (Phase 2)

| Path | Data-loss risk | Schema compatibility | Auth impact | Owner boundary | Tested? |
|---|---|---|---|---|---|
| Forward data repair (R0) | none beyond the bug | n/a | none | restore phrase not needed; repair phrase (§1.2) + review | not applicable until a defect exists; rehearse on synthetic data first |
| PITR of `main` (R1) | writes after the chosen time (≤ 6 h back) | may land on 12 migrations → app must match (promote S2 or redeploy; release code cannot even write there, §5.4) | sessions/accounts after that time vanish | restore phrase; Neon console confirm | **no** (VENDOR-DOC only); local §5.4 stand-in |
| Snapshot one-step restore (R2a) | writes after the snapshot | lands on the snapshot's 12 migrations → promote S2 first or redeploy the release | same as R1; branch ID changes (integration mapping uses names—check) | restore phrase | **no**; needs the pre-release snapshot (G7) |
| Restore from backup **branch** (R2b) | — | — | — | — | **BLOCKED**: not a documented Neon operation for a child source |
| Cutover to backup branch (R3) | writes after the branch | release redeploy re-applies migrations on the backup; S2 or `308a339` are no-ops (TESTED-LOCAL) | same | Production env change + redeploy + restore phrase | **no** |
| App rollback (S4) / recovery (S2) / roll-forward | none (no DB change) | 12 ↔ 14 both directions TESTED-LOCAL | S4 opens sign-in; S2 keeps the gate | rollback/promote phrases | S2 TESTED-LOCAL; Production procedure not exercised |

RTO: **UNKNOWN**. Measured only for the local logical stand-in (§5.4), not for Neon.

RPO: **the time since the most recent pre-release snapshot**. Today that is about 5 days (`backup-preprod-20261019`, and that backup is not restorable by a documented path), so effectively unbounded until G7 is done.

**Operations that would lose state:**

| Operation | Writes | Sessions | Invoice links | Snapshots |
|---|---|---|---|---|
| R1/R2a/R3 | after the restore point lost | after it lost; users re-sign-in | created after it → 404 for brands | created after it lost; if the point is before the release, all `InvoiceSnapshot` rows and the backfill go too, and are re-made by the next release build |
| S2/S4 promote/rollback | none | kept (DB sessions) | kept | kept |
| S5 | none | denied while the list excludes them, not deleted | kept | kept |

## 8. Remaining risks

1. No Production restore or promote has ever been exercised on this project; Hobby-specific behaviour of `--skip-domain` and `promote` is UNVERIFIED until Chris builds S2.
2. DB identity remains owner-reported until the tighter check (owner actions §3).
3. The F7 advisories on the release head (preconditions unmet, INFERRED).
4. F2 metadata gaps for `4108523`.
5. The Decision A exposure inside any recovery window (S2/S4).
6. A Neon snapshot restore changes `main`'s branch ID; whether the Vercel–Neon integration (which maps Production by branch) needs attention afterwards is UNVERIFIED. It does not affect the static `DATABASE_URL`, which keeps working because the connection string is unchanged (VENDOR-DOC).
7. Rate limiters are per-instance (existing `SECURITY.md` note), so the anonymous DB probe returns 404 even when rate-limited.

## 9. Owner-only actions

`docs/receipts/DIBAYAR-PR67-OWNER-ACTIONS.md`, in order:

1. dependency decision;
2. allowlist to Sensitive;
3. DB identity check;
4. F2 rows or acceptance;
5. product dispositions;
6. staged secure recovery build;
7. pre-release snapshot and branch;
8. RTO/RPO acceptance;
9. same-day baseline and release authorization.

## 10. Attestation

**No Production mutation.** None of the following happened:

- merge;
- deploy, promote, rollback or redeploy;
- restore, Neon branch or snapshot creation;
- Production SQL;
- env change;
- secret read;
- sign-in to Vercel or Neon.

**Hosted actions:**

- read-only `gh`, `vercel` and Vercel API GETs;
- anonymous HTTPS GETs to `dibayar.vercel.app` (smoke script, two 404 probes, one header read);
- a push of `hotfix/secure-recovery-baseline-2026-10-25`, which created no deployment;
- one CI `workflow_dispatch`;
- two PRs into `staging` (not merged);
- the PR #67 description edit.

**Local database:** writes went only to `127.0.0.1:55432/dibayar_test`, with synthetic fixtures and probe rows. The rehearsal side schema was dropped at the end.
