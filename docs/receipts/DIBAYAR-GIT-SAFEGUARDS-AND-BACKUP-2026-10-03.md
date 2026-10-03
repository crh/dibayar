# Receipt — Local branch safeguards + daily Git backups (2026-10-03)

**Status: PARTIAL — MANUAL ACTION REQUIRED.** Everything on ALPHA is done and
verified. What's left is outside this session's reach: the PR merge (Chris),
installing the hook in any clone outside ALPHA, and observing the first
timer-driven run on 2026-10-04 03:00 WIB.

| Item | State | Evidence |
|---|---|---|
| Files committed | YES, on `chore/git-safeguards-backup-2026-10-03` | §1 |
| Local hook installed | YES, ALPHA clone + all 7 worktrees; other machines unverified | §2 |
| Backup run validated | YES, 2 real snapshots + independent temp restore | §3 |
| Scheduler active | YES, `dibayar-git-backup.timer` enabled; first scheduled firing not yet observed | §3 |
| PR opened | YES, into `staging`, **not merged** | §1 |

## 1. Repository

- Host/user: `ALPHA` / `kenji`; TZ `Asia/Jakarta (WIB, +0700)`, NTP synced.
- Repo `crh/dibayar`: private, default `main` (`gh api`). `origin` =
  `git@github.com:crh/dibayar.git`.
