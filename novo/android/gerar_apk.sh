#!/usr/bin/env bash
# Gera o APK de TESTE do Revela novo (app separado: "Revela (teste)", app.revela.teste; não substitui o Revela instalado).
# Requisitos: Node 20+, Java 21. Baixa o SDK do Android na primeira vez (~1 GB).
# Uso: novo/android/gerar_apk.sh [pasta-de-trabalho]   -> <pasta>/Revela-teste.apk
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
W="${1:-$RAIZ/../revela-apk}"; mkdir -p "$W"; cd "$W"
export ANDROID_HOME="$W/sdk"
if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  Z=$(curl -s https://dl.google.com/android/repository/repository2-3.xml | grep -o 'commandlinetools-linux-[0-9]*_latest.zip' | sort -t- -k3 -n | tail -1)
  curl -sSL -o clt.zip "https://dl.google.com/android/repository/$Z"
  mkdir -p "$ANDROID_HOME/cmdline-tools" && unzip -q clt.zip -d "$ANDROID_HOME/cmdline-tools" && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
  yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null
  "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-35" "build-tools;35.0.0"
fi
mkdir -p proj && cd proj
[ -f package.json ] || echo '{ "name": "revela-teste", "private": true }' > package.json
npm i -s @capacitor/core@7 @capacitor/cli@7 @capacitor/android@7 @capacitor/filesystem@7 @capacitor/share@7
cp "$RAIZ/novo/android/capacitor.config.json" .
# o app: novo/ + os módulos que ele importa da raiz
rm -rf www && mkdir www && cp -r "$RAIZ/novo" www/novo && rm -rf www/novo/android
cp "$RAIZ/core.js" "$RAIZ/icons.js" www/ && cp -r "$RAIZ/vendor" www/vendor
echo '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=novo/index.html"><title>Revela</title>' > www/index.html
[ -d android ] || npx cap add android
M=android/app/src/main/AndroidManifest.xml
grep -q WRITE_EXTERNAL "$M" || sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />#' "$M"
python3 - "$RAIZ/icon-512.png" <<'PY'
import sys, glob
from PIL import Image
src = Image.open(sys.argv[1]).convert('RGBA')
for f in glob.glob('android/app/src/main/res/mipmap-*/*.png'):
    w, h = Image.open(f).size
    if 'foreground' in f:
        c = Image.new('RGBA', (w, h), (0, 0, 0, 0)); k = int(w * 0.66); c.paste(src.resize((k, k), Image.LANCZOS), ((w - k) // 2, (h - k) // 2)); c.save(f)
    else:
        src.resize((w, h), Image.LANCZOS).save(f)
PY
sed -i 's/#FFFFFF/#28252A/' android/app/src/main/res/values/ic_launcher_background.xml
npx cap sync android
cd android && echo "sdk.dir=$ANDROID_HOME" > local.properties && ./gradlew assembleDebug -q --no-daemon
cp app/build/outputs/apk/debug/app-debug.apk "$W/Revela-teste.apk" && echo "APK: $W/Revela-teste.apk"
