#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace
RUNTIME_PUBLIC=/opt/star45/voiceflow-runtime-public
TMP_APP=/tmp/voiceflow-app-source-v271.js
say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }

say 10 "Sync latest source"
git config --global --add safe.directory /opt/star45/voiceflow-smart-workspace >/dev/null 2>&1 || true
git fetch origin main
git reset --hard origin/main

say 25 "Validate UI sources"
node --check public/admin-integrations.js
node --check public/admin-integrations-ux.js
node --check public/ai-meeting-lab.js
node --check scripts/patch-result-review-v268.mjs
node --check scripts/patch-live-chat-v269.mjs

say 40 "Generate production frontend without Docker build"
cp public/app.js "$TMP_APP"
trap 'cp "$TMP_APP" public/app.js 2>/dev/null || true' EXIT INT TERM
node scripts/patch-admin-drive-v262.mjs
node --check public/app.js
grep -q 'LIVE TRANSLATION CHAT' public/app.js || fail 'live chat artifact missing'

say 55 "Publish runtime public directory"
mkdir -p "$RUNTIME_PUBLIC"
rm -rf "$RUNTIME_PUBLIC"/*
cp -a public/. "$RUNTIME_PUBLIC"/
cp "$TMP_APP" public/app.js
trap - EXIT INT TERM

say 70 "Enable runtime bind mount on core only"
docker compose --env-file .env -f deploy/docker-compose.v23.yml up -d --no-deps --force-recreate voiceflow-core
sleep 3
curl -fsSL http://127.0.0.1:4180/api/health >/dev/null || fail 'core health failed after fast-ui mount'

say 85 "Verify public UI"
TS=$(date +%s)
ADMIN=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/admin-integrations.html?ts=$TS")
printf '%s' "$ADMIN" | grep -q 'AI · API 연결 설정' || fail 'new Integration Center UI not public'
printf '%s' "$ADMIN" | grep -q '회의 통번역 준비' || fail 'readiness UI not public'

say 100 "Fast UI mode enabled"
echo 'FAST UI MODE        PASS'
echo 'DOCKER REBUILD      NOT REQUIRED FOR UI-ONLY CHANGES'
echo 'TYPICAL UI ROLLOUT  10-30 SECONDS'
