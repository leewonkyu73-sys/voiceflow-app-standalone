#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace

say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
ORIGINAL=/tmp/voiceflow-server-v2-fast-core-$$.mjs
cp server-v2.mjs "$ORIGINAL"
restore_source(){ cp "$ORIGINAL" server-v2.mjs 2>/dev/null || true; rm -f "$ORIGINAL"; }
trap restore_source EXIT INT TERM

say 10 "Sync latest main"
git config --global --add safe.directory /opt/star45/voiceflow-smart-workspace >/dev/null 2>&1 || true
git fetch origin main
git reset --hard origin/main
cp server-v2.mjs "$ORIGINAL"

say 25 "Prepare live translation core patch"
node scripts/patch-live-translation-routing-v272.mjs
node --check server-v2.mjs
node --check lib/provider-adapters.mjs

VERIFY_CMD='MID=$(curl -fsSL -X POST http://127.0.0.1:4180/api/v1/meetings -H "content-type: application/json" --data "{\"type\":\"internal\",\"title\":\"fast-core-translation-check\",\"peer_id\":\"qa_fast\",\"name\":\"QA\",\"language\":\"ko-KR\"}" | node -e "let s=\"\";process.stdin.on(\"data\",c=>s+=c);process.stdin.on(\"end\",()=>{const d=JSON.parse(s);process.stdout.write(d.data.id)})"); RES=$(curl -fsSL -X POST "http://127.0.0.1:4180/api/v1/meetings/$MID/captions" -H "content-type: application/json" --data "{\"peer_id\":\"qa_fast\",\"speaker\":\"QA\",\"language\":\"ko-KR\",\"detected_language\":\"ko-KR\",\"text\":\"밥 먹었니\",\"final\":true}"); printf "%s" "$RES" | node -e "let s=\"\";process.stdin.on(\"data\",c=>s+=c);process.stdin.on(\"end\",()=>{const d=JSON.parse(s);const t=d.data?.translations?.[\"vi-VN\"];if(!t||t===\"밥 먹었니\")process.exit(1);console.log(\"TRANSLATION:\",t);console.log(\"PROVIDER:\",d.data?.assurance?.[\"vi-VN\"]?.translation_provider||\"unknown\")})"'

say 35 "Fast Core inject/restart/verify"
FAST_CORE_VERIFY_CMD="$VERIFY_CMD" \
FAST_CORE_PUBLIC_VERIFY_CMD='curl -fsSL -H "Cache-Control: no-cache" "https://voice.star45.net/api/health?ts=$(date +%s)" >/dev/null' \
FAST_CORE_RESTART_WAIT=3 \
sh scripts/star45-fast-core-deploy.sh voiceflow-core-v26 http://127.0.0.1:4180/api/health server-v2.mjs lib/provider-adapters.mjs

restore_source
trap - EXIT INT TERM

echo "VOICEFLOW FAST CORE TRANSLATION PASS"
