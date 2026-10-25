# Dibayar Track A: final engineering handoff for PR #67 (2026-10-25)

- **Run:** 2026-10-25, about 10:00–11:30Z (17:00–18:30 WIB), by Claude Code.
- **Scope:** Track A (engineering). Track B (Production DB verification, focused manual UAT, pilot configuration correction, owner-side decisions) was done by Chris before this run. It is carried forward here, not repeated.
- **Builds on:**
  - `DIBAYAR-PR67-RELEASE-READINESS-2026-10-25.md` (gates as of the 08:30Z head `4108523`);
  - `DIBAYAR-RECOVERY-HARDENING-2026-10-25.md` (recovery findings F1–F14 and local tests);
  - `DIBAYAR-PR67-OWNER-ACTIONS.md` and `DIBAYAR-PRODUCTION-RECOVERY-RUNBOOK.md` (both updated in this run for the new SHAs and the new live deployment).
- Labels: **OBSERVED**, **OWNER-REPORTED**, **TESTED-LOCAL**, **INFERRED**.

## Verdict

**Engineering: READY FOR FINAL RELEASE GATE.** PR #67 is engineering-ready at **`d3bb4336afea2ee4def35169ad178c7427a166ba`**.

This is not release authorization. PR #67 stays Draft and unmerged, and nothing in Production was changed by this run.

## Gate table

| Gate | Status | Evidence | Action needed |
|---|---|---|---|
| PR #70 security patch | **PASS** | PR #70 (`chore/security-deps-2026-10-25` → `staging`, up to date with `staging`) merged with a merge commit at 10:42Z. Merge commit `d3bb433`; source `f9bcee0`; tree identical to `f9bcee0`. Diff: `package.json`, `package-lock.json` only, touching `next`/`@next/*` 16.3.8 → 16.4.2, `eslint-config-next` 16.4.2, `zod` 4.4.3 → 4.6.7, `fast-uri` 3.1.8 → 3.1.9. `npm audit --omit=dev`: **0 vulnerabilities**. Pre-merge CI 40179308245 on `f9bcee0`: all four required jobs success | none |
| Recovery candidate | **PASS** (owner build pending) | `hotfix/secure-recovery-baseline-2026-10-25` @ **`514967059c1ecd44b529a7962ba4d79b6a3c48e4`** = `5938814` + cherry-pick of `f9bcee0` (clean, no conflict). Dependency, devDependency and override sets identical to `staging` `d3bb433`; `npm audit --omit=dev` 0. CI dispatch **40186820122** on that SHA: all five jobs success (unit 825/825; e2e-critical 91 passed / 11 skipped; e2e-a11y 12 / 1; ux-audit 69 + 9; e2e-cross-browser 209 / 19). Local: lint 0 errors (1 pre-existing warning), typecheck clean, unit 825/825, `npm run build` green (Next.js 16.4.2, Turbopack) | Chris builds the staged deployment (owner actions P1) |
| Schema compatibility | **PASS** (TESTED-LOCAL) | Disposable DB `127.0.0.1:55432/dibayar_test`: reset → recovery tree 12 migrations → recovery fixture seed → release tree (`f9bcee0`, same tree as `d3bb433`) applied the 2 release migrations → `_prisma_migrations` 14 finished / 0 unfinished. Recovery tree `migrate status` "Database schema is up to date!", `migrate deploy` "No pending migrations to apply." Recovery `npm run test:e2e` on that DB: **103 passed, 11 skipped (viewport-scoped by design), 0 failed**, twice. `scripts/recovery-compat-probe.ts` (release code) afterwards: **9/9**. `prisma/` on the candidate is identical to `main`; `prisma/` on `staging` unchanged since `4108523` (14 migration files, the 2 expected additions) | none |
| Snapshot integrity under the recovery app | **PASS** (TESTED-LOCAL) | §2.3 sentinel test: an invoice frozen by release code; the recovery app's own deal edit, settings edit, due-date change, share create/regenerate/revoke, public read, mark-paid, a blocked deal delete and a cross-tenant attempt; then a full recovery E2E run. Snapshot row hash `035000732a4e…` unchanged; frozen brand and issuer still the originals. The recovery Prisma schema has no `InvoiceSnapshot` model | none |
| Authentication security | **PASS** | `src/lib/pilot-access.ts`, `src/auth.ts`, `/akses-terbatas`, the `(app)` layout gate and `e2e/security/pilot-access.spec.ts` are **byte-identical** between `staging` `d3bb433` and the candidate. Both suites include pilot-access (uninvited existing session → invite-only page, owner APIs refuse it, invited owner works, recipients keep link + PDF, AccessDenied names no account) and ownership-denial. Production env (Vercel API, metadata only): `PILOT_ALLOWED_EMAILS` type **sensitive**, targets Production + Preview, updated 2026-10-25 10:36:17Z; `PILOT_ACCESS_MODE` absent (fail-closed allowlist mode). No auth or security test weakened | none |
| PR #67 exact-head CI | **PASS** | PR #67 head = `d3bb433`, MERGEABLE/CLEAN, Draft. On `d3bb433`: push CI **40185815387** and PR CI **40185818426** both success on `lint-typecheck-test` (94 files, 1245/1245), `e2e-critical` (334 passed / 28 skipped), `e2e-a11y` (29 / 1), `ux-audit` (69 + 9); **Journey coverage (full) 40185818349** success. Same counts as `4108523`. Staging deployment for `d3bb433` Ready (GitHub deployment 7311956964, 10:42Z) | none |
| Track B evidence | **CARRIED FORWARD** (OWNER-REPORTED complete; one part re-observed) | OBSERVED today: the pilot configuration correction (`sensitive` type; Production redeployed 17 s later as `dpl_4ZKa6…`, same `308a339`). OWNER-REPORTED (Track A brief, 2026-10-25): Production DB verification, focused manual UAT and owner decisions done. Earlier record: PR #67 comments of 2026-10-19 and 2026-10-20 and the 2026-10-20 preflight receipt. Note: no Track B result is written in PR #67 or `docs/testing/MANUAL-UAT.md` yet | Chris posts the Track B results in PR #67 (owner actions R1) |
| Final release readiness | **READY FOR FINAL RELEASE GATE** (engineering) | No unresolved mandatory engineering gate | Owner actions below, in order. A focused UAT re-run on `d3bb433` is required (§4) |

