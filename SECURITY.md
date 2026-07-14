# SECURITY.md

<!-- Every control gets a status. Flipping to [x] requires the check actually verified,
     not just code written. Reviewed as part of REVIEW_CHECKLIST.md gate C. -->

## Auth & Sessions
- [~] Google OAuth via Auth.js; no password storage (implemented; real provider credentials pending)
- [~] Secure session cookies (Auth.js database-session defaults configured; live cookie inspection pending)
- [~] Rate limiting on auth-sensitive endpoints (10 requests/minute in-process; route-boundary smoke verified; distributed limiter not yet needed)
- [ ] MFA design documented (TOTP/passkeys) — implementation post-MVP
- [~] Audit log: sign-in, sign-out, account changes (implemented; live database write pending)

## Application
- [x] Input validation on all deal API routes (Zod)
- [ ] Output escaping / no dangerouslySetInnerHTML without sanitization
- [~] CSRF protection where relevant (Auth.js protections configured; deal mutation review pending)
- [~] Security headers (CSP, X-Frame-Options, HSTS verified locally; Vercel behavior pending)
- [x] Authorization: every deal query scoped to session user id

## Secrets & Infra
- [x] Zero secrets in current source/diff (pattern scan; history review remains per-commit)
- [ ] Env vars in Vercel only, least privilege
- [ ] Repo private
- [ ] `npm audit` / dependency check run weekly (Monday retro); highs fixed or logged

## Abuse & Data
- [ ] Basic abuse prevention on public invoice links (unguessable ids, optional expiry)
- [ ] Personal data minimization: store only what invoicing requires
- [ ] No payment processing / fund holding (out of scope; Chris approval gate)

## Known gaps (honest list, newest first)
- 2026-07-13: M0 security headers are configured and verified against the local Next.js server, but Vercel deployment/HSTS behavior is not verified; the security-header control remains unchecked.
- 2026-07-14: M1 local gates passed: 21 tests, lint, typecheck, build; route-boundary auth rate-limit smoke returned 429 on request 11. Real Google/Postgres environment and protected-preview smoke remain pending.
- 2026-07-14: `npm audit --omit=optional` reports 6 moderate vulnerabilities in the Prisma development dependency chain and PostCSS; no high/critical findings were reported. Compatible remediation is pending and `npm audit fix --force` is not approved because it proposes breaking changes.
