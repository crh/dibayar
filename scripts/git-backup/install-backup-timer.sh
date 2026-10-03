#!/usr/bin/env bash
# Install the Dibayar daily Git backup as a systemd --user timer (ALPHA).
# Idempotent; never needs root; never overwrites files it did not install.
#
#   scripts/git-backup/install-backup-timer.sh [--no-enable]
#
# Installs:
#   ~/.local/lib/dibayar-git-backup/dibayar-git-backup.sh   (copy of the repo script)
#   ~/.config/systemd/user/dibayar-git-backup.{service,timer}
#   ~/.config/dibayar-git-backup/env                         (created once, never overwritten)
# then `systemctl --user daemon-reload` and enables/starts the timer
# (skip with --no-enable to leave it PREPARED, NOT ACTIVE).
#
# Exit codes: 0 ok, 2 usage/environment error, 3 conflict with a foreign file.

set -euo pipefail
umask 077

MARKER="dibayar-git-backup v1"
enable=1
while [ $# -gt 0 ]; do
	case $1 in
		--no-enable) enable=0; shift ;;
		-h | --help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) echo "install-backup-timer: unknown option '$1'" >&2; exit 2 ;;
	esac
done

src_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
lib_dir="$HOME/.local/lib/dibayar-git-backup"
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
conf_dir="${XDG_CONFIG_HOME:-$HOME/.config}/dibayar-git-backup"

command -v systemctl >/dev/null || { echo "install-backup-timer: systemctl not found" >&2; exit 2; }

# install_managed SRC DEST MODE: copy only if DEST is absent or ours.
install_managed() {
	local src=$1 dest=$2 mode=$3
	if [ -e "$dest" ] && ! grep -q "$MARKER" "$dest"; then
		echo "install-backup-timer: CONFLICT — $dest exists and is not managed by this installer; nothing overwritten." >&2
		exit 3
	fi
	if [ -e "$dest" ] && cmp -s "$src" "$dest"; then
		echo "install-backup-timer: unchanged  $dest"
	else
		mkdir -p "$(dirname "$dest")"
		cp "$src" "$dest.tmp.$$"
		chmod "$mode" "$dest.tmp.$$"
		mv -f "$dest.tmp.$$" "$dest"
		echo "install-backup-timer: installed  $dest"
	fi
}

# Check every destination before writing any of them.
for dest in "$lib_dir/dibayar-git-backup.sh" "$unit_dir/dibayar-git-backup.service" "$unit_dir/dibayar-git-backup.timer"; do
	if [ -e "$dest" ] && ! grep -q "$MARKER" "$dest"; then
		echo "install-backup-timer: CONFLICT — $dest exists and is not managed by this installer; nothing changed." >&2
		exit 3
	fi
done

install_managed "$src_dir/dibayar-git-backup.sh" "$lib_dir/dibayar-git-backup.sh" 700
install_managed "$src_dir/systemd/dibayar-git-backup.service" "$unit_dir/dibayar-git-backup.service" 644
install_managed "$src_dir/systemd/dibayar-git-backup.timer" "$unit_dir/dibayar-git-backup.timer" 644
chmod 700 "$lib_dir"

mkdir -p "$conf_dir"
chmod 700 "$conf_dir"
if [ ! -e "$conf_dir/env" ]; then
	cat >"$conf_dir/env" <<'EOF'
# dibayar-git-backup runtime config (read by the systemd unit). No secrets here:
# fetch auth comes from the account's existing SSH identity.
# DIBAYAR_BACKUP_ROOT=/home/USER/.local/share/dibayar-git-backup
# DIBAYAR_BACKUP_REMOTE_URL=git@github.com:crh/dibayar.git
# DIBAYAR_BACKUP_KEEP=30
# DIBAYAR_BACKUP_MIN_FREE_MB=1024
EOF
	chmod 600 "$conf_dir/env"
	echo "install-backup-timer: created    $conf_dir/env (defaults commented)"
else
	echo "install-backup-timer: kept       $conf_dir/env (existing, not modified)"
fi

systemctl --user daemon-reload
systemd-analyze calendar --iterations=2 '*-*-* 03:00:00 Asia/Jakarta' | sed 's/^/  /'

if [ $enable -eq 1 ]; then
	systemctl --user enable --now dibayar-git-backup.timer
	systemctl --user list-timers dibayar-git-backup.timer --no-pager
	echo "install-backup-timer: ACTIVE"
else
	echo "install-backup-timer: PREPARED, NOT ACTIVE (enable with: systemctl --user enable --now dibayar-git-backup.timer)"
fi
