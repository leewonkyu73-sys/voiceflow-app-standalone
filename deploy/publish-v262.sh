#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace
say(){ printf '\n[%s] %s\n' "$1" "$2"; }
fail(){ echo "PUBLISH FAIL: $1"; exit 1; }

say "PUBLISH 1/6" "Sync latest main"
git fetch origin main
git reset --hard origin/main

[ -f .env ] || printf '%s\n' 'NODE_ENV=production' 'MEETING_PUBLIC_BASE_URL=https://voice.star45.net' > .env
if ! grep -q '^INTEGRATION_SECRET_KEY=' .env || [ -z "$(grep '^INTEGRATION_SECRET_KEY=' .env | tail -1 | cut -d= -f2-)" ]; then
  printf '\nINTEGRATION_SECRET_KEY=%s\n' "$(openssl rand -hex 32)" >> .env
fi

say "PUBLISH 2/6" "Build/reuse exact validated image"
IMAGE_OK=0
if docker image inspect voiceflow-smart-workspace:v2.6 >/dev/null 2>&1; then
  if docker run --rm --entrypoint node voiceflow-smart-workspace:v2.6 -e "const fs=require('fs');const s=fs.readFileSync('/app/public/app.js','utf8');if(!s.includes('2.6.2-r3'))process.exit(1);if(!s.includes('optimistic-v1'))process.exit(2);if(!s.includes('STAR45 AI MEETING WORKSPACE'))process.exit(3)" >/dev/null 2>&1; then
    IMAGE_OK=1
  fi
fi
if [ "$IMAGE_OK" -eq 1 ]; then
  echo "Validated image already contains optimistic room entry. No rebuild."
else
  echo "Building validated image with optimistic room entry once."
  sh deploy/build-validated-image-v262.sh
fi

say "PUBLISH 3/6" "Start one production runtime and public route"
sh deploy/runtime-reconcile-v262.sh
sh deploy/proxy-reconcile-v262.sh

say "PUBLISH 4/6" "Run one production verification + Chromium E2E"
sh deploy/resume-from-65-v262.sh

say "PUBLISH 5/6" "Verify public endpoints and exact frontend artifact"
TS=$(date +%s)
VERSION=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/version.json?cb=$TS" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s);process.stdout.write(String(d.version||''))})")
[ "$VERSION" = "2.6.2" ] || fail "public version is $VERSION, expected 2.6.2"
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/api/health?cb=$TS" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s);if(d.ok!==true)process.exit(1)})" || fail 'public gateway health failed'
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-integrations.html?cb=$TS" | grep -q 'API & Integration Center' || fail 'admin integration center not published'
APP=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/app.js?cb=$TS")
printf '%s' "$APP" | grep -q "2.6.2-r3" || fail 'frontend runtime guard r3 not published'
printf '%s' "$APP" | grep -q 'optimistic-v1' || fail 'optimistic room-entry artifact not published'
printf '%s' "$APP" | grep -q 'STAR45 AI MEETING WORKSPACE' || fail 'meeting-first frontend not published'

say "PUBLISH 6/6" "Publication complete"
echo "PUBLIC URL              https://voice.star45.net"
echo "VERSION                 2.6.2"
echo "MEETING APP             PUBLISHED"
echo "ADMIN INTEGRATIONS      PUBLISHED"
echo "INTEGRATION HUB BRIDGE  PUBLISHED"
if [ -f /opt/star45/voiceflow-data/google-drive-oauth.json ]; then
  echo "GOOGLE DRIVE            CONNECTED (optional connector)"
else
  echo "GOOGLE DRIVE            NOT CONFIGURED (connect later in Admin)"
fi
echo "OVERALL                 100% PUBLISHED"
