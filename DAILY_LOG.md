# DAILY_LOG.md

## Day 1 — 2026-07-12 — M0 bootstrap blocked before implementation

- Phase/milestone: Phase 1 — M0 Bootstrap.
- Selected task: delegate the complete M0 application foundation and Bahasa coming-soon slice to Claude Code on `hermes/day-001-m0-bootstrap`.
- Verified repository: Git root `/home/kenji/code/dibayar`; branch was created from up-to-date `main`; remote remained `git@github.com:crh/dibayar.git`; working tree was clean before delegation.
- Delegation task: complete M0 contract was written to temporary `/tmp/dibayar-claude-task-m0.md`; it contained no secrets and required model `claude-sonnet-5`, no commit, no production deployment, and independent validation.
- Blocker: the mandated `/usr/bin/claude -p --model claude-sonnet-5 --permission-mode bypassPermissions --output-format json --max-turns 45 ...` execution returned `BLOCKED: Command timed out without user response. The user has NOT consented to this action. Do NOT retry this command...`.
- Evidence after block: feature branch remained clean with no application diff; `main` was untouched. No implementation, tests, build, deployment, merge, or push occurred.
- Security: no secrets or environment files were created; `.env*.local` is ignored by `.gitignore`; no production or public deployment was attempted.
- Decision: continue Dibayar/M0; no phase transition or pivot requested.
- Next action requiring Chris: provide terminal approval/resolve the Claude Code permission-channel issue, then rerun the exact mandated Claude Code invocation without changing the model or scope.
- Rubric self-score: Evidence honesty 2/2; shipped completeness 2/2 (honest blocked day with exact diagnosis); security discipline 0/2 (review gates could not run); focus 2/2; deploy health 2/2 (justified no-deploy day); report quality 2/2. Total 10/12.

## Day 1 continuation — 2026-07-13 — M0 local checkpoint validated; deployment remains open

- Phase/milestone: Phase 1 — M0 Bootstrap.
- Repository evidence: Git root `/home/kenji/code/dibayar`; branch `hermes/day-001-m0-bootstrap`; remote remained `git@github.com:crh/dibayar.git`; `main` was not changed.
- Commit: `4f531d9 feat(m0): bootstrap Dibayar foundation`; commit was created locally after staged diff review. Push, merge, and deployment were not performed.
- Delegation: `/home/kenji/.local/bin/run-dibayar-claude` ran with the exact `claude-sonnet-5` model. The first real task timed out after 600 seconds with recoverable scaffold changes; a correction task then reached the configured 30-turn limit. Hermes reviewed the resulting files independently.
- Implemented local scope: Next.js/TypeScript/Tailwind/Prisma PostgreSQL scaffold; Bahasa Indonesia coming-soon page; mobile-first design tokens; Vitest/jsdom tests; security headers; synthetic `.env.example`; factual deployment and project instructions.
- Mechanical evidence: `npm install` passed; `npm run lint` passed; `npm run typecheck` passed; `npm test` passed with 2 files and 6 tests; `npm run build` passed with static `/` and `/_not-found` routes.
- Additional evidence: local `next start` returned the expected Bahasa page and CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, and HSTS headers; 390px accessibility snapshot showed readable content, explicit link label, and no observed horizontal overflow.
- Security: staged diff scan found no secrets, unsafe HTML injection, eval, shell execution, or private keys. `.env.local` is absent and ignored. `npm audit --audit-level=high` found no high/critical findings but 5 moderate findings in the Prisma dev chain/PostCSS; remediation remains open.
- Roadmap status: M0 remains incomplete because Vercel project linkage and a deployed Bahasa page are not verified. No preview, production deployment, public launch, or real-user access was attempted.
- Decision: continue M0; do not transition phase or pivot. Commit the validated local checkpoint, then obtain a separate deployment/access decision before deployment.
- Blocker: unrestricted preview protection is unverified; production/public deployment requires Chris approval.
- Rubric self-score: Evidence honesty 2/2; shipped completeness 1/2 (validated feature branch, M0 deployment gate incomplete); security discipline 1/2 (gates run and gaps logged, SECURITY.md controls remain intentionally unchecked); focus 2/2; deploy health 2/2 (green local build and justified no-deploy); report quality 2/2. Total 10/12.

## Day 1 correction — 2026-07-13 — Vercel linkage already exists

