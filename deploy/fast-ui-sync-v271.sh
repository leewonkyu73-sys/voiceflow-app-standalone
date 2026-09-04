#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace
RUNTIME_PUBLIC=/opt/star45/voiceflow-runtime-public
TMP_APP=/tmp/voiceflow-app-source-fast-v271.js
say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }

say 15 "Sync source"
git config --global --add safe.directory /opt/star45/voiceflow-smart-workspace >/dev/null 2>&1 || true
git fetch origin main
git reset --hard origin/main

say 35 "Validate UI"
node --check public/admin-integrations.js
node --check public/admin-integrations-ux.js
node --check public/ai-meeting-lab.js

say 55 "Generate production frontend"
cp public/app.js "$TMP_APP"
trap 'cp "$TMP_APP" public/app.js 2>/dev/null || true' EXIT INT TERM
node scripts/patch-admin-drive-v262.mjs
node --check public/app.js

say 75 "Publish UI in-place (preserve Docker bind mount)"
STAGE="${RUNTIME_PUBLIC}.next"
rm -rf "$STAGE"
mkdir -p "$STAGE" "$RUNTIME_PUBLIC"
cp -a public/. "$STAGE"/
find "$RUNTIME_PUBLIC" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$STAGE"/. "$RUNTIME_PUBLIC"/
rm -rf "$STAGE"
cp "$TMP_APP" public/app.js
trap - EXIT INT TERM

say 85 "Verify local UI; self-heal stale mount once if needed"
TS=$(date +%s)
if ! curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4180/admin-integrations.html?ts=$TS" | grep -q 'AI · API 연결 설정'; then
  echo 'Local UI mount is stale; recreating voiceflow-core once...'
  docker compose --env-file .env -f deploy/docker-compose.v23.yml up -d --no-deps --force-recreate voiceflow-core
  sleep 3
  curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4180/admin-integrations.html?ts=$TS" | grep -q 'AI · API 연결 설정' || fail 'local UI verification failed after mount recovery'
fi
curl -fsSL http://127.0.0.1:4180/api/health >/dev/null || fail 'local core health failed'
curl -fsSL http://127.0.0.1:4181/health >/dev/null || fail 'admin integration service health failed'

say 92 "Verify public UI and inspect aggregate health"
ADMIN=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/admin-integrations.html?ts=$TS")
printf '%s' "$ADMIN" | grep -q 'AI · API 연결 설정' || fail 'public UI verification failed'
HEALTH=$(curl -sSL -H 'Cache-Control: no-cache' "https://voice.star45.net/api/health?ts=$TS" || true)
printf '%s' "$HEALTH" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{const d=JSON.parse(s);const core=d.services?.core?.ok;const admin=d.services?.adminIntegrations?.ok;if(!core||!admin)process.exit(1);const bad=Object.entries(d.services||{}).filter(([,v])=>!v?.ok).map(([k])=>k);if(bad.length)console.log('WARNING: aggregate gateway health is degraded:',bad.join(','));else console.log('Aggregate gateway health PASS') }catch{process.exit(2)}})" || fail 'public core/admin integration health failed'

say 100 "Fast UI rollout verified"
echo 'UI SYNC          PASS'
echo 'DOCKER BUILD     SKIPPED'
echo 'CORE UI          PASS'
echo 'ADMIN SERVICE    PASS'
echo 'NOTE             Aggregate /api/health may be 503 if unrelated optional services are degraded'
