#!/usr/bin/env sh
set -eu

ACTION=${1:-apply}
RUN_ID=${RUN_ID:-manual}
GUARD=/usr/local/sbin/star45-voice-private-port-guard
SERVICE=/etc/systemd/system/star45-voice-private-port-guard.service
BACKUP=/opt/star45/quarantine/voice-port-isolation-$RUN_ID
PORTS='3005 3006'
APPLIED=0

case "$RUN_ID" in ''|*[!A-Za-z0-9_-]*) echo 'unsafe RUN_ID'; exit 1 ;; esac

remove_rules() {
  for bin in iptables ip6tables; do
    command -v "$bin" >/dev/null 2>&1 || continue
    for port in $PORTS; do
      comment="STAR45-voice-private-$port"
      while "$bin" -C INPUT ! -i lo -p tcp --dport "$port" -m comment --comment "$comment" -j REJECT 2>/dev/null; do
        "$bin" -D INPUT ! -i lo -p tcp --dport "$port" -m comment --comment "$comment" -j REJECT || break
      done
    done
  done
}

restore_previous_files() {
  if [ -f "$BACKUP/had-guard" ]; then
    cp -a "$BACKUP/guard.previous" "$GUARD"
  else
    rm -f "$GUARD"
  fi
  if [ -f "$BACKUP/had-service" ]; then
    cp -a "$BACKUP/service.previous" "$SERVICE"
  else
    rm -f "$SERVICE"
  fi
  systemctl daemon-reload
  if [ -f "$BACKUP/service-was-enabled" ]; then
    systemctl enable star45-voice-private-port-guard.service >/dev/null 2>&1 || true
  fi
  if [ -f "$BACKUP/service-was-active" ]; then
    systemctl start star45-voice-private-port-guard.service >/dev/null 2>&1 || true
  fi
}

rollback() {
  systemctl disable --now star45-voice-private-port-guard.service >/dev/null 2>&1 || true
  if [ -x "$GUARD" ]; then
    "$GUARD" remove >/dev/null 2>&1 || true
  fi
  remove_rules
  restore_previous_files
  echo "PORT_GUARD_ROLLBACK=PASS BACKUP=$BACKUP"
}

if [ "$ACTION" = rollback ]; then
  test -d "$BACKUP" || { echo "rollback backup missing: $BACKUP"; exit 1; }
  rollback
  exit 0
fi

finish() {
  code=$?
  trap - EXIT HUP INT TERM
  if [ "$code" -ne 0 ] && [ "$APPLIED" -eq 1 ]; then
    echo 'PORT_GUARD_APPLY_FAILED; rolling back.'
    rollback || true
  fi
  exit "$code"
}
trap finish EXIT HUP INT TERM

echo '=== 1. PRECHECK ==='
command -v iptables >/dev/null
command -v ip6tables >/dev/null
command -v systemctl >/dev/null
test "$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:3005/api/health)" = 200
test "$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:3006/api/health)" = 200
test "$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' https://voice.star45.net/api/health)" = 200
VOICE_PID=$(pm2 pid voice 2>/dev/null | head -1)
DO_PID=$(pm2 pid do 2>/dev/null | head -1)
test -n "$VOICE_PID"
test -n "$DO_PID"

echo '=== 2. BACKUP CURRENT FIREWALL GUARD STATE ==='
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
iptables-save > "$BACKUP/iptables.before"
ip6tables-save > "$BACKUP/ip6tables.before"
if [ -e "$GUARD" ]; then cp -a "$GUARD" "$BACKUP/guard.previous"; touch "$BACKUP/had-guard"; fi
if [ -e "$SERVICE" ]; then cp -a "$SERVICE" "$BACKUP/service.previous"; touch "$BACKUP/had-service"; fi
if systemctl is-enabled star45-voice-private-port-guard.service >/dev/null 2>&1; then touch "$BACKUP/service-was-enabled"; fi
if systemctl is-active star45-voice-private-port-guard.service >/dev/null 2>&1; then touch "$BACKUP/service-was-active"; fi
printf 'run_id=%s\nvoice_pid=%s\ndo_pid=%s\nports=%s\n' "$RUN_ID" "$VOICE_PID" "$DO_PID" "$PORTS" > "$BACKUP/README.txt"

