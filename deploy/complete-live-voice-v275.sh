#!/usr/bin/env sh
set -eu

ROOT=/opt/star45/voiceflow-smart-workspace
cd "$ROOT"

say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }

say 5 "Sync approved main"
git config --global --add safe.directory "$ROOT" >/dev/null 2>&1 || true
git fetch origin main
git reset --hard origin/main

git rev-parse --short HEAD

say 12 "Build exact frontend artifact and validate single live composer"
TMP_APP=/tmp/voiceflow-v276-app-$$.js
cp public/app.js "$TMP_APP"
trap 'cp "$TMP_APP" public/app.js 2>/dev/null || true' EXIT INT TERM
node scripts/patch-admin-drive-v262.mjs
node --check public/app.js
node - <<'NODE'
const fs=require('fs');
const s=fs.readFileSync('public/app.js','utf8');
const composer=(s.match(/id="liveComposer"/g)||[]).length;
if(composer!==1) throw new Error(`chat_compose_source_count=${composer}`);
if(!s.includes("localStorage.targetLanguage||'en-US'")) throw new Error('target_language_state_missing');
if(!s.includes('data-translation-input')||!s.includes('data-translation-save')) throw new Error('translation_editor_ui_missing');
console.log('FRONTEND_SINGLE_COMPOSER PASS');
console.log('FRONTEND_TARGET_LANGUAGE PASS');
NODE
cp "$TMP_APP" public/app.js
trap - EXIT INT TERM
rm -f "$TMP_APP"

say 20 "Recreate meeting core with shared Integration Hub providers"
# Reuse the already-connected Provider environment from the running AI service.
# Values are never printed; central Integration secrets still override them when decryptable.
for PROVIDER_NAME in INTEGRATION_SECRET_KEY OPENAI_API_KEY OPENAI_TEXT_MODEL GEMINI_API_KEY GEMINI_TEXT_MODEL DEEPL_API_KEY DEEPL_API_URL; do
  PROVIDER_VALUE=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' voiceflow-ai-v26 2>/dev/null | sed -n "s/^$PROVIDER_NAME=//p" | head -n 1 || true)
  if [ -z "$PROVIDER_VALUE" ]; then
    PROVIDER_VALUE=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' voiceflow-admin-integrations-v26 2>/dev/null | sed -n "s/^$PROVIDER_NAME=//p" | head -n 1 || true)
  fi
  [ -z "$PROVIDER_VALUE" ] || export "$PROVIDER_NAME=$PROVIDER_VALUE"
done
docker compose -f deploy/docker-compose.v23.yml up -d --no-deps --force-recreate voiceflow-core
sleep 4
curl -fsSL http://127.0.0.1:4180/api/health >/dev/null || fail 'provider-enabled core restart failed'

say 24 "Prepare current translation core without legacy repatching"
node scripts/patch-live-translation-routing-v272.mjs
node --check server-v2.mjs
node --check lib/provider-adapters.mjs
grep -Eq "ROOM_CORE_VERSION='v345-caption-revision-sync'|captionsDirty" server-v2.mjs || fail 'translation core marker missing'

say 38 "Roll out core with automatic rollback and target-on-demand verification"
VERIFY_CMD='MID=$(curl -fsSL -X POST http://127.0.0.1:4180/api/v1/meetings -H "content-type: application/json" --data "{\"type\":\"internal\",\"title\":\"v276-e2e\",\"peer_id\":\"qa_ko\",\"name\":\"QA\",\"language\":\"ko-KR\"}" | node -e "let s=\"\";process.stdin.on(\"data\",c=>s+=c);process.stdin.on(\"end\",()=>process.stdout.write(JSON.parse(s).data.id))"); curl -fsSL -X POST "http://127.0.0.1:4180/api/v1/meetings/$MID/captions" -H "content-type: application/json" --data "{\"peer_id\":\"qa_ko\",\"speaker\":\"QA\",\"language\":\"ko-KR\",\"detected_language\":\"ko-KR\",\"text\":\"오늘 회의는 여섯 시에 시작합니다\",\"final\":true}" >/dev/null; RES=$(curl -fsSL "http://127.0.0.1:4180/api/v1/meetings/$MID/captions?target=en-US"); printf "%s" "$RES" | node -e "let s=\"\";process.stdin.on(\"data\",c=>s+=c);process.stdin.on(\"end\",()=>{const d=JSON.parse(s).data?.[0]||{};const t=d.translation;const target=d.display_target_language;if(target!==\"en-US\"||!t||t===\"오늘 회의는 여섯 시에 시작합니다\")process.exit(1);console.log(\"TARGET:\",target);console.log(\"EN_TRANSLATION:\",t);console.log(\"PROVIDER:\",d.validation?.translation_provider||\"unknown\")})"'
FAST_CORE_VERIFY_CMD="$VERIFY_CMD" \
FAST_CORE_PUBLIC_VERIFY_CMD="curl -fsSL -H 'Cache-Control: no-cache' 'https://voice.star45.net/api/health?ts=$(date +%s)' >/dev/null" \
  sh scripts/star45-fast-core-deploy.sh \
  voiceflow-core-v26 \
  http://127.0.0.1:4180/api/health \
  server-v2.mjs \
  lib/provider-adapters.mjs

