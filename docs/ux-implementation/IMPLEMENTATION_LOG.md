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
