#!/usr/bin/env bash
# Gera o APK do Revela (nome "Revela"; identificador app.revela.teste, o mesmo das versões de teste, para instalar por cima).
# Requisitos: Node 20+, Java 21. Baixa o SDK do Android na primeira vez (~1 GB).
# Uso: android/gerar_apk.sh [pasta-de-trabalho]   -> <pasta>/Revela-teste.apk
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
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
cp "$RAIZ/android/capacitor.config.json" .
# o app: os arquivos da raiz que ele usa (sem o service worker, o app clássico, a pesquisa e os testes)
rm -rf www && mkdir www
cp "$RAIZ"/index.html "$RAIZ"/app.js "$RAIZ"/render.js "$RAIZ"/core.js "$RAIZ"/icons.js "$RAIZ"/manifest.webmanifest "$RAIZ"/icone.svg "$RAIZ"/icone-*.png www/
cp -r "$RAIZ/filmes" www/filmes && cp -r "$RAIZ/vendor" www/vendor
# só os filmes do índice (as tabelas antigas ficam no repositório, mas não vão no APK)
python3 - www/filmes <<'PY'
import json, os, sys
d = sys.argv[1]; ids = json.load(open(os.path.join(d, 'indice.json')))
for f in os.listdir(d):
    if f != 'indice.json' and f.split('.')[0] not in ids: os.remove(os.path.join(d, f))
PY
[ -d android ] || npx cap add android
# o nome que aparece no celular vem da configuração (a pasta android pode ter sido criada com um nome antigo)
NOME=$(python3 -c "import json;print(json.load(open('capacitor.config.json'))['appName'])")
sed -i "s#<string name=\"app_name\">[^<]*</string>#<string name=\"app_name\">$NOME</string>#; s#<string name=\"title_activity_main\">[^<]*</string>#<string name=\"title_activity_main\">$NOME</string>#" android/app/src/main/res/values/strings.xml
M=android/app/src/main/AndroidManifest.xml
grep -q WRITE_EXTERNAL "$M" || sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />#' "$M"
python3 - "$RAIZ/icone-desenho-512.png" "$RAIZ/icone-512.png" <<'PY'
import sys, glob
from PIL import Image
desenho = Image.open(sys.argv[1]).convert('RGBA'); cheio = Image.open(sys.argv[2]).convert('RGBA')
for f in glob.glob('android/app/src/main/res/mipmap-*/*.png'):
    w, h = Image.open(f).size
    if 'foreground' in f:   # ícone adaptativo: o desenho ocupa ~57 % (dentro da zona segura do círculo), o fundo vem da cor
        c = Image.new('RGBA', (w, h), (0, 0, 0, 0)); k = int(w * 0.86); c.paste(desenho.resize((k, k), Image.LANCZOS), ((w - k) // 2, (h - k) // 2)); c.save(f)
    else:
        cheio.resize((w, h), Image.LANCZOS).save(f)
PY
sed -i 's/#FFFFFF/#141210/; s/#28252A/#141210/' android/app/src/main/res/values/ic_launcher_background.xml
npx cap sync android
cd android && echo "sdk.dir=$ANDROID_HOME" > local.properties && ./gradlew assembleDebug -q --no-daemon
cp app/build/outputs/apk/debug/app-debug.apk "$W/Revela-teste.apk" && echo "APK: $W/Revela-teste.apk"