echo '=== 3. INSTALL IDEMPOTENT RULE HELPER ==='
cat > "$GUARD.new-$RUN_ID" <<'GUARD_SCRIPT'
#!/usr/bin/env sh
set -eu
ACTION=${1:-apply}
PORTS='3005 3006'
for bin in iptables ip6tables; do
  command -v "$bin" >/dev/null 2>&1 || continue
  for port in $PORTS; do
    comment="STAR45-voice-private-$port"
    if [ "$ACTION" = apply ]; then
      "$bin" -C INPUT ! -i lo -p tcp --dport "$port" -m comment --comment "$comment" -j REJECT 2>/dev/null || \
        "$bin" -I INPUT 1 ! -i lo -p tcp --dport "$port" -m comment --comment "$comment" -j REJECT
    elif [ "$ACTION" = remove ]; then
      while "$bin" -C INPUT ! -i lo -p tcp --dport "$port" -m comment --comment "$comment" -j REJECT 2>/dev/null; do
        "$bin" -D INPUT ! -i lo -p tcp --dport "$port" -m comment --comment "$comment" -j REJECT || break
      done
    else
      echo "unsupported action: $ACTION" >&2
      exit 2
    fi
  done
done
GUARD_SCRIPT
chmod 700 "$GUARD.new-$RUN_ID"
mv -f "$GUARD.new-$RUN_ID" "$GUARD"

cat > "$SERVICE.new-$RUN_ID" <<'SERVICE_UNIT'
[Unit]
Description=STAR45 Voice internal app port isolation
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/star45-voice-private-port-guard apply
ExecStop=/usr/local/sbin/star45-voice-private-port-guard remove
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
SERVICE_UNIT
chmod 644 "$SERVICE.new-$RUN_ID"
mv -f "$SERVICE.new-$RUN_ID" "$SERVICE"

APPLIED=1
systemctl daemon-reload
systemctl enable --now star45-voice-private-port-guard.service

echo '=== 4. VERIFY RULES AND INTERNAL AVAILABILITY ==='
test "$(systemctl is-enabled star45-voice-private-port-guard.service)" = enabled
test "$(systemctl is-active star45-voice-private-port-guard.service)" = active
for bin in iptables ip6tables; do
  for port in $PORTS; do
    comment="STAR45-voice-private-$port"
    "$bin" -C INPUT ! -i lo -p tcp --dport "$port" -m comment --comment "$comment" -j REJECT
  done
done
test "$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:3005/api/health)" = 200
test "$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:3006/api/health)" = 200
ROOT_CODE=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' https://voice.star45.net/)
HEALTH_CODE=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' https://voice.star45.net/api/health)
APP=/tmp/voice-private-port-app-$RUN_ID
APP_CODE=$(curl -sS --max-time 10 -H 'Cache-Control: no-cache' -o "$APP" -w '%{http_code}' "https://voice.star45.net/app.js?ts=$RUN_ID")
APP_HASH=$(sha256sum "$APP" | awk '{print $1}')
rm -f "$APP"
test "$ROOT_CODE" = 200
test "$HEALTH_CODE" = 200
test "$APP_CODE" = 200
test "$APP_HASH" = ce08604d3b31af087bd9054768e44e38291b584a27434872aa346e35c2f4ec04
test "$(pm2 pid voice 2>/dev/null | head -1)" = "$VOICE_PID"
test "$(pm2 pid do 2>/dev/null | head -1)" = "$DO_PID"
nginx -t
iptables-save > "$BACKUP/iptables.after"
ip6tables-save > "$BACKUP/ip6tables.after"
printf 'status=LOCAL_PASS\nroot_code=%s\nhealth_code=%s\napp_hash=%s\n' "$ROOT_CODE" "$HEALTH_CODE" "$APP_HASH" >> "$BACKUP/README.txt"
APPLIED=0
trap - EXIT HUP INT TERM
echo 'PORT_GUARD_LOCAL=PASS'
echo 'LOOPBACK_3005=PASS'
echo 'LOOPBACK_3006=PASS'
echo 'VOICE_DOMAIN=PASS'
echo 'PROCESS_RESTART=NONE'
echo "BACKUP=$BACKUP"