- Chris confirmed that the Vercel project already exists at `https://vercel.com/kenji-iwakura/dibayar` and is linked to `https://github.com/crh/dibayar`.
- The current browser session redirected the project URL to Vercel login, so dashboard settings were not independently inspected.
- Decision: remove project import/linkage from the remaining M0 work. Remaining deployment work is to push the feature branch, deploy a Bahasa Preview, verify access protection and live content, and obtain separate approval before any public/Production launch.

## Day 1 deployment evidence — 2026-07-13 — Vercel URL reachable but protected

- Chris provided production URL: `https://dibayar-mgcd6p1j7-kenji-iwakura.vercel.app/`.
- Direct verification: URL returned HTTP 302 to Vercel SSO; browser reached `Log in to Vercel`; Vercel Authentication protection is active.
- Limitation: unauthenticated checks cannot verify the deployed Dibayar title or Bahasa content because the page is behind Vercel Authentication. No claim that the application content is smoke-tested yet.
- Decision: retain protection; complete authenticated browser smoke and verify the deployment/branch mapping before considering M0 deployment evidence complete. Public access still requires Chris approval.
- Repository follow-up: `origin/hermes/day-001-m0-bootstrap` exists at `854a702`; local branch is ahead by one documentation commit (`d6bccbd`); `main` remains unchanged. Vercel source-commit mapping is not independently visible without dashboard authentication.

## Day 1 M0 acceptance — 2026-07-13 — authenticated production smoke confirmed

- Chris confirmed the protected production page loads successfully after Vercel authentication.
- Acceptance evidence: title `Dibayar — Segera Hadir`; Bahasa Indonesia coming-soon content; no default Next.js template; approximately 390px mobile layout verified.
- Decision: mark all M0 Roadmap items complete. Keep Vercel Authentication enabled; do not treat this as public launch or silently start M1.
- Next gate: Chris approval to start M1 Auth + Deal Pipeline and a separate decision on public access.
- Rubric self-score: Evidence honesty 2/2; shipped completeness 1/2 (M0 complete but still scaffold/config scope); security discipline 1/2 (security gaps remain logged); focus 2/2; deploy health 2/2; report quality 2/2. Total 10/12.

## Day 1 M1 continuation — 2026-07-15 — OAuth Preview gate narrowed

- Claude Code/Sonnet implemented a focused Auth.js fix: CSP permits only `https://accounts.google.com` for OAuth form redirects and `https://authjs.dev` for the provider logo; sign-in rate limiting applies to POST attempts only, not sign-in-page GETs or OAuth callbacks.
- Hermes verification: focused regression tests passed; `npm run lint`, `npm run typecheck`, `npm test` (9 files, 30 tests), `npm run build`, and `git diff --check` passed.
- Commit/push/Preview: `a8c0347 fix(auth): allow Google OAuth sign-in flow` was pushed to `hermes/day-001-m0-bootstrap`; a protected redeployment at `dibayar-15tw2d2jd-kenji-iwakura.vercel.app` is Ready and owns the stable branch alias.
- Live browser evidence: Google sign-in reaches `accounts.google.com` with no CSP block or 429 and now receives an OAuth client ID; Google returns `redirect_uri_mismatch` for the Preview callback URL.
- External blocker: add the exact protected Preview callback URL to the Google OAuth client Authorized redirect URIs. Do not complete or claim M1 acceptance until a Google test user authenticates and authenticated deal CRUD smoke passes.
- Security/deployment: no Production deployment, public launch, database migration, credential exposure, or M2 change occurred.

## Day 1 M1 acceptance — 2026-07-15 — protected Preview end-to-end verified

- Google Cloud OAuth configuration: opened the `dibayar` Web application client through the logged-in Chrome MCP session and added only the stable protected Preview callback URI. Save confirmed by Google Cloud console.
- OAuth evidence: protected Preview sign-in reached Google, accepted the callback URI, selected the existing Kenji test account, completed the expected profile/email consent, and returned to `/dashboard` authenticated as Kenji.
- CRUD evidence: created one explicitly labeled disposable smoke deal through the dashboard UI; authenticated API list/read/update/read/delete returned HTTP `200/200/200/200/204`; post-delete read returned `404`; cache-bypassing dashboard reload displayed zero deals.
- Acceptance: all M1 roadmap items are marked complete. M2 remains isolated on `hermes/m2-invoice`; its migration remains unapplied. No Production deployment or public-access change was made.

## Day 1 M2 backend slice — 2026-07-15

