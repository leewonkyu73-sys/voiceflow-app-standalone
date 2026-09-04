#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace
COMPOSE="docker compose --env-file .env -f deploy/docker-compose.v23.yml -f deploy/docker-compose.identity-v268.yml"
PORTS="4173 4175 4176 4177 4178 4179 4180 4181 4182 4183 4184 4185 4186"
KNOWN='server\.mjs|server-v2\.mjs|deploy/gateway\.mjs|board-service\.mjs|task-calendar-service\.mjs|ai-employee-service\.mjs|hermes-obsidian-discord-service\.mjs|meeting-result-drive-service\.mjs|original-media-storage-service\.mjs|identity-organization-service\.mjs|admin-integration-service\.mjs|integration-hub-bridge-service\.mjs|device-nearby-tapjoin-service\.mjs|automation-worker\.mjs|integration-env-launcher\.mjs'
say(){ printf '\n%s\n' "$1"; }
fail(){ echo "FAIL: $1"; exit 1; }
port_lines(){ ss -ltnpH "sport = :$1" 2>/dev/null || true; }
port_pids(){ port_lines "$1" | grep -o 'pid=[0-9][0-9]*' | cut -d= -f2 | sort -u || true; }
cmdline(){ tr '\000' ' ' < "/proc/$1/cmdline" 2>/dev/null || true; }
is_known(){ printf '%s' "$1" | grep -Eq "$KNOWN"; }
docker_id_for_pid(){ pid="$1"; sed -nE 's#.*docker[-/]([0-9a-f]{12,64})(\.scope)?$#\1#p' "/proc/$pid/cgroup" 2>/dev/null | head -1; }
is_voiceflow_container(){ cid="$1"; name=$(docker inspect -f '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##' || true); image=$(docker inspect -f '{{.Config.Image}}' "$cid" 2>/dev/null || true); workdir=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$cid" 2>/dev/null || true); case "$name" in voiceflow-*) return 0;; esac; case "$image" in voiceflow-smart-workspace:*|*voiceflow-smart-workspace*) return 0;; esac; [ "$workdir" = "/opt/star45/voiceflow-smart-workspace" ]; }
remove_voiceflow_container_for_pid(){ pid="$1"; cid=$(docker_id_for_pid "$pid" || true); [ -n "$cid" ] || return 1; if is_voiceflow_container "$cid"; then docker update --restart=no "$cid" >/dev/null 2>&1 || true; docker rm -f "$cid" >/dev/null 2>&1 || true; return 0; fi; return 1; }
say "[RUNTIME] stop current compose stack cleanly"
$COMPOSE down --remove-orphans || true
sleep 2
UNKNOWN=0
for p in $PORTS; do lines=$(port_lines "$p"); [ -z "$lines" ] && continue; echo "PORT $p still occupied:"; echo "$lines"; for pid in $(port_pids "$p"); do cmd=$(cmdline "$pid"); if remove_voiceflow_container_for_pid "$pid"; then continue; fi; if is_known "$cmd"; then kill "$pid" 2>/dev/null || true; else UNKNOWN=1; fi; done; done
sleep 3
for p in $PORTS; do for pid in $(port_pids "$p"); do cmd=$(cmdline "$pid"); if remove_voiceflow_container_for_pid "$pid"; then continue; fi; if is_known "$cmd"; then kill -9 "$pid" 2>/dev/null || true; fi; done; done
sleep 2
for p in $PORTS; do [ -z "$(port_lines "$p")" ] || UNKNOWN=1; done
[ "$UNKNOWN" -eq 0 ] || fail 'reserved VoiceFlow port remains occupied'
say "[RUNTIME] start full production stack"
$COMPOSE up -d --force-recreate --remove-orphans
health_ok(){ curl -fsS --max-time 3 "http://127.0.0.1:$1$2" >/dev/null 2>&1; }
local_stt_ok(){ [ "${LOCAL_STT_ENABLED:-0}" != "1" ] || health_ok 4186 /; }
i=0
while [ "$i" -lt 45 ]; do
  if health_ok 4173 /api/health && health_ok 4175 /health && health_ok 4176 /health && health_ok 4177 /health && health_ok 4178 /health && health_ok 4179 /health && health_ok 4180 /api/health && health_ok 4181 /health && health_ok 4182 /health && health_ok 4183 /health && health_ok 4184 /health && health_ok 4185 /health && local_stt_ok; then echo "ALL RUNTIME HEALTH ENDPOINTS RESPONDING"; $COMPOSE ps; exit 0; fi
  i=$((i+1)); sleep 2
done
$COMPOSE ps || true
$COMPOSE logs --no-color --tail=220 || true
exit 1
