# Dibayar UX Implementation Programme

Source of truth: `dibayar-implementation-spec.md` + `SPEC_RECONCILIATION.md`
Baseline: `8ca6137ea988b57f7a9379b5109b4dc3516290ee`
Status: **T-00 COMPLETE; T-01 begins only after the T-00 task commit**

## 1. Branch, commit, and gate model

- Integration branch: `hermes/ux-integration`, created at the baseline commit.
- Phase branches: `hermes/ux-phase-0` through `hermes/ux-phase-6`.
- A new phase branch starts from the current integration branch only after the previous phase gate passes.
- One commit per task, exact prefix `T-00:` … `T-27:`. T-15 and T-22 may use multiple Claude packets but still produce one task commit after all packets pass.
- No push, Preview deployment, migration apply, Production action, or public-access change is implied by a local commit.
- Phase 2 and Phase 5 are acknowledgement gates: evidence may be prepared, but the branch is not merged until Chris explicitly acknowledges it.
- Schema changes are checked-in artifacts only until a separate verified Preview target and approval exists.

## 2. Verification and evidence model

Criterion ledger values:

- `automated` — exact command plus output saved under `docs/ux-implementation/evidence/<phase>/<task>/`.
- `manual` — named procedure and artifact path, normally a deterministic screenshot/PDF.
- `not met` — no command/artifact or failed result.

Canonical local gate after every task:

