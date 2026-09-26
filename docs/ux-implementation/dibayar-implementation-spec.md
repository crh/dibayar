# Dibayar — Implementation Specification

**Source:** 116-capture UX audit, 14 journey steps × 2 languages × 5 widths, 15 findings.
**Audience:** Claude Code (Sonnet) implementing against the existing Dibayar codebase.
**Status of this document:** intended direction. Where the audit gave a recommendation without enough detail to build from, this spec makes the call and marks it `[SHARPENED]`. Where it makes an assumption, it is marked `[ASSUMPTION]` and repeated in §8.

**Path convention:** file paths below are indicative of module responsibility, not verified against the tree. Resolve each against the actual repository before editing; if a named file does not exist, find the module that owns that responsibility and treat that as the target.

---

## 1. Summary and sequencing rationale

Three structural fixes carry this round.

1. **The app has no shell.** One ~840px column serves every width and every job, so there is no place to put navigation, no place to put global actions, and no way to relieve `/dashboard`. Everything else is downstream of building one.
2. **`/dashboard` is seven products in a stack.** Splitting it into `/`, `/deal`, `/invoice`, `/pengaturan` is what makes hierarchy possible on each screen — a deal board can only stop shouting its stage four times once it is the only thing on the page.
3. **The public invoice is a route, not a document.** It is also the only screen a paying brand sees. It depends on issuer identity and bank details, which do not exist until Settings does.

The ordering follows: foundations (locale, breakpoints, routing) → shell and the three blocking findings → IA split → per-screen hierarchy work → the document → landing and the 320px band. Each phase leaves the app shippable.

---

## 2. Scope boundaries

### In scope

- A real ≥1024px layout and a global navigation shell at every width.
- Splitting `/dashboard` into five routes, with redirects.
- New routes: `/deal/:id`, `/deal`, `/invoice`, `/pengaturan`.
- A locale model separating UI language from number/date format and from document language.
- The invoice document template, shared by `/i/:token` and the PDF.
- Issuer identity and bank details in Settings — **only** because the invoice document cannot render without them.
- WhatsApp message templates, phone normalisation, and the failure path for unparseable numbers.
- The 320–359px band.

### Out of scope — do not relitigate

- **Tax (PPh 23 and any other withholding).** Existing behaviour stays exactly as-is. Do not add fields, do not remove fields, do not move tax lines in the document beyond what is needed to keep current output identical.
- **Channels other than WhatsApp.** No email, no in-app payment, no payment gateway. Every send/chase/share resolves to a `wa.me` deep link.
- **Rebrand.** Existing design tokens, cream/terracotta palette, and the serif-for-money / sans-for-UI pairing stay. No new palette, no new typefaces, no new radius or shadow scale. This is a structural pass.
- **Translating money, dates, or the invoice document.** Indonesian conventions and Indonesian document language are invariants, not settings.
- **Renaming the six pipeline stages.** See Open Question A.
- **Line-item editing.** The invoice remains single-amount; the document renders one derived line. See Open Question C.
- **"Kenji" / Hermes.** Orchestration tooling, not product content. It must not appear in any string, route, or component.
- **New features.** If something seems missing and the audit did not call for it, put it in §8, not in the build.

---

## 3. Route and IA specification

```
/                Beranda — the money view
/deal            Board — six stages, filterable
/deal/:id        Deal detail
/invoice         Invoice list, grouped by status
/invoice/:id     Invoice detail — send, chase, mark paid, share, PDF
/pengaturan      Settings
/i/:token        Public invoice — document, no app chrome, always Indonesian
/masuk           Landing / sign-in (existing landing page)
```

### Global chrome

Present on `/`, `/deal`, `/deal/:id`, `/invoice`, `/invoice/:id`, `/pengaturan`.
Absent on `/i/:token` and `/masuk` — `/i/:token` renders zero app navigation, zero avatar, zero language switch.

### 3.1 `/` — Beranda

**Purpose:** answer "how am I doing and who owes me" in one screen. Nothing else.

**Contains, in order:**
1. `Ditagihkan bulan ini` — the existing monthly income summary, single figure in serif, with the month label and a secondary line for count of paid invoices.
2. `Perlu dikejar` — the follow-up queue: invoices overdue, plus invoices due within 7 days. Each row: brand, amount, due date, relative urgency label, one action → `Kirim pengingat` (WhatsApp).
3. `3 deal terdekat` — the three deals with the nearest deadline that are not in the final stage. Each row: brand, fee, deadline, stage. Row → `/deal/:id`.

**Moved off / moved on:** monthly income summary and follow-up queue moved here from `/dashboard`. Nothing else lives here — no board, no invoice list, no add-deal form.

**Empty state:** if the user has zero deals, Beranda renders a single centred block: `Belum ada deal` / `No deals yet`, subline `Catat deal pertama untuk mulai melacak pemasukan.` / `Log your first deal to start tracking income.`, primary button `+ Deal`. The three sections are not rendered at all in this case.
Per-section empty states when other data exists: `Perlu dikejar` → `Tidak ada yang perlu dikejar.` / `Nothing to chase.` `3 deal terdekat` → `Semua deal sudah selesai.` / `All deals are closed.`

**Loading:** skeletons matching final block heights (summary 96px, each queue row 64px, each deal row 64px). No spinner, no layout shift.

**Error:** per-section inline error, other sections still render. `Gagal memuat. Coba lagi.` / `Couldn't load. Try again.` with a retry button.

### 3.2 `/deal` — Board

**Purpose:** move deals through six stages. Nothing else.

**Contains:** filter row (see §4.2), then the board. No summary bar, no invoice list, no add form. Adding a deal is the global `+ Deal` action, which opens the add-deal form as a full-screen sheet (<640) or a modal dialog (≥640) — the form itself is unchanged apart from tokens and button sizing.

**Moved off:** pipeline summary bar → `/` (it duplicated the counts the board already shows; retain only the "Ditagihkan bulan ini" figure, drop the per-stage count strip). Invoice list → `/invoice`. Add-deal form → global action.

**Empty state:** `Belum ada deal` / `No deals yet` + `+ Deal`, centred, board columns not rendered.

**Loading:** stage columns render with headers and three card skeletons each at ≥640; at <640, the active stage only.

**Error:** full-route error block with retry. Board is all-or-nothing — a partial board is misleading.

### 3.3 `/deal/:id` — Deal detail (new)

**Purpose:** hold everything the add-deal form captured and currently discards from view.

**Contains:** header (brand, fee, stage, deadline), `Ruang lingkup` (scope), `Kontak` (name + WhatsApp number, inline-editable, `Chat WhatsApp` action), `Syarat pembayaran` (terms), `Riwayat tahap` (stage timeline), `Invoice terkait` (linked invoices + `+ Buat invoice`).

**Empty state:** not applicable at route level. Per-section: scope empty → `Belum diisi` / `Not filled in` in muted type with an inline edit affordance; linked invoices empty → `Belum ada invoice untuk deal ini.` / `No invoices for this deal yet.` above the `+ Buat invoice` button.

**Loading:** header skeleton then sections; the header must reserve its final height (fee is serif and tall).

**Error:** unknown or non-owned id → 404 block, `Deal tidak ditemukan.` / `Deal not found.` with `← Kembali ke Deal` / `← Back to Deals`.

### 3.4 `/invoice` — Invoice list (new route, existing component)

**Purpose:** find an invoice by status.

**Contains:** invoice list grouped by status in this order: `Lewat jatuh tempo`, `Terkirim`, `Draf`, `Lunas`. Group headers carry a count. Each row: brand, invoice number, amount (serif), due date, status. Row → `/invoice/:id`.
`[ASSUMPTION]` These four statuses match the existing enum. If the codebase uses different keys or labels, keep the existing ones and keep this grouping order by semantic equivalence.

**Moved off:** the list moved here from `/dashboard`.

