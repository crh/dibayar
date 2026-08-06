# Step 3 Safety and Performance Baseline

Status: **ACCEPTED — T-00 and Step 3 baseline complete**

Captured: 2026-08-04T09:38:52+07:00
Branch at capture: `hermes/design-system`
Commit: `8ca6137ea988b57f7a9379b5109b4dc3516290ee`

This file records pre-implementation behavior and failures. Nothing in this run changed product source.

## Canonical command results

| Check | Command | Result | Evidence |
| --- | --- | --- | --- |
| Lint | `npm run lint` | PASS | Exit 0; elapsed 28.64 s |
| TypeScript | `npm run typecheck` | PASS | Exit 0; elapsed 10.22 s |
| Unit/component/API suite | `npm test` | **FAIL (pre-existing)** | 36 files passed, 1 failed; 446 tests passed, 1 failed; elapsed 176.06 s |
| Prisma schema | `npx prisma validate` | PASS | Schema valid; elapsed 8.64 s |
| Production build | `npm run build` | PASS | Compiled in 24.6 s; total elapsed 63.21 s; max RSS 647,636 KB |
| Diff hygiene | `git diff --check` | PASS | No whitespace errors |

## Pre-existing test failure

```text
src/app/dashboard/invoices/[id]/invoice-detail-client.test.tsx
InvoiceDetailClient > Bagikan invoice > sends an Indonesian-only WhatsApp reminder even when the creator's UI language is English

Expected substring: yang jatuh tempo pada
Received behavior: overdue copy — yang sudah melewati jatuh tempo 31 Juli 2026
```

The test's clock makes the fixture overdue, while the assertion expects due-soon copy. Record this as a baseline failure; it must not be attributed to a future worker diff.

## Build and route-level payload baseline

Source: `.next/diagnostics/route-bundle-stats.json`, `firstLoadUncompressedJsBytes`.

| Route | First-load uncompressed JS |
| --- | ---: |
| `/dashboard/invoices/[id]` | 564,352 B |
| `/dashboard` | 563,423 B |
| `/` | 542,101 B |
| `/i/[token]` | 537,185 B |
| `/_not-found` | 532,835 B |

Generated `.next` tree: **16,043,335 B** (`du -sb .next`).

These measurements are machine- and build-mode-specific. Final comparison must use the same commands on the same host.

## Current route inventory

Production build reported:

- `/`
- `/dashboard`
- `/dashboard/invoices/[id]`
- `/i/[token]`
- `/api/auth/[...nextauth]`
- `/api/deals`
- `/api/deals/[id]`
- `/api/invoices`
- `/api/invoices/[id]`
- `/api/invoices/[id]/contact`
- `/api/invoices/[id]/pdf`
- `/api/invoices/[id]/share`
- `/api/me/language`
- `/api/public/invoices/[token]`
- `/api/public/invoices/[token]/pdf`

All routes are dynamic/server-rendered on demand in this build.

## Repository-derived safety baselines

### Deal and invoice values

- Deal stages are `MASUK`, `NEGO`, `DEAL`, `KONTEN`, `INVOICE`, `DIBAYAR` (`prisma/schema.prisma`, `src/lib/deal-validation.ts`).
- Invoice statuses are `DRAFT`, `SENT`, `DUE`, `OVERDUE`, `PAID` (`prisma/schema.prisma`, `src/lib/invoices.ts`).
- Display overdue is derived by Jakarta calendar date for non-draft/non-paid records (`src/lib/invoice-date-status.ts`).

### Invoice numbering

An existing atomic per-user, per-Jakarta-month sequence is present. Format: `INV/{YYYY}/{MM}/{NNN}` (`src/lib/invoice-number.ts`, `src/lib/invoice-sequence.ts`, `InvoiceSequence` in Prisma). The §8 E fallback is not applicable.

### Tax behavior — preserve exactly

- Stored values: `NONE`, `PPH21`, `PPH23`.
- Invoice subtotal is copied directly from `Deal.feeIdr` at creation.
- Current HTML and PDF render the withholding type/label; they do not add a tax line editor or alter the invoice subtotal.
- Representative feature coverage exists in `src/lib/income-summary.test.ts`, `src/lib/invoice-pdf.test.tsx`, `src/app/i/[token]/public-invoice-client.test.tsx`, and invoice-detail tests.

Deterministic runtime captures for one tax-bearing and one non-tax invoice remain pending fixture-environment setup.

### PDF fields and architecture

