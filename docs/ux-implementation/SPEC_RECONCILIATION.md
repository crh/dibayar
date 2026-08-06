# Dibayar UX Specification Reconciliation

Source specification: `docs/ux-implementation/dibayar-implementation-spec.md`
Repository baseline: `8ca6137ea988b57f7a9379b5109b4dc3516290ee`
Prepared: 2026-08-04
Status: **SIGNED FOR T-00–T-27; Preview isolation remains a separate Phase 2 gate**

## Executive result

The specification is implementable on the current stack, but its paths are indicative and several assumptions are false. The repository is Next.js 16 App Router, not `src/routes`; the current app has only `/`, `/dashboard`, `/dashboard/invoices/[id]`, and `/i/[token]`. The implementation will use App Router route groups and preserve old links with explicit temporary redirects.

No tax, currency, line-item, stage-enum, payment, rebrand, or non-WhatsApp scope is admitted. No runtime dependency is approved. T-00 may add Playwright as a dev dependency. The current pre-implementation suite has one recorded baseline failure; see `baselines/STEP3_BASELINE.md`.

## Repository reconnaissance

| Spec item or assumption | Repository evidence | Status | Implementation decision |
| --- | --- | --- | --- |
| Framework and versions | `package.json`; live tools: Next 16.2.10, React 19.2.4, TS 5.9.3, Tailwind 4.3.2, Prisma 7.8.0, Node 22.22.3 | Confirmed | Keep stack; use App Router conventions and Tailwind v4 tokens in `src/app/globals.css`. |
| Router and routes | `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/invoices/[id]/page.tsx`, `src/app/i/[token]/page.tsx` | Incorrect | Resolve spec paths to `src/app/(app)/*`, `src/app/masuk`, and existing public group. Add old owner-invoice redirect because the current route is `/dashboard/invoices/[id]`, not `/invoice/[id]`. |
| Authentication provider | `src/auth.ts`: NextAuth/Auth.js, Google provider, database sessions | Confirmed | Landing copy names Google. Protected route group enforces auth; `/masuk` and `/i/[token]` remain outside app chrome. |
| Authorization boundaries | `src/lib/deals.ts`, `src/lib/invoices.ts`, owner API routes include `userId`; public routes use token-scoped projections | Confirmed | Preserve service-layer ownership filters and add second-user integration/E2E proof. Route-group auth does not replace service/API ownership checks. |
| Database/migrations | PostgreSQL + Prisma; six checked-in migrations under `prisma/migrations` | Confirmed | Additive migrations only; never apply Preview/Production migrations automatically. Migration tests use representative local data. |
| Deal model | `Deal`: brand, contactWa, scope, feeIdr, deadline, paymentTerms, status; no contact name | Migration needed | Add nullable `contactName` in T-17. Existing records remain valid; UI omits missing contact name. |
| Deal-stage enum | `MASUK`, `NEGO`, `DEAL`, `KONTEN`, `INVOICE`, `DIBAYAR` in Prisma and `deal-validation.ts` | Confirmed | Freeze enum/data keys and current localized labels. No renames/additions/removals. |
| Stage-transition persistence | No model/migration/call site; `deals.ts` overwrites `Deal.status` | Migration needed | T-17 adds `DealStageTransition`; backfill one initial row from `Deal.status` and `createdAt`; future transitions append atomically. |
| Invoice model/status | `DRAFT`, `SENT`, `DUE`, `OVERDUE`, `PAID`; overdue display derived in `invoice-date-status.ts` | Incorrect | Keep enum. Group `DUE` with semantic Sent/unpaid group unless derived overdue. Do not remove stored `OVERDUE`. |
| Paid undo | `ALLOWED_STATUS_TRANSITIONS.PAID = []` | Migration needed | No schema migration. Permit `PAID → SENT`; display derivation yields overdue when due date is past. This restores a truthful non-paid state without inventing a new enum. |
| Invoice numbering | `InvoiceSequence` and `invoice-number.ts`: atomic `INV/YYYY/MM/NNN` per user/Jakarta month | Confirmed | Reuse existing scheme. Do not implement `INV-{id}` except defensive rendering for impossible legacy null/empty input. |
| Token creation/hashing/expiry | 32 random bytes, base64url, SHA-256 hash only, 90 days, delete on revoke in `invoice-share.ts` | Confirmed | Preserve cryptography, scoping, expiry, regeneration, and no-store/noindex controls. |
| Invalid vs expired token | Current lookup returns the same null/404 for unknown, malformed, revoked, expired | Incorrect | T-23 returns a typed lookup result. Invalid/revoked remain uniform invalid; expired renders specified expired state. Rate-limit before lookup; do not expose invoice fields in either state. |
| Parent-deal preservation | `Invoice.dealId` and relation required; migration uses `ON DELETE RESTRICT`; `deleteDeal` returns `has-invoices` | Confirmed | The detached-parent assumption was incorrect and the fixture is dropped. Preserve the required FK and `ON DELETE RESTRICT`; do not add nullable/SET NULL behavior. Track the deal-deletion-with-invoices UX gap as deferred work. |
| PDF architecture | `@react-pdf/renderer`; `src/lib/invoice-pdf.tsx`; owner and public PDF routes share renderer | Confirmed | Use a shared pure `InvoiceDocumentModel`/ordered block schema plus HTML and React-PDF adapters. React DOM elements cannot literally render through React-PDF primitives. Parity is field/value/order/format parity. |
| Tax behavior | `NONE/PPH21/PPH23`; current HTML/PDF show existing label; invoice subtotal stays deal fee | Confirmed | Freeze inputs, rates, labels, subtotal, and document tax output. “Byte-identical” means the normalized tax field output, not the full PDF binary. |
| Styling/tokens | Tokens and reduced motion are in `src/app/globals.css`; no `src/styles/tokens.css` | Incorrect | Extend layout/breakpoint tokens only in `globals.css`; do not add palette/radius/shadow/font tokens. Add TS breakpoint constants for instrumentation/component logic. |
| Components | Only account menu, language provider, design-system components; most UI is in `dashboard-client.tsx` and invoice client | Incorrect | Extract bounded components into `src/components/{layout,home,deals,invoices,settings,documents}`; delete the composite only after route parity. |
| Tests | Vitest 4 + jsdom + Testing Library, colocated tests; 37 files/447 tests at baseline | Confirmed | Claude writes feature tests. Hermes owns Playwright measuring instruments and independent gates. Baseline: 446 pass, one pre-existing test failure. |
| Screenshot/E2E tooling | No checked-in E2E/capture dependency. Historical 116 captures used ephemeral `/tmp` Python + authenticated Chrome DevTools MCP; package removed | Migration needed | T-00 creates one checked-in Playwright dev harness; do not recreate an ephemeral second harness. Use system Chrome where possible. |
| Drag-and-drop dependency | None in `package.json`; no DnD call sites | Confirmed | Native HTML5 drag events only; adjacent-stage menu is mandatory keyboard/touch path. |
| Deployment/Preview | `DEPLOYMENT.md`: Vercel protected Preview, branch-scoped Neon; Production/public access gated | Confirmed | Local verification first. Preview deployment remains protected and separately approval-gated. No Production/public access. |
| Governance currency | `STATE.md` says accepted head `8c35390`; actual local/remote head is descendant `8ca6137` | Incorrect | Baseline is actual `8ca6137`; update `STATE.md`, `CLAUDE.md`, and route maps at the Phase 0 gate without rewriting historical logs. |

