#!/bin/bash
# Установщик Windows x64 в Docker. Запускать из WSL.
# Кэши, клон ядра и сертификат разработки — в $TESSERA_BUILD_DIR, не в /tmp: в WSL он в памяти и пропадает при перезагрузке.
# Релиз подписывается сертификатом из $SLATE_PFX с паролем в $SLATE_PFX_PASSWORD; в образ и в git они не попадают.
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
work=${TESSERA_BUILD_DIR:-$HOME/.cache/tessera-desktop-build}
core_origin=$repo/../sing-box
[ -d "$core_origin/.git" ] || core_origin=https://github.com/SagerNet/sing-box.git
core_tag=v$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$repo/version.json")

mkdir -p "$work"
[ -d "$work/sing-box/.git" ] || git clone --quiet "$core_origin" "$work/sing-box"
git -C "$work/sing-box" fetch --quiet --tags "$core_origin"
git -C "$work/sing-box" -c advice.detachedHead=false checkout --quiet --force "$core_tag"
git -C "$work/sing-box" clean -fdq
git -C "$work/sing-box" apply "$repo"/tessera/patches/sing-box/*.patch

signing=()
if [ -n "${SLATE_PFX:-}" ]; then
  : "${SLATE_PFX_PASSWORD:?SLATE_PFX_PASSWORD is not set}"
  signing=(-v "$(realpath "$SLATE_PFX"):/run/slate.pfx:ro" -e SLATE_PFX_PASSWORD)
fi

docker build -t tessera-desktop-build "$repo/tessera/build"
docker run --rm --user "$(id -u):$(id -g)" "${signing[@]}" \
  -v "$work:/work" -v "$repo:/work/sing-box-for-desktop" \
  tessera-desktop-build /work/sing-box-for-desktop/tessera/build/package.sh
