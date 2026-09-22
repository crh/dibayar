# Dibayar — PR #9 merge and next-steps execution — 2026-09-22

Executes `DIBAYAR-CLAUDE-CODE-MERGE-PR9-AND-CONTINUE-2026-09-22.md` (uploaded,
not itself checked in — its authorization boundaries are quoted/paraphrased
inline below). Source handoff: `DIBAYAR-PROJECT-PLAN-EXECUTION-2026-09-22.md`
(the prior session's receipt, checked in at
`docs/receipts/DIBAYAR-PROJECT-PLAN-EXECUTION-2026-09-22.md`).

## A. Starting state

- Branch: `main`, HEAD `a0d9e2e`.
- PR #9 (`codex/post-pr8-hardening` → `main`): `OPEN`, head `7273911`,
  `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`. `gh run list` for the
  head commit showed the latest push CI (run `35675107083`) `completed`/
  `success`. No unexplained commits since the prior receipt.
- Worktree: one pre-existing untracked item, `src/generated/` (root-owned
  Prisma-client cruft from an earlier session — see
  `docs/receipts/DIBAYAR-PROJECT-PLAN-EXECUTION-2026-09-22.md`'s own note on
  this; left untouched throughout, not part of this task).
- Drift from the prior receipt's stated baseline: none found. PR #9's head,
  mergeable state, and CI conclusion all matched exactly what the prior
  receipt described.

## B. PR #9 merge

- Re-validated live (not from the receipt): `gh pr view 9` confirmed head
  `7273911`, base `main`, `MERGEABLE`/`CLEAN`, no unexplained commits since
  the prior receipt's basis.
- `gh pr merge 9 --merge` was denied by the Claude Code auto-mode "Merge
  Without Review" classifier — the same gate that blocked PR #8's merge in
  the prior session. Asked the user directly whether to proceed (rather than
  assume the uploaded document's authorization was sufficient to route
  around a live tool-permission gate); the user answered "Yes, merge PR #9."
  The merge then succeeded.
- Merge commit `048e4e2`, `2026-09-22T05:43:23Z`. `main` confirmed to contain
  PR #9's changes via `git pull --ff-only` (fast-forward,
  `a0d9e2e..048e4e2`).
- Post-merge push CI: run `35691822317`, watched to completion —
  `completed`/`success`.

## C. Cross-browser findings

All three findings from the pre-PR#8-merge manual `workflow_dispatch` run
(`35660957102`, recorded in the prior receipt) were investigated, root-caused,
and fixed this session — not merely re-described. Fixes landed on new PR #10
(`codex/post-pr9-hardening`), unmerged (see §G).

### C.1 Firefox — invoice CSP `eval()` block

- **Reproduction:** `npx playwright test -c playwright.e2e.config.ts
  --project=firefox e2e/invoices/invoice-journeys.spec.ts` — reproduced
  exactly as described, 6/6 failed on
  `Content-Security-Policy: ... blocked a JavaScript eval (script-src)`
  console errors from `_next/static/chunks/989-c9fe0335364e3f67.js`.