- Scope: added local-only invoice creation API with an owned-deal IDR fee snapshot, Jakarta monthly number allocation inside one Prisma transaction, DRAFT status, optional due date, and PPh selection (NONE/PPH21/PPH23); no tax calculation.
- Tests/gates: Prisma validate/generate, lint, typecheck, 78 Vitest tests, production build, diff check, and targeted secret scan passed after rebase onto accepted M1.
- Boundaries: `hermes/m2-invoice` is local-only with no remote tracking branch; migration is unapplied; no Preview/Production deployment, PDF, public link, UI, credential, or public-access change occurred.
- Next gate: review before pushing M2; then implement invoice list/detail and public share/PDF controls separately.

## Day 1 M2 Preview and read API — 2026-07-16

- Preview configuration: verified `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` are encrypted and scoped only to `Preview (hermes/m2-invoice)`; protected Git-based redeploy `dpl_2QRBJqkC795eL4qz8Ag5DH1EQHRS` is Ready at `https://dibayar-e6tjk25st-kenji-iwakura.vercel.app` and owns the stable M2 alias.
- OAuth diagnosis: M2 sign-in page renders; Google callback reaches Auth.js; Vercel runtime log identifies `PrismaClientKnownRequestError: public.Account does not exist`. It is not a Google variable or redirect-URI failure. Later migration preflight established that this runtime target is shared with the Production integration rather than the intended isolated branch.
- Migration boundary: no database migration was applied. The approved migration scope remains restricted to isolated M2 Preview only; Production is untouched.
- Implementation: Claude Code 2.1.197 / Sonnet completed the bounded invoice read API: tenant-scoped `GET /api/invoices`, owned `GET /api/invoices/[id]`, service list/read functions, and cross-tenant no-leak coverage. No schema/migration/env/OAuth/Vercel/UI/PDF/share-link/status mutation/dependency changes were delegated.
- Independent Hermes verification: baseline 78 tests passed; resulting 87 tests passed across 15 files; `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed. The production build includes both invoice routes.
- Git/deployment: invoice-read source changes are intentionally uncommitted and unpushed for review; no post-change deployment occurred.

## Day 1 M2 migration safety stop — 2026-07-16

- Chris approved applying `20260713073000_m1_auth_and_deals` and `20260715090000_m2_invoice_numbering` only to isolated M2 Preview.
- Preflight result: Prisma reports both migrations pending, but a SHA-256 fingerprint comparison of the M2 Preview Neon integration URL and Production Neon integration URL matched. Migration was stopped before any write.
- Root cause: Neon contains an existing separate branch named `preview/hermes/m2-invoice`, but the M2 Vercel deployment is not wired to that branch; its active database endpoint differs from the branch endpoint and matches the Production integration target.
- Required repair gate: explicitly authorize replacing/repointing the M2 Preview branch-scoped `DATABASE_URL` with the existing isolated Neon branch connection, then protected redeploy and repeat the database-isolation check before applying the already approved migrations.

## Day 1 M2 isolated migration and runtime smoke — 2026-07-16

- Chris approved the repair scope: only `Preview (hermes/m2-invoice)` was repointed to the existing `preview/hermes/m2-invoice` Neon branch; Production was not modified.
- Deployment evidence: protected Vercel Preview redeploy `dpl_2QRBJqkC795eL4qz8Ag5DH1EQHRS` completed Ready in 49 seconds from commit `a986072` and owns the stable M2 alias.
- Migration evidence: in Neon SQL Editor explicitly scoped to `preview/hermes/m2-invoice` / `neondb`, an atomic transaction created the Prisma migration ledger, applied the exact approved M1 and M2 migration SQL, and recorded their verified SHA-256 checksums. Result: 36 statements completed successfully in 832 ms. Read-back confirmed both finished migration records and all nine expected Auth.js/deal/invoice tables.
- OAuth evidence: stable M2 Preview Google sign-in completed and reached the authenticated dashboard as Kenji. Isolated branch read-back confirmed one `User` and one `Account`; the prior missing-`Account` failure is resolved.
- Invoice smoke: authenticated `POST /api/deals` returned 201. Authenticated `POST /api/invoices` returned a reproducible 500 after five seconds. Read-back showed the temporary deal existed but no `Invoice` or `InvoiceSequence` row, so the failure occurs within the invoice transaction path before a durable write. The route currently swallows the underlying exception and Vercel logs contain no stack.
- Cleanup: deleted the explicitly labeled temporary deal in the isolated branch. Final temporary deal/invoice/sequence counts were 0/0/0. No Production data, permanent smoke fixture, invoice, or sequence remains.
- Next gate: Chris approval for a bounded Preview-only diagnostic/fix of the invoice transaction failure; do not claim invoice creation as accepted or advance M2 UI work until it passes.

## Day 1 M2 invoice transaction fix and Preview redeploy — 2026-07-16

- Standing scope: Chris granted ongoing approval for code fixes and protected Preview redeployments. Production, public access, credential rotation, and destructive changes remain separately gated.
- Root cause: the lazy `prisma` Proxy returned function-valued properties unbound. `prisma.$transaction()` therefore ran with the Proxy as `this`, rather than the actual `PrismaClient`; normal delegate CRUD calls did not expose the defect.
- Fix: commit `8faadca` (`fix(prisma): bind lazy client methods`) binds methods to the real client and adds a deterministic regression test. Only `src/lib/prisma.ts` and `src/lib/prisma.test.ts` were committed/pushed; the tenant-scoped invoice-read work remains uncommitted/unpushed.
- Quality gates: 88 Vitest tests, lint, typecheck, production build, and diff check passed before commit.
- Deployment: Git-triggered, protected M2 Preview for `8faadca` was Ready in 30 seconds at `https://dibayar-cs2iv63xt-kenji-iwakura.vercel.app`; the stable M2 branch alias remains protected.
- Runtime smoke: authenticated isolated Preview `POST /api/deals` returned 201, then `POST /api/invoices` returned 201 with `INV/2026/07/001` in `DRAFT`.
- Cleanup: the explicit smoke deal and invoice were deleted. A same-statement Postgres snapshot initially preserved the now-unused sequence row; a targeted second delete removed it. Final temporary deal/invoice/sequence counts: 0/0/0. Production was untouched.

