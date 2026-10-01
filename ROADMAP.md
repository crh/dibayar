# ROADMAP.md

<!-- Status: [ ] todo  [~] in progress  [x] done. Update status only; don't rewrite scope
     without logging a decision in STATE.md. -->

## M0 — Bootstrap (Day 1)
- [x] Private GitHub repo created, scaffold docs committed
- [x] Next.js + TS + Tailwind + Prisma app initialized, builds green
- [x] Vercel project linked; no M0 environment variables required (no secrets in code)
- [x] Deployed "coming soon" page in Bahasa Indonesia; authenticated mobile smoke confirmed

## M1 — Auth + Deal Pipeline (vertical slice #1)
- [x] Google OAuth sign-in, database sessions, rate-limited auth endpoints (protected Preview live sign-in verified)
- [x] Deal model: brand, contact(WA), scope, fee_idr, deadline, payment_terms, status
- [x] Pipeline UI: Masuk → Nego → Deal → Konten → Invoice → Dibayar (mobile-first, Bahasa)
- [x] Deal capture flow ≤60s on a phone (protected Preview create/read/update/delete smoke verified)
- [x] Minimal tests around deal CRUD; audit log for auth events

## M2 — Invoice (vertical slice #2) — ACCEPTED 2026-07-18
- [x] IDR invoice generation (shareable link + PDF), numbered, PPh 21/23 field — recipient share-link (hash-only revocable token, owner lifecycle API/UI, public safe-field routes) committed (`85a4f6a`), hardened (`5064e70`), pushed, isolated Preview migration `20260717090000_invoice_share` applied, protected Preview deployed READY, Chrome E2E verified (create/regenerate/revoke, public JSON/PDF, old/new-token 404 invalidation). Production deployment and public/non-SSO recipient access remain separate, still-pending Chris decisions.
- [x] Invoice status tracking (sent / due / overdue / paid) — dashboard stage-transition control committed/pushed/deployed and Chrome E2E verified alongside the above

## M3 — Payment Chasing (vertical slice #3)
- [x] Due-date reminders (in-app first; email if cheap) — Jakarta-aware overdue/due-soon dashboard surface; email intentionally not built
- [x] One-tap WhatsApp follow-up: prefilled polite Bahasa message via wa.me link — owner-only contact fetch, normalized numbers, encoded share URL
- [x] Monthly income summary view — Jakarta month boundary, gross/estimated PPh/net arithmetic; basis is `Invoice.createdAt` (no issue-date field), provisional — see `docs/validation/M4-READINESS.md` §2

## M4 — Validation Gate  ⛔ Chris approval to pass
- [ ] Product shown to ≥5 real Indonesian creators; feedback logged in DAILY_LOG.md
- [ ] Decision: proceed to monetization / iterate / pivot-case

## M5 — Monetization Test (Phase 2)
- [ ] Free-tier limits + Pro waitlist or pre-order (payments integration = Chris approval)
- [ ] WTP evidence: ≥3 creators state or show willingness to pay

## MVP Definition of Done = M0–M4 complete + security baseline in SECURITY.md all [x]
