# Dibayar UX Review Pack V2 — Request for Claude Design

This document is a **request** for a future, separate design-review session. It contains no findings of its own. No redesign or code fix happened in either session that produced this pack (capture, then stabilization) — see `run-summary.md`, `DETERMINISM-REPORT.md`, and `DIBAYAR-UX-REVIEW-PACK-V2-STABILIZATION-RECEIPT.md` at the repo root for what was actually done.

This request is self-contained: you do not need repository access or prior context to act on it. Everything you need is in this directory.

## Context

> Dibayar is a mobile-first, Bahasa Indonesia web app for Indonesian solo micro/mid-tier creators (roughly 5k–500k followers) to manage brand deals from negotiation through payment: deal capture, a deal pipeline, IDR invoicing, payment reminders, WhatsApp follow-up links, and monthly income tracking. It does not process payments, file taxes, discover brands, or support multi-creator/agency workflows.

Use `JOURNEY-INVENTORY.md` (this directory) for the full discovered journey map — including corrections against the original review-pack request and journeys the app has that weren't anticipated — and `manifest.json` for per-screenshot metadata (route, viewport, fixture persona, data state, user action, expected outcome, expected primary CTA, state type, external action intent, and whether the state passed its functional assertion). `screenshots/` holds the evidence itself, organized as `J##-slug/NN-description-viewport.png` sequences that each tell one journey's story end to end, in a fixed order (`manifest.json`'s `entries` array is sorted by `stepId`).

## How to review

Treat the screenshots for a given journey ID as a **coherent, ordered product journey** — a user moving through a real task — not as isolated visual mockups to critique frame-by-frame. Read a journey's full step sequence before judging any single screenshot in it; several "problems" only make sense (or resolve) in light of the step before or after.

Evaluate at least all of the following, across the corpus as a whole:

1. Information hierarchy
2. Navigation clarity
3. Primary CTA clarity
4. Empty states
5. Forms and validation
6. Deal pipeline usability
7. Invoice/payment status comprehension
8. WhatsApp-related workflow clarity
9. Error/recovery states
10. Confirmation dialogs
11. Mobile ergonomics (375px is the primary target — most journeys are captured there)
12. Desktop board usability (deal board and invoice status-chain journeys are also captured at 1280px)
13. Visual consistency
14. Terminology/copy consistency (all user-facing copy is Bahasa Indonesia)
15. Trust signals around money, invoices, sharing, and payment status
16. Whether users can understand what to do next on every major screen

**Do not redesign for novelty.** Prefer the smallest change that materially improves clarity, usability, hierarchy, consistency, or task completion.

## Required output

### 1. Findings, separated by severity

```text
P0 — blocks task completion / severe trust or usability problem
P1 — important friction or confusion
P2 — polish / consistency / lower-impact improvement
```

For every finding, include:

- Journey ID(s)
- Screenshot filename(s)
- Observed problem
- User impact
- Recommended change
- Expected benefit
- Confidence

### 2. DO NOT CHANGE

A section naming screens/interactions that are already working well, so a later implementation pass doesn't cause unnecessary redesign churn.

### 3. TOP 5 CHANGES TO IMPLEMENT FIRST

Ranked by user impact and implementation leverage.

## Known gaps and caveats in this evidence set (read before reviewing)

Carry these into the review rather than treating a missing capture as "not reviewed / assumed fine," or a captured-but-unusual state as a bug in the product:

- **Reproducibility is verified.** `DETERMINISM-REPORT.md` documents two full, independent capture runs (after a fixture reseed between them) producing identical journey ordering, journey IDs, screenshot filenames, manifest structure, and pass/fail results. A handful of screenshots differ pixel-for-pixel between runs for three understood, benign reasons (a live timestamp embedded in one test's generated deal name, a non-deterministic tie-break in board card ordering among same-instant fixture rows, and freshly-generated random share tokens embedded in `wa.me` link text) — none reflect a functional or visual regression. Treat every screenshot as reliable evidence.
- **Remaining deferred/not-applicable journeys** are listed with an explicit disposition in `JOURNEY-INVENTORY.md`'s per-journey `Capture required` notes and summarized in `run-summary.md`. Categories: features that don't exist in the app (corrections against the original review request's assumptions), one journey judged better suited to an automated component-level assertion than a screenshot (J46, double-click protection), and a small number of low-priority (P2) states judged not worth the capture cost this pass.
- **J35's clipboard-copy step (`J35-invoice-share-link/03-copied-mobile375.png`) is a genuine success capture.** An earlier pass mis-detected this as a headless-Chromium clipboard limitation; the real cause was a test bug (querying the copy button's fixed `aria-label` instead of its changing visible text) — the app's copy-to-clipboard behavior itself works correctly and is faithfully represented here.
- **`J63-deal-detail-404`'s screenshot is visually correct** (Next.js's default 404 page renders as intended), but the underlying HTTP status is 200, not 404. This is confirmed, expected Next.js App Router behavior in this codebase: `src/app/(app)/loading.tsx` (written for the home page's own loading skeleton) applies as an implicit Suspense boundary to every route under the `(app)` group, so the response begins streaming as a 200 before a nested page's `notFound()` call can affect the wire-level status. The rendered UI is what a real visitor sees; this is an engineering/SEO note, not a design issue, and no fix was made in this evidence session (see the stabilization receipt for detail).
- **`J33-invoice-settings-dependency-notice`** captures both the notice (an owner with incomplete issuer/bank settings, on any of their invoices) and its resolved state after completing settings — review both steps as one flow, not independently.
- **`J61-deal-status-network-failure`** is a deliberately induced failure (a mocked HTTP 500 on the deal-status PATCH), included specifically so error/recovery UX can be assessed — the "problem" it shows (the request failing) is intentional test setup, not something to flag; judge only the *response* to that failure (the error message, the optimistic-UI revert, and the reload behavior).
