# Git safeguards and daily Git backups

Dibayar is a private repository on **GitHub Free**, so GitHub branch protection
and rulesets are unavailable (`GET .../branches/main/protection` returns 403
"Upgrade to GitHub Pro"). Nothing on GitHub's side stops a person or agent with
write credentials from pushing to, force-pushing, or deleting `main` or
`staging`. This document covers the two local safeguards that reduce that risk,
plus the remaining GitHub-side setting:

1. **Local pre-push guard**: a version-controlled hook in every local clone.
2. **Daily Git backups on ALPHA**: immutable, verified `git bundle` snapshots.
3. **GitHub "Automatically delete head branches"** stays **off**, so merging a
   `staging -> main` release PR cannot delete `staging`. Cleanup of merged
   short-lived branches is manual; see `docs/DEVELOPMENT-WORKFLOW.md` "Cleanup".

Branch and promotion policy itself lives in `docs/DEVELOPMENT-WORKFLOW.md`.

---

## 1. Local pre-push guard

`.githooks/pre-push` (POSIX `sh`) reads the ref list git passes to `pre-push`
and rejects any push whose **remote destination** is exactly
`refs/heads/main` or `refs/heads/staging`, on any remote:

| Push | Result |
|---|---|
| `git push origin HEAD:main` (fast-forward) | blocked |
| `git push --force` / `--force-with-lease` to `main`/`staging` | blocked |
| creating or recreating `main`/`staging` | blocked |
| `git push origin --delete staging` / `git push origin :main` | blocked |
| `feature/*`, `fix/*`, `chore/*`, `hotfix/*`, `preview/*`, agent branches | allowed |
| deleting a short-lived branch | allowed |
| look-alikes: `feature/main-cleanup`, `staging-test`, `main-backup`, `staging/old`, tag `main` | allowed |
| malformed hook input (wrong field count, bad object name, unqualified ref) | blocked (fails safe) |

Pushes that change nothing ("Everything up-to-date") and pushes git itself
rejects as non-fast-forward never reach the hook. That's harmless, because
nothing is changed. If a custom `pre-push` hook was chained in (below), it runs
only after these checks pass.

### Install (every local clone: Chris, Claude Code, Hermes)

From a checkout that contains this file:

```sh
scripts/git-safeguards/install-hooks.sh                 # current clone
scripts/git-safeguards/install-hooks.sh --repo /path/to/other/clone
scripts/git-safeguards/install-hooks.sh --check         # 0 = installed and current
```

- It copies the hook into the clone's **common** hooks directory
  (`$(git rev-parse --git-common-dir)/hooks/pre-push`). One install covers the
  clone and all of its `git worktree`s, including worktrees on branches older
  than `.githooks/`. Pointing `core.hooksPath` at the relative path `.githooks`
  would silently disable the hook in those worktrees, so the installer
  doesn't use it.
- It is idempotent. Re-run it after pulling a newer hook (`--check` exits 1
  when the installed copy is stale).
- It never edits global/system git config or `core.hooksPath`, needs no root,
  and uses only `git`, `cp`, `mv`, `chmod`, `grep`. It works the same in Git
  Bash for Windows.
- **Conflicts stop with exit 3 and change nothing.** That covers two cases:
  - `core.hooksPath` is already configured (any scope). Integrate by hand as
    the message explains, or unset it yourself if it's unintended.
  - A `pre-push` hook the installer didn't write already exists. Re-run with
    `--chain-existing` to keep it: it is moved to `pre-push.local` and runs
    after the guard, with the same arguments and stdin. An existing
    `pre-push.local` is never overwritten.
- After installing, it self-tests the installed copy: `main` blocked, a
  feature branch allowed.

### Limitations (read this)

- **This is not server-side protection.** It is per-clone and bypassable:
  `git push --no-verify`, any clone where it isn't installed, the GitHub web
  UI (including "Delete branch" on a PR), the GitHub API, `gh`, or any
  credential with write access.
- **GitHub-hosted PR merges never run a developer's local hook.** Merging a PR
  into `staging` or `main` is governed only by the workflow and Chris's
  approvals.
- A new clone is unprotected until someone runs the installer.
- The only enforceable remote-side protection would be a paid GitHub plan or
  public visibility, and both have been declined. The workflow, reviews, and
  the backups below are the remaining controls.

---

## 2. Daily Git backups on ALPHA

### What it is

`scripts/git-backup/dibayar-git-backup.sh run`, scheduled daily:

