#!/bin/bash
# Внутри образа: установщик x64 с подписью разработки и проверка подписей.
set -euo pipefail
mkdir -p "$HOME"
cd /work/sing-box-for-desktop

# Один сертификат на все сборки: демон сверяет подпись установщика обновления со своей.
trap 'rm -f signing.local.json' EXIT
if [ -f /run/slate.pfx ]; then
  pfx=/run/slate.pfx
  pem=$(mktemp)
  openssl pkcs12 -in "$pfx" -passin env:SLATE_PFX_PASSWORD -nokeys -clcerts -out "$pem"
else
  cert=/work/.cert
  if [ ! -f "$cert/dev.pfx" ] || ! openssl x509 -checkend 604800 -noout -in "$cert/dev.pem" 2> /dev/null; then
    mkdir -p "$cert"
    openssl req -x509 -newkey rsa:3072 -sha256 -days 365 -nodes -keyout "$cert/dev.key" -out "$cert/dev.pem" \
      -subj "/CN=Tessera Development" -addext "extendedKeyUsage=codeSigning" 2> /dev/null
    openssl pkcs12 -export -out "$cert/dev.pfx" -inkey "$cert/dev.key" -in "$cert/dev.pem" -passout pass:dev \
      -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256
  fi
  pfx=$cert/dev.pfx
  pem=$cert/dev.pem
  export SLATE_PFX_PASSWORD=dev
fi
node -e 'console.log(JSON.stringify({windows: {certificateFile: process.argv[1], certificatePassword: process.env.SLATE_PFX_PASSWORD}}))' \
  "$pfx" > signing.local.json

rm -rf release
pnpm install --frozen-lockfile
pnpm package:win x64

# pnpm package:win возвращает 0 и без установщика (упала подпись, нет Wine), поэтому проверяем сами файлы.
installer=$(ls release/*-x64.exe)
osslsigncode=$(ls -d /work/.electron-builder/winCodeSign-*/*/linux/osslsigncode | head -1)
for file in "$installer" release/win-unpacked/*.exe release/win-unpacked/resources/daemon/*.exe; do
  "$osslsigncode" verify -CAfile "$pem" -in "$file" > /dev/null
done
echo "Signed: $installer"
