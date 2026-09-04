#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace
say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }
contains(){ case "$1" in *"$2"*) return 0;; *) return 1;; esac; }
RESTORE_APP=0
restore_app(){ if [ "$RESTORE_APP" = "1" ] && [ -f /tmp/voiceflow-app-original.js ]; then cp /tmp/voiceflow-app-original.js public/app.js || true; fi; }
trap restore_app EXIT INT TERM
V4_MOBILE_CANARY_URL='OFF'
V4_LOCAL_STT_CANARY_URL='OFF'
SPEECH_QUALITY_LAB_URL='OFF'

say 5 "Sync latest source"
git fetch origin main
git reset --hard origin/main
if [ "${VOICEFLOW_DEPLOY_REFRESHED:-0}" != "1" ]; then
  exec env VOICEFLOW_DEPLOY_REFRESHED=1 sh deploy/complete-to-100-v262.sh
fi

say 10 "Verify deployment prerequisites"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found; installing Node.js 20 LTS..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    NODE_MAJOR=20
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
  else
    fail 'Node.js 20+ is required and apt-get is unavailable'
  fi
fi
node -e "const m=Number(process.versions.node.split('.')[0]); if(m<20) process.exit(1)" || fail 'Node.js 20+ required'
echo "Node $(node -v) / npm $(npm -v)"
command -v docker >/dev/null 2>&1 || fail 'docker not found'
docker compose version >/dev/null 2>&1 || fail 'docker compose plugin not found'
command -v ss >/dev/null 2>&1 || fail 'ss command not found (iproute2 required)'

say 12 "Prepare runtime environment"
if [ ! -f .env ]; then
  printf '%s\n' 'NODE_ENV=production' 'MEETING_PUBLIC_BASE_URL=https://voice.star45.net' > .env
fi
if ! grep -q '^INTEGRATION_SECRET_KEY=' .env || [ -z "$(grep '^INTEGRATION_SECRET_KEY=' .env | tail -1 | cut -d= -f2-)" ]; then
  KEY=$(openssl rand -hex 32)
  printf '\nINTEGRATION_SECRET_KEY=%s\n' "$KEY" >> .env
  echo "Created central integration encryption key"
fi
if ! grep -q '^MEETING_PUBLIC_BASE_URL=' .env; then
  printf 'MEETING_PUBLIC_BASE_URL=https://voice.star45.net\n' >> .env
fi
node scripts/install-provider-hub-app-token.mjs .env
echo "Individual API keys are NOT required in .env. Configure them in the STAR45 Provider Hub."
echo "Google Drive is OPTIONAL at deployment time and can be connected later in Admin."
VOICEFLOW_DEPLOY_REQUESTED_V4_MOBILE_ENABLED=${VOICEFLOW_V4_MOBILE_ENABLED:-0}
VOICEFLOW_DEPLOY_REQUESTED_V4_LOCAL_STT_ENABLED=${VOICEFLOW_V4_LOCAL_STT_ENABLED:-0}
VOICEFLOW_DEPLOY_REQUESTED_SPEECH_QUALITY_LAB=${VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED:-0}
VOICEFLOW_DEPLOY_REQUESTED_SPEECH_QUALITY_API=${VOICEFLOW_SPEECH_QUALITY_API_ENABLED:-0}
VOICEFLOW_DEPLOY_REQUESTED_V4_SERVER_STT=${VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED:-0}
VOICEFLOW_DEPLOY_REQUESTED_LOCAL_STT=${LOCAL_STT_ENABLED:-0}
VOICEFLOW_DEPLOY_REQUESTED_COMPOSE_PROFILES=${COMPOSE_PROFILES:-}
set -a
. ./.env
set +a
export VOICEFLOW_V4_MOBILE_ENABLED="$VOICEFLOW_DEPLOY_REQUESTED_V4_MOBILE_ENABLED"
export VOICEFLOW_V4_LOCAL_STT_ENABLED="$VOICEFLOW_DEPLOY_REQUESTED_V4_LOCAL_STT_ENABLED"
export VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED="$VOICEFLOW_DEPLOY_REQUESTED_SPEECH_QUALITY_LAB"
export VOICEFLOW_SPEECH_QUALITY_API_ENABLED="$VOICEFLOW_DEPLOY_REQUESTED_SPEECH_QUALITY_API"
export VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED="$VOICEFLOW_DEPLOY_REQUESTED_V4_SERVER_STT"
export LOCAL_STT_ENABLED="$VOICEFLOW_DEPLOY_REQUESTED_LOCAL_STT"
export COMPOSE_PROFILES="$VOICEFLOW_DEPLOY_REQUESTED_COMPOSE_PROFILES"
unset VOICEFLOW_DEPLOY_REQUESTED_V4_MOBILE_ENABLED VOICEFLOW_DEPLOY_REQUESTED_V4_LOCAL_STT_ENABLED VOICEFLOW_DEPLOY_REQUESTED_SPEECH_QUALITY_LAB VOICEFLOW_DEPLOY_REQUESTED_SPEECH_QUALITY_API VOICEFLOW_DEPLOY_REQUESTED_V4_SERVER_STT VOICEFLOW_DEPLOY_REQUESTED_LOCAL_STT VOICEFLOW_DEPLOY_REQUESTED_COMPOSE_PROFILES

