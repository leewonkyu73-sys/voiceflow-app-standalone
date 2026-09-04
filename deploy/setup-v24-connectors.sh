#!/usr/bin/env sh
set -eu

ROOT=/opt/star45/voiceflow-smart-workspace
DATA=/opt/star45/voiceflow-data
VAULT=${OBSIDIAN_HOST_PATH:-/opt/star45/obsidian-vault}
BRIDGE=${HERMES_HOST_BRIDGE_DIR:-/opt/star45/hermes-bridge}
ENV_FILE="$ROOT/.env"

mkdir -p "$DATA" "$VAULT" "$BRIDGE"
mkdir -p "$VAULT/Meetings" "$VAULT/Tasks" "$VAULT/Projects" "$VAULT/SOP" "$VAULT/Research" "$VAULT/AI-Employees" "$VAULT/Company-Knowledge"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/deploy/.env.v24.example" "$ENV_FILE"
  echo "Created $ENV_FILE from template. Fill connector values before deployment."
fi

chmod 700 "$BRIDGE" || true
chmod 755 "$VAULT" || true

printf '%s\n' "Connector directories prepared:" \
  "  data:   $DATA" \
  "  vault:  $VAULT" \
  "  bridge: $BRIDGE" \
  "  env:    $ENV_FILE"

printf '%s\n' "Next:" \
  "  1) edit $ENV_FILE" \
  "  2) cd $ROOT" \
  "  3) docker compose --env-file .env -f deploy/docker-compose.v23.yml up -d --build" \
  "  4) sh deploy/qa-v23.sh"
