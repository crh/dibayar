# Dibayar product-completeness audit — 2026-10-17

**Verdict:** 34 capabilities are REQUIRED by the product documents. **27 have at least one real browser journey or manual gate; 7 do not exist in the UI at all**, and all 7 were invisible to the journey inventory because it lists only what the UI offers. Five more behaviours need a product decision. No feature was built. The audit adds a deterministic, blocking requirement-to-test check and a non-blocking exploration probe (PR below). Production stays **NO-GO**; this audit does not satisfy MAN-DUE-01, MAN-AUTH-01, MAN-REL-01 or the FIND-10 decision.

## 1. Version and environment

| Item | Value |
|---|---|
| Audited code | `origin/staging` `928c0e1102097c8c0bbd08d3aa278c4afc6d3ec3` (merge of PR #54), the SHA named in #55 |
| Branch | `chore/product-completeness-audit-2026-10-17`, from `928c0e1` plus `4209e83` (PR #60, see §8) |
| Environment | Local only: `next build --webpack` + `next start` on `127.0.0.1:3300`, isolated test database `127.0.0.1:55432/dibayar_test`, E2E fixture owner and synthetic data (`npm run e2e:fixtures` guardrails). No staging or Production page, account or data was opened. Hosted deployment SHA: **not inspected** (no hosted claims are made). |
| Browsers | Playwright Chromium desktop (1280), Chromium 390 px touch emulation, WebKit 390 px touch emulation (iPhone 13 profile). **No real phone**: native picker behaviour stays MANUAL PENDING. |
| Open PRs at start | #39 (dependabot). Open issues: #53, #55. |
| Created | Issues #56, #57, #58, #59; PR #60 (test clock fix); PR #61 (this audit); pilot comment on #55 |

## 2. Phase 1 — capability model (requirements first)

Written from `PRODUCT.md`, `ROADMAP.md`, `BACKLOG.md`, `dibayar-implementation-spec.md`, `SPEC_RECONCILIATION.md`, `M4-READINESS.md`, `SECURITY.md`, `CLAUDE.md`, #53 and #55 **before** opening the UI. File: `docs/product/capabilities.json`; generated view: `docs/product/capability-matrix.md`.

46 capabilities: **REQUIRED 34, PROPOSED 4, UNKNOWN 5, NOT_APPLICABLE 3**. Every one cites its source. Standard CRUD was not assumed: deal deletion is REQUIRED only because `ROADMAP.md` M1 names it; search, discard-confirmation, instalment invoices and income history are PROPOSED; line items, payment collection/email and income export are NOT_APPLICABLE by documented scope. All classifications are proposals for Chris.

Unsupported assumptions, stated plainly: CAP-INV-10 (correct a wrong invoice) is REQUIRED as an **outcome** inferred from "professional invoice" and the income figure, not from an explicit sentence; its mechanism is UNKNOWN. CAP-DEAL-06 relies on the spec's "inline-editable" WhatsApp number.

## 3. Phase 2 — exploration (visible controls only)

Three personas, bounded journeys, run in all three browser setups with identical results:

- **A, first-time creator:** typed a deal with fee `1500000` (meant 15.000.000), saved, then looked for any way to fix it: card menu, deal detail, double-click on the fee.
- **B, experienced creator:** opened a Konten deal; set then emptied the contact name; looked for a way to change a valid WhatsApp number; checked what a Nego deal offers.
- **C, creator with an invoice:** invoice list and detail; the invoiced deal's card and detail; changed the contact name after issue and reloaded the brand's page in a session-less context; marked the invoice paid and read the deal's stage.

Recorded control inventories (identical in all three setups):

| Screen | What a person can do |
|---|---|
| Add-deal dialog | brand, WhatsApp, contact name, scope, fee, deadline, payment terms |
| Card menu (any stage) | adjacent stage moves, **Buat invoice** (Invoice stage, no invoice yet), **Lihat detail** |
| Deal detail | stage moves, Buat invoice / view invoice, **Nama kontak** + Simpan, Buka WhatsApp (number field only when the number is invalid) |
| Invoice detail | Kirim lewat WhatsApp, Tandai jatuh tempo / lunas / Batalkan status lunas, share link (copy, regenerate, revoke, new), **due date** (the only editable field), Unduh PDF, `← Kembali ke dashboard` |

Observed behaviours: emptied contact name → "Nama kontak disimpan", old name back after reload (FIND-11, still open). A contact name saved after issue **appears on the brand's invoice page**. **Tandai lunas leaves the deal at Invoice.**

Evidence: the probe output (`test-results/completeness/controls-*.json`) and screenshots, synthetic data only; not committed (generated, `test-results/` is ignored). Reproduce with `npm run audit:completeness:probe`.

## 4. Phase 3 — triangulation and ranked gaps

Each gap was read in source (components, routes, schemas) and searched for an alternative screen before being called missing; the API is used only to explain a UI gap, never to claim one is closed.

| # | Capability | Kind | Steps (visible) | Expected | Observed | Source evidence | Risk | Tracked | Decision gate |
|---|---|---|---|---|---|---|---|---|---|
| 1 | CAP-DEAL-05 Correct brand/scope/fee/deadline/terms | missing | Board → ⋮ → menu; Lihat detail | An edit action | Stage moves + Lihat detail; detail edits contact name only | `deal-card.tsx`, `deal-detail-client.tsx`; `PATCH /api/deals/[id]` accepts all fields | **High**: typos at 60-second capture are common and there is no recovery at all (no edit, no delete) | #55 | #55 scope; CAP-INV-12 first |
| 2 | CAP-INV-10 Correct a wrong issued invoice | missing | Invoice detail; invoiced deal's menu | A way to a correct invoice | Only due date editable; Buat invoice not offered again; no void/delete | `canCreateInvoice = INVOICE && !hasInvoice` (`deal-card.tsx:40`); invoice PATCH = status or dueDate | **High**: wrong amount stays with the brand and in the monthly total; #55 fixes the deal but not its invoice | **#56** | Mechanism: Chris |
| 3 | CAP-INV-12 Issued document follows later deal edits | decision | Edit contact name on an invoiced deal; reload brand's page | Undecided | New name appears on the issued document | `invoice-share.ts:216` reads brand, contactName, scope, paymentTerms at render | **Medium now, high after #55** (brand/scope/terms edits would rewrite sent documents) | #55 comment | Chris, before #55 |
| 4 | CAP-INV-02 Choose PPh 21/23 | missing | Buat invoice anywhere | A PPh choice | Always NONE | `deal-client.tsx:325`, `deal-detail-client.tsx:83` | Medium: net figure and document wrong for withholding brands | **#57** | Build or decline: Chris (already flagged in M4-READINESS) |
| 5 | CAP-DEAL-06 Change a valid WhatsApp number | missing | Deal detail of a deal with a valid number | Editable number | Field shown only for invalid numbers | `deal-detail-client.tsx:339` | Medium: reminders go to an old contact | #55 | — |
| 6 | CAP-DEAL-09 Delete a mistaken deal | missing | Card menu, detail | Delete with confirm | None; API exists | `DELETE /api/deals/[id]`, no caller; inventory `DEAL-DELETE-01` N/A | Medium: clutter, counts toward a future free-tier limit | **#58** | P2, Chris |
| 7 | CAP-DEAL-08 Clear an optional field | defect | Empty contact name → Simpan → reload | Field empty | Success message, old value back | FIND-11 (`contactName || undefined`) | Low–medium: false success message | FIND-11 / #55 | FIND-11 triage (P3) |
| 8 | CAP-INV-03 Client and deal link on invoice detail | missing | Invoice detail | Client, deal link, issue date, terms (spec §4.5) | Number, amount, PPh, due date only | brand rendered only in the repair note (`invoice-detail-client.tsx:818`); T-19 packet omitted Details, no recorded deferral | Low–medium: can't confirm whom an invoice is for on a phone | **#59** | — |
| 9 | CAP-DEAL-10 Close a deal that fell through | decision | Nego deal menu | Undecided | Only Masuk/Deal moves; stays eligible for "3 deal terdekat" | `nearest-deals.tsx:15` excludes Dibayar only | Low–medium | — | Chris (M4 interview) |
| 10 | CAP-INV-13 Paid invoice vs Dibayar stage | decision | Tandai lunas, then deal detail | Undecided | Deal stays at Invoice | Independent state in schema | Low: two truths on board vs invoice list | — | Chris |

Also UNKNOWN (not ranked): CAP-ACC-01 account/data deletion (legal), CAP-HOME-05 non-deal income ("manual entry first" in `PRODUCT.md` non_goals).

### Skeptical pass

- *Truly required?* #1 has three sources (ROADMAP M1 "update", spec §3.3 "inline edit affordance", #55). #2 is inferred (stated above). #4 is explicit in PRODUCT/ROADMAP but the owner has an open build-or-decline decision, so the issue is framed as a decision. #6 rests on one ROADMAP word; kept P2.
- *Hidden alternate route?* All seven fixture stages' card menus, both invoice states, deal detail, Settings and the account menu were enumerated in three setups; moving an invoiced deal out of and back into Invoice does not bring Buat invoice back (`!hasInvoice`). None found.
- *Legitimate immutability?* For #2, yes for **editing an issued** invoice in place; the gap is the absence of *any* path (void/replace or draft-only edit), so the issue asks for a mechanism, not in-place edits.
- *Real journey or screenshot?* Each row above was attempted with clicks/taps; the probe records the controls, and CAP-INV-11/12/13 were exercised end to end including reloads.

## 5. Pilot: issue #55

- **Edit flow absent via normal UI: proven.** No edit action on any card menu (7 stages) or deal detail, in Chromium desktop, Chromium 390 px and WebKit 390 px. Deal detail edits only the contact name and, for an invalid number only, the WhatsApp number. Brand, scope, fee, deadline and payment terms are read-only. A permanent expected-failure test (`e2e/deals/deal-change-keeps-invoice.spec.ts`, "a saved deal can be edited from its card menu or its detail page (#55)") fails today and will start failing CI the day an edit ships, on the card menu or on deal detail (an edit action, or brand, scope, fee, deadline or payment terms editable in place), forcing the inventory and capability mapping to be updated. Its detector has positive and negative controls in `e2e/deals/deal-edit-affordance.spec.ts` (review thread on PR #61).
- **Stage invariant:** `dealPatchSchema` has no status default (FIND-10 fix), confirmed in source; the contact-name edit leaves the stage (`Tahap saat ini: Invoice`) after reload in the new journey.
- **Invoice invariants after a deal change, without mutating financial records:** the only deal change reachable today on an invoiced deal is the contact name. New `@critical` journey: change it via board → card menu → Lihat detail, then reload the owner's invoice (from the list) and the brand's page: **number, amount, PPh and due date unchanged** (chromium, chromium-mobile, WebKit desktop). Negative control: changing the invoice's due date behind the journey makes it fail on the due-date line. Fee and deadline edits cannot be audited through the UI because they do not exist; the code shows the invoice holds its own `subtotalIdr` and `dueDate`, so a future deal PATCH of fee/deadline will not change them unless new code syncs them. #55 must extend this journey rather than add a second.
- **Not protected:** brand, scope, payment terms and contact name on the issued document are read live (CAP-INV-12). The contact name already propagates today. This is the decision #55 needs before it adds brand/scope/terms editing.

## 6. Comparison: existing / missing from inventory / test gaps / manual gates

| Bucket | Capabilities |
|---|---|
| **Existing and covered by real journeys** (27) | AUTH-01..04, DEAL-01..04, DEAL-07, DEAL-11, INV-01, INV-04..09, INV-11, HOME-01..03, HOME-06, SET-01..03, RES-01, A11Y-01 |
| **Missing, zero representation in `journey-coverage.json`** (7) | DEAL-05, DEAL-06, DEAL-08, DEAL-09 (present only as `DEAL-DELETE-01` *not applicable*), INV-02, INV-03, INV-10. These are exactly what the inventory cannot catch. |
| **Covered but with partial evidence** | DEAL-01 (`DEAL-CREATE-07` partial: phone date picker), INV-01 (`DEAL-INV-03` partial), INV-05 (`INV-DUE-03` manual pending), RES-01 (five network-fault actions partial by rule), A11Y-01 (`A11Y-01`, `A11Y-04` partial) |
| **Manual device gates** (unchanged, not run here) | MAN-AUTH-01, MAN-DUE-01 (blocks release), MAN-DEAL-01, MAN-WA-01, MAN-PDF-01, MAN-SHARE-01, MAN-A11Y-01; MAN-REL-01 per release |

## 7. Phase 4 — prevention system (this PR)

- `docs/product/capabilities.json` + generated `capability-matrix.md`: hand-kept, independent of the UI and the inventory.
- `scripts/capability-coverage.mjs` (`npm run coverage:capabilities[:report]`), self-test `scripts/capability-coverage.test.mjs` (13 tests, negative controls per rule). **Blocking** in CI `lint-typecheck-test` (deterministic, no browser/DB). Fails when: a REQUIRED capability has no real/manual evidence and no gap; a mapped action is deleted or re-marked not applicable; a gap is stale; a pinned test leaves its action; a manual check has no `MAN-` section. Negative controls on the real files: removing #55's gap, re-marking `HOME-01` N/A, and dropping the pinned test each fail with a precise message. No percentage is gated.
- `e2e/deals/deal-change-keeps-invoice.spec.ts`: `@critical` finance-invariant journey (added as a second real test of `DEAL-DETAIL-02`; inventory metrics unchanged at 82/100, nothing re-classified) and the #55 expected-failure tripwire (not critical, never counted).
- `playwright.completeness.config.ts` + `tests/completeness/control-inventory.spec.ts` (`npm run audit:completeness:probe`): **non-blocking**, outside the inventory's configs, adds a `webkit-mobile` (390 px) setup.
- `docs/product/COMPLETENESS-AUDIT.md`: how the layers fit, how to change the model, and the LLM explorer brief (manual / pre-release, proposals only, not a CI gate until calibrated).
- Inventory: `DEAL-DELETE-01` reason now points at CAP-DEAL-09 / #58.
- No new dependency, no skipped or weakened test, no gate classification changed.

## 8. Validation (what actually ran)

| Check | Result |
|---|---|
| `npm run lint` | PASS (330 files, 0 errors, 0 warnings) |
| `npm run typecheck` | PASS |
| `npm test` | **FAIL on unchanged `928c0e1` today**: 2 tests in `src/lib/invoice-share.test.ts` hardcode a share expiring `2026-10-17T00:00Z`. Fixed test-only in **PR #60** (RED 2 failed → GREEN 44/44); with it: **1120/1120 PASS** |
| `npm run build` | PASS |
| `npm run test:journey-coverage` | PASS (37) |
| `npm run coverage:journeys` | PASS (102 actions, 82.0 % real, unchanged) |
| `npm run test:capability-coverage` / `coverage:capabilities` | PASS (13) / PASS (27/34 covered, 7 gaps) |
| New journey, local | chromium, chromium-mobile, WebKit desktop: PASS; tripwire: expected failure in all three; negative control: FAIL as intended |
| Probe, local | chromium, chromium-mobile, webkit-mobile: PASS, identical inventories |
| `npm run test:e2e:critical` (local, chromium + chromium-mobile) | PASS: 294 passed, 0 failed, 28 skipped (23.9 min); `coverage:journeys --results` on it: 144 real claims passed, 5 not exercised (ux-audit / non-critical, expected for a critical-only run) |
| CI on `9e7146c` (PR #61) | [`CI` 39017457890](https://github.com/crh/dibayar/actions/runs/39017457890): success. lint-typecheck-test (incl. capability self-test 13/13 and `coverage:capabilities` OK), e2e-critical 294 passed (new journey ran in both projects), e2e-a11y, ux-audit all success; e2e-cross-browser skipped by design. [`Journey coverage (full)` 39017457888](https://github.com/crh/dibayar/actions/runs/39017457888): success |
| CI on `4209e83` (PR #60) | [`CI` 39016552672](https://github.com/crh/dibayar/actions/runs/39016552672): success |
| Cross-browser (Firefox/WebKit) suite | NOT_RUN (dispatch/scheduled only; the new journey was run locally in WebKit desktop) |

## 9. Residual risks and limits

- Emulation is not a phone: the #55 report came from a physical iPhone; WebKit 390 px matched it, but real-device behaviour stays MANUAL PENDING.
- "Covered" means at least one real journey, not that every part of a capability works (partial evidence is listed).
- Issue references are checked for form only; a closed issue does not fail the check.
- Classifications are proposals; the owner may reclassify with a recorded decision.
- `STATE.md` and `DAILY_LOG.md` were **not** updated, to avoid conflicts with the open release-readiness PRs; the next state update should cite this receipt.

## 10. What needs the owner (Chris)

1. Merge **PR #60** (test-only, unblocks `npm test` on every branch), then review the audit PR.
2. Decide **CAP-INV-12** (snapshot vs live document fields) before #55 is implemented; decide the **#56** mechanism (draft-only edit vs void-and-replace).
3. Build or decline **#57** (PPh); confirm P2 scope of **#58**, **#59**.
4. Answer the UNKNOWNs: CAP-DEAL-10, CAP-INV-13, CAP-ACC-01, CAP-HOME-05; confirm or change the REQUIRED/PROPOSED split in `capabilities.json`.
5. Release gates unchanged: MAN-DUE-01 (real iPhone and Android), MAN-AUTH-01, MAN-REL-01, FIND-10 Production count.