**Empty state:** `Belum ada invoice` / `No invoices yet`, subline `Invoice dibuat dari halaman deal.` / `Invoices are created from a deal.`, with a link to `/deal`.

**Loading:** four group headers not rendered until data arrives; five row skeletons.

**Error:** full-route error block with retry.

### 3.5 `/invoice/:id` — Invoice detail

**Purpose:** send it, chase it, mark it paid, share it, download it.

**Contains, in order:** status + amount → primary actions → share → details → PDF. See §4.5.

**Moved off:** nothing leaves; the order changes and the date-format sentence is deleted.

**Error:** unknown id → `Invoice tidak ditemukan.` / `Invoice not found.` with `← Kembali ke Invoice`.

### 3.6 `/pengaturan` — Settings (new)

**Purpose:** the two things the product needs to be able to state about the user, plus the switches that used to hide in the avatar popover.

**Contains, in order:**
1. `Bahasa antarmuka` / `Interface language` — Indonesia / English.
2. `Identitas penerbit` / `Issuer identity` — required by the invoice document.
3. `Rekening pembayaran` / `Payment account` — required by the invoice document.
4. `Template WhatsApp` / `WhatsApp templates` — two editable templates (send, chase).
5. `Keluar` / `Sign out`.

**Empty state:** issuer and bank sections render empty fields with an inline notice: `Lengkapi identitas dan rekening agar invoice bisa dibagikan.` / `Complete your identity and bank details so invoices can be shared.`

**Error:** per-field save error inline under the field; no route-level error.

### 3.7 `/i/:token` — Public invoice

**Purpose:** one document, for someone who does not use this app.

**Contains:** the invoice document (§5.3) and exactly one action: `Unduh PDF`. No header bar, no nav, no avatar, no language switch, no creator-facing status language ("Belum dikirim", "Draf", "Tandai lunas" and equivalents must not appear).

**Always Indonesian**, regardless of any setting or `Accept-Language`.

**Loading:** document frame with skeleton lines; never flash app chrome.

**Error states — three distinct ones:**
- Token not found → `Tautan tidak valid.` + `Minta tautan baru ke pengirim invoice.`
- Token expired (90-day expiry, existing behaviour) → `Tautan sudah kedaluwarsa.` + `Minta tautan baru ke pengirim invoice.`
- Issuer identity or bank details missing → the document still renders; see §5.3 optional-field rules. It must never 500.

### 3.8 Redirects and migration

| Old | New | Type |
|---|---|---|
| `/dashboard` | `/` | 302, permanent once shipped |
| `/dashboard?tab=*` (if any query state exists) | `/` | 302, query dropped |
| `/invoice/:id` | unchanged | — |
| `/i/:token` | unchanged | — |

Any bookmark, WhatsApp message, or link previously pointing at `/dashboard` must land on Beranda without an error frame. Do not delete the `/dashboard` route file until the redirect is in place and tested.

---

## 4. Screen specifications

### 4.0 Responsive bands, shell, and shared chrome

| Band | Width | Shell |
|---|---|---|
| XS | 320–359 | Top bar 56px + bottom nav 56px; content padding 16px |
| SM | 360–639 | Top bar 56px + bottom nav 56px; content padding 20px |
| MD | 640–1023 | Top bar 64px with inline nav; content max 720px, centred; no bottom nav |
| LG | 1024–1439 | Left nav 240px fixed + top bar 64px; content 12-col grid, max 1120px |
| XL | 1440+ | Left nav 264px fixed + top bar 64px; content 12-col grid, max 1280px, shell centred |

**Grid (LG/XL):** 12 columns, 24px gutters, 32px outer padding. Beranda uses 8 columns main + 4 columns right rail. All other routes use 12 columns with a max content column of 8 where the content is a form or a document.

**Left nav (LG/XL):** vertical, items in order `Beranda` · `Deal` · `Invoice` · `Pengaturan`. Item height 44px, 12px radius, active state uses the existing terracotta accent as a left 3px rule plus tinted background — not a filled pill (the palette is warm; a filled pill at this size reads as a button). Icons optional; if the codebase has no icon set, ship text-only rather than importing one.

**Bottom nav (XS/SM):** four items, same order, 56px tall, safe-area inset padding at the bottom, label 11px, active item in accent. Fixed. Content gets `padding-bottom: 56px + safe-area`.

**MD nav:** the four items as inline text links in the top bar, 16px gap, right of the product name.

**Top bar (all bands):** height 56px (XS/SM) / 64px (MD+). Left: product name at XS–MD, route title at LG/XL. Right, in order: global actions (LG/XL only — `Buat invoice` secondary, `+ Deal` primary), then avatar button 36px. Sticky, background = page background with a 1px bottom hairline in the existing border token. `z-index` above content, below menus and sheets.

**Global actions by band:**
- LG/XL: both buttons in the top bar.
- MD: `+ Deal` in the top bar; `Buat invoice` not present globally (it lives on `/deal/:id`).
- XS/SM: `+ Deal` as a single FAB, 56px, bottom-right, offset 16px from the right and 72px from the bottom (clears the bottom nav). `Buat invoice` not present globally.

**Account menu (F2).** Trigger: avatar button, `aria-haspopup="menu"`, `aria-expanded`.
- MD/LG/XL: anchored popover, right-aligned to the avatar's right edge, **8px vertical offset**, **max-width 260px**, min-width 200px. `position: fixed` relative to the trigger rect, computed on open and on resize/scroll. `z-index` above the top bar. It must never be rendered inside a card's stacking context. If the popover would overflow the viewport bottom, flip above the trigger.
- XS/SM: bottom sheet — full width, rounded top 16px, 16px padding, drag handle 36×4px, backdrop 40% black, slide-up 200ms, respects `prefers-reduced-motion` (no transform animation, opacity only).
- Contents both forms: user email (truncated, non-interactive), `Pengaturan` / `Settings` → `/pengaturan`, `Keluar` / `Sign out`. The language switch **moves out of this menu** into Settings.
- Dismiss: outside click, `Esc`, route change, item selection. Focus returns to the avatar button.
- **Acceptance:** at 1440, 1024, 768, 390 and 320, with the menu open, no pixel of the menu overlaps the "Ditagihkan bulan ini" figure or hides `Lihat semua →`. At 320 and 390 the sheet does not cover the value it was opened over because it is anchored to the viewport bottom, not the trigger.

**Global strings**

| Key | Indonesian | English |
|---|---|---|
| nav.home | Beranda | Home |
| nav.deals | Deal | Deals |
| nav.invoices | Invoice | Invoices |
| nav.settings | Pengaturan | Settings |
| action.newDeal | + Deal | + Deal |
| action.newInvoice | Buat invoice | Create invoice |
| action.seeAll | Lihat semua → | See all → |
| action.retry | Coba lagi | Try again |
| action.back | ← Kembali | ← Back |
| menu.signOut | Keluar | Sign out |

### 4.1 `/` — Beranda

**XS / SM.** Single column. Order: `Ditagihkan bulan ini` card → `Perlu dikejar` → `3 deal terdekat`. Each section header 16px semibold with `Lihat semua →` right-aligned where a fuller list exists. Queue rows are full-width, 64px min height, tappable, with the `Kirim pengingat` action as a 44px trailing icon-button; the whole row navigates to the invoice.

**MD.** Same order, content max 720px centred. Queue row action becomes a labelled button.

**LG / XL.** Two-column: main 8 cols = `Ditagihkan bulan ini` (full width of the main column, figure at the existing display size) + `3 deal terdekat`. Right rail 4 cols = `Perlu dikejar`, sticky at `top: 88px`. Rail min-width 280px; below that, collapse to single column (this is why the rail starts at 1024 and not 960).

**Strings**

