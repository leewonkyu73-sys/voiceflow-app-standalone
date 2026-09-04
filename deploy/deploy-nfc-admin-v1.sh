#!/bin/sh
set -eu
ROOT=/opt/star45/voiceflow-smart-workspace
RUNTIME=/opt/star45/voiceflow-runtime-public
BACKUP=$(mktemp -d /tmp/voiceflow-nfc-deploy-XXXXXX)
DEVICE=voiceflow-device-nearby-v26
GATEWAY=voiceflow-gateway-v26
FILES="admin-nfc.html admin-nfc.js admin-nfc.css tap.html tap.js tap-settings.html"
SUCCESS=0
rollback(){
  echo "[ROLLBACK] Restoring NFC module"
  for f in $FILES; do
    if [ -f "$BACKUP/$f" ]; then install -m 0644 "$BACKUP/$f" "$RUNTIME/$f"; else rm -f "$RUNTIME/$f"; fi
  done
  [ ! -f "$BACKUP/device.mjs" ] || docker cp "$BACKUP/device.mjs" "$DEVICE:/app/services/device-nearby-tapjoin-service.mjs"
  [ ! -f "$BACKUP/gateway.mjs" ] || docker cp "$BACKUP/gateway.mjs" "$GATEWAY:/app/deploy/gateway.mjs"
  docker restart "$DEVICE" "$GATEWAY" >/dev/null 2>&1 || true
}
trap 'if [ "$SUCCESS" -eq 0 ]; then rollback; fi' EXIT INT TERM HUP
cd "$ROOT"
git fetch origin main
git reset --hard origin/main
node --check services/device-nearby-tapjoin-service.mjs
node --check deploy/gateway.mjs
node --check public/admin-nfc.js
node --check public/tap.js
mkdir -p "$RUNTIME"
for f in $FILES; do [ ! -f "$RUNTIME/$f" ] || cp "$RUNTIME/$f" "$BACKUP/$f"; done
docker cp "$DEVICE:/app/services/device-nearby-tapjoin-service.mjs" "$BACKUP/device.mjs"
docker cp "$GATEWAY:/app/deploy/gateway.mjs" "$BACKUP/gateway.mjs"
for f in $FILES; do install -m 0644 "public/$f" "$RUNTIME/$f"; done
docker cp services/device-nearby-tapjoin-service.mjs "$DEVICE:/app/services/device-nearby-tapjoin-service.mjs"
docker cp deploy/gateway.mjs "$GATEWAY:/app/deploy/gateway.mjs"
docker restart "$DEVICE" "$GATEWAY" >/dev/null
sleep 5
curl -fsSL http://127.0.0.1:4183/health | grep -q 'device-nearby-tapjoin'
curl -sSL http://127.0.0.1:4173/api/health | grep -q 'voiceflow-gateway'
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-nfc.js?ts=$(date +%s)" | grep -q '/api/v1/admin/nfc'
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-nfc.css?ts=$(date +%s)" | grep -q '.tag-row'
CODE=$(curl -sS -o "$BACKUP/auth.json" -w '%{http_code}' https://voice.star45.net/api/v1/admin/nfc)
test "$CODE" = 403
grep -q 'admin_required' "$BACKUP/auth.json"
SUCCESS=1
trap - EXIT INT TERM HUP
echo "NFC_ADMIN_DEPLOY PASS"
echo "ROLLBACK_BACKUP $BACKUP"