## 1. Task A1: PR #70

| Check | Result | Label |
|---|---|---|
| Source / target | `chore/security-deps-2026-10-25` → `staging`; 1 commit `f9bcee0` on top of `4108523` | OBSERVED |
| Unexpected changes | none: 2 files; lockfile entries changed only for `next`, `@next/*`, `fast-uri` and `zod` | OBSERVED |
| Breaking-change risk | `next` minor (16.3 → 16.4), `zod` minor. Covered by full unit, critical E2E (desktop + 390 px), a11y, UX audit and journey coverage on the exact merge SHA, with counts identical to the previous head | OBSERVED (CI) |
| Required checks before merge | CI 40179308245 on `f9bcee0`: all four required jobs success | OBSERVED |
| Merge | `gh pr ready 70` then `gh pr merge 70 --merge --match-head-commit f9bcee0`. Merge commit `d3bb4336afea2ee4def35169ad178c7427a166ba`. No protection bypassed (ruleset 24837655: PR, 0 approvals, required checks, merge or squash) | OBSERVED |
| Audit, production deps (`--omit=dev`) | 0 vulnerabilities on `d3bb433` and on `5149670` | OBSERVED |
| Audit, full tree | **3 dev-only findings, assessed, not fixed:** `vite` 8.1.4 (high: launch-editor/Windows issues, dev-server middleware cross-origin, `server.fs.allow` bypass), `@vitest/mocker` / `vitest` 4.1.11 (moderate). They are pulled only by `vitest` and `@vitejs/plugin-react` (test runner). They are not in the Next.js build or the Vercel runtime, and no Vite dev server is started (Vitest runs in-process, jsdom). Fix: `vite` ≥ 8.1.6, `vitest` ≥ 4.1.12, in a follow-up `chore/*` PR into `staging` **after** the release, so the release head does not move again | OBSERVED / INFERRED (exposure) |

