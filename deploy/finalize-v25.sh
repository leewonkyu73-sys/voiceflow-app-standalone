#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace

echo "[1/7] Pull latest code"
git pull --ff-only

echo "[2/7] Prepare persistent folders"
mkdir -p /opt/star45/voiceflow-data /opt/star45/obsidian-vault /opt/star45/hermes-bridge
for d in Meetings Tasks Projects SOP Research AI-Employees Company-Knowledge; do mkdir -p "/opt/star45/obsidian-vault/$d"; done

if [ ! -f .env ]; then
  cp deploy/.env.v24.example .env
  echo ""
  echo "STOP: .env was created. Add DISCORD_BOT_TOKEN and optional AI provider keys, then rerun this script."
  exit 2
fi

BOT_TOKEN=$(grep -E '^DISCORD_BOT_TOKEN=' .env 2>/dev/null | tail -1 | cut -d= -f2- || true)
if [ -z "$BOT_TOKEN" ]; then
  echo "STOP: DISCORD_BOT_TOKEN is empty in .env"
  exit 2
fi

echo "[3/7] Validate JavaScript syntax"
node --check server-v2.mjs
node --check services/board-service.mjs
node --check services/task-calendar-service.mjs
node --check services/ai-employee-service.mjs
node --check services/hermes-obsidian-discord-service.mjs
node --check services/automation-worker.mjs
node --check deploy/gateway.mjs

echo "[4/7] Run existing tests"
npm test

echo "[5/7] Build and start v2.5 stack"
docker compose --env-file .env -f deploy/docker-compose.v23.yml up -d --build --remove-orphans

sleep 5

echo "[6/7] Run full QA"
sh deploy/qa-v23.sh

echo "[7/7] Show stack"
docker compose --env-file .env -f deploy/docker-compose.v23.yml ps

echo "VOICEFLOW V2.5 DEPLOYMENT READY"
echo "Open: https://voice.star45.net/integration-center-v6.html"
