# Journey and state graphs

State models for Dibayar's critical workflows, derived from the implemented
code (not from plans). Every edge names the inventory action that covers
it (`docs/testing/journey-coverage.json`) and its current status. Edges marked
**UNTESTED**, **BLOCKED** or **MANUAL** are open gaps. `npm run coverage:journeys`
fails if an action ID here does not exist in the inventory.

Sources: `src/lib/invoices.ts` (`ALLOWED_STATUS_TRANSITIONS`),
`src/app/(app)/invoice/[id]/invoice-detail-client.tsx` (`NEXT_ACTIONS`),
`src/lib/invoice-date-status.ts` (`deriveInvoiceDisplayStatus`),
`src/lib/invoice-share.ts`, `src/lib/deals.ts`, `prisma/schema.prisma`.

## 1. Invoice payment status

Stored status changes only through the buttons the UI offers. Nothing moves
an invoice *to* `OVERDUE`: overdue is derived from the due date, the
**Tandai terlambat** button was removed, and the status API rejects the
transition (FIND-01, fixed). A stored `OVERDUE` exists only on rows written
before that.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: create from deal (DEAL-INV-01, DEAL-DETAIL-05)
    DRAFT --> SENT: Tandai sudah dikirim (INV-STATUS-01)
    SENT --> DUE: Tandai jatuh tempo (INV-STATUS-02)
    SENT --> PAID: Tandai lunas (INV-STATUS-03)
    DUE --> PAID: Tandai lunas (INV-STATUS-03)
    OVERDUE --> PAID: Tandai lunas, legacy stored rows (INV-STATUS-06)
    PAID --> SENT: Batalkan status lunas (INV-STATUS-04)
```

| Edge | Control | Action | Status |
|---|---|---|---|
| create → DRAFT | Buat invoice (card menu / deal detail) | DEAL-INV-01, DEAL-DETAIL-05 | real (both) |
| DRAFT → SENT | Tandai sudah dikirim | INV-STATUS-01 | real + reload |
| SENT → DUE | Tandai jatuh tempo | INV-STATUS-02 | real + reload |
| SENT → PAID | Tandai lunas | INV-STATUS-03 | partial (no reload, old test) |
| DUE → PAID | Tandai lunas | INV-STATUS-03 | real + reload |
| DUE → OVERDUE | none: removed | INV-STATUS-05 (not applicable) | not a user action. The journey for SENT → DUE asserts the button is absent; `src/lib/invoices.test.ts` asserts the API rejects it |
| OVERDUE → PAID | Tandai lunas | INV-STATUS-06 | real + reload, list and Beranda agree (`overdue-invoice.spec.ts`, follow-up overlay invoice stored OVERDUE) |
| PAID → SENT | Batalkan status lunas | INV-STATUS-04 | real + reload |
| any → failure | PATCH error | INV-STATUS-07 | **UNTESTED** |
| SENT → OVERDUE | none | — | not a user action; rejected by the API |

**Displayed vs stored status.** The chip shows `deriveInvoiceDisplayStatus`:
`DRAFT`/`PAID` as stored. For anything else it shows `OVERDUE` when the
Jakarta due date is past, and a stored `OVERDUE` falls back to `SENT` when it
is not. The action buttons follow the *stored* status, minus
**Tandai jatuh tempo** on an invoice already shown as overdue, so every
overdue invoice offers only **Tandai lunas**. A legacy row stored `OVERDUE`
without a past due date shows chip **Terkirim** and **Tandai lunas**.
Date-derived display is a pure function
with unit tests (`src/lib/invoice-date-status.test.ts`), and its rendering is
checked by `tests/ux-audit/states/needs-chasing.spec.ts`. In the browser,
`e2e/home/follow-up-queue.spec.ts` (HOME-02) checks the derived reasons on
the Jakarta-date boundaries (due yesterday, today, in 7 and in 8 days) on the
follow-up overlay, and that a stored-SENT invoice due yesterday opens as
**Terlambat** with **Kirim pengingat**. The invoice *list* uses the same
function for its groups and chips (FIND-06, fixed):
`e2e/invoices/status-consistency.spec.ts` checks that list, detail and
Beranda agree for stored `SENT`, `DUE` and `OVERDUE` rows on both sides of
the due date, on the `status-consistency` overlay.

## 2. Invoice due date

```mermaid
stateDiagram-v2
    [*] --> Empty: invoice created, deal had no deadline
    [*] --> Set: invoice created, deal deadline (2000-2099) copied
    [*] --> LegacyInvalid: row stored before PR #26 with an out-of-range date
    Empty --> PickerOpen: click/tap visible field (INV-DUE-02)
    Set --> PickerOpen: click/tap visible field (INV-DUE-02)
    PickerOpen --> Set: choose date in native picker (INV-DUE-03, MANUAL)
    PickerOpen --> Empty: dismiss picker (INV-DUE-03, MANUAL)
    Empty --> Draft: desktop keyboard typing, nothing sent (INV-DUE-04)
    Set --> Draft: desktop keyboard typing, nothing sent (INV-DUE-04)
    Draft --> Set: Enter / leave with a complete 2000-2099 date, one PATCH (INV-DUE-04)
    Draft --> Draft: incomplete or out-of-range on leave, hint, no PATCH (INV-DUE-04)
    Draft --> Set: Escape restores the saved date (INV-DUE-04)
    Set --> Empty: Kosongkan (INV-DUE-01)
    Set --> SaveError: PATCH fails, field reverts to the saved date (INV-DUE-06, partial)
    LegacyInvalid --> Empty: Kosongkan
    LegacyInvalid --> Set: type a new date