| Key | Indonesian | English |
|---|---|---|
| home.netThisMonth | Ditagihkan bulan ini | Invoiced this month |
| home.paidCount | {n} invoice lunas | {n} invoices paid |
| home.chaseQueue | Perlu dikejar | Needs chasing |
| home.nearestDeals | 3 deal terdekat | 3 nearest deals |
| home.overdueBy | Telat {n} hari | {n} days overdue |
| home.dueIn | Jatuh tempo {n} hari lagi | Due in {n} days |
| home.dueToday | Jatuh tempo hari ini | Due today |
| home.sendReminder | Kirim pengingat | Send reminder |

**Interactive elements.** Queue row: default / hover (background tint) / active (pressed tint) / focus-visible (2px accent ring, 2px offset). Reminder button: default / hover / active / loading (spinner replaces label, button width held) / error (inline toast `Gagal membuka WhatsApp.` / `Couldn't open WhatsApp.`). No disabled state — see F15 rule in §5.2.

### 4.2 `/deal` — Board

**Stage labels.** `[ASSUMPTION]` The six stage labels already exist in the codebase. Reuse them verbatim; this pass does not rename them. Referred to below as S1…S6 in pipeline order. Their English equivalents, if any exist today, also stay unchanged.

**Filter row (F4).**
- ≥640: a chip row — `Semua` / `All` plus six stage chips. Chips are **filters**, not labels: exactly one is active at a time, active = accent fill, inactive = outline. Selecting a stage chip shows only that stage's column, full width. Selecting `Semua` shows all six.
- <640: the same set rendered as a horizontally scrollable **tab bar**, sticky under the top bar, with a 2px active underline. The tab selection drives the stage rail below.
- Filter state lives in the URL: `/deal?tahap=<stageKey>`. `Semua` = no param. This makes the filter linkable and survives reload.

**Board card.** Contains exactly: brand name (16px semibold), fee (serif, existing money size), deadline (13px muted, `24 Jul 2026`), overflow menu button (⋮, 44×44, trailing, top-aligned). **Deleted from the card: the stage pill and the native `<select>`.** Column position is the stage; there is no second statement of it.
Card tap → `/deal/:id`. Overflow menu → `Pindahkan →` (submenu), `Buat invoice`, `Buka deal`.

**Moving a deal (F5).**
- Pointer devices ≥1024: drag and drop between columns. Drag handle = the whole card, 8px activation threshold to avoid stealing taps. Drop target: column body, 2px dashed accent outline while a card is over it. On drop: optimistic move, toast `Dipindahkan ke {stage}` / `Moved to {stage}` with `Urungkan` / `Undo` for 5 seconds. On failure: revert and toast `Gagal memindahkan.` / `Couldn't move.`
- All bands, all input types: overflow menu → `Pindahkan →` listing **only adjacent stages** (previous and next). At S1 only `→ {S2}`; at S6 only `← {S5}`. This is the keyboard and touch path and must be fully operable without drag.
- `[SHARPENED]` The audit did not specify a keyboard path. The overflow menu is it — the menu button is in the tab order, opens with `Enter`/`Space`, items navigate with arrows.

**Layout by band.**
- XS / SM (F6): **stage rail.** One stage per viewport width, horizontal scroll with CSS scroll-snap (`scroll-snap-type: x mandatory`, each stage `scroll-snap-align: start`), driven by and syncing with the tab bar. Cards stack vertically inside the visible stage. Empty visible stage → single line `Belum ada deal di tahap ini` / `No deals in this stage`, 48px tall, not a full card.
- MD (640–1023): two stage columns per row, three rows. Column min-width 300px.
- LG (1024–1439): six columns, horizontal scroll if the sum of min-widths (6 × 280 + gutters) exceeds the content width; column min-width 280px.
- XL (1440+): six columns fit without scroll, min-width 300px.

**Empty-stage collapse (F6), MD and above.** When `Semua` is active and a stage has zero deals, its column renders as a 48px collapsed header instead of a full card body. When two or more stages are empty, they collapse into a **single** row below the populated columns: `{n} tahap masih kosong` / `{n} empty stages`, with a chevron; expanding restores them in place. Collapsed state is not persisted.

**Strings**

| Key | Indonesian | English |
|---|---|---|
| board.all | Semua | All |
| board.emptyStage | Belum ada deal di tahap ini | No deals in this stage |
| board.emptyStagesCollapsed | {n} tahap masih kosong | {n} empty stages |
| board.move | Pindahkan → | Move → |
| board.moveTo | Pindahkan ke {stage} | Move to {stage} |
| board.moved | Dipindahkan ke {stage} | Moved to {stage} |
| board.undo | Urungkan | Undo |
| board.openDeal | Buka deal | Open deal |

### 4.3 `/deal/:id` — Deal detail

**All bands, content order:**
1. **Header.** Back link (`← Deal` / `← Deals`), brand name (20px semibold XS/SM, 24px MD+), fee in serif at the display size, deadline `Tenggat 24 Jul 2026` / `Due 24 Jul 2026`, stage badge (here the badge is the *only* statement of stage, so it stays) with a `Pindahkan →` menu.
2. **`Ruang lingkup` / `Scope`.** Free text, preserved line breaks.
3. **`Kontak` / `Contact`.** Name, WhatsApp number rendered normalised (`+62 812-3456-7890`), inline-editable, and a primary `Chat WhatsApp` button (44px, full width XS/SM, auto MD+).
4. **`Syarat pembayaran` / `Payment terms`.** Free text.
5. **`Riwayat tahap` / `Stage history`.** Vertical timeline, one row per transition: stage name + date `24 Jul 2026`. Current stage is the last row, marked. `[ASSUMPTION]` If stage transitions are not currently persisted, render only the current stage plus the created date, and add a `stage_changed_at` history table as part of T-17.
6. **`Invoice terkait` / `Linked invoices`.** Rows → `/invoice/:id`; then `+ Buat invoice` (primary, full width XS/SM).

**LG / XL:** two columns — left 8 cols (header, scope, terms, timeline), right 4 cols (contact card, linked invoices, `+ Buat invoice`). MD and below: single column in the order above.

**Strings**

| Key | Indonesian | English |
|---|---|---|
| deal.scope | Ruang lingkup | Scope |
| deal.contact | Kontak | Contact |
| deal.chat | Chat WhatsApp | Chat on WhatsApp |
| deal.terms | Syarat pembayaran | Payment terms |
| deal.timeline | Riwayat tahap | Stage history |
| deal.invoices | Invoice terkait | Linked invoices |
| deal.noInvoices | Belum ada invoice untuk deal ini. | No invoices for this deal yet. |
| deal.notFilled | Belum diisi | Not filled in |
| deal.due | Tenggat {date} | Due {date} |

### 4.4 `/invoice` — Invoice list

Single column at all bands; content max 720px at MD, 8 of 12 columns at LG/XL. Group header: 13px uppercase-tracked label + count, sticky under the top bar within its group. Row: brand (semibold), invoice number (13px muted), amount (serif, right-aligned MD+, below brand at XS/SM), due date, status dot in the status colour. 64px min row height.

| Key | Indonesian | English |
|---|---|---|
| invoice.status.overdue | Lewat jatuh tempo | Overdue |
| invoice.status.sent | Terkirim | Sent |
| invoice.status.draft | Draf | Draft |
| invoice.status.paid | Lunas | Paid |
| invoiceList.empty | Belum ada invoice | No invoices yet |
| invoiceList.emptyHint | Invoice dibuat dari halaman deal. | Invoices are created from a deal. |

### 4.5 `/invoice/:id` — Invoice detail

**Content order (F9) — this order is the fix; do not vary it by band:**

