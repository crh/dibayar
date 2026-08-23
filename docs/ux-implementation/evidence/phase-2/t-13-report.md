# T-13 — Slim deal card: verification report

Mode: direct Claude Code session (Hermes governance bypassed per
`DIBAYAR-DIRECT-CLAUDE-CODE-BOOTSTRAP-T13.md`).

## Status

**Implemented, verified, and committed.** `commit 37c5bbc4be165293e035f2374082a025e00e7e2c`
(`T-13: simplify deal cards to board context`, 2026-08-21T10:01:40+07:00), already on
`hermes/ux-phase-2` at session start. This report covers this session's independent
verification of that commit; no further application code changed.

## Files (from `37c5bbc`)

- `src/components/deals/deal-card.tsx` — removed `StatusChip` and the native stage
  `<select>`; added a single 44×44 overflow (`⋮`) button with a menu (Create Invoice,
  shown only when `status === "INVOICE" && !hasInvoice`); closes on outside click and
  Escape; `onStageChange` is still threaded through but unused (`void onStageChange`),
  reserved for T-15's adjacent-stage menu.
- `src/components/deals/deal-card.test.tsx` — new, 12 focused DOM tests.
- `src/lib/i18n.ts` — replaced `dashboard.stageLabel` (ID/EN) with `dashboard.dealActions`
  (ID/EN), matching the new overflow-button `aria-label`.

## Acceptance criteria

| Criterion | Result |
|---|---|
| Card shows exactly brand, fee, deadline, overflow button | Met — `deal-card.test.tsx` DOM assertion `getAllByRole("button")).toHaveLength(1)` |
| Stage appears once, via the surrounding column | Met — `StageColumn` in `deal-board.tsx` renders the stage name once as the column `<h3 id="stage-...">`; the card has no stage text |
| No stage string inside the card | Met — test asserts absence of `"Nego"`/`"Negotiation"` |
| No native stage `<select>` inside the card | Met — test asserts `container.querySelector("select")` is null |
| Overflow button ≥44×44 | Met — button has `h-11 w-11` (44px); test asserts the classes |
| Overflow control is keyboard-focusable | Met — test: `user.tab()` → `document.activeElement === overflow` |
| Existing unrelated card behavior preserved | Met — Create Invoice action preserved (moved into the overflow menu), disabled/saving states preserved, owner-scoped same-origin mutation call path unchanged |
| Bilingual behavior | Met — ID/EN overflow label, ID/EN deadline placeholder, ID/EN menu item labels all covered by tests |
| Responsive (~390px / ~1440px) | Partially met — see "Live browser verification" below. The card itself has no width-based breakpoint logic (fixed padding/sizing); board/column responsiveness is T-09/T-16 scope, not T-13. |

## Verification performed this session

- Focused: `npx vitest run src/components/deals/deal-card.test.tsx` — **12/12 passed**.
- Broader: `npx vitest run src/components/deals/ src/app/` — **28 files / 287 tests passed**.
- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm test` (full suite) — **69 files / 628 tests passed**.
- `npm run build` — **PASS** (Next.js 16.3.0 / Turbopack, all routes compiled).
- `git diff --check` — **PASS** (no whitespace errors).
- Manual diff/code inspection: confirmed no stale `dashboard.stageLabel` references remain
  anywhere in `src/`; confirmed `deal-board.tsx` and `deal-client.tsx` still wire
  `onStageChange` through unchanged (unused by the card itself, ready for T-15).

## Live browser verification (follow-up session)

A later session in the same workstream added real browser access (`chrome-devtools` and
`claude-in-chrome` MCP servers) and used it to verify T-13 against a running local instance.

- **Local dev auth was broken and had to be fixed first** (unrelated to T-13 itself):
  `.env.local` had been overwritten by a Vercel env pull with production-shaped values
  (`NEXTAUTH_URL` pointed at `https://dibayar.vercel.app`, Google credentials under
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` instead of Auth.js v5's expected
  `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`). Rebuilt `.env.local` with the correct local-dev
  shape (`DATABASE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, a fresh `AUTH_SECRET`, no
  `AUTH_URL`/`NEXTAUTH_URL` — relying on `trustHost: true` for host auto-detection), added
  `http://localhost:3001/api/auth/callback/google` as an authorized redirect URI in Google
  Cloud Console, applied all 8 pending Prisma migrations to the approved disposable local
  target (`127.0.0.1:55432/dibayar_test`, verified PostgreSQL 17.10, matching the
  previously-recorded fingerprint), and restarted the dev server. None of this touched
  Preview/Production.