## Task-by-task reconciliation

| Task | Repository evidence | Status | Implementation decision |
| --- | --- | --- | --- |
| T-01 Locale/formatters | Product formatting calls under `src/` are centralized; the unrelated cron guard retains its own Jakarta date calculation; default/fallback is `id`; explicit stored `en` remains valid UI chrome while money/date/document formatting stays Indonesian | Implemented; accepted in the T-01 task commit | `src/lib/locale.ts` is the dependency-free source of truth; `src/lib/format/{money,date,phone}.ts` own fixed Indonesian formatting; the checked-in default-only migration preserves existing preferences. Product-source grep, canonical, migration, production browser, and HTML/PDF parity gates pass. |
| T-02 breakpoints/grid | Five typed breakpoints and a reusable Grid primitive now exist; CSS adds only the Grid base/large rules with no palette/radius/shadow/font token changes | Implemented; accepted in the T-02 task commit | `src/lib/breakpoints.ts` is runtime-frozen and exactly `320/360/640/1024/1440`; `Grid` is one column below LG and 12-column/24px-gutter at LG+. CSS media synchronization is guarded by a test derived from `BREAKPOINTS.LG`. |
| T-03 routes/redirect | Root is landing; owner detail lives under `/dashboard/invoices/[id]`; no app route group | Incorrect | Move landing to `/masuk`; create `(app)` protected group and compatibility route adapters. `/dashboard` responds explicit 302 to `/`. Add 302 from `/dashboard/invoices/[id]` to `/invoice/[id]` to preserve real bookmarks. |
| T-04 AppShell | No shell; account menu is page-local | Migration needed | Add AppShell/TopBar/SideNav/BottomNav and route metadata. Use compatibility route content so Phase 1 remains shippable before Phase 2 refinement. |
| T-05 account menu | Existing `account-menu.tsx` is absolute desktop/fixed mobile, contains language switch, lacks backdrop/handle/focus return/route close | Incorrect | Refactor existing file rather than duplicate. Fixed trigger-rect positioning ≥640; sheet <640; focus lifecycle and semantics tested. |
| T-06 ShareLinkField | Invoice detail renders full URL with `break-all`; session cache stores path | Incorrect | Extract share component; preserve full clipboard/session value, render measured one-line middle truncation, ResizeObserver, accessible error state. |
| T-07 ActionBar/FAB | No `ActionBar.tsx`; quick actions are inline in `dashboard-client.tsx` | Incorrect | Remove the inline quick-action card/row; do not claim a nonexistent file deletion. Add FAB and shell actions. Global “Buat invoice” links to `/deal?tahap=INVOICE` because invoice creation requires a deal. |
| T-08 Beranda | Summary, follow-up, board, form, invoice list coexist in `dashboard-client.tsx` | Migration needed | Extract only summary/follow-up/nearest deals. Server fetches independently so section errors can isolate. |
| T-09 Deal route | Board and form embedded in composite | Migration needed | Extract board/card/form; global action opens accessible sheet/dialog; preserve API contracts. |
| T-10 Invoice route | Invoice list embedded; invoice records do not currently project brand | Migration needed | Add owner-scoped invoice-list projection including safe deal brand (or preserved snapshot after parent decision); group DUE with Sent. |
| T-11 Settings | Only language persistence exists; no issuer/bank/template storage | Migration needed | Add optional one-to-one `UserSettings` record with issuer/bank/template fields. Requiredness enforced in UI/API, not non-null migration, so existing users remain valid and document placeholders work. |
| T-12 remove composite | `dashboard-client.tsx` owns all sections | Confirmed | Delete only after T-08–T-10 routes pass and redirects are verified. |
| T-13 slim card | Card implementation is inside composite; stage chip/select present | Confirmed | Extract card; brand/fee/deadline/menu only. Column/rail supplies stage context. |
| T-14 URL filter | No route/query filter | Migration needed | App Router `searchParams`; allowlist enum keys; invalid keys fall back to All; no open redirect. |
| T-15 move paths | Current native select can PATCH any stage; no DnD/undo/menu | Migration needed | Split packet into native drag/optimistic undo and adjacent-stage accessible menu. Server still validates enum/ownership; UI limits menu adjacency. |
| T-16 rail/collapse | Current responsive pipeline prioritizes populated stages but is not spec rail/filter/collapse | Incorrect | Replace narrow board behavior with one-stage snap rail and MD+ collapsed empty row. Preserve DOM order and reduced-motion. |
| T-17 deal detail | No route; `contactName` and history absent; linked invoice relation exists | Migration needed | Add route, contactName, history, owner-scoped query, linked invoices, 404. Preserve the required invoice parent and `ON DELETE RESTRICT`; deletion UX with linked invoices remains deferred. |
| T-18 deal WhatsApp | Normalizer accepts only Indonesian mobile pattern; invalid CTA paths are disabled | Incorrect | Accept 9–15 digit international normalized values; legacy values normalized on read and on next write; enabled repair flow; empty-body chat. |
| T-19 invoice reorder | Existing detail at old route; date editor above actions; PAID has no undo | Incorrect | Move to `/invoice/[id]`, reorder DOM, allow PAID→SENT, preserve derived overdue. |
| T-20 date field | Native visible input + Save/Clear + explanatory sentence | Incorrect | Hidden native input over formatted button; immediate PATCH states; clear inside row; remove strings/keys. |
| T-21 invoice WhatsApp | Hardcoded default composer; no persisted templates; disabled invalid-number actions | Incorrect | Resolve templates from settings; ID-only formatter; write repaired contact to owned deal; direct fallback link if popup blocked. |
| T-22 shared document | HTML public client and React-PDF renderer duplicate fields and differ; settings absent | Migration needed | First packet: canonical model/ordered blocks + HTML adapter. Second: optional-field/tax regression. Project document data through the existing required deal relation; do not add a snapshot, nullable parent, or `SET NULL`. |
| T-23 public document | Public client fetches JSON after server token lookup; app-like status card; invalid and expired uniform | Incorrect | Server-resolve typed token state, render ID-only document/no chrome, exactly one PDF action, explicit invalid/expired states, safe headers. |
| T-24 PDF parity | Shared PDF renderer exists but not shared document model | Migration needed | React-PDF adapter consumes same canonical model; parity harness compares normalized fields/values/order, not pixels alone. |
| T-25 landing | Existing root landing, coming-soon copy, current layout | Incorrect | Move to `/masuk`, keep one-column, Google access sentence, preserve six stage chips/current labels. |
| T-26 XS pass | Existing mobile rules and `overflow-x:hidden` can conceal failures | Incorrect | Stack secondary actions <360, size floors/touch targets; harness asserts real scroll geometry before CSS masking. Do not rely on global overflow hiding. |
| T-27 captures | Historical package gone; no reproducible harness | Migration needed | Generate 111 deterministic captures plus PDF/drag/menu/keyboard evidence through T-00 harness. |

