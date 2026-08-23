# UX Implementation Log

Append-only chronological log. Entry types are `STATE`, `DECISION`, and `DEVIATION`.

---

## 2026-08-04T09:38:52+07:00 — STATE — Programme opened

- Source: Chris's “HERMES TASK — Orchestrate Dibayar UX Implementation Through Claude Code” prompt.
- Baseline commit: `8ca6137ea988b57f7a9379b5109b4dc3516290ee`.
- Existing branch at baseline: `hermes/design-system`.
- T-00 branch created after baseline: `hermes/ux-phase-0`.
- Product source changes are prohibited until `SPEC_RECONCILIATION.md` and `IMPLEMENTATION_PLAN.md` are complete.
- Phase 2 and Phase 5 merges require Chris's explicit acknowledgement.
- Production deployment is not authorized.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 A stage names frozen

- Source: task prompt, fixed decision table.
- Reuse existing enum labels verbatim: `MASUK`, `NEGO`, `DEAL`, `KONTEN`, `INVOICE`, `DIBAYAR`.
- No rename, addition, or removal this round. Stage naming is reserved for creator interviews.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 B issuer and bank settings approved

- Source: task prompt, fixed decision table.
- Minimum fields only: issuer name (required), address, WhatsApp, email; bank name, account number, account holder (all three required).
- Current Prisma schema has none of these fields, so an additive migration is required.
- NPWP, company registration, and tax-adjacent fields are prohibited.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 C single derived line

- Source: task prompt, fixed decision table.
- Preserve a single derived invoice line. No line-item editor.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 D add stage-transition history

- Source: task prompt plus repository evidence.
- Evidence: Prisma stores only current `Deal.status`; no transition-history model or migration exists. `src/lib/deals.ts` directly updates the current row.
- Decision: T-17 must use an additive stage-transition table, preserve current rows, define backfill semantics, and avoid destructive migration.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 E retain existing invoice numbering

- Source: task prompt plus repository evidence.
- Existing implementation: atomic `InvoiceSequence`, scoped by user/Jakarta year/month, rendering `INV/{YYYY}/{MM}/{NNN}`.
- Decision: retain it. `INV-{id}` fallback is not applicable; no new numbering scheme will be designed.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 F retain invoice status enum

- Source: task prompt plus repository evidence.
- Existing statuses: `DRAFT`, `SENT`, `DUE`, `OVERDUE`, `PAID`.
- Preserve the enum and map presentation grouping by meaning. Do not rename/add/remove statuses.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 G sign-in provider

- Source: task prompt plus `src/auth.ts`.
- Actual provider is Google via NextAuth/Auth.js. Preserve the specified access-sentence shape with Google-specific wording.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 H native drag-and-drop

- Source: task prompt plus `package.json`.
- No drag-and-drop runtime dependency exists.
- Use native HTML5 drag events. No new runtime dependency.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 I phone bottom navigation

- Source: task prompt, fixed decision table.
- Approved as specified. Exact routes/labels remain blocked on the missing task specification.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 J URL filter state

- Source: task prompt, fixed decision table.
- Use `?tahap=<key>`.

## 2026-08-04T09:38:52+07:00 — DECISION — §8 K multi-currency excluded

- Source: task prompt, fixed decision table.
- Multi-currency is out of scope and will not be implemented or recorded as a deferred product idea.

## 2026-08-04T09:38:52+07:00 — DECISION — No tax behavior changes

- Source: task prompt and repository evidence.
- Existing withholding types and calculation/rendering behavior are a safety baseline. UX work may present existing values but may not change tax calculation, subtotal, or introduce tax fields.

## 2026-08-04T09:38:52+07:00 — DECISION — T-00 uses checked-in dev-only Playwright harness

- Source: repository inspection and historical 116-capture session.
- No repository screenshot/E2E harness exists. The prior audit used ephemeral `/tmp` Python scripts and authenticated Chrome DevTools MCP; its package is no longer present.
- Bootstrap one checked-in Playwright dev harness and make it the sole capture/assertion instrument. The dev dependency is permitted by the task prompt and is not a runtime dependency.

## 2026-08-04T09:38:52+07:00 — STATE — Pre-implementation baseline

- Lint: PASS (28.64 s).
- Typecheck: PASS (10.22 s).
- Prisma validation: PASS (8.64 s).
- Build: PASS (63.21 s total; 647,636 KB max RSS).
- Test suite: **pre-existing failure** — 446 passed, 1 failed. The WhatsApp reminder test expects due-soon text while its current clock derives overdue text.
- Route-level first-load uncompressed JS: 532,835–564,352 bytes.
- `.next` size: 16,043,335 bytes.
- Detailed evidence: `docs/ux-implementation/baselines/STEP3_BASELINE.md`.

## 2026-08-04T09:38:52+07:00 — DEVIATION — Detached parent-deal fixture impossible in current schema

- Specification reference: Step 3 fixture list; T-17 and T-22 are named as readers of deal fields.
- Repository evidence: required `Invoice.dealId`; required relation; FK `ON DELETE RESTRICT`; deletion service maps FK violation to `has-invoices`.
- Reason: current product intentionally prevents deleting a deal with invoices.
- User-visible effect: invoices can never exist without their deal under current behavior.
- Risk: implementing nullable/set-null preservation may alter delete behavior and every invoice projection that assumes a deal.
- Chosen resolution: mark `Migration needed`; do not change schema until the exact T-17/T-22 requirements are available and reconciled. Prefer additive/backward-compatible changes and explicit rollback.

## 2026-08-04T09:38:52+07:00 — STATE — Reconciliation blocked on missing source specification

- The task says a UX implementation specification containing T-01…T-27, §1–§8, and `[SHARPENED]` clauses was supplied.
- Exhaustive searches of the repository, `/home/kenji/reviews`, ZIP archives, Hermes session history, and likely filenames did not find that specification.
- The 116-capture audit history was found, but it is evidence from a prior capture workflow, not the T-01…T-27 specification.
- `SPEC_RECONCILIATION.md` and `IMPLEMENTATION_PLAN.md` cannot be signed off or mapped task-by-task without the missing text. No product-code delegation may start.

## 2026-08-04T10:05:00+07:00 — STATE — Specification source recovered