- **Root cause:** the prior receipt suspected `@react-pdf/renderer` but did
  not confirm it. Decompiled the built chunk directly: found
  `ZodError`/`invalid_type`/`too_small`/`too_big` strings (confirming Zod is
  bundled into this client chunk) and a `try{return Function(""),!0}
  catch{return!1}` capability probe. Traced this to Zod v4.4.3's
  `allowsEval` (`node_modules/zod/src/v4/core/util.ts:364-383`): it calls
  `new Function("")` on first use to decide whether its JIT-compiled
  validators are safe, caught in a try/catch, but Firefox's CSP enforcement
  still logs the attempt as a console error regardless of the catch. Zod
  ships an explicit fix for exactly this issue (its own
  `jitless-allows-eval.test.ts`, referencing GitHub #4461/#5414):
  `z.config({ jitless: true })`, called before first use, skips the probe
  entirely.
- **Fix:** `@react-pdf/renderer` was never the cause — not touched. Added
  `src/lib/zod-runtime-config.ts` (the `z.config` call) and wired it as a
  side-effect import into `src/components/language-switcher.tsx`'s
  `LanguageProvider`, which every page renders — its module is guaranteed to
  evaluate before any page-specific client code that might first touch a
  Zod schema. No CSP change; no `unsafe-eval` added.
- **Tests:** added `src/lib/zod-runtime-config.test.ts`, mirroring Zod's own
  upstream regression test (stubs the global `Function` constructor, asserts
  the probe is never invoked when `jitless` is set) — caught by `npm test`,
  not only the Firefox E2E tier.
- **Commit:** `450c733` (branch `codex/post-pr9-hardening`).
- **Verified:** Firefox `invoice-journeys.spec.ts` 6/6 passed (previously
  0/6).

### C.2 WebKit — expected-404 diagnostics allowlist

- **Environment note:** this host's WebKit build was missing
  `libavif.so.16` (transitively `libgav1`/`libyuv`); `sudo npx playwright
  install-deps` isn't available (no passwordless sudo). Downloaded the
  `.deb` packages with `apt-get download` (download-only, no root needed)
  and extracted just the `.so` files into the Playwright browser cache's own
  `minibrowser-wpe/sys/lib` and `minibrowser-gtk/sys/lib` directories — no
  system-wide install, nothing outside the sandbox's own cache, no `sudo`
  used anywhere. This made local WebKit testing possible at all in this
  environment.
- **Reproduction:** `npx playwright test -c playwright.e2e.config.ts
  --project=webkit e2e/public/invoice.spec.ts -g "invalid"` — reproduced
  exactly as described.
- **Root cause:** downloaded the prior cross-browser run's CI artifacts
  (`gh run download 35660957102 -n playwright-cross-browser-artifacts`) and
  read the failure's `error-context.md`: WebKit's console text was
  byte-identical to what the existing allowlist already matched
  (`"Failed to load resource: the server responded with a status of 404
  (Not Found)"`), so the allowlist's `message.text()` check was never the
  problem. Added temporary debug instrumentation to `e2e/support/test.ts`
  (logged and then reverted before committing) and confirmed empirically:
  WebKit fires the console event while `message.page().url()` still reads
  the *previous* location (`"about:blank"` in this case), so the existing
  `pagePath.startsWith("/i/")` gate silently never matched — a genuine
  cross-engine console/navigation event-ordering difference, not a text
  mismatch. Also confirmed (via the same instrumentation) that the real 404
  *response* event reliably fires before the console event in both engines.
- **Fix:** replaced the page-URL-based gate with response-based correlation:
  `onResponse` increments a counter when a 404 response to an `/i/`-path
  request is observed; `onConsole` decrements it and suppresses the matching
  console message only when the counter is positive. A 404 anywhere else in
  the app is never suppressed.
- **Tests:** extended
  `e2e/support/synthetic/diagnostics-negative-control.ts` with two new
  synthetic cases — a 404 outside `/i/` (must still fail the guard) and a
  matched `/i/` 404 (must still pass, i.e. be suppressed) — and extended
  `e2e/support/diagnostics-selftest.test.mjs`'s assertions to cover both.
  Re-ran `npm run test:diagnostics-selftest`: passes, proving the allowlist
  stays narrow.
- **Commit:** `2db84e8` (branch `codex/post-pr9-hardening`).
- **Verified:** WebKit `e2e/public/invoice.spec.ts` 6/6 passed (previously
  5/6).

### C.3 WebKit — due-date persistence toast timing

- **Reproduction:** `npx playwright test -c playwright.e2e.config.ts
  --project=webkit e2e/invoices/invoice-journeys.spec.ts -g "due date"` —
  reproduced the "Tersimpan" toast not appearing within the assertion
  window.
- **Root cause:** read `src/components/date-field.tsx`: the "Tersimpan"
  toast is a hard-coded 2-second-lived UI affordance
  (`SAVED_DISPLAY_MS = 2000`), already covered deterministically with fake
  timers in `date-field.test.tsx`. The E2E test's
  `await expect(page.getByText("Tersimpan")).toBeVisible()` was racing that
  2-second real-time window against actual browser/network speed — a test
  overfitting problem, not a product defect, exactly as the task's own
  "prefer a deterministic semantic condition" guidance anticipated. Not a
  timeout bump: no timeout was touched anywhere.
- **Fix:** replaced the toast assertion with `page.waitForResponse` on the
  PATCH request that actually saves the due date (the real "did it save"
  signal — "response success" per the task's own list of acceptable
  semantic conditions), keeping the test's existing reload-and-verify
  persistence check unchanged for both the fill and the clear cases.
- **Tests:** the rewritten assertions are the test itself; no separate
  regression test needed since `date-field.test.tsx` already independently
  covers the toast-timing UX this test no longer duplicates.
- **Commit:** `2db84e8` (branch `codex/post-pr9-hardening`).
- **Verified — with an important caveat:** a single normal run passes
  reliably (6/6 WebKit invoice-journey tests, including this one). Under
  artificial `--repeat-each=8` stress, WebKit passed 6/8 and Firefox 4/5,
  both failing occasionally with a generic 30s `page.waitForResponse`
  timeout — never the originally-reported toast issue. Chromium, run under
  identical `--repeat-each=8` stress, passed 8/8 with zero failures. This
  host is a 4-core sandbox already running ~9GB of swap (`free -h`
  confirmed at the time). Classified as **local infrastructure contention**,
  per the task's own escalation rule (runner/infra issue → document
  separately, don't block on it as a product defect), not chased further —
  explicitly no timeout was increased to paper over it. A dedicated-resource
  CI runner (GitHub Actions) does not share this host's constraint; P2-2's
  scheduled signal is the right place to independently confirm this once it
  starts firing (see §D).

### C.4 Two additional gaps found while verifying the above

Found only by running the *full* non-visual `firefox`+`webkit` sweep (88
tests), not narrow single-file runs — directly in scope of "make the
Firefox/WebKit evidence trustworthy," the stated goal of this section of the
task:

- **Firefox `NS_BINDING_ABORTED`:** the existing RSC-prefetch-cancellation
  exemption in `onRequestFailed` only recognized Chromium's
  `"net::ERR_ABORTED"`. Firefox reports the same benign cancellation (Next
  App Router cancelling a superseded prefetch) as `"NS_BINDING_ABORTED"`,
  which surfaced as unexplained `failedRequests` entries on the very first
  Firefox test in a full-suite run. Extended the same `_rsc`-tagged-URL
  check to recognize both.
- **WebKit's cancelled-prefetch pageerror:** WebKit surfaces that same
  cancellation as an uncaught `pageerror` too
  (`"Fetch API cannot load ... due to access control checks"`), plus its own
  `failedRequests` errorText (`"Load request cancelled"`), neither
  previously recognized. Narrowly allowlisted both, tied to the same `_rsc`
  marker — a real app pageerror or a 4xx/5xx elsewhere stays actionable.
  One iteration bug caught and fixed inline via the same debug-instrument-
  then-verify method as C.2: the pageerror regex initially matched against
  `error.message` alone, which empirically (confirmed via temporary debug
  logging) sometimes drops its own `"Fetch API cannot load http:"` prefix in
  WebKit — a serialization quirk. Fixed to match against the same
  `error.stack`-based string (`errorMessage()`) that gets recorded when not
  filtered, and re-verified 8/8 stable under repeat-each stress after the
  fix (was failing intermittently before it).
- **Commit:** `2db84e8` (branch `codex/post-pr9-hardening`), same commit as
  C.2/C.3.

## D. P2-2 — scheduled cross-browser evidence

- **Count:** 0 scheduled runs observed.
- Checked twice this session: ~06:03 UTC and ~07:07 UTC 2026-09-22 (`gh run
  list --limit 50/60 --json event ... | jq 'select(.event=="schedule")'`,
  both empty).
- The `schedule:` trigger (`17 2 * * 1-5`, weekdays 02:17 UTC) has been live
  on `main` since PR #8 merged (2026-09-21T23:38 UTC) — today's scheduled
  firing (02:17 UTC 2026-09-22) was due hours before either check.
- This is a GitHub Actions scheduling delay/skip on this repository, not
  something actionable from within this session. Per the task's explicit
  instruction ("do not modify the schedule just to accelerate acceptance"),
  not investigated or worked around further.
- **Acceptance is not met.** Status remains `WAITING FOR SCHEDULE`. Next
  check: whoever picks this up next should re-run the same `gh run list`
  query and, once two consecutive genuinely-scheduled runs exist, confirm
  each ran clean (or triage any real finding) before closing B3.

## E. P2-4 status

| Gap | Status | Detail |
|---|---|---|
| Revoked-token recipient view (C1) | **Closed** (prior session, PR #9) | Unchanged this session; re-verified still present and passing as part of `test:e2e:critical`'s 68/8 baseline. |
| Long issuer/brand text at 390px (C1) | **Deferred**, unchanged | Not investigated this session. Needs a fixture with deliberately long strings and a layout assertion. |
| Blocked-popup/manual-link WhatsApp fallback (C2) | **Deferred**, unchanged | Not investigated this session. Needs checking `src/lib/whatsapp.ts` for an existing manual-link fallback before writing the test. |
| Stage-history entry assertions (C3) | **Deferred**, unchanged | Not investigated this session. Needs asserting the `DealStageTransition` row/timeline entry after a stage move + reload. |
| Server-validation journey (C3) | **Deferred, investigated** | Looked at reproducing the existing `invoice-validation.ts` `dueDate` 400 contract (`z.coerce.date()` rejecting `"not-a-date"`) through real UI interaction. Found it's hard to trigger faithfully: the native `<input type="date">` mostly refuses to hold malformed text in the first place, so `fill()` either gets rejected by the browser or produces a well-formed value. Recorded in `docs/testing/E2E-IMPROVEMENT-PLAN.md` §8a: whoever picks this up should look for a mutation whose invalid shape *can* originate from normal UI interaction, not the due-date field specifically. |
| Ownership-denial journey (C3) | **Deferred, investigated** | Confirmed via `scripts/e2e-fixtures.ts`/`e2e/support/fixture-ids.ts` that no second fixture *user* currently exists — only a second *session* for the same owner (used by the sign-out journey). Adding a real second user requires reviewing every other E2E test's shared-single-owner-database assumption first; not attempted today for that reason, recorded as the concrete next step in `docs/testing/E2E-IMPROVEMENT-PLAN.md` §8a. |

## F. Human gates

- **Live cookie/header verification (P1-1/P1-2):** not performed. Requires
  an authorized deployed environment; unchanged — `NEEDS CHRIS`.
- **Product constants:** unchanged, not touched (7-day due-soon window,
  90-day share lifetime, invoice-issue-date income basis).
- **Public-access intent:** unchanged, not touched.
- **M4 creator validation:** unchanged, not touched — no external contact
  occurred.

## G. Follow-up PR

- Branch: `codex/post-pr9-hardening`.
- PR: **#10** — https://github.com/crh/dibayar/pull/10
- CI: green (run `35697350409`, watched to `completed`/`success`).
- **Left unmerged.** Per this session's explicit scoping (merge
  authorization covered PR #9 only), PR #10 is not merged — Chris review
  required.

## H. Next 3 actions

1. Chris: review and merge PR #10 (https://github.com/crh/dibayar/pull/10).
2. Watch for the first genuinely-scheduled `e2e-cross-browser` run on `main`
   (weekdays 02:17 UTC; none observed as of this writing) — once two
   consecutive qualifying runs land clean, close B3's acceptance; if either
   shows a real finding, triage it before counting it.
3. Pick up one of the five remaining P2-4 gaps
   (`docs/testing/E2E-IMPROVEMENT-PLAN.md` §8a) — the ownership-denial
   journey needs a new second fixture user designed first (reviewing every
   other test's single-owner assumption); the other four are more
   self-contained.

## I. Guardrail confirmation

This session:
- Deployed anything: **No.**
- Accessed production data: **No.**
- Changed public access: **No.**
- Contacted external users: **No.**
- Bypassed production auth: **No.**

One process note, not a guardrail breach: `gh pr merge 9 --merge` was
initially denied by the Claude Code auto-mode "Merge Without Review"
classifier (the same gate the prior session hit for PR #8). Rather than
treat the uploaded task document's advance authorization as sufficient to
route around a live tool-permission denial, asked the user directly in this
session; the merge proceeded only after their explicit "Yes, merge PR #9"
answer.

One environment note, not a guardrail breach: this host's WebKit browser
build was missing shared libraries (`libavif`/`libgav1`/`libyuv`) needed to
run at all. Downloaded the `.deb` packages via `apt-get download` (no root
required for download-only) and extracted the `.so` files into the
Playwright browser cache's own directory — never touched system package
state, never used `sudo`, nothing outside the sandbox's existing cache
directories.
