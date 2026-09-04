#!/usr/bin/env sh
set -eu

action=${1:-status}
repo=${VOICEFLOW_REPO_DIR:-/opt/star45/voiceflow-smart-workspace}
env_file=${VOICEFLOW_ENV_FILE:-$repo/.env}
data_dir=${VOICEFLOW_DATA_DIR:-/opt/star45/voiceflow-data}
skills=${SKILL_DISTRIBUTION_SKILLS:-voiceflow-change-ledger,star45-skill-distribution}

fail(){ echo "FAIL: $1"; exit 1; }
[ -d "$repo/.git" ] || fail "VoiceFlow repository not found: $repo"
cd "$repo"

status(){
  curl -fsS --max-time 3 http://127.0.0.1:4178/health | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s),x=d.hermes?.skill_distribution||{};console.log(JSON.stringify(x,null,2));process.exit(x.enabled&&x.configured?0:2)})"
}

wait_status(){
  attempts=${SKILL_HEALTH_ATTEMPTS:-30}
  delay=${SKILL_HEALTH_DELAY_SECONDS:-2}
  index=1
  while [ "$index" -le "$attempts" ]; do
    if output=$(status 2>/dev/null); then
      printf '%s\n' "$output"
      return 0
    fi
    [ "$index" -eq "$attempts" ] || sleep "$delay"
    index=$((index + 1))
  done
  status || true
  return 2
}

case "$action" in
  enable)
    git diff --quiet && git diff --cached --quiet || fail 'working tree is dirty'
    git fetch origin main
    git merge --ff-only origin/main || fail 'main cannot be fast-forwarded safely'
    approved_sha=$(git rev-parse HEAD)
    mkdir -p "$data_dir"
    node scripts/create-skill-registry.mjs \
      --source-root .codex/skills \
      --commit "$approved_sha" \
      --skills "$skills" \
      --output "$data_dir/skill-registry.json" \
      --enable-env "$env_file"
    build_parent=$(mktemp -d /tmp/voiceflow-skill-build.XXXXXX)
    build_dir=$build_parent/worktree
    cleanup_build(){
      if [ -d "$build_dir" ]; then
        git -C "$repo" worktree remove --force "$build_dir" >/dev/null 2>&1 || true
      fi
      rmdir "$build_parent" >/dev/null 2>&1 || true
    }
    trap cleanup_build EXIT HUP INT TERM
    git worktree add --detach "$build_dir" "$approved_sha"
    (
      cd "$build_dir"
      node scripts/patch-admin-drive-v262.mjs
      node --check public/app.js
      node scripts/verify-ui-bindings-v261.mjs
      docker build -f deploy/Dockerfile.v2 -t voiceflow-smart-workspace:v2.6 .
    )
    cleanup_build
    trap - EXIT HUP INT TERM
    docker compose --env-file "$env_file" -f deploy/docker-compose.v23.yml up -d --force-recreate voiceflow-connectors
    wait_status || fail 'connector started but approved skill distribution is not configured'
    echo "SKILL_DISTRIBUTION_ENABLE_PASS commit=$approved_sha"
    ;;
  disable)
    node scripts/create-skill-registry.mjs --disable-env "$env_file"
    docker compose --env-file "$env_file" -f deploy/docker-compose.v23.yml up -d --force-recreate voiceflow-connectors
    echo 'SKILL_DISTRIBUTION_DISABLED'
    ;;
  status) status ;;
  *) fail 'usage: skill-distribution-control.sh enable|disable|status' ;;
esac