say 52 "Roll out meeting decision auto-dispatch task service with rollback"
TASK_VERIFY_CMD='HEALTH=$(curl -fsSL http://127.0.0.1:4176/health); printf "%s" "$HEALTH" | node -e "let s=\"\\";process.stdin.on(\"data\",c=>s+=c);process.stdin.on(\"end\",()=>{const d=JSON.parse(s);if(d.version!==\"1.1.0\")process.exit(1)})"; CODE=$(curl -sS -o /tmp/voiceflow-task-auth-check.json -w "%{http_code}" -X POST http://127.0.0.1:4176/api/v1/tasks/interpret -H "content-type: application/json" --data "{\"text\":\"회의 일정\"}"); [ "$CODE" = "401" ]; grep -q "login_required" /tmp/voiceflow-task-auth-check.json; echo "TASK_INTERPRET_AUTH_CONTRACT PASS"'
FAST_CORE_VERIFY_CMD="$TASK_VERIFY_CMD" \
FAST_CORE_PUBLIC_VERIFY_CMD="curl -fsSL -H 'Cache-Control: no-cache' 'https://voice.star45.net/api/v1/tasks/health?ts=$(date +%s)' >/dev/null" \
  sh scripts/star45-fast-core-deploy.sh \
  voiceflow-tasks-v26 \
  http://127.0.0.1:4176/health \
  services/task-calendar-service.mjs

say 62 "Publish corrected UI atomically"
sh deploy/fast-ui-sync-v271.sh

say 78 "Verify public UI asset contains final guards"
TS=$(date +%s)
APP=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/app.js?ts=$TS")
printf '%s' "$APP" | grep -q "localStorage.targetLanguage||'en-US'" || fail 'public target-language fix missing'
printf '%s' "$APP" | grep -q 'id="liveComposer"' || fail 'public single-composer marker missing'
COUNT=$(printf '%s' "$APP" | grep -o 'id="liveComposer"' | wc -l | tr -d ' ')
[ "$COUNT" = "1" ] || fail "public composer source count=$COUNT"

say 88 "Verify public English translation on demand"
MID=$(curl -fsSL -X POST https://voice.star45.net/api/v1/meetings -H 'content-type: application/json' --data '{"type":"internal","title":"public-v276-e2e","peer_id":"qa_public","name":"QA","language":"ko-KR"}' | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(s).data.id))")
curl -fsSL -X POST "https://voice.star45.net/api/v1/meetings/$MID/captions" -H 'content-type: application/json' --data '{"peer_id":"qa_public","speaker":"QA","language":"ko-KR","detected_language":"ko-KR","text":"영어 번역 실제 테스트입니다","final":true}' >/dev/null
RES=$(curl -fsSL "https://voice.star45.net/api/v1/meetings/$MID/captions?target=en-US")
printf '%s' "$RES" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s).data?.[0]||{};const t=d.translation;if(d.display_target_language!=='en-US'||!t||t==='영어 번역 실제 테스트입니다')process.exit(1);console.log('PUBLIC_TARGET:',d.display_target_language);console.log('PUBLIC_EN_TRANSLATION:',t);console.log('PUBLIC_PROVIDER:',d.validation?.translation_provider||'unknown')})" || fail 'public on-demand English translation failed'

say 100 "Voice target translation rollout verified"
echo 'SOURCE MAIN          PASS'
echo 'SINGLE COMPOSER      PASS'
echo 'TARGET LANGUAGE       PASS'
echo 'CORE HEALTH           PASS'
echo 'LAZY TARGET TRANSLATE PASS'
echo 'PUBLIC UI             PASS'
echo 'PUBLIC TRANSLATION    PASS'
