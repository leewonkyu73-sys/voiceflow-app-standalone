#!/usr/bin/env sh
set -eu

ARCHIVE=${1:-}
RUNTIME_PUBLIC=/opt/star45/voiceflow-runtime-public
RUN_KEY=${GITHUB_RUN_ID:-manual}
STAGE="/opt/star45/voiceflow-runtime-public.next-v330-${RUN_KEY}"
BACKUP=/opt/star45/voiceflow-runtime-public.rollback-v330
MAX_LOAD_ATTEMPTS=${VOICEFLOW_UI_LOAD_ATTEMPTS:-20}
LOAD_SLEEP_SECONDS=${VOICEFLOW_UI_LOAD_SLEEP_SECONDS:-15}

say(){ printf '\n[%s%%] %s\n' "$1" "$2"; }
fail(){ echo "FAIL: $1"; exit 1; }
cleanup(){ rm -rf "$STAGE"; }

[ -n "$ARCHIVE" ] || fail 'UI artifact path is required'
[ -r "$ARCHIVE" ] || fail 'UI artifact is not readable'
case "$RUN_KEY" in ''|*[!A-Za-z0-9_-]*) fail 'unsafe run key' ;; esac
case "$STAGE" in /opt/star45/voiceflow-runtime-public.next-v330-[A-Za-z0-9_-]*) ;; *) fail 'unsafe stage path' ;; esac
case "$BACKUP" in /opt/star45/voiceflow-runtime-public.rollback-v330) ;; *) fail 'unsafe backup path' ;; esac
case "$RUNTIME_PUBLIC" in /opt/star45/voiceflow-runtime-public) ;; *) fail 'unsafe runtime path' ;; esac
trap cleanup EXIT INT TERM

say 10 "Wait for safe VPS load"
CORES=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 2)
attempt=1
while :; do
  LOAD1=$(cut -d' ' -f1 /proc/loadavg)
  if awk -v load1="$LOAD1" -v cores="$CORES" 'BEGIN{exit !(load1 <= cores*1.25)}'; then
    echo "VPS load gate PASS: load1=$LOAD1 cores=$CORES"
    break
  fi
  if [ "$attempt" -ge "$MAX_LOAD_ATTEMPTS" ]; then
    fail "VPS load remains high: load1=$LOAD1 cores=$CORES"
  fi
  echo "VPS load high; waiting without building: load1=$LOAD1 cores=$CORES attempt=$attempt/$MAX_LOAD_ATTEMPTS"
  attempt=$((attempt+1))
  sleep "$LOAD_SLEEP_SECONDS"
done

say 25 "Validate prebuilt artifact"
rm -rf "$STAGE"
mkdir -p "$STAGE"
if tar -tzf "$ARCHIVE" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  fail 'unsafe path in UI artifact'
fi
ARCHIVE_FILES=$(tar -tzf "$ARCHIVE" | sed 's#^\./##' | sed '/^$/d' | sort)
EXPECTED_FILES=$(printf '%s\n' app.js index.html sw.js | sort)
[ "$ARCHIVE_FILES" = "$EXPECTED_FILES" ] || fail 'UI artifact must contain only app.js, index.html and sw.js'
tar -xzf "$ARCHIVE" -C "$STAGE"
test -f "$STAGE/index.html" || fail 'index.html missing'
test -f "$STAGE/app.js" || fail 'app.js missing'
test -f "$STAGE/sw.js" || fail 'sw.js missing'
node --check "$STAGE/app.js"
grep -qF 'app.js?v=3.5.24' "$STAGE/index.html" || fail 'UI index version mismatch'
grep -qF "const APP_VERSION='3.5.24'" "$STAGE/app.js" || fail 'UI app version mismatch'
grep -qF "'x-voice-client':'v4-mobile'" "$STAGE/app.js" || fail 'mobile STT client guard missing'
grep -qF 'state._serverSttTimer=setTimeout(cycle,nextDelay)' "$STAGE/app.js" || fail 'mobile STT backoff missing'

say 50 "Back up current UI and publish in place"
rm -rf "$BACKUP"
mkdir -p "$BACKUP" "$RUNTIME_PUBLIC"
for file in app.js index.html sw.js; do
  test -f "$RUNTIME_PUBLIC/$file" || fail "current $file missing"
  cp -a "$RUNTIME_PUBLIC/$file" "$BACKUP/$file"
  cp -a "$STAGE/$file" "$RUNTIME_PUBLIC/$file.next-v330"
  mv -f "$RUNTIME_PUBLIC/$file.next-v330" "$RUNTIME_PUBLIC/$file"
done

say 70 "Verify local UI without restarting services"
TS=$(date +%s)
LOCAL_INDEX=$(curl -fsSL --max-time 10 -H 'Cache-Control: no-cache' "http://127.0.0.1:4180/?ts=$TS" || true)
LOCAL_APP=$(curl -fsSL --max-time 10 -H 'Cache-Control: no-cache' "http://127.0.0.1:4180/app.js?ts=$TS" || true)
if ! printf '%s' "$LOCAL_INDEX" | grep -qF 'app.js?v=3.5.24' || ! printf '%s' "$LOCAL_APP" | grep -qF "const APP_VERSION='3.5.24'"; then
  echo 'Local UI verification failed; restoring previous UI'
  cp -a "$BACKUP"/app.js "$BACKUP"/index.html "$BACKUP"/sw.js "$RUNTIME_PUBLIC"/
  fail 'local UI verification failed and rollback completed'
fi
curl -fsSL --max-time 10 http://127.0.0.1:4180/api/health >/dev/null || {
  echo 'Local core health failed; restoring previous UI'
  cp -a "$BACKUP"/app.js "$BACKUP"/index.html "$BACKUP"/sw.js "$RUNTIME_PUBLIC"/
  fail 'local core health failed and rollback completed'
}

say 85 "Defer public UI check to hosted runner"
echo 'PUBLIC UI        DEFERRED TO HOSTED RUNNER'

say 100 "Guarded UI rollout verified"
echo 'PREBUILT UI      PASS'
echo 'VPS BUILD        SKIPPED'
echo 'SERVICE RESTART  SKIPPED'
echo 'LOCAL UI         PASS'
echo 'PUBLIC UI        CHECKED BY HOSTED RUNNER'
echo 'ROLLBACK COPY    /opt/star45/voiceflow-runtime-public.rollback-v330'
