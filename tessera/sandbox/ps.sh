#!/bin/bash
# Помощник из C:\out в открытом Sandbox, с выводом: ps.sh <id> shot.ps1 -Name main
# Кавычки по пути bash -> wsb -> cmd -> PowerShell теряются; кириллицу передавать через click.cmd.
set -euo pipefail
id=$1 script=$2
shift 2
cd /mnt/c
out=$(wslpath "$(cmd.exe /c 'echo %USERPROFILE%' | tr -d '\r')")/tessera-sandbox/out
rm -f "$out/ps.txt"
wsb.exe exec --id "$id" -r ExistingLogin \
  -c "cmd /c powershell -NoProfile -ExecutionPolicy Bypass -File C:\\out\\$script $* > C:\\out\\ps.txt 2>&1" > /dev/null
[ ! -f "$out/ps.txt" ] || cat "$out/ps.txt"