## 2. Task A2: secure recovery candidate

### 2.1 Candidate

`hotfix/secure-recovery-baseline-2026-10-25` @ **`514967059c1ecd44b529a7962ba4d79b6a3c48e4`**, pushed 2026-10-25. The push created no Vercel deployment (`vercel ls`; `vercel.json` disables Git deployments for `hotfix/*`). It is not a PR and not for merge.

| Commit | Content |
|---|---|
| `308a339` | `main`, the code Production serves today |
| `3725356` | PR #68 cherry-pick (`next` 16.3.8, `sharp` 0.35.5, `fast-uri`, `source-map-js`) |
| `c4a2b18` | PR #69 cherry-pick (pilot allowlist) |
| `5938814` | `4209e83` cherry-pick (test clock) |
| **`5149670`** | **new:** PR #70 cherry-pick (`next` 16.4.2, `zod` 4.6.7, `fast-uri` 3.1.9), clean, no conflict |

### 2.2 Tests (this run)

| Step | Result |
|---|---|
| `npm ci`; installed `next` 16.4.2, `zod` 4.6.7, `fast-uri` 3.1.9, `sharp` 0.35.5, `next-auth` 5.0.0-beta.32 | OBSERVED |
| lint / typecheck / unit | 0 errors (1 pre-existing warning) / clean / 84 files 825/825 |
| `npm run build` (what Vercel runs after `migrate deploy`) | green, Next.js 16.4.2 (Turbopack) |
| DB at 12 → recovery seed → release migrations → 14/0 | as in the gate table |
| recovery `migrate status` / `migrate deploy` on 14 | up to date / no pending (this is the no-op its Vercel build runs) |
| recovery `npm run test:e2e` (production `next build --webpack` + `next start`; chromium + chromium-mobile 390×844; pilot gate on) | 103 passed / 11 skipped / 0 failed (3.4 min), run twice |
| `recovery-compat-probe.ts` (release code) | 9/9 |
| CI dispatch 40186820122 on `5149670` | all five jobs success (counts in the gate table) |

Covered critical flows:

- **Authentication:** pilot-access spec ×2 projects; session spec; sign-out session.
- **Deals:** CRUD, add-deal dialog, filter navigation.
- **Invoices:** invoice journeys.
- **Public recipient:** `e2e/public/invoice.spec.ts` (valid link and PDF, invalid, expired, revoked).
- **Tenant isolation:** ownership-denial.

### 2.3 Snapshot integrity (sentinel test)

The E2E fixture cleanup deletes the fixture users, and the cascade removes their snapshots. A snapshot count before and after a plain E2E run therefore says nothing. So a separate sentinel tenant (`recovery-sentinel-*`, synthetic, removed afterwards) was used:

1. **Release code** created a SENT invoice and froze it (`freezeInvoiceDocument`, 1 row). Hash `035000732a4e3eae4bdf1212c2add96e`.
2. **Recovery code's own library functions** ran on that tenant: `updateDeal` (brand, fee, scope), `saveUserSettings`, `updateInvoiceDueDate`, `createOrRegenerateShare` ×2, `getPublicInvoiceDocumentByToken` (`ok`), `revokeShare`, `updateInvoiceStatus` → PAID, `deleteDeal` → `has-invoices` (RESTRICT), and a cross-tenant `updateInvoiceStatus` → `not-found`. Hash unchanged.
3. **A full recovery E2E run** (103/0), then a re-read. Hash unchanged; frozen `brand` = "Brand Beku" and `issuerName` = "Sentinel Issuer" (the originals, not the edits). The sentinel was then removed, leaving 0 rows.

