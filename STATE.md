# STATE.md — Single Source of Truth

<!-- RULES FOR THIS FILE (Hermes: obey strictly)
1. Read this file FIRST every run. It replaces re-reading the full doc set.
2. Update it at the END of every run.
3. HARD CAP: 120 lines. Overflow gets archived to DAILY_LOG.md, never kept here.
4. decisions_log keeps ONLY the last 3 days. Older entries move to DAILY_LOG.md.
5. Format is key:value / short bullets. No prose paragraphs. No marketing language.
-->

## meta
product_name: Dibayar (working name — rename requires Chris approval)
one_liner: Brand-deal CRM + invoice + payment tracker for Indonesian creators (WhatsApp-first)
phase: 1-build            # 0-discovery | 1-build | 2-validate  (transition = Chris approval)
phase_started: PENDING_DAY1
day_count: 0
repo_url: PENDING_DAY1
prod_url: none
last_deploy: none
build_status: n/a         # green | red | n/a
stack: Next.js + TS + Tailwind + Postgres + Prisma + Auth.js (Google OAuth) + Vercel

## now
current_milestone: M0 — repo bootstrap (see ROADMAP.md)
today_tasks_max_3:
  - (set at start of each run, from BACKLOG.md)
open_blockers: none

## pivot_watch
<!-- A pivot needs 3 dated evidence entries here + explicit Chris approval. Until then: continue. -->
(empty)

## decisions_last_3_days
- 2026-07-07: Phase 0 research completed externally by Chris+Claude; wedge = creator-side
  deal-to-cash workflow. Full rationale in PRODUCT.md. Phase 0 considered CLOSED.

## approvals
pending_from_chris: none
granted_by_chris: none

## metrics (phase 2+ only)
users_shown: 0
feedback_logged: 0
wtp_signals: 0

## next_3_tasks
1. Bootstrap private repo, copy scaffold docs, init Next.js app (M0)
2. Google OAuth sign-in + secure session (M1 start)
3. Deal pipeline data model + CRUD, mobile-first, Bahasa UI (M1)