```zsh
npx prisma validate
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Focused tests run first. Schema tasks also run `npx prisma generate` and migration tests against representative local data. Security-sensitive tasks add owner/non-owner and public-token checks. UI tasks add T-00 detector and capture checks.

Claude Code invocation contract for every product task:

- CLI: Claude Code 2.1.197.
- Explicit model pin: `claude --model sonnet` (current CLI's latest-Sonnet selector; task records command and version).
- Fixed repository: `/home/kenji/code/dibayar` only.
- No commit/push/deploy/migration apply/dependency install/secret or `.env` access unless separately authorized.
- Packet contains only one task or a predeclared tightly coupled sub-packet.
- Claude adds/updates feature tests and reports changed files/tests/concerns.
- Hermes freezes writers, inspects actual diff before the report, then reads/reconciles the report and independently verifies.
- Maximum two correction rounds. Third failure stops the task and triggers diagnosis/escalation.

## 3. Phase-shippability strategy

T-03 cannot expose dead placeholder routes and still satisfy the phase rule. It therefore creates functional compatibility adapters using current owner-scoped data/components. T-04 may activate navigation only after `/`, `/deal`, `/invoice`, and `/pengaturan` have useful compatibility views. T-08–T-11 replace those adapters with the exact IA. The old `/dashboard` and `/dashboard/invoices/[id]` remain explicit 302 redirects throughout this round.

Parent-deal behavior is settled: preserve the required relation and `ON DELETE RESTRICT`, drop the detached-parent fixture, and defer the deal-deletion-with-invoices UX gap. Preview remains non-isolated and the Phase 2 gate cannot pass until Preview and Production fingerprints differ.

## 4. T-00 — Hermes-owned verification harness

- **Owner:** Hermes, never Claude.
- **Actual files:** `playwright.config.ts`; `tests/ux-audit/{baseline.landing,detectors.selftest,fixtures.baseline}.spec.ts`; `tests/ux-audit/support/{capture,detectors,parity,viewports}.ts`; `scripts/ux-fixtures.ts`; `package.json`; lockfile; `docs/ux-implementation/evidence/baseline/*`.
- **Data/schema:** no product schema change. Disposable test identities/fixtures only in an explicitly verified non-Production database. Cleanup/read-back required.
- **Dependency:** dev-only `@playwright/test`; use installed system Chrome where possible. No runtime dependency.
- **Instruments:** five widths (320/390/768/1024/1440), ID/EN, deterministic names, screenshots/manifests, horizontal-overflow, sub-44px targets, wrapped-action rows, rectangle overlap, runtime/hydration diagnostics, token states, and HTML/PDF field/value/order parity. Later task suites add route-specific keyboard/focus, redirect, drag/menu movement, share copy/truncation, phone-repair, and immediate-save assertions using this harness.
- **Baseline fixtures:** zero/populated/empty stages/all statuses/tax+no-tax/second owner/invalid WA/missing settings/empty due date/invalid+expired token/long text+URL+IDR. No detached-parent fixture; required FK/RESTRICT behavior is preserved.
- **Tests:** harness self-tests against synthetic DOM fixtures, then current-app baseline. A detector is not accepted unless its synthetic failing case fails.
- **Commit:** `T-00: add independent UX verification harness and baseline`.
- **Evidence:** detector self-tests; baseline command outputs; capture manifest; fixture cleanup read-back; build/payload baseline.
- **Rollback:** remove dev dependency/config/tests/evidence only; no product behavior or persistent fixture remains.
- **Status:** `complete` — accepted local PostgreSQL 17.10 baseline; 6/6 fixture browser checks, 10/10 landing captures, 8/8 detector self-tests, real HTML/PDF parity, and zero-row cleanup read-back.

## 5. Task map

### Phase 0 — Foundations

#### T-01 — Locale model and formatters
- **Files/modules:** new `src/lib/locale.ts`, `src/lib/format/{money,date,phone}.ts`; modify `src/lib/i18n.ts`, language provider/user-language service, all current formatter call sites, Prisma `User.language` default migration.
- **Data:** alter default to `id` for new rows; preserve existing `language` values; no bulk preference rewrite.
- **Dependencies:** T-00.
- **Claude packet:** centralize formatting, make UI language independent from ID money/date/document constants, migrate call sites only; no copy/layout/tax change.
- **Tests:** formatter boundary tables; existing UI under EN still ID formatting; repository grep allowlist.
- **Commit:** `T-01: centralize Indonesian money date and phone formatting`.
- **Evidence:** focused unit tests; grep output; 390/1440 ID+EN captures.
- **Rollback:** restore call sites/default; existing rows unchanged.
- **Status:** pending.

#### T-02 — Breakpoint tokens and layout primitives
- **Files/modules:** `src/app/globals.css`, new `src/lib/breakpoints.ts`, `src/components/layout/grid.tsx` and tests.
- **Data:** none.
- **Dependencies:** T-00.
- **Claude packet:** named five-band tokens and 12-column Grid; layout tokens only.
- **Tests:** class/render contracts; computed grid at representative widths; token diff guard.
- **Commit:** `T-02: add responsive layout primitives`.
- **Evidence:** unit test + Playwright geometry; palette/radius/shadow/font diff assertion.
- **Rollback:** remove layout variables/components.
- **Status:** pending.

#### T-03 — App Router scaffolding and redirects
- **Files/modules:** `src/app/masuk/*`; `src/app/(app)/layout.tsx`; compatibility pages for `(app)/page.tsx`, `deal/page.tsx`, `deal/[id]/page.tsx`, `invoice/page.tsx`, `invoice/[id]/page.tsx`, `pengaturan/page.tsx`; redirect handlers/pages at old paths; link call sites.
- **Data:** none.
- **Dependencies:** T-02.
- **Claude packet:** move landing without changing content, create protected route group and useful compatibility views, exact explicit 302 redirects, no final IA styling.
- **Tests:** HTTP 302 Location checks; auth redirects; public/landing shell absence; old detail link preservation.
- **Commit:** `T-03: scaffold owner routes and preserve legacy redirects`.
- **Evidence:** automated route matrix and no-error navigation artifacts.
- **Rollback:** old pages can be restored because no permanent redirect/cache or schema change exists.
- **Status:** pending.

**Phase 0 gate:** T-00–T-03 criteria; canonical gates; baseline comparison; migration artifact review; route HTTP evidence; update `CLAUDE.md`, `STATE.md`, and implementation log. Recommendation may merge to integration without special Chris acknowledgement if no regression/security/migration failure exists.

### Phase 1 — Shell and blocking findings

#### T-04 — AppShell
- **Files/modules:** `src/components/layout/{app-shell,top-bar,side-nav,bottom-nav,route-title}.tsx`; protected layout; i18n.
- **Data:** none. **Depends:** T-02/T-03.
- **Packet:** responsive chrome only; no page hierarchy refactor; text-only icons if no existing icon set.
- **Tests/evidence:** component accessibility tests; all five width geometry; `aria-current`; content-width ratio; bottom clearance.
- **Commit:** `T-04: add responsive application shell`.
- **Rollback:** protected layout returns children directly.
- **Status:** pending.

#### T-05 — Account menu
- **Files/modules:** existing `src/components/account-menu.tsx` and test, top bar.
- **Data:** none. **Depends:** T-04.
- **Packet:** anchored trigger-rect popover ≥640; semantic bottom sheet/backdrop <640; email/settings/signout only; focus lifecycle.
- **Tests/evidence:** Esc/outside/route/item dismissal; focus return; overlap detector and five-width screenshots.
- **Commit:** `T-05: make account menu responsive and focus safe`.
- **Rollback:** restore prior menu while shell stays.
- **Status:** pending.

#### T-06 — ShareLinkField
- **Files/modules:** new `src/components/invoices/share-link-field.tsx`; invoice detail adapter; share tests.
- **Data:** none. **Depends:** T-02.
- **Packet:** one-line middle truncation/ResizeObserver/full clipboard/error-selectable behavior; preserve token secrecy and session cache.
- **Tests/evidence:** fake ResizeObserver unit tests; clipboard success/failure; five widths × two languages; intermediate resize detector.
- **Commit:** `T-06: constrain and truncate invoice share links`.
- **Rollback:** component can revert without API/schema changes.
- **Status:** pending.

#### T-07 — Retire inline action card and add FAB
- **Files/modules:** remove equivalent quick-action block from current composite/compatibility view; new `floating-action-button.tsx`; top bar.
- **Data:** none. **Depends:** T-04.
- **Packet:** global action placement by band; invoice action routes to filtered invoice-ready deals; no nonexistent ActionBar deletion claim.
- **Tests/evidence:** DOM absence of old block; geometry at 320/390/768/1024/1440; nav/FAB clearance.
- **Commit:** `T-07: move global actions into shell and phone FAB`.
- **Rollback:** re-enable inline block and remove FAB.
- **Status:** pending.

**Phase 1 gate:** complete criteria/evidence, canonical gates, five-width shell captures, accessibility focus/menu procedure, route compatibility smoke, instructions updated. No unresolved regression.

### Phase 2 — IA split (**Chris acknowledgement before merge**)

#### T-08 — Beranda
- **Files/modules:** `(app)/page.tsx`; new `components/home/{monthly-income,follow-up-queue,nearest-deals}.tsx`; server query/services; loading/error files.
- **Data:** none. **Depends:** T-04.
- **Packet:** exactly three sections, isolated errors, zero-deal route state, no board/list/form.
- **Tests/evidence:** server/component feature tests; populated/zero captures; section DOM allowlist; sticky rail geometry.
- **Commit:** `T-08: build focused Beranda money view`.
- **Rollback:** compatibility root remains recoverable until T-12.
- **Status:** pending.

#### T-09 — Deal route extraction
- **Files/modules:** `deal/page.tsx`; `components/deals/{deal-board,deal-card,add-deal-dialog}.tsx`; existing deal APIs.
- **Data:** none. **Depends:** T-03/T-04.
- **Packet:** board/filter surface only; accessible sheet/dialog with trap/restore; preserve form behavior.
- **Tests/evidence:** route content exclusion; dialog/sheet keyboard tests; zero/populated captures.
- **Commit:** `T-09: extract deal board and add-deal dialog`.
- **Rollback:** use compatibility adapter.
- **Status:** pending.

#### T-10 — Invoice list route
- **Files/modules:** `invoice/page.tsx`; `components/invoices/invoice-list.tsx`; owner list projection in `invoices.ts`.
- **Data:** no migration. **Depends:** T-03/T-04.
- **Packet:** owner-scoped brand projection and four semantic groups; DUE→Sent mapping.
- **Tests/evidence:** all statuses, empty groups, second owner excluded, row route links, typography floor.
- **Commit:** `T-10: extract grouped owner invoice list`.
- **Rollback:** compatibility adapter/list projection removable.
- **Status:** pending.

#### T-11 — Settings, issuer, bank, templates
- **Files/modules:** `pengaturan/page.tsx`; `components/settings/*`; new settings service/validation/API; Prisma schema + additive migration.
- **Data:** nullable one-to-one `UserSettings`; issuer/bank/templates; no NPWP/tax fields; no automatic apply.
- **Dependencies:** T-01/T-04/T-05.
- **Packet:** persistence/validation/save states, ID-only template helper, immediate language, notices; log-redaction constraint.
- **Tests/evidence:** migration on representative existing users; owner isolation; required/error states; reload; ID/EN formatting invariant; log scan.
- **Commit:** `T-11: add minimal invoice issuer and payment settings`.
- **Rollback:** stop reads/writes; retain table for data-safe rollback; drop only after export/approval.
- **Status:** pending.

#### T-12 — Remove composite
- **Files/modules:** delete `dashboard-client.tsx` after extracted imports/tests migrate; leave redirect.
- **Data:** none. **Depends:** T-08/T-09/T-10.
- **Packet:** cleanup only; no behavior/refactor beyond dead composite removal.
- **Tests/evidence:** import-count grep; routes; canonical suite.
- **Commit:** `T-12: remove legacy dashboard composite`.
- **Rollback:** revert task commit; redirects unchanged.
- **Status:** pending.

**Phase 2 gate:** all route matrices, redirects, migration test/rollback, ownership, canonical gates, instruction maps, and capture evidence. Preview and Production database fingerprints must differ before this gate can pass. Produce recommendation and wait for Chris's explicit acknowledgement before merging.

### Phase 3 — Board and deal detail

#### T-13 — Slim deal card
- **Files:** `components/deals/deal-card.tsx`. **Data:** none. **Depends:** T-09.
- **Packet:** exact four contents; no stage string/select.
- **Tests/evidence:** DOM assertions and 390/1440 bilingual capture.
- **Commit:** `T-13: simplify deal cards to board context`.
- **Rollback:** restore controls.
- **Status:** pending.

#### T-14 — URL-bound stage filter
- **Files:** `stage-filter.tsx`, deal page/search-param helper. **Data:** none. **Depends:** T-13.
- **Packet:** chips/tabs, enum allowlist, URL/reload/rail sync.
- **Tests/evidence:** query tests, browser reload, 390/1024; invalid param safe fallback.
- **Commit:** `T-14: bind deal stage filters to URL`.
- **Rollback:** ignore/clear param and show All.
- **Status:** pending.

#### T-15 — Native drag and adjacent menu
- **Files:** deal board, new `move-stage-menu.tsx`, toast/undo helper, deal mutation calls. **Data:** none. **Depends:** T-13.
- **Packet A:** accessible adjacent-stage menu + failure recovery. **Packet B:** native HTML5 drag/drop + optimistic undo. Correction budgets tracked jointly; split pre-emptively.
- **Tests/evidence:** keyboard menu semantics, S1/S6/interior options, mutation failure; 1440/1024 drag and 390 menu procedures.
- **Commit:** `T-15: add accessible deal movement paths`.
- **Rollback:** disable drag/menu and restore prior status control via revert.
- **Status:** pending.

#### T-16 — Stage rail and empty collapse
- **Files:** `stage-rail.tsx`, board/filter CSS. **Data:** none. **Depends:** T-14.
- **Packet:** snap rail sync + MD+ empty collapse; preserve logical DOM order/reduced-motion.
- **Tests/evidence:** page-height measurement, scroll/tab bidirectional sync, reduced-motion, 768/1024 collapse.
- **Commit:** `T-16: add narrow stage rail and collapse empty stages`.
- **Rollback:** ordinary stacked board fallback.
- **Status:** pending.

#### T-17 — Deal detail
- **Files:** `deal/[id]/page.tsx`; deal-detail sections; deal service/API; Prisma `contactName` + `DealStageTransition` migration.
- **Data:** additive nullable contactName; history backfill/current+future writes; preserve required invoice parent and `ON DELETE RESTRICT`.
- **Dependencies:** T-09/T-13.
- **Packet:** owner-scoped detail, all fields, contact edit, history, linked invoice creation. Parent/FK changes are excluded by the settled decision.
- **Tests/evidence:** migration existing data; second-owner 404; all fields/reload; 8+4/single layouts; linked invoice.
- **Commit:** `T-17: add owner-scoped deal detail and stage history`.
- **Rollback:** stop history writes; nullable field/table retained; route revert.
- **Status:** pending.

#### T-18 — Deal WhatsApp and repair
- **Files:** `whatsapp-button.tsx`, format/phone, deal detail/contact API. **Data:** normalize new writes; no destructive legacy backfill. **Depends:** T-17/T-01.
- **Packet:** enabled CTA, empty-body chat, repair/save/open fallback, international validity.
- **Tests/evidence:** normalization table; disabled grep; popup-block fallback; owner isolation; 390/1440 invalid repair captures.
- **Commit:** `T-18: add repairable deal WhatsApp action`.
- **Rollback:** retain normalized values; revert UI.
- **Status:** pending after T-17.

**Phase 3 gate:** migration/ownership/security review, drag/menu/keyboard evidence, board capture set, canonical gates, instructions updated.

### Phase 4 — Invoice detail

#### T-19 — Reorder owner invoice detail
- **Files:** `invoice/[id]/page.tsx`, invoice-detail components/service/status transition. **Data:** no enum/schema migration. **Depends:** T-10/T-06.
- **Packet:** exact DOM order/rails, PAID→SENT undo, owner 404.
- **Tests/evidence:** DOM-order automated check at all widths/languages; status transition tests; second-owner denial.
- **Commit:** `T-19: prioritize invoice payment actions`.
- **Rollback:** revert layout/transition.
- **Status:** pending.

#### T-20 — DateField
- **Files:** new date field, invoice detail, i18n deletion. **Data:** existing dueDate. **Depends:** T-01/T-19.
- **Packet:** formatted button/hidden native picker/immediate save/clear states; delete apology keys.
- **Tests/evidence:** focused UI/API tests; repository grep; 390 touch and 1440 click manual picker procedure.
- **Commit:** `T-20: replace invoice due-date controls`.
- **Rollback:** restore old editor without data change.
- **Status:** pending.

#### T-21 — Invoice WhatsApp send/chase
- **Files:** shared WhatsApp button/template resolver, invoice detail, settings service, linked deal update. **Data:** existing settings/contact. **Depends:** T-18/T-11.
- **Packet:** ID-only templates/substitution/empty-date line removal/repair write-back/fallback link.
- **Tests/evidence:** EN UI body remains ID; custom/reset templates; invalid repair; link target/rel; ownership/log scan.
- **Commit:** `T-21: add configurable invoice WhatsApp flows`.
- **Rollback:** defaults remain available; revert custom resolution.
- **Status:** pending.

**Phase 4 gate:** invoice route regression, ownership and links, formatting/tax baseline, all-width DOM/capture, canonical gates, instructions updated.

### Phase 5 — Document (**Chris acknowledgement before merge**)

#### T-22 — Canonical InvoiceDocument
- **Files:** `src/components/documents/invoice-document/{model,blocks,html}.tsx`; document query projection; tests.
- **Data:** settings projection; required parent relation remains unchanged. **Depends:** T-11.
- **Packet A:** pure canonical model/ordered blocks and HTML adapter. **Packet B:** optional-field matrix and tax snapshot parity. Split pre-emptively.
- **Tests/evidence:** every optional state; ID-only strings; zero chrome/buttons; normalized tax output equals baseline.
- **Commit:** `T-22: add canonical Indonesian invoice document`.
- **Rollback:** old public/PDF renderers remain until T-23/T-24 and can be reselected.
- **Status:** pending.

#### T-23 — Public document route
- **Files:** `i/[token]/page.tsx`, public API/query result types, print CSS; remove obsolete public client where possible.
- **Data:** none. **Depends:** T-22.
- **Packet:** server-render canonical doc, exactly one PDF action, invalid/expired typed states, no creator chrome/data.
- **Tests/evidence:** server status/body semantics; Accept-Language/uiLanguage invariant; five widths; print; invalid/expired/incomplete no-500; rate-limit-before-lookup.
- **Commit:** `T-23: render public invoices as standalone documents`.
- **Rollback:** restore current public client/API flow; token table unchanged.
- **Status:** pending.

#### T-24 — PDF adapter/parity
- **Files:** `src/lib/invoice-pdf.tsx` or documents PDF adapter; owner/public PDF routes; parity instrument fixtures.
- **Data:** none. **Depends:** T-22.
- **Packet:** React-PDF adapter consumes canonical model only; optional fields safe; auth unchanged.
- **Tests/evidence:** field-by-field parity output and rendered page artifact; owner/non-owner/token checks; ID-only under EN.
- **Commit:** `T-24: render PDF from canonical invoice model`.
- **Rollback:** old renderer retained through task review, then revert commit if needed.
- **Status:** pending.

**Phase 5 gate:** public/PDF parity, token security, optional fields/tax unchanged, accessibility/print, canonical gates, instructions updated. Wait for Chris's explicit acknowledgement before merge.

### Phase 6 — Landing, XS, final verification

#### T-25 — Landing
- **Files:** `masuk/page.tsx`, landing client/tests/i18n. **Data:** none. **Depends:** T-02.
- **Packet:** one-column/max width/gap/access sentence; current stage chips/provider.
- **Tests/evidence:** DOM single-column, measured gaps at 1024/1440, coming-soon grep, bilingual captures.
- **Commit:** `T-25: simplify limited-access landing page`.
- **Rollback:** prior landing component.
- **Status:** pending.

#### T-26 — XS pass
- **Files:** globals/layout/button/card action groups across routes. **Data:** none. **Depends:** T-02/T-19.
- **Packet:** only 320–359 responsive corrections; no visual redesign/token additions.
- **Tests/evidence:** all six owner routes × two languages; detector zero overflow/wrapped rows/sub-44 targets; money floors/card padding.
- **Commit:** `T-26: harden the 320 pixel layout band`.
- **Rollback:** per-component CSS revert.
- **Status:** pending.

#### T-27 — Verification capture rerun
- **Owner split:** Claude may add missing feature tests only; Hermes executes/extends instruments, captures, reviews, and records evidence.
- **Files:** harness route/state matrix, capture manifest, per-finding table, evidence only.
- **Data:** disposable verified Preview/local fixtures and cleanup.
- **Dependencies:** all tasks.
- **Packet:** narrowly ask Claude only for any feature-test gap found before capture; never ask it to author detectors.
- **Tests/evidence:** 111 captures; PDF parity; drag/menu/keyboard procedures; checksums/manifest; cleanup read-back.
- **Commit:** `T-27: record final UX verification matrix`.
- **Rollback:** evidence removal only; no product behavior.
- **Status:** pending.

**Phase 6 gate:** all T-00–T-27 criteria reconciled, security/accessibility reviews complete, 111-capture target, performance comparison, Preview status, instructions updated. No Production deployment.

## 6. Security review programme

Record final findings in `SECURITY_REVIEW.md` with command/artifact evidence:

- second-user owner denial for all deal/invoice pages and APIs;
- 256-bit token/hash/scope/expiry/regeneration/revocation;
- invalid/expired safe states and rate limiting before DB lookup;
- minimal public projection and no creator chrome/session data;
- no issuer/bank/phone/template values in logs;
- `target="_blank" rel="noopener"` or equivalent safe `window.open` features;
- redirect targets are constants/allowlisted paths;
- owner PDF and public PDF authorization remain separate;
- dependency audit findings classified, not silently fixed with runtime additions.

## 7. Accessibility review programme

Record in `ACCESSIBILITY_REVIEW.md`:

- keyboard-only top bar → nav → board → adjacent move;
- visible focus and logical DOM order;
- menu/dialog/sheet roles, names, expanded/current states;
- Esc/outside dismissal and focus return;
- ≥44px detector with documented exceptions equal to zero;
- reduced-motion menu/rail/toast behavior;
- enabled invalid WhatsApp repair path;
- live regions for save/error/copied/moved states.

## 8. Phase-gate evidence package

Each phase appends to `IMPLEMENTATION_LOG.md` and creates `docs/ux-implementation/evidence/phase-<n>/GATE.md` containing:

1. tasks and commits/diff summary;
2. criterion ledger (`automated`/`manual`/`not met`);
3. focused and canonical outputs;
4. screenshots/PDF/manifest paths;
5. schema/migration/rollback;
6. known issues/deviations;
7. repository instruction updates;
8. proceed/correct/stop recommendation;
9. acknowledgement status where required.

## 9. Final release package

`RELEASE_READINESS.md` will contain the 11 requested sections. Separate appendix: `CREATOR_INTERVIEW_QUESTIONS.md`, led by testing the frozen six stage names in real creator language. Preview status is factual and protected; Production/public access remains explicitly not deployed unless separately instructed.
