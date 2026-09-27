# Dibayar deployment

**Ownership.** This file is canonical for Vercel/Neon deployment mechanics,
environment variables, per-environment access, and deployment approval and
security gates. The Git branch model, promotion flow, environment lifecycle,
OAuth redirect strategy, and cleanup rules are owned by
[`docs/DEVELOPMENT-WORKFLOW.md`](docs/DEVELOPMENT-WORKFLOW.md) — read it first;
if it conflicts with this file on workflow, it wins. Current project status is
owned by `STATE.md`.

## Environment mechanics

Target model from `docs/DEVELOPMENT-WORKFLOW.md`. Each row states what must be
true; the **Implemented** column is the honest current state and must be
re-verified (Vercel/Neon/`git ls-remote`) before anyone relies on it. Until
staging is provisioned, follow the transitional rollout rules in
`docs/DEVELOPMENT-WORKFLOW.md`.

| Branch | Vercel | Neon | Google OAuth callback | Access | Implemented |
|---|---|---|---|---|---|
| `main` | Production (auto-deploy on merge) | Production branch (`main`, `DATABASE_URL`) | Production domain | see "Current verified state" | Yes |
| `staging` | one stable deployment on a stable domain | one stable branch, never pruned | stable staging domain | Vercel SSO | **Partly** — `staging` git branch exists (created 2026-09-27 from the PR #16 merge commit, `4c2f868`) and its push-triggered CI is live-verified; no Vercel staging environment/domain, no Neon staging branch, and no staging OAuth callback exist yet — all Chris-only, see the action packet in `docs/receipts/DIBAYAR-STAGING-ACTIVATION-2026-09-27.md` |
| `preview/*` | temporary, per-branch | temporary, one per branch (integration-created) | none by default | Vercel SSO | Partly — today *every* pushed branch deploys and gets a Neon branch |
| other branches | Vercel build suppressed (live-verified 2026-09-27) | **still provisions a Neon preview branch — live-verified NOT suppressed** | none | n/a | **Partial.** `vercel.json` `ignoreCommand` -> `scripts/vercel-ignore-build.sh` correctly cancels the Vercel build for an ordinary branch (`Canceled`, ~4s, confirmed live on a disposable `chore/workflow-ci-only-smoke` branch 2026-09-27). But the Vercel↔Neon integration provisioned `preview/chore/workflow-ci-only-smoke` anyway — the build-skip does not stop Neon branch creation. This is a real gap, not yet fixed: see "Ordinary-branch Neon suppression gap" below. |

Mechanics to apply when implementing the not-yet-implemented rows. Every one is
a Vercel/Neon/Google settings change and therefore needs Chris
(`docs/DEVELOPMENT-WORKFLOW.md`, "Authorization"); confirm each against the
current Vercel/Neon docs before acting:

- **CI-only ordinary branches:** implemented repo-side via `vercel.json`'s
  `ignoreCommand`, which Vercel runs before every build
  (`scripts/vercel-ignore-build.sh`; allowlists `main`, `staging`, `preview/*`,
  fails open — builds — if `VERCEL_GIT_COMMIT_REF` is ever unset). This is the
  checked-in equivalent of the dashboard "Ignored Build Step" field; **verify
  the dashboard field is empty/default** so this file is authoritative and the
  two don't silently disagree (same class of risk as the former dashboard
  Build Command override under "Migration strategy" below); this dashboard
  check could not be confirmed programmatically as of 2026-09-27 (reading the
  Vercel API token to query it directly was blocked by this session's own
  tooling) — see the action packet. **Live-verified 2026-09-27:** the build
  itself is correctly skipped (`Canceled`, ~4s, on a disposable
  `chore/workflow-ci-only-smoke` branch). **Also live-verified 2026-09-27, and
  contrary to the original hope:** skipping the build does **not** prevent the
  Neon integration from provisioning a branch — see "Ordinary-branch Neon
  suppression gap" below.

### Ordinary-branch Neon suppression gap (found 2026-09-27, unresolved)