- Chris identified `docs/ux-implementation/dibayar-implementation-spec.md` as the authoritative T-01–T-27 source.
- The file contains 943 lines, all 27 tasks, the 111-capture matrix, two `[SHARPENED]` clauses, and §8 A–K assumptions.
- The earlier blocker is closed. Repository reconciliation resumed without inferring requirements from the historical screenshot package.

## 2026-08-04T10:12:00+07:00 — DECISION — Accepted repository baseline is current descendant

- `STATE.md` names `8c35390`, but Git shows actual local and `origin/hermes/design-system` at `8ca6137`.
- `8ca6137` is seven commits newer in the same lineage, not a stale predecessor.
- Baseline remains `8ca6137ea988b57f7a9379b5109b4dc3516290ee`; repository instructions are stale and must be reconciled at the Phase 0 gate.

## 2026-08-04T10:15:00+07:00 — DECISION — Route migration uses temporary 302s

- The spec says `/dashboard` should be 302 and “permanent once shipped.”
- This round uses an explicit 302 to preserve rollback and avoid cached permanent redirects. A permanent redirect is not part of this implementation.
- Repository evidence adds a second compatibility requirement absent from the spec: `/dashboard/invoices/[id]` is the actual current owner-detail route, so it also receives a 302 to `/invoice/[id]`.

## 2026-08-04T10:18:00+07:00 — DECISION — Shared invoice document means shared canonical model

- React DOM and `@react-pdf/renderer` use incompatible rendering primitives.
- T-22/T-24 will share one canonical document model and ordered block schema, with thin HTML and React-PDF adapters.
- Parity means identical fields, order, values, and formatting. Tax regression compares normalized tax output; a changed full PDF binary is not treated as a tax change.

## 2026-08-04T10:20:00+07:00 — DECISION — Existing invoice-status edge mappings

- `DUE` remains in the existing enum and is grouped with semantic Sent/unpaid unless due-date derivation makes it overdue.
- Paid undo uses `PAID → SENT`; current due-date derivation then renders Overdue when appropriate. No status is added or renamed.

## 2026-08-04T10:22:00+07:00 — DEVIATION — Phase shippability versus placeholder routes

- Specification reference: T-03 placeholders, T-04 active navigation, phase rule.
- Repository evidence: there are no route-specific owner components; all owner content is in `dashboard-client.tsx`.
- Reason: exposing active navigation to dead placeholders would make Phase 1 non-shippable.
- User-visible effect: T-03 initially serves functional compatibility views, then T-08–T-11 refine them to the exact IA.
- Risk: temporary adapters add short-lived duplication.
- Chosen resolution: adapters must be deleted in T-12 and covered by route/import tests.

## 2026-08-04T10:25:00+07:00 — STATE — Source gate complete

- `SPEC_RECONCILIATION.md` covers repository architecture, every T-01–T-27 item, all assumptions, both `[SHARPENED]` clauses, A–K fixed decisions, and contradiction categories.
- `IMPLEMENTATION_PLAN.md` maps T-00–T-27 to actual App Router modules, migrations, dependencies, tests, Claude packets, commit boundaries, evidence, rollback, statuses, and phase gates.
- Product-code work remains closed until the T-00 harness and remaining Step 3 baseline fixtures are complete.
- T-17/T-22 remain escalation-gated on the incompatible parent-deal deletion/preservation behavior.

## 2026-08-04T10:45:00+07:00 — STATE — T-00 instruments self-verified

- Added dev-only Playwright and `tsx`; no runtime dependency was added.
- Added deterministic capture/manifest, horizontal-overflow, sub-44px target, wrapped-action-row, overlap, and HTML/PDF field-parity instruments.
- Detector self-test: 8/8 passed after correcting a real Playwright page-context serialization defect found by the first run.
- Production landing baseline: 10/10 captures produced at five widths × ID/EN; 0 overflow cases; one 17px-high language select per case.
- Dev-server screenshots were rejected because the Next.js dev badge contaminated content; accepted captures use `next start`.
- Prefix-scoped fixture seed/verify/cleanup tooling is implemented with exact-host/non-Production guards and a mode-0600 secret manifest. It is not executed because no verified database target is currently available locally.

## 2026-08-04T10:50:00+07:00 — STATE — Security stop-gate discovered

- Live npm audit: 14 advisories — 5 moderate, 7 high, 2 critical.
- Critical Auth.js findings include an auth-check fail-open case (`GHSA-8fpg-xm3f-6cx3`) and email-normalization bypass (`GHSA-7rqj-j65f-68wh`). Pinned Next.js also has applicable high advisories.
- Evidence indicates these are pre-existing direct/transitive dependencies; Playwright/tsx did not introduce them.
- Minimal candidate patch set: Next 16.3.0, NextAuth beta.32, Auth Prisma adapter 2.11.3, aligned Prisma 7.9.1.
- Per the no-unresolved-security-defect rule, product implementation and T-00 acceptance are paused pending Chris's explicit direction and full regression verification.

## 2026-08-04T11:00:00+07:00 — DECISION — Security patch set approved

- Source: Chris's explicit approval in this session.
- Approved scope: Next 16.3.0, NextAuth beta.32, Auth Prisma adapter 2.11.3, aligned Prisma 7.9.1 packages, followed by full regression verification.
- No forced audit update, unrelated dependency refresh, Production deployment, or migration apply is authorized.

## 2026-08-04T15:05:00+07:00 — STATE — Security remediation verified

- Applied the approved minimal framework/Auth/Prisma patch set and non-forced transitive security fixes.
- `npm audit`: 0 vulnerabilities.
- Focused auth/ownership/public-token/PDF verification: 152/152 passed.
- Full Vitest suite: 447/447 passed after fixing one pre-existing current-date-sensitive test through the component's existing `now` seam; no product behavior changed.
- Prisma validate/generate, lint, typecheck, production build, detector self-tests, and anonymous production landing matrix passed.
- Prisma generated client was explicitly regenerated to 7.9.1 so it matches the runtime client and adapter.

## 2026-08-04T15:10:00+07:00 — STATE — Fixture baseline partially verified; stable database target required

