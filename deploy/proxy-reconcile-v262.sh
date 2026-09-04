#!/usr/bin/env sh
set -eu
cd /opt/star45/voiceflow-smart-workspace

DOMAIN=${VOICEFLOW_PUBLIC_DOMAIN:-voice.star45.net}
EDGE=voiceflow-public-edge-v262
EDGE_NET=voiceflow-edge-net
CONF_DIR=/opt/star45/voiceflow-data/public-edge
CONF_FILE=$CONF_DIR/nginx.conf
mkdir -p "$CONF_DIR"

say(){ printf '\n%s\n' "$1"; }
fail(){ echo "FAIL: $1"; exit 1; }

say "[PROXY] verify local gateway"
curl -fsS http://127.0.0.1:4173/api/health >/dev/null || fail 'local gateway 4173 unavailable'

say "[PROXY] detect Traefik"
TRAEFIK=$(docker ps --format '{{.ID}} {{.Names}} {{.Image}}' | awk 'tolower($0) ~ /traefik/ {print $1; exit}')
[ -n "$TRAEFIK" ] || fail 'Traefik container not detected; do not modify public proxy blindly'
TNAME=$(docker inspect -f '{{.Name}}' "$TRAEFIK" | sed 's#^/##')
TMODE=$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$TRAEFIK")
echo "Traefik: $TNAME ($TRAEFIK) network_mode=$TMODE"

# If Traefik is on a normal bridge/overlay network, sharing that network is ideal.
# If Traefik runs in host mode, it can directly reach Docker bridge container IPs,
# so use a dedicated edge bridge network instead of failing.
NET=$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$TRAEFIK" | awk '$1!="host" && $1!="none" {print $1; exit}')
if [ -z "$NET" ]; then
  if [ "$TMODE" = "host" ]; then
    docker network inspect "$EDGE_NET" >/dev/null 2>&1 || docker network create --driver bridge "$EDGE_NET" >/dev/null
    NET="$EDGE_NET"
    echo "Traefik host-network detected; using dedicated edge network: $NET"
  else
    fail 'Traefik has no usable network and is not in host mode'
  fi
else
  echo "Traefik shared network: $NET"
fi

# Reuse current Traefik router conventions.
ENTRYPOINT=$(docker inspect $(docker ps -q) -f '{{range $k,$v := .Config.Labels}}{{printf "%s=%s\n" $k $v}}{{end}}' 2>/dev/null | awk -F= '/traefik\.http\.routers\..*\.entrypoints=/ {if($2 ~ /websecure|https/) {print $2; exit}}')
[ -n "$ENTRYPOINT" ] || ENTRYPOINT=websecure
RESOLVER=$(docker inspect $(docker ps -q) -f '{{range $k,$v := .Config.Labels}}{{printf "%s=%s\n" $k $v}}{{end}}' 2>/dev/null | awk -F= '/traefik\.http\.routers\..*\.tls\.certresolver=/ {print $2; exit}')
echo "Entrypoint: $ENTRYPOINT"
[ -n "$RESOLVER" ] && echo "Cert resolver: $RESOLVER" || echo "Cert resolver: default Traefik TLS"

cat > "$CONF_FILE" <<'EOF'
events {}
http {
  server {
    listen 80;
    server_name _;
    location / {
      proxy_pass http://host.docker.internal:4173;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 300s;
    }
  }
}
EOF

docker rm -f "$EDGE" >/dev/null 2>&1 || true

say "[PROXY] create public edge"
set -- docker run -d --name "$EDGE" --restart unless-stopped \
  --network "$NET" \
  --add-host host.docker.internal:host-gateway \
  -v "$CONF_FILE:/etc/nginx/nginx.conf:ro" \
  --label traefik.enable=true \
  --label "traefik.http.routers.voiceflow-v262.rule=Host(\`${DOMAIN}\`)" \
  --label "traefik.http.routers.voiceflow-v262.entrypoints=${ENTRYPOINT}" \
  --label "traefik.http.routers.voiceflow-v262.tls=true" \
  --label "traefik.http.services.voiceflow-v262.loadbalancer.server.port=80"
if [ -n "$RESOLVER" ]; then
  set -- "$@" --label "traefik.http.routers.voiceflow-v262.tls.certresolver=${RESOLVER}"
fi
set -- "$@" nginx:1.27-alpine
"$@" >/dev/null

# Verify the edge itself can reach the host-network Gateway before waiting on public DNS/TLS.
sleep 2
docker exec "$EDGE" wget -qO- http://host.docker.internal:4173/version.json | grep -q '2.6.2' || {
  docker logs --tail=100 "$EDGE" 2>&1 || true
  fail 'edge container cannot reach host gateway 4173'
}

say "[PROXY] wait for public HTTPS route"
i=0
while [ "$i" -lt 45 ]; do
  if curl -fsS --max-time 5 -H 'Cache-Control: no-cache' "https://${DOMAIN}/version.json?cb=$(date +%s)" | grep -q '2.6.2'; then
    echo "PUBLIC ROUTE READY: https://${DOMAIN}"
    exit 0
  fi
  i=$((i+1))
  sleep 2
done

echo "Traefik edge logs:"
docker logs --tail=120 "$EDGE" 2>&1 || true
echo "Edge inspect:"
docker inspect -f 'name={{.Name}} network={{.HostConfig.NetworkMode}} ip={{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}} labels={{json .Config.Labels}}' "$EDGE" || true
echo "Traefik logs (recent):"
docker logs --tail=160 "$TRAEFIK" 2>&1 || true
echo "Public headers:"
curl -ksSI "https://${DOMAIN}/version.json" || true
fail 'public route did not become ready'