The `vercel.json` `ignoreCommand` stops the Vercel *build* for an ordinary
branch, but the push to that branch still made the Vercel↔Neon integration
create a Neon preview branch (`preview/chore/workflow-ci-only-smoke`,
confirmed via `neon branches list`). The Neon branch is provisioned as part
of the deployment's integration step, which appears to run (or at least
reserve the branch) before or independently of `ignoreCommand` evaluation,
rather than only on an actual build. Practical effect: ordinary
`feature/*`/`fix/*`/`chore/*` branches still consume Neon capacity even
though they no longer deploy, so the Neon 10-branch cap (see "Preview failure
mode" below) is not actually relieved by the CI-only-branch mechanism as
originally hoped. This needs further investigation (a Vercel/Neon
integration setting that scopes branch-database creation the same way
`ignoreCommand` scopes builds, if one exists) and is not yet fixed. Until
then, continue pruning merged-PR Neon preview branches periodically
regardless of the CI-only-branch mechanism's build-suppression success.
- **Staging:** either a Vercel custom environment or the ordinary Preview
  deployment of the long-lived `staging` git branch. Whichever is chosen it
  must have a stable domain, a Neon branch that is never pruned, its own
  `AUTH_SECRET`, and (if Google sign-in is needed) its own registered callback.
  `scripts/vercel-build.sh` treats `VERCEL_ENV=preview` as integration-managed
  and requires `DATABASE_URL_POSTGRES_URL_NON_POOLING`; a staging deployment
  running as Preview inherits that behavior, a custom environment may not.
  `src/auth.ts` sets `trustHost: true` and reads no `AUTH_URL`/`NEXTAUTH_URL`,
  so no base-URL env var is needed beyond the callback registration itself.
- **Neon capacity:** the project `neon-dijual` is on plan `free_v3` with
  `branches_limit: 10`. Observed 2026-09-27 (staging-activation session,
  read-only, after PR #16 merged): **9/10** — `main` plus preview branches for
  merged PRs #7, #11, #12, #13, #14, #15, #16 (`bootstrap/staging-workflow`),
  plus `preview/chore/workflow-ci-only-smoke` created by this session's own
  gate-5 live smoke test (git branch already deleted; the Neon branch is not —
  deletion is Chris-only). All 8 preview branches are cleanup candidates —
  every corresponding PR is merged and none is `main`/`staging` — see the
  action packet in `docs/receipts/DIBAYAR-STAGING-ACTIVATION-2026-09-27.md`.
  No `staging` Neon branch exists yet; creating one now, before pruning, would
  hit the 10-branch cap. Budget once staging exists and cleanup is done:
  `main` + `staging` + at most a few concurrent isolated previews. Failure
  signature at the cap: a Preview for a new git branch ends `BUILD_FAILED` /
  "Resource provisioning failed" in ~1.5 s with no build logs (the integration
  step fails before `scripts/vercel-build.sh` runs); confirmed by intervention
  on 2026-09-27 when freeing one Neon branch let the next redeploy succeed.
- **Branch hygiene:** GitHub "Automatically delete head branches" is currently
  off; this session attempted to enable it directly via the GitHub API and
  the attempt was blocked by this session's own tooling — see the action
  packet in `docs/receipts/DIBAYAR-STAGING-ACTIVATION-2026-09-27.md` for the
  exact manual steps for Chris.

## Current verified state (2026-09-06, V6.1 production-hardening audit)

This section is the current authoritative summary. It supersedes any
conflicting Production/Preview claim elsewhere in this file's "Current
status" history below — that history is preserved as-is for the record (what
was believed/true at each point in time), not rewritten, but should not be
read as current.

```text
ENVIRONMENT=production
COMMIT_SHA=b6119d2ae97ca8cf52473b5adfcd7024fbaef240 (merge of PR #2, `main`)
DEPLOYMENT_URL=https://dibayar.vercel.app
DEPLOYED_AT=2026-09-06T04:36Z (auto-deploy on merge) + at least 3 subsequent
            redeploys the same day (env-var fix, then migration fix) —
            current live deployment created 2026-09-06T09:01Z
AUTH_STATUS=OK — verified 2026-09-06 via unauthenticated `curl` (`/` -> 307 to
            `/api/auth/signin`, `/api/auth/signin` -> 200) and, earlier the
            same day, a real user completing a live Google OAuth sign-in
            (see `docs/receipts/DIBAYAR-V6-1-PRODUCTION-HARDENING-HANDOFF.md`)
DATABASE_CONNECTIVITY=inferred OK (see MIGRATION_STATUS; no dedicated health
            endpoint exists to check this independently — see
            `scripts/smoke-deployment.mjs`)
MIGRATION_STATUS=all 12 checked-in migrations applied; confirmed both by
            build-log evidence from 2026-09-06 and again independently
            reconfirmed live (see "Migration strategy" section below)
SMOKE_TEST_STATUS=PASS — `node scripts/smoke-deployment.mjs --env production
            --url https://dibayar.vercel.app` run 2026-09-06, all checks PASS
VERIFIED_BY=Claude Code (V6.1 production-hardening session), 2026-09-06
```

**Important open finding, not yet a decided product state:** Production
(`dibayar.vercel.app`) currently responds to a plain, credential-free `curl`
with the application's own Auth.js redirect (HTTP 307 to
`/api/auth/signin`), not a Vercel Authentication/SSO login wall. This means
Production is **currently reachable at the Vercel edge without any Vercel
SSO gate** — the opposite of what the "Production policy" and "Preview
policy" sections below (and multiple `STATE.md`/`CLAUDE.md` entries) describe
for earlier points in this project's history. Whether this is an
intentional, approved configuration or an unreviewed side effect of this
incident's remediation is **not established by this audit** — see the
Production release gate section below; `PRODUCTION_READY` should not be
marked until Chris confirms this is the intended state.

## Current status (historical — see "Current verified state" above for what is actually true today)

The bullets in this section are dated records of what was believed at the time.
Where they describe branch-scoped Preview deployments, per-branch OAuth
callbacks, or a shared Preview/Production database, they describe the
pre-workflow past, not the current policy; see "Environment mechanics" above and
`docs/DEVELOPMENT-WORKFLOW.md`.

- Target: Vercel.
- M0 local scaffold: verified.
- M1 local vertical slice: implemented; 21 tests, lint, typecheck, production build, and local HTTP smoke verified.
- M1 Preview deployment: `https://dibayar-kwpldc7bh-kenji-iwakura.vercel.app` is Ready and Vercel-Authentication protected; branch alias: `https://dibayar-git-hermes-day-001-m0-bootstrap-kenji-iwakura.vercel.app`.
- Vercel project: `https://vercel.com/kenji-iwakura/dibayar`.
- GitHub linkage: Chris-confirmed connection to `https://github.com/crh/dibayar`.
- Dashboard inspection: not independently verified in the current browser session because Vercel required login.
- Production URL: `https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/`.
- Production access: URL reachable, but Vercel Authentication redirects unauthenticated visitors to Vercel login.
- Authenticated smoke: Chris confirmed the Dibayar title, Bahasa coming-soon content, absence of the default Next.js template, and approximately 390px mobile layout.
- Preview deployment: Ready; the existing Vercel Neon resource `neon-dijual` is available, but Preview and Production currently resolve to the same Neon `DATABASE_URL`; do not migrate until Preview has a separate database/branch. (Later resolved: Preview databases are Neon branches created per Preview deployment.)
- Production launch and real-user access require Chris's explicit approval.
- M2 Preview (2026-07-17): Chris approved pushing the 8 local M2 commits (`745353e..5385f1b`, including Task D error-handling hardening and the Task E cron preflight guard) to `origin/hermes/m2-invoice`. The push triggered protected Preview `dpl_FpTHqmwmxHyxDj7p7pTU8LLFdDaz` (commit `5385f1b3601a33ea6758d3ef21315b3c63012b83`), Ready, still Vercel-Authentication protected (302 on both the immutable URL and the stable alias). Authenticated smoke confirmed `/dashboard` renders correctly with empty pipeline/invoice data; no data was created. Production and public/recipient-facing access remain untouched and still require separate approval.
- M2 Preview (2026-07-19) — share-link expiry rollout complete on protected Preview: remote `58eed07` includes `53032e3` (expiry code) and the governance closeout; isolated Preview migration `20260719075600_invoice_share_expiry` is applied to `preview/hermes/m2-invoice` / `neondb`; protected Preview `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` is Ready at https://dibayar-mhk536jix-kenji-iwakura.vercel.app and the stable alias remains Vercel-SSO protected. Prior authenticated owner/recipient E2E evidence remains recorded below. M2 is accepted; Production and public/non-SSO recipient access remain separately gated and untouched.
- Migration apply (2026-07-19): `20260719075600_invoice_share_expiry` (adds nullable `InvoiceShare.expiresAt`) was applied directly via the Neon SQL Editor to the isolated Preview branch `preview/hermes/m2-invoice`, database `neondb` — the SQL Editor was visibly scoped to that branch/database before running. Preflight read `expires_at_exists=false`, `migration_finished=false`; the exact checked-in migration SQL ran successfully in one transaction; postflight confirmed `InvoiceShare.expiresAt` is `timestamp without time zone`, nullable, and `_prisma_migrations` records `20260719075600_invoice_share_expiry` `finished=true` with checksum `05fbf7a79269cf4420dfea84d2114bd69ff3137215f998dee077e75275f4df2e`. Expiry code is pushed in `58eed07`; latest protected Preview `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` is Ready. Production untouched; no public/non-SSO access enabled; neither pending Chris decision made or implied made by this apply. Superseded by the entry immediately below — `58eed07` and `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` are no longer the current pushed/deployed state.
- Docs audit correction (2026-07-19, later same day, supersedes the "latest protected Preview" language in the two bullets above): `origin/hermes/m2-invoice` is now synchronized at `bc732a8` (which includes `58eed07` and `53032e3`); the latest protected Preview deployment is `dpl_HGimfRd7RKdmZwDgpABCeo5ZgU36`, READY, with Vercel `gitSource.sha`/`meta.githubCommitSha` both `bc732a8b777be966dc3978ce3c2d3488900a82a1`. Expiry-aware application code (`53032e3`) is therefore pushed and deployed on protected Preview, not merely pushed. The schema migration `20260719075600_invoice_share_expiry` remains applied to the isolated Preview database only (see SECURITY.md); it has not been applied to Production. Production and public/non-SSO recipient access remain untouched and undecided.

- M3 Preview closeout (2026-07-19): `hermes/m3-chasing` commits `41784f8` (WhatsApp) and `4a16fc8` (monthly income summary) passed the full local gates. Metadata-based Preview `https://dibayar-ml5aq10at-kenji-iwakura.vercel.app` is Ready and Vercel-SSO protected; Chrome MCP authenticated smoke verified OAuth, the income summary card, Jakarta month label, draft exclusion, and the PPh disclaimer. Production remains untouched and public/non-SSO access remains disabled.
- M3 income basis: summary uses invoice `createdAt` interpreted in `Asia/Jakarta`; there is no `paidAt` field, so the UI says `Invoice terbit` and `Net estimasi`. Draft invoices are excluded. PPh 21/23 rates are explicit estimates (5%/2%), not tax filing logic.

- M3 bilingual UI (2026-07-19): commits `866c237` and `99a15c9` add an Indonesian-default/English language switch with localStorage persistence, locale-aware month/currency formatting, and translated dashboard/invoice-detail workflow copy. Final protected Preview `https://dibayar-qgo0n3fn6-kenji-iwakura.vercel.app` is Ready; authenticated Chrome MCP verified both languages. Production remains untouched; public/non-SSO access remains disabled.
- Phase 1 design-system Preview (2026-07-21): branch `hermes/design-system` is isolated from `hermes/m3-chasing`; local design-system implementation passed 31 files / 313 tests, lint, typecheck, build, and diff check. Git-linked Preview `https://dibayar-e89c82d05-kenji-iwakura.vercel.app` (alias `https://dibayar-git-hermes-design-system-kenji-iwakura.vercel.app`) is READY and Vercel-SSO protected. Authenticated smoke is blocked because the branch has no usable `AUTH_SECRET`, Google OAuth credentials, or `DATABASE_URL`; no secret values were exposed or changed. Production, public/non-SSO access, database migrations, and M4 remain unchanged and approval-gated.
- Phase 1 design-system closeout (2026-07-22, supersedes the blocker above): branch-scoped Auth.js/Google OAuth values and the isolated Neon connection for `preview/hermes/design-system` were corrected without exposing secrets. `npx prisma migrate deploy` applied all 5 checked-in migrations to that isolated branch and `npx prisma migrate status` reported up to date. A 390×844 authenticated smoke found two English-mode localization leaks; TDD fix `10f1d20` is pushed. Final local gates: 31 files / 316 tests, lint, typecheck, Prisma validate/generate, build, and diff check passed. Git-linked deployment `dpl_D3jMNsrSF2tETo6t4414VRM3oM77` / `https://dibayar-4ue6es7ll-kenji-iwakura.vercel.app` is READY on the stable alias; authenticated `/dashboard` returned 200 with corrected copy and a clean console. Production, public/non-SSO access, and M4 remain untouched and approval-gated.

## M3 email decision — not built

Email reminders are intentionally out of scope for M3 Task 1. A responsible implementation needs an email provider, a verified sender domain and identity, deliverability and bounce handling, unsubscribe/consent rules, a new secret, and operational monitoring. Adding only a provider call would create an unreliable reminder path rather than a cheap feature.

This is a separate Chris product and deployment decision. No email provider dependency, sender credential, background sender, or email route was added in this slice.

## Local verification

From `/home/kenji/code/dibayar`:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

The M0 page is static and does not require a live PostgreSQL database, OAuth credentials, or production services to build. Prisma is configured for PostgreSQL; database migrations and user data are later-milestone work.

## Environment variables

`.env.example` contains synthetic placeholders only. For local work, copy it to `.env.local` only after confirming `.env.local` is ignored by Git:

```bash
git check-ignore .env.local
```

Never commit `.env.local`, real credentials, database URLs, OAuth secrets, or tokens. Vercel environment variables must be configured through the approved deployment environment, not source control.

## Deployment steps

Promotion, branching, and which branch deploys where are defined in
`docs/DEVELOPMENT-WORKFLOW.md`. Production stays protected by the approval gates
below: merging to `main` auto-deploys Production, so a `staging -> main` (or
`hotfix/* -> main`) merge is a Production deployment and needs Chris's explicit
authorization. Required variables per environment are `DATABASE_URL`,
`AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`, configured in the
approved Vercel environment, never in source control.

## Where environment values come from

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Existing Vercel Neon resource `neon-dijual` / Neon Console | One value per environment (Production, staging, each isolated preview) — never shared. On Preview the Neon integration supplies the per-branch connection as `DATABASE_URL_POSTGRES_URL*`, which `scripts/vercel-build.sh` and `src/lib/prisma.ts` use instead of the static value. |
| `AUTH_SECRET` | Generate locally with `openssl rand -base64 48` | A distinct value per environment, stored as a sensitive Vercel variable. Never commit or paste it into chat. |
| `AUTH_GOOGLE_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs | Create a **Web application** client. This is the client ID, not the secret. |
| `AUTH_GOOGLE_SECRET` | Same Google Cloud OAuth Web application | Store only in Vercel as a sensitive value. |

Google OAuth redirect URIs — exactly three long-lived entries (strategy and
rationale: `docs/DEVELOPMENT-WORKFLOW.md`, "Google OAuth redirect strategy"):

```text
http://localhost:3000/api/auth/callback/google
https://<staging-domain>/api/auth/callback/google
https://<production-domain>/api/auth/callback/google
```

Do not register per-branch or per-deployment Vercel hostnames. Any change to
the Google console needs Chris. Redirect URIs already registered for old
`hermes/*` branch aliases predate this policy; removing them is a Google-console
change for Chris and is not done here.

Google setup path:

1. Open https://console.cloud.google.com/projectselector2/home/dashboard and select/create the project.
2. Configure the OAuth consent screen under **Google Auth Platform**; keep it in Testing and add Chris as a test user while validating.
3. Open https://console.cloud.google.com/apis/credentials → **Create credentials** → **OAuth client ID** → **Web application**.
4. Add the redirect URIs above (Chris, in the Google console) and copy the generated client ID and client secret.

Add Google values to Vercel without sending them through chat, scoped to the
target environment (Chris performs or approves each `vercel env add`; agents do
not, and never print values):

```bash
read -rp 'Google client ID: ' GOOGLE_ID
read -rsp 'Google client secret: ' GOOGLE_SECRET; printf '\n'
vercel env add AUTH_GOOGLE_ID <production|preview [git-branch]> --sensitive --yes --value "$GOOGLE_ID"
vercel env add AUTH_GOOGLE_SECRET <production|preview [git-branch]> --sensitive --yes --value "$GOOGLE_SECRET"
unset GOOGLE_ID GOOGLE_SECRET
```

Complete one real test-user login on an environment before claiming authenticated CRUD smoke there.

## Preview and staging policy

Staging and isolated `preview/*` deployments are confidential, access-restricted
(Vercel SSO), and may be used for technical verification and M4 validation prep
only when they contain no real customer or financial data, do not process
payments, and are not announced or shared with users. An openly accessible or
unrestricted staging/preview requires Chris's approval. Ordinary
`feature/*`/`fix/*`/`chore/*` branches do not get a hosted deployment at all
(`docs/DEVELOPMENT-WORKFLOW.md`).

## Production policy

The first production deployment, production-domain assignment, public launch, announcement, or real-user access requires Chris's approval. Routine deployments after explicit approval still require all applicable lint, typecheck, test, build, security, and smoke checks to pass. Destructive migrations, payment processing, new paid services, material data-collection changes, or material security changes require renewed approval. Because merging to `main` deploys Production, every `staging -> main` and `hotfix/* -> main` merge (and, during the pre-staging transition, every legacy or bootstrap PR into `main`) needs Chris's explicit authorization for that PR; the authorization matrix is in `docs/DEVELOPMENT-WORKFLOW.md`.

## Rollback

Rollback expectations (revert PR or promote the previous Vercel deployment; forward-only migrations; smoke check afterward) are in `docs/DEVELOPMENT-WORKFLOW.md`. The concrete Vercel/Neon rollback procedure and identifiers are **not yet verified** here. Do not claim a deployment or rollback until the resulting Vercel status and URL have been checked directly; when the procedure is first exercised and verified, record it in this section.

**Deployment filtering (`vercel.json` `ignoreCommand`), added 2026-09-27, not yet live-verified.** If the allowlist in `scripts/vercel-ignore-build.sh` incorrectly blocks a deployment that must go through (e.g. an unforeseen branch-naming case):

- Fastest: set the Vercel dashboard's **Ignored Build Step** field to a value that always builds (e.g. blank, or `exit 1`) — a dashboard setting overrides nothing in this repo's `vercel.json`, so verify empirically which one Vercel actually honors before relying on either during an incident. This is a Vercel project setting; per `docs/DEVELOPMENT-WORKFLOW.md` "Authorization", changing it is Chris's.
- Repo-side: revert or edit the `vercel.json`/`scripts/vercel-ignore-build.sh` commit and push; the next build picks up the new ignore logic (no redeploy of past commits needed, since the check runs fresh on each new build trigger).
- This mechanism only ever *skips* a build; it cannot itself break a build that does run, so there is no build-content rollback needed — only the allow/deny decision.

**CI staging trigger (`.github/workflows/e2e.yml`).** To revert, remove `staging` from the `push: branches:` list in a new commit and push; already-queued runs are unaffected, and no other workflow file references the change.

## Migration strategy (established 2026-09-06, post-V6.1 incident)

**Current mechanism, verified live 2026-09-06:** Production's Vercel project
**Build Command has a dashboard override** set to:

```
npx prisma migrate deploy && next build
```

This was applied manually through the Vercel dashboard on 2026-09-06 during
incident remediation (see `docs/receipts/DIBAYAR-V6-1-PRODUCTION-HARDENING-HANDOFF.md`
§2.6) to backfill 12 never-applied migrations. It is **still active** as of
this audit (confirmed via `vercel inspect <latest production url> --logs`,
which shows the same command running and all 12 migrations re-applying
idempotently on the most recent deploy). The checked-in `package.json`
`"build"` script is still plain `next build` — the override exists **only**
in the Vercel dashboard, not in this repository.

**Why this is a problem:** a dashboard-only Build Command override is
invisible to code review, `git log`, and anyone reading this repository. It
can be silently changed or reset by anyone with Vercel project access, with
no diff, no PR, and no record. This is the exact "undocumented manual
override" class of risk this audit was asked to close.

**Fix implemented and verified 2026-09-06.** The build command now lives in a
checked-in `vercel.json`, and the Vercel dashboard's Build Command override
was turned off (by the user) so `vercel.json` is authoritative:

```json
{
  "buildCommand": "if [ -n \"$DATABASE_URL\" ]; then npx prisma migrate deploy; fi && next build"
}
```

*(Superseded 2026-09: `vercel.json` now calls `bash scripts/vercel-build.sh`,
which keeps the same guard and adds Preview-specific Neon variable handling and
a fail-closed check. The snippet above is what this section's regression story
describes, not the current file — read `vercel.json` and `scripts/vercel-build.sh`.)*

This is **not** the same string as the original dashboard override —a real
regression was caught and fixed before this reached `main`, see below.

**Regression found and fixed during Preview verification:** the first
version of `vercel.json` used the original unconditional
`npx prisma migrate deploy && next build`. Pushing it (branch
`hermes/v6-1-production-hardening`) to trigger a Preview build — precisely
the verification step this hardening effort establishes as standard practice
— immediately failed:

```
Error: The datasource.url property is required in your Prisma config file when using prisma migrate deploy.
Error: Command "npx prisma migrate deploy && next build" exited with 1
```

Root cause: this project provisions Preview databases **per named git
branch**, not for Preview as a whole — `vercel env ls --project dibayar
preview` shows `DATABASE_URL` scoped only to `hermes/ux-phase-2`,
`hermes/m2-invoice`, and `hermes/day-001-m0-bootstrap`. A brand-new branch
(this one) has no `DATABASE_URL` at build time; `prisma.config.ts` reads
`process.env["DATABASE_URL"]` directly, which resolves to `undefined`, and
`prisma migrate deploy` refuses to run without a datasource URL. Under the
old dashboard-override-on-Production-only setup this never surfaced, because
Preview always built with plain `next build` (no DB needed for the build
itself); making the migration step unconditional and project-wide would have
broken the build for **every future new feature branch** the moment this
merged, which is the normal case in this repo's workflow, not an edge case.

The guard clause (`if [ -n "$DATABASE_URL" ]; ...`) fixes this: skip the
migration step entirely when no database is configured for this
branch/environment (identical behavior to before `vercel.json` existed), and
run it when one is. Re-verified live: a second Preview build from the fixed
`vercel.json`
(`https://dibayar-bnb9o467r-kenji-iwakura.vercel.app`) completed successfully
in 21s with the migration step visibly skipped
(`vercel inspect <url> --logs` shows the guarded command running, no
`Applying migration` lines, `Build Completed`).

Applied and kept **permanently** for every environment (Preview and
Production) — the guard means this is now safe to do rather than a one-time
backfill to revert. Rationale for keeping it permanent:

- `prisma migrate deploy` is additive/idempotent: it only applies migrations
  not already recorded in `_prisma_migrations`. Running it on every build is
  a no-op once the schema is current — this was already re-confirmed live on
  2026-09-06's most recent Production build.
- Prisma's `migrate deploy` takes a database-level advisory lock while
  applying migrations, so even Vercel's occasional concurrent-build scenario
  serializes rather than races; it does not need external locking.
- This directly prevents a repeat of this incident's root cause — Production
  had zero applied migrations for its entire lifetime until 2026-09-06,
  because migrating it was always a manual, undocumented, easy-to-forget
  step. Folding it into the build makes every future deploy self-healing
  instead of relying on someone remembering to run it.
- The alternative (a separate CI job, e.g. a GitHub Actions step that runs
  `prisma migrate deploy` against Production after merge) was considered and
  rejected: it would require duplicating `DATABASE_URL` into a second secret
  store (GitHub Actions secrets), which increases secret sprawl for no
  corresponding audit-trail benefit over the build-log evidence Vercel
  already produces (see §2.6 of the post-merge handoff for exactly this kind
  of build-log verification).

**Sequencing note:** creating `vercel.json` was initially blocked by this
session's own local tooling as a deployment-config change; the user created
it directly. Turning off the dashboard Build Command override was likewise
left to the user as a genuine Production-configuration change (done
2026-09-06). This session's role was limited to the file content, the
Preview-build verification that caught the regression above, and this
documentation — not touching Production settings directly.

**Not yet done:** this branch has not been merged into `main`, so
Production is still running under whatever the dashboard override was set
to before it was turned off — **verify Production's next real deploy** (the
actual merge to `main`) with the same `vercel inspect <url> --logs` pattern
before treating this as closed for Production specifically. Preview-build
success is evidence the mechanism works, not evidence Production has been
rebuilt with it yet.

## Preview failure mode: Neon branch limit (observed 2026-09-26; resolved 2026-09-27, capacity still at the limit)

Symptom: a Vercel Preview for a new git branch ends `ERROR`, `errorCode`
`BUILD_FAILED`, `errorMessage` "Resource provisioning failed", `Builds` `[0ms]`,
no build logs (`vercel logs` says the deployment never reached READY). The
integrations step fails in ~1.5 s, **before** `scripts/vercel-build.sh` runs, so
the missing-`DATABASE_URL_POSTGRES_URL_NON_POOLING` guard is not involved
(that variable exists project-wide for Preview).

Evidence (read-only): Neon project `neon-dijual` is on `free_v3` with
`branches_limit: 10` and holds exactly 10 branches (8 ready, 2 archived); there
is no `preview/codex/m4-invoiced-this-month` branch. Seven of the ten are Neon
preview branches for **merged** PRs (#7–#13) whose git branches still exist on
`origin`. Every deployment since PR #14's first commit (5 so far, all with the
same error) failed this way; the last Ready Preview was PR #13's. Neon's own
provisioning error text is not exposed, but the cause is **confirmed by
intervention**: on 2026-09-27 Chris deleted the oldest preview branch
(`preview/claude/dibayar-week-2026-09-07`, archived, no PR), and the very next
Preview redeploy (`dpl_F2phqqXnFK8qSU35PdYHwaccThg5`, commit `d58c0de`) provisioned
`preview/codex/m4-invoiced-this-month` and reached READY, still Vercel-SSO
protected. The project was then back at 10/10, so Chris deleted four more (5 in total);
as verified 2026-09-27 it is at **6/10** (`main` plus 5 preview branches: PR #7, #11,
#12, #13 and this PR's), 4 free slots. Preview branches accumulate one per git
branch **only under today's pre-transition behavior**, where every pushed
branch still deploys and gets a Neon branch (see "Environment mechanics"
above). Until the CI-only-ordinary-branches mechanic is implemented, prune
merged-PR preview branches again before capacity nears 10. This is a
transitional workaround, not a permanent operating procedure: once ordinary
`feature/*`/`fix/*`/`chore/*` branches stop deploying at all (the
[pre-staging transition](docs/DEVELOPMENT-WORKFLOW.md#pre-staging-transition)),
this failure mode should become exceptional rather than recurring. Nothing in
the repo can fix the underlying cap; deleting Neon branches or `origin`
branches needs Chris's approval. Action packet:
`docs/receipts/DIBAYAR-PR14-PREVIEW-AND-MONTHLY-SUMMARY-REMEDIATION-2026-09-26.md` §2.

## Deployment verification record (convention, established 2026-09-06)

Every meaningful Preview or Production verification — a manual check, a
`scripts/smoke-deployment.mjs` run, or a live authenticated smoke test —
should be recorded using this schema, either inline in a chat/report or
appended to this file, `STATE.md`, or a dated evidence file under
`docs/ux-implementation/evidence/`:

```text
ENVIRONMENT=<preview|production>
COMMIT_SHA=<the exact deployed git SHA, not a branch name>
DEPLOYMENT_URL=<the exact URL checked>
DEPLOYED_AT=<when this deployment was created>
AUTH_STATUS=<OK|FAIL and how it was checked>
DATABASE_CONNECTIVITY=<OK|FAIL|NOT_CHECKED and how>
MIGRATION_STATUS=<applied/pending count, and how confirmed>
SMOKE_TEST_STATUS=<PASS|FAIL>
VERIFIED_BY=<person or agent, and date>
```

**Rule: a record for one environment is never evidence for the other.** A
Preview record must never be cited as proof Production is healthy, and vice
versa — this exact conflation (documented Preview successes read as implying
Production was fine) is what let Production run for its entire history with
zero applied migrations and no auth secrets without anyone noticing until a
real user hit it. Every record above must state `ENVIRONMENT` explicitly and
every claim elsewhere in project docs that summarizes deployment health
should name which environment it covers.

## Post-deploy smoke check

`scripts/smoke-deployment.mjs` is a dependency-free Node script (same
convention as `scripts/cron-guard.mjs`) that performs a **non-destructive**
smoke check against an explicit target:

```bash
node scripts/smoke-deployment.mjs --env preview --url https://dibayar-xxxxx-kenji-iwakura.vercel.app
node scripts/smoke-deployment.mjs --env production --url https://dibayar.vercel.app
```

Both `--env` and `--url` are required — there is no default target, so it
can never silently run against Production. It checks, via plain
credential-free GETs only:

1. `/` responds (not a 5xx), and unauthenticated behavior is the expected
   redirect to sign-in.
2. `/api/auth/signin` renders (200) — catches the exact `MissingSecret`-class
   failure this incident hit, which turned every route into a 500.
3. `/api/auth/providers` and `/api/auth/csrf` respond (200) — cheap,
   read-only Auth.js config checks.
4. It performs no writes, creates no sessions, and never uses real
   credentials.

It prints a filled-in-where-possible Deployment Verification Record (see
above) for the operator to complete and file. **Database-backed health is
explicitly NOT checked** — the app has no dedicated unauthenticated health
endpoint, and probing real data routes would need a real invoice token or
real session, both out of scope for an automated check. Cross-check the
target deployment's own build log (`vercel inspect <url> --logs`) for the
migration-apply summary as the practical substitute until such an endpoint
exists.

Validated 2026-09-06 against the real Production target (read-only): all
four checks passed against `https://dibayar.vercel.app`.

## Production release gate

A merge into `main` is **not** proof Production is healthy — Vercel's
GitHub integration auto-deploys on merge as a side effect, independent of
whether the deployed environment actually has the secrets and schema it
needs. Track these as separate, explicit states; do not skip from `MERGED`
straight to assuming `PRODUCTION_READY`:

```text
MERGED             — PR is merged into main.
DEPLOYED           — Vercel shows a Ready deployment for that merge commit's
                     SHA in the target environment (verify the SHA, not just
                     "a deployment exists").
SMOKE_VERIFIED     — scripts/smoke-deployment.mjs (or equivalent manual
                     checks) run against that exact deployment URL and
                     recorded via the Deployment Verification Record above.
AUTH_VERIFIED      — sign-in actually completes end-to-end. Automated checks
                     can only verify the signin/providers/csrf endpoints
                     respond; a real authenticated round-trip still requires
                     a real user with real credentials (never automate this
                     with the user's own Google account).
MIGRATION_VERIFIED — the target database's applied-migration count matches
                     `prisma/migrations` exactly, confirmed from build logs
                     or (never against Production directly from a local
                     session) `prisma migrate status`.
PRODUCTION_READY   — all of the above hold **for Production specifically**,
                     AND Chris has explicitly confirmed real-user/public
                     access is intended (see "Current verified state" above
                     — this is currently NOT confirmed; Production is
                     technically functional but its public reachability was
                     never a deliberate launch decision).
```

Do not mark `PRODUCTION_READY` from Preview evidence, from "the merge
succeeded," or from a single ad hoc curl — require the full chain above with
a dated Deployment Verification Record for the Production environment
specifically.

## Cron preflight guard (Task E)

`scripts/cron-guard.mjs` is a dependency-free Node preflight + wrapper intended for a **future** unattended Hermes/Claude cron execution. It is not itself scheduled or enabled by this task — no cron job exists yet.

```bash
node scripts/cron-guard.mjs --check-only
node scripts/cron-guard.mjs -- <command> [args...]   # runs <command> only if READY
```

It inspects, without modifying the repo:

- the repo is a Git worktree on branch `main` (default; `--repo`/`--date`/`--expected-branch` exist only for deterministic testing);
- the tracked/untracked working tree is clean;
- local `HEAD` equals `origin/main` exactly (default; no implicit fetch — an absent, ahead, behind, or diverged remote ref fails closed);
- `STATE.md` exists and is at most 120 lines;
- the last `DAILY_LOG.md` rubric rollup for the requested Asia/Jakarta calendar day exists, all six dimensions from `REPORT_RUBRIC.md` are present exactly once as an integer `x/2`, their sum equals the reported `Total x/12`, the total is at least 10, and no dimension is `0` (a single `0` blocks regardless of total, matching the rubric's anti-gaming clause).

On any failure it prints `BLOCKED` with every failed rule name and reason and exits nonzero **without ever invoking the child command**. On success it prints `READY` and exits 0 (`--check-only`) or execs the child command via argv (no shell), from the verified repo root (the Git top-level the guard just confirmed, not the caller's `process.cwd()`), and propagates its exit code/signal. `--check-only` combined with `-- <command>` is rejected as a usage error (exit 2) before any check runs, since the command would silently never execute — that combination is ambiguous, not a no-op. Output never includes file contents, remote URLs, environment values, or credentials.

This guard is necessary but not sufficient for unattended execution: it never fetches, pushes, deploys, touches a database, or schedules/creates a cron job itself, and it says nothing about the correctness of the command it is asked to wrap. Any future cron wrapper must invoke it first and must still route all real work through the standard approval gates in this document and `REVIEW_CHECKLIST.md`.

Hardening in `50099ba` (after the initial `bee8283`): the child previously inherited the caller's `process.cwd()` instead of the verified repo root, so a cron invoked from an unrelated directory could pass the repo guard but run its command against the wrong tree; it now always runs at `repoRoot` (never printed).

Focused tests: `npm run test:cron-guard` — 28/28 passing (isolated temp Git repos and fixture files only — never the real repo). This is separate from and does not replace canonical `npm run test`.

## Recipient invoice share-link rollout gate (Task F + Task G) — COMPLETE 2026-07-18

The recipient invoice share-link (Task F) and the dashboard stage-selector/contrast fix (Task G) were committed (`85a4f6a`), pushed, and deployed; a follow-up mutation-hardening commit (`5064e70`) was also committed, pushed, and deployed. Chris approved option A for the share-link feature's scope on 2026-07-17; execution was authorized 2026-07-18 ("Please continue what you think the best", said immediately after Hermes stated this exact plan). All ordered steps below are now complete:

1. Execution authorization for the protected M2 Preview: granted 2026-07-18 (see above).
2. SHA-256 DB fingerprint/isolation preflight repeated against the target Neon branch; confirmed isolated `preview/hermes/m2-invoice`, not Production.
3. Migration `20260717090000_invoice_share` applied to that isolated Preview only.
4. `85a4f6a` pushed; protected Preview `dpl_3XePMMPAs9tSBydhmPYNQ687QSFZ` reached Ready, both the immutable URL and stable alias still 302-protected by Vercel SSO. Follow-up hardening commit `5064e70` pushed and deployed as `dpl_JBQfD2wYbjuDhb81t4GrYyjLAmBo`, also Ready.
5. Authenticated owner-lifecycle smoke (create/regenerate/revoke), recipient-route smoke (`/i/[token]`, public JSON/PDF), and Chrome E2E for Task G's dashboard stage-transition control all passed, including old/new-token 404 invalidation; mobile Lighthouse Accessibility/Best Practices/SEO scored 100/100/100 and the browser console was clean.
6. Cleanup verified: disposable deal/invoice/share counts returned to 0/0/0.
7. Acceptance evidence recorded in STATE.md/DAILY_LOG.md/ROADMAP.md; M2 is accepted.

A later report of a "share panel stuck loading" bug was investigated and found not reproducible: the source already transitions a valid `{ active: false }` response to the create-link UI state. A user-provided browser screenshot taken after the `5064e70` deployment, inspected by Hermes, visibly confirms the correct active-share state (Bahasa text "Tautan berbagi aktif.").

Public recipient usability — an actual unauthenticated visitor reaching `/i/[token]` from outside Vercel SSO — still cannot be externally verified, since the only reachable environment stays behind Vercel SSO (step 5's E2E was run by an authenticated browser session; it validates the routes/UI, not unauthenticated real-world reach). Any decision to expose the share-link route beyond SSO (a public or non-SSO-protected environment) remains separately approval-gated. Production remains untouched by all of the above and requires its own, separate deployment decision.

## Public / non-SSO recipient access — decision brief (pending Chris approval, not yet decided)

This section states the facts needed to decide whether, and how, to make invoice recipients able to reach their share link without a Vercel SSO login. **No change has been made.** Vercel Authentication (SSO) remains on for every environment.

**1. Routes that need unauthenticated reach vs. routes that must stay behind app auth**

- Must be reachable without Vercel SSO for the feature to work for a recipient: `/i/[token]`, `/api/public/invoices/[token]`, `/api/public/invoices/[token]/pdf`.
- Must remain application-authenticated regardless of this decision: the dashboard, the owner invoice/deal APIs, the owner invoice-PDF and share-mutation APIs (create/regenerate/revoke), and any auth/admin surfaces. These already require an authenticated session at the application layer independent of Vercel SSO.

**2. What the Vercel mechanisms actually do (verify against current docs before acting — this is not a stable API)**

- **Deployment Protection Exceptions** unprotect a preview **domain**, making that whole domain publicly reachable at the Vercel edge. They are not path-scoped — there is no way to except only `/i/*`. (https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions)
- **OPTIONS Allowlist** only bypasses protection for CORS preflight `OPTIONS` requests. It does not let a recipient's actual `GET` (HTML page, JSON, or PDF) through — it is irrelevant to this use case. (https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/options-allowlist)
- **Protection Bypass for Automation** is a shared secret meant for testing/automation clients that attach it to requests. It is not a mechanism for anonymous recipients to reach a page — a real recipient has no way to attach that secret. (https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection)
- Conclusion: turning off Vercel Authentication for the deployment/environment, or adding a Deployment Protection Exception for the target preview domain, exposes **the entire selected domain/deployment** at the Vercel edge — not only the three public routes above. There is currently no Vercel-edge mechanism in the cited docs that unprotects only specific paths.

**3. What becomes internet-reachable if SSO is turned off for a domain**

- Every route and static asset served from that domain becomes reachable past the Vercel edge, including the landing page, any auth entrypoints, and any other route that happens to be deployed there — not just the three public invoice routes.
- This is edge reachability only. The application's own auth layer is unaffected: protected dashboard pages and owner APIs still require a valid session and will still reject or redirect an unauthenticated request. Turning off Vercel SSO does **not** by itself make owner data readable — it removes one outer layer, not the app-level authorization checks.

**4. Residual risk if this is enabled, stated honestly**

- Share tokens are 256-bit CSPRNG-random, stored only as a SHA-256 hash; a database read alone cannot reconstruct a usable link.
- Unknown, malformed, revoked, and expired tokens all return the same uniform 404 in the `53032e3` code, which is pushed (`origin/hermes/m2-invoice` @ `bc732a8`, which includes `53032e3`) and deployed to the latest protected Preview (`dpl_HGimfRd7RKdmZwDgpABCeo5ZgU36`, READY, Vercel `gitSource.sha`/`meta.githubCommitSha` = `bc732a8b777be966dc3978ce3c2d3488900a82a1`); the supporting migration `20260719075600_invoice_share_expiry` has been applied to the isolated Preview database only (see SECURITY.md) — Production has received neither this migration nor this application code.
- Shares support expiry (schema applied to isolated Preview 2026-07-19; expiry-aware application code (`53032e3`) pushed and deployed to the latest protected Preview above), revocation (delete), and regeneration (rotates the token, invalidating the old one).
- Public responses set `no-store`, `noindex`, and `no-referrer`.
- Public routes return a minimal safe-field projection, not full owner/invoice data.
- Existing rate limiters (`publicInvoiceJsonRateLimiter`, `publicInvoicePdfRateLimiter`, `publicInvoicePageRateLimiter`) apply — but they are **in-memory and per-instance**. They do not bound abuse across multiple Vercel instances; see the distributed-rate-limit trigger note in `SECURITY.md`. This limiter gap becomes directly relevant the moment this decision is made "yes."
- A share link is a bearer capability: anyone who obtains the URL (forwarded in chat, screenshotted, cached by a proxy) can use it until it is revoked, regenerated, or expires. This is inherent to the link-sharing design, not a bug to fix before deciding.

**5. Concrete post-enable verification (to run only after Chris approves and the change is made), from a network context with no Vercel/app credentials**

```bash
# Recipient routes — expect 200 and the correct content-type on a known valid token
curl -i -L https://<domain>/i/<valid-token>
curl -i -L https://<domain>/api/public/invoices/<valid-token>
curl -i -L https://<domain>/api/public/invoices/<valid-token>/pdf

# Unknown / expired / revoked token — expect the same 404 status and body as each other
curl -i -L https://<domain>/i/<unknown-or-expired-or-revoked-token>

# Owner-only surfaces — expect a redirect or 401, never a 200 with data
curl -i -L https://<domain>/dashboard
curl -i -L https://<domain>/api/invoices
```

A `302`/login-page response from any of the first three recipient-route checks means the decision has **not** taken effect for recipients — it proves SSO is still active, not that the rollout succeeded. Do not report this as a pass.

**6. Rollback**

Re-enable Vercel Authentication for the environment, or remove the domain from Deployment Protection Exceptions. Re-run the unauthenticated curl checks above against `/i/[token]` and confirm they return to a `3xx`/login response.

This brief is informational only. It does not enable, schedule, or recommend a specific choice — it exists so Chris can decide with the actual mechanism and blast radius in view. No Vercel setting has been changed as part of writing this section.
