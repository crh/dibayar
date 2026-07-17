# SECURITY.md

<!-- Every control gets a status. Flipping to [x] requires the check actually verified,
     not just code written. Reviewed as part of REVIEW_CHECKLIST.md gate C. -->

## Auth & Sessions
- [x] Google OAuth via Auth.js; no password storage — real test-user login verified (DAILY_LOG "Day 1 M1 acceptance — 2026-07-15": Google sign-in reached Google, accepted the callback, and authenticated the Kenji test account to `/dashboard`)
- [~] Secure session cookies (Auth.js database-session defaults configured; live cookie inspection pending)
- [~] Rate limiting on auth-sensitive endpoints (10 requests/minute in-process; route-boundary smoke verified; distributed limiter not yet needed)
- [ ] MFA design documented (TOTP/passkeys) — implementation post-MVP
- [x] Audit log: sign-in, sign-out, account changes — live authenticated write verified (DAILY_LOG "Day 1 M1 acceptance — 2026-07-15" produced the sign-in event; a read-only Neon SQL Editor query run 2026-07-17 against branch `preview/hermes/m2-invoice`, database `neondb` — `SELECT COUNT(*)::int AS sign_in_events, MAX("createdAt") AS latest_sign_in_at FROM "AuthEvent" WHERE "type" = 'SIGN_IN';` — read back `sign_in_events=1`, `latest_sign_in_at=2026-07-16 01:56:09.367`; see DAILY_LOG "Day 1 Task A — evidence-chain repair — 2026-07-17")

## Application
- [x] Input validation on all deal API routes (Zod)
- [ ] Output escaping / no dangerouslySetInnerHTML without sanitization
- [~] CSRF protection where relevant (Auth.js protections configured; deal mutation review pending)
- [~] Security headers (CSP, X-Frame-Options, HSTS verified locally; Vercel behavior pending)
- [x] Authorization: every deal query scoped to session user id

## Secrets & Infra
- [x] Zero secrets in current source/diff (pattern scan; history review remains per-commit)
- [x] Env vars in Vercel only, least privilege — `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` confirmed encrypted and scoped only to `Preview (hermes/m2-invoice)` (DAILY_LOG "Day 1 M2 Preview and read API — 2026-07-16"); isolated Neon branch repointing verified (DAILY_LOG "Day 1 M2 isolated migration and runtime smoke — 2026-07-16")
- [x] Repo private — verified 2026-07-17 via `gh repo view crh/dibayar --json visibility,isPrivate,url` → `PRIVATE` / `isPrivate: true` (DAILY_LOG "Day 1 Task A — evidence-chain repair — 2026-07-17"); this is a point-in-time check today, not a claim that every historical Gate B run independently confirmed repo privacy
- [ ] `npm audit` / dependency check run weekly (Monday retro); highs fixed or logged

## Abuse & Data
- [ ] Basic abuse prevention on public invoice links (unguessable ids, optional expiry)
- [ ] Personal data minimization: store only what invoicing requires
- [ ] No payment processing / fund holding (out of scope; Chris approval gate)

## Known gaps (honest list, newest first)
- 2026-07-17: Task C migration apply to isolated Preview (DAILY_LOG "Day 1 Task C migration, protected Preview smoke, and cleanup — 2026-07-17"): the pre-write SHA-256 fingerprint gate correctly confirmed the write target was isolated from Production before any change was made, and cleanup verified 0 leftover records. One limited exposure: Prisma's first `migrate status` banner line surfaced the Preview pooler *hostname only* (no password, no full connection URL, no other credential value) inside the internal execution trace. That hostname was never returned to Chris, never printed to any user-facing report, and never committed. No remediation is required beyond this disclosure; noted so it isn't silently dropped from the record.
- 2026-07-13: M0 security headers are configured and verified against the local Next.js server, but Vercel deployment/HSTS behavior is not verified; the security-header control remains unchecked.
- 2026-07-14: M1 local gates passed: 21 tests, typecheck, build; Preview migration applied; protected Preview root/session/providers/deals checks passed; Google POST preflight reaches accounts.google.com. Real test-user login and authenticated CRUD smoke remain pending. (Resolved 2026-07-15 — see DAILY_LOG "Day 1 M1 acceptance — 2026-07-15": real test-user login and authenticated CRUD smoke both verified.)
- 2026-07-14: `npm audit --omit=optional` reports 6 moderate vulnerabilities in the Prisma development dependency chain and PostCSS; no high/critical findings were reported. Compatible remediation is pending and `npm audit fix --force` is not approved because it proposes breaking changes.
- 2026-07-17: Task A evidence-chain repair (DAILY_LOG "Day 1 Task A — evidence-chain repair — 2026-07-17") verified OAuth real test-user login, Vercel env-var scoping, repo privacy, and live authenticated audit-log write above. Still open, honestly: secure session cookie live inspection; distributed rate limiting (not yet needed at current scale); MFA design (TOTP/passkeys, post-MVP, TBD); output escaping / `dangerouslySetInnerHTML` review; CSRF review of deal mutations; Vercel-hosted CSP/HSTS behavior verification; weekly `npm audit` cadence and the 6 moderate findings above; public-invoice abuse prevention and expiry (blocked on Chris's public-access decision); personal-data minimization review.