The scripts were temporary and are not committed (same pattern as the hardening receipt's §5.4 helper).

### 2.4 Runbook scenarios

Same coverage as hardening receipt §4 (S2), now with patched dependencies:

| Scenario | Covered by the candidate? |
|---|---|
| Release-code bug with healthy data; crash loop; Decision A rendering bug; idempotency misbehaviour | **covered** |
| Pre-release or restored 12-migration schema, and the 14-migration release schema | **works on both** |
| Data damage, migration failure, pilot-gate bug (shared code), old-code bugs, infrastructure outages | **not covered** (runbook §2.5, §2.6, §4; S5/S3 for the gate) |
| Threat model during recovery | unchanged from hardening receipt §4: open sign-up prevented; removed sessions denied; snapshot rewrite blocked by the trigger. The 2026-10-22 `next` advisories are now **patched** in the candidate as well |

### 2.5 How the owner builds and promotes it

Runbook §3.0, updated in this run to `514967059c1ecd44b529a7962ba4d79b6a3c48e4`. Summary in owner actions P1 and P4 below.

## 3. Task A3: PR #67 release candidate

| Check | Result |
|---|---|
| `staging` HEAD | `d3bb4336afea2ee4def35169ad178c7427a166ba` (`git fetch`, 2026-10-25 ~10:45Z) |
| `main` | `308a339e7de817aa37378d263d51f25c78ea4f09`, unchanged |
| Commits since the reviewed head `4108523` | exactly `f9bcee0` and its merge `d3bb433` |
| Release diff vs. the prior review | only `package.json` and `package-lock.json` added; `prisma/` unchanged |
| Migrations | 14 on `staging`; `main...staging` adds exactly `20261016000000_create_idempotency_keys` and `20261018000000_invoice_document_snapshot` (+ `schema.prisma`) |
| Pilot protection in the release | present (`src/lib/pilot-access.ts` etc., byte-identical to the candidate) |
| Patched dependencies in the release | present (`next` 16.4.2, `zod` 4.6.7, `fast-uri` 3.1.9) |
| Required CI on the exact head | gate table; nothing reused from an older SHA |
| PR #67 description | refreshed via `gh api -X PATCH` with a Track A section for `d3bb433` on top; earlier sections kept as history |

## 4. Manual UAT that must be repeated

The final candidate changed materially since the 2026-10-19 UAT on `4108523`:

- a framework minor upgrade (`next` 16.3.8 → 16.4.2) under Auth.js, routing and hydration;
- the `PILOT_ALLOWED_EMAILS` value or type was re-saved at 10:36Z. The Preview scope shares that entry, so staging's allowlist input changed too.

CI covers emulated browsers; it does not cover real Google OAuth or real phones.

**Re-run on the staging alias serving `d3bb433` (deployment `dibayar-8cbel0dkg-kenji-iwakura.vercel.app`, 10:42Z), about 10–15 min:**

| Check | Priority | Why repeat |
|---|---|---|
| MAN-AUTH-01: allowlisted Google sign-in **and** sign-out | P0 | real OAuth under `next` 16.4.2; allowlist re-saved |
| MAN-AUTH-02 step 1: excluded Google account denied (`/akses-terbatas`, no data) | P0 | same |
| MAN-REL-01 / MAN-SHARE-01: recipient link + PDF in a private window, then "Cabut tautan" → reload shows it is gone | blocks release | public route + PDF under the new framework |
| MAN-DUE-01 + MAN-DEAL-02 on **one** real phone: add a deal with a due date, then edit it | P0/P1 | hydration on a real device |

Not repeated, with the reason:

- MAN-PDF-01 desktop layout, MAN-WA-01, MAN-DEAL-01 and the second phone: no code change in those paths beyond the framework. CI (desktop + 390 px) is green with identical counts.
- Production DB verification: the release diff adds no migration or data change since Track B.

Record each row with date/time WIB, device/OS/browser, language and staging SHA `d3bb433`.

## 5. Owner actions (Chris), in execution order

### Read-only, or no Production change

| # | Action | Evidence to post in PR #67 |
|---|---|---|
| R1 | Post the Track B results in PR #67 (DB verification result, UAT rows or gap acceptance, #56/#57 dispositions, RTO/RPO acceptance), so the release record is complete | the comment |
| R2 | §4 focused UAT re-run on `d3bb433` staging | rows (SHA `d3bb433`) |
| R3 | Merge day, before P2: `git fetch`; confirm `origin/staging` = `d3bb433…` and PR #67 head unchanged. Any move means a new head, and this receipt no longer applies | output |
| R4 | Merge day: `node scripts/smoke-deployment.mjs --env production --url https://dibayar.vercel.app` + the two unknown-token 404 probes (runbook §3.3). Last run here: 2026-10-25 10:45:59Z, PASS; `/i/…` and PDF 404 (DB reached); HSTS, CSP, `X-Frame-Options` present | output + time |

### Requires explicit Production authorization (each its own phrase; runbook §1.2)

| # | Action | Notes |
|---|---|---|
| P1 | **Build the staged secure recovery deployment** of `514967059c1ecd44b529a7962ba4d79b6a3c48e4`: clean clone, `git checkout --detach 514967059c1ecd44b529a7962ba4d79b6a3c48e4`, `vercel link --yes --project dibayar --scope kenji-iwakura`, `vercel deploy --prod --skip-domain --scope kenji-iwakura`, then the 5 read-only checks of runbook §3.0 | Build **after** the final allowlist value (done at 10:36Z). `dibayar.vercel.app` must still be `dpl_4ZKa6srWazYvCW6vC1Go5baEcDx4`. Build log: `12 migrations found`, `No pending migrations`, **no** `Applying`. Record the `dpl_…` |
| P2 | **Fresh Neon backup** within about 1 h before the merge: snapshot of `main` + data/schema branch of `main`, read-only aggregates (12/0/0, invoice count), branch count ≤ 10 (owner actions §7) | backup creation; record names, IDs, times |
| P3 | **Authorize the PR #67 merge** at exactly `d3bb4336afea2ee4def35169ad178c7427a166ba`: lift Draft, merge commit (never squash, never "Delete branch") | Production deploy + 2 migrations + snapshot backfill |
| P4 | **Verify Production after the deploy** (read-only): `vercel inspect https://dibayar.vercel.app` shows the new deployment from `d3bb433`; build log `Applying` the 2 migrations; smoke + 404 probes; allowlisted sign-in works and an excluded account is denied; one recipient link + PDF + revoke; read-only `_prisma_migrations` 14/0 | runbook §5 |
| P5 | **Only during an incident** (separate phrase): `vercel promote <P1 dpl_id> --scope kenji-iwakura`, then runbook §3.3 and `vercel promote status dibayar` | Instant Rollback would land on `dpl_4ZKa6…` (`308a339`, no allowlist): insecure fallback only |

## 6. Production state seen during this run (read-only)

- `dibayar.vercel.app` → `dpl_4ZKa6srWazYvCW6vC1Go5baEcDx4`. It was created 2026-10-25 10:36:34Z as a redeploy (by Chris's account) of `dpl_GdBz1swMWc7sEfL6psnpRVRWX6m5`, from `main` @ `308a339`. `dpl_GdBz1…` is now the previous deployment.
- The runbook and the owner-actions file now name `dpl_4ZKa6…` wherever they mean the live or Instant Rollback deployment.

## 7. Attestation

**Writes:**

- PR #70 marked ready and merged into `staging` (merge commit);
- the push of `hotfix/secure-recovery-baseline-2026-10-25` (`5938814..5149670`) and a CI `workflow_dispatch` on it;
- this receipt, plus the runbook / owner-actions / STATE / DAILY_LOG updates, on `chore/recovery-hardening-2026-10-25` (PR #71, not merged);
- the PR #67 description.

**Database writes:** the approved disposable DB `127.0.0.1:55432/dibayar_test` only, with synthetic data.

**Read-only on Production:**

- `vercel ls` / `inspect` / `env ls`;
- Vercel API GETs for deployment and env metadata (no values, no decrypt);
- anonymous HTTPS GETs (smoke, two 404 probes, headers).

**Not done:**

- PR #67 merge;
- any Production deploy, promote or rollback;
- Production migration, SQL, restore or backup;
- env or secret change;
- reading any secret value;
- bypassing a ruleset.
