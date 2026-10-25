#!/usr/bin/env bash
# Install the Dibayar protected-branch pre-push guard (.githooks/pre-push) into
# a local clone. Idempotent; safe to re-run after pulling a newer hook.
#
# The hook is copied into the clone's COMMON hooks directory
# ($(git rev-parse --git-common-dir)/hooks), so one install covers the clone
# and every `git worktree` attached to it, whatever branch each has checked
# out. (A relative core.hooksPath=.githooks would silently run no hook in a
# worktree whose branch predates .githooks/.)
#
# It never changes global/system git config, never edits core.hooksPath, and
# never replaces a hook it did not install. Conflicts stop with exit 3 and
# instructions; --chain-existing is the explicit opt-in that preserves an
# existing custom pre-push hook as pre-push.local and runs it after the guard.
#
# Usage:
#   scripts/git-safeguards/install-hooks.sh [--repo DIR] [--check] [--chain-existing]
#
# Exit codes: 0 installed/current, 1 --check found it missing or stale,
#             2 usage/environment error, 3 conflict needing a human decision.
#
# Works in Linux bash and Git Bash for Windows (uses only git, cp, mv, chmod).

set -euo pipefail

MARKER="dibayar-protected-branch-guard"
repo="."
check_only=0
chain_existing=0

usage() { sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
	case $1 in
		--repo) repo=${2:?--repo needs a directory}; shift 2 ;;
		--check) check_only=1; shift ;;
		--chain-existing) chain_existing=1; shift ;;
		-h | --help) usage; exit 0 ;;
		*) echo "install-hooks: unknown option '$1'" >&2; usage >&2; exit 2 ;;
	esac
done

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
src="$script_dir/../../.githooks/pre-push"
if [ ! -f "$src" ]; then
	echo "install-hooks: hook source not found at $src" >&2
	exit 2
fi

if ! top=$(git -C "$repo" rev-parse --show-toplevel 2>/dev/null); then
	echo "install-hooks: '$repo' is not inside a git work tree" >&2
	exit 2
fi
common=$(git -C "$top" rev-parse --git-common-dir)
case $common in
	/* | [A-Za-z]:*) ;;
	*) common="$top/$common" ;;
esac
common=$(cd "$common" && pwd)
hooks_dir="$common/hooks"
target="$hooks_dir/pre-push"
chained="$hooks_dir/pre-push.local"

echo "install-hooks: repository   $top"
echo "install-hooks: hooks dir    $hooks_dir"

# A configured core.hooksPath (any scope) means git ignores $hooks_dir.
if configured=$(git -C "$top" config --show-origin --get core.hooksPath 2>/dev/null); then
	cat >&2 <<EOF
install-hooks: CONFLICT — core.hooksPath is already configured:
  $configured
Git runs hooks from that directory, so installing into $hooks_dir would have
no effect, and editing that setting could disable other hooks. Nothing changed.
Resolve deliberately, then re-run:
  - if that hooks directory belongs only to this clone, copy
    .githooks/pre-push into it (keeping any existing pre-push as
    pre-push.local next to it), or
  - if it is unintended, remove it yourself
    (git config --local --unset core.hooksPath) and re-run this installer.
EOF
	exit 3
fi

same_content() { git diff --no-index --quiet -- "$1" "$2" >/dev/null 2>&1; }
is_managed() { grep -q "$MARKER" "$1" 2>/dev/null; }

state="missing"
if [ -e "$target" ] || [ -L "$target" ]; then
	if is_managed "$target"; then
		if same_content "$src" "$target" && [ -x "$target" ]; then
			state="current"
		else
			state="stale"
		fi
	else
		state="foreign"
	fi
fi

if [ $check_only -eq 1 ]; then
	echo "install-hooks: pre-push guard state: $state"
	[ -f "$chained" ] && echo "install-hooks: chained hook present: $chained"
	[ "$state" = "current" ] && exit 0
	[ "$state" = "foreign" ] && exit 3
	exit 1
fi

if [ "$state" = "foreign" ]; then
	if [ $chain_existing -ne 1 ]; then
		cat >&2 <<EOF
install-hooks: CONFLICT — $target already exists and was not installed by
this script. Nothing changed. To keep it AND add the guard, re-run with
--chain-existing: the existing hook is moved to pre-push.local and runs after
the guard's checks pass (same arguments and stdin).
EOF
		exit 3
	fi
	if [ -e "$chained" ] || [ -L "$chained" ]; then
		echo "install-hooks: CONFLICT — $chained already exists; refusing to overwrite it. Nothing changed." >&2
		exit 3
	fi
	mv "$target" "$chained"
	chmod u+x "$chained"
	echo "install-hooks: preserved existing hook as $chained"
	state="missing"
fi

if [ "$state" = "current" ]; then
	echo "install-hooks: pre-push guard already installed and current"
else
	mkdir -p "$hooks_dir"
	tmp="$target.install.$$"
	cp "$src" "$tmp"
	chmod 755 "$tmp"
	mv -f "$tmp" "$target"
	echo "install-hooks: pre-push guard $([ "$state" = "stale" ] && echo updated || echo installed) at $target"
fi

# Self-test the installed copy with synthetic input (no network, no push).
zero=0000000000000000000000000000000000000000
one=1111111111111111111111111111111111111111
if printf 'refs/heads/x %s refs/heads/main %s\n' "$one" "$zero" | "$target" origin selftest >/dev/null 2>&1; then
	echo "install-hooks: SELF-TEST FAILED — installed hook did not block refs/heads/main" >&2
	exit 1
fi
if [ ! -f "$chained" ]; then
	if ! printf 'refs/heads/x %s refs/heads/feature/x %s\n' "$one" "$zero" | "$target" origin selftest >/dev/null 2>&1; then
		echo "install-hooks: SELF-TEST FAILED — installed hook blocked an ordinary feature branch" >&2
		exit 1
	fi
fi
echo "install-hooks: self-test passed (main blocked, feature branch allowed)"
