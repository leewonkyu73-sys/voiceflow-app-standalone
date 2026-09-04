#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace

echo "[1/9] Pull latest code"
git pull --ff-only

echo "[2/9] Prepare persistent folders"
mkdir -p /opt/star45/voiceflow-data /opt/star45/obsidian-vault /opt/star45/hermes-bridge
for d in Meetings Tasks Projects SOP Research AI-Employees Company-Knowledge; do mkdir -p "/opt/star45/obsidian-vault/$d"; done

if [ ! -f .env ]; then
  cp deploy/.env.v24.example .env
  echo ""
  echo "STOP: .env was created. Add GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_TOKEN_SECRET, then rerun."
  exit 2
fi

missing=0
for key in GOOGLE_DRIVE_CLIENT_ID GOOGLE_DRIVE_CLIENT_SECRET GOOGLE_DRIVE_TOKEN_SECRET; do
  val=$(grep -E "^${key}=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true)
  if [ -z "$val" ]; then echo "MISSING: $key"; missing=1; fi
done
if [ "$missing" -ne 0 ]; then
  echo "STOP: Google OAuth client settings are required. Refresh token is obtained later from the in-app Drive connection wizard."
  exit 2
fi

echo "[3/9] Validate JavaScript syntax"
node --check server-v2.mjs
node --check services/board-service.mjs
node --check services/task-calendar-service.mjs
node --check services/ai-employee-service.mjs
node --check services/hermes-obsidian-discord-service.mjs
node --check services/meeting-result-drive-service.mjs
node --check services/automation-worker.mjs
node --check scripts/patch-app-v25.mjs
node --check scripts/patch-app-v26.mjs
node --check public/drive-connect.js
node --check deploy/gateway.mjs

echo "[4/9] Run existing tests"
npm test

echo "[5/9] Force fresh v2.6.1 image build"
docker build --no-cache --pull -f deploy/Dockerfile.v2 -t voiceflow-smart-workspace:v2.6 .

echo "[6/9] Recreate every service from fresh image"
docker compose --env-file .env -f deploy/docker-compose.v23.yml up -d --force-recreate --remove-orphans

sleep 8

echo "[7/9] Verify runtime version and patched UI fingerprints"
curl -fsS http://127.0.0.1:4173/version.json | grep -q '2.6.1'
curl -fsS 'http://127.0.0.1:4173/app.js?v=2.6.1' | grep -q 'STAR45 AI MEETING WORKSPACE'
curl -fsS 'http://127.0.0.1:4173/app.js?v=2.6.1' | grep -q 'approveResult'

echo "[8/9] Run full QA"
sh deploy/qa-v23.sh

echo "[9/9] Show stack"
docker compose --env-file .env -f deploy/docker-compose.v23.yml ps

echo "STAR45 AI MEETING WORKSPACE V2.6.1 SERVER READY"
echo "Version: https://voice.star45.net/version.json"
echo "Preview: https://voice.star45.net/meeting-preview.html"
echo "Drive:   https://voice.star45.net/drive-connect.html"
