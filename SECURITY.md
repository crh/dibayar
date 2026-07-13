# SECURITY.md

<!-- Every control gets a status. Flipping to [x] requires the check actually verified,
     not just code written. Reviewed as part of REVIEW_CHECKLIST.md gate C. -->

## Auth & Sessions
- [ ] Google OAuth via Auth.js; no password storage
- [ ] Secure session cookies (httpOnly, secure, sameSite)
- [ ] Rate limiting on auth-sensitive endpoints
- [ ] MFA design documented (TOTP/passkeys) — implementation post-MVP
- [ ] Audit log: sign-in, sign-out, account changes

## Application
- [ ] Input validation on all API routes (zod or equivalent)
- [ ] Output escaping / no dangerouslySetInnerHTML without sanitization
- [ ] CSRF protection where relevant (non-GET state changes)
- [ ] Security headers (CSP, X-Frame-Options, HSTS via Vercel config)
- [ ] Authorization: every deal/invoice query scoped to session user id

## Secrets & Infra
- [ ] Zero secrets in source or git history (verified by scan, every commit)
- [ ] Env vars in Vercel only, least privilege
- [ ] Repo private
- [ ] `npm audit` / dependency check run weekly (Monday retro); highs fixed or logged

## Abuse & Data
- [ ] Basic abuse prevention on public invoice links (unguessable ids, optional expiry)
- [ ] Personal data minimization: store only what invoicing requires
- [ ] No payment processing / fund holding (out of scope; Chris approval gate)

## Known gaps (honest list, newest first)
- 2026-07-13: M0 security headers are configured and verified against the local Next.js server, but Vercel deployment/HSTS behavior is not verified; the security-header control remains unchecked.
- 2026-07-13: `npm audit` reports 5 moderate vulnerabilities in the Prisma development dependency chain and PostCSS; no high/critical findings were reported. Compatible remediation is pending and `npm audit fix --force` is not approved because it proposes breaking changes.
