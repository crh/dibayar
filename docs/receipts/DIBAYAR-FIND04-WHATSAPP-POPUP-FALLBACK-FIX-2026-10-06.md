# Receipt — FIND-04 WhatsApp popup-fallback fix, 2026-10-06/07

Claude Code (worker) prepared this for Chris, in Asia/Jakarta time. **PR #29 into `staging` is open and not merged.** Nothing was deployed or released. No Production, hosted-staging or Neon database was read or written; no Vercel, Neon, OAuth or repository setting was changed; no Preview or Neon branch was created; no visual baseline was updated. All database work used the disposable local `127.0.0.1:55432/dibayar_test`. No credential or share token was printed.

## 1. Start gate (verified live, 2026-10-06)

- PR #28 MERGED at 2026-10-06T00:22:05Z, merge commit `41c3553`, an ancestor of `origin/staging` (= `41c3553`). No open PRs; no existing FIND-04 PR.
- Worktree `/home/kenji/code/dibayar-find04-popup` on `fix/whatsapp-popup-fallback-2026-10-05`, from `origin/staging` `41c3553`. The main checkout's branch and its three untracked items were left as found.

## 2. Root cause

Invoice detail (`sendWhatsApp`) and the Beranda queue (`openReminder`) called `window.open(href, "_blank", "noopener,noreferrer")` and treated `null` as "blocked". The HTML spec returns `null` whenever `noopener` is set, even when the tab opened. A standalone probe on this host confirmed it in Chromium, Firefox and WebKit. So the **Buka WhatsApp** fallback showed after every successful hand-off, and a real block was indistinguishable. Both call sites also ran only after an awaited request, outside the click task.

## 3. Fix (`src/lib/whatsapp-popup.ts`, used by both surfaces)

1. `window.open("", "_blank")` synchronously inside the click/tap, before any `await`, without `noopener`: the return value is a real handle, and `null` is a real block → fallback link.
2. `popup.opener = null` immediately, while the tab is still `about:blank`.
3. When the URL is known, the tab is navigated by a `rel="noreferrer"` / `referrerpolicy="no-referrer"` link inside its own document. `popup.location.replace()` was rejected: the probe showed it sends Dibayar's origin as Referer in Chromium and Firefox under the app's `strict-origin-when-cross-origin` policy.
4. The tab is closed on every path that does not hand it a URL (share failure, contact-save failure, number still invalid). A draft number that is already unusable never opens a tab. If the person closed the blank tab first, the fallback link is shown and no second tab opens.

Probe result in all three engines: one tab, child `window.opener === null`, no `Referer` on the WhatsApp request. WhatsApp URLs and message text are unchanged. New copy: `whatsapp.opening` ("Membuka WhatsApp…" / "Opening WhatsApp…") shown briefly in the blank tab. `deal-detail-client.tsx`'s **Buka WhatsApp** button ignores `window.open`'s return value and was not part of FIND-04; it is unchanged.

## 4. Tests

| Kind | Where | What it proves |
|---|---|---|
| Popup opened, invoice detail | `e2e/invoices/overdue-invoice.spec.ts` "after the reminder popup opens, invoice detail shows no blocked-popup fallback" (was `test.fail`) | one tab, one `wa.me` request, no Referer, `window.opener === null`, chase message, no fallback link |
| Popup opened, Beranda | `e2e/home/follow-up-queue.spec.ts` "after the reminder popup opens, the row shows no blocked-popup fallback" (was `test.fail`); the HOME-03 hand-off test now also asserts no fallback | same, with the overdue reminder |
| Real blocker, both surfaces | `e2e/whatsapp/popup-blocker.spec.ts` (new; Chromium `--block-new-web-contents`, nothing in the page stubbed) | no tab, no WhatsApp request, fallback link to the right number and message |
| Stubbed blocker, both surfaces | `invoice-journeys.spec.ts`, `follow-up-queue.spec.ts` (`window.open = () => null`) | all engines; fallback link is clicked and opens the same `wa.me` URL |
| Unit / component | `src/lib/whatsapp-popup.test.ts` (6), `follow-up-queue.test.tsx` (+5), `invoice-detail-client.test.tsx` (+4, 11 converted to a fake tab) | opened, blocked, share failure closes the tab, tab closed by the person, repair-and-send |

`keepWhatsAppLocal()` now returns the requests it answered and `trackOpenedPages()` lists new tabs. The older INV-WA-01 test no longer loads the real `wa.me`. No `test.fail()` remains in `e2e/`.

## 5. Negative controls (one at a time, chromium; each reverted)

