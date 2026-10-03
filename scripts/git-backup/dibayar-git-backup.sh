#!/usr/bin/env bash
# dibayar-git-backup v1
#
# Daily Git repository backup for crh/dibayar: a fetch-only bare mirror plus an
# immutable, timestamped, self-contained `git bundle` snapshot per run.
# Runbook: docs/GIT-SAFEGUARDS-AND-BACKUPS.md.
#
# Commands:
#   run             fetch, bundle, validate, publish a snapshot, then apply retention
#   verify [NAME]   re-check a published snapshot (default: latest): checksum,
#                   bundle verify, restore into a temp repo, compare to manifest
#   status          show the latest successful snapshot and its age (exit 1 if stale)
#
# Configuration (environment; the systemd unit reads an optional EnvironmentFile):
#   DIBAYAR_BACKUP_ROOT        default ${XDG_DATA_HOME:-$HOME/.local/share}/dibayar-git-backup
#   DIBAYAR_BACKUP_REMOTE_URL  default git@github.com:crh/dibayar.git (fetch only)
#   DIBAYAR_BACKUP_KEEP        successful snapshots to keep, default 30 (minimum 30)
#   DIBAYAR_BACKUP_REQUIRED_BRANCHES  default "main staging"
#   DIBAYAR_BACKUP_MIN_FREE_MB free space required before a run, default 1024
#   DIBAYAR_BACKUP_STALE_HOURS `status` staleness threshold, default 36
#   DIBAYAR_BACKUP_FETCH_ATTEMPTS / _RETRY_SECONDS / _TIMEOUT_SECONDS  default 3 / 60 / 600
#     (worst-case fetch time must stay within FETCH_BUDGET_SECONDS=3600, well
#     inside the systemd unit's TimeoutStartSec=90min, so a hung network fails
#     cleanly with a .FAILED.log instead of being killed mid-run)
#
# Only Git refs/history are backed up (branches and tags). This is NOT a
# backup of PostgreSQL/Neon data, Vercel deployments or settings, or secrets.

set -Eeuo pipefail
umask 077

ROOT=${DIBAYAR_BACKUP_ROOT:-${XDG_DATA_HOME:-$HOME/.local/share}/dibayar-git-backup}
REMOTE_URL=${DIBAYAR_BACKUP_REMOTE_URL:-git@github.com:crh/dibayar.git}
KEEP=${DIBAYAR_BACKUP_KEEP:-30}
REQUIRED_BRANCHES=${DIBAYAR_BACKUP_REQUIRED_BRANCHES:-main staging}
MIN_FREE_MB=${DIBAYAR_BACKUP_MIN_FREE_MB:-1024}
STALE_HOURS=${DIBAYAR_BACKUP_STALE_HOURS:-36}
FETCH_ATTEMPTS=${DIBAYAR_BACKUP_FETCH_ATTEMPTS:-3}
RETRY_SECONDS=${DIBAYAR_BACKUP_FETCH_RETRY_SECONDS:-60}
FETCH_TIMEOUT=${DIBAYAR_BACKUP_FETCH_TIMEOUT_SECONDS:-600}
FETCH_BUDGET_SECONDS=3600
KEEP_SUCCESS_LOGS=90

MIRROR="$ROOT/mirror.git"
SNAPDIR="$ROOT/snapshots"
LOGDIR="$ROOT/logs"
LAST_SUCCESS="$ROOT/LAST_SUCCESS"
SNAP_RE='^[0-9]{8}T[0-9]{6}Z$'

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# Never print credentials that may be embedded in an https URL.
redact_url() { printf '%s' "$1" | sed -E 's#(://)[^/@]+@#\1REDACTED@#'; }

require_int() {
	case $2 in '' | *[!0-9]*) die "$1 must be a non-negative integer (got '$2')" ;; esac
}

