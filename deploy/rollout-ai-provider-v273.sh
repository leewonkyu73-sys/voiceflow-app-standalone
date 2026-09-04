#!/usr/bin/env sh
set -eu

ROOT=/opt/star45/voiceflow-smart-workspace
cd "$ROOT"

say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }

say 5 "Sync approved main source"
git config --global --add safe.directory "$ROOT" >/dev/null 2>&1 || true
git fetch origin main
git reset --hard origin/main

say 12 "Preflight latest model catalog"
grep -q "gpt-5.6-sol" public/admin-integrations-models.js || fail "OpenAI latest model catalog missing"
grep -q "gemini-3.7-flash" public/admin-integrations-models.js || fail "Gemini latest model catalog missing"
grep -q "claude-opus-5" public/admin-integrations-models.js || fail "Claude latest model catalog missing"
grep -q "gpt-4o-transcribe" public/function-ai-routing.js || fail "OpenAI STT model catalog missing"
grep -q "gpt-5.6-sol" lib/provider-adapters.mjs || fail "runtime OpenAI fallback missing"
grep -q "claude-opus-5" services/integration-env-launcher.mjs || fail "runtime Claude fallback missing"
node --check services/admin-integration-service.mjs
node --check services/integration-env-launcher.mjs
node --check lib/provider-adapters.mjs

say 20 "Preflight full frontend patch chain before touching runtime"
PRE_APP="/tmp/voiceflow-app-preflight-$$.js"
cp public/app.js "$PRE_APP"
restore_preflight(){ cp "$PRE_APP" public/app.js 2>/dev/null || true; rm -f "$PRE_APP"; }
trap restore_preflight EXIT INT TERM
node scripts/patch-admin-drive-v262.mjs
node --check public/app.js
grep -q "openAiSelfTest" public/app.js || fail "AI self-test UI binding missing after patch chain"
grep -q "LIVE TRANSLATION CHAT" public/app.js || fail "live translation chat patch missing"
restore_preflight
trap - EXIT INT TERM
say 24 "Frontend patch chain preflight PASS"

say 35 "Roll out admin integration backend with automatic rollback"
FAST_CORE_VERIFY_CMD="curl -fsSL http://127.0.0.1:4181/health | grep -q '\"version\":\"1.3.0\"'" \
  sh scripts/star45-fast-core-deploy.sh \
  voiceflow-admin-integrations-v26 \
  http://127.0.0.1:4181/health \
  services/admin-integration-service.mjs

say 55 "Roll out AI runtime defaults with automatic rollback"
FAST_CORE_VERIFY_CMD="curl -fsSL http://127.0.0.1:4177/health | grep -q 'voiceflow-ai-employee' && docker exec voiceflow-ai-v26 grep -q 'gpt-5.6-sol' /app/lib/provider-adapters.mjs && docker exec voiceflow-ai-v26 grep -q 'claude-opus-5' /app/services/integration-env-launcher.mjs" \
  sh scripts/star45-fast-core-deploy.sh \
  voiceflow-ai-v26 \
  http://127.0.0.1:4177/health \
  services/integration-env-launcher.mjs \
  lib/provider-adapters.mjs

say 72 "Publish UI atomically using existing verified Fast UI path"
sh deploy/fast-ui-sync-v271.sh

say 90 "Verify latest UI assets locally and publicly"
TS=$(date +%s)
curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4180/admin-integrations-models.js?ts=$TS" | grep -q 'gpt-5.6-sol' || fail "local OpenAI model asset stale"
curl -fsSL -H 'Cache-Control: no-cache' "http://127.0.0.1:4180/function-ai-routing.js?ts=$TS" | grep -q 'gpt-4o-transcribe' || fail "local STT routing asset stale"
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-integrations-models.js?ts=$TS" | grep -q 'gpt-5.6-sol' || fail "public OpenAI model asset stale"
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/admin-integrations-models.js?ts=$TS" | grep -q 'gemini-3.7-flash' || fail "public Gemini model asset stale"
curl -fsSL -H 'Cache-Control: no-cache' "https://voice.star45.net/function-ai-routing.js?ts=$TS" | grep -q 'gpt-4o-transcribe' || fail "public STT routing asset stale"
curl -fsSL http://127.0.0.1:4181/health | grep -q '1.3.0' || fail "admin backend version verification failed"
curl -fsSL http://127.0.0.1:4177/health | grep -q 'voiceflow-ai-employee' || fail "AI runtime health verification failed"

say 100 "AI Provider source and runtime rollout verified"
echo "SOURCE MAIN        PASS"
echo "UI PATCH PREFLIGHT PASS"
echo "ADMIN BACKEND      PASS"
echo "AI RUNTIME         PASS"
echo "PUBLIC UI ASSETS   PASS"
echo "ACTUAL PROVIDER    MANUAL TEST REQUIRED (admin login -> each Provider -> 연결 테스트)"
echo "NOTE               Do not paste API keys into chat. Enter them only inside the app's secure API settings."