## Assumptions, fixed decisions, and `[SHARPENED]` clauses

| Ref | Evidence | Resolution |
| --- | --- | --- |
| §8 A stage names | Enum and current localized labels exist | Frozen. Keep keys and current labels; no migration or copy changes. Interview appendix will lead with naming. |
| §8 B settings fields | No storage exists | Approved minimum only. `name` plus three bank fields required at UI/API; address/WA/email optional; nullable migration for compatibility. No NPWP/registration/tax fields. |
| §8 C line items | Invoice is one subtotal copied from deal | One derived scope line only; no editor/model. |
| §8 D history | Not persisted | Add additive table in T-17 and backfill current stage/created date. |
| §8 E numbering | Existing atomic scheme | Keep `INV/YYYY/MM/NNN`; fallback not designed. |
| §8 F status | Existing enum has DUE and stored OVERDUE | Keep enum; presentation mapping by meaning; DUE groups with Sent unless derived overdue. |
| §8 G provider | Google confirmed | Use Google in access copy. |
| §8 H DnD | No dependency | Native HTML5 only; no runtime dependency. |
| §8 I phone nav | No shell | Implement specified four-item bottom nav. |
| §8 J `[SHARPENED]` filter state | No current filter | Use allowlisted `?tahap=<key>`; All removes query. |
| §4.2 `[SHARPENED]` keyboard path | No accessible movement path besides select | Adjacent-stage `MoveStageMenu`, menu semantics, arrows, Enter/Space, focus restoration. |
| §8 K currency | IDR-only schema/copy | Out of scope, not deferred work. |
| Invoice status grouping assumption | Four UI groups vs five enum values | DUE joins Sent; overdue display derives from due date; no enum change. |
| Stage timeline assumption | No table | Add table as fixed above. |
| Number fallback assumption | Number required and generated | Existing numbering wins. |
| Landing provider assumption | Google | Confirmed. |

