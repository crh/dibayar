# T-08 — Beranda Implementation and Verification Report

- **Task:** T-08 — Beranda
- **Phase:** Phase 2 — IA split
- **Repository:** `/home/kenji/code/dibayar`
- **Branch:** `hermes/ux-phase-2`
- **Baseline HEAD before T-08:** `3cc8c3bf4c372741cb42bb130949d2b9ea6c27a2`
- **Report timestamp:** `2026-08-09T01:02:24Z`
- **Commit status:** No T-08 commit created
- **T-09 status:** Not started

## Executive result

**Implementation result: PASS, subject to normal task/phase governance closeout.**

The root protected route now presents the focused Beranda money view specified for T-08. The implementation was reviewed independently after Claude Code implementation work, corrected for two responsive overflow issues at the 1024px breakpoint, and reverified with focused tests, repository gates, and Chrome DevTools MCP against the current local worktree.

The implementation plan and phase gate were not updated in this report-only step. The worktree remains uncommitted for review and approval.

## T-08 scope verified

The root Beranda contains exactly three product sections when deals exist:

1. **Net bulan ini**
2. **Perlu dikejar**
3. **3 deal terdekat**

Verified behavior:

- owner-scoped deals and invoices are loaded by the protected root route;
- isolated loading and error states exist for the sections;
- the zero-deal route renders the dedicated empty state and hides the three section headings;
- the old board, invoice-list, and inline add-deal form are absent from the root Beranda;
- monthly net income uses the existing income-summary and money-formatting utilities;
- the follow-up queue includes overdue invoices and invoices due within seven days;
- drafts, paid invoices, and far-future invoices are excluded from the follow-up queue;
- follow-up rows show the related brand, amount, due date, urgency, invoice link, and reminder action;
- nearest deals exclude `DIBAYAR`, sort by deadline, limit the result to three, and link to the deal detail route;
- Indonesian and English UI strings are present without raw translation-key leakage;
- Indonesian money/date formatting remains stable across languages;
- existing AccountMenu, shell navigation, FAB/action routing, invoice, and deal compatibility behavior remain covered by the regression suite.

## Files changed by T-08

Tracked modifications:

- `src/app/(app)/page.tsx`
- `src/lib/i18n.ts`

New T-08 implementation and test files:

- `src/app/(app)/beranda-client.tsx`
- `src/app/(app)/beranda-client.test.tsx`
- `src/app/(app)/loading.tsx`
- `src/app/(app)/error.tsx`
- `src/components/home/monthly-income.tsx`
- `src/components/home/monthly-income.test.tsx`
- `src/components/home/follow-up-queue.tsx`
- `src/components/home/follow-up-queue.test.tsx`
- `src/components/home/nearest-deals.tsx`
- `src/components/home/nearest-deals.test.tsx`

Unrelated local state preserved:

- `DAILY_LOG.md` remains outside T-08 scope and was not staged, reset, cleaned, or rewritten.
- `.hermes/` and `uat/` remain outside T-08 scope.

## Automated verification

### Focused T-08 verification

Command:

```text
npx vitest run 'src/app/(app)/beranda-client.test.tsx' 'src/app/(app)/page.test.tsx' 'src/components/home/follow-up-queue.test.tsx' 'src/components/home/nearest-deals.test.tsx' 'src/components/home/monthly-income.test.tsx'
```

Result: **PASS — 14 tests passed across 5 files, 0 failed**.

Covered contracts include:

- three-section populated DOM allowlist;
- zero-deal Indonesian and English copy;
- translation-key leakage detection;
- money/date formatting;
- sticky-rail responsive class contract;
- nearest-deal filtering, ordering, limit, and links;
- follow-up invoice filtering, urgency, rendering, and links.

### Repository gates

| Gate | Command | Result |
|---|---|---|
| Full tests | `npm test` | **PASS — 62 files, 582 tests** |
| TypeScript | `npm run typecheck` | **PASS** |
| Production build | `npm run build` | **PASS** |
| ESLint direct binary | `node_modules/.bin/eslint .` | **PASS — no errors or warnings** |
| Prisma schema | `node_modules/.bin/prisma validate` | **PASS — schema valid** |
| Tracked diff whitespace | `git diff --check` | **PASS** |
| New-file whitespace checks | `git diff --no-index --check` for T-08 files | **PASS** |

