# DESIGN.md — Dibayar Visual & UX Reference

<!-- Hermes: the executor reads this when generating any UI. It replaces an interactive
     design tool in the unattended loop. Human-in-the-loop for taste (Chris edits this file
     or drops in a reference screen); agent-in-the-loop for repetition (executor matches it).
     Keep it concrete — tokens and rules, not adjectives. -->

## Design principle
Mobile-first, thumb-reachable, fast. This is a back-office tool a creator opens between
tasks — clarity and speed beat decoration. Primary target width: 390px. Every core action
(log a deal, mark paid, send follow-up) reachable one-handed.

## Language
- All user-facing copy in **Bahasa Indonesia**, natural (not literal English translation).
- Money always formatted IDR: `Rp1.500.000` (dot thousands separator, no decimals).
- Dates in local format; relative where useful ("jatuh tempo 3 hari lagi").

## Color tokens
```
--bg:        #F7F4EC   /* warm off-white app background */
--surface:   #FFFFFF   /* cards, sheets */
--ink:       #23201B   /* primary text */
--muted:     #6E6559   /* secondary text, labels */
--primary:   #C25E3E   /* clay — primary actions, brand */
--primary-d: #A94D30   /* pressed/hover */
--paid:      #2F8F6B   /* "Dibayar" / success green */
--due:       #E0A83E   /* due soon / warning amber */
--overdue:   #C7443B   /* overdue / danger red */
--line:      #E6DECF   /* borders, dividers */
```
Status colors are semantic — reuse them everywhere a deal/invoice state appears so the
creator learns the language once (green = paid, amber = due, red = overdue).

## Type
- System font stack for speed (no web-font blocking on mobile): 
  `-apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`.
- Scale: 13 / 15 / 17 / 20 / 26px. Tabular numerals for money and dates.
- Weight: 400 body, 600 labels/buttons, 700 headings. Avoid thin weights on mobile.

## Layout & components
- **Pipeline** = the home screen. Stages: Masuk → Nego → Deal → Konten → Invoice → Dibayar.
  Horizontal scroll or a compact status filter; a deal is a card, tappable to detail.
- **Deal card**: brand name, fee (IDR, prominent), status chip (semantic color), due date.
- **Deal capture**: a single sheet, ≤60s to complete on a phone. Minimum fields only;
  everything else optional/editable later.
- **Buttons**: primary = filled clay; secondary = outline; destructive = red outline + confirm.
  Labels say the action ("Simpan", "Tandai Dibayar", "Kirim Invoice"), never generic "Submit".
- **WhatsApp follow-up**: a first-class primary action on overdue invoices — opens a
  prefilled polite Bahasa message via `wa.me` link.
- Touch targets ≥44px. Visible keyboard focus. Respect reduced-motion.

## Empty & error states (direction, not mood)
- Empty pipeline: seed one example deal + a one-line "Tambah deal pertama kamu" prompt.
- Errors: say what happened and how to fix, in the app's voice, in Bahasa. Never a bare code.

## What NOT to do
- No heavy animations, no splash screens, no carousel heroes.
- No English leaking into the UI.
- No decorative dashboards without a workflow behind them (PRODUCT.md non-goal).

## Updating this file
Chris owns visual direction. To art-direct: edit tokens here, or design a reference screen
in Claude Design once and paste its tokens/description into this file. The executor treats
DESIGN.md as authoritative — it does not invent its own look.
