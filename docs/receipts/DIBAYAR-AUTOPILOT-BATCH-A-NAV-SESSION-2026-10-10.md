# Receipt — Staging Autopilot v2, Batch A: P2 navigation and session resilience, 2026-10-10

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time, under the standing `staging`-only merge authorization in the Staging Autopilot v2 brief. `main` and Production were not touched. No Production, hosted-staging or Neon database was read or written; no Vercel, Neon, OAuth or repository setting was changed. Local runs used only the guarded disposable database `127.0.0.1:55432/dibayar_test`. No Google or WhatsApp traffic.

**Final status: see section 13.**

## 1. Verified start state (live, 2026-10-10)

- PR #35 (FIND-08) MERGED into `staging`; merge commit `794d34d6fea1ba73c689d76e2f83614072880faf` is the head of `origin/staging`. PR #34 (`dbf9e73`) and PR #33 (`096a400`) are its ancestors.
- No open PR.
- Inventory as generated from that head: 95 actions, 93 applicable, 65 real (69.9%), P0 28/30, 4 outstanding P0/P1. FIND-09 open and untouched.
- Branch `chore/journey-batch-a-nav-session-2026-10-10` from `origin/staging` `794d34d`. Untracked items (`compose.yml`, two older receipts, `src/generated/`) left as found and not staged.

## 2. Objective and scope

Make the nine Batch A actions real browser journeys: AUTH-06, AUTH-07, AUTH-08, NAV-07, NAV-09, NAV-10, HOME-05, HOME-06, HOME-07. Tests, one fixture action, inventory and docs. No application code, dependency, migration, CI or baseline change.

## 3. Implementation

| File | What |
|---|---|
| `e2e/auth/settings-sign-out.spec.ts` | AUTH-06. Pengaturan reached through the nav; **Keluar** asks; **Batal** removes the question and the session survives a reload; **Keluar** → **Ya, keluar** → Auth.js's page → signed out. Then the same token is presented from a fresh browser context and is refused: signing out clears the cookie too, so only this step shows the Session row is gone. |
| `e2e/auth/session-expiry.spec.ts` | AUTH-07, three journeys. A page is open, the session expires, then: reload and Back; a primary-nav link; **Tandai lunas**. The first two end on sign-in with none of the owner's data. The third gets the server's own 401, shows "Status invoice belum bisa diperbarui.", keeps the status, and the owner's valid session confirms nothing was stored. |
| `e2e/smoke/secondary-nav.spec.ts` | NAV-07 (click/tap, and keyboard incl. Escape), NAV-09 + AUTH-08 (invoice detail's **Kembali ke dashboard** → Beranda), AUTH-08 direct (`/dashboard`, `/dashboard/invoices/[id]`, signed in and signed out), NAV-10. Each with reload, Back and Forward. |
| `e2e/home/beranda-links.spec.ts` | HOME-05 (all four follow-up rows, each checked against its own invoice number and amount), HOME-06 (all three deal-terdekat rows, each against the deal it names), HOME-07 (both **Lihat semua** links). Follow-up overlay. |
| `scripts/e2e-fixtures.ts`, `e2e/support/reseed.ts` | New action `expire-disposable-session`: sets the disposable owner session's `expires` one minute into the past and leaves the row. Same guardrails as every other action (pinned target, confirmation flag); touches one row; refuses unless exactly one row changed. |
| `e2e/support/auth.ts` | `disposableOwnerSessionCookie()`. |

The two auth specs run on the owner's disposable session through `test.use({ storageState })`, so the shared `page` fixture and its browser-health guard (page errors, console errors, failed requests, 5xx) apply to them. They reseed before and after each test.

## 4. Inventory changes

| Action | Before | After | Projects |
|---|---|---|---|
| AUTH-06, AUTH-08, NAV-07, NAV-09, NAV-10, HOME-05, HOME-06, HOME-07 | `not_covered` | `automated_real_interaction` | chromium, chromium-mobile |
| AUTH-07 | `not_covered` (scope chromium) | `automated_real_interaction` | chromium, chromium-mobile (scope widened: the tests run and pass in both) |

Generated totals: real **74/93 = 79.6%** (was 65/93 = 69.9%); P0 28/30 unchanged; outstanding P0/P1 4 unchanged (all nine are P2). `not_covered` 17 → 8. The exception register is unchanged.

Honest limits, recorded in the inventory notes: the two direct `/dashboard` tests are `partial` (`page.goto`) and AUTH-08's real claim rests on the clicked back link; HOME-06 does not assert which three deals are nearest (unit-tested).

`JOURNEY-GRAPHS.md` §5: the expired-session row is no longer UNTESTED; a signed-out row was added. `JOURNEY-BACKLOG.md` Batch 3 split into done (Batch A) and still open. `E2E.md`: disposable session, the new fixture action, the new specs.

## 5. Negative controls (13, all caught)

Application link targets were changed temporarily, built, run on chromium, and reverted with `git checkout -- src`; the tree was clean and rebuilt before the final runs.

| # | Mutation | Failed as intended |
|---|---|---|
| 1 | follow-up rows all link to the first row's invoice | HOME-05 (second row's URL) |
| 2 | deal-terdekat rows all link to the first deal | HOME-06 |
| 3 | deal-terdekat **Lihat semua** → `/invoice` | HOME-07 |
| 4, 5 | account menu **Pengaturan** → `/invoice` | NAV-07 click and keyboard |
| 6 | invoice detail back link → `/invoice` | NAV-09 |
| 7 | `/dashboard` redirects to `/deal` | AUTH-08 direct |
| 8 | deal detail back link → `/` | NAV-10 |