# Restore the actual Golden provider handoff used by b98dcdd.
# Values are read from the existing runtime only, never printed or written to .env.
for PROVIDER_NAME in INTEGRATION_SECRET_KEY OPENAI_API_KEY OPENAI_TEXT_MODEL GEMINI_API_KEY GEMINI_TEXT_MODEL DEEPL_API_KEY DEEPL_API_URL; do
  PROVIDER_VALUE=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' voiceflow-ai-v26 2>/dev/null | sed -n "s/^${PROVIDER_NAME}=//p" | head -n 1 || true)
  if [ -z "$PROVIDER_VALUE" ]; then
    PROVIDER_VALUE=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' voiceflow-admin-integrations-v26 2>/dev/null | sed -n "s/^${PROVIDER_NAME}=//p" | head -n 1 || true)
  fi
  [ -z "$PROVIDER_VALUE" ] || export "${PROVIDER_NAME}=${PROVIDER_VALUE}"
done
unset PROVIDER_VALUE

if [ -z "${DEEPL_API_KEY:-}" ]; then
  EXISTING_DEEPL_KEY=''
  if EXISTING_DEEPL_KEY=$(INTEGRATION_DATA_DIR=/opt/star45/voiceflow-data node scripts/resolve-existing-deepl.mjs --emit); then
    export DEEPL_API_KEY="$EXISTING_DEEPL_KEY"
    echo "Existing VoiceFlow DeepL Secret recovered for the live translation gate"
  else
    INTEGRATION_DATA_DIR=/opt/star45/voiceflow-data node scripts/resolve-existing-deepl.mjs || true
  fi
  unset EXISTING_DEEPL_KEY
fi

node scripts/verify-provider-hub-access.mjs openai
INTEGRATION_DATA_DIR=/opt/star45/voiceflow-data node scripts/verify-live-translation-provider.mjs || fail 'live translation Provider unavailable before production replacement'
if [ "${VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED:-0}" = "1" ]; then
  if [ "${LOCAL_STT_ENABLED:-0}" = "1" ]; then
    if docker inspect voiceflow-local-stt --format '{{json .Config.Cmd}}' 2>/dev/null | grep -q -- '--vad-model' && curl -fsS http://127.0.0.1:4186/ >/dev/null 2>&1; then
      INTEGRATION_DATA_DIR=/opt/star45/voiceflow-data node scripts/verify-live-stt-provider.mjs || fail 'local STT Provider unavailable before v4 mobile server fallback'
    else
      echo 'Local STT VAD preflight deferred until sidecar reconcile'
    fi
  else
    INTEGRATION_DATA_DIR=/opt/star45/voiceflow-data node services/integration-env-launcher.mjs ../scripts/verify-live-stt-provider.mjs || fail 'live STT Provider unavailable before v4 mobile server fallback'
  fi
elif [ "${VOICEFLOW_V4_MOBILE_ENABLED:-0}" = "1" ] || [ "${VOICEFLOW_V4_LOCAL_STT_ENABLED:-0}" = "1" ]; then
  echo 'Optional server STT gate skipped; browser, downloaded-model and text modes remain available'
fi

say 20 "Full preflight: source, services, tests"
node --check server-v2.mjs
node --check frontend-v4/packages/mobile-speech-session/index.mjs
node --check frontend-v4/packages/mobile-browser-speech-session/index.mjs
node --check frontend-v4/packages/mobile-input-policy/index.mjs
node --check frontend-v4/packages/mobile-local-whisper/index.mjs
node --check frontend-v4/apps/mobile-pwa/app.mjs
node --check frontend-v4/apps/mobile-local-stt-test/app.mjs
node --check frontend-v4/apps/mobile-local-stt-test/local-whisper-worker.mjs
node --check frontend-v4/apps/mobile-local-stt-test/local-sw.js
node --check frontend-v4/apps/speech-quality-lab/app.mjs
node --check frontend-v4/apps/speech-quality-lab/sw.js
node --check frontend-v4/packages/speech-quality-evaluator/index.mjs
node --check lib/speech-quality-lab-service.mjs
node --check tests/e2e-speech-quality-lab.mjs
node --check scripts/verify-live-stt-provider.mjs
node --check services/admin-integration-service.mjs
node --check services/integration-hub-bridge-service.mjs
node --check services/integration-env-launcher.mjs
node --check services/meeting-result-drive-service.mjs
node --check services/task-calendar-service.mjs
node --check services/ai-employee-service.mjs
node --check services/hermes-obsidian-discord-service.mjs
node --check services/automation-worker.mjs
node --check public/admin-integrations.js
node --check public/drive-connect.js
node --check public/audio-monitor.js
node --check public/caption-language.js
node --check deploy/gateway.mjs
node --check tests/e2e-meeting.mjs
node --check scripts/patch-runtime-guards-v262.mjs
node --check scripts/patch-mobile-stt-ownership-v366.mjs
node --check scripts/patch-mobile-chrome-only-v367.mjs
node --check scripts/patch-mobile-chrome-finalize-v368.mjs
node --check scripts/patch-speech-signal-v369.mjs
node --check tests/mobile-stt-delayed-speech.test.mjs
node --check tests/mobile-server-stt-ownership.test.mjs
node --check scripts/verify-drive-live-v262.mjs
node --check scripts/install-provider-hub-app-token.mjs
node --check scripts/verify-provider-hub-access.mjs
sh -n deploy/runtime-reconcile-v262.sh
sh -n deploy/proxy-reconcile-v262.sh
sh -n deploy/qa-v23.sh
npm test