```

| Edge | Action | Status |
|---|---|---|
| Set → Empty → reload | INV-DUE-01 | real, desktop + mobile |
| Empty/Set → picker opens (click/tap on visible text) | INV-DUE-02 | real, Chromium desktop + 390px mobile emulation (`due-date-integrity.spec.ts`); Firefox/WebKit pass but are feature-detected, so not claimed; real phones **MANUAL** MAN-DUE-01 |
| picker → date chosen → saved → reload | INV-DUE-03 | **MANUAL** MAN-DUE-01; server persistence partial via `fill()` (desktop only) |
| Empty → keyboard typed → Enter → reload → cleared | INV-DUE-04 | real, desktop Chromium: zero PATCHes while typing (through `0002-01-15`), one on Enter, out-of-range refused, Escape restores |
| save failure → revert + retry | INV-DUE-06 | partial: component test plus browser journeys whose failure is injected with `page.route` |
| legacy out-of-range row → page usable, correctable | (FIND-03 regression) | real, `due-date-integrity.spec.ts`; not a separate inventory action |
| consistent display across header/list/queue/WhatsApp | INV-DUE-05 | real (desktop Chromium; Asia/Jakarta and Pacific/Honolulu browsers) |
| due date on the recipient's page and PDF, deal with no payment terms | INV-DUE-05, PUB-01, PUB-05, PUB-06 (FIND-08 regression) | real, desktop + mobile, both timezones (`e2e/public/due-date-without-terms.spec.ts`) |

FIND-02 and FIND-03 were fixed by PR #26 (merge `b51fba1`, staging only).

Today versus yesterday (Jakarta) is automated for the follow-up queue
(HOME-02, the overlay computes its dates from the Jakarta calendar day and the
test fails loudly if a run straddles Jakarta midnight). Still open: a year
boundary. The English "Due date" label and
"Not set" empty state after **Clear** and a reload are automated as part of
SET-06 (`e2e/settings/language.spec.ts`, Batch 1); choosing a date in the
native picker stays MAN-DUE-01.

## 3. Share link (owner) and recipient view

```mermaid
stateDiagram-v2
    [*] --> Absent
    Absent --> Active: Buat tautan berbagi / first WhatsApp send (SHARE-01, INV-WA-01)
    Active --> Active: Buat ulang tautan + confirm (SHARE-02)
    Active --> Absent: Cabut tautan + confirm (SHARE-03)
    Active --> Expired: lifetime elapses (PUB-03, seeded)
    Active --> Active: cancel confirm (SHARE-04)
    Absent --> Active: Beranda Kirim pengingat creates a link (HOME-03)
    Active --> Active: Beranda Kirim pengingat, same token (HOME-03)
    Expired --> Active: Beranda Kirim pengingat issues a new token (HOME-03)
    Active --> Active: invoice detail WhatsApp / Kirim pengingat, same token (INV-WA-01, INV-STATUS-06)
    Expired --> Active: invoice detail Kirim pengingat issues a new token (INV-STATUS-06)
    Expired --> Active: Buat tautan baru (SHARE-01)