Test-side controls, run from temporary copies of the specs (deleted afterwards), with no application change:

| # | Control | Failed as intended |
|---|---|---|
| 9–11 | the session is never expired | all three AUTH-07 journeys (still on the invoice / the list; PATCH 200 instead of 401) |
| 12 | "sign out" only clears the browser's cookies | AUTH-06 at the token-replay step (the fresh browser still reaches Pengaturan) |
| 13 | the session ends right after **Batal** | AUTH-06 at the reload after **Batal** |

Disclosed: a first attempt that also changed the Settings sign-out link and swallowed the status error in application code was refused by the session's permission classifier as weakening security. Nothing was applied; those two controls were replaced by 9–13.

## 6. Observations (not changed, not findings unless you say so)

1. **Expired session, changing something.** The stale page shows the generic "Status invoice belum bisa diperbarui." It does not say the session ended or offer sign-in; the person finds out on the next navigation. A product choice if you want different copy.
2. **Return address after re-sign-in.** Every protected route redirects to sign-in with `callbackUrl=/` (the layout redirects first), so someone who signs back in lands on Beranda, not where they were.
3. **Server log noise on expiry.** When two requests see an expired session at once, both try to delete the row and Auth.js logs `SessionTokenError` ("No record was found for a delete"). Auth.js catches it; the request still ends at sign-in, with no 5xx. Comes from `@auth/prisma-adapter`'s `deleteSession`, not application code.
4. **Invoice detail does not show the brand name**, only the invoice number and amount.
5. The two **Lihat semua →** links on Beranda have the same accessible name and different targets.

## 7. Local validation

| Gate | Result |
|---|---|
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 980/980 (84 files) |
| `npm run build` | 0 |
| `npm run e2e:build` | 0 |
| `npm run test:journey-coverage` | 37/37 |
| `npm run test:diagnostics-selftest` | pass |
| `npm run coverage:journeys` | OK: 95 actions, 93 applicable, real 79.6%, P0 93.3%, 4 outstanding |
| `npm run test:e2e:critical` (chromium + chromium-mobile) | 214 passed, 0 failed, 26 skipped (21.8 min) |
| New specs, both projects, after the last change | `secondary-nav.spec.ts` 12/12; earlier in the session the four new specs 25 passed + 1 skipped |

One thing the gates caught: `coverage:journeys -- --results` on the critical run rejected NAV-07 on chromium-mobile, because the keyboard test was skipped there while the action claims both projects. The test now runs on both (on the phone's sheet, Pengaturan is one Tab after **Tutup**); the 12/12 above is after that change. The full critical suite was not rerun locally after it; CI's `e2e-critical` on the PR head is the evidence for the final tree (section 8).

Not run locally: full `test:e2e`, `@visual`, a11y and ux-audit (no application or visual change; CI runs them), Firefox/WebKit.

## 8. Latest-head CI

On implementation head `bef4fe9` (the last commit that changes a test, fixture or inventory file):

- Workflow `CI`, run `38008973876`: **success**. `lint-typecheck-test`, `e2e-critical`, `e2e-a11y`, `ux-audit` all success; `e2e-cross-browser` skipped by design (scheduled/dispatch only).
- Workflow `Journey coverage (full)`, run `38008973820` (triggered because the inventory changed): **PASS**. 131 real claims (action x project), 131 passed, 0 not exercised, 0 failed, 0 passed only on retry. Full E2E 231 passed / 0 failed / 0 flaky / 25 skipped; ux-audit 69/69. Its evidence names the PR's temporary merge commit `055f9dc`, not the branch head.

The commit that adds this section is docs-only (this receipt). CI must be green on it too before the merge; the merge is not performed otherwise.

## 9. Codex findings and fixes

Codex reviewed `bef4fe9`: one finding, no code or test finding.

| # | Severity | Finding | Verdict | Fix |
|---|---|---|---|---|
| 1 | P2 | This receipt still contained its CI, review and final-status placeholders | Valid | Sections 8, 9 and 13 filled in from the runs above (this commit, docs-only) |

## 10. Unresolved and manual items

- FIND-09 open, not touched.
- Manual checks unchanged: MAN-REL-01, MAN-DUE-01, MAN-AUTH-01, MAN-DEAL-01, MAN-WA-01, MAN-PDF-01, MAN-SHARE-01. AUTH-06 automates the app's sign-out; a real Google sign-in and sign-out stays MAN-AUTH-01.
- Still `not_covered` after this batch: 8 P2 actions (Batch B candidates and NAV-08).

## 11. Merge method

Normal merge commit. No generated or large artifact entered the branch history.

## 12. Untouched

`main`, Production, hosted staging, Neon, Vercel, OAuth, repository settings, secrets and stored data were not touched. No schema migration, no dependency change, no CI or baseline change, no application code change.

## 13. Final status

**Merge-ready under the standing `staging`-only authorization, pending green CI on the docs-only head that adds this text.** All nine Batch A actions are real in chromium and chromium-mobile; CI and the full real-claim run are green on the implementation head; the one review finding is fixed; no hard stop applies. Nothing here touches `main` or Production.

The merge commit is recorded in `STATE.md` by the next autopilot batch, which starts from it.
