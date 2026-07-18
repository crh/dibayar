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

## M2 — Invoice (vertical slice #2)
- [~] IDR invoice generation (shareable link + PDF), numbered, PPh 21/23 field — recipient share-link (Task F) is locally implemented and uncommitted (hash-only revocable token, owner lifecycle API/UI, public safe-field routes); migration `20260717090000_invoice_share` generated but NOT applied; item stays `[~]` pending isolated Preview migration apply + protected Preview deployment/runtime verification, then a separate Production/public-access decision
- [~] Invoice status tracking (sent / due / overdue / paid)

## M3 — Payment Chasing (vertical slice #3)
- [ ] Due-date reminders (in-app first; email if cheap)
- [ ] One-tap WhatsApp follow-up: prefilled polite Bahasa message via wa.me link
- [ ] Monthly income summary view

## M4 — Validation Gate  ⛔ Chris approval to pass
- [ ] Product shown to ≥5 real Indonesian creators; feedback logged in DAILY_LOG.md
- [ ] Decision: proceed to monetization / iterate / pivot-case

## M5 — Monetization Test (Phase 2)
- [ ] Free-tier limits + Pro waitlist or pre-order (payments integration = Chris approval)
- [ ] WTP evidence: ≥3 creators state or show willingness to pay

## MVP Definition of Done = M0–M4 complete + security baseline in SECURITY.md all [x]
