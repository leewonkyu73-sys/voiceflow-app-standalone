#!/usr/bin/env sh
set -eu

ACTION=${1:-apply}
RUN_ID=${RUN_ID:-manual}
LIVE=/opt/star45/voiceflow-runtime-public
SOURCE_PUBLIC=/opt/star45/voiceflow-smart-workspace/public
QUARANTINE=/opt/star45/quarantine/voice-ui-isolation-$RUN_ID
ENABLED=/etc/nginx/sites-enabled/voice.star45.net
NGINX_CONF=$(readlink -f "$ENABLED")
STAGE="$NGINX_CONF.next-$RUN_ID"
APPLIED=0

rollback() {
  if [ ! -f "$QUARANTINE/nginx.conf" ] || [ ! -f "$QUARANTINE/nginx-path" ]; then
    echo "ROLLBACK_BACKUP_NOT_FOUND=$QUARANTINE"
    return 1
  fi
  target=$(cat "$QUARANTINE/nginx-path")
  cp -a "$QUARANTINE/nginx.conf" "$target"
  nginx -t
  systemctl reload nginx
  echo "ROLLBACK_COMPLETED=$target"
}

if [ "$ACTION" = rollback ]; then
  rollback
  exit 0
fi

finish() {
  code=$?
  trap - EXIT HUP INT TERM
  rm -f "$STAGE"
  if [ "$code" -ne 0 ] && [ "$APPLIED" -eq 1 ]; then
    echo 'APPLY_FAILED; restoring prior Nginx route.'
    rollback || true
  fi
  exit "$code"
}
trap finish EXIT HUP INT TERM

case "$RUN_ID" in ''|*[!A-Za-z0-9_-]*) echo 'unsafe RUN_ID'; exit 1 ;; esac

echo '=== 1. PRECHECK CANONICAL AND RETIRED UI ==='
test -n "$NGINX_CONF"
test -f "$NGINX_CONF"
test -r "$LIVE/index.html"
test -r "$LIVE/app.js"
test -r "$LIVE/sw.js"
test -r "$LIVE/style.css"
test -r "$SOURCE_PUBLIC/index.html"
test -r "$SOURCE_PUBLIC/app.js"
node --check "$LIVE/app.js"
grep -qF 'app.js?v=3.5.24' "$LIVE/index.html"
grep -qF "const APP_VERSION='3.5.24'" "$LIVE/app.js"
grep -qF 'liveComposer' "$LIVE/app.js"
grep -qF 'data-translation-input' "$LIVE/app.js"
LIVE_BYTES=$(wc -c < "$LIVE/app.js")
SOURCE_BYTES=$(wc -c < "$SOURCE_PUBLIC/app.js")
test "$LIVE_BYTES" -gt 100000
LIVE_HASH=$(sha256sum "$LIVE/app.js" | awk '{print $1}')
SOURCE_HASH=$(sha256sum "$SOURCE_PUBLIC/app.js" | awk '{print $1}')
test "$LIVE_HASH" != "$SOURCE_HASH"
BEFORE_PID=$(pm2 pid voice | head -1)
test -n "$BEFORE_PID"
curl -fsSL --max-time 8 http://127.0.0.1:3005/api/health >/dev/null
echo "CANONICAL_BYTES=$LIVE_BYTES CANONICAL_HASH=$LIVE_HASH"
echo "RETIRED_BYTES=$SOURCE_BYTES RETIRED_HASH=$SOURCE_HASH"
echo "VOICE_PID_BEFORE=$BEFORE_PID"

echo '=== 2. QUARANTINE RETIRED UI AND BACK UP EDGE ==='
mkdir -p "$QUARANTINE"
chmod 700 "$QUARANTINE"
cp -a "$NGINX_CONF" "$QUARANTINE/nginx.conf"
printf '%s\n' "$NGINX_CONF" > "$QUARANTINE/nginx-path"
cp -a "$SOURCE_PUBLIC" "$QUARANTINE/retired-source-public"
printf 'status=QUARANTINED\nretired_source=%s\ncanonical_runtime=%s\nretired_hash=%s\ncanonical_hash=%s\n' "$SOURCE_PUBLIC" "$LIVE" "$SOURCE_HASH" "$LIVE_HASH" > "$QUARANTINE/README.txt"

echo '=== 3. BUILD CANONICAL STATIC EDGE ==='
python3 - "$NGINX_CONF" "$STAGE" <<'PY'
import pathlib
import re
import sys

src = pathlib.Path(sys.argv[1])
dst = pathlib.Path(sys.argv[2])
text = src.read_text(encoding='utf-8')
marker = '# voice-ui-canonical-runtime-v1'
if marker in text:
    dst.write_text(text, encoding='utf-8')
    raise SystemExit(0)

pattern = re.compile(r'(?m)^\s*location / \{\s*proxy_pass\s+http://127\.0\.0\.1:3005;.*\}\s*$')
replacement = r'''
    # voice-ui-canonical-runtime-v1
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/(privacy|terms|account-delete)$ {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /v4/mobile { return 308 /; }
    location ^~ /v4/mobile/ { return 308 /; }
    location ^~ /frontend-v4/ { return 410; }

    location = /index.html {
        root /opt/star45/voiceflow-runtime-public;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        try_files $uri =404;
    }

    location = /app.js {
        root /opt/star45/voiceflow-runtime-public;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        try_files $uri =404;
    }

    location = /sw.js {
        root /opt/star45/voiceflow-runtime-public;
        add_header Cache-Control "no-store, no-cache, must-revalidate, max-age=0" always;
        try_files $uri =404;
    }

    location / {
        root /opt/star45/voiceflow-runtime-public;
        try_files $uri $uri/ /index.html;
    }
'''
updated, count = pattern.subn(replacement.rstrip(), text, count=1)
if count != 1:
    raise SystemExit(f'expected one retired root proxy block, found {count}')
