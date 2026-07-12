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

Current status: the repository contains planning and process documentation only; application source, package manifests, Prisma schema, and deployment configuration are not present yet. Treat those details as `TBD` until implemented and verified.

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
- `DEPLOYMENT.md` — currently an empty placeholder; workflow is `TBD`
- `BACKLOG.md` and `DAILY_LOG.md` — project work tracking

Application directories: `TBD`.

## Development commands

No package manifest or executable application exists in the repository yet. Until the scaffold is added, development commands are `TBD`.

Expected commands after the application scaffold exists, subject to verification from its package scripts:

- Install dependencies: `npm install`
- Development server: `TBD`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Production build: `npm run build`

Do not claim any command works until it has been run against the current repository.

## Testing commands

Testing framework and test directory: `TBD`. Once package scripts exist, run the repository's actual test command plus relevant focused tests. Behavioral changes require added or updated tests.

## Coding conventions

- Use TypeScript and existing repository patterns once established.
- Follow `DESIGN.md`: mobile-first, primary target width 390px, touch targets at least 44px, visible focus, reduced-motion support, and natural Bahasa Indonesia for user-facing copy.
- Format money as IDR with dot thousands separators and no decimals, for example `Rp1.500.000`.
- Keep user-facing actions explicit; avoid generic labels such as `Submit`.
- Prefer small, reviewable changes and avoid unrelated refactors.
- Use the existing lint, formatting, typecheck, and test configuration once created; configuration details are currently `TBD`.

## Authentication and authorization design

Planned design verified from `STATE.md`, `PRODUCT.md`, and `SECURITY.md`: Auth.js with Google OAuth and no password storage. Sessions must use secure cookies (`httpOnly`, `secure`, `sameSite`), authentication-sensitive endpoints need rate limiting, and auth events should be auditable. Every query and route must be authorized and scoped to the authenticated user's ID. MFA is post-MVP and its design is `TBD`.

## Database and migration process

Planned database: PostgreSQL accessed through Prisma. Schema location, migration commands, seed strategy, backup/rollback procedure, and local database setup are currently `TBD`. Never modify production data or run production migrations unless the task explicitly requires it and the required approval is present. All tenant/user-owned records must be scoped to the authenticated user.

## Deployment workflow

Deployment target is Vercel, verified from `STATE.md`. The workflow, project linkage, environment-variable names, preview process, production release process, rollback procedure, and CI/CD configuration are currently `TBD`. Secrets belong in the deployment environment, never in source control.

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