- Remote heads at start: `main` `308a339e7de8`, `staging` `3929c4c04b33` (PR #21 merge).
- Starting checkout: `/home/kenji/code/dibayar` on `fix/visual-month-rollover`
  (`9d19828`, upstream gone) with untracked
  `docs/receipts/DIBAYAR-CREATOR01-READY-2026-10-01.md`,
  `docs/receipts/DIBAYAR-UX-AUDIT-MONTH-ROLLOVER-FIX-2026-10-01.md`, `src/generated/`.
  **Preserved untouched**: all work for this task was done in a new worktree,
  `/home/kenji/code/dibayar-git-safeguards`. Nothing was reset, stashed, or cleaned.
- Task branch: `chore/git-safeguards-backup-2026-10-03` from `origin/staging` @ `3929c4c`.
  Target: `staging`. No open PRs at start.
- `delete_branch_on_merge`: **`false`, independently verified** via read-only
  `gh api`. Not changed.
- Branch protection: `GET /branches/main/protection` → 403 "Upgrade to GitHub
  Pro or make this repository public".
- Commits: `c077bf3` (implementation, docs, tests), plus a follow-up recording this PR URL and making `install-backup-timer.sh` executable.
- PR: **https://github.com/crh/dibayar/pull/24** (`chore/git-safeguards-backup-2026-10-03` → `staging`), open, not merged.

Changed files:

| File | Purpose |
|---|---|
| `.githooks/pre-push` | POSIX `sh` guard |
| `scripts/git-safeguards/install-hooks.sh` | idempotent, conflict-safe installer |
| `scripts/git-safeguards.test.mjs` | hook + installer tests |
| `scripts/git-backup/dibayar-git-backup.sh` | `run` / `verify` / `status` |
| `scripts/git-backup/install-backup-timer.sh` | idempotent systemd --user installer |
| `scripts/git-backup/systemd/dibayar-git-backup.{service,timer}` | unit templates |
| `scripts/git-backup.test.mjs` | backup tests (disposable repos) |
| `docs/GIT-SAFEGUARDS-AND-BACKUPS.md` | install guide, limitations, operator runbook |
| `docs/DEVELOPMENT-WORKFLOW.md` | Cleanup policy: auto-delete stays off, manual cleanup; guard pointer |
| `DEPLOYMENT.md` | branch-hygiene current state corrected (auto-delete disabled) |
| `package.json` | `test:git-safeguards` script |
| `STATE.md`, `DAILY_LOG.md` | state entry, 3-day archive, daily log |

Historical receipts that say auto-delete was enabled (2026-09-29/30) were left
as dated records.

## 2. Hook installation and test cases

Installed copy: `/home/kenji/code/dibayar/.git/hooks/pre-push` (0755), identical
to `.githooks/pre-push` (sha256 prefix `c6989e26a80236cb`). `core.hooksPath`
was unset and remains unset. There was no prior custom `pre-push`. A re-run of
the installer reports "already installed and current".

Verified per worktree with real `git push --dry-run` (hook executes; nothing
sent). Results were identical in all 7:

| Worktree (branch) | ff push `main` | `--force-with-lease` `staging` | `--delete main` | `chore/*` push |
|---|---|---|---|---|
| `dibayar` (`fix/visual-month-rollover`) | blocked | blocked | blocked | allowed |
| `dibayar-cron-worktree` (`hermes/governance-phase-aware-cron`) | blocked | blocked | blocked | allowed |
| `dibayar-git-safeguards` (task branch) | blocked | blocked | blocked | allowed |
| `dibayar-playwright-e2e` (`hermes/playwright-e2e`) | blocked | blocked | blocked | allowed |
| `dibayar-v6-1-account-menu-remediation` | blocked | blocked | blocked | allowed |
| `dibayar-v6-1-production-hardening` (`claude/dibayar-week-2026-09-07`) | blocked | blocked | blocked | allowed |
| `dibayar-v6-regression-remediation` | blocked | blocked | blocked | allowed |

Six of the seven have no `.githooks/` directory on their branch and are still
covered, because the hook lives in the shared common hooks directory.
`git ls-remote` afterwards: no probe ref exists on GitHub, and `main`/`staging`
are unchanged. No local automation in `~/.local/bin` or `~/.hermes/bin` pushes
to `main`/`staging`.

Automated: `npm run test:git-safeguards` → **60/60 pass** (52 hook/installer +
8 backup):

- Blocked (under both `sh`=dash and `bash`): direct push to `main`, direct push
  to `staging`, force-update of `main`, (re)creation of `staging`, deletion of
  `main`, deletion of `staging`, zero-sha delete without the `(delete)` marker,
  a protected ref mixed among allowed refs, and a SHA-256 repo.
- Allowed: feature push, fix/chore update, short-lived branch deletion,
  `feature/main-cleanup`, `staging-test`, `main-backup`, `staging/old`, tag
  `main`, and empty input.
- Fails safe on malformed input: too few or too many fields, non-hex sha, short
  sha, unqualified remote ref, whitespace-only line.
- Real pushes to a local bare remote: fast-forward, `--force`,
  `--force-with-lease`, `--delete`, and `:main` are all blocked with the remote
  unchanged. Feature push, force-push and delete of look-alikes are allowed. A
  worktree without `.githooks/` is still blocked.
- Installer: idempotent; `--check` reports missing/current/stale; a stale
  managed copy is updated. An existing `core.hooksPath` gives exit 3 and changes
  nothing. A foreign hook is refused without `--chain-existing`; with it, the
  foreign hook is preserved as `pre-push.local` and runs after the guard (not
  for blocked pushes), and an existing `pre-push.local` is never overwritten. A
  failing chained hook still fails the push.

Bug found and fixed during testing: the first hook draft iterated the
protected-ref list while `IFS` was set to newline, so the list never split and
nothing matched (fail-open). The test suite caught it before installation, and
it was replaced by an exact `case` match.

**Clones still needing installation:** any Dibayar clone on a machine other
than ALPHA (for example Chris's workstation or a Windows/Git Bash checkout).
None could be inspected from this session.

## 3. Backups

Topology: fetch-only bare mirror (branches + tags, `--prune`, push URL
disabled), plus one immutable, self-contained `git bundle` snapshot per run,
validated before an atomic publish.

| Path | Owner / mode |
|---|---|
| `/home/kenji/.local/share/dibayar-git-backup/` | kenji:kenji 0700 |
| `…/mirror.git` | 0700 |
| `…/snapshots/<ts>/` | 0500; bundle/manifest/SHA256SUMS 0400 |
| `…/logs/` | 0700; logs 0600 |
| `/home/kenji/.local/lib/dibayar-git-backup/dibayar-git-backup.sh` | 0700 |
| `/home/kenji/.config/dibayar-git-backup/env` | 0600, defaults only (commented) |
| `/home/kenji/.config/systemd/user/dibayar-git-backup.{service,timer}` | 0644 |

- Scheduler: `systemd --user` timer, `OnCalendar=*-*-* 03:00:00 Asia/Jakarta`,
  `Persistent=true`; systemd 255; `Linger=yes`. `systemd-analyze calendar` →
  next **Sun 2026-10-04 03:00:00 WIB (20:00 UTC Sat)**, then Mon 2026-10-05
  03:00 WIB. `list-timers` shows it enabled. The pre-existing crontab and
  timers were left untouched, and the installer re-run reported every file
  "unchanged".
- Auth: the existing ALPHA SSH identity, non-interactive (`BatchMode=yes`).
  It authenticates as GitHub user `crh`, i.e. a **read-write** credential used
  only for fetch. No credential was created, changed, or printed.
- Real runs, both triggered via `systemctl --user start dibayar-git-backup.service`
  (the same path the timer uses), `Result=success`:
  - `20261003T031649Z`, created 2026-10-03T03:16:56Z
  - `20261003T031806Z` (after the logging fix)
- Snapshot `20261003T031649Z`: bundle `dibayar-20261003T031649Z.bundle`,
  **17,138,634 bytes**, SHA-256
  `623a2eb258b8ca0c36344b08aff105fe145528f39d9be245a1854b13bfa87c98`. Contents:
  28 refs (all branches + tags). `bundle_verify: ok`, `restore_check: ok`. The
  second snapshot has the same bundle hash, as expected with no upstream
  change.
- Independent temp restore, outside the script: `sha256sum -c` OK, then
  `git clone` of the bundle into a scratch dir, `fsck` OK.

  | Branch | Restored | Manifest | GitHub `ls-remote` |
  |---|---|---|---|
  | `main` | `308a339e7de817aa37378d263d51f25c78ea4f09` | same | same |
  | `staging` | `3929c4c04b33539d33f599579230bdca1327f6e6` | same | same |

  The scratch restore was deleted afterwards. `verify 20261003T031649Z` was
  re-run after the second snapshot and PASSED.
- `status`: 2 successful snapshots, latest `20261003T031806Z`, 0 failed logs,
  ~41,000 MB free. The whole backup root is 34 MB.
- Retention: keep the newest 30 successful snapshots (values below 30 are
  refused). Deletion happens only after a new snapshot is published and
  validated, never on a failed run. A run with less than 1024 MB free fails
  and deletes nothing. The newest 90 success logs are kept; failed logs are
  never auto-deleted. Estimated steady state is about 0.5 GB.
- Tested on disposable repos: publish/verify/status, permissions, push-disabled
  mirror, an older snapshot surviving an upstream force-push and branch
  deletion (and still restoring the old SHA), retention ordering, a failed run
  (missing `staging`) publishing nothing and keeping its `FAILED` log, low disk
  deleting nothing, the `KEEP<30` refusal, cleanup of an interrupted
  `.incomplete-*`, and corrupted or truncated bundles failing `verify`.
- Bug found and fixed: in the first real run, the final log line was lost to
  systemd's cgroup teardown (`exec > >(tee)`). It was restructured into a
  wrapper plus a piped worker, and a regression assertion now requires the
  `.ok.log` to end with the `run … OK` line. The second real run confirmed it.

## 4. CI

`.github/workflows/e2e.yml` and `update-visual-baselines.yml` are
**unchanged**. The new tests are not wired into CI. They are local scripts that
run in ~2 s, and adding them was not needed to validate this work. Wiring
`npm run test:git-safeguards` into the existing `lint-typecheck-test` job is an
optional follow-up.

Local gates: `lint` 0 errors (new `.mjs` files included), `typecheck` 0,
`npm test` 780/780, `test:git-safeguards` 60/60, `test:vercel-ignore-build`
48/48, `test:lint-wrapper` 3/3. `build` was not run because no app or build
input changed. `shellcheck` is not installed on ALPHA, so it was not run (gap).
The scripts were syntax-checked with `bash -n` and `dash -n`.

## 5. Manual actions and residual risks

Manual actions:

1. **Chris:** review the PR into `staging` and authorize the merge, or don't.
2. **Any clone outside ALPHA:** `scripts/git-safeguards/install-hooks.sh` (and
   `--check`). Git Bash on Windows is designed for but **untested** here.
3. **After merge:** re-run `scripts/git-backup/install-backup-timer.sh` only if
   `scripts/git-backup/` changed in review. The timer runs the installed copy.
4. **2026-10-04 after 03:00 WIB:** `~/.local/lib/dibayar-git-backup/dibayar-git-backup.sh status`
   and `systemctl --user list-timers dibayar-git-backup.timer` to confirm the
   first timer-driven run.
5. **Optional (Chris):** a read-only deploy key for the backup fetch; a
   second, encrypted, off-host backup copy.

Residual risks:

- **GitHub Free gives no enforceable remote-side protection.** Anyone or
  anything with write credentials can push to, force-push, or delete
  `main`/`staging` via `--no-verify`, an unguarded clone, the web UI
  (including "Delete branch" on a release PR), or the API. GitHub-hosted PR
  merges never run local hooks.
- All snapshots are on ALPHA's single disk, so ALPHA loss destroys them.
- The backup fetch uses a read-write identity.
- No alerting: staleness shows only via `status`.
- Scope: Git only. No Neon/Postgres, Vercel, settings, or secrets are backed up.
