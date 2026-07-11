# ROADMAP.md

<!-- Status: [ ] todo  [~] in progress  [x] done. Update status only; don't rewrite scope
     without logging a decision in STATE.md. -->

## M0 — Bootstrap (Day 1)
- [ ] Private GitHub repo created, scaffold docs committed
- [ ] Next.js + TS + Tailwind + Prisma app initialized, builds green
- [ ] Vercel project linked, env vars configured (no secrets in code)
- [ ] Deployed "coming soon" page in Bahasa Indonesia

## M1 — Auth + Deal Pipeline (vertical slice #1)
- [ ] Google OAuth sign-in, secure sessions, rate-limited auth endpoints
- [ ] Deal model: brand, contact(WA), scope, fee_idr, deadline, payment_terms, status
- [ ] Pipeline UI: Masuk → Nego → Deal → Konten → Invoice → Dibayar (mobile-first, Bahasa)
- [ ] Deal capture flow ≤60s on a phone
- [ ] Minimal tests around deal CRUD; audit log for auth events

## M2 — Invoice (vertical slice #2)
- [ ] IDR invoice generation (shareable link + PDF), numbered, PPh 21/23 field
- [ ] Invoice status tracking (sent / due / overdue / paid)

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