1. **Status + amount.** Status badge, then amount in serif at display size, then `Jatuh tempo 24 Jul 2026` / `Due 24 Jul 2026` as static text (editing happens in §4 of this list, not here).
2. **Primary actions.** `Kirim lewat WhatsApp` / `Send on WhatsApp` (primary) and `Tandai lunas` / `Mark as paid` (secondary). For an already-paid invoice, the second becomes `Batalkan status lunas` / `Undo paid`. For an overdue invoice, the first becomes `Kirim pengingat` / `Send reminder`. XS/SM: stacked full-width, 12px gap. MD+: side by side.
3. **`Bagikan invoice` / `Share invoice`.** The share link field (§4.6) + `Salin` / `Copy`.
4. **`Detail` / `Details`.** Client, linked deal (link to `/deal/:id`), issue date, **due date as an inline-editable field** (§5 date rules), payment terms.
5. **`Unduh PDF` / `Download PDF`**, tertiary.

**Deleted:** the sentence "Date is stored as day/month/year; the calendar's display follows your browser." and its Indonesian equivalent, in both languages, everywhere it appears. Also deleted: the standalone `Simpan tanggal` / `Hapus tanggal` button pair — the field saves on change (§5.1).

**Band differences:** XS/SM/MD single column. LG/XL: 8 cols main (1, 2, 4, 5), 4 cols right rail (3 — share). The share block being in the rail is deliberate: it is the block that used to break the layout, and giving it a fixed narrow column makes overflow structurally impossible as well as CSS-impossible.

### 4.6 Share link field (F3) — component spec

`ShareLinkField` — used on `/invoice/:id` and anywhere else a token URL is displayed.

- Single line. Fixed height 44px. `display: flex; min-width: 0;` on the container, `min-width: 0; overflow: hidden; white-space: nowrap;` on the text element. **The raw URL is never rendered as flowing text and never as the content of a block that can grow.**
- **Middle truncation**, computed in JS from the measured available width: keep the leading `https://dibayar…/i/` portion and the last 8 characters of the token, joined by `…`. Recompute on resize with a `ResizeObserver`. Fallback if measurement is unavailable: keep the first 22 and last 8 characters.
- Monospace 13px, existing muted foreground token, 1px border, 8px radius, 12px horizontal padding.
- Trailing `Salin` button, 44×44 minimum, inside the field's border.
- `title` attribute carries the full URL; the accessible name of the copy button is `Salin tautan invoice` / `Copy invoice link`.
- States: default / hover (border darkens) / focus-visible (accent ring on the field) / copied (button label swaps to `Tersalin` / `Copied` for 2s, then reverts) / error (`Gagal menyalin. Tekan lama untuk salin manual.` / `Couldn't copy. Long-press to copy manually.`, and the field becomes user-selectable).
- No state renders the URL across more than one line, at any width, in any language.

### 4.7 `/pengaturan` — Settings

Single column, max 640px, centred at MD+; 8 of 12 columns at LG/XL. Sections separated by 32px and a hairline.

**1. `Bahasa antarmuka` / `Interface language`** — segmented control, two options: `Indonesia`, `English`. Helper text: `Angka, tanggal, dan dokumen invoice tetap berbahasa Indonesia.` / `Numbers, dates, and the invoice document stay in Indonesian.` Saves immediately, applies without reload.

**2. `Identitas penerbit` / `Issuer identity`** — fields: `Nama / nama usaha` (required), `Alamat` (optional, multiline), `Nomor WhatsApp` (optional), `Email` (optional).

**3. `Rekening pembayaran` / `Payment account`** — fields: `Nama bank` (required), `Nomor rekening` (required), `Atas nama` (required).

**4. `Template WhatsApp` / `WhatsApp templates`** — two multiline fields, `Pesan kirim invoice` and `Pesan pengingat`, each showing the available tokens as non-editable chips below the field: `{brand}`, `{jumlah}`, `{jatuh_tempo}`, `{nomor_invoice}`, `{tautan}`. `Kembalikan ke bawaan` / `Reset to default` per field. Templates are stored and sent in Indonesian only — mark these fields `[ID-ONLY]` in the UI with the helper `Pesan selalu dalam Bahasa Indonesia.` / `Messages are always in Indonesian.`

**5.** `Keluar` / `Sign out`, destructive-tertiary, left-aligned, with a confirm dialog.

**Field states:** default / focus / saving (subtle inline `Menyimpan…` / `Saving…`) / saved (`Tersimpan` / `Saved`, 2s) / error (`Gagal menyimpan. Coba lagi.` / `Couldn't save. Try again.`) / invalid (required field emptied → `Wajib diisi.` / `Required.`, border in error token, no save attempted).

**Dependency notice:** if issuer name, bank name, account number, or account holder is empty, show a persistent notice at the top of `/pengaturan` and a one-line notice on `/invoice/:id` above the share block: `Lengkapi identitas penerbit dan rekening di Pengaturan agar invoice lengkap.` / `Complete issuer and bank details in Settings so the invoice is complete.` The share link still works; the document renders with the placeholder rules in §5.3.

### 4.8 `/i/:token` — Public invoice

No app chrome. Page background = document background. Content max 720px, centred, 40px vertical padding at MD+, 24px at SM, 16px at XS. The document template (§5.3) fills it. One action, `Unduh PDF`, rendered as a single button above the document at ≤639px and top-right of the document header at ≥640px. Always Indonesian, including the button.

At print (`@media print`): hide the button, remove page padding, ensure the document fits A4 width.

### 4.9 `/masuk` — Landing (F12)

One centred column, **max-width 620px**, vertically stacked with no second column at any width:

1. Headline
2. Subhead
3. Workflow chips (the existing six-step chip row, wrapping)
4. Sign-in button
5. Three steps (`Catat deal` → `Kirim invoice` → `Tandai lunas`)

Gaps: 24px between blocks, 40px above the three steps. No block above 1024 gets a different arrangement — the same column, centred, with more vertical padding (80px top at LG/XL, 48px at MD, 32px below).

**Delete "Coming soon."** Replace with honest access copy: `Dibayar masih dalam uji terbatas. Masuk dengan akun Google untuk mencoba.` / `Dibayar is in limited testing. Sign in with Google to try it.`
`[ASSUMPTION]` Google is the existing sign-in provider. If it is something else, substitute the provider name; keep the sentence shape.

**Acceptance:** at 1440, no vertical gap between adjacent blocks exceeds 80px; the 250px void is gone by construction because there is only one column.

### 4.10 XS band (320–359) rules (F13)

- Card padding 16px (down from the default), section gap 20px.
- Every secondary action row becomes **full-width stacked buttons by design**: `flex-direction: column; gap: 8px;` below 360px. No row of two buttons exists in this band, so nothing wraps.
- Money type never drops below its readable floor: display money 28px minimum, list money 17px minimum. If a figure would overflow, reduce letter-spacing and allow the container to scroll horizontally — never shrink the type below the floor and never wrap a currency figure.
- Touch targets ≥44px in every band.
- Tab bars and chip rows scroll horizontally rather than wrapping.

---

## 5. Cross-cutting specifications

### 5.1 Locale model (F10, F11)

Three independent settings. Only one is user-facing this round.

| Setting | Values | Default | User-editable | Storage |
|---|---|---|---|---|
| `uiLanguage` | `id` \| `en` | `id` | Yes — `/pengaturan` | User record, server-side; mirrored to `localStorage` for first paint |
| `numberDateLocale` | `id-ID` | `id-ID` | **No** — constant this round | Constant in code, not in the DB |
| `documentLanguage` | `id` | `id` | **No** — constant this round | Constant in code, not in the DB |

**Rendering table**

| `uiLanguage` | UI chrome | Money | Dates in UI | WhatsApp message body | Invoice document (`/i/:token` + PDF) |
|---|---|---|---|---|---|
| `id` | Indonesian | `Rp 100.000.000` | `24 Jul 2026` | Indonesian | Indonesian |
| `en` | English | `Rp 100.000.000` | `24 Jul 2026` | Indonesian | Indonesian |

