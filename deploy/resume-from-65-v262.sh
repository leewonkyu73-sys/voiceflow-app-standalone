#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace
say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }
command -v docker >/dev/null 2>&1 || fail 'docker not found'
command -v node >/dev/null 2>&1 || fail 'node not found'
[ -f .env ] || fail '.env missing'
say 65 "Verify runtime and public route"
curl -fsSL http://127.0.0.1:4173/api/health | grep -q '"ok":true' || fail 'local gateway health'
curl -fsSL -H 'Cache-Control: no-cache' https://voice.star45.net/api/health | grep -q '"ok":true' || fail 'public gateway health'
curl -fsSL http://127.0.0.1:4181/health | grep -q 'admin-integration-center' || fail 'admin integration service'
curl -fsSL http://127.0.0.1:4182/health | grep -q 'integration-hub-bridge' || fail 'hub bridge'
curl -fsSL http://127.0.0.1:4183/health | grep -q 'device-nearby-tapjoin' || fail 'tapjoin service'
curl -fsSL http://127.0.0.1:4184/health | grep -q 'original-media-storage' || fail 'original media storage'
sh deploy/qa-v23.sh
say 76 "Verify current admin, mobile artifact and persistent media route"
TS=$(date +%s)
ADMIN=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-integrations.html?cb=$TS")
printf '%s' "$ADMIN" | grep -q 'API & Integration Center' || fail 'admin center missing'
printf '%s' "$ADMIN" | grep -q 'Integration Hub' || fail 'hub panel missing'
printf '%s' "$ADMIN" | grep -q 'Hub 바로 열기' || fail 'hub open button missing'
APP=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/app.js?cb=$TS")
printf '%s' "$APP" | grep -q 'stable-v266' || fail 'mobile stable artifact missing'
printf '%s' "$APP" | grep -q 'drive-v267' || fail 'original media upload artifact missing'
printf '%s' "$APP" | grep -q 'uploadOriginalMediaV267' || fail 'original media upload function missing'
TEST_MID="e2e_media_${TS}"
printf 'voiceflow-original-media-test' | curl -fsS -X POST -H 'Content-Type: audio/webm' -H 'X-File-Name: e2e-original-audio.webm' --data-binary @- "http://127.0.0.1:4173/api/v1/meeting-media/${TEST_MID}?kind=audio" | grep -q '"ok":true' || fail 'original media upload endpoint failed'
curl -fsS "http://127.0.0.1:4173/api/v1/meeting-media/${TEST_MID}/status" | grep -q 'e2e-original-audio.webm' || fail 'original media index missing'
say 87 "Run real-click mobile Chromium media E2E"
docker pull mcr.microsoft.com/playwright:v1.55.0-noble >/dev/null
docker run --rm --network host -e E2E_BASE_URL=https://voice.star45.net -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.55.0-noble bash -lc "npm install --no-save playwright@1.55.0 >/dev/null 2>&1 && node tests/e2e-mobile-media.mjs"
say 96 "Operational verification complete"
echo "MEETING CORE             PASS"
echo "SERVICES                 PASS"
echo "MOBILE REAL-CLICK MEDIA  PASS"
echo "ORIGINAL MEDIA STORAGE   PASS"
echo "ADMIN / HUB UI           PASS"
DRIVE_STATUS='NOT CONFIGURED - VPS SAFE FALLBACK ACTIVE'
if [ -f /opt/star45/voiceflow-data/google-drive-oauth.json ]; then DRIVE_STATUS='CONNECTED - ORIGINAL MEDIA UPLOADS TO DRIVE'; fi
say 100 "STAR45 AI Meeting production verification complete"
echo "VERSION                  PASS 2.6.2"
echo "DIRECT START             PASS"
echo "MOBILE MEDIA             PASS stable-v266"
echo "ORIGINAL MEDIA           PASS drive-v267"
echo "TAPJOIN / NFC            PASS"
echo "ADMIN INTEGRATIONS       PASS"
echo "INTEGRATION HUB          PASS"
echo "GOOGLE DRIVE             $DRIVE_STATUS"
echo "OVERALL                  100% PASS"
