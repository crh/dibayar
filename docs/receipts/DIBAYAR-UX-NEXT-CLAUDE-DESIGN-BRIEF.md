# Dibayar — Claude Design Review Brief

Give Claude Design this file plus the `artifacts/ux-review-next/` folder (screenshots + `JOURNEY-MATRIX.md` + `OBSERVATIONS.md`). This is a manual hand-off — Claude Design is not programmatically connected to this Claude Code session.

## Product context

Dibayar is a lightweight back office for Indonesian creators (solo, roughly 5k–500k followers) to manage brand deals, deliverables, invoices, and payments — instead of juggling WhatsApp, spreadsheets, and manual follow-ups. Mobile-first (390px primary), Bahasa Indonesia default UI, IDR invoicing with basic PPh 21/23 withholding-tax awareness. It does not process/hold payments, file taxes, discover brands, or support agencies/multi-creator teams.

The core loop: capture a deal → move it through a pipeline (Masuk → Nego → Deal → Konten → Invoice → Dibayar) → invoice it → chase payment via WhatsApp → get paid. The product's whole value proposition is making it obvious, at every point in that loop, **what needs attention, what needs to be delivered, what needs to be invoiced, what's been paid, and what to do next.**

## Review goal

Identify the highest-value UX improvements — not a cosmetic redesign. We specifically want your read on **workflow continuity and next-action clarity**: does the app make it obvious what a creator should do next, at every step, without them having to remember where an action lives or hunt for it?

## Review dimensions

- Clarity of next action
- Creator cognitive load
- Status visibility (deal stage, invoice payment status, deadline lateness)
- Information hierarchy
- Workflow continuity (Beranda → Deal → Invoice → follow-up)
- Trust (does the creator believe the action they took actually happened?)
- Action feedback (success/failure, and what to do next)
- Mobile usability (390px is primary)
- Indonesian creator context / language
- Consistency across the four core screens

## Constraints

- Preserve Dibayar's lightweight nature — do not turn this into a CRM/ERP.
- Prefer simplification over adding controls.
- Reuse the existing design language (warm cream/terracotta palette, card-based layout, pill badges) unless a change materially improves usability.
- Do not redesign everything — the existing IA (Beranda, Deal board, Invoice list, Pengaturan, public `/i/[token]`) is deliberate and should be preserved.
- Prioritize changes that help creators get paid and avoid missed deliverables over anything else.

## What we already found (so you can go deeper, not re-discover this)

See `artifacts/ux-review-next/OBSERVATIONS.md` for the full factual list. Headline items:

1. The action that actually creates an invoice document exists in exactly one place — a board card's overflow "⋮" menu — and is absent from the deal's own detail page. A separate, always-visible top-bar button is *labeled* "Buat invoice" but doesn't create one (it just filters the board).
2. After creating an invoice, there's no link forward to it — just a generic toast.
3. Overdue invoices get a visually distinct "Telat N hari" treatment on Beranda; overdue *deliverables* (deals whose deadline has passed but haven't been invoiced yet) get none, anywhere, including on their own detail page.
4. A deal's own detail page has no stage-transition action either — same "board-card-menu-only" pattern as invoice creation.
5. Invoice-creation failures all surface identical, non-diagnostic error copy regardless of actual cause.
6. Mobile: the floating "+" button overlaps the last card in Beranda's "3 deal terdekat" list, obscuring its amount and stage badge.

## Requested output

For each finding (yours and, if you agree with them, ours):

1. Top 10 UX findings, ranked.
2. Severity / impact.
3. Evidence screenshot reference (from `artifacts/ux-review-next/screenshots/`).
4. Recommended change.
5. Expected user benefit.
6. Effort tier: quick win / medium effort / structural.
7. A proposed improved flow for the single highest-impact issue (sketch/description is fine — no need for pixel-perfect mockups).
8. A specific recommendation for **the one best implementation batch** — small, coherent, shippable — that we should build next.

Do not claim this brief represents Claude Design's own approval or sign-off on anything — that only happens when Chris actually runs this brief through Claude Design and brings the response back.
