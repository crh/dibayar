# Dibayar — Impeccable PR #37 hardening: receipt (2026-10-10)

**Decision: BLOCKED** — on CI only. The code is ready for Chris's review, but
GitHub Actions has not executed a single step on this PR, so nothing here has
been confirmed by CI. Do not merge until CI has actually run and passed.

- PR: https://github.com/crh/dibayar/pull/37 (`chore/impeccable-claude-skill-install-2026-10-10` → `staging`), open, not merged, no auto-merge
- Hardening commit: `5cd9f46a708bfc564a8bb23f0984f7ae7f78189e` (on top of install commit `5f8f2bd`); this receipt is a later docs-only commit
- Base: `origin/staging` @ `794d34d`
- Worktree: `/home/kenji/code/dibayar-impeccable-install`

## Review findings

| Finding | Status | Evidence |
|---|---|---|
| P1 — validate against a committed digest | Fixed (POSIX); Windows fails closed | `scripts/engine-digests.txt` + rewritten launcher; tampered binary refused and never executed in all 5 candidate locations and on download |
| P2 — verify engine version | Fixed (POSIX); Windows fails closed | exact `impeccable-engine 0.1.14` required after the digest matches; fake `999.0.0` and `0.1.140` refused |
| P2 — governance in loaded instructions | Fixed, as model instructions | `CLAUDE.md` section, rules block at top of `SKILL.md`, documenter agent removed; guarded by tests |
| P2 — upstream license | Fixed | `LICENSE` (blob `bb3f6d2`) and `NOTICE.md` (blob `0468271`) from upstream 4.5.2 tags; change notices in modified files |

All four threads were replied to with this evidence and resolved.

## Changed files (hardening commit)

- `.claude/skills/impeccable/scripts/impeccable` — rewritten launcher
- `.claude/skills/impeccable/scripts/impeccable.cmd` — replaced by a fail-closed stub
- `.claude/skills/impeccable/scripts/engine-digests.txt` — new trust manifest
- `.claude/skills/impeccable/SKILL.md` — project rules block inserted (10 lines); rest untouched
- `.claude/skills/impeccable/LICENSE`, `NOTICE.md` — added
- `.claude/agents/impeccable-documenter.md` — removed
- `CLAUDE.md` — new "Impeccable design skill" section (4 lines)
- `docs/tooling/IMPECCABLE.md` — rewritten
- `scripts/impeccable-launcher.test.mjs` — new; `package.json` script `test:impeccable-launcher`; one CI step in `.github/workflows/e2e.yml`

No `src/`, Prisma, app test, dependency or deployment-config change.

## Trusted digest coverage

| Platform | In manifest | Basis | Executed |
|---|---|---|---|
| linux-x64 | yes | npm binary = GitHub release asset digest | yes (`engine-probe`, `detect`) |
| linux-arm64 | yes | same comparison | no |
| darwin-arm64 | yes | same comparison | no; launcher path simulated |
| darwin-x64 | yes | same comparison | no |
| windows-x64 | no | comparison agreed, deliberately not enabled | no |

The comparison: binary from `@impeccable/cli-<platform>@0.1.14`
(`npm pack --ignore-scripts`, hashed locally) against the asset digest of
GitHub release `engine-v0.1.14`.

## Launcher test matrix

`npm run test:impeccable-launcher` — 39 pass, 0 fail. Mock shell-script
engines, throwaway HOME and PATH, curl shim; no network, no real engine.

| Case | bundled | version cache | `~/.impeccable/bin` | PATH | `IMPECCABLE_BIN` | download |
|---|---|---|---|---|---|---|
| trusted digest + pinned version → runs | pass | pass | pass | pass | pass | pass |
| tampered → refused, never executed | pass | pass | pass | pass | pass | pass (deleted, not cached) |
| reports 999.0.0 → refused | pass | pass | pass | pass | pass | — |

Also passing: bad `IMPECCABLE_BIN` does not fall through to a good engine;
tampered cache skipped and a later trusted candidate runs; missing manifest;
no entry for platform; entry only for another version; malformed and duplicate
entries; missing `VERSION`; no hash tool; unsupported OS and CPU;
`IMPECCABLE_DOWNLOAD_BASE` substitution; no `.sha256` sidecar is requested;
no download from inside a probe; simulated macOS arm64 with `shasum` only;
Windows stub shape; governance and license guards.

