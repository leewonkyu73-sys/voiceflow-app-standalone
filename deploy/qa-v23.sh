#!/usr/bin/env sh
set -eu

QA_OUT=$(mktemp /tmp/voiceflow-qa.XXXXXX)
cleanup(){ rm -f "$QA_OUT" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
check(){ name="$1"; url="$2"; printf '%-28s ' "$name"; : > "$QA_OUT"; if curl -fsS --max-time 5 "$url" >"$QA_OUT" 2>/dev/null; then echo PASS; else echo FAIL; cat "$QA_OUT" 2>/dev/null || true; exit 1; fi; }
contains(){ name="$1"; url="$2"; needle="$3"; printf '%-28s ' "$name"; if curl -fsS --max-time 5 "$url" 2>/dev/null | grep -q "$needle"; then echo PASS; else echo "FAIL ($needle missing)"; exit 1; fi; }
check gateway http://127.0.0.1:4173/api/health
check meeting-core http://127.0.0.1:4180/api/health
check admin-integrations-api http://127.0.0.1:4181/health
check integration-hub-bridge http://127.0.0.1:4182/health
check device-nearby-tapjoin http://127.0.0.1:4183/health
check board http://127.0.0.1:4175/health
check tasks http://127.0.0.1:4176/health
check ai-employees http://127.0.0.1:4177/health
check connectors-v6 http://127.0.0.1:4178/health
check meeting-result-drive http://127.0.0.1:4179/health
check home-page http://127.0.0.1:4173/
check meeting-preview http://127.0.0.1:4173/meeting-preview.html
check drive-connect-page http://127.0.0.1:4173/drive-connect.html
check admin-integrations-page http://127.0.0.1:4173/admin-integrations.html
check tap-landing-page http://127.0.0.1:4173/tap.html
check tap-settings-page http://127.0.0.1:4173/tap-settings.html
check nearby-bridge-js http://127.0.0.1:4173/device-nearby-bridge.js
check calendar-page http://127.0.0.1:4173/work-calendar.html
check ai-admin-page http://127.0.0.1:4173/ai-employee-admin.html
check ai-lab-page http://127.0.0.1:4173/ai-meeting-lab.html
check integration-v6 http://127.0.0.1:4173/integration-center-v6.html
check runtime-version http://127.0.0.1:4173/version.json
contains version-2.6.2 http://127.0.0.1:4173/version.json '2.6.2'
contains mobile-chat-nav 'http://127.0.0.1:4173/app.js?v=2.6.2' 'bottom-nav cols-5 vf-global-nav'
contains chat-live 'http://127.0.0.1:4173/app.js?v=2.6.2' 'class="vf-chat-toolbar"'
contains recording-pause 'http://127.0.0.1:4173/app.js?v=2.6.2' 'pauseCapture'
contains inline-invite 'http://127.0.0.1:4173/app.js?v=2.6.2' 'inviteInline'
contains ai-task-intake 'http://127.0.0.1:4173/app.js?v=2.6.2' 'AI 업무 등록'
contains ai-task-interpret 'http://127.0.0.1:4173/app.js?v=2.6.2' '/api/v1/tasks/interpret'
contains ai-task-batch 'http://127.0.0.1:4173/app.js?v=2.6.2' '/api/v1/tasks/batch'
contains result-review 'http://127.0.0.1:4173/app.js?v=2.6.2' '회의결과 검토'
contains drive-card 'http://127.0.0.1:4173/app.js?v=2.6.2' 'Google Drive 공식저장'
contains integration-card 'http://127.0.0.1:4173/app.js?v=2.6.2' '통합 API · 연동 관리'
contains integration-page http://127.0.0.1:4180/admin-integrations.html 'id="autoConfigure"'
contains hub-panel http://127.0.0.1:4180/admin-integrations.html 'Integration Hub'
contains hub-open-ui http://127.0.0.1:4180/admin-integrations.html 'id="openHub"'
contains hub-push-ui 'http://127.0.0.1:4173/admin-integrations.js' '앱→Hub'
contains hub-pull-ui 'http://127.0.0.1:4173/admin-integrations.js' 'Hub→앱'
contains device-admin-ui 'http://127.0.0.1:4173/admin-integrations.js' 'device_tapjoin'
contains nfc-writer-ui http://127.0.0.1:4173/tap-settings.html 'NFC 태그에 기록'
contains digital-card-ui http://127.0.0.1:4173/tap.html '연락처에 저장'
printf '%-28s ' automation-worker; docker ps --format '{{.Names}}' | grep -qx 'voiceflow-automation-v26' && echo PASS || exit 1
printf '%-28s ' integration-hub-bridge; docker ps --format '{{.Names}}' | grep -qx 'voiceflow-integration-hub-bridge-v26' && echo PASS || exit 1
printf '%-28s ' device-nearby-tapjoin; docker ps --format '{{.Names}}' | grep -qx 'voiceflow-device-nearby-v26' && echo PASS || exit 1
echo "=== CENTRAL INTEGRATION STORE ==="
ENV_FILE=${VOICEFLOW_ENV_FILE:-/opt/star45/voiceflow-smart-workspace/.env}
[ -f "$ENV_FILE" ] || ENV_FILE=.env
[ -f "$ENV_FILE" ] || exit 1
KEY=$(grep -E '^INTEGRATION_SECRET_KEY=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)
[ -n "$KEY" ] || exit 1
for f in integration-secrets.json integration-config.json integration-hub-sync.json; do [ -f "/opt/star45/voiceflow-data/$f" ] && printf '%-38s %s\n' "$f" READY || printf '%-38s %s\n' "$f" CREATED_ON_START; done
echo "=== GOOGLE DRIVE STATUS ==="; curl -fsS --max-time 5 http://127.0.0.1:4179/health || true; echo
echo "=== TAPJOIN / NFC STATUS ==="; curl -fsS --max-time 5 http://127.0.0.1:4183/health || true; echo
echo "ALL V2.6.2 MOBILE-STABLE + DIRECT-LAUNCH + TAPJOIN SERVICES PASS"
