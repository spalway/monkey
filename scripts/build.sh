#!/usr/bin/env bash
# Sync the Windows-side anchor sources into the WSL home and build there.
# Program sources cannot build on /mnt/c, so ~/dev/primates is the build dir.
# Run from Windows with:
#   wsl -d Ubuntu -- bash -lc "bash /mnt/c/Users/skizp/crypto/new_projects/primates/scripts/build.sh"
set -euo pipefail

SRC=/mnt/c/Users/skizp/crypto/new_projects/primates/anchor
DST=~/dev/primates

mkdir -p "$DST"
rsync -a --delete \
  --exclude target/ --exclude node_modules/ --exclude .anchor/ \
  "$SRC"/ "$DST"/

# Strip CRLF from anything rsynced off the Windows filesystem.
find "$DST" -type f \( -name '*.rs' -o -name '*.toml' -o -name '*.json' \) \
  -exec sed -i 's/\r$//' {} +

cd "$DST"
anchor build "$@"
