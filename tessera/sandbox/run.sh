#!/bin/bash
# Кладёт установщик и снимок в %USERPROFILE%\tessera-sandbox, открывает Windows Sandbox и печатает его id.
# Использование: run.sh [установщик.exe]; по умолчанию — свежий из release/.
#
# Внутри: wsb.exe exec --id <id> -r ExistingLogin -c 'C:\in\<установщик>.exe /S'
#   ExistingLogin работает, только пока окно открыто; иначе -r System.
#   Файлы, положенные в in после запуска, внутри не видны — новые скрипты класть в out.
#   Помощники из tools/ кладутся в out, запускать через ps.sh.
# «Windows Sandbox failed to initialize» после неудачного запуска: завис WindowsSandboxServer, его убить.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
installer=$(realpath "${1:-$(ls -t "$here"/../../release/*-x64.exe | head -1)}")
cd /mnt/c
root=$(wslpath "$(cmd.exe /c 'echo %USERPROFILE%' | tr -d '\r')")/tessera-sandbox
mkdir -p "$root/in" "$root/out"
cp "$installer" "$here/snapshot.ps1" "$here/snapshot.cmd" "$root/in/"
cp "$here"/tools/* "$root/out/"
root_win=$(wslpath -w "$root" | sed 's/[\\&|]/\\&/g')
config=$(sed "s|@ROOT@|$root_win|g" "$here/slate-test.wsb" | tr -d '\n')
id=$(wsb.exe start --config "$config" | tr -d '\r' | sed -n 's/^Id: //p')
[ -n "$id" ]
wsb.exe connect --id "$id" > /dev/null 2>&1 &
echo "$id"