- Vercel Preview and Production database identities matched after normalized host/database fingerprinting. No fixture write was made to the shared target.
- A disposable local Prisma Dev database accepted all six migrations; guarded seed/verify passed for the representable fixture matrix.
- Fixture-backed browser execution repeatedly failed because Prisma Dev's PGlite TCP bridge closed the pooled PostgreSQL connection (`P1017` / `ConnectionClosed`) during the authenticated dashboard matrix.
- Cleanup read-back proved `remainingUsers=0`; the 0600 secret manifest was removed and the local Prisma Dev server was stopped.
- T-00 remains open until the six fixture-backed Playwright checks and HTML/PDF parity run against an isolated Neon Preview branch or conventional disposable PostgreSQL server.
- No Claude implementation packet has been issued and no product behavior task has started.

## 2026-08-04T15:25:00+07:00 — DECISION — Local T-00 target and external lifecycle

- T-00 database actions are pinned to `127.0.0.1:55432/dibayar_test` only.
- The PostgreSQL instance is started and torn down outside Hermes control; Hermes must not join or request membership in the Docker group and must not manage the server lifecycle.
- Migrations, fixtures, captures, and cleanup may run only after exact host/port/database validation and live server-version read-back.

## 2026-08-04T15:25:00+07:00 — DECISION — Preview non-isolation and Phase 2 gate

- Chris confirmed Vercel Preview is non-isolated. No migration, seed, or capture may target it.
- Isolation remediation is a separate track. Phase 2 is blocked until normalized Preview and Production fingerprints differ.

## 2026-08-04T15:25:00+07:00 — DECISION — Detached-parent assumption withdrawn

- Drop the detached-parent invoice fixture; the specification assumption was wrong.
- Preserve required `Invoice.dealId`, the required relation, and `ON DELETE RESTRICT`; do not introduce nullable/SET NULL behavior.
- The deal-deletion-with-invoices user experience is deferred work and must not be hidden inside T-17 or T-22.

## 2026-08-06T09:43:50+07:00 — STATE — Local target fingerprint verified; authentication blocked

- Credential handoff file: `/home/kenji/code/dibayar-testdb/.env.test` (mode `0600`); no value was copied into project documentation or logs.
- Normalized target: `127.0.0.1|55432|dibayar_test`; SHA-256 fingerprint `e598e921b265388cb3c36c8d3070b63bd8c2810e9ea3685277e9d82f6967e368`.
- TCP connectivity succeeds and the handoff URL matches the approved target.
- The live server rejects the handoff credential for its configured role. The handoff URL and helper Compose configuration agree, indicating the externally managed running instance needs recreation/refresh.
- Hermes did not start, stop, migrate, seed, or reconfigure the server. PostgreSQL server-version recording remains pending authenticated read-only access.

## 2026-08-06T10:21:47+07:00 — DECISION — Local PostgreSQL version verified

- Authenticated read-only inspection succeeded through `/home/kenji/code/dibayar-testdb/.env.test`; no credential value was logged.
- Normalized target: `127.0.0.1|55432|dibayar_test`; SHA-256 fingerprint `e598e921b265388cb3c36c8d3070b63bd8c2810e9ea3685277e9d82f6967e368`.
- Live server version: PostgreSQL `17.10` (`server_version_num=170010`).
- The container reports its internal server port as `5432`; the approved host-side connection remains pinned to `127.0.0.1:55432`.
- T-00 migrations, fixture seed, authenticated captures, PDF parity, and cleanup are authorized only against this verified local target.

## 2026-08-06T10:56:41+07:00 — STATE — T-00 and Step 3 baseline complete

- Applied all six repository migrations to the approved disposable local target; migration status reported current.
- Guarded fixture cleanup → seed → verify passed. Authenticated fixture Playwright suite passed 6/6.
- Produced 15 fixture-backed captures plus 10 anonymous landing captures; no page-level horizontal overflow was detected.
- Real canonical HTML/PDF parity passed for six ordered fields on both owner and public PDF authorization paths; extracted owner/public PDF text matched.
- Cross-owner invoice access returned 404 in both directions; active token returned 200; expired and invalid tokens returned 404.
- Cleanup read-back proved zero fixture users remain and the mode-0600 fixture manifest was removed.
- Accepted product findings: 17px landing language selector and 21px invoice-detail back link versus the 44px touch criterion.
- Final gates: audit 0; lint/typecheck/Prisma/build passed; detector tests 8/8; Vitest 37/37 files and 447/447 tests; landing matrix passed with zero console/page/hydration errors.
- Durable evidence is checksummed under `docs/ux-implementation/evidence/baseline/{fixtures,landing}`.
- No Vercel Preview, Production, Docker lifecycle, or Docker-group action occurred. Phase 2 remains blocked on Preview database isolation.
- T-00 is ready for final diff/security review and its task-scoped commit; no Claude product packet has been issued.

## 2026-08-06T11:23:27+07:00 — STATE — Independent pre-commit findings remediated

- The first independent reviewer failed the pre-hardening staged snapshot; no commit was created.
- Cleanup and verification now query only the three exact fixed fixture user IDs; operator-controlled prefixes and manifest paths are removed.
- Playwright remains localhost-only, refuses server reuse, and writes only to pinned ignored artifact paths.
- Zero-state browser evidence now explicitly rejects the second owner's deal brand in addition to owner data and invoice links.
- The public PDF request now uses a separate cookie-free API context rather than the authenticated owner context.
- PDF parity now parses actual source labels and associated values from `pdftotext -layout` output before canonical comparison; it no longer returns expected HTML fields tautologically.
- Capture manifests now store portable relative paths rather than `/home/kenji`-specific absolute paths.
- Corrected fixture suite passed 6/6; landing suite passed; exact-ID cleanup read-back returned zero and removed the manifest.
- Updated evidence packages and checksums are staged for a fresh fail-closed review.
- Stale T-17/T-22 reconciliation blockers were removed: both tasks now explicitly preserve the required invoice parent and `ON DELETE RESTRICT`, with no snapshot, nullable parent, or `SET NULL` behavior.

## 2026-08-06T13:06:45+07:00 — STATE — T-01 implementation and acceptance gates complete