`@react-pdf/renderer` renders `src/lib/invoice-pdf.tsx`. Current PDF fields are Dibayar header/title, invoice number, raw status, brand, due date, single service/scope line, subtotal, withholding type label, total invoice, and footer. Owner and public PDF routes share this component but use separate authorization/token lookup paths.

### Public token behavior

`src/lib/invoice-share.ts` currently:

- creates 32 random bytes encoded as base64url;
- stores only SHA-256 hashes;
- uses one share row per invoice;
- expires shares after 90 days by default;
- deletes the row on revoke;
- treats malformed, unknown, revoked, and expired tokens as the same safe not-found result.

Focused tests passed in this baseline: share library (28), owner share route (21), public JSON route (10), public PDF route (7), public page (10).

### Ownership

Deal and invoice queries consistently include `userId` in current service functions and route tests. The required second-user runtime fixture and cross-tenant E2E proof remain pending.

### Parent-deal deletion baseline

Current schema makes the requested fixture impossible:

- `Invoice.dealId` is required.
- `Invoice.deal` is required.
- FK is `ON DELETE RESTRICT` (`prisma/migrations/20260717060000_invoice_deal_restrict_delete/migration.sql`).
- `deleteDeal` intentionally returns `has-invoices` on that FK restriction.

Chris confirmed the detached-parent fixture assumption was wrong. T-00 drops that fixture and preserves the required FK plus `ON DELETE RESTRICT`. The existing `has-invoices` deletion outcome is the baseline; its user-facing UX is deferred work and is not addressed by changing data integrity.

## Screenshot/capture tooling baseline

No screenshot/E2E dependency or checked-in capture script exists in this repository. The prior 116-capture audit was produced by ephemeral Python scripts under `/tmp` using authenticated Chrome through the Chrome DevTools MCP; its final directory and ZIP were subsequently removed. Only the historical procedure is recoverable from session history.

Decision: T-00 must bootstrap a checked-in Playwright-based **dev-only** harness rather than recreate another ephemeral MCP script. It will own the required five viewports, ID/EN matrix, deterministic names, screenshots, overflow detector, sub-44px touch-target detector, wrapped-action-row detector, and public HTML/PDF parity instrument. This does not add a runtime dependency.

## T-00 harness implementation evidence

The authoritative specification was recovered at `docs/ux-implementation/dibayar-implementation-spec.md`; the earlier source blocker is closed.

Checked-in, dev-only harness now includes:

- `playwright.config.ts` using installed system Chrome, Asia/Jakarta timezone, one deterministic worker, and production `next start` for screenshots;
- deterministic five-width/two-language capture naming and JSON manifest;
- horizontal-overflow detection that still finds overflowing elements when root overflow is masked;
- sub-44px interactive target detection;
- wrapped action-row detection;
- rectangle overlap detection for account-menu/value checks;
- field/order/value HTML/PDF parity comparison;
- a prefix-scoped Prisma fixture seed/verify/cleanup script with exact-host and non-Production confirmation guards and a mode-0600 secret manifest.

Self-test result: **8 passed**. Each detector has both a synthetic failing case and a clean case where applicable. The first run exposed and then verified a real page-context serialization defect; acceptance uses the corrected rerun.

Landing baseline result: **1 matrix test passed, 10 deterministic production screenshots** at 320/390/768/1024/1440 × ID/EN. Artifacts are under ignored `test-results/ux-audit/baseline/` and listed in `capture-manifest.json`.

Observed current baseline:

- page-overflow cases: 0/10;
- out-of-viewport elements: 0;
- sub-44px targets: 10 total, exactly one per case;
- deficient target: the language `<select>`, 77–84px wide but only 17px high;
- visual inspection confirmed the 320px and 1440px captures have no clipping/overlap; the initial dev-server capture was rejected because Next.js's dev badge obscured content and was replaced with clean production-server captures.

The guarded fixture runner is pinned to the externally managed local target described below. The earlier Prisma Dev experiment is historical only and is not accepted evidence.

## Dependency security remediation and regression verification

Chris explicitly approved the minimal patch set. Applied versions:

- `next@16.3.0` and aligned `eslint-config-next@16.3.0`;
- `next-auth@5.0.0-beta.32`;
- `@auth/prisma-adapter@2.11.3`;
- Prisma client, adapter, CLI, and generated client aligned at `7.9.1`;
- non-forced transitive audit fixes only.

Accepted results:

