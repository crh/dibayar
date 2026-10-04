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

Stored status changes only through the buttons the UI offers. The server
also allows `SENT → OVERDUE`, but no UI control offers it, so it is not a user action.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: create from deal (DEAL-INV-01, DEAL-DETAIL-05)
    DRAFT --> SENT: Tandai sudah dikirim (INV-STATUS-01)
    SENT --> DUE: Tandai jatuh tempo (INV-STATUS-02)
    SENT --> PAID: Tandai lunas (INV-STATUS-03)
    DUE --> OVERDUE: Tandai terlambat (INV-STATUS-05, BLOCKED FIND-01)
    DUE --> PAID: Tandai lunas (INV-STATUS-03)
    OVERDUE --> PAID: Tandai lunas (INV-STATUS-06, UNTESTED)
    PAID --> SENT: Batalkan status lunas (INV-STATUS-04)
```

| Edge | Control | Action | Status |
|---|---|---|---|
| create → DRAFT | Buat invoice (card menu / deal detail) | DEAL-INV-01, DEAL-DETAIL-05 | real (both) |
| DRAFT → SENT | Tandai sudah dikirim | INV-STATUS-01 | real + reload |
| SENT → DUE | Tandai jatuh tempo | INV-STATUS-02 | real + reload |
| SENT → PAID | Tandai lunas | INV-STATUS-03 | partial (no reload, old test) |
| DUE → PAID | Tandai lunas | INV-STATUS-03 | real + reload |
| DUE → OVERDUE | Tandai terlambat | INV-STATUS-05 | **BLOCKED** (FIND-01 product decision) |
| OVERDUE → PAID | Tandai lunas | INV-STATUS-06 | **UNTESTED** (needs overdue fixture) |
| PAID → SENT | Batalkan status lunas | INV-STATUS-04 | real + reload |
| any → failure | PATCH error | INV-STATUS-07 | **UNTESTED** |
| SENT → OVERDUE | none (server-only) | — | not a user action |

**Displayed vs stored status.** The chip shows `deriveInvoiceDisplayStatus`:
`DRAFT`/`PAID` as stored. For anything else it shows `OVERDUE` when the
Jakarta due date is past, and a stored `OVERDUE` falls back to `SENT` when it
is not. The action buttons follow the *stored* status. So after `DUE → OVERDUE`
with no past due date, the person sees chip **Terkirim** with only
**Tandai lunas** offered (FIND-01). Date-derived display is a pure function
with unit tests (`src/lib/invoice-date-status.test.ts`), and its rendering is
checked by `tests/ux-audit/states/needs-chasing.spec.ts`.

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
| consistent display across header/list/queue/WhatsApp | INV-DUE-05 | partial (unit) |

FIND-02 and FIND-03 were fixed by PR #26 (merge `b51fba1`, staging only).

Boundary cases still open: a due date of today (Jakarta) versus yesterday
around midnight UTC+7, a year boundary, and the English "Not set" label on
the same path (covered by MAN-DUE-01 step 8; automated as part of SET-06 in Batch 1).

## 3. Share link (owner) and recipient view

```mermaid
stateDiagram-v2
    [*] --> Absent
    Absent --> Active: Buat tautan berbagi / first WhatsApp send (SHARE-01, INV-WA-01)
    Active --> Active: Buat ulang tautan + confirm (SHARE-02)
    Active --> Absent: Cabut tautan + confirm (SHARE-03)
    Active --> Expired: lifetime elapses (PUB-03, seeded)
    Active --> Active: cancel confirm (SHARE-04, UNTESTED)
```

| Recipient opens `/i/<token>` when the share is… | Expected | Action | Status |
|---|---|---|---|
| active | invoice, no owner controls | PUB-01 | real |
| unknown token | generic not-found | PUB-02 | real |
| expired | honest expired state, no data | PUB-03 | real (seeded expiry) |
| revoked while open | not-found after reload | PUB-04 | real (owner revokes via UI) |
| active, PDF | download with parity | PUB-05, PUB-06 | partial (request API) + MAN-PDF-01 |

## 4. Deal pipeline

Stages: `MASUK → NEGO → DEAL → KONTEN → INVOICE → DIBAYAR`. Only adjacent
moves are offered (card menu, deal detail, desktop drag).

| Move | Control | Action | Status |
|---|---|---|---|
| next stage, card menu | Lanjut ke … | DEAL-STAGE-01 | real + reload |
| next stage, detail page + history | Lanjut ke … | DEAL-STAGE-03 | real + reload |
| previous stage | Kembali ke … | DEAL-STAGE-02 | **UNTESTED** |
| drag between columns (desktop) | drag and drop | DEAL-STAGE-04 | real (ux-audit) |
| keyboard move | Tab, Enter, menu | DEAL-STAGE-05 | real (ux-audit) |
| INVOICE → invoice | Buat invoice | DEAL-INV-01, DEAL-DETAIL-05 | real |

## 5. Permissions

| Persona \ resource | Own deal/invoice | Other owner's deal/invoice | Public `/i/<token>` | Protected route |
|---|---|---|---|---|
| Owner (session) | full (all actions above) | not-found UI / 404 API (INV-OWN-01, real) | view | allowed |
| Second owner | — | denied (INV-OWN-01, real) | view | allowed (own data only) |
| Recipient (no session) | — | — | view only, no owner controls (PUB-01, real) | redirect to sign-in (AUTH-01, real) |
| Expired session | — | — | view | redirect (AUTH-07, **UNTESTED**) |

## 6. Combination policy (no Cartesian products)

- **Per-PR gate**: `chromium` (desktop) and `chromium-mobile` (390px, touch),
  Indonesian, deterministic fixture. Each new journey must state which of
  the two projects it runs in and why the other is skipped.
- **Pairwise, not exhaustive**: language is varied on one journey per
  surface (SET-06 in Batch 1), not on every journey. Firefox/WebKit come
  from the scheduled `e2e-cross-browser` tier.
- **Targeted multi-condition cases** where the risk is real: money (IDR
  formatting, PPh), dates and time zone (Jakarta calendar date vs UTC,
  INV-DUE-05), authorization (INV-OWN-01), and share lifetimes (PUB-03/PUB-04).
- **No duplicate E2E for pure calculations** that unit tests already prove
  (income summary, due-date derivation, invoice numbering). Keep E2E where
  routing, permissions, persistence or the visible control matter.