1. Fetches `crh/dibayar` (branches and tags) into a **fetch-only bare mirror**
   (`mirror.git`, `--prune`, push URL set to an invalid value).
2. Requires `refs/heads/main` and `refs/heads/staging` to be present, and
   refuses to publish if either is missing.
3. Writes a full, self-contained `git bundle` of all branches and tags into
   `snapshots/.incomplete-<ts>/`, checks that the bundle's refs equal the
   mirror's, writes `SHA256SUMS` and `manifest.txt`, then validates the
   complete snapshot: checksum, `git bundle verify`, restore into a temporary
   bare repo, `fsck`, and every restored ref compared to the manifest.
4. Only then publishes it with an atomic rename to `snapshots/<ts>/` (files
   0400, directory 0500) and updates `LAST_SUCCESS`.
5. Applies retention **after** that publish. See below.

The mirror is overwritten and pruned on every fetch. Older states survive
only in the immutable snapshots, so a branch deleted or force-pushed on GitHub
stays recoverable from every snapshot taken before that happened. This was
tested in `scripts/git-backup.test.mjs`.

**Scope:** Git repository history and refs only. These are **not** backups of
PostgreSQL/Neon data, Vercel deployments, project settings or environment
variables, GitHub settings/issues/PR discussions, or any secret.

### Paths (ALPHA, user `kenji`)

