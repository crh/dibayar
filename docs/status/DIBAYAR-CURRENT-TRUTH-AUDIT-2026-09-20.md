# Dibayar — Current Truth Audit

Audit date: 2026-09-20
Audited checkout: `main` at `3473194`
Remote comparison: `origin/main` at `f55b320`
Scope: repository source, Git history, checked-in configuration, status documents, and local engineering gates. No deployment, database, Vercel configuration, or application data was changed.

## Executive verdict

Dibayar is an implemented MVP, not a scaffold. The current `main` source contains the creator deal pipeline, invoice workflow, public invoice documents/PDFs, WhatsApp actions, income summary, bilingual creator UI, settings, security controls, and UX/e2e coverage.

The codebase is locally healthy:

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — pass: 79 files / 766 tests
- `npm run build` — pass: 21 dynamic routes compiled
- `git diff --check` — pass
- `npm audit --omit=dev` — not verified; the environment could not resolve `registry.npmjs.org`

The main problem is operational truth, not compilation. `STATE.md`, `SECURITY.md`, `DEPLOYMENT.md`, and the many receipt files mix historical states with current states. In particular, `STATE.md` still presents `hermes/ux-phase-2` as active and describes Phase 5/6 work as pending even though those commits are ancestors of current `main`.

## 1. Current repository state

### Git

- Current branch: `main`
- Local HEAD: `3473194` — documentation-only clarification of PR #7 verification evidence
- `origin/main`: `f55b320` — merged PR #7, Preview database binding fix
- Local branch is one commit ahead of `origin/main`; the ahead commit adds only `DIBAYAR-PR7-FINAL-PRODUCTION-VERIFICATION-RECEIPT.md`
- Working tree has pre-existing untracked receipt/handoff files and `src/generated/`; these were preserved and not treated as current authority
- `origin/main` includes the UX and invoice work through T-27 via the merged UX history, including T-22, T-23, T-24, T-25, T-26, and T-27-related commits

### Product state

The product definition in `PRODUCT.md` is still coherent:

- Customer: solo Indonesian creators managing brand deals and TikTok Shop affiliate work
- Positioning: creator-side deal CRM + invoice + payment tracker, WhatsApp-first
- Non-goals: marketplace, payment processing/holding funds, automatic earnings sync, agency features, and tax filing
- Validation gate: M4 is not complete; the repository records zero creators shown, zero feedback entries, and zero willingness-to-pay signals

The source implements M0 through the engineering portion of M3. Product validation and monetization remain intentionally unfinished.

## 2. What the current source actually contains

- `/masuk`: bilingual landing/sign-in experience
- `/`: authenticated Beranda dashboard with monthly income, follow-up queue, and nearest deals
- `/deal` and `/deal/[id]`: deal capture, pipeline stages, filtering, stage transitions, detail actions, and WhatsApp contact follow-up
- `/invoice` and `/invoice/[id]`: invoice list/detail, status transitions, due dates, PDF download, share-link lifecycle, and WhatsApp send/chase actions
- `/pengaturan`: issuer/bank identity and WhatsApp template settings
- `/i/[token]`: public invoice document with invalid/expired states and PDF link
- Google OAuth/Auth.js with database sessions and auth-event logging
- Prisma/PostgreSQL schema with 12 migrations
- IDR invoice numbering, PPh 21/23 labels/estimates, Jakarta-aware date and monthly-income logic
- Hash-only bearer-token lookup plus encrypted owner-side token recovery
- Same-origin checks on mutation APIs, Zod input validation, ownership scoping, and in-process rate limits
- CI workflows for lint/typecheck/unit tests, critical E2E, and UX audit

## 3. Deployment truth

### Confirmed from checked-in code

Deployment configuration is now explicit in source:

- `vercel.json` delegates builds to `bash scripts/vercel-build.sh`
- Preview builds require `DATABASE_URL_POSTGRES_URL_NON_POOLING`; they fail closed if it is absent
- Preview runtime requires `DATABASE_URL_POSTGRES_URL`; it does not fall back to the static `DATABASE_URL`
- Production/non-Preview runtime uses `DATABASE_URL`
- Prisma migrations run before the build when a database URL is available

This is the current PR #7 hardening and is covered by Prisma-related unit tests.

### Reported by repository receipts, not independently re-run here

The PR #7 receipts report that:

