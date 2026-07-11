# BACKLOG.md

<!-- Pick 1–3 items per day into STATE.md today_tasks. Prefer finishing one vertical slice.
     Prune stale items every Monday retro. Keep items one line each. -->

## Product / UX
- Deal capture flow wireframe: 60-second target, thumb-reachable, Bahasa microcopy
- Empty-state onboarding: seed one contoh deal so pipeline isn't blank
- Polite WhatsApp follow-up message templates (3 tones: ramah, netral, tegas)

## Frontend
- Pipeline board (mobile-first, horizontal scroll stages)
- Deal form with IDR formatting (1.500.000 style)
- Invoice preview page (public, unguessable URL)

## Backend / Database
- Prisma schema: User, Deal, Invoice, AuditEvent
- Deal CRUD API with zod validation + user scoping
- Invoice number generator (per-user sequential, e.g. INV/2026/07/001)

## Auth / Security
- Auth.js Google provider + session hardening
- Rate limiter middleware (auth + invoice-link routes)
- Secrets scan step in review gate

## Testing
- Unit: deal state transitions; invoice numbering; IDR formatting
- Smoke: sign in → create deal → move stage → generate invoice

## Deployment / Docs
- Vercel env setup doc in DEPLOYMENT.md
- Error tracking: Vercel logs first; Sentry = Chris approval (paid service)

## Users / Validation (Phase 2)
- Recruit 5 creators (Chris network + polite outreach — external contact = Chris approval)
- Feedback log template in DAILY_LOG.md