```

Beranda's **Kirim pengingat** calls `POST /share/ensure` (`ensureShare`): it
sends the invoice's existing link when that link is usable -- unexpired, and
its path recoverable -- and writes nothing, so the expiry is not extended. It
issues a new link only when there is none, it has expired, or its path cannot
be recovered. Only **Buat ulang tautan** (`POST /share`,
`createOrRegenerateShare`) rotates a usable link. This fixed FIND-05
(reminders used to rotate, so a link the brand already had returned 404);
`e2e/invoices/reminder-share-link.spec.ts` drives every edge above plus
SHARE-02 with a session-less recipient.

An invoice has one share row, so replacing an expired link leaves the old
token unknown: the old URL then shows the generic not-found page, not the
expired page.

Invoice detail's WhatsApp action (**Kirim lewat WhatsApp** / **Kirim
pengingat**) uses the same `POST /share/ensure` since the FIND-07 fix, so it
too reuses a usable link and replaces an expired one. The owner's share state
(`GET /share`, `getShareState`) is one of **inactive**, **active** or
**expired**: an expired share reads "Tautan berbagi sudah tidak berlaku." with
the date it ended and offers **Buat tautan baru** (one step, `POST /share`);
its path never reaches the browser. Opening the page never changes the share.
`e2e/invoices/expired-share.spec.ts` drives these.

| Recipient opens `/i/<token>` when the share is… | Expected | Action | Status |
|---|---|---|---|
| active | invoice, no owner controls | PUB-01 | real |
| active, after the owner edits bank details | the new **Pembayaran ke** values | SET-03 | real (link from the owner's page, session-less context) |
| unknown token | generic not-found | PUB-02 | real |
| expired | honest expired state, no data | PUB-03 | real (seeded expiry) |
| revoked while open | not-found after reload | PUB-04 | real (owner revokes via UI) |
| active, PDF | download with parity | PUB-05, PUB-06 | real (clicked download, pdftotext) + MAN-PDF-01 for phone viewers |

## 4. Deal pipeline

Stages: `MASUK → NEGO → DEAL → KONTEN → INVOICE → DIBAYAR`. Only adjacent
moves are offered (card menu, deal detail, desktop drag).

| Move | Control | Action | Status |
|---|---|---|---|
| next stage, card menu | Lanjut ke … | DEAL-STAGE-01 | real + reload |
| next stage, detail page + history | Lanjut ke … | DEAL-STAGE-03 | real + reload |
| previous stage, detail page + history | Kembali ke … | DEAL-STAGE-02 | real + reload |
| previous stage, card menu | Kembali ke … | DEAL-STAGE-02 | real + reload |
| drag between columns (desktop) | drag and drop | DEAL-STAGE-04 | real (ux-audit) |
| keyboard move | Tab, Enter, menu | DEAL-STAGE-05 | real (ux-audit) |
| INVOICE → invoice | Buat invoice | DEAL-INV-01, DEAL-DETAIL-05 | real |

## 5. Permissions

| Persona \ resource | Own deal/invoice | Other owner's deal/invoice | Public `/i/<token>` | Protected route |
|---|---|---|---|---|
| Owner (session) | full (all actions above) | not-found UI / 404 API (INV-OWN-01, real) | view | allowed |
| Second owner | — | denied (INV-OWN-01, real) | view | allowed (own data only) |
| Recipient (no session) | — | — | view only, no owner controls (PUB-01, real) | redirect to sign-in (AUTH-01, real) |
| Expired session | no data: reload, Back and in-app links end on sign-in; a change is answered 401, shown as an error, nothing stored (AUTH-07, real) | — | view | redirect (AUTH-07, real) |
| Signed-out session (after **Keluar**) | — | — | view | redirect; the old token is refused from a fresh browser too (AUTH-05, AUTH-06, real) |

## 6. Combination policy (no Cartesian products)

- **Per-PR gate**: `chromium` (desktop) and `chromium-mobile` (390px, touch),
  Indonesian, deterministic fixture. Each new journey must state which of
  the two projects it runs in and why the other is skipped.
- **Pairwise, not exhaustive**: language is varied on one journey per
  surface (SET-06, `e2e/settings/language.spec.ts`), not on every journey. Firefox/WebKit come
  from the scheduled `e2e-cross-browser` tier.
- **Targeted multi-condition cases** where the risk is real: money (IDR
  formatting, PPh), dates and time zone (Jakarta calendar date vs UTC,
  INV-DUE-05), authorization (INV-OWN-01), and share lifetimes (PUB-03/PUB-04).
- **No duplicate E2E for pure calculations** that unit tests already prove
  (income summary, due-date derivation, invoice numbering). Keep E2E where
  routing, permissions, persistence or the visible control matter.

## 7. Long journeys: the edges one test walks in sequence

The graphs above are covered edge by edge in the short specs. The three long
journeys in `e2e/journeys/` (`chromium` and `chromium-mobile`) each walk a
path through several graphs in one sitting, so an edge that works alone but
breaks the next one is caught. They are extra evidence for edges that are
already real; they change no status above.

| Journey | Path | Actions on the path |
|---|---|---|
| `deal-to-paid.spec.ts` | create deal → `MASUK → NEGO` (card menu) → `NEGO → DEAL → KONTEN → INVOICE` (detail) → Buat invoice → `DRAFT → SENT` → no share → active share → WhatsApp send (link reused) → recipient page + PDF → `SENT → PAID` → `INVOICE → DIBAYAR` (card menu) → Beranda total | DEAL-CREATE-01, DEAL-CREATE-02, DEAL-STAGE-01, DEAL-STAGE-03, DEAL-DETAIL-05, INV-STATUS-01, INV-STATUS-03, SHARE-01, INV-WA-01, PUB-01, PUB-05, PUB-06, INV-PDF-01, HOME-01 |
| `settings-to-recipient.spec.ts` | Pengaturan save → reload → invoice detail → WhatsApp send (saved template, link reused) → owner PDF → recipient page + PDF → Pengaturan, Back, Forward | SET-03, SET-04, INV-WA-01, INV-PDF-01, PUB-01, PUB-05, PUB-06 |
| `resilience-permissions.spec.ts` | deal detail edit in progress → session expires → refused save and stage move → nav link, Back, Forward, reload → reused token → valid session unchanged → second owner → expired link → active link → revoke → reload, Back, Forward, PDF | AUTH-07, AUTH-01, INV-OWN-01 (reads only), PUB-02, PUB-03, PUB-04, SHARE-03 |

Not on any long journey: `SENT → DUE`, the PAID undo, regenerate, the
due-date picker (MAN-DUE-01; the desktop project types the date, the phone
project sets none), English, Firefox and WebKit.