dst.write_text(updated, encoding='utf-8')
PY

grep -qF '# voice-ui-canonical-runtime-v1' "$STAGE"
grep -qF 'root /opt/star45/voiceflow-runtime-public;' "$STAGE"
grep -qF 'location = /v4/mobile { return 308 /; }' "$STAGE"
grep -qF 'location ^~ /frontend-v4/ { return 410; }' "$STAGE"

echo '=== 4. ATOMIC NGINX SWITCH ==='
install -m 0644 "$STAGE" "$NGINX_CONF.new-$RUN_ID"
mv -f "$NGINX_CONF.new-$RUN_ID" "$NGINX_CONF"
APPLIED=1
nginx -t
systemctl reload nginx
sleep 2

echo '=== 5. LOCAL END-TO-END VERIFICATION ==='
LOCAL_INDEX=/tmp/voice-index-$RUN_ID
LOCAL_APP=/tmp/voice-app-$RUN_ID
LOCAL_HEALTH=/tmp/voice-health-$RUN_ID
curl -k -fsSL --max-time 10 --resolve voice.star45.net:443:127.0.0.1 -H 'Cache-Control: no-cache' "https://voice.star45.net/?ts=$RUN_ID" -o "$LOCAL_INDEX"
curl -k -fsSL --max-time 10 --resolve voice.star45.net:443:127.0.0.1 -H 'Cache-Control: no-cache' "https://voice.star45.net/app.js?ts=$RUN_ID" -o "$LOCAL_APP"
grep -qF 'app.js?v=3.5.24' "$LOCAL_INDEX"
grep -qF 'liveComposer' "$LOCAL_APP"
grep -qF 'data-translation-input' "$LOCAL_APP"
SERVED_HASH=$(sha256sum "$LOCAL_APP" | awk '{print $1}')
test "$SERVED_HASH" = "$LIVE_HASH"
ROOT_CODE=$(curl -k -sS --max-time 10 --resolve voice.star45.net:443:127.0.0.1 -o /dev/null -w '%{http_code}' https://voice.star45.net/)
APP_CODE=$(curl -k -sS --max-time 10 --resolve voice.star45.net:443:127.0.0.1 -o /dev/null -w '%{http_code}' https://voice.star45.net/app.js)
HEALTH_CODE=$(curl -k -sS --max-time 10 --resolve voice.star45.net:443:127.0.0.1 -o "$LOCAL_HEALTH" -w '%{http_code}' https://voice.star45.net/api/health)
RETIRED_CODE=$(curl -k -sS --max-time 10 --resolve voice.star45.net:443:127.0.0.1 -o /dev/null -w '%{http_code}' https://voice.star45.net/v4/mobile)
RETIRED_LOCATION=$(curl -k -sSI --max-time 10 --resolve voice.star45.net:443:127.0.0.1 https://voice.star45.net/v4/mobile | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}' | tail -1)
FRONTEND_V4_CODE=$(curl -k -sS --max-time 10 --resolve voice.star45.net:443:127.0.0.1 -o /dev/null -w '%{http_code}' https://voice.star45.net/frontend-v4/)
LEGAL_CODE=$(curl -k -sS --max-time 10 --resolve voice.star45.net:443:127.0.0.1 -o /dev/null -w '%{http_code}' https://voice.star45.net/privacy)
test "$ROOT_CODE" = 200
test "$APP_CODE" = 200
test "$HEALTH_CODE" = 200
test "$RETIRED_CODE" = 308
case "$RETIRED_LOCATION" in
  /|https://voice.star45.net/|http://voice.star45.net/) ;;
  *) echo "unexpected retired redirect location: $RETIRED_LOCATION"; exit 1 ;;
esac
test "$FRONTEND_V4_CODE" = 410
test "$LEGAL_CODE" = 200
AFTER_PID=$(pm2 pid voice | head -1)
test "$AFTER_PID" = "$BEFORE_PID"
nginx -t
rm -f "$LOCAL_INDEX" "$LOCAL_APP" "$LOCAL_HEALTH" "$STAGE"
printf 'status=PASS\nserved_hash=%s\nvoice_pid=%s\nretired_route=/v4/mobile -> %s\nfrontend_v4=410\n' "$SERVED_HASH" "$AFTER_PID" "$RETIRED_LOCATION" >> "$QUARANTINE/README.txt"
APPLIED=0
trap - EXIT HUP INT TERM
echo "CANONICAL_UI_LOCAL=PASS HASH=$SERVED_HASH"
echo 'RETIRED_UI_QUARANTINED=PASS'
echo "API_HEALTH=PASS CODE=$HEALTH_CODE"
echo "RETIRED_ROUTE=PASS CODE=$RETIRED_CODE LOCATION=$RETIRED_LOCATION"
echo "FRONTEND_V4_DISABLED=PASS CODE=$FRONTEND_V4_CODE"
echo 'VOICE_PROCESS_RESTART=NONE'
echo "ROLLBACK=$QUARANTINE/nginx.conf"