check_config() {
	require_int DIBAYAR_BACKUP_KEEP "$KEEP"
	require_int DIBAYAR_BACKUP_MIN_FREE_MB "$MIN_FREE_MB"
	require_int DIBAYAR_BACKUP_STALE_HOURS "$STALE_HOURS"
	require_int DIBAYAR_BACKUP_FETCH_ATTEMPTS "$FETCH_ATTEMPTS"
	require_int DIBAYAR_BACKUP_FETCH_RETRY_SECONDS "$RETRY_SECONDS"
	require_int DIBAYAR_BACKUP_FETCH_TIMEOUT_SECONDS "$FETCH_TIMEOUT"
	if [ "$KEEP" -lt 30 ] && [ "${DIBAYAR_BACKUP_ALLOW_LOW_KEEP:-0}" != 1 ]; then
		die "DIBAYAR_BACKUP_KEEP=$KEEP is below the 30-snapshot policy minimum"
	fi
	[ "$KEEP" -ge 1 ] || die "DIBAYAR_BACKUP_KEEP must be at least 1"
	[ "$FETCH_ATTEMPTS" -ge 1 ] || die "DIBAYAR_BACKUP_FETCH_ATTEMPTS must be at least 1"
	[ "$FETCH_TIMEOUT" -ge 1 ] || die "DIBAYAR_BACKUP_FETCH_TIMEOUT_SECONDS must be at least 1"
	# Attempts time out, then sleep RETRY_SECONDS * attempt between them.
	local worst=$(( FETCH_ATTEMPTS * FETCH_TIMEOUT + RETRY_SECONDS * (FETCH_ATTEMPTS - 1) * FETCH_ATTEMPTS / 2 ))
	if [ "$worst" -gt "$FETCH_BUDGET_SECONDS" ]; then
		die "worst-case fetch time ${worst}s exceeds the ${FETCH_BUDGET_SECONDS}s budget (systemd TimeoutStartSec would kill the run); lower DIBAYAR_BACKUP_FETCH_ATTEMPTS/_TIMEOUT_SECONDS/_RETRY_SECONDS"
	fi
	[ -n "$REQUIRED_BRANCHES" ] || die "DIBAYAR_BACKUP_REQUIRED_BRANCHES is empty"
}