## Day 1 M2 tenant-scoped invoice reads and Preview verification — 2026-07-16

- Standing operating model: Chris authorized autonomous milestone execution; choose and execute tasks without prompting, and ask only for a genuine access/decision blocker. Production, public access, credentials, destructive changes, and financial/legal/medical decisions remain separately gated.
- Read/API commit: `9f8c00b` adds authenticated `GET /api/invoices` and `GET /api/invoices/:id`, plus service and route tests. Both paths are tenant-scoped. Detail reads use `findFirst({ where: { id, userId } })`, so a foreign record is never fetched before authorization.
- Adjacent hardening: review found that existing `getOwnedDeal` fetched by ID before comparison. Commit `b8fe0ae` changes it to the same ownership-scoped query and adds a deterministic regression test.
- Quality gates: 90 Vitest tests, lint, typecheck, production build, diff hygiene, manual diff/security scan passed. `npm audit --omit=optional` remains six moderate transitive findings; the offered remediation requires breaking framework/database changes and was not applied. GitHub reported two moderate default-branch alerts; no high/critical alert was reported.
- Deployment: protected Git-triggered M2 Preview for `b8fe0ae` was Ready in 34 seconds at `https://dibayar-8m9gkr5mq-kenji-iwakura.vercel.app`; the stable M2 branch alias remains Vercel-Authentication protected.
- Runtime smoke: authenticated Preview `POST /api/deals` and `POST /api/invoices` returned 201. `GET /api/invoices` returned 200 and included the created invoice; `GET /api/invoices/:id` returned 200 for it; a missing ID returned 404 with `Invoice tidak ditemukan.` The invoice was `INV/2026/07/001` and retained `PPH23`.
- Cleanup: explicitly labeled deal/invoice rows were deleted from `preview/hermes/m2-invoice`. A second targeted sequence cleanup removed the unused monthly sequence. Final temporary deal/invoice/sequence counts: 0/0/0. Production was untouched.

## Day 1 M2 owner invoice hardening — 2026-07-16

- Scope: retained authenticated owner-only invoice list/detail/PDF routes; no recipient-share token, public invoice route, schema change, migration, credential, or Production change was added.
- Controlled failures: invoice list/detail GET routes now convert unexpected auth/database failures into a stable Bahasa `500` response; owner PDF GET converts lookup/render failures into a separate stable `500` response. Internal exception details are not returned.
- Tenant hardening: invoice creation now queries the source deal by `id` and `userId` together, and status updates retain `userId` in both the read and write predicates.
- TDD evidence: three GET error regressions and two tenant-query regressions were observed failing before implementation, then passed after the minimal changes.
- Quality gates: targeted invoice tests passed (39); full Vitest passed (18 files, 105 tests); lint, typecheck, production build, diff check, route inventory, and added-line security scan passed. Build exposes only authenticated invoice routes: `/api/invoices`, `/api/invoices/[id]`, and `/api/invoices/[id]/pdf`.
- Deployment boundary: local hardening is ready for commit/review. Production remains protected and untouched; public invoice access remains blocked pending explicit approval.