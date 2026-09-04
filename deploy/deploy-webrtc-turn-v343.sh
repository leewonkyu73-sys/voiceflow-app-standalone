#!/usr/bin/env sh
set -eu

APP_DIR="${VOICEFLOW_APP_DIR:-/opt/star45/voiceflow-smart-workspace}"
TURN_DIR="${VOICEFLOW_TURN_DIR:-/opt/star45/voiceflow-turn}"
DATA_DIR="${VOICEFLOW_DATA_DIR:-/opt/star45/voiceflow-data}"
TURN_PORT=3478
RELAY_MIN=49160
RELAY_MAX=49200
mkdir -p "$TURN_DIR" "$DATA_DIR"
chmod 700 "$TURN_DIR"

SECRET_FILE="$TURN_DIR/shared-secret"
if [ ! -s "$SECRET_FILE" ]; then
  umask 077
  openssl rand -hex 32 > "$SECRET_FILE"
fi
SECRET=$(tr -d '\r\n' < "$SECRET_FILE")
test "${#SECRET}" -ge 32
PUBLIC_IP=$(getent ahostsv4 voice.star45.net | awk 'NR==1{print $1}')
test -n "$PUBLIC_IP"

umask 077
{
  echo "listening-port=$TURN_PORT"
  echo "listening-ip=0.0.0.0"
  echo "relay-ip=0.0.0.0"
  echo "external-ip=$PUBLIC_IP"
  echo "min-port=$RELAY_MIN"
  echo "max-port=$RELAY_MAX"
  echo "realm=voice.star45.net"
  echo "server-name=voice.star45.net"
  echo "fingerprint"
  echo "use-auth-secret"
  printf 'static-auth-secret=%s\n' "$SECRET"
  echo "stale-nonce=600"
  echo "no-cli"
  echo "no-multicast-peers"
  echo "total-quota=100"
  echo "user-quota=12"
  echo "log-file=stdout"
} > "$TURN_DIR/turnserver.conf"
printf '{"secret":"%s","urls":["stun:voice.star45.net:3478","turn:voice.star45.net:3478?transport=udp","turn:voice.star45.net:3478?transport=tcp"],"ttl_seconds":3600}\n' "$SECRET" > "$DATA_DIR/turn-secret.json"
chmod 600 "$TURN_DIR/shared-secret" "$TURN_DIR/turnserver.conf" "$DATA_DIR/turn-secret.json"

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  SUDO=""
  [ "$(id -u)" -eq 0 ] || SUDO="sudo -n"
  $SUDO ufw allow 3478/tcp comment 'VoiceFlow TURN'
  $SUDO ufw allow 3478/udp comment 'VoiceFlow TURN'
  $SUDO ufw allow 49160:49200/tcp comment 'VoiceFlow TURN relay'
  $SUDO ufw allow 49160:49200/udp comment 'VoiceFlow TURN relay'
fi

cd "$APP_DIR"
docker compose -f deploy/docker-compose.turn-v343.yml pull
docker compose -f deploy/docker-compose.turn-v343.yml up -d --force-recreate
docker inspect -f '{{.State.Running}}' voiceflow-turn-v343 | grep -q true
docker logs --tail 80 voiceflow-turn-v343 2>&1 | grep -q 'RFC 5766 message processing engine' || sleep 3

FAST_CORE_VERIFY_CMD="curl -fsSL http://127.0.0.1:4180/api/v1/webrtc/config | grep -q '\"relay_ready\":true'" \
FAST_CORE_PUBLIC_VERIFY_CMD="curl -fsSL https://voice.star45.net/api/v1/webrtc/config | grep -q '\"relay_ready\":true'" \
sh scripts/star45-fast-core-deploy.sh voiceflow-core-v26 http://127.0.0.1:4180/api/health server-v2.mjs

echo "TURN CONTAINER      PASS"
echo "TURN CREDENTIAL API PASS"
echo "FIREWALL PORTS      3478 tcp/udp, 49160-49200 tcp/udp"