## Contradictions and resolutions

### Spec vs schema

1. **Locale default:** schema and cookie fallback use English, spec says Indonesian. Change defaults for new/anonymous users only; preserve stored existing preferences.
2. **Settings:** issuer/bank/templates do not exist. Add nullable one-to-one settings record; requiredness is application validation.
3. **Contact name:** spec says the add form captures it, repository does not. Add optional field and form control in T-17.
4. **Stage history:** absent. Add table/backfill in T-17.
5. **Invoice status:** enum includes DUE; map it to Sent group, keep enum.
6. **Paid undo:** absent. PAID→SENT is the deterministic undo path; derived status handles overdue.
7. **Detached deal:** impossible under RESTRICT; the fixture assumption was withdrawn. Preserve RESTRICT and defer the deal-deletion-with-invoices UX gap.

### Spec vs product

1. **Routes:** root is landing and invoice detail is `/dashboard/invoices/[id]`. Move landing to `/masuk`; preserve both old owner routes with 302 redirects.
2. **Formatting:** English UI currently changes money/date locale. Central formatters remove that coupling.
3. **Public token states:** current security design intentionally makes expired/invalid uniform. Keep uniform invalid/revoked response; expose expired only after hash lookup, still with no invoice data and rate limiting.
4. **WhatsApp:** current validator is Indonesia-mobile-only and CTA can be disabled. Replace with spec normalization and repair path.
5. **ActionBar:** named component does not exist. Remove equivalent inline surface rather than fabricate/delete a path.
6. **Audit harness:** historical tool was ephemeral. Adopt one checked-in harness.
7. **Governance:** STATE/CLAUDE route maps are stale. Update at each phase gate.