There is no combination in which money renders as `IDR 100,000,000` or a date renders as `Jul 24, 2026`. Delete any code path that produces them.

**Money formatter.** `Rp` + non-breaking space + `id-ID` grouped integer. No decimals (IDR sub-units are not used). Negative: `−Rp 1.000.000` with a true minus sign. Zero: `Rp 0`.

**Date formatter.** `d MMM yyyy` with Indonesian abbreviations: `Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des`. Example: `24 Jul 2026`, `1 Agu 2026`. Long form where a full date is needed in the document: `24 Juli 2026`. Never rely on the browser's default locale; never use `toLocaleDateString()` without an explicit `id-ID` locale and explicit options.

**Date input (F11).** Replace the native date input + Save/Clear pair with:
- A read-only formatted display button showing `24 Jul 2026`, or `Pilih tanggal` / `Pick a date` when empty.
- Activating it opens a date picker. Implementation: a visually-hidden `<input type="date">` positioned over the button, so the platform picker is used but its formatting is never displayed. Value in/out is ISO `yyyy-mm-dd`.
- Change commits immediately, with the inline `Menyimpan…` → `Tersimpan` states. `Kosongkan` / `Clear` lives inside the picker row as a text button, not as a sibling card button.
- The sentence about browser date formats is deleted, not reworded.

### 5.2 WhatsApp link construction (F15)

**Link format:** `https://wa.me/<msisdn>?text=<encodeURIComponent(body)>` where `<msisdn>` is E.164 digits **without** the leading `+`. Open with `target="_blank" rel="noopener"`.

**Normalisation rules**, applied in order:
1. Strip everything that is not a digit or a leading `+`.
2. `+62…` or `62…` → keep as `62…`.
3. Leading `0` → replace with `62`.
4. Leading `8` (no `0`, no `62`) → prefix `62`.
5. Any other leading digit sequence → treat as an international number and keep as-is.
6. Valid if the result is 9–15 digits. Otherwise invalid.

**Display format** for Indonesian numbers: `+62 812-3456-7890` (groups of 3–4–4 after the country code, best-effort). Storage is always the raw normalised digit string.

**Failure path (F15).** The WhatsApp button is **never disabled**. When the stored number fails normalisation:
- The button stays enabled and keeps its label.
- Activating it does not open WhatsApp. Instead it reveals an inline block directly beneath: `Nomor WhatsApp belum valid — perbaiki di deal ini.` / `WhatsApp number isn't valid yet — fix it on this deal.` with the number as a focused, editable input and a `Simpan & kirim` / `Save & send` button.
- On a valid save, the message is composed and the link opens in the same interaction chain where the platform allows it; if the popup is blocked, render a direct link `Buka WhatsApp` / `Open WhatsApp`.
- On `/invoice/:id`, where the number belongs to the linked deal, the same block appears and edits the deal's contact number, with a note `Nomor ini tersimpan di deal {brand}.` / `This number is saved on deal {brand}.`

**Message templates — always Indonesian, regardless of `uiLanguage`.**

Send (`whatsapp.send.default`):
```
Halo {brand}, berikut invoice {nomor_invoice} sebesar {jumlah}.
Jatuh tempo {jatuh_tempo}.
Detail dan unduh PDF: {tautan}
Terima kasih!
```

Chase (`whatsapp.chase.default`):
```
Halo {brand}, izin mengingatkan invoice {nomor_invoice} sebesar {jumlah} yang jatuh tempo {jatuh_tempo}.
Mohon dibantu prosesnya ya. Detail: {tautan}
Terima kasih!
```

Chat from deal (`whatsapp.chat.default`): **no prefilled body** — open the chat empty. A prefilled opener for a conversation the creator is already having reads as automation.

Token substitution: `{jumlah}` uses the money formatter, `{jatuh_tempo}` the date formatter, `{tautan}` the full public URL. If `{jatuh_tempo}` is empty, the line containing it is dropped, not rendered with a blank.

### 5.3 Invoice document template (F7)

One module renders both `/i/:token` and the PDF. Same fields, same order, same type scale, different page frame only.

**Field list, in render order**

| Block | Fields | Source | If empty |
|---|---|---|---|
| Header | `INVOICE`, invoice number, issue date (long form) | invoice | Number: fall back to `INV-{id}` `[ASSUMPTION]` |
| Issuer (`Dari`) | Name, address, WhatsApp, email | Settings | Name missing → render `—` and the Settings notice on the creator's side; address/WhatsApp/email missing → line omitted entirely, no blank line |
| Client (`Ditagihkan kepada`) | Brand name, contact name | deal | Contact name missing → line omitted |
| Scope | One line: description + amount | deal scope + invoice amount | Scope empty → description reads `Jasa kerja sama konten` |
| Total | `Total`, amount in serif at display size | invoice | — |
| Tax | **unchanged from current behaviour** | existing | Unchanged |
| Terms (`Syarat pembayaran`) | Terms text, due date | deal + invoice | Terms empty → block omitted; due date empty → line omitted |
| Bank (`Pembayaran ke`) | Bank name, account number, account holder | Settings | Any missing → block renders with `—` for the missing line and a visible line `Detail rekening belum lengkap.` This must be visible: an invoice with no payable account is a real problem for the brand, not something to hide |
| Footer | `Dokumen ini dibuat otomatis. Hubungi pengirim untuk pertanyaan.` | constant | — |

**Layout.** Max 720px content width. Issuer and client blocks side by side at ≥640px (two 50% columns, 24px gap), stacked below. Total right-aligned at ≥640px. Serif for every currency figure; sans for labels. Hairline rules above `Total` and above `Pembayaran ke`. No app chrome, no status language, no buttons inside the document body.

**Document strings — Indonesian only, never translated `[ID-ONLY]`:** `INVOICE`, `Nomor invoice`, `Tanggal terbit`, `Jatuh tempo`, `Dari`, `Ditagihkan kepada`, `Deskripsi`, `Jumlah`, `Total`, `Syarat pembayaran`, `Pembayaran ke`, `Bank`, `Nomor rekening`, `Atas nama`, `Dokumen ini dibuat otomatis. Hubungi pengirim untuk pertanyaan.`

**Parity requirement.** A screenshot of `/i/:token` at 720px and page 1 of the PDF must be field-identical: same fields, same order, same values, same formatting. Any divergence is a bug.

### 5.4 Component inventory

**New**
- `AppShell` — top bar, left nav, bottom nav, content slot.
- `AccountMenu` — anchored popover / bottom sheet.
- `ShareLinkField` — truncating URL + copy.
- `StageRail` — swipeable stage container for <640.
- `StageFilter` — chips (≥640) / tabs (<640), URL-bound.
- `MoveStageMenu` — adjacent-stage move.
- `DealDetail` (route) and its section components.
- `SettingsForm` sections: `LanguageSetting`, `IssuerIdentityForm`, `BankAccountForm`, `WhatsAppTemplateForm`.
- `InvoiceDocument` — shared by `/i/:token` and the PDF.
- `DateField` — formatted display + hidden native picker.
- `WhatsAppButton` — normalisation, template, failure path.
- `FloatingActionButton` — `+ Deal` on XS/SM.
- `formatMoney`, `formatDate`, `formatDateLong`, `normalisePhone`, `formatPhone` (utility modules).

**Changed**
- `DealCard` — stage pill and `<select>` removed; overflow menu added.
- `DealBoard` — filter-aware, band-aware, empty-stage collapse.
- `InvoiceList` — moves to `/invoice`, grouped by status.
- `InvoiceDetail` — reordered per §4.5, date field swapped, share block replaced.
- `MonthlyIncomeSummary` — moves to `/`, per-stage count strip dropped.
- `FollowUpQueue` — moves to `/` and to the LG/XL right rail.
- `AddDealForm` — becomes a sheet/dialog rather than an inline first-run block.
- Landing page — single column.
- PDF generator — delegates to `InvoiceDocument`.

