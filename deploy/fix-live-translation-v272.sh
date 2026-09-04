#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace
say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }

say 15 "Sync latest main"
git config --global --add safe.directory /opt/star45/voiceflow-smart-workspace >/dev/null 2>&1 || true
git fetch origin main
git reset --hard origin/main

say 35 "Build patched core image"
docker compose --env-file .env -f deploy/docker-compose.v23.yml build voiceflow-core

say 65 "Restart core only"
docker compose --env-file .env -f deploy/docker-compose.v23.yml up -d --no-deps --force-recreate voiceflow-core
sleep 4

say 80 "Health check"
curl -fsSL http://127.0.0.1:4180/api/health >/dev/null || fail 'local core health failed'

say 90 "Synthetic Korean -> Vietnamese translation check"
MID=$(curl -fsSL -X POST http://127.0.0.1:4180/api/v1/meetings -H 'content-type: application/json' --data '{"type":"internal","title":"translation-check","peer_id":"qa_ko","name":"QA","language":"ko-KR"}' | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s);process.stdout.write(d.data.id)})")
RES=$(curl -fsSL -X POST "http://127.0.0.1:4180/api/v1/meetings/$MID/captions" -H 'content-type: application/json' --data '{"peer_id":"qa_ko","speaker":"QA","language":"ko-KR","detected_language":"ko-KR","text":"밥 먹었니","final":true}')
printf '%s' "$RES" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s);const t=d.data?.translations?.['vi-VN'];if(!t||t==='밥 먹었니')process.exit(1);console.log('TRANSLATION:',t);console.log('PROVIDER:',d.data?.assurance?.['vi-VN']?.translation_provider||'unknown')})" || fail 'translation did not produce Vietnamese text'

say 95 "Public core check"
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/api/health?ts=$(date +%s)" >/dev/null || fail 'public core health failed'

say 100 "Live translation rollout verified"
echo 'CORE BUILD        PASS'
echo 'CORE RESTART      PASS'
echo 'KO->VI TRANSLATE  PASS'
echo 'PUBLIC HEALTH     PASS'