- Claude Code/Sonnet implemented T-01 in two bounded packets plus one date-contract correction; Hermes reviewed the actual diffs and independently reran all acceptance evidence.
- Added dependency-free locale constants and centralized pure money, date, phone, calendar-date, and year/month helpers. Product-source search under `src/` finds zero `Intl.NumberFormat`, `Intl.DateTimeFormat`, `toLocaleString`, or `toLocaleDateString` calls outside `src/lib/format`; the unchanged `scripts/cron-guard.mjs` retains its separate Jakarta date calculation.
- UI language now defaults to Indonesian for new, invalid, or missing values while explicit stored `id` and `en` remain valid. English changes chrome only; money remains `Rp` plus non-breaking space and Indonesian grouping, and standard app/message dates remain short Indonesian.
- Public invoice HTML and PDF retain long Indonesian document dates and passed six-field owner/public HTML/PDF value/order parity. WhatsApp normalization, validation, link construction, and message meaning remain unchanged apart from centralized money/date formatting.
- Added migration `20260806113950_user_language_default_id`, containing only `ALTER COLUMN ... SET DEFAULT 'id'`. It was applied only to approved `127.0.0.1:55432/dibayar_test`; all seven migrations are current.
- Transactional representative migration proof preserved explicit legacy `en` and `id`, gave a new row default `id`, rolled back with zero probe residue, and left the live default at `id`.
- Independent canonical gates: Vitest 42/42 files and 501/501 tests; typecheck, lint, Prisma validation, production build, full audit, and production-only audit passed with zero vulnerabilities.
- Production-mode landing matrix passed across five viewports and both languages. Guarded authenticated fixtures seeded/verified, Playwright passed 6/6 including owner isolation/token behavior/PDF parity, and exact cleanup returned zero fixture users with no manifest.
- Geometry remained free of page-level horizontal overflow. The previously accepted 21px invoice-detail back-link touch finding remains; T-01 introduced no new geometry regression.
- An initial authenticated-suite command used a nonexistent npm alias and stopped after seed; exact cleanup was run immediately and verified zero residue before the suite was correctly invoked directly. No Docker, Preview, Production, public deployment, or unrelated-file action occurred.
- T-01 is ready for final fail-closed staged-diff review and its task-scoped commit. T-02 has not started.

## 2026-08-06T14:14:34+07:00 — STATE — T-01 commit accepted

- T-01 was accepted in its task commit after the final fail-closed staged-diff review; the implementation, migration, canonical gates, production browser evidence, and parity evidence are recorded above.
- T-02 has not started.

## 2026-08-06T15:12:14+07:00 — STATE — T-02 implementation and acceptance complete

- T-02 was accepted in its task commit after the final fail-closed staged-diff review.
- Added runtime-frozen typed breakpoint tokens for XS/SM/MD/LG/XL at 320/360/640/1024/1440 and a minimal `Grid` primitive. The Grid is one column below 1024px and twelve `minmax(0, 1fr)` columns with 24px gaps at and above 1024px.
- CSS scope is limited to the Grid rules; no duplicate breakpoint custom properties or palette/radius/shadow/font/typography token changes were introduced. The CSS media threshold is synchronization-tested from `BREAKPOINTS.LG`.
- Focused tests passed 7/7; full Vitest passed 44/44 files and 508/508 tests; typecheck, lint, and production build passed. No database, migration, Docker, deployment, or unrelated-file action occurred.
- T-03 has not started.

## 2026-08-06T15:56:10+07:00 — STATE — T-03 implementation and acceptance complete

- T-03 was accepted in its task commit after the final fail-closed staged-diff review.
- Moved the current public landing to `/masuk`; made `/` the protected `(app)` entry; replaced `/dashboard` with a real 302 redirect that drops query state; preserved `/dashboard/invoices/[id]` as a compatibility route; and added protected placeholders for the new owner paths.
- Kept `/i/:token` outside the protected group with no app chrome. No AppShell, middleware, database, dependency, or unrelated product behavior was introduced.
- Focused route tests passed 19/19; full Vitest passed 51/51 files and 519/519 tests; typecheck, lint, Prisma validation, and production build passed. Production HTTP route matrix passed 8/8, including the real 302, `/masuk` 200/no app menu, protected redirects, legacy invoice compatibility, and invalid public token 404.
- T-04 has not started.

## 2026-08-06T16:10:26+07:00 — DECISION — Legacy invoice route remains compatibility-only until T-19

- The earlier implementation-log decision describing a second 302 from `/dashboard/invoices/[id]` to `/invoice/[id]` is superseded by the T-03 route packet. T-03 applies the real 302 only to `/dashboard`; `/dashboard/invoices/[id]` remains unchanged and compatibility-protected until T-19.

## 2026-08-06T16:37:20+07:00 — STATE — T-00 acceptance status clarified

- T-00 was accepted in commit `0f33310` after the exact frozen staged snapshot passed the final independent fail-closed review. Its fixture, browser, parity, security, checksum, and cleanup evidence are recorded in the preceding entries.
- The older pre-acceptance line remains historical; current Phase 0 status is T-00 through T-03 accepted locally on `hermes/ux-phase-0`.

## 2026-08-06T16:48:56+07:00 — STATE — T-03 landing evidence retargeted

- The Hermes-owned anonymous landing Playwright baseline now targets `/masuk`, the accepted T-03 public landing route, instead of the protected `/` entry.
- Production-mode five-viewport/two-language landing capture passed 1/1; durable landing evidence and manifest were refreshed with portable paths, route `/masuk`, and zero checksum mismatches.

## 2026-08-07T08:47:12+07:00 — STATE — Phase 0 checkpoint closeout re-verified and accepted

- Phase 0 remains T-00–T-03 accepted on `hermes/ux-phase-0`: T-01 `6d4e360` (centralize Indonesian money date and phone formatting), T-02 `f4a8d25` (add responsive layout primitives), T-03 `2c42a28` (scaffold owner routes and preserve legacy redirects), with phase endpoint `5fe3cf3` (refresh landing evidence and close Phase 0 governance).
- A temporary detached verification worktree checked out at the phase endpoint was clean throughout re-verification and has been removed; it left no residue.
- The dirty implementation worktree and its partial T-04 tests/docs (`src/components/layout/{app-shell,bottom-nav,side-nav,top-bar}.test.tsx`, `uat/`, `.hermes/`, and the associated in-progress edits) are preserved untouched. T-04 has not started.
- Production HTTP route matrix passed 8/8: exact `/dashboard` 302 with query state dropped, `/masuk` 200 with no AppShell present, protected routes redirecting unauthenticated requests, legacy `/dashboard/invoices/[id]` compatibility preserved, and an invalid public token returning 404.
- Focused route/formatter suites passed 53/53. A diagnostic full-suite run at a 10-second per-test timeout passed 51 files / 519 tests.
- `npx prisma validate`, `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` all passed.
- The default (unqualified) `npm test` invocation showed two separate timeout-only flakes in pre-existing tests at the default timeout; each affected test passed independently when rerun alone. This rerun is not being cited as an unqualified green full-suite result — see the focused and diagnostic-timeout results above for the qualifying evidence.
- Google OAuth provider initiation was independently re-verified locally: the expected client ID was present and the callback URI matched exactly; no secret, token, or credential value was logged or printed. Full OAuth callback/session completion was not exercised.
- The approved local database (`127.0.0.1:55432/dibayar_test`) was empty of any deal/invoice/public-token fixture at verification time; it was not reseeded, so authenticated route and public-token behavior could not be exercised end-to-end in this check.
- No Preview, Production, public-access, or migration change occurred in this closeout.
- Chris approved this checkpoint. T-04 remains not started and must begin only in a fresh Phase 1 Hermes session.