say 28 "Build exact production frontend artifact once"
cp public/app.js /tmp/voiceflow-app-original.js
RESTORE_APP=1
node scripts/patch-admin-drive-v262.mjs
node --check public/app.js
node tests/pc-video-session-reentry.test.mjs
node tests/mobile-stt-delayed-speech.test.mjs
node tests/mobile-server-stt-ownership.test.mjs
node --check public/audio-monitor.js
node --check public/caption-language.js
node scripts/verify-ui-bindings-v261.mjs
grep -q 'Google Drive 공식저장' public/app.js || fail 'Drive admin card missing after patch'
grep -q '통합 API · 연동 관리' public/app.js || fail 'Integration admin card missing after patch'
grep -q "2.6.2-r4" public/app.js || fail 'runtime guard r4 missing after patch'
if grep -Eq '\$\$?\([^;\n]*\)\?*\.forEach\(' public/app.js; then
  fail 'unsafe selector-helper forEach remains after patch'
fi

say 40 "Build exact prevalidated production image"
docker build --no-cache --pull -f deploy/Dockerfile.v2 -t voiceflow-smart-workspace:v2.6 .
mkdir -p /opt/star45/voiceflow-runtime-public
cp -a public/. /opt/star45/voiceflow-runtime-public/
grep -q "const APP_VERSION='3.5.21'" /opt/star45/voiceflow-runtime-public/app.js || fail 'runtime public app version 3.5.21 missing'
if grep -q 'id="externalAudioStart"' /opt/star45/voiceflow-runtime-public/app.js; then fail 'external audio action returned after rollback'; fi
if grep -q 'id="externalAudioToggle"' /opt/star45/voiceflow-runtime-public/app.js; then fail 'external audio room action returned after rollback'; fi
restore_app
RESTORE_APP=0
trap - EXIT INT TERM

say 54 "Reconcile runtime ports and start production stack"
sh deploy/runtime-reconcile-v262.sh

say 65 "Verify all runtime services"
CACHE_BUST=$(date +%s)
LOCAL_VERSION_JSON=$(curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4173/version.json?ts=${CACHE_BUST}") || fail 'local version endpoint unavailable'
PUBLIC_VERSION_JSON=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/version.json?ts=${CACHE_BUST}") || fail 'public version endpoint unavailable'
LOCAL_VERSION=$(printf '%s' "$LOCAL_VERSION_JSON" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(s).version||''))}catch{process.exit(2)}})") || fail 'local version JSON invalid'
PUBLIC_VERSION=$(printf '%s' "$PUBLIC_VERSION_JSON" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(s).version||''))}catch{process.exit(2)}})") || fail 'public version JSON invalid'
echo "LOCAL VERSION  : ${LOCAL_VERSION}"
echo "PUBLIC VERSION : ${PUBLIC_VERSION}"
[ "$LOCAL_VERSION" = "2.6.2" ] || { echo "LOCAL RESPONSE: $LOCAL_VERSION_JSON"; docker compose --env-file .env -f deploy/docker-compose.v23.yml ps || true; docker logs --tail=160 voiceflow-gateway-v26 2>&1 || true; fail 'local gateway is not serving 2.6.2'; }
[ "$PUBLIC_VERSION" = "2.6.2" ] || { echo "PUBLIC RESPONSE: $PUBLIC_VERSION_JSON"; echo "PUBLIC HEADERS:"; curl -ksSI -H 'Cache-Control: no-cache' "https://voice.star45.net/version.json?ts=${CACHE_BUST}" || true; fail 'public domain is not routing/serving 2.6.2'; }
LOCAL_HEALTH=$(curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4173/api/health?ts=${CACHE_BUST}") || fail 'local gateway health unavailable'
PUBLIC_HEALTH=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/api/health?ts=${CACHE_BUST}") || fail 'public gateway health unavailable'
printf '%s' "$LOCAL_HEALTH" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{const d=JSON.parse(s);if(!d.ok||d.version!=='2.6.2')process.exit(1)}catch{process.exit(2)}})" || { echo "LOCAL HEALTH: $LOCAL_HEALTH"; fail 'local gateway health/version failed'; }
printf '%s' "$PUBLIC_HEALTH" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{const d=JSON.parse(s);if(!d.ok||d.version!=='2.6.2')process.exit(1)}catch{process.exit(2)}})" || { echo "PUBLIC HEALTH: $PUBLIC_HEALTH"; fail 'public gateway health/version failed'; }
curl -fsSL http://127.0.0.1:4181/health | grep -q 'admin-integration-center' || fail 'admin integration service failed'
curl -fsSL http://127.0.0.1:4182/health | grep -q 'integration-hub-bridge' || fail 'Integration Hub bridge health failed'
sh deploy/qa-v23.sh

