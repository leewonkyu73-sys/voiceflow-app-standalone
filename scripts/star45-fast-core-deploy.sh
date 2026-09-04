#!/usr/bin/env sh
set -eu

if [ "$#" -lt 3 ]; then
  echo "Usage: sh scripts/star45-fast-core-deploy.sh <container> <health-url> <file> [file...]"
  exit 2
fi

CONTAINER="$1"
HEALTH_URL="$2"
shift 2
FILES="$*"
APP_ROOT="${FAST_CORE_APP_ROOT:-/app}"
BACKUP_DIR="/tmp/star45-fast-core-${CONTAINER}-$(date +%s)"
mkdir -p "$BACKUP_DIR"

say(){ printf '\n[%s] %s\n' "$1" "$2"; }
rollback(){
  say "ROLLBACK" "Restoring previous container files"
  for f in $FILES; do
    if [ -e "$BACKUP_DIR/$f" ]; then
      docker cp "$BACKUP_DIR/$f" "$CONTAINER:$APP_ROOT/$f" >/dev/null
    fi
  done
  docker restart "$CONTAINER" >/dev/null || true
  echo "ROLLBACK DONE"
}
fail(){ echo "FAIL: $1"; rollback; exit 1; }
trap 'fail "unexpected error"' HUP INT TERM

say "15%" "Validate source files"
for f in $FILES; do
  [ -f "$f" ] || fail "missing source file: $f"
  case "$f" in
    *.js|*.mjs|*.cjs) node --check "$f" || fail "syntax check failed: $f" ;;
  esac
done

say "30%" "Backup current container files"
for f in $FILES; do
  mkdir -p "$BACKUP_DIR/$(dirname "$f")"
  if docker exec "$CONTAINER" sh -c "test -e '$APP_ROOT/$f'" >/dev/null 2>&1; then
    docker cp "$CONTAINER:$APP_ROOT/$f" "$BACKUP_DIR/$f" >/dev/null || fail "backup failed: $f"
  fi
done

say "50%" "Inject changed core files"
for f in $FILES; do
  docker exec "$CONTAINER" sh -c "mkdir -p '$APP_ROOT/$(dirname "$f")'" >/dev/null
  docker cp "$f" "$CONTAINER:$APP_ROOT/$f" >/dev/null || fail "inject failed: $f"
done

say "65%" "Restart target core only"
docker restart "$CONTAINER" >/dev/null || fail "container restart failed"
sleep "${FAST_CORE_RESTART_WAIT:-3}"

say "78%" "Local health check"
health_attempts="${FAST_CORE_HEALTH_ATTEMPTS:-24}"
health_delay="${FAST_CORE_HEALTH_DELAY:-5}"
health_try=1
health_ok=0
while [ "$health_try" -le "$health_attempts" ]; do
  if curl -fsSL "$HEALTH_URL" >/dev/null; then
    health_ok=1
    break
  fi
  echo "LOCAL_HEALTH_RETRY $health_try/$health_attempts"
  health_try=$((health_try + 1))
  [ "$health_try" -le "$health_attempts" ] && sleep "$health_delay"
done
[ "$health_ok" = "1" ] || fail "health check failed after $health_attempts attempts: $HEALTH_URL"

say "90%" "Synthetic feature verification"
if [ -n "${FAST_CORE_VERIFY_CMD:-}" ]; then
  sh -c "$FAST_CORE_VERIFY_CMD" || fail "synthetic verification failed"
else
  echo "WARNING: FAST_CORE_VERIFY_CMD not set; feature verification skipped"
fi

say "96%" "Optional public verification"
if [ -n "${FAST_CORE_PUBLIC_VERIFY_CMD:-}" ]; then
  public_attempts="${FAST_CORE_PUBLIC_VERIFY_ATTEMPTS:-12}"
  public_delay="${FAST_CORE_PUBLIC_VERIFY_DELAY:-5}"
  public_try=1
  public_ok=0
  while [ "$public_try" -le "$public_attempts" ]; do
    if sh -c "$FAST_CORE_PUBLIC_VERIFY_CMD"; then
      public_ok=1
      break
    fi
    echo "PUBLIC_VERIFY_RETRY $public_try/$public_attempts"
    public_try=$((public_try + 1))
    [ "$public_try" -le "$public_attempts" ] && sleep "$public_delay"
  done
  [ "$public_ok" = "1" ] || fail "public verification failed after $public_attempts attempts"
fi

trap - HUP INT TERM
say "100%" "Fast Core rollout verified"
echo "SOURCE CHECK       PASS"
echo "FILE INJECT        PASS"
echo "CORE RESTART       PASS"
echo "LOCAL HEALTH       PASS"
if [ -n "${FAST_CORE_VERIFY_CMD:-}" ]; then echo "FEATURE TEST       PASS"; else echo "FEATURE TEST       SKIPPED"; fi
if [ -n "${FAST_CORE_PUBLIC_VERIFY_CMD:-}" ]; then echo "PUBLIC CHECK       PASS"; fi
echo "ROLLBACK BACKUP    $BACKUP_DIR"