- PR #7 was merged as `f55b320`
- Production deployment `dpl_FgjjknFDq5zWvcb9pudJQUb7xi1q` was built from that commit
- Production build and migrations completed successfully
- Unauthenticated production smoke checks passed
- Chris manually confirmed authenticated Google sign-in and dashboard loading

Those claims are internally supported by the later post-merge/final receipts, but this audit did not contact the live production URL or inspect Vercel directly.

### Deployment decision still open

The repository’s most recent hardening notes report that `https://dibayar.vercel.app` is reachable at the Vercel edge without a Vercel SSO wall and then redirects through the application’s own Auth.js flow. That is not equivalent to an approved public launch. The explicit decision that this edge/public-access state is intended is still recorded as pending.

The public invoice route exists in source, but production recipient access, public-link abuse controls, and the intended deployment-protection policy should be confirmed together before sharing links with real recipients.

## 4. Documentation findings

### High priority: `STATE.md` is stale as a current-status file

It currently says:

- active branch is `hermes/ux-phase-2`
- Phase 5 acknowledgement and T-27 remain pending
- the last relevant deployment is the August 25 Preview

Those statements describe an earlier state. Current Git history shows the UX work is already in `main`, and current `main` has the September PR #7 deployment-hardening changes.

### High priority: deployment/access statements are contradictory across receipts

Older receipts say PR #7 was not merged or Production was untouched. Later receipts prove the opposite: PR #7 is merged at `f55b320` and has a reported Production deployment. The older receipts should remain labelled historical, but should not be used as current status.

### Medium priority: `SECURITY.md` is mostly historical

It still contains pre-M3 statements such as WhatsApp/income functionality not existing and Production being untouched. Its control inventory remains useful, but its open/closed labels should be re-audited against the current source and current deployment state.

### Medium priority: cron guard assumptions are obsolete

`scripts/cron-guard.mjs` defaults to `hermes/m2-invoice` and expects a historical `DAILY_LOG.md` workflow. That is not aligned with the current `main` integration branch. It is harmless while unused, but unsafe as an unattended automation entrypoint until its branch/state assumptions are updated.

### Medium priority: no canonical README/current-status entrypoint

This audit initially found no repository README. A concise navigation README was added during this follow-up. Product, roadmap, deployment, security, UX, and incident information is still distributed across many documents, including numerous untracked receipts; the README now points readers to the canonical files and labels receipts as historical evidence.

### Documentation inventory disposition

- Keep as canonical: `README.md`, `PRODUCT.md`, `ROADMAP.md`, `STATE.md`, `BACKLOG.md`, `DEPLOYMENT.md`, and `SECURITY.md`.
- Keep as historical evidence for now: `DAILY_LOG.md`, the tracked deployment/security/UX receipts, and the phase evidence under `docs/ux-implementation/evidence/`.
- Archived reversibly during follow-up: four superseded standalone receipts now live under `docs/receipts/archive/` with an index explaining why.
- Review for stale instructions, not deletion: `CLAUDE.md`, `.hermes.md`, `docs/ux-implementation/SECURITY_REVIEW.md`, and `scripts/cron-guard.mjs` assumptions.
- Do not delete blindly: the remaining untracked receipt files may contain the only record of recent production and Preview verification. They still need owner review before any removal.

## 5. Recommended decisions and next actions

1. Confirm whether production’s no-Vercel-SSO edge reachability is intentional. If yes, explicitly accept the public-recipient threat model; if no, restore the intended deployment protection before real launch.
2. Treat `main` as the engineering source of truth and close the stale Phase 5/6/T-27 language in status documentation.
3. Re-run the security/dependency audit from a network-enabled environment and verify current Vercel production state directly.
4. Complete M4 with at least five Indonesian creator sessions before building monetization.
5. Decide the provisional product rules: 7-day due-soon window, 90-day share lifetime, and invoice-issue-date basis for monthly income.
6. Either update or retire the historical cron guard; do not use it for unattended work in its current default-branch configuration.

## Evidence reviewed

- `PRODUCT.md`, `ROADMAP.md`, `STATE.md`, `SECURITY.md`, `DEPLOYMENT.md`
- `package.json`, `vercel.json`, `scripts/vercel-build.sh`, `scripts/smoke-deployment.mjs`, `scripts/cron-guard.mjs`
- `prisma/schema.prisma` and all 12 migrations
- `src/app`, `src/components`, `src/lib`, `e2e`, `tests/ux-audit`
- `.github/workflows/e2e.yml` and `.github/workflows/update-visual-baselines.yml`
- Git history and refs through `origin/main` at `f55b320`