# Successful snapshot names, oldest first.
list_snapshots() {
	[ -d "$SNAPDIR" ] || return 0
	local d name
	for d in "$SNAPDIR"/*/; do
		[ -d "$d" ] || continue
		name=$(basename "$d")
		[[ $name =~ $SNAP_RE ]] || continue
		grep -qx 'status: success' "$d/manifest.txt" 2>/dev/null || continue
		printf '%s\n' "$name"
	done | sort
}

# Verify a snapshot directory end to end. Prints findings; returns non-zero on failure.
verify_snapshot() {
	local dir=$1 work bundle expected actual ref sha refs_tmp
	[ -f "$dir/manifest.txt" ] || { log "verify: no manifest in $dir"; return 1; }
	bundle=$(sed -n 's/^bundle_file: //p' "$dir/manifest.txt")
	[ -n "$bundle" ] && [ -f "$dir/$bundle" ] || { log "verify: bundle file missing in $dir"; return 1; }

	(cd "$dir" && sha256sum --check --quiet --strict SHA256SUMS) || { log "verify: SHA-256 mismatch in $dir"; return 1; }
	log "verify: checksum OK ($(cut -d' ' -f1 "$dir/SHA256SUMS"))"

	work=$(mktemp -d "${TMPDIR:-/tmp}/dibayar-restore.XXXXXX")
	# shellcheck disable=SC2064
	trap "rm -rf '$work'; trap - RETURN" RETURN
	git init --quiet --bare "$work/restore.git"
	git -C "$work/restore.git" bundle verify --quiet "$dir/$bundle" || { log "verify: git bundle verify failed"; return 1; }
	log "verify: git bundle verify OK"
	git -C "$work/restore.git" fetch --quiet --no-tags "$dir/$bundle" 'refs/*:refs/*' || { log "verify: restore fetch failed"; return 1; }
	git -C "$work/restore.git" fsck --no-progress --no-dangling >/dev/null 2>&1 || { log "verify: fsck of restored repo failed"; return 1; }

	refs_tmp="$work/refs"
	git -C "$work/restore.git" for-each-ref --format='ref %(refname) %(objectname)' | sort >"$refs_tmp.actual"
	grep '^ref ' "$dir/manifest.txt" | sort >"$refs_tmp.expected"
	if ! diff -u "$refs_tmp.expected" "$refs_tmp.actual" >/dev/null; then
		log "verify: restored refs differ from manifest"
		diff -u "$refs_tmp.expected" "$refs_tmp.actual" | sed 's/^/  /' || true
		return 1
	fi
	for b in $REQUIRED_BRANCHES; do
		sha=$(git -C "$work/restore.git" rev-parse --verify --quiet "refs/heads/$b^{commit}") || { log "verify: restored repo lacks refs/heads/$b"; return 1; }
		log "verify: restored $b = $sha (matches manifest)"
	done
	log "verify: restore check OK ($(wc -l <"$refs_tmp.actual") refs)"
}

cmd_status() {
	local latest age_h now created
	latest=$(list_snapshots | tail -n 1)
	echo "backup root:   $ROOT"
	echo "snapshots:     $(list_snapshots | wc -l) successful (keep $KEEP)"
	if [ -z "$latest" ]; then
		echo "latest:        NONE"
		return 1
	fi
	created=$(sed -n 's/^created_utc: //p' "$SNAPDIR/$latest/manifest.txt")
	now=$(date -u +%s)
	age_h=$(( (now - $(date -u -d "$created" +%s)) / 3600 ))
	echo "latest:        $latest (created $created, ${age_h}h ago)"
	sed -n 's/^\(bundle_bytes\|bundle_sha256\): /\1: /p' "$SNAPDIR/$latest/manifest.txt" | sed 's/^/  /'
	grep '^ref refs/heads/' "$SNAPDIR/$latest/manifest.txt" | grep -E ' refs/heads/('"$(echo "$REQUIRED_BRANCHES" | tr ' ' '|')"') ' | sed 's/^ref /  /'
	echo "failed logs:   $(find "$LOGDIR" -maxdepth 1 -name '*.FAILED.log' 2>/dev/null | wc -l)"
	echo "free space:    $(df -Pm "$ROOT" | awk 'NR==2 {print $4}') MB"
	if [ "$age_h" -ge "$STALE_HOURS" ]; then
		echo "STALE: latest successful snapshot is older than ${STALE_HOURS}h"
		return 1
	fi
}

cmd_verify() {
	local name=${1:-}
	[ -n "$name" ] || name=$(list_snapshots | tail -n 1)
	[ -n "$name" ] || die "no successful snapshot to verify"
	[[ $name =~ $SNAP_RE ]] || die "invalid snapshot name '$name'"
	[ -d "$SNAPDIR/$name" ] || die "snapshot $name not found under $SNAPDIR"
	log "verify: snapshot $SNAPDIR/$name"
	verify_snapshot "$SNAPDIR/$name" || die "snapshot $name FAILED verification"
	log "verify: snapshot $name PASSED"
}

fetch_mirror() {
	if [ ! -d "$MIRROR" ]; then
		log "creating fetch-only mirror at $MIRROR"
		rm -rf -- "$MIRROR.tmp"
		git init --quiet --bare "$MIRROR.tmp"
		git -C "$MIRROR.tmp" remote add origin "$REMOTE_URL"
		git -C "$MIRROR.tmp" config --replace-all remote.origin.fetch '+refs/heads/*:refs/heads/*'
		git -C "$MIRROR.tmp" config --add remote.origin.fetch '+refs/tags/*:refs/tags/*'
		mv "$MIRROR.tmp" "$MIRROR"
	fi
	git -C "$MIRROR" remote set-url origin "$REMOTE_URL"
	# Push is impossible by construction: this mirror is fetch-only.
	git -C "$MIRROR" config remote.origin.pushurl 'PUSH-DISABLED-read-only-backup-mirror'

	if [ -z "${GIT_SSH_COMMAND:-}" ]; then
		export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=30"
	fi
	export GIT_TERMINAL_PROMPT=0

	local attempt=1
	while :; do
		log "fetching $(redact_url "$REMOTE_URL") (attempt $attempt/$FETCH_ATTEMPTS)"
		# --prune keeps the mirror an exact copy of the remote; older states
		# survive in the immutable snapshots, never in the mirror.
		if timeout "$FETCH_TIMEOUT" git -C "$MIRROR" fetch --quiet --prune --prune-tags origin; then
			break
		fi
		[ "$attempt" -lt "$FETCH_ATTEMPTS" ] || die "fetch failed after $FETCH_ATTEMPTS attempts"
		sleep $((RETRY_SECONDS * attempt))
		attempt=$((attempt + 1))
	done
	git -C "$MIRROR" fsck --no-progress --connectivity-only >/dev/null 2>&1 || die "mirror connectivity check failed"
}

apply_retention() {
	local names count excess name
	names=$(list_snapshots)
	count=$(printf '%s\n' "$names" | grep -c . || true)
	if [ "$count" -le "$KEEP" ]; then
		log "retention: $count successful snapshot(s), keeping all (keep $KEEP)"
		return 0
	fi
	excess=$((count - KEEP))
	printf '%s\n' "$names" | head -n "$excess" | while read -r name; do
		[[ $name =~ $SNAP_RE ]] || continue
		log "retention: removing old snapshot $name"
		chmod -R u+w "$SNAPDIR/$name"
		rm -rf -- "${SNAPDIR:?}/$name"
	done
	log "retention: kept newest $KEEP of $count"
}

prune_success_logs() {
	find "$LOGDIR" -maxdepth 1 -name '*.ok.log' -print 2>/dev/null | sort | head -n "-$KEEP_SUCCESS_LOGS" | while read -r f; do
		rm -f -- "$f"
	done
}

# Wrapper: runs the worker through tee and names the log only after both have
# finished, so no output is lost when systemd tears down the service cgroup.
cmd_run() {
	check_config
	mkdir -p "$ROOT" "$SNAPDIR" "$LOGDIR"
	chmod 700 "$ROOT" "$SNAPDIR" "$LOGDIR"

	# One run at a time. The worker inherits this lock via fd 9.
	exec 9>"$ROOT/.lock"
	flock -n 9 || die "another backup run holds $ROOT/.lock"

	# A run killed before classifying its log (SIGKILL, timeout, power loss)
	# leaves a bare <ts>.log; it was a failure, so keep it as one.
	local stray
	for stray in "$LOGDIR"/*.log; do
		[ -e "$stray" ] || continue
		case $stray in *.ok.log | *.FAILED.log) continue ;; esac
		printf '%s run was interrupted before completion; classified as FAILED by a later run\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$stray"
		mv -f "$stray" "${stray%.log}.FAILED.log"
		log "classified interrupted run log $(basename "$stray") as FAILED" >&2
	done

	local name logfile rc
	name=${DIBAYAR_BACKUP_TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}
	[[ $name =~ $SNAP_RE ]] || die "invalid snapshot timestamp '$name'"
	logfile="$LOGDIR/$name.log"

	set +e
	DIBAYAR_BACKUP_TIMESTAMP=$name bash "${BASH_SOURCE[0]}" __run 2>&1 | tee -a "$logfile"
	rc=${PIPESTATUS[0]}
	set -e

	if [ "$rc" -eq 0 ]; then
		mv -f "$logfile" "$LOGDIR/$name.ok.log"
		prune_success_logs
	else
		# Failed-run logs are never deleted automatically.
		mv -f "$logfile" "$LOGDIR/$name.FAILED.log"
	fi
	return "$rc"
}

cmd_run_worker() {
	local name=$DIBAYAR_BACKUP_TIMESTAMP tmp

	# Only ever started by cmd_run, which holds the lock (inherited fd 9).
	[ -e /proc/self/fd/9 ] || die "internal __run must be started by 'run'"

	tmp="$SNAPDIR/.incomplete-$name"
	on_exit() {
		local rc=$?
		if [ "$rc" -ne 0 ]; then
			rm -rf -- "$tmp" 2>/dev/null || true
			if [ -d "$SNAPDIR/$name" ]; then
				log "RUN FAILED (exit $rc) after publishing $name; check retention/log steps"
			else
				log "RUN FAILED (exit $rc); no snapshot published; previous snapshots untouched"
			fi
		fi
	}
	trap on_exit EXIT

	log "dibayar-git-backup run $name starting (root $ROOT)"
	[ ! -e "$SNAPDIR/$name" ] || die "snapshot $name already exists"

	local free_mb
	free_mb=$(df -Pm "$ROOT" | awk 'NR==2 {print $4}')
	if [ "$free_mb" -lt "$MIN_FREE_MB" ]; then
		die "only ${free_mb} MB free under $ROOT (< ${MIN_FREE_MB} MB); not deleting existing snapshots — free space or lower DIBAYAR_BACKUP_MIN_FREE_MB deliberately"
	fi

	# Leftovers from an interrupted run (we hold the lock, so none is live).
	local stale
	for stale in "$SNAPDIR"/.incomplete-*; do
		[ -e "$stale" ] || continue
		log "removing stale incomplete snapshot $(basename "$stale")"
		chmod -R u+w "$stale"; rm -rf -- "$stale"
	done

	fetch_mirror

	local b sha
	for b in $REQUIRED_BRANCHES; do
		sha=$(git -C "$MIRROR" rev-parse --verify --quiet "refs/heads/$b^{commit}") || die "required branch '$b' missing from remote; refusing to publish"
		log "fetched $b = $sha"
	done

	mkdir "$tmp"
	local bundle="dibayar-$name.bundle"
	git -C "$MIRROR" bundle create --quiet "$tmp/$bundle" --branches --tags || die "git bundle create failed"

	git -C "$MIRROR" for-each-ref --format='ref %(refname) %(objectname)' refs/heads refs/tags | sort >"$tmp/refs.expected"
	git bundle list-heads "$tmp/$bundle" | awk '{print "ref " $2 " " $1}' | sort >"$tmp/refs.bundle"
	diff -q "$tmp/refs.expected" "$tmp/refs.bundle" >/dev/null || die "bundle refs differ from mirror refs"

	(cd "$tmp" && sha256sum "$bundle" >SHA256SUMS)
	{
		echo "format: dibayar-git-backup/v1"
		echo "status: success"
		echo "snapshot: $name"
		echo "created_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
		echo "source_url: $(redact_url "$REMOTE_URL")"
		echo "host: $(hostname)"
		echo "git_version: $(git --version | awk '{print $3}')"
		echo "bundle_file: $bundle"
		echo "bundle_bytes: $(wc -c <"$tmp/$bundle" | tr -d ' ')"
		echo "bundle_sha256: $(cut -d' ' -f1 "$tmp/SHA256SUMS")"
		echo "bundle_verify: ok"
		echo "restore_check: ok"
		echo "ref_count: $(wc -l <"$tmp/refs.expected" | tr -d ' ')"
		cat "$tmp/refs.expected"
	} >"$tmp/manifest.txt"
	rm -f "$tmp/refs.expected" "$tmp/refs.bundle"

	# Validate the complete snapshot (checksum, bundle verify, temp restore vs
	# manifest) BEFORE publishing it.
	verify_snapshot "$tmp" || die "pre-publish verification failed"

	chmod 400 "$tmp"/*
	chmod 500 "$tmp"
	mv -T "$tmp" "$SNAPDIR/$name"   # atomic publish (same filesystem)
	printf '%s\n' "$name" >"$LAST_SUCCESS.tmp"
	mv -f "$LAST_SUCCESS.tmp" "$LAST_SUCCESS"
	log "PUBLISHED snapshot $SNAPDIR/$name ($(sed -n 's/^bundle_bytes: //p' "$SNAPDIR/$name/manifest.txt") bytes)"

	# Retention only after the new snapshot is published and validated.
	apply_retention
	trap - EXIT
	log "dibayar-git-backup run $name OK"
}

case ${1:-run} in
	run) cmd_run ;;
	__run) cmd_run_worker ;;  # internal: invoked by cmd_run
	verify) shift; cmd_verify "${1:-}" ;;
	status) cmd_status ;;
	-h | --help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//' ;;
	*) echo "usage: $0 [run|verify [SNAPSHOT]|status]" >&2; exit 2 ;;
esac
