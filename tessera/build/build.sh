#!/bin/bash
# Установщик Windows x64 в Docker. Запускать из WSL.
# Кэши, клон ядра и сертификат разработки — в $TESSERA_BUILD_DIR, не в /tmp: в WSL он в памяти и пропадает при перезагрузке.
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
work=${TESSERA_BUILD_DIR:-$HOME/.cache/tessera-desktop-build}
core_origin=$repo/../sing-box
core_tag=v$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$repo/version.json")

mkdir -p "$work"
[ -d "$work/sing-box/.git" ] || git clone --quiet "$core_origin" "$work/sing-box"
git -C "$work/sing-box" fetch --quiet --tags "$core_origin"
git -C "$work/sing-box" -c advice.detachedHead=false checkout --quiet --force "$core_tag"
git -C "$work/sing-box" clean -fdq

docker build -t tessera-desktop-build "$repo/tessera/build"
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$work:/work" -v "$repo:/work/sing-box-for-desktop" \
  tessera-desktop-build /work/sing-box-for-desktop/tessera/build/package.sh
