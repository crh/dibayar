# Dibayar UX Review Pack V2 — Request for Claude Design

This document is a **request** for a future, separate design-review pass. It does not contain findings. No redesign or code fix happened in the session that produced this pack — see `run-summary.md` and `DIBAYAR-UX-REVIEW-PACK-V2-RECEIPT.md` at the repo root for what was actually done (journey discovery + evidence capture only).

## Context

> Dibayar is a lightweight back office for Indonesian creators to manage brand deals, deliverables, invoices, payments, and brand communication in one place.

Use `JOURNEY-INVENTORY.md` (this directory) for the full discovered journey map — including corrections against the original review-pack request and journeys the app has that weren't anticipated — and `manifest.json` for per-screenshot metadata (route, viewport, fixture persona, data state, user action, expected outcome, expected primary CTA, state type, external action intent, and whether the state passed its functional assertion). `screenshots/` holds the evidence itself, organized as `J##-slug/NN-description-viewport.png` sequences that each tell one journey's story end to end.

## What to review

- Visual hierarchy
- Clarity of primary action
- Journey continuity
- Navigation clarity
- Consistency
- Empty states
- Status transitions
- Feedback after actions
- WhatsApp/share affordances
- Invoice state clarity
- Mobile usability
- Desktop use of space
- Form clarity
- Error recovery
- Spacing/alignment
- Duplicated controls
- Cognitive load
- Whether the next action is obvious

**Important:** Do not redesign for novelty. Prefer the smallest change that materially improves clarity, usability, hierarchy, consistency, and completion of the user's task.

## Required output (next session)

### Executive summary

Top 5 UX issues across all journeys.

### Per-finding format

```text
ID:
Severity: Blocker / High / Medium / Low
Journey:
Screen:
Problem:
Why it matters:
Evidence:
Recommended change:
Confidence:
```

### Cross-product patterns

Identify repeated issues such as:

- Duplicate controls
- Inconsistent status UI
- Unclear primary CTA
- Inconsistent empty states
- Poor success feedback
- WhatsApp action ambiguity
- Invoice status ambiguity
- Spacing drift
- Mobile/desktop mismatch
- Dead whitespace
- Inconsistent component behavior

### Recommended implementation order

Return the top 10 changes ranked by:

1. User impact
2. Task criticality
3. Recurrence across journeys
4. Implementation effort
5. Regression risk

## Known gaps in this evidence set (read before reviewing)

Carry these into the review rather than treating a missing capture as "not reviewed / assumed fine":

- P1/P2 journeys explicitly deferred in `JOURNEY-INVENTORY.md` (long-content deal detail, due-date field edit, invoice settings-dependency notice on an actual invoice, API/network-failure states, session-expiry, language switch, and others) — see that file's per-journey `Capture required: no` notes for why.
- The Phase 11 double-run determinism check (repeating the whole capture twice and diffing) was not performed this session — see `run-summary.md`.
- `J35-invoice-share-link/03-copy-failed-headless-mobile375.png` shows the copy-failed state, not the copied-success state: `navigator.clipboard.writeText` rejected in this headless capture environment even with clipboard permissions granted. This is a capture-environment limitation, not a claim about production behavior — the failure-state UI (button stays "Salin", `role="alert"` error text) is itself real app behavior and still worth reviewing, just not the state this step intended to demonstrate.
- `J63-deal-detail-404` renders Next.js's default not-found page correctly, but the HTTP status Playwright observed was 200, not 404 — noted in the journey's own screenshot step, likely worth a second look by engineering rather than design, but flagged here in case it affects how "the 404 experience" should be scored.