**Deleted**
- `ActionBar` (the card containing two buttons).
- The stage `<select>` on the card.
- The stage pill on the card.
- The date-format explanatory sentence and its translation key.
- `Simpan tanggal` / `Hapus tanggal` button pair.
- The language switch inside the account popover (moves to Settings).
- `/dashboard` composite page component, after the redirect lands.

---

## 6. Task list

Phase rule: every phase ends in a shippable state. No task depends on a later ID.

Sizes: **S** ≤ half a day · **M** ≈ one day · **L** ≈ two to three days.

### Phase 0 — Foundations (no visible change except number/date formatting)

**T-01 · Locale model and formatters**
Closes: F10, F11 (partial)
Files: `src/lib/locale.ts` (new), `src/lib/format/money.ts`, `src/lib/format/date.ts`, `src/lib/format/phone.ts`, i18n resource files, user settings model
Depends on: —
Acceptance:
- `uiLanguage` is the only locale value read from user state; `numberDateLocale` and `documentLanguage` are constants exported from `locale.ts`.
- Grep for `toLocaleString`, `toLocaleDateString`, `Intl.NumberFormat`, `Intl.DateTimeFormat` returns zero call sites outside `src/lib/format/`.
- With `uiLanguage = en`, at 1440 and 390, every money figure on every route reads `Rp 100.000.000` form and every date reads `24 Jul 2026` form.
- Unit tests: `formatMoney(100000000) === "Rp 100.000.000"`; `formatDate("2026-08-01") === "1 Agu 2026"`; `formatDate("2026-12-24") === "24 Des 2026"`.
Size: M

**T-02 · Breakpoint tokens and layout primitives**
Closes: F1 (partial), F13 (partial)
Files: `src/styles/tokens.css`, `src/styles/breakpoints.ts`, `src/components/layout/*`
Depends on: —
Acceptance:
- Five named breakpoints exist as single-source tokens: 320, 360, 640, 1024, 1440.
- A `Grid` primitive renders 12 columns with 24px gutters at ≥1024 and a single column below.
- No new colour, radius, shadow, or font token is introduced. `git diff` on the palette section of `tokens.css` is empty.
Size: S

**T-03 · Route scaffolding and `/dashboard` redirect**
Closes: enables the IA split
Files: router config, `src/routes/*`
Depends on: T-02
Acceptance:
- `/`, `/deal`, `/deal/:id`, `/invoice`, `/invoice/:id`, `/pengaturan`, `/i/:token`, `/masuk` all resolve; the new ones may render placeholders at this point.
- `/dashboard` 302s to `/` and renders no error frame.
- `/i/:token` and `/masuk` render without `AppShell`.
Size: M

### Phase 1 — Shell and blocking findings

**T-04 · AppShell: top bar, left nav, bottom nav**
Closes: F1, F14 (partial)
Files: `src/components/layout/AppShell.tsx`, `TopBar.tsx`, `SideNav.tsx`, `BottomNav.tsx`
Depends on: T-02, T-03
Acceptance:
- At 1440 and 1024, a persistent left nav is visible with `Beranda · Deal · Invoice · Pengaturan`, content occupies the 12-column grid, and no route renders an ~840px column with empty space to its right. Measured: content width ≥ 85% of `viewport − navWidth − 64px` on `/` and `/deal`.
- At 768, an inline nav sits in the top bar and no bottom nav renders.
- At 390 and 320, a bottom nav renders with four items, each ≥44px tall, and content is not obscured by it at the bottom of the scroll.
- Active route is visually distinct and carries `aria-current="page"`, in both languages.
Size: L

**T-05 · Account menu: anchored popover / bottom sheet**
Closes: F2
Files: `src/components/AccountMenu.tsx`, `TopBar.tsx`
Depends on: T-04
Acceptance:
- At 1440, 1024, 768, 390, 320 with the menu open, a screenshot shows zero overlap between the menu and the "Ditagihkan bulan ini" figure, and `Lihat semua →` is fully visible and clickable.
- Menu max-width is 260px and its top edge is 8px below the avatar's bottom edge at ≥640.
- At 390 and 320 the menu is a bottom sheet anchored to the viewport bottom with a backdrop.
- `Esc`, outside click, and route change all close it; focus returns to the avatar button.
- The language switch is no longer present in the menu.
Size: M

**T-06 · ShareLinkField**
Closes: F3
Files: `src/components/ShareLinkField.tsx`, `src/routes/invoice/[id].tsx`
Depends on: T-02
Acceptance:
- At 320, 390, 768, 1024, 1440, in both languages, with an active share link, the field's rendered height is exactly one line and `scrollWidth` of the URL element does not exceed its `clientWidth` — no character of the URL is painted outside the card.
- The copy button places the **full** URL on the clipboard; the displayed string is middle-truncated.
- Copied state reverts after 2s; copy failure shows the manual-copy message and the text becomes selectable.
- Resizing the window from 1440 to 320 with the field mounted re-truncates without overflow at any intermediate width.
Size: S

**T-07 · Retire the action-bar card; FAB on phones**
Closes: F14
Files: delete `src/components/ActionBar.tsx`, `TopBar.tsx`, `FloatingActionButton.tsx`
Depends on: T-04
Acceptance:
- `ActionBar` no longer exists in the tree and is not imported anywhere.
- At 1024 and 1440, `+ Deal` and `Buat invoice` are in the top bar.
- At 390 and 320, `+ Deal` is a 56px FAB clearing the bottom nav by 16px; `Buat invoice` is absent from global chrome.
- At 768, `+ Deal` is in the top bar and no FAB renders.
Size: S

### Phase 2 — IA split

**T-08 · `/` Beranda**
Closes: F1 (content), F14 (content)
Files: `src/routes/index.tsx`, `MonthlyIncomeSummary`, `FollowUpQueue`, `NearestDeals` (new)
Depends on: T-04
Acceptance:
- `/` renders exactly three sections in the specified order and nothing else; no board, no invoice list, no add-deal form is present in the DOM.
- At 1024 and 1440 the chase queue is a sticky right rail; at 768 and below it is inline in order.
- Zero-deal state renders the single centred empty block and no section headers.
- Both languages: all §4.1 strings resolve, no key leaks as a raw token.
Size: M

**T-09 · `/deal` route extraction**
Closes: prerequisite for F4/F5/F6
Files: `src/routes/deal/index.tsx`, `DealBoard`
Depends on: T-03, T-04
Acceptance:
- `/deal` renders the board and the filter row only.
- Board no longer appears on `/`.
- `+ Deal` opens the add-deal form as a full-screen sheet at <640 and a modal dialog at ≥640, with `Esc` and backdrop close, focus trapped, and focus restored on close.
Size: M

**T-10 · `/invoice` list route**
Closes: prerequisite for F9 hierarchy
Files: `src/routes/invoice/index.tsx`, `InvoiceList`
Depends on: T-03, T-04
Acceptance:
- Groups render in the order overdue → sent → draft → paid, each with a count; empty groups are not rendered.
- Invoice list no longer appears on `/`.
- Rows navigate to `/invoice/:id`; amounts use the serif money style at ≥17px in all bands.
Size: M

**T-11 · `/pengaturan` with issuer identity and bank details**
Closes: F10 (surface), unblocks F7
Files: `src/routes/pengaturan.tsx`, settings model + persistence, `AccountMenu`
Depends on: T-01, T-04, T-05
Acceptance:
- Language switch works from Settings and no longer exists in the account menu; switching to English does not change any money or date rendering at 1440 or 390.
- Issuer name, bank name, account number, and account holder persist across reload and are readable by the document module.
- Required-field validation, saving/saved/error states all reachable and visible.
- With any required issuer/bank field empty, the notice appears on `/pengaturan` and on `/invoice/:id`.
Size: M

