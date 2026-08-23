# Dibayar UX Implementation Programme

Source of truth: `dibayar-implementation-spec.md` + `SPEC_RECONCILIATION.md`
Baseline: `8ca6137ea988b57f7a9379b5109b4dc3516290ee`
Status: **T-00–T-03 COMPLETE; Phase 0 checkpoint manually approved by Chris (2026-08-07) at phase endpoint `5fe3cf3`; evidence at `docs/ux-implementation/evidence/phase-0/GATE.md`. T-04, T-05, T-06, and T-07 COMPLETE (independently verified locally); Phase 1 (shell and blocking-findings) checkpoint manually approved and closed by Chris (2026-08-08); evidence at `docs/ux-implementation/evidence/phase-1/GATE.md`. T-04–T-07 are committed in `68ef5a4` (`T-04-T-07: complete Phase 1 responsive shell and actions`, parent `7846f20`, 33 files) on `hermes/ux-phase-1`, committed 2026-08-09 — local only, not pushed or deployed. Phase 1 final closeout approved and closed (2026-08-08; addendum at `docs/ux-implementation/evidence/phase-1/GATE.md`). Branch normalization performed 2026-08-09T06:58:34+07:00 (documentation-only, no history rewrite/rebase/squash/amend/push): current branch `hermes/ux-phase-2` at baseline `e7dda43`; `hermes/ux-phase-1` also points to `e7dda43`; `hermes/ux-phase-0` unchanged at `7846f20`. Current Phase 2 baseline was `e7dda43`. Phase 2: T-08 accepted (`7633904`), T-09 accepted (`0bb2f57`), T-10 accepted (`261ef05`, preceded by pre-T-10 correction `878d077`), T-11 accepted (`4beae09`), T-12 accepted (`5696641`); current HEAD `f1c6144` (reconciled 2026-08-17 from the stale `5696641` recorded at Phase 2 implementation close; the `5696641→f1c6144` delta is a single documentation-only commit — see `docs/ux-implementation/evidence/phase-2/GATE.md`). An earlier T-11 attempt (2026-08-09) was stopped when a bounded worker exhausted 50 turns with no final report and left only a partial `UserSettings` schema/migration uncommitted; that attempt was superseded when T-11 was restarted in a fresh session, completed, independently verified, and committed as `4beae09` (see `docs/ux-implementation/evidence/phase-2/t-11-report.md`). T-08 through T-12 are all committed and locally verified; the Phase 2 external gate (Preview/Production isolation and Chris's explicit acknowledgement) is now recorded as satisfied as of the 2026-08-17 addendum — isolation via Chris-accepted equivalent evidence, not a literal fingerprint pair — but merge and Phase 3/T-13 remain separately not authorized; see `docs/ux-implementation/evidence/phase-2/GATE.md`.**

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

Claude Code invocation contract for every product task (worker name: Klaus):

- Worker name: **Klaus** (Claude Code implementation worker).
- CLI: Claude Code 2.1.197.
- Explicit model pin: `claude --model sonnet` / the installed wrapper's `claude-sonnet-5` selector (task records command and version).
- Fixed repository: `/home/kenji/code/dibayar` only.
- Default worker budget: `CLAUDE_MAX_TURNS=100`; smaller bounds may be used for deliberately narrow packets.
- No commit/push/deploy/migration apply/dependency install/secret or `.env` access unless separately authorized.
- Packet contains only one task or a predeclared tightly coupled sub-packet.
- Claude adds/updates feature tests and reports changed files/tests/concerns.
- Hermes freezes writers, inspects actual diff before the report, then reads/reconciles the report and independently verifies.
- Maximum two correction rounds. Third failure stops the task and triggers diagnosis/escalation.

Archie is the separate `archie` Hermes profile using `gpt-5.6-sol`; it reviews independently at phase/risk gates and does not implement or approve its own findings.

## 3. Phase-shippability strategy

T-03 cannot expose dead placeholder routes and still satisfy the phase rule. It therefore creates functional compatibility adapters using current owner-scoped data/components. T-04 may activate navigation only after `/`, `/deal`, `/invoice`, and `/pengaturan` have useful compatibility views. T-08–T-11 replace those adapters with the exact IA. The old `/dashboard` is an explicit 302 redirect to `/`; `/dashboard/invoices/[id]` remains a compatibility route until T-19.

Parent-deal behavior is settled: preserve the required relation and `ON DELETE RESTRICT`, drop the detached-parent fixture, and defer the deal-deletion-with-invoices UX gap. Preview remains non-isolated in the literal fingerprint sense recorded in `SECURITY_REVIEW.md` §5; as of 2026-08-17 the Phase 2 external gate is satisfied instead via Chris-accepted equivalent evidence (`SECURITY_REVIEW.md` §5a, `docs/ux-implementation/evidence/phase-2/GATE.md` addendum), which does not by itself authorize merge or Phase 3.

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
- **Evidence:** 501/501 Vitest; zero product formatting API calls outside `src/lib/format` within `src/`; production landing matrix and authenticated 320/390/768/1024/1440 ID+EN captures; owner/public PDF parity; approved-local migration/default probe with zero residue.
- **Rollback:** restore call sites/default; existing rows unchanged.
- **Status:** accepted in the T-01 task commit; canonical, migration, and production-mode browser acceptance gates passed; independent staged-diff review passed.

#### T-02 — Breakpoint tokens and layout primitives
- **Files/modules:** `src/app/globals.css`, new `src/lib/breakpoints.ts`, `src/components/layout/grid.tsx` and tests.
- **Data:** none.
- **Dependencies:** T-00.
- **Claude packet:** named five-band tokens and 12-column Grid; layout tokens only.
- **Tests:** class/render contracts; computed grid at representative widths; token diff guard.
- **Commit:** `T-02: add responsive layout primitives`.
- **Evidence:** focused 7/7 and full 44/44 files, 508/508 tests; typecheck/lint/build passed; exact five-token values and runtime freeze; CSS-only Grid contract with no palette/radius/shadow/font changes.
- **Rollback:** remove layout variables/components.
- **Status:** accepted in the T-02 task commit; independent staged-diff review passed.

#### T-03 — App Router scaffolding and redirects
- **Files/modules:** `src/app/masuk/*`; `src/app/(app)/layout.tsx`; compatibility pages for `(app)/page.tsx`, `deal/page.tsx`, `deal/[id]/page.tsx`, `invoice/page.tsx`, `invoice/[id]/page.tsx`, `pengaturan/page.tsx`; redirect handlers/pages at old paths; link call sites.
- **Data:** none.
- **Dependencies:** T-02.
- **Claude packet:** move landing without changing content, create `(app)` protected group and useful compatibility views, exact explicit 302 redirects, no final IA styling.
- **Tests:** HTTP 302 Location checks; auth redirects; public/landing shell absence; old detail link preservation.
- **Commit:** `T-03: scaffold owner routes and preserve legacy redirects`.
- **Evidence:** focused route suite 19/19; full 51/51 files and 519/519 tests; typecheck/lint/Prisma/build passed; production HTTP route matrix 8/8 including real 302 query drop, `/masuk` 200/no app menu, protected redirects, legacy invoice compatibility, and invalid public token 404.
- **Rollback:** restore the prior root/dashboard pages and remove compatibility placeholders/redirect handler.
- **Status:** accepted in the T-03 task commit; independent staged-diff review passed. Phase 0 checkpoint manually approved by Chris (2026-08-07); evidence at `docs/ux-implementation/evidence/phase-0/GATE.md`.

**Phase 0 gate:** T-00–T-03 criteria; canonical gates; baseline comparison; migration artifact review; route HTTP evidence; update `CLAUDE.md`, `STATE.md`, and implementation log. Recommendation may merge to integration without special Chris acknowledgement if no regression/security/migration failure exists.

**Phase 0 gate status:** `complete — checkpoint approved`. T-00 through T-03 are each accepted in their task commits; phase endpoint `5fe3cf3` closes governance/evidence on top of T-03. Chris manually approved the Phase 0 checkpoint on 2026-08-07. Full evidence package: `docs/ux-implementation/evidence/phase-0/GATE.md`. Not merged to `hermes/ux-integration` and not pushed/deployed by this closeout. T-04 is pending and must begin only in a fresh Phase 1 Hermes session.

### Phase 1 — Shell and blocking findings

#### T-04 — AppShell
- **Files/modules:** `src/components/layout/{app-shell,top-bar,side-nav,bottom-nav,route-title}.tsx`; protected layout; i18n.
- **Data:** none. **Depends:** T-02/T-03.
- **Packet:** responsive chrome only; no page hierarchy refactor; text-only icons if no existing icon set.
- **Tests/evidence:** component accessibility tests; all five width geometry; `aria-current`; content-width ratio; bottom clearance.
- **Commit:** `T-04: add responsive application shell`.
- **Rollback:** protected layout returns children directly.
- **Status:** accepted — implemented and independently verified locally (automated gates: full `npm test` 57 files/556 tests, typecheck, lint, build, `git diff --check`, all PASS); Phase 1 checkpoint manually approved and closed by Chris on 2026-08-08 covering T-04/T-05 scope. Committed 2026-08-09 in `68ef5a4` (`T-04-T-07: complete Phase 1 responsive shell and actions`); see `docs/ux-implementation/evidence/phase-1/GATE.md`.

#### T-05 — Account menu
- **Files/modules:** existing `src/components/account-menu.tsx` and test, top bar.
- **Data:** none. **Depends:** T-04.
- **Packet:** anchored trigger-rect popover ≥640; semantic bottom sheet/backdrop <640; email/settings/signout only; focus lifecycle.
- **Tests/evidence:** Esc/outside/route/item dismissal; focus return; overlap detector and five-width screenshots.
- **Commit:** `T-05: make account menu responsive and focus safe`.
- **Rollback:** restore prior menu while shell stays.
- **Status:** accepted — implemented and independently verified locally (focused T-05 suite 29/29 PASS plus the full canonical gates above); manual browser checkpoint PASS reported by Chris (mobile bottom sheet, desktop popover, 639/640px breakpoint transition, focus entry, Tab/Shift+Tab trapping, Escape dismissal, focus restoration, Settings/navigation dismissal, no duplicate account trigger, correct menu contents, no obvious console regression — Chris-reported manual browser checkpoint, not Hermes-captured). Phase 1 checkpoint manually approved and closed by Chris on 2026-08-08. Committed 2026-08-09 in `68ef5a4` (`T-04-T-07: complete Phase 1 responsive shell and actions`); see `docs/ux-implementation/evidence/phase-1/GATE.md`.

#### T-06 — ShareLinkField
- **Files/modules:** new `src/components/invoices/share-link-field.tsx`; invoice detail adapter; share tests.
- **Data:** none. **Depends:** T-02.
- **Packet:** one-line middle truncation/ResizeObserver/full clipboard/error-selectable behavior; preserve token secrecy and session cache.
- **Tests/evidence:** fake ResizeObserver unit tests; clipboard success/failure; five widths × two languages; intermediate resize detector.
- **Commit:** `T-06: constrain and truncate invoice share links`.
- **Rollback:** component can revert without API/schema changes.
- **Status:** accepted — implemented and independently verified locally (focused `share-link-field.test.tsx` 16/16 and focused invoice-detail integration 64/64 PASS, plus the full canonical gates: `npm test` 58 files/572 tests, direct ESLint, typecheck, build, `prisma validate`, `git diff --check`, all PASS). Browser correction pass (Hermes-captured, not the original baseline): 390px Indonesian/English failure-alert contract and manual-fallback selectability rechecked, English clipboard success rechecked; no screenshot captured, no screenshot claim made. Full evidence: `docs/ux-implementation/evidence/phase-1/t-06-browser-acceptance.md`. Committed 2026-08-09 in `68ef5a4` (`T-04-T-07: complete Phase 1 responsive shell and actions`). This does not reopen the already-closed T-04/T-05 Phase 1 checkpoint.

#### T-07 — Retire inline action card and add FAB
- **Files/modules:** remove equivalent quick-action block from current composite/compatibility view; new `floating-action-button.tsx`; top bar.
- **Data:** none. **Depends:** T-04.
- **Packet:** global action placement by band; invoice action routes to filtered invoice-ready deals; no nonexistent ActionBar deletion claim.
- **Tests/evidence:** DOM absence of old block; geometry at 320/390/768/1024/1440; nav/FAB clearance.
- **Commit:** `T-07: move global actions into shell and phone FAB`.
- **Rollback:** re-enable inline block and remove FAB.
- **Status:** accepted — implemented and independently verified locally (focused T-07-related suites 59/59 — dashboard-client 38, TopBar 9, FloatingActionButton 2, AppShell 5, protected layout 5 — plus the full canonical gates: `npm test` 59 files/572 tests, direct ESLint, typecheck, `prisma validate`, build, `git diff --check`, and new-file `diff --no-index` checks, all PASS). Browser recheck (Hermes-captured, Chrome DevTools MCP, authenticated local `http://localhost:3103/`): FAB present/correctly placed and global actions absent from the phone band at 320/390px, top-bar actions present and FAB/bottom-nav absent at 768/1024/1440px, no horizontal overflow at any of the five widths, FAB/top-bar invoice action routes to `/deal?tahap=INVOICE`, general deal action routes to `/deal`, no console errors/warnings; no screenshot artifact captured, no screenshot claim made. Full evidence: `docs/ux-implementation/evidence/phase-1/t-07-browser-acceptance.md`. Committed 2026-08-09 in `68ef5a4` (`T-04-T-07: complete Phase 1 responsive shell and actions`). This does not reopen the already-closed T-04/T-05 Phase 1 checkpoint.

**Phase 1 gate:** complete criteria/evidence, canonical gates, five-width shell captures, accessibility focus/menu procedure, route compatibility smoke, instructions updated. No unresolved regression.

**Phase 1 gate status:** `shell/blocking-findings checkpoint approved and closed — 2026-08-08`. The checkpoint Chris approved and closed on 2026-08-08 covers the T-04 (AppShell) and T-05 (account menu) scope: independent automated gates (full `npm test` 57 files/556 tests, focused T-05 29/29, typecheck, lint, build, `git diff --check`, all PASS) plus a Chris-reported manual browser checkpoint PASS. Provenance: Chris-reported manual browser checkpoint, not Hermes-captured; no screenshots were captured as part of this closeout. Full evidence package: `docs/ux-implementation/evidence/phase-1/GATE.md`. T-04 through T-07 are committed in `68ef5a4` (`T-04-T-07: complete Phase 1 responsive shell and actions`, parent `7846f20`, 33 files), committed 2026-08-09 on `hermes/ux-phase-0` — local only, no push/deploy occurred. This closed T-04/T-05 checkpoint is unchanged and not reopened by later work. T-06 (ShareLinkField) is separately accepted locally (2026-08-08, documentation-only correction pass); evidence at `docs/ux-implementation/evidence/phase-1/t-06-browser-acceptance.md`. T-07 (FAB) is separately accepted locally (2026-08-08, independently verified); evidence at `docs/ux-implementation/evidence/phase-1/t-07-browser-acceptance.md`. This does not reopen the already-closed T-04/T-05 Phase 1 checkpoint. **T-08 remains `pending` and must begin only in a fresh Hermes session.**

### Phase 2 — IA split (**Chris acknowledgement before merge**)

#### T-08 — Beranda
- **Files/modules:** `(app)/page.tsx`; new `components/home/{monthly-income,follow-up-queue,nearest-deals}.tsx`; server query/services; loading/error files.
- **Data:** none. **Depends:** T-04.
- **Packet:** exactly three sections, isolated errors, zero-deal route state, no board/list/form.
- **Tests/evidence:** server/component feature tests; populated/zero captures; section DOM allowlist; sticky rail geometry.
- **Commit:** `T-08: build focused Beranda money view`.
- **Rollback:** compatibility root remains recoverable until T-12.
- **Status:** accepted — implemented and committed in `7633904` (`T-08: build focused Beranda money view`); focused and canonical gates plus the documented browser recheck passed. Evidence: `docs/ux-implementation/evidence/phase-2/t-08-report.md`.

#### T-09 — Deal route extraction
- **Files/modules:** `deal/page.tsx`; `components/deals/{deal-board,deal-card,add-deal-dialog}.tsx`; existing deal APIs.
- **Data:** none. **Depends:** T-03/T-04.
- **Packet:** board/filter surface only; accessible sheet/dialog with trap/restore; preserve form behavior.
- **Tests/evidence:** route content exclusion; dialog/sheet keyboard tests; zero/populated captures.
- **Commit:** `T-09: extract deal board and add-deal dialog`.
- **Rollback:** use compatibility adapter.
- **Status:** accepted — implemented and independently verified in commit `0bb2f57` (`T-09: extract deal board and add-deal dialog`). Focused T-09 suite passed 11/11; typecheck and diff checks passed. Route tests cover auth render, invalid `tahap` fallback, and unauthenticated redirect; AddDealDialog tests cover keyboard/focus/dismissal behavior. Evidence: `docs/ux-implementation/evidence/phase-2/t-09-report.md`.

#### T-10 — Invoice list route
- **Files/modules:** `invoice/page.tsx`; `components/invoices/invoice-list.tsx`; owner list projection in `invoices.ts`.
- **Data:** no migration. **Depends:** T-03/T-04.
- **Packet:** owner-scoped brand projection and four semantic groups; DUE→Sent mapping.
- **Tests/evidence:** all statuses, empty groups, second owner excluded, row route links, typography floor.
- **Commit:** `T-10: extract grouped owner invoice list`.
- **Rollback:** compatibility adapter/list projection removable.
- **Status:** accepted — the preserved partial implementation was recovered (not rewritten) and independently verified in commit `261ef05` (`T-10: extract grouped owner invoice list`), preceded by pre-T-10 correction `878d077` (`fix: defer deal dialog URL cleanup`, T-09-scope lint fix, not T-10 scope). The prior blocking failure at `src/components/invoices/invoice-list.test.tsx:116` was root-caused to an unescaped jsdom/nwsapi selector plus a real `StatusChip` 11px violation of the 12px typography floor; both were fixed, and independent review additionally corrected a governing-spec mismatch by omitting empty status groups from the DOM, with focused regression coverage. Isolated `invoice-list.test.tsx` passed 10/10; exact focused T-10 files passed 37/37; broader invoice-area passed 55/55; typecheck, `git diff --check`, direct ESLint (post-`878d077`), and direct `prisma validate` all passed. Browser acceptance remains deferred to the comprehensive Phase 2 pass after T-12. Evidence: `docs/ux-implementation/evidence/phase-2/t-10-report.md`.

#### T-11 — Settings, issuer, bank, templates
- **Files/modules:** `pengaturan/page.tsx`; `components/settings/*`; new settings service/validation/API; Prisma schema + additive migration.
- **Data:** nullable one-to-one `UserSettings`; issuer/bank/templates; no NPWP/tax fields; no automatic apply.
- **Dependencies:** T-01/T-04/T-05.
- **Packet:** persistence/validation/save states, ID-only template helper, immediate language, notices; log-redaction constraint.
- **Tests/evidence:** migration on representative existing users; owner isolation; required/error states; reload; ID/EN formatting invariant; log scan.
- **Commit:** `T-11: add minimal invoice issuer and payment settings`.
- **Rollback:** stop reads/writes; retain table for data-safe rollback; drop only after export/approval.
- **Status:** accepted — implemented and independently verified in commit `4beae097dcf645a11e90c9688d5b1b3031d071f6` (`T-11: implement user settings and invoice dependencies`), parent `261ef05` (T-10). Files: `prisma/schema.prisma` + `prisma/migrations/20260809064600_t11_user_settings/` (additive nullable `UserSettings` — issuer/bank/WhatsApp-template fields, no NPWP/tax field, cascade delete on `userId`); `src/app/(app)/pengaturan/page.tsx`; `src/components/settings/settings-form.tsx` (+ test); `src/app/api/me/settings/route.ts` (+ test, owner-scoped GET/PATCH, same-origin check, rate-limited, Zod-validated, never logs body/settings); `src/lib/user-settings.ts` and `src/lib/user-settings-validation.ts` (+ tests); `src/lib/rate-limit.ts` (`userSettingsRateLimiter`, 20/60s); `src/lib/i18n.ts` (`invoice.settingsDependencyNotice` + settings copy); `src/app/dashboard/invoices/[id]/invoice-detail-client.tsx` (+ test) and `src/app/dashboard/invoices/[id]/page.tsx` (dependency-notice wiring). An earlier attempt at this task was stopped by bounded-worker max-turns exhaustion and left only the schema/migration pair uncommitted; that partial work was reused as the starting point for this accepted implementation (see `docs/ux-implementation/evidence/phase-2/t-11-report.md` for the full history). Independently verified: settings/API tests, owner isolation, reload persistence, disposable local-PostgreSQL CRUD/isolation smoke, and log-redaction checks all passed, alongside the canonical gates. Evidence: `docs/ux-implementation/evidence/phase-2/t-11-report.md`, `docs/ux-implementation/evidence/phase-2/GATE.md`.

#### T-12 — Remove composite
- **Files/modules:** delete `dashboard-client.tsx` after extracted imports/tests migrate; leave redirect.
- **Data:** none. **Depends:** T-08/T-09/T-10.
- **Packet:** cleanup only; no behavior/refactor beyond dead composite removal.
- **Tests/evidence:** import-count grep; routes; canonical suite.
- **Commit:** `T-12: remove legacy dashboard composite`.
- **Rollback:** revert task commit; redirects unchanged.
- **Status:** accepted — implemented and independently verified in commit `5696641fb1b4503ec3f44dad2430f79f3fbb332d` (`T-12: remove legacy dashboard composite`), parent `4beae09` (T-11). Exactly two files deleted (`src/app/dashboard-client.tsx`, `src/app/dashboard-client.test.tsx`, 1,308 lines), no other file touched. Post-commit import-count grep confirms no remaining `dashboard-client`/`DashboardClient` reference in `src/` outside one absence-asserting test comment. `/dashboard` remains an explicit 302 redirect to `/`; `/dashboard/invoices/[id]` remains the compatibility detail route. Verified: `npm test` 68 files/616 tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npx prisma validate`, `git diff --check`, and a focused T-12 route/component suite (24/24), all PASS. Hermes-captured authenticated local browser pass (Chrome DevTools MCP, `http://localhost:3104`) confirmed no legacy dashboard-composite landmarks at `/`, the `/dashboard` redirect firing, and no horizontal overflow or console errors across 320/390/768/1024/1440. Evidence: `docs/ux-implementation/evidence/phase-2/t-12-report.md`, `docs/ux-implementation/evidence/phase-2/GATE.md`.

**Phase 2 gate:** all route matrices, redirects, migration test/rollback, ownership, canonical gates, instruction maps, and capture evidence. Preview and Production database fingerprints must differ before this gate can pass, unless Chris explicitly accepts equivalent evidence for a specific gate instance (`SECURITY_REVIEW.md` §5a). Produce recommendation and wait for Chris's explicit acknowledgement before merging.

**Phase 2 gate status:** `local implementation and local validation complete; external isolation and acknowledgement criteria satisfied 2026-08-17 — not merged, Phase 3/T-13 not started`. T-08 through T-12 are all committed (`7633904`, `0bb2f57` preceded by pre-T-10 correction `878d077`, `261ef05`, `4beae09`, `5696641`) and independently verified locally: canonical gates (`npm test` 68 files/616 tests, typecheck, lint, build, `prisma validate`, `git diff --check`) and a Hermes-captured authenticated local browser pass (Chrome DevTools MCP, not Preview/Production) across `/`, `/deal`, `/invoice`, `/pengaturan`, `/dashboard` redirect, and invoice detail at 320/390/768/1024/1440, all PASS with no console errors and no overflow. Full ledger: `docs/ux-implementation/evidence/phase-2/GATE.md`. As of the 2026-08-17 addendum recorded there, the literal Preview/Production fingerprint-isolation requirement is satisfied instead by Chris's explicit acceptance of equivalent evidence (exact Vercel `DATABASE_URL` scopes plus distinct Neon endpoint identifiers), and Chris's explicit Phase 2 checkpoint acknowledgement is obtained (see `PROMPT-10-DIBAYAR-R1-PILOT-HANDOFF.md`). Satisfying these two criteria is not itself a merge authorization. **Not merged. Phase 3/T-13 not started; `execution_authorized` remains false.**

### Phase 3 — Board and deal detail

#### T-13 — Slim deal card
- **Files:** `components/deals/deal-card.tsx`. **Data:** none. **Depends:** T-09.
- **Packet:** exact four contents; no stage string/select.
- **Tests/evidence:** DOM assertions and 390/1440 bilingual capture.
- **Commit:** `T-13: simplify deal cards to board context`.
- **Rollback:** restore controls.
- **Status:** pending — implementation not started, not authorized. Two prior R1 Klaus delegation proposals expired without execution and remain historical: `delegation_id DIBAYAR-T13-R1-20260817-001` (derived and presented 2026-08-17; evidence `docs/ux-implementation/evidence/phase-2/t13-r1-delegation-proposal-2026-08-17.md`), expired at `2026-08-17T13:02:22Z`; and `delegation_id DIBAYAR-T13-R1-20260817-002` (`proposal_digest 8b3990932dbdb841b2bbb2a172822363f53a4b697943183e985d1eaccbf28b42`, recorded by the parent 2026-08-17; evidence `docs/ux-implementation/evidence/phase-2/t13-r1-delegation-proposal-2026-08-17-002.md`), expired at `2026-08-17T14:57:58Z` with no approval ever consumed. No Klaus session, changed file, or commit ever resulted from either. A fresh authoritative proposal was directly recorded by the parent in the canonical delegation ledger 2026-08-18: `delegation_id DIBAYAR-T13-R1-20260818-001`, `proposal_digest 192640d5a5298af4e23df36df84e16c40fde2723a31b111dd059d75281a2d9b2`, `created_at 2026-08-18T00:46:13Z`, `expires_at 2026-08-18T01:46:13Z`, same allowed files `src/components/deals/deal-card.tsx` + `.test.tsx`; evidence `docs/ux-implementation/evidence/phase-2/t13-r1-delegation-proposal-2026-08-18-001.md`. `delegation_approval: AWAITING_CHRIS_R1_DELEGATION_APPROVAL`, `klaus_session: NOT_STARTED`. Chris's exact digest-bound approval of `2026-08-18-001` is still required before any Klaus session starts; no merge, push, deployment, migration, database, credential, external communication, agent activation, model/provider/runtime change, or scope-expansion action is authorized.

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