### Spec-internal

1. **`/dashboard` “302, permanent once shipped”:** use explicit **302 for this round** to preserve rollback and avoid cached permanent redirects. A 308 is deferred until after release evidence and a separate decision.
2. **“`/invoice/:id` unchanged”:** false against repository. Preserve `/dashboard/invoices/:id` with a 302 to new `/invoice/:id`.
3. **Phase shippability vs placeholder routes/nav:** T-03 creates compatibility adapters backed by current data/components. T-04 activates navigation only when each destination has a functional compatibility view. T-08–T-11 then refine/extract exact IA without exposing dead placeholders.
4. **Shared HTML/PDF component:** React DOM and `@react-pdf/renderer` use incompatible primitives. Share the canonical document model and ordered schema, with two thin renderers.
5. **Tax “byte-identical”:** whole PDF bytes necessarily change when layout changes. Compare normalized tax-related field output/value/label to the pre-change fixture; do not claim identical binary documents.
6. **Global `Buat invoice`:** invoice creation requires a deal. The global action routes to `/deal?tahap=INVOICE`; actual create remains deal-bound.
7. **Exactly one public action vs document component zero buttons:** `InvoiceDocument` has zero buttons; route frame owns exactly one `Unduh PDF` action.

## Migration risk and rollback summary

- T-01: alter default for new users only; rollback restores default, no row rewrite.
- T-11: additive nullable `UserSettings`; rollback stops reads/writes first, then optional table drop only after data export. No automatic Production apply.
- T-17: additive `contactName` and history table/backfill; rollback can stop history writes while retaining table. Parent FK remains required with `ON DELETE RESTRICT`.
- T-18: normalize on new writes; do not destructive-backfill unknown legacy numbers.
- No invoice number/status enum/tax migration.

## Parent-deal decision

Chris confirmed that the detached-parent assumption was wrong. The required `Invoice.dealId` relation and `ON DELETE RESTRICT` behavior remain unchanged. T-00 does not create a detached-parent fixture, and T-17/T-22 must not add snapshots, nullable parent links, or `SET NULL` behavior. The user-facing inability to delete a deal after invoices exist is recorded as deferred UX work rather than hidden inside this implementation round.