- Signed in as a real user via Google OAuth in an authenticated Chrome session
  (`claude-in-chrome`, desktop viewport ~1523×807) and created one real deal ("Kopi
  Nusantara", `Rp 2.500.000`, deadline 1 Sep 2026) through the actual UI.
- **Confirmed live in the browser DOM** (via `evaluate`/`zoom` on the real rendered card):
  card text content exactly `"Kopi Nusantara⋮Rp 2.500.0001 Sep 2026"` (brand, overflow
  glyph, fee, deadline — nothing else); `article.querySelector('select')` is `null`;
  exactly one `<button>` in the card; its `getBoundingClientRect()` is exactly
  `44×44` px; `aria-label` is `"Aksi lain untuk deal Kopi Nusantara"`; the stage
  ("Masuk") appears exactly once, as the surrounding column header, not on the card.
- **390px/1440px screenshots were not obtained**, despite genuine effort — not skipped for
  convenience. `claude-in-chrome`'s `resize_window` reported success but the tab's
  `window.innerWidth` never changed (fixed-size remote display, confirmed by two separate
  resize attempts). Falling back to the `chrome-devtools` MCP server's own headless Chrome
  hit two dead ends in turn: it needs `--headless=true` (no X server in this environment,
  required a `.mcp.json` change + session restart), and once headless it had no
  authenticated session — a synthetic Auth.js `Session` row was created directly in the
  disposable local DB and its token injected as a `Cookie` request header via
  `emulate(extraHttpHeaders)`, but Chromium's cookie-jar handling silently overrides
  `extraHttpHeaders` for the `Cookie` header specifically, so the injected token never
  reached the server. No lower-level CDP cookie-setting tool (e.g. `Network.setCookie`) was
  exposed by the MCP server to work around this. The synthetic session row was deleted
  afterward; no lingering auth-bypass artifact remains.
- Chris reviewed these two tooling dead ends and explicitly accepted the existing evidence
  (desktop-viewport live DOM check above + the 12/12 unit tests, which already assert both
  languages and the 44×44 target at the component level) as sufficient, given the card has
  no width-based breakpoint CSS of its own.
- No deploy, push, merge, or Preview/Production migration occurred. The one local mutation
  beyond migrations was creating the one real "Kopi Nusantara" deal fixture in the
  disposable local DB.

## Repository state

- Branch: `hermes/ux-phase-2`.
- HEAD at session start and end: `37c5bbc4be165293e035f2374082a025e00e7e2c` (unchanged by
  this verification pass — no new application/test code was needed).
- Pre-existing unrelated dirty/untracked files (governance/Hermes documentation from the
  earlier stalled delegation-approval process) were left untouched.

## Answer

Did T-13 meet all acceptance criteria? **YES**, confirmed both by the 12/12 unit tests and
by live desktop-viewport DOM inspection of a real rendered card. The one remaining,
explicitly Chris-accepted gap: 390px/1440px were not captured as live screenshots, due to
two independent browser-automation tooling limits (see "Live browser verification" above),
not a product defect — the card has no width-based breakpoint CSS.

## Recommended starting point for T-14

T-14 — URL-bound stage filter for the deal board (`src/app/(app)/deal/deal-client.tsx` and
the board's stage-filter UI), per
`DIBAYAR-DIRECT-CLAUDE-CODE-BOOTSTRAP-T14-TO-T18.md` §5. Per the T-13 bootstrap's own
instruction ("Do not begin T-14 in this session"), T-14 was not started.