Negative control: the same suite run against the original upstream launcher
fails 22 of 35 launcher tests.

Not verified: any real execution on macOS, on ARM, or on Windows. The Windows
launcher is a stub checked at string level only.

## Local validation (worktree, after `npm ci`)

| Command | Result |
|---|---|
| `npm run lint` | exit 0, 0 warnings |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 — 84 files, 980 tests passed |
| `npm run test:impeccable-launcher` | exit 0 — 39 pass |
| `npm run test:vercel-ignore-build` | exit 0 — 48 pass |
| `npm run test:lint-wrapper` | exit 0 — 3 pass |
| `npm run test:journey-coverage` | exit 0 — 37 pass |
| `npm run build` | exit 0 |
| `.claude/skills/impeccable/scripts/impeccable engine-probe` | `impeccable-engine 0.1.14`, exit 0 |
| `.claude/skills/impeccable/scripts/impeccable detect --json src/` | exit 2, 1 finding (unchanged: `side-nav.tsx:23`) |
| `git diff --check` on project-authored files | clean |

A first `npm run build` failed because `node_modules` was a symlink to the main
checkout (Turbopack rejects that); it passed after a real `npm ci`.

Not run: Playwright E2E, UX audit, any browser check. No UI changed.

Upstream `reference/*.md` files still carry upstream trailing whitespace
(`extract.md`, `harden.md`, `optimize.md`); left byte-identical.

## CI status

Blocked, cause not established.

- Run `38013259925` (head `5f8f2bd`, 3 attempts) and run `38021042775` (head
  `5cd9f46`): job `lint-typecheck-test` completes as `failure` about 2 seconds
  after it starts, with no runner assigned and zero steps; the four E2E/UX jobs
  are skipped because they depend on it.
- The job has no log (the log blob does not exist). The reason is in the
  check-run annotation, which this token cannot read (HTTP 403), as is the
  account's Actions billing endpoint.
- Ruled out: a failing test (no step ran); Actions disabled on the repo
  (`enabled: true`); a GitHub incident (status page: Actions operational, no
  open incidents at 03:36Z).
- Not ruled out, and not claimed: Actions minutes or spending limit on this
  private repository, a billing problem, or a runner-availability limit. The
  last successful run was PR #36 at 00:44Z.

Operator action: open
https://github.com/crh/dibayar/actions/runs/38021042775, read the annotation on
`lint-typecheck-test`, fix what it names (likely under Settings → Billing and
plans → Actions), then re-run. Accept the result only when the job's steps
actually executed, including "npm run test:impeccable-launcher".

## Preserved, and hooks

- `PRODUCT.md` (`6226c756…`) and `DESIGN.md` (`5f9f597b…`) are byte-identical
  to `origin/staging`.
- `CLAUDE.md` changed by the 4-line pointer only.
- No `.claude/settings.local.json` exists in the worktree; the main checkout's
  copy is untouched. No `.impeccable/` and no `~/.impeccable/` was created.
- Hooks are off. No engine binary, credential, `.env` or machine path is
  committed.

## Residual security assumptions

1. Origin and hash validation is not behavioural or privacy verification. The
   engine is a stripped binary and has not been audited.
2. npm and the GitHub release are the same publisher. The pin detects later
   substitution, not something unwanted in 0.1.14 from the start.
3. Verify-then-exec is not atomic against a same-user process.
4. `npx impeccable ...` bypasses the launcher entirely.
5. Governance is enforced by instructions to the model, not by a technical
   control.
6. `scripts/modern-screenshot.umd.js` ships upstream without a license notice;
   its license was not established.
7. `npx impeccable update` undoes the launcher, the `SKILL.md` block and the
   agent removal; the launcher test is what catches it.

## After merge (not done now)

Reload Claude Code and confirm `/impeccable` is listed. Run read-only
`/impeccable audit` and `/impeccable critique` on one bounded surface, hooks
off. Turn anything actionable into separate work items with Playwright
regression tests and 390px checks, starting with deal-save feedback and deal
deadline validation. The source-level UX findings from the install receipt are
hypotheses until reproduced in a browser.
