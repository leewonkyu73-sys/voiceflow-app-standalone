#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace

say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }

say 10 "Sync latest main"
git fetch origin main
git reset --hard origin/main

say 25 "Validate new Integration Center UI and scripts"
node --check public/admin-integrations.js
node --check public/admin-integrations-ux.js
node --check public/ai-meeting-lab.js
node --check scripts/patch-live-chat-v269.mjs
node --check scripts/patch-result-review-v268.mjs
grep -q 'AI · API 연결 설정' public/admin-integrations.html || fail 'new integration center title missing'
grep -q '회의 통번역 준비' public/admin-integrations.html || fail 'readiness UI missing'
grep -q 'admin-integrations-ux.js' public/admin-integrations.html || fail 'integration UX script missing'
grep -q 'AI 직원 대화 테스트' public/admin-integrations.html || fail 'AI self-test entry missing'

say 40 "Prepare exact frontend artifact"
cp public/app.js /tmp/voiceflow-app-before-v270.js
node scripts/patch-admin-drive-v262.mjs
node --check public/app.js
grep -q 'LIVE TRANSLATION CHAT' public/app.js || fail 'live translation chat patch missing'
grep -q 'interimResults=true' public/app.js || fail 'interim STT patch missing'

say 55 "Build production image (cache enabled)"
DOCKER_BUILDKIT=1 docker build -f deploy/Dockerfile.v2 -t voiceflow-smart-workspace:v2.7 .
mv /tmp/voiceflow-app-before-v270.js public/app.js

say 70 "Restart production stack through existing runtime reconciler"
sh deploy/runtime-reconcile-v262.sh

say 85 "Verify public UI and health"
TS=$(date +%s)
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/api/health?ts=$TS" | grep -q '"ok":true' || fail 'public health failed'
ADMIN=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/admin-integrations.html?ts=$TS")
printf '%s' "$ADMIN" | grep -q 'AI · API 연결 설정' || fail 'new Integration Center UI not public'
printf '%s' "$ADMIN" | grep -q '회의 통번역 준비' || fail 'readiness UI not public'
UX=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-integrations-ux.js?v=2.7.0&ts=$TS")
printf '%s' "$UX" | grep -q 'NEXT ACTION' || fail 'guided next action UX not public'

say 100 "UI rollout verified"
echo 'ADMIN UI            PASS'
echo 'READINESS UI        PASS'
echo 'GUIDED SETUP        PASS'
echo 'LIVE CHAT PATCH     PASS'
echo 'PUBLIC HEALTH       PASS'
echo 'OVERALL             PASS'
