# Dibayar — CI font-hardening + post-PR#11 state reconciliation — 2026-09-23/24

Written for an independent reviewing agent (or Chris) to audit this
session's work. Executed
`DIBAYAR-CI-FONT-HARDENING-POST-PR11-PROMPT-2026-09-23.md`: close the
recurring `next/font/google` CI reliability issue and reconcile `STATE.md`
after PR #11's merge.

## 1. Starting `main` HEAD

- `main` HEAD at session start: `0aab7df4baba6c2b6c83f2d3d8ade8c78631a17f`
  (the merge commit for PR #11, `codex/p2-4-ownership-denial`). Confirmed via
  `git fetch origin` + `git log origin/main`; matched the prompt's stated
  context exactly.
- Working tree was clean except the pre-existing, gitignored, root-owned
  `src/generated/` leftover (untracked, unrelated, not touched).
- The local checkout's current branch (`codex/p2-4-ownership-denial`) was
  still sitting at its pre-merge tip (`a03e98a`), not `main`'s new HEAD — per
  the guardrail, branched a fresh `codex/ci-font-self-hosting` from
  `origin/main` directly (`git checkout -b codex/ci-font-self-hosting
  origin/main`), not from that stale local branch.

## 2. Relevant CI run IDs

- `35823168277` — post-merge CI on `main` for PR #11's merge commit
  (`0aab7df`), triggered by the merge push. `lint-typecheck-test`,
  `e2e-critical`, `ux-audit`: PASS. `e2e-cross-browser`: skipped by design
  (push event). `e2e-a11y`: **FAIL** — the failure this task fixes.
- `35833560777` — the next scheduled (`schedule` event) run on `main`,
  2026-09-23T07:47:19Z, PASS. First qualifying post-PR#10-merge scheduled run
  for P2-2's acceptance criterion (see §14).
- `35928162658` — this PR's (#12) own CI run; status recorded in §11/§12
  below once it completed.

## 3. Exact failure signature

From `gh api repos/crh/dibayar/actions/jobs/107059847223/logs` (the
`e2e-a11y` job of run `35823168277`), during `npm run test:e2e:a11y`'s
`next build --webpack` step, before any Playwright test ran:

```
src/app/i/[token]/page.tsx
An error occurred in `next/font`.

TypeError: Cannot read properties of null (reading '1')
    at /home/runner/work/dibayar/dibayar/node_modules/next/dist/compiled/@next/font/dist/google/loader.js:122:78
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async Promise.all (index 3)
    at async nextFontGoogleFontLoader (/home/runner/work/dibayar/dibayar/node_modules/next/dist/compiled/@next/font/dist/google/loader.js:104:33)
    ...
    at Object.<anonymous> (.../next-font-loader/index.js??...!/home/runner/work/dibayar/dibayar/node_modules/next/font/google/target.css?{"path":"src/app/i/[token]/page.tsx","import":"Source_Serif_4",...})
```

Build failed with `Failed to compile.` immediately after.

## 4. Root-cause evidence

- The failure occurs inside `next-font-loader` while fetching
  `Source_Serif_4`'s font files/CSS from Google's font CDN during the
  webpack production build (`next build --webpack`, used by every
  `test:e2e:*` script and by CI's `e2e-a11y`/`e2e-critical`/`ux-audit`
  jobs — see `package.json`'s `e2e:build` script).
- This is a **build-time network dependency**, not a bug in `page.tsx`'s own
  code: `e2e-critical` and `ux-audit` in the *same* CI run (`35823168277`),
  on separate runners, ran the identical `next build --webpack` (they also
  render `Plus_Jakarta_Sans` via the root layout on every page) and
  succeeded — grepping that job's full log for `Plus_Jakarta`/`Jakarta`
  found zero hits, confirming Jakarta's Google Fonts fetch succeeded on
  `e2e-a11y`'s runner while Source Serif 4's failed on the same runner in
  the same build. Each CI job independently rebuilds from scratch (fresh
  `npm ci`, no shared build cache across jobs), so each one's font fetch is
  an independent network round-trip to Google that can fail on its own.
- This exact failure signature (same error, same `Source_Serif_4` import,
  resolved by a bare retry with zero code changes) had already recurred
  twice during PR #11 itself, on a docs-only commit — documented in
  `docs/receipts/DIBAYAR-P2-4-OWNERSHIP-DENIAL-2026-09-23.md` §9b/§14 as "a
  pattern worth a maintainer's attention" before this task existed to fix
  it.
- Confirmed via `curl -sI https://fonts.googleapis.com` from this
  environment that outbound network access itself is not blocked here;
  the flake is specific to intermittent reachability/response validity from
  GitHub Actions' runners to Google's font CDN at the moment of the build,
  not a hard network-egress restriction.

## 5. All `next/font/google` usages found (Phase B inventory)

| File | Font | Weights | Usage | Build-time external dependency? |
|---|---|---|---|---|
| `src/app/layout.tsx` | `Plus_Jakarta_Sans` | 400, 500, 600, 700, 800 | Root layout, applied via `--font-plus-jakarta` CSS variable to `<body>`; drives `--font-sans` (body text) on every page in the app | Yes — identical `next/font/google` build-time fetch, same risk class, did not fail in this particular run but is exposed to the same failure mode on every build |
| `src/app/i/[token]/page.tsx` | `Source_Serif_4` | 500, 600 | Public invoice page only, applied via `--font-source-serif` CSS variable, consumed by `.public-invoice .font-serif` for money amounts | Yes — this is the import that actually failed in CI run `35823168277` |

No other `next/font/google` imports exist anywhere in `src/`. `next/font/local` was not used anywhere before this change. `src/test-setup.ts` had a
`vi.mock("next/font/google", ...)` for Vitest (updated, see §8).
`--font-source-serif` had no other consumer besides `page.tsx`'s own
`.variable` class and `globals.css`'s one `.public-invoice .font-serif`
rule.

Both usages were removed comprehensively, per the task's Phase B
requirement, not just the one that failed in this specific CI run.

## 6. Implementation

Both imports moved from `next/font/google` to `next/font/local`, backed by
real `.woff2` files committed to the repository (not fetched at build or
runtime):

- `src/app/layout.tsx`: `Plus_Jakarta_Sans` → `localFont({ src: [...5
  weight files...], display: "swap", variable: "--font-plus-jakarta" })`.
  Font files under `src/app/fonts/plus-jakarta-sans/`.
- `src/app/i/[token]/page.tsx`: `Source_Serif_4` → `localFont({ src: [...2
  weight files...], display: "swap", variable: "--font-source-serif" })`.
  Font files under `src/app/i/[token]/fonts/`.
- `src/app/globals.css`: `--font-sans` changed from the literal string
  `"Plus Jakarta Sans", var(--font-system)` to `var(--font-plus-jakarta),
  var(--font-system)`. This was a required correction, not an unrelated
  refactor — see §7.
- `src/test-setup.ts`: the `vi.mock("next/font/google", ...)` (which
  returned canned `{variable, className}` objects, since Vitest runs
  outside Next's build pipeline and never executes the real font loader)
  was replaced with an equivalent `vi.mock("next/font/local", ...)` mock.
  No test asserted on the specific mocked class-name strings, so this was a
  drop-in swap.
- No new npm dependency was added. `@fontsource/plus-jakarta-sans` and
  `@fontsource/source-serif-4` were installed only inside a scratch
  directory outside the repository, used solely as a verifiable,
  correctly-licensed source for the binary `.woff2` files, then discarded —
  `package.json`/`package-lock.json` are untouched.

Verified in the actual built CSS output (`.next/static/chunks/*.css` after
`npm run build`) that:

- No `fonts.googleapis.com` or `fonts.gstatic.com` URL appears anywhere in
  the build output (`grep -rl googleapis .next/static/chunks/*.css` /
  `gstatic` — zero matches).
- `--font-plus-jakarta` resolves to `"plusJakartaSans", "plusJakartaSans
  Fallback"` and `--font-source-serif` resolves to `"sourceSerif",
  "sourceSerif Fallback"` — both backed by local `@font-face` rules with
  `src:url(../media/....woff2)`.

## 7. Font source/license handling

Both fonts are Google Fonts, licensed **SIL Open Font License 1.1**. The
`.woff2` files were copied unmodified from the official npm distribution:

- `@fontsource/plus-jakarta-sans@5.3.0` — `files/plus-jakarta-sans-latin-{400,500,600,700,800}-normal.woff2`
- `@fontsource/source-serif-4@5.3.0` — `files/source-serif-4-latin-{500,600}-normal.woff2`

Fontsource re-packages Google Fonts' own release artifacts without
modification. Only the `latin` subset at the weights already in use was
kept, matching the previous `next/font/google` configuration
(`subsets: ["latin"]`). Each font's `LICENSE-OFL.txt` (copied verbatim from
the npm package) sits alongside its `.woff2` files; a top-level
`src/app/fonts/NOTICE.md` documents this provenance in one place. No font
binary was placed in this receipt, in a generated ZIP, or in any log —
only as normal application repository assets under `src/app/`.

## 8. Files changed

```
src/app/layout.tsx                                    (modified)
src/app/i/[token]/page.tsx                             (modified)
src/app/globals.css                                    (modified, 1 line)
src/test-setup.ts                                      (modified)
src/app/fonts/NOTICE.md                                (new)
src/app/fonts/plus-jakarta-sans/LICENSE-OFL.txt        (new)
src/app/fonts/plus-jakarta-sans/*-{400,500,600,700,800}-normal.woff2  (new, 5 files)
src/app/i/[token]/fonts/LICENSE-OFL.txt                (new)
src/app/i/[token]/fonts/source-serif-4-latin-{500,600}-normal.woff2   (new, 2 files)
```

Total new binary asset size: ~144 KB (84 KB Plus Jakarta Sans, 60 KB Source
Serif 4).

## 9. Validation commands/results

Run on branch `codex/ci-font-self-hosting`:

| Command | Result |
|---|---|
| `npm run lint` | PASS — 0 errors / 0 warnings across 268 files |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 768/768 (80 test files) |
| `npm run build` (Turbopack, canonical) | PASS — no Google Fonts network calls |
| `npm run e2e:build` (`next build --webpack`, the exact mode CI's `e2e-a11y` uses) | PASS — "Compiled successfully", no font errors |
| `npm run test:diagnostics-selftest` | PASS |
| `npm run test:e2e:a11y` | PASS — 12 passed / 1 skipped (this is the exact job CI failed on in run `35823168277`) |
| `npm run test:e2e:critical` (first full run) | 81 passed / 2 failed — see below |

The two `test:e2e:critical` failures (`auth/session.spec.ts`'s sign-out
test and `invoice-journeys.spec.ts`'s due-date persistence test, both
`page.waitForResponse` timeouts at exactly 30s) were investigated rather
than reflexively retried: `free -h` at the time showed ~9.2Gi/15Gi RAM used
and 9.4-9.5Gi of swap in use, from unrelated Hermes-agent and Chrome
processes already running on this shared machine (confirmed via `ps aux
--sort=-%mem`), not from anything this branch touched. Re-ran both failing
specs in isolation (`npx playwright test --grep "sign out via the account
menu|due date edits and clears persist after reload"`): both passed cleanly
in 4.0s and 3.4s respectively — nowhere near the 30s timeout — confirming
system-level resource contention, not a regression. This matches the exact
"local-sandbox resource-contention" signature already classified as
pre-existing infrastructure noise in `docs/receipts/DIBAYAR-PR9-MERGE-AND-NEXT-STEPS-2026-09-22.md`
and `docs/receipts/DIBAYAR-P2-4-OWNERSHIP-DENIAL-2026-09-23.md`, just
manifesting on `chromium` this time rather than `webkit` (system-wide
memory pressure was measurably worse in this session than in either prior
one).

## 10. Visual verification

**Public invoice page** (the page whose font import actually failed in
CI): wrote a temporary Playwright spec (not committed) that navigated to a
real seeded share link, read `getComputedStyle` on the `.font-serif` money
element, and took a full-page screenshot. Result:
`serifComputedFamily: "sourceSerif, \"sourceSerif Fallback\", \"Source
Serif 4\", Georgia, serif"` — the self-hosted font resolves correctly as
the first choice in the chain. The screenshot shows "Rp 6.000.000" rendered
in a genuine serif face (visible serifs on digits and "Rp"), matching the
pre-existing design intent. Temporary spec and screenshot were deleted
after inspection, not committed.

**Site-wide `Plus_Jakarta_Sans`** (used in the root layout on every page):
`npm run test:e2e:a11y` and `test:e2e:critical` both exercise Beranda, Deal
board, Invoice list, and Pengaturan under the real root layout and passed,
so the sans-serif body font renders and functions correctly everywhere.

Additionally ran `npm run test:e2e:visual` (the Playwright `@visual`
snapshot suite) as an extra check, since this change touches every page's
body font. **Correction to an initial misreading of this repo's CI
wiring**: `npm run ux:audit` (`scripts/ux-audit.ts`) itself runs the
`@visual` suite as one of its own steps (step 4, `chromium` +
`chromium-mobile-visual` projects) before generating its report — it is
not a separate, non-gating suite; `ux-audit` genuinely is a CI gate for
`@visual`. (First read of `.github/workflows/e2e.yml` alone made it look
like `ux-audit` only ran `tests/ux-audit/`'s own detectors; reading
`scripts/ux-audit.ts` itself corrected that.) Locally this run showed ~3%
pixel diffs on every baseline that renders `Plus_Jakarta_Sans` text
(Beranda, Deals, Invoice list/detail, Pengaturan; the public invoice page
has no existing `@visual` baseline at all). Inspected the
expected/actual/diff images directly: correct family, correct weights,
correct layout, fully legible — a uniform, whole-page sub-pixel
text-positioning shift consistent with the pinned OFL release and Google's
live-served build being a slightly different font version/hinting pass of
the same upstream font, not a wrong font or broken rendering.

This same font-metrics shift, however, had a second, more substantive
effect — see §12/§13: it moved one already-marginal touch target below the
44px minimum on CI's specific rendering, which is a genuine, gating
`ux-audit` failure, not merely a cosmetic pixel diff.

## 11. PR

- Branch: `codex/ci-font-self-hosting`, pushed to `origin`.
- PR: **#12** — https://github.com/crh/dibayar/pull/12 —
  `codex/ci-font-self-hosting` → `main`.
- Base: `origin/main` at `0aab7df` (PR #11's merge commit) — confirmed
  clean branch-from-main per the guardrail, not from any stale local
  branch state.

## 12. PR CI status

Run `35928162658`: `lint-typecheck-test` PASS, `e2e-a11y` **PASS** (the
job this task exists to fix — confirmed fixed), `e2e-critical` PASS,
`e2e-cross-browser` skipped (pull_request event, by design), **`ux-audit`
FAIL**.

`ux-audit`'s failure has two components, both traced to
`gh api repos/crh/dibayar/actions/jobs/107409036644/logs`:

1. The `@visual` pixel diffs from §10 (expected, non-substantive).
2. A genuine `tests/ux-audit/t27.verification.spec.ts` assertion failure:
   `expect(captureFailures, "T-27 detector/capture findings").toEqual([])`
   found one real finding on **both** language captures of
   `home__populated__xs320` (Beranda at a 320px viewport, Indonesian and
   English): `sub-44px-interactive-target` on the "Lihat semua →" / "See
   all →" link in `src/components/home/nearest-deals.tsx`. The detector's
   `document.elementFromPoint`-based march (`tests/ux-audit/support/detectors.ts`'s
   `measureEffectiveExtent`) measured the link's `.ds-tap-target::before`
   pseudo-overlay's real hit-testable extent at only **37.5px** tall
   (need ≥44px) on CI, even though the CSS requests `max(100%, 44.5px)`.

Investigated this as a real, substantive finding rather than retrying:

- **Not reproducible locally.** Ran the same `t27.verification.spec.ts`
  test locally (`npm run ux:audit -- --route=/`) and it passed cleanly. A
  targeted probe script (`document.elementFromPoint` sampled at the exact
  link, ±15px vertically) found the anchor resolving correctly at every
  sampled point on this machine — zero occlusion, full margin. This is a
  genuine local-vs-CI rendering difference, not a deterministic bug
  reproducible from the source alone.
- **Confirmed attributable to this PR, not a pre-existing flake**: the
  identical `t27.verification.spec.ts` suite (run as part of `ux-audit`)
  passed on `main` immediately before this change (run `35823168277`,
  `ux-audit: PASS`, pre-dating this PR). It only started failing on this
  branch.
- **The `.ds-tap-target::before` CSS's own declared size is not the fix.**
  `measureEffectiveExtent` marches outward from the link's real rect via
  real hit-testing until it finds a point that resolves to a *different*
  element — it is bounded by wherever a neighboring element's own paint
  actually starts, not by how large `.ds-tap-target::before`'s CSS
  `max(100%, Npx)` requests. Since the march already stopped at 37.5px
  while the CSS requests 44.5px (i.e., an occluder is being hit *before*
  the requested box would even be reached), enlarging that CSS constant
  further would not move the occluder and would not fix this — confirmed
  by walking the CSS stacking/painting order and the detector's own
  algorithm rather than guessing.
- **Root cause is therefore a layout-spacing question, not a font-config
  one**: the parent row (`nearest-deals.tsx`'s `flex items-center
  justify-between gap-3` heading row) is only ~24px tall locally, so the
  pseudo-overlay's desired 12.5px vertical extension past the link's own
  ~19.5px box on each side necessarily reaches past that row's own
  boundary into neighboring content's space; whatever sits there normally
  clears it with margin to spare, but the same page-wide font-metrics
  shift that produced the ~3% `@visual` diff (§10) was, on CI's specific
  rendering, enough to nudge that neighboring content a few pixels closer
  and clip the overlay's reach.

**Decision: did not attempt a layout/spacing fix in this PR.** Any real
fix here (e.g., more vertical gap around that row) is a visible,
DESIGN.md-governed spacing change across every Beranda screenshot
(desktop and mobile alike), not a font-configuration change, and I have no
way to verify it against the one environment where the finding actually
reproduces (CI) without blindly guessing and burning review cycles on
speculative pushes. That crosses from "self-host a font" into a layout
decision this task's own scope explicitly asks me not to freelance
("avoid unrelated refactoring," "do not broaden this into unrelated
cleanup"). Flagging for Chris/a maintainer to decide: either accept a
follow-up task to harden `.ds-tap-target`'s effective spacing (not just
its own declared size) around this specific row, or treat this as
acceptable single-environment variance to monitor.

## 13. Remaining risks

- **`ux-audit` is currently red on this PR** due to the `sub-44px-interactive-target`
  finding in §12 — a real, CI-environment-specific touch-target regression
  on Beranda's "Lihat semua →"/"See all →" link at the 320px viewport,
  attributable to this change's font-metrics shift but requiring a
  layout/spacing fix outside this task's font-configuration scope. This
  blocks a clean merge until either fixed or explicitly accepted.
- The `@visual` baseline diffs from the `Plus_Jakarta_Sans` font-source
  change (§10) are real but cosmetic (correct rendering, sub-pixel
  positioning only); a maintainer should decide whether to regenerate
  `e2e/visual/visual.spec.ts-snapshots/` via `update-visual-baselines.yml`.
- This fix eliminates the *build-time* Google Fonts dependency entirely,
  which removes the original failure mode (confirmed: `e2e-a11y` now
  passes). It does not (and does not need to) address the general class of
  transient CI network flakiness for any other dependency.
- No other risk: no schema change, no new dependency, no auth/security
  surface touched, no deployment or Production/public-access change.

## 14. P2-2 status (unchanged scope, not accelerated)

Checked `gh run list --event schedule`: two scheduled runs exist total —
`35701111449` (2026-09-22T07:44:20Z, failure, **pre**-PR#10-merge, correctly
excluded per the task's own acceptance definition) and `35833560777`
(2026-09-23T07:47:19Z, **success**, post-PR#10-merge — the first qualifying
run). P2-2 remains **WAITING FOR SCHEDULE**, 1 of 2 qualifying consecutive
runs. No manual trigger was used or counted toward this acceptance
criterion, per the task's explicit instruction.

## Guardrails confirmed

- No deployment occurred; no Production data touched; no public-access
  change.
- No commit directly to `main` — all work on `codex/ci-font-self-hosting`,
  branched from `origin/main`.
- No history rewrite, no force-push, no `--no-verify`.
- No database schema/data change.
- No new npm runtime/build dependency (`package.json`/`package-lock.json`
  untouched).
- PR left open, unmerged, per the task's stop-point instruction — awaiting
  Chris's review.

## 15. Addendum 2026-09-24 — Codex review finding fixed

A follow-up session picked up PR #12 to check its current state and found
Codex's automated PR review (`chatgpt-codex-connector`, submitted
2026-09-23T22:28Z against commit `c281e84`) had left one substantive P1
finding on `src/app/i/[token]/fonts/LICENSE-OFL.txt`: the file's copyright
line read "Google Inc.", but the bundled `.woff2` files identify themselves
(via their own name-table metadata) as Adobe-originated Source Serif 4 —
OFL condition 2 requires the applicable copyright notice to travel with
every redistributed copy, and this one didn't apply.

Root cause: `@fontsource/source-serif-4@5.3.0`'s own shipped `LICENSE` file
(verified via `npm pack` + extraction, not assumed) carries this same
generic "Google Inc." header — the §7/§6 claim above that the license file
was "copied verbatim" from that package was accurate, but the package's own
source is wrong for this particular font. Fetched the canonical notice
directly from Google Fonts' own upstream metadata repo
(`raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/OFL.txt`):
"Copyright 2014 The Source Serif 4 Project Authors
(https://github.com/adobe-fonts/source-serif)". Diffed the fetched file
against the repo's copy: only the copyright line and the OFL FAQ URL
(`http://scripts.sil.org/OFL` → `https://openfontlicense.org`, matching the
same upstream file) differed — same license text, same font files. Also
checked `plus-jakarta-sans`'s `LICENSE-OFL.txt` the same way: its copyright
line was already correct ("The Plus Jakarta Sans Project Authors"), only
Fontsource's own cosmetic per-file-variant suffix differed — left
untouched, not a compliance issue.

Fixed in commit `f23e0c5`, pushed to `codex/ci-font-self-hosting`, replied
to the Codex review thread (`gh api .../pulls/12/comments`,
`in_reply_to=4087930579`) documenting the fix. Re-ran CI on the new commit
(run `35938850849`): `lint-typecheck-test`/`e2e-critical`/`e2e-a11y` PASS
(unchanged), `ux-audit` **still FAIL** — confirmed via job log diff
(`sub-44px-interactive-target` finding, identical 16370/14476/12917
pixel-diff counts across all three `@visual` baselines) that this is the
exact same §12/§13 finding, byte-for-byte identical, not a new regression —
expected, since a `.txt` license file has no rendering effect. §13's
remaining risk (the touch-target/visual-baseline decision) is unchanged and
still awaiting Chris.
