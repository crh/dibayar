# Product decision brief — completeness audit follow-ups (2026-10-17)

For: Chris (product owner). Status: **Decision A APPROVED 2026-10-18** (see
its section); **every other item below NEEDS_OWNER_APPROVAL**, and no
recommendation is an approval. Source of truth
for the gaps: `docs/product/capabilities.json` (generated view:
`docs/product/capability-matrix.md`). Customer: one Indonesian creator
managing their own deals, not an agency.

## What the code did on 2026-10-17 (before Decision A was implemented)

- An invoice stores its own number, `subtotalIdr` (copied from the deal fee
  at creation), `withholdingTaxType` (NONE / PPH21 / PPH23), `dueDate` and
  `status` (DRAFT → SENT/DUE/OVERDUE → PAID). There is no issue-date column
  and no snapshot of document text.
- Brand, contact name, scope and payment terms on the invoice page, the PDF
  and the brand's `/i/` link are read **live from the deal** at render time
  (`src/lib/invoice-share.ts`). Observed: a contact name saved after issue
  appears on the brand's page on reload (CAP-INV-12).
- Both invoice-create paths send `withholdingTaxType: "NONE"`; there is no PPh
  control (CAP-INV-02). Beranda's estimate uses 5 % for PPh 21 and 2 % for
  PPh 23 (`src/lib/income-summary.ts`), labelled as planning only.
- One invoice per deal; no delete, void or replace; only the due date can
  change (CAP-INV-10). A saved deal's core fields cannot be edited in the UI,
  though `PATCH /api/deals/[id]` accepts them (CAP-DEAL-05, #55).

## Decision A — issued-invoice snapshot (CAP-INV-12; blocks #55)

**APPROVED 2026-10-18 by the product owner (Chris)**, recorded in the issue
#55 comment of 2026-10-18 ("Product-owner decision — APPROVED (2026-10-18):
CAP-INV-12 / Decision A"). Approved policy, verbatim in substance:

- Draft invoices may reflect current deal and issuer/Settings values until the
  first issuance/external-sharing boundary.
- At the first transition out of Draft **or** the earliest action that makes
  a public invoice available (a recipient-accessible share link), whichever
  comes first, the document fields are captured atomically and locked. A
  share link on a Draft must not serve mutable live fields.
- The snapshot covers brand, contact name, scope, payment terms and the
  issuer identity, bank and payment details rendered to the owner, the public
  link and the PDF. Invoice-native number, subtotal, PPh and due date stay
  consistent and are never silently overwritten by deal edits. Once frozen,
  never unfrozen on a status reversal.
- Existing issued/shared invoices: additive migration with a one-time
  reconstruction from currently available deal/Settings values, explicitly
  marked as captured during migration, not authenticated original issuance
  data. No invented historic values.
- Later deal or Settings edits must not silently alter a frozen invoice or a
  previously shared recipient document.
- Approval covers Decision A only: not Decision B (correction/void), not
  Decision C (PPh), not a Production migration or deployment.

Implementation: `InvoiceSnapshot` (migration
`20261018000000_invoice_document_snapshot`, `src/lib/invoice-snapshot.ts`).
The explicit due-date editor (MAN-DUE-01) is kept: the due date is
invoice-owned, and an owner's deliberate edit of it still changes the owner's
PDF, the brand's page and PDF. Whether a sent invoice's due date should stay
editable belongs to Decision B.

The original options, for the record:

Why first: once #55 lets a creator edit brand, scope or payment terms, every
already-sent invoice will silently change for the brand.

| Option | Effect |
|---|---|
| **Snapshot at send (proposed default)** | Copy brand, contact name, scope, payment terms (and issuer details) onto the invoice when it leaves Draf. Drafts keep following the deal; sent and paid documents never change. |
| Live (today) | Simplest; brand-facing history can change after the fact. |
| Live + warning | Editing a deal with a sent invoice warns "this changes invoice X". Still mutates the document. |

Owner decides: which option; when the snapshot is taken (create vs first
send/share); what existing SENT/PAID invoices show after the change (proposed:
a one-time backfill from the deal's current values, flagged as "captured at
migration", since the original text was never stored). Migration only after
approval.

## Decision B — correcting an invoice (CAP-INV-10, #56) — NEEDS_OWNER_APPROVAL

Proposed default: **edit freely while Draf; once sent or paid, void and
replace** — the old invoice stays visible as Dibatalkan with a reason and a
link to its replacement, the replacement takes a new number (never reuse a
number), and the brand's old link says it was replaced. No silent edits of a
sent amount or PPh. Owner decides: the mechanism, the state names and
transitions, numbering of the replacement, whether a paid invoice can be
voided at all. An accountant should confirm the numbering/void rules before
build.

## Decision C — PPh choice at invoice creation (CAP-INV-02, #57) — NEEDS_OWNER_APPROVAL

Proposed: an explicit PPh 21 / PPh 23 / Tidak ada choice at creation, default
Tidak ada, editable while Draf, with copy that it is an estimate. **Before
enabling, have an accountant verify the rates and when each applies**: the app
uses a flat 5 % (PPh 21) and 2 % (PPh 23); for an individual creator the
brand's withholding is often PPh 21 on 50 % of gross (an effective rate
below 5 %), and PPh 23 normally applies to a company payee. This is a
question to verify, not a finding. Owner decides: in the first creator MVP or
not, and the default.

## P2 backlog — owner classifies (no REQUIREDs inferred)

| Item | Proposal | Release? |
|---|---|---|
| #58 delete a mistaken deal (CAP-DEAL-09) | Delete with confirmation; refuse when an invoice exists, pointing to Decision B | Minimum release candidate (small; API exists) |
| #59 invoice shows client and links to its deal (CAP-INV-03) | Show brand + link to `/deal/:id` on invoice detail | Minimum release candidate (small) |
| FIND-11 clearing an optional field (CAP-DEAL-08) | Emptying the contact name clears it; never report a save that did not happen | Fix with #55 (it is a false-success defect) |
| CAP-DEAL-10 lost / cancelled deal | Interview creators first (stage naming) | Roadmap |
| CAP-INV-13 paid invoice vs Dibayar stage | Decide which drives which; today they are independent | Decide with B |
| CAP-ACC-01 account and data deletion | Needs legal review (UU PDP) | Decide before public launch |
| CAP-HOME-05 non-deal income | Out of MVP unless interviews say otherwise | Roadmap |

## Order once approved

1. Decision A (snapshot) — schema + migration PR, tests that a sent invoice's
   document is unchanged after a deal edit (extend
   `e2e/deals/deal-change-keeps-invoice.spec.ts`).
2. #55 deal edit (+ FIND-11) — the #55 tripwire then passes; convert it into
   the edit journey and close CAP-DEAL-05/06/08.
3. Decision C (PPh) and Decision B (correction) — after accountant review.
4. #58 and #59 — small, independent; can ship any time after their decisions.

Each on its own `feature/*` branch → `staging`, with E2E journeys in
chromium, chromium-mobile and WebKit, and a real-phone check of the new
controls before release.