| Mutation | E2E failures | Unit failures |
|---|---|---|
| NC1 fallback always shown | both "popup opened" tests and the HOME-03 hand-off test: `Buka WhatsApp` count expected 0, received 1 | 3 |
| NC2 fallback never shown | both real-blocker tests and both stubbed-blocker tests: fallback not visible | 4 |
| NC3 two tabs per click | both "popup opened" tests at `expect(opened).toEqual([popup])` | 9 |

After the last revert the tree was clean at the committed head; `NC-TEMP` appears nowhere in `src/` or `e2e/`.

## 6. Coverage (generated)

| Metric | Before (`41c3553`) | After |
|---|---|---|
| Real interaction | 54/94 = 57.4% | **56/94 = 59.6%** |
| P0 real | 28/30 | 28/30 |
| P1 real | 24/38 | **26/38** |
| Outstanding P0/P1 | 15 | **13** |
| `--require-results` (full E2E + ux-audit) | 92/92 | **96 passed, 0 not exercised** |

HOME-03 and INV-WA-02 → `automated_real_interaction` (chromium, chromium-mobile). FIND-04 → fixed (PR open, not merged, not on `main`). FIND-01, FIND-05, FIND-06 untouched.

## 7. Local validation

An unplanned host reboot on the night of 2026-10-06 wiped the first run's logs and left the test database empty. After Chris restarted the DB, the checked-in migrations were applied to it with `npx prisma migrate deploy` (target checked as `localhost:55432/dibayar_test` first), and every long gate was rerun on 2026-10-07. The host was heavily loaded by other users throughout (load average 11–25 on 4 cores).

| Gate | Result |
|---|---|
| `npm run lint` / `typecheck` | 0 / 0 |
| `npm test` | 908/908 (83 files) |
| `npm run build` / `e2e:build` | 0 / 0 |
| `test:journey-coverage` / `coverage:journeys` / `test:diagnostics-selftest` | 24/24 / OK / 1/1 |
| `test:e2e:critical` | 137 passed, 0 failed, 0 flaky, 23 skipped; `--results`: 91 real claims passed, 5 not exercised (4 ux-audit, A11Y-02) |
| `test:e2e` (full non-visual) | 149 passed, 0 failed, 0 flaky, 23 skipped |
| `test:e2e:a11y` | 12 passed, 1 skipped |
| `ux:audit` | specs 69/69; functional, responsive, state PASS; `@visual` 9/9 fail locally → overall FAIL locally |

**`@visual` locally:** the nine diff pixel counts (17557, 15200, 13708, 10584, 13943, 9743, 27355, 39880, 12367) are identical to the clean-staging counts in the Phase 2A receipt §8, i.e. host font drift. This PR changes no rendered state in the base seed. No baseline was touched.

## 8. Firefox / WebKit (informational, not claimed)

- 2026-10-06, first run: WebKit all passed. Firefox failed two `follow-up-queue.spec.ts` tests, HOME-02 listing (which never touches WhatsApp) and the HOME-03 hand-off, with timeouts and missing-element errors, in 2 of 3 repeats. A clean-staging control then passed 4/4, and the branch passed 4/4 immediately after.
- 2026-10-07: targeted specs ×2 on both engines: **52 passed, 0 failed**, 8 skipped (the Chromium-only real-blocker tests).
- **Not root-caused.** The failures did not reproduce in the two later runs, but the control ran once and at a different moment, so load is a likely explanation, not a proven one. Watch the scheduled `e2e-cross-browser` lane after merge.

## 9. Residual risks and limits

- Real phones and in-app browsers are not covered by emulation: MAN-WA-01 (updated) checks one tab, no blank tab left behind, and the fallback when a phone browser blocks the tab.
- A browser that opens the blank tab but then refuses the in-tab navigation would leave a "Membuka WhatsApp…" tab; none of the three engines did this.
- The real-blocker test is Chromium-only (the switch is Chromium's) and cannot follow the fallback link, because the switch blocks that tab too; the stubbed tests cover the click.
- FIND-05 (Beranda rotates the share token) is unchanged and still needs a product decision.

## 10. PR and CI

- PR: https://github.com/crh/dibayar/pull/29 (`fix/whatsapp-popup-fallback-2026-10-05` → `staging`), open, **not merged**. Merging needs Chris.
- CI: recorded in the PR conversation once the run on the final head completes.

## 11. Final state

- Temporary control worktree `../dibayar-find04-control` (detached `origin/staging`) removed.
- Local disposable DB: migrated schema, fixtures cleaned up by global teardown.