## 2026-08-08T10:03:13+07:00 — STATE/DECISION — Phase 1 (T-04/T-05) checkpoint approved and closed

- Scope: documentation-only closeout. Only `STATE.md`, `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_LOG.md` (this entry), and `docs/ux-implementation/evidence/phase-1/GATE.md` were touched. No application source, test, `package.json`, credential, or environment file was edited, and no stage/commit/push/deploy/migrate/reseed/reset/stash/clean action was taken. Every existing dirty/untracked path was preserved exactly as found.
- T-04 (AppShell: responsive top bar/side nav/bottom nav/route title) and T-05 (account menu: responsive, focus-safe) implementations are present, uncommitted, in the intentionally dirty worktree on branch `hermes/ux-phase-0`, HEAD `7846f20b0932bee8b1c99f2df000f26e480e1be7`.
- Independent automated evidence, verified after the approved six-test reconciliation: full `npm test` — 57 test files / 556 tests passed; focused T-05 suite — 29/29 passed; `npm run typecheck` — passed; `npm run lint` — passed; `npm run build` — passed; `git diff --check` — passed.
- Manual checkpoint: Chris personally completed the manual T-05 browser checkpoint and reported verdict **PASS**. Tested and accepted: mobile bottom sheet; desktop popover; 639px/640px breakpoint transition; focus entry; Tab and Shift+Tab trapping; Escape dismissal; focus restoration; Settings/navigation dismissal; no duplicate account trigger; correct menu contents; no obvious console regression. Provenance: **Chris-reported manual browser checkpoint** — Hermes did not capture screenshots and did not independently perform this browser checkpoint.
- Exact worktree status at closeout time: branch `hermes/ux-phase-0`, HEAD `7846f20b0932bee8b1c99f2df000f26e480e1be7`. Modified tracked paths: `DAILY_LOG.md`; `src/app/(app)/layout.test.tsx`; `src/app/(app)/layout.tsx`; `src/app/(app)/page.tsx`; `src/app/dashboard-client.test.tsx`; `src/app/dashboard-client.tsx`; `src/app/dashboard/invoices/[id]/invoice-detail-client.test.tsx`; `src/app/dashboard/invoices/[id]/invoice-detail-client.tsx`; `src/components/account-menu.test.tsx`; `src/components/account-menu.tsx`; `src/lib/i18n.test.ts`; `src/lib/i18n.ts`. Untracked paths: `.hermes/`; `src/app/(app)/page.test.tsx`; `src/components/layout/app-shell.test.tsx`; `src/components/layout/app-shell.tsx`; `src/components/layout/bottom-nav.test.tsx`; `src/components/layout/bottom-nav.tsx`; `src/components/layout/nav-items.ts`; `src/components/layout/route-title.test.tsx`; `src/components/layout/route-title.tsx`; `src/components/layout/side-nav.test.tsx`; `src/components/layout/side-nav.tsx`; `src/components/layout/top-bar.test.tsx`; `src/components/layout/top-bar.tsx`; `uat/`.
- T-04 and T-05 production implementations remain uncommitted in this intentionally dirty worktree. No commit, push, deploy, migration, reseed/reset, credential access, or `package.json` change occurred in this closeout.
- DECISION: the Phase 1 (shell and blocking-findings) checkpoint covering T-04/T-05 scope is approved and closed by Chris as of this entry. T-06 (ShareLinkField) is next and explicitly not started in this session; it must begin only in a fresh Hermes session. T-07 and later tasks are unchanged and remain `pending` per the existing plan.
- Phase checkpoint approved and closed. Start a fresh Hermes session before beginning the next phase.

## 2026-08-08T10:07:00+07:00 — STATE — T-06 (ShareLinkField) accepted locally; correction pass

- Scope: documentation-only closeout. Only `STATE.md`, `IMPLEMENTATION_PLAN.md`, this entry, and `docs/ux-implementation/evidence/phase-1/t-06-browser-acceptance.md` were touched. No application source, test, `package.json`, credential, environment, schema, or migration file was edited, and no stage/commit/push/deploy/migrate/reseed/reset/stash/clean action was taken. Every existing dirty/untracked path was preserved exactly as found.
- Repository state: branch `hermes/ux-phase-0`, HEAD `7846f20b0932bee8b1c99f2df000f26e480e1be7`, intentionally dirty worktree, unchanged from the prior entry's recorded file list.
- T-06 (`src/components/invoices/share-link-field.tsx` and test) is present, uncommitted, in the dirty worktree.
- Final automated gates, independently verified: focused `share-link-field.test.tsx` 16/16 passed; focused invoice-detail integration 64/64 passed; full `npm test` 58 files / 572 tests passed; direct ESLint invocation passed; `npm run typecheck` passed; `npm run build` passed; `npx prisma validate` passed; `git diff --check` passed.
- Browser correction pass: this is a **Hermes-captured** recheck (Chrome DevTools MCP, authenticated local `http://localhost:3103`, invoice detail, 390px emulation), not the original T-06 baseline. **No screenshot artifact was captured in this pass; no screenshot claim is made.** The pre-existing prior T-06 baseline (independently verified at 320/390/768/1024/1440, Indonesian/English, continuous resize to 320, and clipboard success) is not reproduced here and is cited, not restated, as still standing. This pass rechecked only: the Indonesian failure alert (`Gagal menyalin. Tekan lama untuk salin manual.`), the English failure alert (`Couldn't copy. Long-press to copy manually.`), field/page geometry and manual-fallback selectability under both failure cases, and the English clipboard success path (payload match, `Copy`→`Copied`→`Copy` revert at ~2s). Console after final reload showed no messages. Full detail: `docs/ux-implementation/evidence/phase-1/t-06-browser-acceptance.md`.
- Side effects: the only mutation performed was a same-origin local language-preference `PATCH` to switch id/en and restore Indonesian at the end; no invoice/deal/share mutation, message, payment, revoke, delete, or credential operation occurred.
- DECISION: T-06 (ShareLinkField) is recorded as accepted/verified locally as of this entry. This does not reopen or restate as newly-closed the already-closed Phase 1 T-04/T-05 checkpoint (`docs/ux-implementation/evidence/phase-1/GATE.md`), which remains unchanged. **T-07 (retire inline action card, add phone FAB) remains explicitly pending and not started; it must begin only in a fresh Hermes session.** No commit, push, deploy, migration, or public-access change occurred in this closeout.

