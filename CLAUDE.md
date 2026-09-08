# CLAUDE.md — Dibayar Project Instructions

## Product purpose

Dibayar is a mobile-first, Bahasa Indonesia web app for Indonesian solo micro/mid-tier creators (approximately 5k–500k followers) to manage brand deals from negotiation through payment. The MVP covers deal capture, a deal pipeline, IDR invoicing with PPh 21/23 awareness, payment reminders, WhatsApp follow-up links, and monthly income tracking. It does not process or hold payments, file taxes, discover brands, or support agency multi-creator workflows.

## Architecture and technology stack

Verified from `STATE.md` and the repository planning documents:

- Next.js + TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Auth.js with Google OAuth
- Vercel deployment target

Current status: UX implementation Phase 0 foundations T-00 through T-03 are accepted on local branch `hermes/ux-phase-0`. T-00 fixture-backed evidence, T-01 locale/formatters and default-only migration, T-02 breakpoint/Grid primitives, and T-03 route scaffolding/redirects passed independent review and local gates. No Preview or Production deployment/public-access change occurred; T-04 is next.

**This paragraph describes a much earlier point in the project's history and is stale relative to `main` (UX phases through T-27, a Playwright E2E suite, and PR #2's v6.1 account-menu fix have since merged).** It was not rewritten as part of the 2026-09-06 production-hardening audit — that audit's scope was Preview/Production deployment-state accuracy, not the UX phase-tracking narrative, which is Hermes/`STATE.md`-owned. For current, independently-verified Preview/Production state, do not rely on this file — see `DEPLOYMENT.md`'s "Current verified state" section, which supersedes any Preview/Production claim here or in `STATE.md`.

## Repository structure

Verified top-level documents:

- `STATE.md` — current project state and next tasks
- `PRODUCT.md` — product scope, target customer, MVP, and non-goals
- `DESIGN.md` — authoritative mobile-first visual and UX rules
- `ROADMAP.md` — milestones and definition of done
- `SECURITY.md` — security controls and known gaps
- `REVIEW_CHECKLIST.md` — pre-commit validation gates
- `CLAUDE_TASK_TEMPLATE.md` — implementation-task delegation contract
- `REPORT_RUBRIC.md` — reporting expectations
- `DEPLOYMENT.md` — local verification and deployment approval boundaries
- `BACKLOG.md` and `DAILY_LOG.md` — project work tracking

## Hermes multi-agent roles

The Dibayar workflow uses three explicitly separated roles. Read `docs/ux-implementation/HERMES_CONTROLLER.md` before continuing autonomous work and `docs/ux-implementation/AGENT_ROLES.md` for the role contract.

- **Luna** — Hermes default-profile orchestrator (`gpt-5.6-luna`); recovers state, delegates, independently verifies, manages evidence/Git, and controls approval boundaries.
- **Klaus** — Claude Code implementation worker invoked by `/home/kenji/.local/bin/run-dibayar-claude`; default `CLAUDE_MAX_TURNS=100`; implements only the bounded packet and reports exact evidence; does not approve architecture or phase gates.
- **Archie** — Hermes `archie` profile using the exact supported model `gpt-5.6-sol`; independent read-only-by-policy architect/reviewer; returns the structured ARCHIE REVIEW verdict and recommends corrections for Klaus rather than editing them.

Luna remains the main orchestrator. Worker reports are evidence and do not override independent verification or approval gates.


Application directories:

- `src/app/` — Next.js App Router page, layout, global styles, and M0 tests
- `prisma/` — PostgreSQL datasource and Prisma generator configuration
- `src/generated/prisma/` — generated Prisma client output; ignored by Git

## Development commands

Verified local commands from `package.json`:

- Install dependencies: `npm install`
- Development server: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Production build: `npm run build`

Do not claim any command works until it has been run against the current repository.

## Testing commands

The M0/T-00 test foundation uses Vitest with jsdom and Testing Library. Tests live beside source files under `src/**/*.test.ts` and `src/**/*.test.tsx`. Behavioral changes require added or updated tests.

