#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace

say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }

say 5 "Sync latest source"
git fetch origin main
git reset --hard origin/main

say 15 "Validate environment"
[ -f .env ] || { cp deploy/.env.v24.example .env; fail '.env created; set GOOGLE_DRIVE_CLIENT_ID / CLIENT_SECRET / TOKEN_SECRET and rerun'; }
for key in GOOGLE_DRIVE_CLIENT_ID GOOGLE_DRIVE_CLIENT_SECRET GOOGLE_DRIVE_TOKEN_SECRET; do
  val=$(grep -E "^${key}=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true)
  [ -n "$val" ] || fail "$key missing"
done

say 25 "Static syntax and UI binding checks"
node --check server-v2.mjs
node --check services/meeting-result-drive-service.mjs
node --check services/automation-worker.mjs
node --check deploy/gateway.mjs
node --check tests/e2e-meeting.mjs
node --check scripts/verify-drive-live-v261.mjs
node scripts/patch-app-v26.mjs
node scripts/verify-ui-bindings-v261.mjs
npm test

say 40 "Build fresh production image without cache"
docker build --no-cache --pull -f deploy/Dockerfile.v2 -t voiceflow-smart-workspace:v2.6 .

say 55 "Force recreate production stack"
docker compose --env-file .env -f deploy/docker-compose.v23.yml up -d --force-recreate --remove-orphans
sleep 8

say 65 "Verify runtime version and service health"
curl -fsSL https://voice.star45.net/version.json | grep -q '"version":"2.6.1"' || fail 'live version is not 2.6.1'
curl -fsSL https://voice.star45.net/api/health | grep -q '"ok":true' || fail 'gateway health failed'

say 75 "Run full service/UI fingerprint QA"
sh deploy/qa-v23.sh

say 88 "Run real Chromium menu/button E2E"
sh deploy/run-live-e2e-v261.sh

say 95 "Verify Google Drive OAuth connection"
[ -f /opt/star45/voiceflow-data/google-drive-oauth.json ] || {
  echo "BLOCKED_AT_95_PERCENT"
  echo "Open https://voice.star45.net/drive-connect.html as admin"
  echo "Click Google Drive 연결 -> choose account -> approve -> 테스트 파일 저장"
  echo "Then rerun: sh deploy/complete-to-100-v261.sh"
  exit 3
}

say 98 "Verify real Google Drive write/read/delete"
set -a
. ./.env
set +a
MEETING_RESULT_DATA_DIR=/opt/star45/voiceflow-data node scripts/verify-drive-live-v261.mjs | tee /opt/star45/voiceflow-data/drive-live-verification.json
grep -q '"ok":true' /opt/star45/voiceflow-data/drive-live-verification.json || fail 'Drive real storage verification failed'

say 100 "STAR45 AI Meeting production verification complete"
echo "VERSION       PASS 2.6.1"
echo "SERVICES      PASS"
echo "UI BINDINGS   PASS"
echo "BROWSER E2E   PASS"
echo "GOOGLE DRIVE  PASS"
echo "PERSISTENCE   PASS"
echo "OVERALL       100% PASS"