- `npm audit`: **0 vulnerabilities** across runtime and development dependencies;
- `npm audit --omit=dev`: **0 vulnerabilities**;
- focused auth/ownership/public-token/PDF suite: **152/152 passed**;
- canonical full Vitest suite: **37/37 files, 447/447 tests passed**;
- final Vitest duration: **266.03 seconds** on the current host;
- Prisma validation/generation, lint, typecheck, and production build: PASS;
- UX detector self-tests: **8/8 passed**;
- anonymous production landing matrix: **10/10 passed**, with zero console errors, page errors, or hydration messages;
- final timed production build: **104.63 seconds wall time / 457,976 KB max RSS**; Next reported **16.0 seconds** for the compile phase;
- a prior warm post-remediation build measured **25.26 seconds / 425,424 KB max RSS**, demonstrating that wall time is environment-sensitive;
- accepted first-load uncompressed JavaScript: `/dashboard/invoices/[id]` 505,663 bytes; `/dashboard` 504,734; `/` 483,412; `/i/[token]` 475,456; `/_not-found` 471,106;
- original recorded range was 532,835–564,352 bytes, so every accepted route is below its pre-remediation baseline.

Two test-only determinism fixes were required; neither changes product behavior:

1. the pre-existing invoice WhatsApp due-soon assertion now passes an explicit `now` through the component's existing test seam;
2. the deal-save success test receives a 10-second test budget because it passed alone in 2.034 seconds but twice exceeded Vitest's 5-second default by about 100ms under full-suite contention.

The first post-patch production build still contained a generated Prisma 7.8.0 client even though runtime packages were 7.9.1. Regenerating the client and rebuilding aligned all Prisma layers at 7.9.1. The accepted regression evidence uses that aligned build.

## Accepted fixture-backed baseline

Approved normalized database identity:

- target: `127.0.0.1|55432|dibayar_test`;
- SHA-256 fingerprint: `e598e921b265388cb3c36c8d3070b63bd8c2810e9ea3685277e9d82f6967e368`;
- credential handoff: `/home/kenji/code/dibayar-testdb/.env.test`, value never logged;
- live PostgreSQL: **17.10** (`server_version_num=170010`), recorded as a `DECISION` before migration/fixture writes;
- lifecycle: external to Hermes; no Docker-group or server lifecycle action by Hermes.

Verified execution:

- all six repository migrations applied successfully and `prisma migrate status` reported the schema current;
- guarded cleanup → seed → verify passed;
- fixtures: three users, seven deals, six invoices, all deal stages, all invoice statuses, tax/no-tax, invalid phone, empty due date, long content, active/expired/invalid public tokens, and second-owner isolation;
- detached-parent fixture removed per corrected product decision; required FK and `ON DELETE RESTRICT` remain unchanged;
- fixture manifest mode: `0600`;
- authenticated fixture Playwright suite: **6/6 passed**;
- owner isolation was denied in both directions;
- active public token returned 200; expired and invalid tokens returned 404;
- durable fixture capture package: **15 screenshots**, 15 geometry checks, **0 horizontal-overflow findings**;
- real canonical HTML/PDF parity: six fields (`number`, `billedTo`, `dueDate`, `scope`, `tax`, `total`) matched independently extracted PDF labels/values and order for the owner path and a cookie-free public authorization path;
- owner/public extracted PDF text matched; both PDFs were one-page A4 artifacts;
- cleanup read-back: **0 fixture users remain**;
- fixture manifest removed after cleanup.

Durable evidence:

- `docs/ux-implementation/evidence/baseline/fixtures/` — 20 packaged artifacts plus checksummed `SUMMARY.json`;
- `docs/ux-implementation/evidence/baseline/landing/` — 13 packaged artifacts plus checksummed `SUMMARY.json`.

## Baseline product findings

These are accepted pre-implementation findings, not harness failures:

- landing language selector: **17px high** in all 10 language/viewport cases versus the 44px criterion;
- invoice-detail “Back to dashboard” link: **21px high** in three fixture captures versus the 44px criterion;
- no page-level horizontal overflow was detected in any of the 25 accepted captures;
- representative 320px dashboard and 390px public-invoice visual inspection found no clipping, overlap, or unreadable long content;
- missing issuer/bank Settings states remain unavailable until the approved additive T-11 model exists;
- deal-deletion-with-invoices UX is deferred; FK and `ON DELETE RESTRICT` remain unchanged;
- Vercel Preview remains non-isolated and prohibited for migrations, fixtures, or captures; Phase 2 is blocked until Preview and Production fingerprints differ.

## T-00 status

T-00 implementation and Step 3 baseline evidence are complete. Final diff/security review and the task-scoped commit boundary remain before delegation of T-01.
