# Dibayar deployment

## Current status

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
- Preview deployment: Ready; the existing Vercel Neon resource `neon-dijual` is available, but Preview and Production currently resolve to the same Neon `DATABASE_URL`; do not migrate until Preview has a separate database/branch.
- Production launch and real-user access require Chris's explicit approval.
- M2 Preview (2026-07-17): Chris approved pushing the 8 local M2 commits (`745353e..5385f1b`, including Task D error-handling hardening and the Task E cron preflight guard) to `origin/hermes/m2-invoice`. The push triggered protected Preview `dpl_FpTHqmwmxHyxDj7p7pTU8LLFdDaz` (commit `5385f1b3601a33ea6758d3ef21315b3c63012b83`), Ready, still Vercel-Authentication protected (302 on both the immutable URL and the stable alias). Authenticated smoke confirmed `/dashboard` renders correctly with empty pipeline/invoice data; no data was created. Production and public/recipient-facing access remain untouched and still require separate approval.
- M2 Preview (2026-07-19) — share-link expiry rollout complete on protected Preview: remote `58eed07` includes `53032e3` (expiry code) and the governance closeout; isolated Preview migration `20260719075600_invoice_share_expiry` is applied to `preview/hermes/m2-invoice` / `neondb`; protected Preview `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` is Ready at https://dibayar-mhk536jix-kenji-iwakura.vercel.app and the stable alias remains Vercel-SSO protected. Prior authenticated owner/recipient E2E evidence remains recorded below. M2 is accepted; Production and public/non-SSO recipient access remain separately gated and untouched.
- Migration apply (2026-07-19): `20260719075600_invoice_share_expiry` (adds nullable `InvoiceShare.expiresAt`) was applied directly via the Neon SQL Editor to the isolated Preview branch `preview/hermes/m2-invoice`, database `neondb` — the SQL Editor was visibly scoped to that branch/database before running. Preflight read `expires_at_exists=false`, `migration_finished=false`; the exact checked-in migration SQL ran successfully in one transaction; postflight confirmed `InvoiceShare.expiresAt` is `timestamp without time zone`, nullable, and `_prisma_migrations` records `20260719075600_invoice_share_expiry` `finished=true` with checksum `05fbf7a79269cf4420dfea84d2114bd69ff3137215f998dee077e75275f4df2e`. Expiry code is pushed in `58eed07`; latest protected Preview `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` is Ready. Production untouched; no public/non-SSO access enabled; neither pending Chris decision made or implied made by this apply. Superseded by the entry immediately below — `58eed07` and `dpl_CgARDeZex6BpTFx3UVmXQ8dibXSp` are no longer the current pushed/deployed state.
- Docs audit correction (2026-07-19, later same day, supersedes the "latest protected Preview" language in the two bullets above): `origin/hermes/m2-invoice` is now synchronized at `bc732a8` (which includes `58eed07` and `53032e3`); the latest protected Preview deployment is `dpl_HGimfRd7RKdmZwDgpABCeo5ZgU36`, READY, with Vercel `gitSource.sha`/`meta.githubCommitSha` both `bc732a8b777be966dc3978ce3c2d3488900a82a1`. Expiry-aware application code (`53032e3`) is therefore pushed and deployed on protected Preview, not merely pushed. The schema migration `20260719075600_invoice_share_expiry` remains applied to the isolated Preview database only (see SECURITY.md); it has not been applied to Production. Production and public/non-SSO recipient access remain untouched and undecided.

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

## Next deployment step

The repository is already linked to Vercel and the protected production page has passed authenticated smoke. Keep it protected; do not make it public without Chris's explicit approval. Before applying M1 migrations, configure a separate Preview database and then configure `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` in the approved Vercel environment.

## Where environment values come from

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Existing Vercel Neon resource `neon-dijual` / Neon Console | Preview uses a branch-scoped connection string. The checked-in M1 migration was applied successfully to that Preview database. |
| `AUTH_SECRET` | Generate locally with `openssl rand -base64 48` | Already generated and stored as a sensitive Preview branch variable. Never commit or paste it into chat. |
| `AUTH_GOOGLE_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs | Create a **Web application** client. This is the client ID, not the secret. |
| `AUTH_GOOGLE_SECRET` | Same Google Cloud OAuth Web application | Store only in Vercel as a sensitive value. |

Google OAuth redirect URIs to add:

```text
https://dibayar-git-hermes-day-001-m0-bootstrap-kenji-iwakura.vercel.app/api/auth/callback/google
https://dibayar-kwpldc7bh-kenji-iwakura.vercel.app/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

Google setup path:

1. Open https://console.cloud.google.com/projectselector2/home/dashboard and select/create the project.
2. Configure the OAuth consent screen under **Google Auth Platform**; keep it in Testing and add Chris as a test user while validating.
3. Open https://console.cloud.google.com/apis/credentials → **Create credentials** → **OAuth client ID** → **Web application**.
4. Add the redirect URIs above and copy the generated client ID and client secret.

Add the Google values without sending them through chat:

```bash
read -rp 'Google client ID: ' GOOGLE_ID
read -rsp 'Google client secret: ' GOOGLE_SECRET; printf '\n'
vercel env add AUTH_GOOGLE_ID preview hermes/day-001-m0-bootstrap --sensitive --yes --value "$GOOGLE_ID"
vercel env add AUTH_GOOGLE_SECRET preview hermes/day-001-m0-bootstrap --sensitive --yes --value "$GOOGLE_SECRET"
unset GOOGLE_ID GOOGLE_SECRET
```

The Preview branch deployment is configured and Ready. The checked-in M1 migration was applied successfully to the Preview database. Google provider preflight reaches `accounts.google.com`; complete one real test-user login before claiming authenticated CRUD smoke.

## Preview policy

A confidential, access-restricted preview may be used for technical verification only when it contains no real customer or financial data, does not process payments, and is not announced or shared with users. An openly accessible or unrestricted preview requires Chris's approval.

## Production policy

The first production deployment, production-domain assignment, public launch, announcement, or real-user access requires Chris's approval. Routine deployments after explicit approval still require all applicable lint, typecheck, test, build, security, and smoke checks to pass. Destructive migrations, payment processing, new paid services, material data-collection changes, or material security changes require renewed approval.

## Rollback

Rollback procedure and Vercel project identifiers are not yet verified. Do not claim a deployment or rollback until the resulting Vercel status and URL have been checked directly.

## Cron preflight guard (Task E)

`scripts/cron-guard.mjs` is a dependency-free Node preflight + wrapper intended for a **future** unattended Hermes/Claude cron execution. It is not itself scheduled or enabled by this task — no cron job exists yet.

```bash
node scripts/cron-guard.mjs --check-only
node scripts/cron-guard.mjs -- <command> [args...]   # runs <command> only if READY
```

It inspects, without modifying the repo:

- the repo is a Git worktree on branch `hermes/m2-invoice` (default; `--repo`/`--date`/`--expected-branch` exist only for deterministic testing);
- the tracked/untracked working tree is clean;
- local `HEAD` equals `origin/hermes/m2-invoice` exactly (no implicit fetch — an absent, ahead, behind, or diverged remote ref fails closed);
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