## 2026-08-08T17:35:00+07:00 — STATE — T-07 (retire inline action card, add phone FAB) accepted locally

- Scope: documentation-only closeout. Only `STATE.md`, `IMPLEMENTATION_PLAN.md`, this entry, and `docs/ux-implementation/evidence/phase-1/t-07-browser-acceptance.md` were touched. No application source, test, `package.json`, credential, environment, schema, or migration file was edited, and no stage/commit/push/deploy/migrate/reseed/reset/stash/clean action was taken. Every existing dirty/untracked path was preserved exactly as found. The already-closed T-04/T-05 Phase 1 checkpoint gate (`docs/ux-implementation/evidence/phase-1/GATE.md`) and the T-06 evidence file were not altered.
- Repository state: branch `hermes/ux-phase-0`, HEAD `7846f20b0932bee8b1c99f2df000f26e480e1be7`, intentionally dirty worktree, unchanged from the prior entries' recorded file lists plus the T-07 implementation and its evidence file.
- T-07 (`src/components/layout/floating-action-button.tsx` and test, plus top-bar/dashboard-client/protected-layout integration) is present, uncommitted, in the dirty worktree.
- Final automated gates, independently verified: focused T-07-related suites 59/59 passed (dashboard-client 38, TopBar 9, FloatingActionButton 2, AppShell 5, protected layout 5); full `npm test` 59 files / 572 tests passed; direct ESLint invocation passed; `npm run typecheck` passed; `npx prisma validate` passed; `npm run build` passed; `git diff --check` passed; `diff --no-index` checks on the new floating-action-button files passed.
- Browser acceptance: this is a **Hermes-captured** check (Chrome DevTools MCP, authenticated local `http://localhost:3103/`, existing server process with cwd independently verified as `/home/kenji/code/dibayar`). **No screenshot artifact was captured in this pass; no screenshot claim is made.** Verified across all five widths: at 320/390px the FAB is present (`display: flex`, geometry recorded in the evidence file) with the global invoice action absent (`display: none`) and no horizontal page overflow; at 390px the FAB-to-bottom-nav clearance measured 16px (15px to the nav's 1px border); at 768/1024/1440px the top-bar "Deal" action (and, at 1024/1440px, "Buat invoice") is present while the FAB and bottom nav are absent, with side-nav widths of 240px (1024px) and 264px (1440px); all invoice actions route to `/deal?tahap=INVOICE` and general deal actions route to `/deal`; the final console listing after the recheck showed no messages. Full detail: `docs/ux-implementation/evidence/phase-1/t-07-browser-acceptance.md`.
- Side effects: browser navigation and viewport resizing were read-only — no invoice, deal, share-link, language, or other data mutation, no credential access, and no deployment/public-access/database action occurred.
- DECISION: T-07 (retire inline action card, add phone FAB) is recorded as locally implemented and independently verified, not committed, as of this entry. This does not reopen or restate as newly-closed the already-closed Phase 1 T-04/T-05 checkpoint (`docs/ux-implementation/evidence/phase-1/GATE.md`) or alter the separately-recorded T-06 evidence, both of which remain unchanged. **T-08 and all later tasks remain explicitly pending and not started; T-08 must begin only in a fresh Hermes session.** No commit, push, deploy, migration, phase transition, or public-access change occurred in this closeout.

## 2026-08-08T20:36:54+07:00 — STATE/DECISION — Phase 1 final closeout (T-07 acceptance path and Phase 1 closure)

- Scope: documentation-only closeout. Only `STATE.md`, `IMPLEMENTATION_PLAN.md`, this entry, and `docs/ux-implementation/evidence/phase-1/GATE.md` (final addendum) were touched. No application source, test, `package.json`, credential, environment, schema, or migration file was created or edited by this task, and no stage/commit/push/deploy/migrate/reseed/reset/stash/clean/credential-access action was taken.
- T-07 worker invocation history: the original T-07 Claude Code worker invocation `proc_a7aaadc77853` reached `CLAUDE_MAX_TURNS=40` and exited with code 1 after hitting the max-turns limit; its self-reported summary was therefore **not accepted** as evidence.
- Final T-07 acceptance instead came from direct Hermes inspection and independent verification: direct worktree/diff inspection, bounded correction passes, focused tests, full repository tests, direct ESLint invocation, typecheck, direct Prisma validation, production build, diff checks, and authenticated browser verification (recorded in the 2026-08-08T17:35:00+07:00 entry above).
- Final T-07 facts (restated exactly for the record): focused T-07-related suites **59/59** passed; full `npm test` **59 files / 572 tests** passed; `npm run typecheck` **PASS**; `npm run build` **PASS**; `git diff --check` **PASS**; new-file `diff --no-index` checks **PASS**; direct ESLint invocation **PASS**; direct `prisma validate` **PASS**; authenticated browser verification across 320/390/768/1024/1440 (DOM/geometry/routes/console) **PASS**; no screenshot was captured; no data, credential, deploy, or migration action occurred.
- **Tooling note, not a product failure:** the wrapped `npm run lint` and `npx prisma validate` commands encountered Hermes/RTK parsing errors during this verification pass. The equivalent direct binary invocations — `node_modules/.bin/eslint .` and `node_modules/.bin/prisma validate` — both passed. This is classified as a tooling/orchestration issue with the `npm run`/`npx` wrapper layer, not a product or code defect; no application code was changed in response.
- Exact worktree snapshot at this entry's timestamp (`2026-08-08T20:36:54+07:00`), branch `hermes/ux-phase-0`, HEAD `7846f20b0932bee8b1c99f2df000f26e480e1be7`, intentionally dirty and uncommitted:
  - Modified tracked paths: `DAILY_LOG.md`; `STATE.md`; `docs/ux-implementation/IMPLEMENTATION_LOG.md`; `docs/ux-implementation/IMPLEMENTATION_PLAN.md`; `src/app/(app)/layout.test.tsx`; `src/app/(app)/layout.tsx`; `src/app/(app)/page.tsx`; `src/app/dashboard-client.test.tsx`; `src/app/dashboard-client.tsx`; `src/app/dashboard/invoices/[id]/invoice-detail-client.test.tsx`; `src/app/dashboard/invoices/[id]/invoice-detail-client.tsx`; `src/components/account-menu.test.tsx`; `src/components/account-menu.tsx`; `src/lib/i18n.test.ts`; `src/lib/i18n.ts`.
  - Untracked paths: `.hermes/`; `docs/ux-implementation/evidence/phase-1/GATE.md`; `docs/ux-implementation/evidence/phase-1/t-06-browser-acceptance.md`; `docs/ux-implementation/evidence/phase-1/t-07-browser-acceptance.md`; `src/app/(app)/page.test.tsx`; `src/components/invoices/`; `src/components/layout/app-shell.test.tsx`; `src/components/layout/app-shell.tsx`; `src/components/layout/bottom-nav.test.tsx`; `src/components/layout/bottom-nav.tsx`; `src/components/layout/floating-action-button.test.tsx`; `src/components/layout/floating-action-button.tsx`; `src/components/layout/nav-items.ts`; `src/components/layout/route-title.test.tsx`; `src/components/layout/route-title.tsx`; `src/components/layout/side-nav.test.tsx`; `src/components/layout/side-nav.tsx`; `src/components/layout/top-bar.test.tsx`; `src/components/layout/top-bar.tsx`; `uat/`.
  - This task did not create or change any source, test, or application path; the paths above were pre-existing from prior T-04–T-07 implementation work and are recorded here for an accurate final snapshot only.
- DECISION: T-04, T-05, T-06, and T-07 are all approved/accepted locally and independently verified as of this entry; all remain uncommitted. T-07 is the final task of the current Phase 1 (shell and blocking findings) per `docs/ux-implementation/IMPLEMENTATION_PLAN.md` §5, so **Phase 1 is finally closed**. Final addendum recorded at `docs/ux-implementation/evidence/phase-1/GATE.md`. **T-08 is the next pending task and must start only in a fresh Hermes session.** No phase transition, deployment, migration, or public-access change occurred.

## 2026-08-09T06:14:43+07:00 — STATE/DECISION — Post-commit state reconciliation

- Scope: documentation-only reconciliation. Only `STATE.md`, `IMPLEMENTATION_PLAN.md`, this entry, and a post-commit status section appended to `docs/ux-implementation/evidence/phase-1/GATE.md` were touched. No application source, test, `package.json`, credential, environment, schema, or migration file was created or edited by this task, and no stage/commit/push/deploy/migrate/reseed/reset/stash/clean action was taken by this task.
- The already-approved Phase 1 implementation/documentation commit exists on `hermes/ux-phase-0` and is HEAD: exact hash `68ef5a4b7b0b7adf075ae2ab9a609ad26c220487`, parent `7846f20b0932bee8b1c99f2df000f26e480e1be7`, subject `T-04-T-07: complete Phase 1 responsive shell and actions`, 33 approved files committed.
- No push, deploy, migration, or public-access action occurred as part of the commit or as part of this reconciliation.
- Preserved unrelated worktree state, unchanged and untouched by the commit or this reconciliation: `DAILY_LOG.md` modified (tracked); `.hermes/` and `uat/` untracked.
- Tests were not rerun as part of this reconciliation; the previously recorded independent Phase 1 gates (T-04/T-05 checkpoint automated gates, T-06 correction-pass gates, T-07 gates — all recorded in the preceding entries and in `docs/ux-implementation/evidence/phase-1/GATE.md`) remain the acceptance evidence for the committed content.
- DECISION: `STATE.md` and `IMPLEMENTATION_PLAN.md` current-status fields are updated so they no longer claim T-04 through T-07 are uncommitted or that T-03 is the latest task commit; historical entries in this log and in `docs/ux-implementation/evidence/phase-1/GATE.md` remain unchanged. **T-08 remains the next pending task and must start only in a fresh Hermes session.**

## 2026-08-09T06:58:34+07:00 — STATE/DECISION — Branch normalization recorded (documentation-only)

- Scope: documentation-only status update. Only `STATE.md`, `IMPLEMENTATION_PLAN.md`, and this entry were touched. No application source, test, `package.json`, lockfile, `CLAUDE.md`, `DAILY_LOG.md`, `.hermes/`, `uat/`, credential, environment, schema, migration, or deployment file was created, edited, staged, or committed by this task.
- Branch pointers (already normalized prior to this task; no history rewrite, rebase, squash, amend, or push performed by this task): current branch `hermes/ux-phase-2` at `e7dda4378a8d2cfb573f98154a02107b2737eb73`; `hermes/ux-phase-1` points to the same commit, `e7dda4378a8d2cfb573f98154a02107b2737eb73`; `hermes/ux-phase-0` is unchanged at `7846f20b0932bee8b1c99f2df000f26e480e1be7`.
- Current branch and HEAD at the time of this entry: `hermes/ux-phase-2` at `e7dda43`. The Phase 1 implementation commit remains `68ef5a4`; the docs follow-up commit `e7dda43` is the current Phase 2 baseline.
- Preserved worktree residue, unchanged and untouched by this task: `DAILY_LOG.md` modified (tracked); `.hermes/` and `uat/` untracked.
- These documentation updates (`STATE.md`, `IMPLEMENTATION_PLAN.md`, this entry) are left uncommitted by this task; nothing was staged.
- DECISION: `STATE.md` now identifies `active_branch` as `hermes/ux-phase-2`, the Phase 0 branch as `hermes/ux-phase-0`, the Phase 1 branch as `hermes/ux-phase-1`, and the current Phase 2 baseline as `e7dda43`; `IMPLEMENTATION_PLAN.md`'s top status line now carries the same normalized branch topology and baseline. Historical task evidence in both files and in this log is unchanged. **T-08 is not started and remains gated to begin only in a fresh Hermes session.**

## 2026-08-09 — STATE — T-09 accepted and committed

- T-09 recovery was limited to the remaining test/compile acceptance work; the existing partial implementation was preserved and no T-10 work was started.
- The stale `/deal` placeholder test was replaced with route tests matching the actual async `searchParams` contract. Coverage now includes authenticated board render, invalid `tahap` fallback to All, and unauthenticated redirect.
- Added focused `AddDealDialog` regression coverage for closed state, initial focus, Tab/Shift+Tab containment, Escape dismissal with focus restoration, backdrop dismissal, and close-button dismissal.
- Hermes independently verified the exact focused suite (`npx vitest run 'src/app/(app)/deal' 'src/components/deals'`) at **11/11 PASS**, `npm run typecheck` at **PASS**, and tracked/new-file diff checks at **PASS**.
- T-09 was selectively staged without `DAILY_LOG.md` or unrelated/local files and committed as `0bb2f575ab7e6f718007c7e710ed5af713246aa1` with subject `T-09: extract deal board and add-deal dialog`.
- Browser acceptance remains deferred to the comprehensive Phase 2 pass after T-12. No deployment, migration, Preview/Production mutation, public-access change, or Phase 3 work occurred.

## 2026-08-09 — STATE — T-10 recovery stopped at bounded-worker failure

- A single bounded Claude worker was launched for T-10 with `CLAUDE_MAX_TURNS=45`; it exhausted the bound and exited without an accepted report or commit. No second T-10 loop was launched.
- The worker's partial implementation was preserved in the worktree: authenticated `/invoice` route, owner-scoped invoice/deal-brand projection, grouped invoice-list component, focused route/component/service tests, and directly related i18n additions.
- Hermes independently inspected the preserved diff. `npm run typecheck` passed and `git diff --check` plus new-file whitespace checks passed.
- The exact focused T-10 run returned **36 passed, 1 failed**. The remaining failure is `src/components/invoices/invoice-list.test.tsx:116`, the newly added typography-floor assertion (`expected 0 to be greater than 0`). T-10 is therefore not accepted and not committed.
- T-11 and T-12 were not started. `DAILY_LOG.md`, T-09's commit, and unrelated/local state were preserved. Stop here for bounded recovery rather than repeating the worker loop.

## 2026-08-09 — STATE/DECISION — T-10 accepted and committed; pre-T-10 correction recorded

- Scope: documentation-only closeout. Only `STATE.md`, `IMPLEMENTATION_PLAN.md`, this entry, and `docs/ux-implementation/evidence/phase-2/t-10-report.md` were touched. No application source, test, `package.json`, credential, environment, schema, or migration file was created or edited by this task, and no stage/commit/push/deploy/migrate/reseed/reset/stash/clean action was taken by this task. `DAILY_LOG.md` and the untracked `docs/ux-implementation/evidence/phase-2/t-09-report.md` were preserved untouched.
- Pre-T-10 correction: commit `878d077aaacf82a57456f57e82f2523d7dd309cf` (`fix: defer deal dialog URL cleanup`) sits directly between T-09 (`0bb2f57`) and T-10 (`261ef05`) on the commit chain. It moves the one-shot `?tambah=1` dialog URL cleanup in `src/app/(app)/deal/deal-client.tsx` out of the render body and into a `useEffect`, correcting a lint-flagged render/side-effect issue. This is **T-09-scope, not T-10 scope**.
- T-10 recovery: the preserved partial implementation (blocked in the prior entry at 36/37 focused) was recovered, not rewritten. Root cause of the single failure at `src/components/invoices/invoice-list.test.tsx:116` was two compounding defects: (1) the typography-floor assertion's selector, `'[class*="text-["]'`, has an unescaped `[` that breaks jsdom's `nwsapi` selector parser and silently matches zero nodes; corrected to `'[class*="text-\\["]'`; (2) once real nodes were visible, `StatusChip` (`src/components/design-system.tsx`) was genuinely rendering its label at `text-[11px]`, one pixel under the project's 12px typography floor — a pre-existing defect shared with the deal board, not T-10-only. Corrected to `text-[12px]`.
- Independent-review correction: an unused `invoice.groupEmpty` translation key (`src/lib/i18n.ts`, id/en) was found with no call site, indicating an earlier assumption of per-group empty-state text. The accepted behavior instead omits empty status groups from the DOM entirely (`InvoiceList` filters `INVOICE_GROUPS` to non-empty groups before rendering), matching the task-map's "empty groups" criterion. Focused regression coverage for this exists in `invoice-list.test.tsx` (`"omits empty status groups from the DOM entirely"`). The dead `invoice.groupEmpty` key was left in place as out-of-scope cleanup.
- Hermes independently reran: isolated `invoice-list.test.tsx` **10/10 PASS**; exact focused T-10 files (`invoice-list.test.tsx`, `invoices.test.ts`, `invoice/page.test.tsx`) **37/37 PASS**; broader invoice-area (`src/components/invoices/*`, `src/lib/invoices.test.ts`, `src/app/(app)/invoice/*`) **55/55 PASS**; `npm run typecheck` **PASS**; `git diff --check` **PASS**; direct ESLint (`node_modules/.bin/eslint .`, post-`878d077`) **PASS**; direct `prisma validate` **PASS**.
- **Tooling note, not a product failure:** the wrapped `npm run lint` invocation hit the known Hermes/RTK JSON EOF parsing error previously documented for T-07; the direct ESLint invocation above is the qualifying evidence and passed.
- T-10 was selectively staged without `DAILY_LOG.md` or unrelated/local files and committed as `261ef05ef6255e976dea3e6f4d9e14f42c78abae` with subject `T-10: extract grouped owner invoice list`, on top of the already-present `878d077aaacf82a57456f57e82f2523d7dd309cf` correction. Current HEAD is `261ef05`.
- Full evidence: `docs/ux-implementation/evidence/phase-2/t-10-report.md`.
- Browser acceptance remains deferred to the comprehensive Phase 2 pass after T-12. No deployment, migration, Preview/Production mutation, or public-access change occurred. **T-11 is the next pending task; T-12 and Phase 3 have not started.**
