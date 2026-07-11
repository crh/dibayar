# PRODUCT.md — Dibayar (working name)

<!-- Read only when making product decisions. STATE.md carries daily status. -->

## target_customer
Indonesian micro/mid-tier creators (5k–500k followers) doing brand deals and TikTok Shop
affiliate work SOLO (no agency). They negotiate in WhatsApp/Instagram DMs, invoice ad hoc,
and chase payments manually.

## core_pain (from Phase 0 research, 2026-07-07)
1. Late/lost payments: 55% of influencers refuse repeat work with late-paying brands
   (slice.id). Creators have zero tooling to track who owes what and when.
2. Invoice + tax burden: formal invoices required to be taken seriously; PPh 21 vs PPh 23
   classification; Rp100k fine for late SPT + interest penalties; even barter endorsements
   taxable (online-pajak.com, klikpajak.id, tax.biz.id).
3. Deal chaos in chat: even SociaBuzz hands off execution to WhatsApp/email. Scope,
   deliverables, revisions, payment terms live in chat scroll (sociabuzz.com FAQ).
4. Fragmented income: TikTok affiliate + FB monetization (1.7M Bahasa accounts,
   restofworld.org) + brand deals + Lynk.id products + Saweria. No consolidated view;
   painful at tax time.
5. Affiliate commission opacity: mass "komisi 0" complaints on TikTok Shop
   (indonewstoday.com, komunitasmea.web.id).

## solution (MVP)
Mobile-first web app, Bahasa Indonesia, where a creator:
1. Logs a deal from a DM in <60 seconds (brand, scope, fee IDR, deadline, payment terms)
2. Tracks pipeline: Masuk → Nego → Deal → Konten → Invoice → DIBAYAR
3. Generates a professional IDR invoice (PDF/link) with PPh 21/23 field awareness
4. Gets payment due-date reminders; one-tap WhatsApp follow-up message (pre-written, polite)
5. Sees running income total per month (tax-season friendly export = v2)

## why_now
Performance-based/hybrid deals now standard in Indonesia (contentgrip.com) → more deals,
smaller fees, more admin per rupiah earned. Creator tooling boom is storefront-side
(Lynk.id) and brand-side (Slice, Influence ID); creator back office is empty.

## differentiation
Creator-side (not brand-side like Slice/Influence ID). Workflow tool (not marketplace like
SociaBuzz, not storefront like Lynk.id). Indonesia-first: IDR, Bahasa, PPh awareness,
WhatsApp share/follow-up as a first-class action, QRIS-era payment expectations.

## monetization_hypothesis [UNVERIFIED — Phase 2 job]
Freemium: free = 3 active deals; Pro IDR 29–79k/month = unlimited deals, invoice branding,
reminders, income export. Anchor: creators already pay Lynk.id Pro.

## non_goals (MVP)
- No marketplace / brand discovery
- No payment processing or holding funds (Prohibited without Chris approval anyway)
- No auto-sync with TikTok/Meta earnings APIs (feasibility unverified — manual entry first)
- No agency multi-creator features
- No tax FILING (awareness + records only; we are not a tax agent)

## risks
- WTP unproven (biggest). Mitigation: Phase 2 gate at M4 before building Pro features.
- Solo creators may tolerate chat chaos. Mitigation: 60-second deal capture or bust.
- SociaBuzz/Lynk.id could add this. Mitigation: speed + wedge depth (payment chasing).
- Agency-managed share of market unknown → validate in creator interviews.