Real-browser journey/E2E coverage lives under `e2e/` (Playwright, `playwright.e2e.config.ts`) -- see `docs/testing/E2E.md`. This is separate from `tests/ux-audit/` (the visual/detector audit harness) and from the Vitest suite above; it exists specifically to catch bugs in the interaction between App Router navigation, `window.history`, `useSearchParams`, and client component state, which unit/component tests cannot see. Any change affecting navigation, URL/search params, multi-step workflows, authentication, or other cross-component user behavior must add or update the corresponding Playwright journey test. A regression discovered during independent review should normally become a permanent automated regression test (in `e2e/`, or `tests/ux-audit/` if it's a visual/layout regression) before the replacement candidate is promoted.

## Coding conventions

- Use TypeScript and existing repository patterns once established.
- Follow `DESIGN.md`: mobile-first, primary target width 390px, touch targets at least 44px, visible focus, reduced-motion support, and natural Bahasa Indonesia for user-facing copy.
- Format money as IDR with dot thousands separators, no decimals, and the specified non-breaking space after `Rp`, for example `Rp 1.500.000`.
- Keep user-facing actions explicit; avoid generic labels such as `Submit`.
- Prefer small, reviewable changes and avoid unrelated refactors.
- Use the checked-in ESLint, TypeScript, Vitest, Playwright, and Prisma configuration; run the relevant gates for each task.

## Authentication and authorization design

Planned design verified from `STATE.md`, `PRODUCT.md`, and `SECURITY.md`: Auth.js with Google OAuth and no password storage. Sessions must use secure cookies (`httpOnly`, `secure`, `sameSite`), authentication-sensitive endpoints need rate limiting, and auth events should be auditable. Every query and route must be authorized and scoped to the authenticated user's ID. MFA is post-MVP and its design is `TBD`.

## Database and migration process

Verified database process: use the approved disposable local PostgreSQL target only (`127.0.0.1:55432/dibayar_test`) with credentials from the protected test environment; never invoke Docker/Compose or expose credentials. Prisma schema/migration and fixture procedures are documented under `docs/ux-implementation/`. Never modify production data or run production migrations without explicit scope and approval. All tenant/user-owned records remain scoped to the authenticated user.

## Deployment workflow

Deployment target is Vercel and project linkage is confirmed in `STATE.md`. Phase 0 was verified locally only; Preview is currently non-isolated from Production, so no Preview migration/capture or Production/public release is authorized. Follow `DEPLOYMENT.md`; secrets belong in the deployment environment, never in source control.

**This is stale as of 2026-09-06.** Production has since been migrated (all 12 checked-in migrations applied) and its auth secrets configured, following a real post-merge incident on 2026-09-06 documented in `DIBAYAR-V6-1-POST-MERGE-PRODUCTION-HANDOFF.md`; Production is also currently reachable at the Vercel edge without an SSO gate (verified by unauthenticated `curl`, not merely inferred), which was never a deliberate public-launch decision — see `DEPLOYMENT.md`'s "Current verified state" and "Production release gate" sections for what is actually true now and what remains an open Chris decision. Do not treat "no Production/public release is authorized" as still accurate without re-checking that section first.

## Security requirements

- Validate all API inputs with Zod or an equivalent verified validation library.
- Escape outputs; do not use `dangerouslySetInnerHTML` without sanitization.
- Apply CSRF protection where relevant for non-GET state changes.
- Configure security headers including CSP, X-Frame-Options, and HSTS as appropriate.
- Scope every query and route to the authenticated session user.
- Keep public invoice identifiers unguessable and support expiry where required.
- Minimize stored personal data.
- Do not implement payment processing or fund holding in the MVP.
- Never expose, print, commit, or log secrets, credentials, tokens, or `.env` contents.
- Run dependency/security checks when applicable and record unresolved high-severity findings.

## Definition of done

A change is done only when its acceptance criteria are verified, relevant tests are added or updated, lint/typecheck/tests/build pass, the diff contains no secrets or unrelated changes, security and tenant-isolation behavior has been reviewed, and the result is checked at the 390px mobile target where UI is involved. The MVP definition of done is M0–M4 complete and the security baseline in `SECURITY.md` fully checked, subject to Chris's approval gates.

## Autonomous Development Rules

- Work only inside `/home/kenji/code/dibayar` unless explicitly instructed otherwise.
- Do not ask for approval before routine development operations.
- Inspect existing code and conventions before making changes.
- Reuse existing project patterns.
- Never expose, print, or commit secrets.
- Never overwrite `.env` or credential files.
- Add or update tests for behavioral changes.
- Run relevant tests, linting, type checks, and builds.
- Do not claim completion while required checks are failing.
- Report changed files, validation results, risks, and unfinished work.
- Do not force-push or rewrite shared Git history.
- Do not deploy to production or modify production data unless the task explicitly requires it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