Known wrapper behavior:

- `npm run lint` produced the known Hermes/RTK JSON parsing failure. The underlying ESLint binary passed cleanly.
- `npx prisma validate` produced the known Hermes/RTK wrapper failure. The underlying Prisma binary passed cleanly.

The wrapper failures were tooling/reporting failures, not product or lint/schema failures.

## Browser acceptance

### Target

- **Artifact:** current local uncommitted worktree
- **Host:** `http://localhost:3103/`
- **Browser path:** Chrome DevTools MCP
- **Authentication:** existing local authenticated browser session
- **Data:** existing safe local/test fixture; no credentials, tokens, invoice share tokens, or private identifiers are included in this report

The local server was checked before testing. Port 3000 was occupied by an unrelated service; the current Dibayar Next.js server was already serving the worktree at port 3103.

### Results

| Requested width | Observed result |
|---:|---|
| 320px | **PASS** — sections stack vertically; no horizontal overflow |
| 390px | **CAVEAT** — resize bridge settled at an observed 500px viewport rather than exactly 390px; the observed 500px layout passed with no overflow |
| 768px | **PASS** — sections remain in source order; no horizontal overflow |
| 1024px | **PASS** — follow-up queue is a sticky right rail; no horizontal overflow |
| 1440px | **PASS** — desktop two-column layout; no horizontal overflow |

At 1024px, the independently measured geometry was:

- viewport width: `1024px`;
- main content: `x=240`, `width=784`;
- follow-up rail: `x=768`, `width=224`;
- rail position: `sticky`;
- rail top: `88px`;
- follow-up row: `width=224`;
- reminder icon button: `44px × 44px`, aligned within the rail;
- document scroll width: `1024px`.

At 1440px:

- follow-up rail: approximately `355px` wide;
- rail position: `sticky`;
- rail top: `88px`;
- document scroll width: `1440px`.

The browser initially exposed a genuine 1024px overflow caused by the reminder action expanding to text width inside the narrow rail. The implementation was corrected by keeping the action icon-only and allowing the invoice link flex item to shrink with `min-w-0`. The corrected geometry was rechecked through Chrome DevTools MCP.

Additional browser checks:

- exactly three Beranda region landmarks were visible in the populated state;
- Indonesian headings, dates, and Rupiah formatting were visible;
- section links and row links resolved to the expected local route families;
- the AccountMenu opened and exposed `Pengaturan` and `Keluar` menu items;
- no console errors or warnings were reported;
- no screenshots were captured, so no screenshot claim is made.

## Accessibility and regression review

- Section content is represented by semantic `section` landmarks with labelled headings.
- Links and buttons have accessible names in the active language.
- The reminder action remains keyboard/screen-reader addressable while staying icon-only at narrow widths.
- Retry controls are real buttons with visible focus-ring classes.
- Existing shell navigation and AccountMenu behavior remained intact under the full test suite and browser check.
- No raw translation keys were observed in the tested Indonesian or English Beranda DOM.

## Security and data review

- No schema, migration, dependency, authentication, or authorization changes were introduced.
- Root data access remains owner-scoped through the existing deal/invoice services.
- No credentials, `.env` values, tokens, private share URLs, or customer data were exposed in this report.
- The reminder flow was not sent during browser verification.
- No production, Preview, deployment, database mutation, or public-access change was performed.

## Git and governance status

The T-08 worktree is intentionally uncommitted. Broad staging commands were not used. No T-09 files or behavior were introduced.

Recommended next governance actions:

1. Review this report and the exact T-08 diff.
2. If accepted, update the durable implementation log and plan status according to the repository governance rules.
3. Create the authorized T-08 task commit with the required `T-08:` prefix only after approval.
4. Continue with T-09 only after T-08 closeout is complete and the Phase 2 acknowledgement boundary is handled as specified.