**T-12 · Remove the `/dashboard` composite**
Closes: cleanup for F1
Files: delete `src/routes/dashboard.tsx` and its section wrappers
Depends on: T-08, T-09, T-10
Acceptance:
- The composite page component is deleted; the redirect from T-03 remains and is covered by a test.
- No component is rendered on two routes by accident: grep confirms `MonthlyIncomeSummary`, `FollowUpQueue`, `InvoiceList`, `DealBoard` each have exactly one route-level import.
Size: S

### Phase 3 — Board and deal detail

**T-13 · Slim the deal card**
Closes: F4
Files: `DealCard.tsx`
Depends on: T-09
Acceptance:
- A deal's stage appears **once** on `/deal`: as its column (or rail page). At 1440 and 390, in both languages, the DOM of a card contains no stage string and no `<select>`.
- Card contains brand, fee, deadline, overflow button only.
- Overflow button is ≥44×44 and keyboard-focusable.
Size: S

**T-14 · Filter row: chips ≥640, tabs <640, URL-bound**
Closes: F4
Files: `StageFilter.tsx`, `src/routes/deal/index.tsx`
Depends on: T-13
Acceptance:
- Selecting a stage chip at 1024 shows only that column and sets `?tahap=<key>`; reloading preserves the selection.
- `Semua` clears the param.
- At 390 the same control is a scrollable tab bar with an active underline, and selecting a tab scrolls the rail to that stage.
- Both languages: only `Semua`/`All` is translated; stage labels are unchanged from the existing enum.
Size: M

**T-15 · Stage movement: drag + `Pindahkan →`**
Closes: F5
Files: `DealBoard.tsx`, `MoveStageMenu.tsx`, stage mutation
Depends on: T-13
Acceptance:
- At 1440 and 1024 with a mouse, dragging a card to another column moves it, shows the drop outline, and produces the toast with a working `Urungkan`.
- At 390, 320, and via keyboard at every width, the overflow menu offers `Pindahkan →` listing only adjacent stages; a deal in S1 shows one option, a deal in S6 shows one option, all others show two.
- No path to move a deal goes through a native `<select>`.
- A failed mutation reverts the card to its original column and shows the failure toast.
Size: L

**T-16 · Narrow-width stage rail and empty-stage collapse**
Closes: F6
Files: `StageRail.tsx`, `DealBoard.tsx`
Depends on: T-14
Acceptance:
- At 390 with one deal in one stage, total page scroll height is **under 1.5 viewport heights** (baseline was ~1,100px of stage cards alone), and the five empty stages produce no full-height cards.
- Swiping the rail moves one stage per gesture with snap; the tab bar stays in sync in both directions.
- At 768 and 1024 with `Semua` active and ≥2 empty stages, a single collapsed row reads `4 tahap masih kosong` / `4 empty stages` and expands on activation.
- `prefers-reduced-motion` disables snap animation but not snap behaviour.
Size: M

**T-17 · `/deal/:id` deal detail**
Closes: F8
Files: `src/routes/deal/[id].tsx` + section components, stage-history model if absent
Depends on: T-09, T-13
Acceptance:
- Every field captured by the add-deal form — brand, fee, deadline, scope, contact name, WhatsApp number, payment terms — is visible on `/deal/:id` after saving a new deal, at 390 and 1440, in both languages.
- Stage timeline renders at least the current stage with a date.
- Linked invoices list renders and `+ Buat invoice` creates an invoice bound to this deal.
- At 1440 the layout is 8+4 columns; at 768 and below it is a single column in the specified order.
- Unknown id renders the 404 block, not a crash.
Size: L

**T-18 · Contact WhatsApp from the deal**
Closes: F15 (deal surface)
Files: `WhatsAppButton.tsx`, `phone.ts`, `DealDetail` contact section
Depends on: T-17, T-01
Acceptance:
- `Chat WhatsApp` opens `wa.me` with the normalised number and **no** prefilled body.
- With a stored number of `0812-3456-7890`, `+62 812 3456 7890`, and `812 3456 7890`, all three produce the same `wa.me/628123456789…` target.
- With a stored number of `abc` or `123`, the button is **enabled**; activating it reveals the fix block with the F15 string and an editable field; saving a valid number then opens WhatsApp.
- No disabled WhatsApp button exists anywhere in the app: grep for `disabled` on WhatsApp CTAs returns zero.
Size: M

### Phase 4 — Invoice detail

**T-19 · Reorder `/invoice/:id`**
Closes: F9
Files: `src/routes/invoice/[id].tsx`
Depends on: T-10, T-06
Acceptance:
- The first interactive element below the amount is `Kirim lewat WhatsApp` (or `Kirim pengingat` for overdue), at 320, 390, 768, 1024, 1440, in both languages. Verified by DOM order, not visual guess.
- No date input appears above the primary actions.
- At 1440 the share block is in the 4-column right rail; at 768 and below it is inline after the primary actions.
- Paid invoices show `Batalkan status lunas` in place of `Tandai lunas`.
Size: M

**T-20 · Date field replacement and apology deletion**
Closes: F11
Files: `DateField.tsx`, `src/routes/invoice/[id].tsx`, i18n resources
Depends on: T-01, T-19
Acceptance:
- Grep across the repo for "browser", "day/month/year", and the Indonesian equivalent returns zero user-facing matches; the translation keys are deleted, not orphaned.
- Every date on every route renders as `24 Jul 2026`.
- Changing the due date saves without a separate Save button; `Menyimpan…` → `Tersimpan` is observable; `Kosongkan` clears it.
- The native picker opens on tap at 390 and on click at 1440, and its own formatting is never visible in the page.
Size: S

**T-21 · WhatsApp send and chase from the invoice**
Closes: F15 (invoice surface), supports F9
Files: `WhatsAppButton.tsx`, template resolution, `src/routes/invoice/[id].tsx`
Depends on: T-18, T-11
Acceptance:
- With `uiLanguage = en` at 1440, the composed message body is **Indonesian** and contains the invoice number, `Rp`-formatted amount, `24 Jul 2026`-formatted due date, and the public URL.
- Custom templates from Settings override the defaults; `Kembalikan ke bawaan` restores them.
- An empty due date drops the due-date line entirely — no `Jatuh tempo .` in the output.
- Invalid contact number routes to the fix block with the note naming the deal, and the fix writes back to the deal.
Size: M

### Phase 5 — The document

**T-22 · `InvoiceDocument` shared template**
Closes: F7 (core)
Files: `src/components/InvoiceDocument/*`
Depends on: T-11
Acceptance:
- Renders every field in §5.3 order, in Indonesian, with serif money and the correct optional-field behaviour for each of: no issuer address, no contact name, empty scope, no terms, no due date, missing bank fields.
- Missing bank fields produce the visible `Detail rekening belum lengkap.` line rather than a silent gap.
- Existing tax behaviour is byte-identical to before: a diff of tax-related output for a fixture invoice shows no change.
- Contains zero app navigation, zero status language, zero buttons.
Size: L

**T-23 · `/i/:token` as a document**
Closes: F7
Files: `src/routes/i/[token].tsx`
Depends on: T-22
Acceptance:
- At 320, 390, 768, 1024, 1440: no top bar, no nav, no avatar, no language switch, no creator status language. Page renders in Indonesian with `Accept-Language: en` and with `uiLanguage = en` in the creator's account.
- Exactly one action is present: `Unduh PDF`.
- Invalid token, expired token, and incomplete-issuer cases each render their specified state; none returns a 500.
- `@media print` hides the button and fits A4.
Size: M

**T-24 · PDF uses the shared template**
Closes: F7 (parity)
Files: PDF generation module
Depends on: T-22
Acceptance:
- For the same invoice, `/i/:token` at 720px and page 1 of the PDF contain the same field set with the same values and the same formatting; a field-by-field comparison shows no divergence.
- The PDF is Indonesian with `uiLanguage = en`.
- Generation succeeds when optional fields are empty.
Size: M

