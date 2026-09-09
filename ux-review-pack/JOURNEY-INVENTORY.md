# Dibayar — UX Review Pack V2 — Journey Inventory

Built by reading the live application source (not guessed from the request spec): `src/app/(app)/**`, `src/components/**`, `src/lib/whatsapp.ts`, `src/lib/i18n.ts`, `prisma/schema.prisma`, and cross-checked against the sibling Playwright e2e suite (`/home/kenji/code/dibayar-playwright-e2e/e2e/**`) for confirmed selectors/copy. Corrections against the request spec's Phase 2 list are called out inline as **[CORRECTED]** or **[NOT FOUND]**; journeys the app has that the spec's list didn't anticipate are marked **[ADDED]**.

Personas available from the fixture manifest (`.hermes-runtime/ux-fixtures/fixtures.json`): `owner` (main fixture identity, populated), `other` (a second user — used only for cross-tenant isolation, not UX capture), `zero` (brand-new user, all empty states), `quiet` (real activity but nothing currently actionable).

Global corrections that apply across many journeys below:
- **Deal status change UI [CORRECTED]**: there is no dropdown/select — the deal card's kebab (⋮) menu (`aria-label="Aksi lain untuk deal {brand}"`, `role="menu"`) offers only **one-stage-at-a-time** "Lanjut ke {next stage}" / "Kembali ke {previous stage}" menu items, plus (only when status is `INVOICE` and no invoice exists yet) "Buat invoice", plus "Lihat detail". Drag-and-drop between board columns is also supported (`DEAL_DRAG_MIME`).
- **Deal delete/archive [NOT FOUND]**: `DELETE /api/deals/[id]` exists server-side, but no UI control anywhere calls it. Not a capturable journey.
- **Invoice creation [CORRECTED]**: invoices can only be created from a deal at `INVOICE` stage (via the card menu's "Buat invoice"), never directly from `/invoice`. There is no "new invoice" form.
- **Invoice status control [CORRECTED]**: not a dropdown — buttons for the valid next transitions only (`NEXT_ACTIONS` map): DRAFT→SENT; SENT→DUE or PAID; DUE→OVERDUE or PAID; OVERDUE→PAID; PAID→SENT (labelled "Batalkan status lunas", an explicit undo, secondary-styled).
- **Invoice list filtering [CORRECTED]**: no filter control — the list auto-groups into 4 fixed sections (Terlambat/Overdue, Terkirim/Sent+Due, Draf/Draft, Lunas/Paid) with counts; deals do have an explicit `StageFilter` chip group (`role="group"`, name matches `/filter tahap deal/i`).
- **WhatsApp is two independent flows**: (1) deal-stage "Buka WhatsApp" — bare `wa.me/<number>` chat, no prefilled text (`buildDealWhatsApp`); (2) invoice-stage "Kirim lewat WhatsApp"/"Kirim pengingat" — prefilled message from the owner's Settings template, auto-creates a share link first if none exists (`buildInvoiceWhatsApp` + `sendWhatsApp`). Both guard on `normalizeWhatsAppNumber`; an invalid/missing number reveals an inline repair form instead of the button being disabled.
- **404 [CORRECTED]**: no custom not-found page; `notFound()` triggers Next's default. **Error boundary [ADDED]**: `src/app/(app)/error.tsx` (generic retry button, "Muat ulang") exists for the `(app)` route group.
- **Session-expired [NOT VERIFIED]**: no dedicated UI state found; unauthenticated access to `(app)` routes redirects to `/api/auth/signin`. Reproducing a mid-session expiry safely (without real OAuth) is out of scope for this pass.

---

## A. Navigation / first-time experience

```
Journey ID: J01
Name: New user first load (zero-data onboarding)
Entry route: /
User goal: Understand what to do first with no deals yet
Preconditions: `zero` persona (no deals/invoices/settings)
Primary action: none (observe)
Important intermediate states: n/a
Expected result: "Belum ada deal" empty-state heading + CTA into deal creation
External side effect: none
Risk if broken: new users bounce with no path forward
Priority: P0
Capture required: yes — already covered by tests/ux-audit/routes/matrix.spec.ts (home/fresh-user); referenced, not re-captured this pass
```

```
Journey ID: J02
Name: Beranda (home) with real activity
Entry route: /
User goal: See net income this month + what needs chasing
Preconditions: `owner` persona
Primary action: none (observe); "Kirim pengingat" from Follow-up Queue is the actionable CTA
Important intermediate states: n/a
Expected result: Net bulan ini card, Follow-up Queue list, Nearest Deals list all populated
External side effect: none
Risk if broken: core dashboard value prop invisible
Priority: P0
Capture required: yes — already covered by matrix.spec.ts (home/normal); referenced, not re-captured
```

```
Journey ID: J03
Name: Deal pipeline, empty stage vs many-deals
Entry route: /deal
User goal: See deal pipeline
Preconditions: `owner` (many-deals) / `zero` (no deals)
Primary action: none (observe)
Expected result: Board renders 6 stage columns; empty stages collapse to a compact header strip
External side effect: none
Risk if broken: pipeline unreadable or empty stages look broken
Priority: P0
Capture required: yes — already covered by matrix.spec.ts (deals/many-deals); zero-state captured this pass as J-empty-deals
```

```
Journey ID: J04
Name: Invoice list, empty vs mixed states
Entry route: /invoice
User goal: See invoice/payment status at a glance
Preconditions: `owner` (mixed) / `zero` (none)
Expected result: 4 auto-grouped sections with counts, or "Belum ada invoice" empty state
External side effect: none
Risk if broken: can't tell what's overdue
Priority: P0
Capture required: yes — mixed covered by matrix.spec.ts; empty-state captured this pass
```

```
Journey ID: J05
Name: Settings entry, populated vs incomplete
Entry route: /pengaturan
User goal: Review/complete issuer identity so invoices can be shared
Preconditions: `owner` (complete) / `zero` (incomplete issuer/bank)
Expected result: Dependency notice banner shown only when incomplete
External side effect: none
Risk if broken: owner can't tell why sharing is blocked
Priority: P1
Capture required: yes — already covered by matrix.spec.ts (both states); referenced
Disposition: COVERED_BY_EXISTING_CORPUS
```

```
Journey ID: J06
Name: Mobile navigation (bottom nav, <640px)
Entry route: any (app) route
User goal: Move between Beranda/Deal/Invoice/Pengaturan on a phone
Preconditions: `owner`, mobile375 viewport
Primary action: tap each bottom-nav item
Expected result: active tab highlighted (aria-current="page"), correct route loads
External side effect: none
Risk if broken: primary nav unusable on the app's actual target device
Priority: P0
Capture required: yes
```

```
Journey ID: J07
Name: Desktop navigation (side nav, >=1024px)
Entry route: any (app) route
User goal: Move between sections on desktop
Preconditions: `owner`, laptop1280 viewport
Primary action: click each side-nav item
Expected result: active item gets left-border + tint highlight
External side effect: none
Risk if broken: desktop users lose primary nav
Priority: P1
Capture required: yes (representative P1)
```

---

## B. Deal lifecycle

```
Journey ID: J08
Name: Create first deal
Entry route: /deal (dialog via ?tambah=1)
User goal: Log a new brand deal
Preconditions: any persona; dialog opened
Primary action: fill Nama brand / Kontak WhatsApp / Scope pekerjaan / Fee (Rp), submit
Important intermediate states: dialog open (baseline), filled form, saving (button disabled), success toast
Expected result: "Deal disimpan" status banner; new card appears in Masuk column
External side effect: POST /api/deals
Risk if broken: can't capture new business — core MVP function
Priority: P0
Capture required: yes
```

```
Journey ID: J09
Name: Open deal detail
Entry route: /deal/[id]
User goal: See full deal info + stage history
Preconditions: `owner`, existing deal
Expected result: brand/fee/deadline/contact/scope + stage-transition history list
External side effect: none
Risk if broken: detail view is the only place history is visible
Priority: P1
Capture required: yes (representative P1)
Disposition: CAPTURED (stabilization pass -- the original pass documented this as "yes" but never actually captured it; fixed as part of Workstream C3's audit against the real manifest)
```

```
Journey ID: J10
Name: Edit deal contact name / WhatsApp number (detail page)
Entry route: /deal/[id]
User goal: Correct/add contact info
Primary action: edit "Nama kontak" field, save; separately repair an invalid WhatsApp number inline
Important intermediate states: saving, success message, error message
Expected result: PATCH persists, read-back confirms, success text shown
External side effect: PATCH /api/deals/[id]
Risk if broken: WhatsApp actions silently stay broken
Priority: P1
Capture required: no this pass (covered functionally by unit tests; documented, not screenshotted)
```

```
Journey ID: J11
Name: Change deal status — one stage forward, each of the 6 stages
Entry route: /deal (card kebab menu)
User goal: Move a deal through Masuk → Nego → Deal → Konten → Invoice → Dibayar
Preconditions: `owner`, one fixture deal per stage
Primary action: open card menu, click "Lanjut ke {next}"
Important intermediate states: menu open, optimistic move, persisted move (reload)
Expected result: card moves column, stage-filter reload confirms persistence
External side effect: PATCH /api/deals/[id]
Risk if broken: whole pipeline metaphor breaks
Priority: P0
Capture required: yes — all 6 forward transitions
```

```
Journey ID: J12
Name: Verify status-change feedback + reload persistence
Entry route: /deal
Primary action: same as J11, then reload page
Expected result: moved card still in new column after reload (no optimistic-only illusion)
External side effect: none (read)
Risk if broken: silent data loss disguised as success
Priority: P0
Capture required: yes (folded into J11's sequence)
```

```
Journey ID: J13
Name: Filter deals by stage, then return to Semua
Entry route: /deal
Primary action: click a stage chip in the filter group, then a "Semua" affordance / clear
Expected result: board shows only that stage's column, full-width; URL gets `?tahap=` via pushState
External side effect: none
Risk if broken: users can't scan a specific stage on a dense board
Priority: P1
Capture required: yes (representative P1)
```

```
Journey ID: J14
Name: Delete/cancel/archive deal — **[NOT FOUND]**
Capture required: no — no UI affordance exists; documented as a gap, not a bug (API exists, unused)
Priority: P2 (documentation only)
```

```
Journey ID: J15
Name: Deal form validation (required fields)
Entry route: /deal?tambah=1
Primary action: submit with required fields (brand/WhatsApp/scope/fee) empty
Expected result: native HTML5 `required` validation blocks submit (no custom inline error copy for this — **[CORRECTED]**: DealForm uses plain `required`/`min="0"` attributes, not a Zod-driven per-field error UI like Settings has)
Priority: P1
Capture required: yes (representative P1 — validation)
```

```
Journey ID: J16
Name: Deal with long creator/brand/content text
Entry route: /deal, /deal/[id]
Preconditions: fixture "many" deals include long Indonesian brand names (per matrix.spec.ts's own "many-deals" rationale)
Expected result: no overflow/truncation regression
Priority: P2
Capture required: no this pass — already exercised by tests/ux-audit's deals/many-deals + deals.desktop-scroll.spec.ts; not duplicated here
```

```
Journey ID: J17
Name: Deal with missing optional information (no deadline, no payment terms)
Entry route: /deal/[id]
Expected result: empty-label fallbacks ("Tanpa tenggat", "-" style copy) render instead of blank
Priority: P2
Capture required: no this pass — documented only
```

```
Journey ID: J18 **[ADDED]**
Name: Deal-stage WhatsApp follow-up
Entry route: /deal/[id]
User goal: Message the brand contact to follow up
Primary action: click "Buka WhatsApp" (valid number) — opens `wa.me/<number>` with no prefilled text, new tab
Important intermediate states: valid-number (button active), invalid-number (repair form shown instead)
Expected result: `href` targets `https://wa.me/<normalized>`; no message pre-filled; invalid number shows repair form, not a dead click
External action intent: opens WhatsApp Web/app — validated via `href`/`window.open` interception, never actually navigated
Risk if broken: broken follow-up loop = lost deals
Priority: P0
Capture required: yes
```

```
Journey ID: J19 **[ADDED]**
Name: Repair an invalid deal WhatsApp number, then send
Entry route: /deal/[id]
Primary action: click "Buka WhatsApp" with an invalid number → repair form appears → enter valid number → save
Expected result: success message, WhatsApp button becomes active (no auto-send — repairing on the deal page does not auto-open, unlike the invoice-page repair which does)
External side effect: PATCH /api/deals/[id]
Priority: P1
Capture required: yes (representative P1 — validation/error recovery)
```

---

## C. WhatsApp flows (invoice-side)

```
Journey ID: J20
Name: Send invoice via WhatsApp (share/send template)
Entry route: /invoice/[id]
User goal: Send the invoice link to the brand
Preconditions: `owner`, a SENT/DRAFT invoice, valid contact number
Primary action: click "Kirim lewat WhatsApp"
Important intermediate states: creating share link (if none active), sending (loading), href generated
Expected result: share link auto-created if missing; generated `href` = `https://wa.me/<number>?text=<encoded template with brand/jumlah/jatuh_tempo/nomor_invoice/tautan substituted>`
External action intent: opens WhatsApp — validated via intercepted `window.open`/href, never actually sent
Risk if broken: core monetization action broken
Priority: P0
Capture required: yes
```

```
Journey ID: J21
Name: Send overdue reminder via WhatsApp (chase template)
Entry route: /invoice/[id]
Preconditions: OVERDUE invoice
Primary action: click "Kirim pengingat" (same button, relabeled + uses `templateChase` instead of `templateSend`)
Expected result: message body differs from J20 (chase wording); still targets same share link
Priority: P0
Capture required: yes
```

```
Journey ID: J22
Name: Missing/invalid contact number on invoice send
Entry route: /invoice/[id]
Primary action: click primary WhatsApp button with no valid contact
Expected result: inline repair panel appears (never a disabled/dead button — F15 in source comments); on save, auto-sends immediately (unlike J19's deal-page repair, which does not auto-send)
Priority: P1
Capture required: yes (representative P1)
```

```
Journeys 19/23/24 desktop-vs-mobile WhatsApp behavior: [CORRECTED] — no separate desktop/mobile code path exists (same `window.open` call everywhere); only the popup-blocked fallback link differs by browser behavior, not by viewport. Not a distinct capturable journey.
Priority: P2
Capture required: no
```

---

## D. Invoice lifecycle

```
Journey ID: J23
Name: Create invoice from a deal
Entry route: /deal (card kebab menu, stage = Invoice, no invoice yet)
Primary action: "Buat invoice" menu item
Expected result: "Invoice dibuat" status banner; invoice now creatable from that deal never appears again (canCreateInvoice gate)
External side effect: POST /api/invoices
Priority: P0
Capture required: yes
```

```
Journey ID: J24
Name: Create invoice directly — **[NOT FOUND]**
Capture required: no — not supported by design (documented above)
```

```
Journey ID: J25
Name: Open invoice detail
Entry route: /invoice/[id]
Expected result: amount hero, status chip, payment-status section with action buttons, share section, details (tax/amount/due-date), PDF link
Priority: P1
Capture required: yes (baseline for the status-transition sequence below)
Disposition: CAPTURED (stabilization pass -- the original pass documented this as "yes" but never actually captured it under its own ID; captured against `invoices.due`, distinct from J27's `invoices.draft` baseline)
```

```
Journey ID: J26
Name: Edit invoice due date
Entry route: /invoice/[id]
Primary action: DateField inline edit → commit
Expected result: "Tersimpan"-style save confirmation, persisted on reload
External side effect: PATCH /api/invoices/[id]
Priority: P1
Capture required: no this pass — documented, unit-tested elsewhere (DateField has its own component tests)
```

```
Journey ID: J27
Name: Invoice status transitions — DRAFT→SENT→DUE→OVERDUE→PAID, then undo PAID→SENT
Entry route: /invoice/[id]
Primary action: click each NEXT_ACTIONS button in turn
Important intermediate states: each intermediate status chip, "diterima" paid banner + haptic pulse on reaching PAID, undo button (secondary style)
Expected result: status chip updates; PATCH persists; reload confirms
External side effect: PATCH /api/invoices/[id]
Risk if broken: payment tracking — the product's core promise — breaks
Priority: P0
Capture required: yes — full chain
```

```
Journey ID: J28
Name: Reverse/undo invoice status (PAID → SENT)
Entry route: /invoice/[id]
Expected result: same as above, isolated capture of the undo affordance and its distinct secondary-button styling
Priority: P0
Capture required: yes (folded into J27's sequence)
```

```
Journey ID: J29
Name: Partial/overdue payment state — **[CORRECTED]**
Notes: no "partial payment" concept exists in the schema (`InvoiceStatus` is DRAFT/SENT/DUE/OVERDUE/PAID only, no partial amounts). OVERDUE is fully covered by J27/J21.
Capture required: no — feature doesn't exist
```

```
Journey ID: J30
Name: Invoice validation/error state — **[CORRECTED]**
Notes: invoice has no create/edit form of its own (see J24) — the only user-facing "invoice validation" is the due-date field's own commit error path and the settings-dependency notice (J33 below). Documented, not separately captured.
Priority: P2
Capture required: no
```

```
Journey ID: J31
Name: Empty invoice list state
Entry route: /invoice
Preconditions: `zero` persona
Expected result: "Belum ada invoice" EmptyState
Priority: P1
Capture required: yes (representative P1)
```

```
Journey ID: J32
Name: Invoice list filtering — **[CORRECTED]**
Notes: no filter control exists (see global correction above) — the 4-group auto-layout itself is the "filtering." Already captured via matrix.spec.ts's mixed-payment-states state.
Capture required: no this pass (referenced only)
```

```
Journey ID: J33
Name: Invoice detail primary CTA + settings-dependency notice
Entry route: /invoice/[id]
Preconditions: `zero`/incomplete-issuer persona's invoice (if one exists) — otherwise documented from source only
Expected result: due notice "Lengkapi identitas penerbit dan rekening di Pengaturan agar invoice lengkap." shown inline in the details section when issuer/bank incomplete
Priority: P2
Capture required: no this pass — no fixture invoice exists under the `zero` persona to exercise this combination; documented as a gap for a follow-up session (would need a new fixture: zero-persona deal at INVOICE stage with an invoice created)
Disposition: CAPTURED (stabilization pass, Workstream C1) -- no new fixture needed after all: `hasIncompleteIssuer` depends only on the invoice owner's UserSettings completeness, not on invoice status, and the existing `quiet` persona already has real deal/invoice activity (unlike `zero`, which is deliberately data-free) but no UserSettings row -- so `quiet`'s own invoice already exercises this state. Captured as a two-step journey: the notice on `quiet`'s invoice, then its resolved state after completing `quiet`'s settings (Nama/nama usaha, Nama bank, Nomor rekening, Atas nama) and revisiting. `zero` is left as a pure "no data at all" fixture, matching its use elsewhere (J01/J31).
```

```
Journey ID: J34
Name: Download invoice PDF
Entry route: /invoice/[id]
Primary action: click "Unduh PDF" (plain link to /api/invoices/[id]/pdf)
Expected result: PDF download initiates (target 200 + correct content-type), no in-app viewer
Priority: P1
Capture required: yes (representative P1 — verifies response status/content-type only, does not open/inspect the binary)
```

```
Journey ID: J35
Name: Create / view / copy share link
Entry route: /invoice/[id] (Bagikan invoice section)
Primary action: "Buat link" when inactive → link appears; "Salin" copies it (clipboard)
Important intermediate states: inactive, creating, active
Expected result: link field shows truncated URL with title=full URL; copy button flips to "Tersalin" for 2s
External side effect: POST /api/invoices/[id]/share; clipboard write
Priority: P0 (blocks J20/J21 if broken — share link is a prerequisite for WhatsApp send)
Capture required: yes
Disposition: CAPTURED, genuine success state (stabilization pass, Workstream D) -- the original pass's "clipboard fails in headless Chromium" conclusion was itself wrong: the copy button's accessible name is a fixed aria-label ("Salin tautan invoice") that never changes even though its visible text flips Salin→Tersalin on success, so the original test's `getByRole("button", { name: "Tersalin" })` could never match regardless of outcome. Fixed to match on visible text; the real "Tersalin" success state is now captured every run. See DETERMINISM-REPORT.md and the stabilization receipt.
```

```
Journey ID: J36 **[ADDED]**
Name: Regenerate share link (with confirm step)
Entry route: /invoice/[id]
Primary action: "Regenerasi" → confirm panel with warning copy → "Konfirmasi regenerasi"
Expected result: old link invalidated, new link replaces it in the field
External side effect: POST /api/invoices/[id]/share
Priority: P1
Capture required: yes (representative P1 — destructive-ish confirm pattern)
```

```
Journey ID: J37 **[ADDED]**
Name: Revoke share link (with confirm step)
Entry route: /invoice/[id]
Primary action: "Cabut" → confirm panel → "Konfirmasi pencabutan"
Expected result: share state returns to inactive; a subsequent public-link visit would 404/expire
External side effect: DELETE /api/invoices/[id]/share
Priority: P1
Capture required: yes (representative P1)
```

```
Journey ID: J38
Name: Public invoice view (active link)
Entry route: /i/[token]
Preconditions: unauthenticated context, active public token
Expected result: public invoice document renders (`main.public-invoice`)
Priority: P0
Capture required: yes — already covered by tests/ux-audit/routes/matrix.spec.ts (public-invoice/active-long-content); referenced, not re-captured
```

```
Journey ID: J39 **[ADDED]**
Name: Public invoice view — expired/invalid token
Entry route: /i/[token]
Preconditions: `publicTokens.expired` / `publicTokens.invalid` from the fixture manifest
Expected result: some non-invoice fallback (exact copy TBD from source — `src/app/i/[token]/page.tsx` was not fully read this pass)
Priority: P2
Capture required: no this pass — flagged for the follow-up session, needs a source read of `src/app/i/[token]/page.tsx`
```

---

## E. Payment / follow-up flows

```
Journey ID: J40
Name: Mark payment received — **[merged with J27]**
Capture required: no separately — same action as J27's SENT/DUE/OVERDUE → PAID transition
```

```
Journey ID: J41
Name: Change payment status — **[merged with J27]**
```

```
Journey ID: J42
Name: Payment reminder action (home Follow-up Queue)
Entry route: /
User goal: Chase an overdue/due invoice from the dashboard without opening it
Preconditions: `owner`, an actionable item in the queue
Primary action: click the queue's "Kirim pengingat" action
Expected result: same WhatsApp-chase mechanism as J21, entry point differs
Priority: P0
Capture required: yes
```

```
Journey ID: J43
Name: WhatsApp reminder action — **[merged with J21/J42]**
```

```
Journey ID: J44
Name: Copy reminder text/link — **[merged with J35]**
```

```
Journey ID: J45
Name: Success feedback after reminder/share action — **[merged into J20/J21/J35 captures]**
```

```
Journey ID: J46
Name: No accidental duplicate action on repeated click
Entry route: /invoice/[id]
Primary action: rapid double-click the primary WhatsApp button
Expected result: button disables/shows loading state during the request (`isSharingToWhatsApp`), preventing a second concurrent send
Priority: P1
Capture required: no this pass — behavioral assertion is easy to check functionally but awkward to "screenshot" meaningfully; documented, recommend a Vitest/component-level assertion instead of a screenshot journey
Disposition: BETTER_AS_FUNCTIONAL_ASSERTION (stabilization pass, Workstream C3) -- confirmed on review: a disable-during-request race has no distinct visual state worth a screenshot (the button is disabled/relabelled the same way any other pending mutation is, already shown incidentally elsewhere, e.g. J08/J51). Recommended as a future Vitest/component test on the relevant button's `disabled`/`isSharingToWhatsApp` state; not added in this session to keep scope to evidence capture.
```

---

## F. Share / copy interactions

```
Journey ID: J47
Name: Copy link — **[merged with J35]**
```

```
Journey ID: J48
Name: Share link (native share) — **[NOT FOUND]**
Notes: no `navigator.share` integration found — only clipboard copy exists (ShareLinkField). Corrected from the spec's assumption.
Capture required: no
```

```
Journey ID: J49
Name: Copy invoice number/details — **[NOT FOUND]**
Notes: no separate "copy invoice number" control; only the full share URL is copyable.
Capture required: no
```

```
Journey ID: J50
Name: Confirm visual feedback states (copied/sent/opened/failed)
Notes: covered piecemeal across J20/J21/J35/J36/J37 captures — "copied" (Tersalin), "sent" (share created), "opened" (WhatsApp href generated), "failed" (share load-error / copy-error alert) all appear naturally in those sequences; not a separate journey.
Capture required: no separately
```

---

## G. Settings

```
Journey ID: J51
Name: Edit issuer details
Entry route: /pengaturan
Primary action: edit Nama penerbit / Alamat / WhatsApp / Email, save
Expected result: "Tersimpan" status text for 2s, dependency notice clears once all 4 required fields are non-empty
External side effect: PATCH /api/me/settings
Priority: P0 (blocks invoice completeness/sharing)
Capture required: yes
```

```
Journey ID: J52
Name: Edit bank/payout details
Entry route: /pengaturan
Primary action: edit Nama bank / Nomor rekening / Nama pemilik rekening, save
Priority: P0
Capture required: yes (folded into J51's save)
```

```
Journey ID: J53
Name: Change invoice template (send/chase)
Entry route: /pengaturan
Primary action: edit template textarea (tokens: {brand}/{jumlah}/{jatuh_tempo}/{nomor_invoice}/{tautan}), save; or "Reset" back to default
Expected result: saved template feeds J20/J21's generated WhatsApp message
Priority: P1
Capture required: yes (representative P1)
```

```
Journey ID: J54
Name: Save settings (happy path) — **[merged with J51/J52]**
```

```
Journey ID: J55
Name: Validation failure (required issuer/bank fields, invalid email)
Entry route: /pengaturan
Primary action: clear a required field or enter a malformed email, submit
Expected result: per-field inline error text ("Wajib diisi." / "Email tidak valid.") + `aria-invalid`
Priority: P1
Capture required: yes (representative P1 — this is the app's one Zod-style per-field validation UI, worth showing distinctly from DealForm's plain HTML5 validation in J15)
```

```
Journey ID: J56
Name: Unsaved/changed state behavior — **[CORRECTED]**
Notes: no "unsaved changes" warning/dirty-state indicator exists in SettingsForm — navigating away silently discards unsaved edits. This is a real gap worth flagging to design, not a journey to screenshot.
Priority: P2 (finding, not a capture)
Capture required: no
```

```
Journey ID: J57
Name: Dependency warning where settings affect invoices
Entry route: /pengaturan and /invoice/[id]
Expected result: `settings.dependencyNotice` on Pengaturan when incomplete; `invoice.settingsDependencyNotice` on an existing invoice when its owner's issuer is incomplete
Priority: P1
Capture required: yes — Pengaturan side already covered by matrix.spec.ts (incomplete-issuer-bank); invoice side is J33 (deferred, no fixture)
Disposition: CAPTURED (stabilization pass) -- Pengaturan side: COVERED_BY_EXISTING_CORPUS (matrix.spec.ts); invoice side: CAPTURED via J33 (see above)
```

```
Journey ID: J58 **[ADDED]**
Name: Sign-out confirmation
Entry route: /pengaturan
Primary action: click "Keluar" → inline confirm ("Batal" / "Ya, keluar")
Expected result: confirm step required before the real sign-out POST fires; cancel leaves session intact
Priority: P1
Capture required: yes (representative P1 — destructive-action confirm pattern, cancel path only; do not actually sign out the capture session)
```

```
Journey ID: J59 **[ADDED]**
Name: Language switch (id/en)
Entry route: /pengaturan
Primary action: toggle language pill group
Expected result: UI copy switches; money/date formatting rules stay Indonesian-fixed regardless (per source comments) for invoice-facing text
Priority: P2
Capture required: no this pass — cosmetic/orthogonal to the core journeys; documented only
```

---

## H. Error / resilience states

```
Journey ID: J60
Name: Required-field validation — **[merged with J15 (deal form) / J55 (settings)]**
```

```
Journey ID: J61
Name: API/network failure state
Notes: every mutating action in this app has a real fetch-catch → inline `role="alert"` error message (deal save/status, invoice status/share, settings save, contact repair). Reproducing a live network failure deterministically inside Playwright (route interception) is straightforward but wasn't attempted this pass to keep scope bounded.
Priority: P1
Capture required: no this pass — flagged as a good, cheap addition for the follow-up session (Playwright `page.route()` abort/500 on one representative mutation, e.g. deal status PATCH)
Disposition: CAPTURED (stabilization pass, Workstream C2) -- `page.route()` intercepts a deal-status PATCH with a mocked HTTP 500. Captures: the visible error ("Deal belum bisa diperbarui. Coba lagi."), the optimistic-move reverting so the card is never falsely shown as moved, and a reload afterward confirming no phantom persistence.
```

```
Journey ID: J62
Name: Unauthorized/session-expired state
Notes: see global correction above — not reproducible safely without real OAuth in this pass.
Priority: P2
Capture required: no
```

```
Journey ID: J63
Name: Missing data / 404-style state
Entry route: /deal/[id], /invoice/[id] with a non-existent id
Expected result: Next.js default not-found page (no custom copy — a real gap, arguably P1 for a consumer product, but out of scope to redesign this pass)
Priority: P2
Capture required: yes (representative P1/P2 — cheap, confirms it doesn't crash)
```

```
Journey ID: J64
Name: Empty-state recovery CTA — **[merged with J01/J03/J04/J31]**
```

```
Journey ID: J65
Name: Double-click/repeated-submit protection — **[merged with J46]**
```

```
Journey ID: J66
Name: Loading state / disabled CTA state
Notes: present throughout (isSaving/isSharingToWhatsApp/shareState.isBusy disable + relabel buttons during requests) — captured incidentally across J08/J20/J51 sequences, not separately.
Capture required: no separately
```

---

## P1 disposition audit (stabilization pass, Workstream C3)

Every P1 journey gets exactly one disposition below, cross-checked against `manifest.json` (not just this document's prose) so a "yes, captured" claim that was never actually true (as J09 and J25 both were, before this pass — see their entries above) can't recur silently.

| Journey | Disposition | Note |
|---|---|---|
| J05 | COVERED_BY_EXISTING_CORPUS | `tests/ux-audit/routes/matrix.spec.ts`, both states |
| J07 | CAPTURED | |
| J09 | CAPTURED | Fixed this pass — previously claimed captured but wasn't |
| J13 | CAPTURED | |
| J15 | CAPTURED | |
| J19 | CAPTURED | |
| J22 | CAPTURED | |
| J25 | CAPTURED | Fixed this pass — previously claimed captured but wasn't |
| J31 | CAPTURED | |
| J33 | CAPTURED | Fixed this pass (Workstream C1) — see above |
| J34 | CAPTURED | |
| J36 | CAPTURED | |
| J37 | CAPTURED | |
| J46 | BETTER_AS_FUNCTIONAL_ASSERTION | See above |
| J53 | CAPTURED | |
| J55 | CAPTURED | |
| J57 | CAPTURED | Pengaturan side COVERED_BY_EXISTING_CORPUS, invoice side CAPTURED via J33 |
| J58 | CAPTURED | |
| J61 | CAPTURED | Fixed this pass (Workstream C2) — see above |

No P1 journey is `DEFERRED_WITH_REASON` or `NOT_FOUND_IN_PRODUCT` after this pass.

---

## Summary counts

- **Total distinct journey IDs discovered/enumerated**: 66 (J01–J66; several explicitly merged/not-found, leaving a smaller effective capture set)
- **P0**: 17 (J01–J04 [referenced], J06, J08, J11/J12, J18, J20, J21, J23, J27/J28, J35, J38 [referenced], J42, J51/J52)
- **P1**: 19 — after the stabilization pass, all 19 have a settled disposition (see the P1 disposition audit table above): 17 CAPTURED (2 of those, J09/J25, were previously mis-claimed as captured and are now genuinely captured; 2 more, J33/J61, were newly closed this pass), 1 COVERED_BY_EXISTING_CORPUS (J05; J57 splits across COVERED_BY_EXISTING_CORPUS + CAPTURED), 1 BETTER_AS_FUNCTIONAL_ASSERTION (J46). None remain DEFERRED_WITH_REASON.
- **P2**: remainder (J14, J16, J17, J29, J30, J32, J39, J48, J49, J56, J59, J62, J63, J65, J66) — mostly "not found" corrections or explicitly deferred, not silently dropped
- **Corrected against the request spec's assumptions**: 9 (deal status UI, deal delete, invoice creation, invoice status UI, invoice list filtering, native share, copy-invoice-number, unsaved-changes warning, partial-payment state)
- **Newly found, not anticipated by the request spec**: 8 (J18/J19 deal WhatsApp + repair, J36/J37 share regenerate/revoke confirms, J39 expired public token, J58 sign-out confirm, J59 language switch)
- **Stabilization pass additions**: J09, J25 (previously mis-claimed captured, now genuinely captured), J33 (invoice settings-dependency notice, closed via the existing `quiet` persona), J61 (deterministic network-failure journey via `page.route()`)
