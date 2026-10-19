# Receipt — Decision A invoice snapshots and #55 deal edit (2026-10-18)

Status: **COMPLETE on `staging`** for the two authorized work packages. No
`main`, Production, Production database, Vercel Production, Neon branch,
OAuth or branch-protection change. Release stays gated (see §7).

## 1. Authority and scope

- Decision A approved by the product owner in the issue #55 comment of
  2026-10-18 ("Product-owner decision — APPROVED (2026-10-18): CAP-INV-12 /
  Decision A"). Staging only. **Decision B (#56) and Decision C (#57) remain
  NEEDS_OWNER_APPROVAL** and were not implemented.
- The task brief authorized feature branches, PRs and merges of reviewed,
  green PRs into `staging`.

## 2. SHAs and PRs

| What | SHA / link |
|---|---|
| `staging` at start (re-fetched) | `5129ca4214d9bbeae697e258d0f6228d52985545` |
| `main` at start and at end | `308a339e7de817aa37378d263d51f25c78ea4f09` (unchanged) |
| PR #62 — Decision A snapshots | https://github.com/crh/dibayar/pull/62, head `c0d30dad9770bd74067432c9a2fe9a882be176fe` (commits `4c27f6e`, `c0d30da`) |
| `staging` after #62 | merge `63b9e3c79dc949a5f0d85f909ed8c409d922f0a0` |
| PR #63 — #55 deal edit + FIND-11 | https://github.com/crh/dibayar/pull/63, head `abdb60a3107c38ae8884832ccc88f46ff430a371` (commits `216d568`, `abdb60a`) |
| `staging` after #63 | merge `3e410dad1f05e61519956bd9c5f018860a333501` |

Both merged with a merge commit and `--match-head-commit` on the exact head
whose checks were green.

## 3. Checks

| Run | Head | Result |
|---|---|---|
| CI 39089291261 | `4c27f6e` | success; `test:snapshot-db` 15/15; e2e-critical 308 passed / 0 failed |
| Journey coverage (full) 39089291237 | `4c27f6e` | success |
| CI 39091936114 | `c0d30da` (#62 final) | success (lint-typecheck-test, e2e-critical, e2e-a11y, ux-audit) |
| Journey coverage (full) 39091936058 | `c0d30da` | success |
| CI 39093024089 | `63b9e3c` (staging) | success |
| CI 39093250135 | `216d568` | success |
| CI 39095099575 | `abdb60a` (#63 final) | success; e2e-critical 326 passed / 0 failed; 158 real claims passed |
| Journey coverage (full) 39095099636 | `abdb60a` | success |

Required checks on `staging` (ruleset): lint-typecheck-test, e2e-critical,
e2e-a11y, ux-audit. Review-thread resolution is required.

**Review threads (Codex):** #62 had 2 (frozen notice not updated after an
exposure made on the page; WhatsApp brand stale after the link froze the
document). #63 had 2 (Tab could leave the discard confirmation; focus not
restored to the card after the editor closed). All four were valid, fixed with
regression tests, answered and resolved before merge.

**Local (disposable DB `127.0.0.1:55432/dibayar_test`):**

- unit tests, full suite: 1147 passing at `4c27f6e` and 1197 at `216d568`. The review-fix commits (`c0d30da`, `abdb60a`) ran only their affected test files locally (invoice detail 97/97; deals 119/119); their full suites ran in CI's `lint-typecheck-test`, which passed;
- lint, typecheck and build pass;
- coverage: `coverage:journeys` and `coverage:capabilities` OK;
- e2e on Chromium desktop and 390 px:
  - invoice, settings, public, journeys, whatsapp and security: 118 passed;
  - deals: 128 passed;
- WebKit desktop and 390 px emulation (`iPhone 13` device at 390 × 844, local config not committed): the #55, CAP-INV-11 and Decision A journeys passed 48/48 over two repeats. The first WebKit run had two failures, both test-side and fixed:
  - a reload that cancelled the editor's read-back;
  - `fill()` not reaching React state under touch emulation (the app correctly saved what its state held).

## 4. Decision A — what was built

- **Freeze boundary:** the first move out of DRAFT, or the first share link (create, rotate, or `ensure` for a reminder), whichever comes first. A share link on a Draft is a freeze point. The snapshot is written in the same transaction, before the status or share write.
- **What is frozen** (`InvoiceSnapshot`, 1:1): brand, contact name, scope, payment terms, issuer name, address, WhatsApp and email, and bank name, number and holder. It also records:
  - `issuerSettingsPresent`, `provenance` and `trigger`;
  - `sourceDealUpdatedAt` and `sourceSettingsUpdatedAt`;
  - `capturedAt` (timestamptz).
- **Invoice-owned fields stay on Invoice:** number, subtotal, PPh, issue date and due date.
- **Renderers:**
  - the owner's PDF, the brand's `/i/` page and the public PDF read only the snapshot once it exists;
  - the public lookup no longer selects the deal or Settings at all;
  - an unshared Draft renders live;
  - an exposed invoice with no snapshot is frozen at that read (`RECONSTRUCTED_LATE`) and never rendered live; if no snapshot can be captured, it errors.
- **Immutability:** a `BEFORE UPDATE` trigger rejects any UPDATE. Freezing is `INSERT … SELECT … ON CONFLICT ("invoiceId") DO NOTHING`, so it is exactly-once and owner-scoped. Revoke, rotate, PAID→SENT, and deal or Settings edits never change it.
- **Due date (MAN-DUE-01):** the explicit editor is unchanged. It is the owner deliberately editing the invoice, not a deal or Settings side effect, so no owner decision gate was needed. Whether a sent invoice's due date stays editable belongs to Decision B. This is recorded in `src/lib/invoices.ts` and the decision brief.
- **Owner UI:**
  - the incomplete-issuer notice judges the document the brand has;
  - a frozen incomplete invoice gets its own notice ("Perubahan di Pengaturan tidak mengubah invoice ini");
  - the WhatsApp `{brand}` token uses the frozen brand.

### Migration `20261018000000_invoice_document_snapshot`

- Additive only: a new table, two enums, and a trigger plus function. No existing column changes.
- **Backfill:** every invoice with `status <> 'DRAFT'` or any share row (active or expired). Rows are built from the deal and Settings values current at migration time and labelled `RECONSTRUCTED_ON_MIGRATION` / `MIGRATION`. They are never labelled as originals.
  - A missing Settings row stays null (`issuerSettingsPresent = false`).
  - Re-running is a no-op.
  - Each row keeps `sourceDealUpdatedAt` and `sourceSettingsUpdatedAt`. A value at or before the invoice's `createdAt` means that source had not changed since the invoice was made; a later one means the copy may differ from what was issued.
- **Provenance limits:**
  - A Draft that was shared and then revoked before the migration left no trace and is not frozen by it. It freezes at its next exposure.
  - Reconstructed text is an approximation: it is today's deal and Settings text, not proven to be what the brand originally received.
- **Applied:**
  - disposable local test DB, via `prisma migrate deploy`;
  - CI Postgres;
  - **Neon `staging`**, by the Vercel build of `63b9e3c`. Deployment `dpl_89RfZxYnLbPmvTJkpsNgdTPQjLec` (target `preview`) logged "Applying migration `20261018000000_invoice_document_snapshot` … All migrations have been successfully applied". The next deployment, `dpl_BSktgprFNbC812RpFkabPWbnCFSp` for `3e410da`, logged "14 migrations found … No pending migrations".
- **Not verified:** row counts of the staging backfill. Neon staging was not queried.
- **Production:** not applied and not read. It will apply when a separately authorized `staging → main` release deploys.
- **Rollback:** the previous app version ignores the table, so a code revert is safe without touching the schema.
- **Real-PostgreSQL proof** (`npm run test:snapshot-db`, now in CI): it replays all earlier migrations into a throwaway schema, seeds legacy rows (Draft, shared Draft, SENT, PAID with an expired share, OVERDUE unshared, an owner with no Settings), then applies the migration and checks:
  - backfill scope and provenance;
  - exact copies, and nulls when Settings are missing;
  - an idempotent re-run;
  - UPDATE rejected;
  - edits after the freeze do not change it;
  - PAID→SENT and revoke do not thaw it;
  - cascade delete;
  - `CAPTURED_ON_ISSUE` vs `RECONSTRUCTED_LATE`;
  - 8 concurrent exposures produce 1 row;
  - retry, rollback and a foreign owner.

  Result: 15/15 locally and in CI.

## 5. #55 deal edit and FIND-11 — what was built

- **Entry points:** "Ubah deal" in every card's ⋮ menu (all six stages) and on deal detail. It opens the create form prefilled with every field, with "Simpan perubahan" and "Batal", in id and en. The dialog uses focus trapping, 44 px targets and a full-screen layout on phones.
- **PATCH contract:**
  - only the changed fields are sent, never `status`;
  - success is reported only after a no-store read-back shows the change;
  - a no-answer save is settled by that read-back;
  - 400 marks the named fields; 401, 403 and 429 use the shared messages; 404 is its own message;
  - one PATCH per save.
- **Discard flow:** "Buang perubahan yang belum disimpan?" replaces the form until it is answered. Focus returns to the card's ⋮ or to the detail button.
- **Invoiced deal:** a note says the invoice's amount, number, PPh and due date, and a sent or shared invoice's content, are not changed. Nothing syncs to invoices.
- **FIND-11 fixed:** `dealPatchSchema` treats omitted as unchanged, and `null` or blank as clear (contact name, payment terms, deadline). Deal detail's own contact-name save sends `null` and reads it back, then says "Nama kontak dihapus".
- **Also fixed:** the fee no longer coerces `null`, blank text or `false` to Rp 0, for create or patch.
- **Inventory and capabilities:**
  - DEAL-EDIT-01..07 added;
  - the CAP-DEAL-05, -06 and -08 gaps are closed, so REQUIRED covered goes from 28/35 to 31/35;
  - CAP-INV-12 is now REQUIRED, with the Decision A rationale (INV-DOC-01);
  - the #55 tripwire is now a real passing check;
  - MAN-DEAL-02 was added for physical phones.

**#55 issue:** left **open**. Its item 1 asks for usability on a physical iPhone Safari and an Android Chrome phone, and MAN-DEAL-02 has not been run.

## 6. Not changed / not done

- `main`, Production, the Production DB, Vercel and Neon settings, OAuth, rulesets and secrets: untouched. No release PR was opened.
- Decision B (correct, void or replace an invoice) and Decision C (PPh choice) were not implemented.
- Not done:
  - no Neon staging row counts;
  - no hosted signed-in smoke: the staging alias is SSO-protected and no session was used;
  - no physical-device check;
  - no Google OAuth check.

## 7. Remaining gates (none passed by this work)

- **MAN-DEAL-02** (new, P1) on a physical iPhone and Android phone, on `3e410da` or later.
- **MAN-DUE-01** (P0) on a physical iPhone and Android phone. The earlier iPhone deal-create PASS on `928c0e1` does not carry forward.
- **MAN-AUTH-01** (hosted Google sign-in and sign-out).
- **MAN-REL-01** (staging release smoke).
- **FIND-10:** read-only Production impact query, not run.
- **Release note for Chris:** the `staging → main` release will run this migration's backfill on Production. On Production it reconstructs snapshots, from current deal and Settings values and labelled as such, for every invoice that is no longer DRAFT and every DRAFT that still has a share row (active or expired). A DRAFT whose link was revoked before the release has no share row, so it gets no snapshot then; it freezes at its next exposure (§4).

## 8. Next recommended action

Chris: run MAN-DEAL-02 and MAN-DUE-01 on real phones against the staging
alias (`3e410da`). Then decide whether a sent invoice's due date should stay
editable as part of Decision B (#56), and schedule the release review,
including the Production backfill note above.