### Phase 6 — Landing and the narrow band

**T-25 · Landing single column**
Closes: F12
Files: `src/routes/masuk.tsx`
Depends on: T-02
Acceptance:
- At 1440 and 1024, one centred column, max-width 620px; no two-column arrangement exists in the DOM at any width.
- No vertical gap between adjacent blocks exceeds 80px at 1440 — the 250px void is measurably gone.
- "Coming soon" is deleted and replaced with the access sentence, in both languages.
Size: M

**T-26 · 320–359 band pass**
Closes: F13
Files: `tokens.css`, button group components, card components
Depends on: T-02, T-19
Acceptance:
- At 320, on `/`, `/deal`, `/deal/:id`, `/invoice`, `/invoice/:id`, `/pengaturan`, in both languages: no button row wraps, because below 360px every secondary action group is a stacked full-width column by rule.
- Card padding is 16px; no horizontal page scroll on any route.
- No money figure renders below 28px (display) or 17px (list); no touch target below 44px.
- English strings, which are generally longer, are checked explicitly at this width.
Size: S

**T-27 · Verification capture re-run**
Closes: —
Depends on: all
Acceptance: §7 matrix captured and the per-finding table completed.
Size: M

---

## 7. Verification plan

### 7.1 Capture matrix

Widths: **320 · 390 · 768 · 1024 · 1440**. Languages: **ID · EN**.

| Route | Widths | Languages | Captures |
|---|---|---|---|
| `/masuk` | all 5 | both | 10 |
| `/` (populated) | all 5 | both | 10 |
| `/deal` (`Semua`) | all 5 | both | 10 |
| `/deal` (filtered to one stage) | all 5 | both | 10 |
| `/deal/:id` | all 5 | both | 10 |
| `/invoice` | all 5 | both | 10 |
| `/invoice/:id` (sent, link active) | all 5 | both | 10 |
| `/pengaturan` | all 5 | both | 10 |
| `/i/:token` | all 5 | ID only | 5 |
| **Subtotal** | | | **85** |

State captures, at 390 and 1440 only:

| State | Languages | Captures |
|---|---|---|
| `/` zero deals | both | 4 |
| `/deal` zero deals | both | 4 |
| `/invoice` zero invoices | both | 4 |
| Account menu open, over the income figure | both | 4 |
| `/invoice/:id` with invalid contact number (fix block open) | both | 4 |
| `/i/:token` expired token | ID | 2 |
| `/pengaturan` with incomplete issuer/bank | both | 4 |
| **Subtotal** | | **26** |

**Total: 111 captures.** Comparable to the 116-capture baseline; the reduction is `/i/:token` becoming Indonesian-only by design.

Additional non-visual checks: one PDF export compared field-by-field against `/i/:token`; one drag-move at 1440; one menu-move at 390; one keyboard-only traversal of `/deal` from the top bar to a stage move.

### 7.2 Per-finding before/after

| ID | Before | After — observable check | Where |
|---|---|---|---|
| F1 | ~840px column at all widths | Content fills ≥85% of available width beside the nav | 1024, 1440, all app routes |
| F2 | Popover covers the pipeline numbers | Zero overlap with the income figure; `Lihat semua →` visible | all 5 widths, menu open |
| F3 | Raw URL escapes the card | One-line field; URL `scrollWidth` ≤ `clientWidth`; full URL only on copy | all 5 widths, both languages |
| F4 | Stage stated 4× | Stage string appears once per deal on `/deal` | 390, 1440 |
| F5 | Move via bare `<select>` | No `<select>` on the card; drag at ≥1024 and `Pindahkan →` everywhere | 390, 1024 |
| F6 | ~1,100px of empty stage cards | Page scroll < 1.5 viewport heights with one deal | 390 |
| F7 | Public page dressed as the app | No app chrome, no status language; issuer/client/scope/terms/bank present; ID only | all 5 widths |
| F8 | Scope, contact, terms invisible after save | All seven captured fields visible on `/deal/:id` | 390, 1440, both languages |
| F9 | Date housekeeping first | First interactive element under the amount is the WhatsApp action, by DOM order | all 5 widths |
| F10 | EN switched money and dates | `Rp 100.000.000` and `24 Jul 2026` under both languages | 390, 1440 |
| F11 | Apology sentence on every invoice | Zero matches in a repo-wide grep; dates render `24 Jul 2026` | all routes |
| F12 | 250px void, two unrelated columns | One column, max 620px, no gap > 80px | 1440 |
| F13 | Button rows wrap at 320 | No wrapped button rows; stacked by rule | 320, both languages |
| F14 | A card holding two buttons | `ActionBar` deleted; buttons in the top bar or FAB | 390, 768, 1440 |
| F15 | Disabled button, no reason | Button enabled; fix block with the message and an editable number | 390, 1440, both languages |

---

## 8. Open questions and assumptions

**A. Do the six stage names survive contact with real creators?**
F4 assumes they do, and this spec does not rename them. The risk is that a stage name that reads as a label on a card reads as an instruction as a column header, and column position now carries the entire meaning of the stage — so a vague name costs more after this change than before.
*Recommendation:* ship the rename-free version, and put stage naming at the top of the first creator interview script. The stage list is a single enum; renaming later is a small diff plus a data migration, which is cheap. Do not block this round on it.

**B. Are issuer identity and bank details acceptable additions to Settings?**
F7 depends on them: an invoice document with no issuer and no payable account is not a document a brand can act on.
*Recommendation:* yes, and treat them as the minimum viable set — name, address, WhatsApp, email, bank name, account number, account holder. Only the name and the three bank fields are required. Do not add NPWP or company registration in this round; that is adjacent to the tax work explicitly deferred.

**C. Line items.**
The audit lists "no line items" as part of F7, but the invoice model is single-amount and adding a line-item editor is a feature the audit did not call for.
*Assumed:* the document renders one derived line — deal scope as the description, invoice amount as the value, with the fallback `Jasa kerja sama konten` when scope is empty. *Recommendation:* keep it that way until a creator asks for a split invoice.

**D. Stage transition history.**
`/deal/:id` specifies a stage timeline. If transitions are not currently persisted, T-17 has to add storage for them.
*Assumed:* not persisted. If they are, drop that part of T-17 and read the existing table.

**E. Invoice numbering.**
The document needs an invoice number.
*Assumed:* one exists. If not, T-22 falls back to `INV-{id}` and a proper numbering scheme becomes a follow-up, not part of this round.

**F. Invoice status enum.**
*Assumed:* draft / sent / paid / overdue, with overdue derived from due date rather than stored. If the existing enum differs, keep it and map the grouping order by meaning.

**G. Sign-in provider on the landing page.**
*Assumed:* Google. Substitute the real provider in the access copy; keep the sentence shape.

**H. Drag-and-drop library.**
F5 specifies drag at ≥1024 but not how. *Assumed:* whatever is already in the dependency tree; if nothing is, use the native HTML5 drag events rather than adding a dependency for one interaction, since the overflow menu is the guaranteed path and drag is the enhancement.

**I. Bottom navigation on phones.**
The audit specified a left nav at ≥1024 and a FAB on phones, but did not say how a phone user reaches four routes. *Added:* a bottom nav. This is the phone equivalent of a requirement the IA split creates; flagging it because it is the one structural element in this spec that the audit did not name.

**J. Filter state in the URL.**
`[SHARPENED]` The audit said "make the chip row an actual filter" without saying where the state lives. Put it in the query string — it makes a filtered board shareable and survives reload, at no cost.

**K. Multi-currency.**
Not raised by the audit; not built. If a creator invoices a foreign brand in USD, this spec's money formatter has no answer. Noting it, not solving it.