| What | Path | Mode |
|---|---|---|
| Backup root | `~/.local/share/dibayar-git-backup/` | 0700 |
| Mirror | `…/mirror.git` | 0700 |
| Snapshots | `…/snapshots/<YYYYMMDDTHHMMSSZ>/{dibayar-<ts>.bundle,SHA256SUMS,manifest.txt}` | dir 0500, files 0400 |
| Latest pointer | `…/LAST_SUCCESS` | 0600 |
| Logs | `…/logs/<ts>.ok.log`, `…/logs/<ts>.FAILED.log` | 0600 |
| Installed script | `~/.local/lib/dibayar-git-backup/dibayar-git-backup.sh` | 0700 |
| Optional config | `~/.config/dibayar-git-backup/env` (`DIBAYAR_BACKUP_*`, no secrets; really `%E/...`, the systemd user manager's `XDG_CONFIG_HOME`, which the installer resolves the same way) | 0600 |
| systemd units | `~/.config/systemd/user/dibayar-git-backup.{service,timer}` | 0644 |

All of it lives outside the repository and nothing is committed. Fetch
authentication uses the account's existing SSH identity (`ssh -o
BatchMode=yes`). No credential is stored or printed by these scripts.

### Schedule

A `systemd --user` timer: `OnCalendar=*-*-* 03:00:00 Asia/Jakarta`,
`Persistent=true` (a run missed while ALPHA was off happens at next boot).
ALPHA has user lingering enabled, so the timer runs without a login session.

```sh
scripts/git-backup/install-backup-timer.sh              # install/update + enable (idempotent)
scripts/git-backup/install-backup-timer.sh --no-enable  # install only: PREPARED, NOT ACTIVE
```

The installer refuses (exit 3) to overwrite any unit or script it didn't
install, and never overwrites an existing `env` file. Re-run it after merging
changes to `scripts/git-backup/`. The timer runs the installed copy, not the
working tree.

### Retention and disk

- Keep the newest **30 successful** snapshots (`DIBAYAR_BACKUP_KEEP`, default
  30; values below 30 are refused). Older ones are deleted only after a new
  snapshot has been published and validated. A failed run never deletes
  anything.
- Before each run, at least `DIBAYAR_BACKUP_MIN_FREE_MB` (default 1024) must
  be free on the backup filesystem. Otherwise the run **fails and deletes
  nothing**. Free space deliberately; never delete the newest good snapshot to
  make room.
- Sizing (2026-10-03): one bundle is about 17 MB, so 30 snapshots are about
  0.5 GB plus a ~17 MB mirror, against ~41 GB free on `/`. Re-check with
  `status` (it prints free space) as the repository grows.
- Success logs: the newest 90 are kept. **Failed-run logs are never deleted
  automatically.** A run killed before it finished (power loss, `SIGKILL`)
  leaves a bare `<ts>.log`. The next run renames it to `<ts>.FAILED.log`.
- Time budget: each fetch attempt times out after
  `DIBAYAR_BACKUP_FETCH_TIMEOUT_SECONDS` (default 600). With the default
  3 attempts and back-off, the worst case is 33 min. The script refuses
  settings whose worst case exceeds 60 min, so systemd's
  `TimeoutStartSec=90min` never kills a run mid-retry.

### Runbook

```sh
BK=~/.local/lib/dibayar-git-backup/dibayar-git-backup.sh
ROOT=~/.local/share/dibayar-git-backup
```

**Latest successful snapshot** (exits 1 if none, or if the newest is older
than 36 h):

```sh
$BK status
cat $ROOT/LAST_SUCCESS
```

**Timer and last run:**

```sh
systemctl --user list-timers dibayar-git-backup.timer
systemctl --user status dibayar-git-backup.service
journalctl --user -u dibayar-git-backup.service -n 50 --no-pager
```

**Failures:**

```sh
ls -lt $ROOT/logs/*.FAILED.log
less "$(ls -t $ROOT/logs/*.FAILED.log | head -1)"
```

Common causes: network or GitHub outage (it retries 3 times), SSH identity
unusable non-interactively, `main`/`staging` missing upstream (treat as an
incident; see below), or low disk. To run immediately after fixing:
`systemctl --user start dibayar-git-backup.service`.

**Verify a snapshot** (checksum, bundle verify, temp restore, refs equal the
manifest):

```sh
$BK verify                       # latest
$BK verify 20261003T031649Z      # a specific one
( cd $ROOT/snapshots/<ts> && sha256sum -c SHA256SUMS )   # checksum only
```

**Temporary restore** (non-destructive, never touches GitHub):

```sh
T=$(mktemp -d)
git clone --quiet $ROOT/snapshots/<ts>/dibayar-<ts>.bundle "$T/dibayar"
git -C "$T/dibayar" rev-parse origin/main origin/staging   # compare to manifest.txt
grep -E '^ref refs/heads/(main|staging) ' $ROOT/snapshots/<ts>/manifest.txt
rm -rf "$T"
```

**Recover a lost or overwritten branch:** never repair `main`/`staging` by
pushing the old SHA back directly or with force. That is the exact operation
the workflow forbids.

1. Pick the snapshot taken before the incident and `verify` it.
2. Restore it into a temp directory (above) and find the commit you need:
   `git -C "$T/dibayar" log --oneline origin/staging`.
3. Fetch that history into a normal clone:
   `git fetch $ROOT/snapshots/<ts>/dibayar-<ts>.bundle refs/heads/staging:refs/heads/recovery/staging-<ts>`
4. If a short-lived branch was lost, push it under a new ordinary name
   (`chore/restore-<name>`) and open a PR as usual.
5. If `staging` or `main` was deleted or rewritten on GitHub, **stop and
   involve Chris**. Recreating or resetting a long-lived branch is a Chris
   decision, the guard blocks it locally on purpose, and Vercel/Neon
   behaviour for those branches must be checked first. Prefer restoring
   content through a reviewable PR (`chore/restore-...` into the surviving
   branch) when possible.

### Failure domain and residual risks

- **All snapshots live only on ALPHA's disk.** A disk failure, loss of ALPHA,
  or compromise of the `kenji` account can destroy every snapshot along with
  the mirror. GitHub remains the primary copy, and every developer clone is a
  partial second copy. If an independent copy becomes necessary, the
  recommendation is a second, **encrypted, off-host** destination (for example
  an encrypted copy of the newest bundle to separate storage). That is not set
  up, and needs Chris's approval and a decision on where encryption keys live.
- The fetch uses `crh`'s existing SSH identity on ALPHA, which has **write**
  access to GitHub. The backup only ever fetches, and the mirror's push URL is
  disabled, but a narrowly scoped **read-only deploy key** would reduce the
  blast radius. Creating one is a Chris-only credential change; to switch, set
  `DIBAYAR_BACKUP_REMOTE_URL` / `GIT_SSH_COMMAND` in the `env` file.
- A force-push or deletion is only recoverable if it happened after at least
  one snapshot captured the earlier state. Changes made and lost within the
  same day may never be captured.
- `Persistent=true` catches up after downtime, but a backup gap longer than a
  day shows only in `status` (stale after 36 h). Nothing alerts on it
  automatically.

### Tests

```sh
npm run test:git-safeguards
```

These use only throwaway local repositories in a temp directory: no network,
no GitHub, no real pushes. They cover the hook (synthetic `pre-push` input
under both `sh`/dash and `bash`, plus real pushes into a local bare remote and
a worktree), installer idempotency and conflicts, and the backup's
publish/verify/retention/failure behaviour. CI (`.github/workflows/`) doesn't
run them. Run them locally when changing these scripts.