if [ "${LOCAL_STT_ENABLED:-0}" = "1" ]; then
  say 69 "Verify opt-in local STT service"
  docker inspect voiceflow-core-v26 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q 'LOCAL_STT_ENABLED=1' || fail 'core local STT flag missing'
  docker inspect voiceflow-core-v26 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q 'LOCAL_STT_EXCLUSIVE=1' || fail 'core local STT exclusive flag missing'
  curl -fsS http://127.0.0.1:4186/ >/dev/null || fail 'local STT service unavailable'
  INTEGRATION_DATA_DIR=/opt/star45/voiceflow-data node scripts/verify-live-stt-provider.mjs || fail 'reconciled local STT speech probe failed'
  echo 'LOCAL STT SERVICE PASS'
fi

if [ "${VOICEFLOW_V4_MOBILE_ENABLED:-0}" = "1" ]; then
  say 72 "Verify isolated v4 mobile canary"
  CANARY_MEETINGS=$(curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4173/api/v1/meetings?ts=${CACHE_BUST}") || fail 'v4 canary meeting list unavailable'
  CANARY_ID=$(printf '%s' "$CANARY_MEETINGS" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{const rows=JSON.parse(s).data||[],m=rows.find(x=>x.demo_tag==='demo-v4-mobile-canary'&&x.status==='live');process.stdout.write(String(m?.id||''))}catch{process.exit(2)}})") || fail 'v4 canary meeting list invalid'
  if [ -z "$CANARY_ID" ]; then
    CANARY_CREATED=$(curl -fsSL -X POST -H 'content-type: application/json' --data '{"title":"VoiceFlow v4 모바일 실기기 검증","type":"internal","demo_tag":"demo-v4-mobile-canary"}' "http://127.0.0.1:4173/api/v1/meetings") || fail 'v4 canary meeting creation failed'
    CANARY_ID=$(printf '%s' "$CANARY_CREATED" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(s).data?.id||''))}catch{process.exit(2)}})") || fail 'v4 canary meeting response invalid'
  fi
  [ -n "$CANARY_ID" ] || fail 'v4 canary meeting id missing'
  LOCAL_V4=$(curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4173/v4/mobile?meeting=${CANARY_ID}&ts=${CACHE_BUST}") || fail 'local v4 mobile canary unavailable'
  PUBLIC_V4=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/v4/mobile?meeting=${CANARY_ID}&ts=${CACHE_BUST}") || fail 'public v4 mobile canary unavailable'
  contains "$LOCAL_V4" 'data-v4-mobile="phase2-browser-speech"' || fail 'local v4 mobile Golden browser speech marker missing'
  contains "$PUBLIC_V4" 'data-v4-mobile="phase2-browser-speech"' || fail 'public v4 mobile Golden browser speech marker missing'
  contains "$LOCAL_V4" 'data-v4-speech="on-device-browser-speech-v1"' || fail 'local v4 mobile on-device speech marker missing'
  contains "$PUBLIC_V4" 'data-v4-speech="on-device-browser-speech-v1"' || fail 'public v4 mobile on-device speech marker missing'
  contains "$LOCAL_V4" 'data-v4-controls="pc-four-control-mobile-v1"' || fail 'local v4 mobile PC four-control marker missing'
  contains "$PUBLIC_V4" 'data-v4-controls="pc-four-control-mobile-v1"' || fail 'public v4 mobile PC four-control marker missing'
  contains "$PUBLIC_V4" 'href="/?classic=1"' || fail 'public v4 mobile classic home escape missing'
  LOCAL_V4_APP=$(curl -fsSL "http://127.0.0.1:4173/v4/mobile/app.mjs?ts=${CACHE_BUST}") || fail 'local v4 mobile app unavailable'
  PUBLIC_V4_APP=$(curl -fsSL "https://voice.star45.net/v4/mobile/app.mjs?ts=${CACHE_BUST}") || fail 'public v4 mobile app unavailable'
  PUBLIC_V4_SPEECH=$(curl -fsSL "https://voice.star45.net/v4/mobile/modules/mobile-browser-speech-session/index.mjs?ts=${CACHE_BUST}") || fail 'public v4 mobile speech module unavailable'
  contains "$LOCAL_V4_APP" '실제 마이크 확인 완료' || fail 'local v4 mobile microphone verification behavior missing'
  contains "$LOCAL_V4_APP" 'navigator.mediaDevices.getUserMedia' || fail 'local v4 mobile microphone access probe missing'
  contains "$PUBLIC_V4_APP" 'prepareOnDeviceBrowserSpeech' || fail 'public v4 mobile on-device speech wiring missing'
  contains "$PUBLIC_V4_SPEECH" 'createMobileBrowserSpeechSession' || fail 'public v4 mobile browser speech module missing'
  contains "$PUBLIC_V4_SPEECH" 'processLocally=true' || fail 'public v4 mobile strict local processing missing'
  contains "$PUBLIC_V4_SPEECH" 'recognitionConstructor.available' || fail 'public v4 mobile on-device availability check missing'
  contains "$PUBLIC_V4_SPEECH" 'recognitionConstructor.install' || fail 'public v4 mobile language-pack install missing'
  contains "$PUBLIC_V4_SPEECH" 'onaudiostart' || fail 'public v4 mobile audio-start evidence missing'
  contains "$PUBLIC_V4_SPEECH" "['conversation','dictation']" || fail 'public v4 mobile high-quality local model order missing'
  if contains "$PUBLIC_V4_APP" 'createMobileTranscriptionAdapter' || contains "$PUBLIC_V4_APP" 'createMobileSpeechSession' || contains "$PUBLIC_V4_APP" 'MediaRecorder' || contains "$PUBLIC_V4_APP" '/transcribe'; then
    fail 'public v4 mobile audio server fallback must remain absent'
  fi
  V4_MOBILE_CANARY_URL="https://voice.star45.net/v4/mobile?meeting=${CANARY_ID}"
  echo "V4_MOBILE_CANARY_URL=${V4_MOBILE_CANARY_URL}"
fi

if [ "${VOICEFLOW_V4_LOCAL_STT_ENABLED:-0}" = "1" ]; then
  say 74 "Verify isolated local-STT PWA canary"
  docker inspect voiceflow-core-v26 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q 'VOICEFLOW_V4_LOCAL_STT_ENABLED=1' || fail 'core local-STT PWA flag missing'
  LOCAL_STT_MEETINGS=$(curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4173/api/v1/meetings?ts=${CACHE_BUST}") || fail 'local-STT canary meeting list unavailable'
  LOCAL_STT_CANARY_ID=$(printf '%s' "$LOCAL_STT_MEETINGS" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{const rows=JSON.parse(s).data||[],m=rows.find(x=>x.demo_tag==='demo-v4-local-stt-canary'&&x.status==='live');process.stdout.write(String(m?.id||''))}catch{process.exit(2)}})") || fail 'local-STT canary meeting list invalid'
  if [ -z "$LOCAL_STT_CANARY_ID" ]; then
    LOCAL_STT_CREATED=$(curl -fsSL -X POST -H 'content-type: application/json' --data '{"title":"VoiceFlow 다운로드 모델 PWA 검증","type":"internal","demo_tag":"demo-v4-local-stt-canary"}' "http://127.0.0.1:4173/api/v1/meetings") || fail 'local-STT canary meeting creation failed'
    LOCAL_STT_CANARY_ID=$(printf '%s' "$LOCAL_STT_CREATED" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(s).data?.id||''))}catch{process.exit(2)}})") || fail 'local-STT canary meeting response invalid'
  fi
  [ -n "$LOCAL_STT_CANARY_ID" ] || fail 'local-STT canary meeting id missing'
  LOCAL_STT_PAGE=$(curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4173/v4/local-stt-test/?meeting=${LOCAL_STT_CANARY_ID}&ts=${CACHE_BUST}") || fail 'local local-STT PWA unavailable'
  PUBLIC_STT_PAGE=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/v4/local-stt-test/?meeting=${LOCAL_STT_CANARY_ID}&ts=${CACHE_BUST}") || fail 'public local-STT PWA unavailable'
  PUBLIC_STT_APP=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/v4/local-stt-test/app.mjs?ts=${CACHE_BUST}") || fail 'public local-STT app unavailable'
  PUBLIC_STT_WORKER=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/v4/local-stt-test/local-whisper-worker.mjs?ts=${CACHE_BUST}") || fail 'public local-STT worker unavailable'
  PUBLIC_STT_MANIFEST=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/v4/local-stt-test/manifest.webmanifest?ts=${CACHE_BUST}") || fail 'public local-STT manifest unavailable'
  contains "$LOCAL_STT_PAGE" 'data-v4-mobile="local-stt-pwa-canary-v1"' || fail 'local local-STT PWA marker missing'
  contains "$PUBLIC_STT_PAGE" 'value="local-model"' || fail 'downloaded model choice missing'
  contains "$PUBLIC_STT_PAGE" 'value="browser"' || fail 'browser speech choice missing'
  contains "$PUBLIC_STT_PAGE" 'value="server"' || fail 'server speech choice missing'
  contains "$PUBLIC_STT_PAGE" 'value="text"' || fail 'text-only choice missing'
  contains "$PUBLIC_STT_PAGE" 'id="registrationForm"' || fail 'invite signup gate missing'
  contains "$PUBLIC_STT_PAGE" 'name="termsAccepted"' || fail 'terms consent missing'
  contains "$PUBLIC_STT_PAGE" 'name="privacyAccepted"' || fail 'privacy consent missing'
  contains "$PUBLIC_STT_APP" 'voiceflow.mobileInputMode.v1' || fail 'per-device input choice persistence missing'
  contains "$PUBLIC_STT_APP" 'sessionStorage' || fail 'per-session server consent missing'
  contains "$PUBLIC_STT_WORKER" '@huggingface/transformers@4.2.0' || fail 'pinned Transformers.js worker missing'
  contains "$PUBLIC_STT_WORKER" 'onnx-community/whisper-small' || fail 'Whisper Small model missing'
  contains "$PUBLIC_STT_WORKER" "device:'webgpu'" || fail 'WebGPU local inference missing'
  contains "$PUBLIC_STT_WORKER" "MODEL_REVISION='36050c46d777d46dc4b5f43f6d90574fc38f8732'" || fail 'complete Whisper model revision missing'
  contains "$PUBLIC_STT_WORKER" "encoder_model:'fp32'" || fail 'quality FP32 encoder missing'
  contains "$PUBLIC_STT_WORKER" "decoder_model_merged:'q4'" || fail 'mobile Q4 decoder missing'
  contains "$PUBLIC_STT_PAGE" 'user-scalable=yes' || fail 'mobile page zoom contract missing'
  contains "$PUBLIC_STT_PAGE" '약 600MB' || fail 'model pack size disclosure missing'
  if contains "$PUBLIC_STT_WORKER" '/transcribe'; then fail 'local worker must not upload audio'; fi
  contains "$PUBLIC_STT_MANIFEST" '"id": "/v4/local-stt-test/"' || fail 'isolated PWA manifest id missing'
  UNAUTH_STT_STATUS=$(curl -sS -o /tmp/voiceflow-local-stt-auth-check.json -w '%{http_code}' -H 'x-voice-client: v4-local-stt-test' "http://127.0.0.1:4173/api/v1/meetings/${LOCAL_STT_CANARY_ID}/captions") || fail 'local-STT signup gate request failed'
  [ "$UNAUTH_STT_STATUS" = "401" ] || fail 'local-STT invite API must require signup consent'
  contains "$(cat /tmp/voiceflow-local-stt-auth-check.json)" 'signup_consent_required' || fail 'local-STT signup consent error missing'
  V4_LOCAL_STT_CANARY_URL="https://voice.star45.net/v4/local-stt-test/?meeting=${LOCAL_STT_CANARY_ID}"
  echo "V4_LOCAL_STT_CANARY_URL=${V4_LOCAL_STT_CANARY_URL}"
fi

if [ "${VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED:-0}" = "1" ]; then
  say 75 "Verify isolated speech quality PWA with paid API locked"
  CORE_ENV=$(docker inspect voiceflow-core-v26 --format '{{range .Config.Env}}{{println .}}{{end}}') || fail 'core environment unavailable'
  contains "$CORE_ENV" 'VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED=1' || fail 'speech quality lab flag missing'
  contains "$CORE_ENV" 'VOICEFLOW_SPEECH_QUALITY_API_ENABLED=0' || fail 'speech quality paid API must remain locked'
  LOCAL_QUALITY_PAGE=$(curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4173/v4/speech-quality-lab/?ts=${CACHE_BUST}") || fail 'local speech quality lab unavailable'
  PUBLIC_QUALITY_PAGE=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://voice.star45.net/v4/speech-quality-lab/?ts=${CACHE_BUST}") || fail 'public speech quality lab unavailable'
  PUBLIC_QUALITY_APP=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/v4/speech-quality-lab/app.mjs?ts=${CACHE_BUST}") || fail 'public speech quality app unavailable'
  PUBLIC_QUALITY_SW=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/v4/speech-quality-lab/sw.js?ts=${CACHE_BUST}") || fail 'public speech quality worker unavailable'
  PUBLIC_QUALITY_MANIFEST=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/v4/speech-quality-lab/manifest.webmanifest?ts=${CACHE_BUST}") || fail 'public speech quality manifest unavailable'
  contains "$LOCAL_QUALITY_PAGE" 'data-voiceflow-page="speech-quality-lab-v1"' || fail 'local speech quality page marker missing'
  contains "$PUBLIC_QUALITY_PAGE" '같은 음원을 선택한 STT 제공자에 순서대로' || fail 'public sequential comparison explanation missing'
  contains "$PUBLIC_QUALITY_PAGE" 'user-scalable=yes' || fail 'speech quality page zoom contract missing'
  contains "$PUBLIC_QUALITY_APP" 'body:recording.blob' || fail 'same recording Blob handoff missing'
  contains "$PUBLIC_QUALITY_APP" 'for(let index=0;index<providers.length;index+=1)' || fail 'Provider comparison must be sequential'
  contains "$PUBLIC_QUALITY_SW" "url.pathname.startsWith('/api/')" || fail 'private API cache bypass missing'
  contains "$PUBLIC_QUALITY_MANIFEST" '"id": "/v4/speech-quality-lab/"' || fail 'isolated quality PWA manifest id missing'
  UNAUTH_QUALITY_STATUS=$(curl -sS -o /tmp/voiceflow-speech-quality-auth-check.json -w '%{http_code}' "http://127.0.0.1:4173/api/v1/speech-quality/providers") || fail 'speech quality auth gate request failed'
  [ "$UNAUTH_QUALITY_STATUS" = "401" ] || fail 'speech quality Provider status must require login'
  contains "$(cat /tmp/voiceflow-speech-quality-auth-check.json)" 'login_required' || fail 'speech quality login error missing'
  if [ "${VOICEFLOW_V4_LOCAL_STT_ENABLED:-0}" != "1" ]; then
    RETIRED_LOCAL_STT_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:4173/v4/local-stt-test/") || true
    [ "$RETIRED_LOCAL_STT_STATUS" = "404" ] || fail 'failed 600MB local-STT route must remain quarantined'
  fi
  SPEECH_QUALITY_LAB_URL="https://voice.star45.net/v4/speech-quality-lab/"
  echo "SPEECH_QUALITY_LAB_URL=${SPEECH_QUALITY_LAB_URL}"
fi

say 76 "Verify deployed admin, optional Drive and Hub UI"
ADMIN=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-integrations.html?ts=${CACHE_BUST}")
contains "$ADMIN" 'id="app"' || fail 'admin integration shell missing'
curl -fsSL -H 'Cache-Control: no-cache' -o /dev/null "https://voice.star45.net/drive-connect.html?ts=${CACHE_BUST}" || fail 'Drive connector page unavailable'
ADMINJS=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-integrations.js?v=2.6.2-hub1&ts=${CACHE_BUST}")
contains "$ADMINJS" '앱→Hub' || fail 'Hub push UI missing'
contains "$ADMINJS" 'Hub→앱' || fail 'Hub pull UI missing'
APP=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/app.js?v=2.6.2&ts=${CACHE_BUST}")
ENTRY=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/meeting-auto-dispatch-v361.js?v=3.6.1&ts=${CACHE_BUST}")
if contains "$ENTRY" 'shouldAutoOpenV4MobileRoot' || contains "$ENTRY" 'autoOpenV4MobileRoot' || contains "$ENTRY" 'pwaVoiceStartRequested' || contains "$ENTRY" '/v4/mobile?meeting='; then
  fail 'classic mobile entry regression: Android Chrome/PWA must remain on the PC-style root shell'
fi
contains "$ENTRY" 'window.fetch=async' || fail 'classic mobile meeting fetch bridge missing'
contains "$ENTRY" 'function sourceRows()' || fail 'meeting result dispatch behavior missing'
contains "$APP" '/transcribe' || fail 'classic mobile server STT endpoint missing'
COLLAB=$(curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/meeting-collab.js?v=2.8.2&ts=${CACHE_BUST}")
contains "$APP" 'Google Drive 공식저장' || fail 'Drive card missing from deployed admin UI'
contains "$APP" '통합 API · 연동 관리' || fail 'Integration card missing from deployed admin UI'
contains "$APP" '2.6.2-r4' || fail 'runtime guard r4 not deployed'
contains "$APP" "const APP_VERSION='3.5.21'" || fail 'Samsung STT ownership app version 3.5.21 not deployed'
contains "$APP" "state.meeting?.status!=='ended'" || fail 'stale completed bar guard missing'
contains "$APP" "state.chatDraft=text;try{const sent=await postCaption(text)" || fail 'reliable PC chat send guard missing'
contains "$APP" "videoOn?'화상 종료':'녹음 완료'" || fail 'explicit video end label missing'
contains "$COLLAB" 'systemRows.length=0' || fail 'meeting guidance reset missing'
contains "$APP" 'r.continuous=!mobileBrowserSpeech;r.interimResults=true' || fail 'Android Chrome one-shot STT mode missing'
contains "$APP" 'if(mobileBrowserSpeech)try{r.stop()}catch{}' || fail 'Android Chrome speech-end finalization missing'
contains "$APP" 'class="vf-speech-signal"' || fail 'speech readiness signal markup missing'
contains "$APP" 'r.onaudiostart=' || fail 'speech readiness audio-start evidence missing'
contains "$APP" "setSpeechSignal('ready','지금 말씀하세요.')" || fail 'green ready signal missing'
contains "$APP" "setSpeechSignal('processing','음성을 원문으로 변환 중입니다.')" || fail 'blue processing signal missing'
contains "$APP" "setSpeechSignal('error','음성 연결을 확인해 주세요.')" || fail 'red error signal missing'
contains "$APP" "state.media.stt==='error'?1200:350" || fail 'Golden mobile STT restart delay missing'
contains "$APP" 'if(mobileBrowserSpeech){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFallbackTimer=null}' || fail 'Android Chrome browser-only ownership marker missing'
if contains "$APP" "browser-no-result-timeout'},1500)"; then fail 'Android Chrome server handoff watchdog still deployed'; fi
contains "$APP" "try{r.start()}catch(e){" || fail 'Samsung Golden browser start missing'
! contains "$APP" 'r.start(speechTrack)' || fail 'failed Samsung shared-track candidate returned'
contains "$APP" 'mobileIncompleteCycle=mobileSpeech&&!mobileBrowserSpeech&&!recognitionCycle.final' || fail 'Android Chrome end-cycle server handoff guard missing'
contains "$APP" "startServerSpeechFallback();state.media.stt='server';return" || fail 'single server STT handoff missing'
contains "$APP" "recognitionCycle.error||'ended-without-final'" || fail 'mobile recognition error evidence missing'
contains "$APP" 'state._serverSttGeneration=(state._serverSttGeneration||0)+1' || fail 'server STT cancellation generation missing'
contains "$APP" 'signal:request.signal' || fail 'server STT abort ownership missing'
contains "$APP" 'const segmentMs=6500' || fail 'complete Samsung shadow segment missing'
if contains "$APP" 'if(mobileBrowserSpeech)startServerSpeechFallback()'; then fail 'Android Chrome shadow server recorder still deployed'; fi
if contains "$APP" 'if(mobileBrowserSpeech)extendServerSpeechFallback()'; then fail 'Android Chrome speech-boundary server extension still deployed'; fi
contains "$APP" 'recognitionCycle={result:false,final:false,error:' || fail 'browser final cycle tracking missing'
contains "$APP" 'recognitionCycle.final=true' || fail 'browser final result evidence missing'
contains "$APP" 'if(finals.length&&mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);stopServerSpeechFallback()}' || fail 'browser final ownership cancellation missing'
if contains "$APP" 'state._speechGeneration=generation+1;state._speechStarting=false;try{r.abort()}catch{}'; then fail 'Android Chrome abort-to-server handoff still deployed'; fi
if contains "$APP" 'state._mobileSpeechFastFallback?2200:6500'; then fail 'truncated fast server STT segment still deployed'; fi
if contains "$APP" "모바일 음성 인식 중'},1500"; then fail '1.5s competing mobile STT fallback still deployed'; fi
if contains "$APP" 'speechStartedAt=Date.now()'; then fail 'duplicate speech-start server fallback deployed'; fi
if contains "$APP" 'lastBrowserResult>=speechStartedAt'; then fail 'duplicate speech-result server fallback deployed'; fi
if contains "$APP" '_mobileSpeechStartWatchdog'; then fail 'duplicate mobile STT watchdog deployed'; fi
if contains "$APP" 'void checkDevices(false)'; then fail 'session-start microphone reacquisition deployed'; fi
if contains "$APP" 'r.continuous=!mobileSpeech'; then fail 'regressed mobile non-continuous STT mode deployed'; fi
if contains "$APP" 'mobileSpeech?80:350'; then fail 'regressed 80ms mobile STT restart deployed'; fi
if contains "$APP" 'id="externalAudioStart"'; then fail 'external audio action returned after rollback'; fi
if contains "$APP" 'id="externalAudioToggle"'; then fail 'external audio room action returned after rollback'; fi
if contains "$APP" "postCaption(text,'external-audio')"; then fail 'external audio caption path returned after rollback'; fi

say 87 "Run Chromium real meeting/menu E2E"
docker pull mcr.microsoft.com/playwright:v1.55.0-noble >/dev/null
docker run --rm --network host -e E2E_BASE_URL=https://voice.star45.net -e E2E_CORE_URL=http://127.0.0.1:4180 -e E2E_EXPECT_VERSION=2.6.2 -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.55.0-noble bash -lc "npm install --no-save playwright@1.55.0 >/dev/null 2>&1 && node tests/e2e-meeting.mjs"
if [ "${VOICEFLOW_V4_LOCAL_STT_ENABLED:-0}" = "1" ]; then
  docker run --rm --network host -e E2E_BASE_URL=https://voice.star45.net -e E2E_LOCAL_STT_URL="$V4_LOCAL_STT_CANARY_URL" -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.55.0-noble bash -lc "npm install --no-save playwright@1.55.0 >/dev/null 2>&1 && node tests/e2e-v4-local-stt.mjs"
fi
if [ "${VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED:-0}" = "1" ]; then
  docker run --rm --network host -e E2E_BASE_URL=https://voice.star45.net -e E2E_SPEECH_QUALITY_LAB_URL="$SPEECH_QUALITY_LAB_URL" -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.55.0-noble bash -lc "npm install --no-save playwright@1.55.0 >/dev/null 2>&1 && node tests/e2e-speech-quality-lab.mjs"
fi

say 96 "Meeting application operational verification complete"
echo "MEETING CORE             PASS"
echo "SERVICES                 PASS"
echo "ADMIN UI                 PASS"
echo "INTEGRATION CENTER       PASS"
echo "INTEGRATION HUB BRIDGE   PASS"
echo "HUB SEND/RECEIVE UI      PASS"
echo "BROWSER E2E              PASS"

DRIVE_STATUS='NOT CONFIGURED (optional; connect later in Admin)'
if [ -f /opt/star45/voiceflow-data/google-drive-oauth.json ]; then
  say 98 "Google Drive is connected; verify real write/read/delete"
  set -a
  . ./.env
  set +a
  if MEETING_RESULT_DATA_DIR=/opt/star45/voiceflow-data node scripts/verify-drive-live-v262.mjs | tee /opt/star45/voiceflow-data/drive-live-verification.json \
    && grep -q '"ok":true' /opt/star45/voiceflow-data/drive-live-verification.json; then
      DRIVE_STATUS='CONNECTED / LIVE STORAGE PASS'
  else
      DRIVE_STATUS='CONNECTED / VERIFICATION WARNING - review in Admin'
      echo "WARNING: Google Drive connector is optional and does not block Meeting App deployment."
  fi
fi

say 100 "STAR45 AI Meeting v2.6.2 production verification complete"
echo "VERSION                  PASS 2.6.2"
echo "MEETING CORE             PASS"
echo "SERVICES                 PASS"
echo "ADMIN INTEGRATIONS       PASS"
echo "INTEGRATION HUB BRIDGE   PASS"
echo "HUB SEND/RECEIVE UI      PASS"
echo "UI BINDINGS              PASS"
echo "BROWSER E2E              PASS"
echo "V4 MOBILE CANARY         $V4_MOBILE_CANARY_URL"
echo "V4 LOCAL STT CANARY      $V4_LOCAL_STT_CANARY_URL"
echo "SPEECH QUALITY LAB       $SPEECH_QUALITY_LAB_URL"
echo "GOOGLE DRIVE             $DRIVE_STATUS"
echo "PERSISTENCE              PASS"
echo "OVERALL                  100% PASS"
echo "NOTE: Google Drive is an optional Integration Hub connector and can be configured later from the administrator page."
