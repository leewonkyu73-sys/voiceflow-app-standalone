#!/usr/bin/env sh
set -eu

repo=${VOICEFLOW_REPO_DIR:-/opt/star45/voiceflow-smart-workspace}
env_file=${VOICEFLOW_ENV_FILE:-$repo/.env}
data_dir=${VOICEFLOW_DATA_DIR:-/opt/star45/voiceflow-data}
base_url=${VOICEFLOW_CONNECTOR_URL:-http://127.0.0.1:4178}
expected_sha=${EXPECTED_APPROVED_SHA:-}

fail(){ printf 'E2E_FAIL %s\n' "$1"; exit 1; }

env_value(){
  node -e "const fs=require('fs');const [f,k]=process.argv.slice(1);let v='';try{for(const line of fs.readFileSync(f,'utf8').split(/\\r?\\n/)){if(line.startsWith(k+'='))v=line.slice(k.length+1).trim().replace(/^['\\\"]|['\\\"]$/g,'')}}catch{}process.stdout.write(v)" "$env_file" "$1"
}

bridge_dir=${HERMES_HOST_BRIDGE_DIR:-$(env_value HERMES_HOST_BRIDGE_DIR)}
vault_dir=${OBSIDIAN_HOST_PATH:-$(env_value OBSIDIAN_HOST_PATH)}
bridge_dir=${bridge_dir:-/opt/star45/hermes-bridge}
vault_dir=${vault_dir:-/opt/star45/obsidian-vault}

[ -s "$data_dir/users.json" ] || fail 'auth-users-missing'
[ -s "$data_dir/sessions.json" ] || fail 'auth-sessions-missing'
[ -d "$bridge_dir" ] || fail 'hermes-bridge-missing'
[ -d "$vault_dir" ] || fail 'obsidian-vault-missing'

session_id=$(DATA_DIR="$data_dir" node --input-type=module <<'NODE'
import fs from 'node:fs';
const dir=process.env.DATA_DIR;
const users=JSON.parse(fs.readFileSync(`${dir}/users.json`,'utf8'));
const sessions=JSON.parse(fs.readFileSync(`${dir}/sessions.json`,'utf8'));
const activeAdmins=new Set(users.filter(x=>x.role==='admin'&&x.status==='active'&&!x.deleted_at).map(x=>x.id));
const session=sessions
  .filter(x=>activeAdmins.has(x.user_id)&&Date.parse(x.expires_at)>Date.now())
  .sort((a,b)=>Date.parse(b.expires_at)-Date.parse(a.expires_at))[0];
if(!session)process.exit(2);
process.stdout.write(session.id);
NODE
) || fail 'active-admin-session-missing'

health=$(curl -fsS --max-time 5 "$base_url/health") || fail 'connector-health-unreachable'
approved_sha=$(printf '%s' "$health" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s),x=d.hermes?.skill_distribution||{};if(!x.enabled||!x.configured||!/^[0-9a-f]{40}$/i.test(x.approved_commit_sha||''))process.exit(2);if(!d.obsidian?.configured)process.exit(3);process.stdout.write(x.approved_commit_sha)})") || fail 'connector-not-ready'
[ -z "$expected_sha" ] || [ "$approved_sha" = "$expected_sha" ] || fail 'approved-sha-mismatch'

marker="skill-e2e-${approved_sha%????????????????????????????????}-$(date +%s)"
job_payload=$(MARKER="$marker" APPROVED_SHA="$approved_sha" node -e "process.stdout.write(JSON.stringify({type:'skill-distribution-e2e',instruction:'Verify approved STAR45 skill queue and preserve this request as E2E evidence: '+process.env.MARKER,context:{verification_marker:process.env.MARKER,expected_consumer:'Hermes file queue worker'},skill:{name:'star45-skill-distribution',commit_sha:process.env.APPROVED_SHA}}))")
job_response=$(curl -fsS --max-time 10 -H "Cookie: voiceflow_session=$session_id" -H 'Content-Type: application/json' -X POST "$base_url/api/v1/hermes/jobs" --data-binary "$job_payload") || fail 'hermes-api-create-failed'
job_id=$(printf '%s' "$job_response" | APPROVED_SHA="$approved_sha" node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s),x=d.data||{},k=x.skill_snapshot||{};if(!d.ok||!/^hrm_/.test(x.job_id||'')||x.status!=='pending'||k.name!=='star45-skill-distribution'||k.commit_sha!==process.env.APPROVED_SHA||!/^[0-9a-f]{64}$/.test(k.sha256||''))process.exit(2);process.stdout.write(x.job_id)})") || fail 'hermes-api-response-invalid'
printf 'HERMES_QUEUE_PASS job_id=%s\n' "$job_id"

job_state=pending
jobs_response=''
attempt=0
while [ "$attempt" -lt 30 ]; do
  attempt=$((attempt+1))
  jobs_response=$(curl -fsS --max-time 10 -H "Cookie: voiceflow_session=$session_id" "$base_url/api/v1/hermes/jobs") || fail 'hermes-api-read-failed'
  job_state=$(printf '%s' "$jobs_response" | JOB_ID="$job_id" node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s),x=Array.isArray(d.data)&&d.data.find(v=>v.job_id===process.env.JOB_ID);if(!d.ok||!x)process.exit(2);process.stdout.write(String(x.status||''))})") || fail 'hermes-job-not-persisted'
  [ "$job_state" = completed ] && break
  [ "$job_state" = failed ] && fail 'hermes-worker-failed'
  sleep 2
done
[ "$job_state" = completed ] || fail 'hermes-worker-timeout'

note_file=$(printf '%s' "$jobs_response" | JOB_ID="$job_id" APPROVED_SHA="$approved_sha" MARKER="$marker" node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s),x=d.data.find(v=>v.job_id===process.env.JOB_ID),r=x?.worker_result||{},k=r.skill||{},t=(x?.transitions||[]).map(v=>v.status).join(',');if(x?.status!=='completed'||r.handler!=='skill-distribution-e2e-v1'||r.acknowledged!==true||r.verification_marker!==process.env.MARKER||k.commit_sha!==process.env.APPROVED_SHA||t!=='pending,processing,completed'||x.result_file!==('results/'+process.env.JOB_ID+'.result.json')||!x.obsidian_file)process.exit(2);process.stdout.write(x.obsidian_file)})") || fail 'hermes-api-result-invalid'

case "$note_file" in
  /*|*..*) fail 'obsidian-file-path-invalid' ;;
esac
result_file="$bridge_dir/results/$job_id.result.json"
archive_file="$bridge_dir/archive/$job_id.json"
[ -s "$result_file" ] || fail 'hermes-result-file-missing'
[ -s "$archive_file" ] || fail 'hermes-archive-file-missing'
RESULT_FILE="$result_file" JOB_ID="$job_id" APPROVED_SHA="$approved_sha" MARKER="$marker" node -e "const fs=require('fs'),x=JSON.parse(fs.readFileSync(process.env.RESULT_FILE,'utf8')),r=x.result||{},k=r.skill||{};if(x.job_id!==process.env.JOB_ID||x.status!=='completed'||r.handler!=='skill-distribution-e2e-v1'||r.verification_marker!==process.env.MARKER||k.commit_sha!==process.env.APPROVED_SHA||(x.transitions||[]).map(v=>v.status).join(',')!=='pending,processing,completed')process.exit(2)" || fail 'hermes-result-file-invalid'
printf 'HERMES_PROCESSING_PASS result=%s\n' "results/$job_id.result.json"

host_note="$vault_dir/$note_file"
[ -s "$host_note" ] || fail 'obsidian-host-file-missing'
grep -Fq "$marker" "$host_note" || fail 'obsidian-host-content-missing'
grep -Fq "$job_id" "$host_note" || fail 'obsidian-host-job-link-missing'
printf 'OBSIDIAN_WRITE_PASS file=%s\n' "$note_file"

search_payload=$(MARKER="$marker" node -e "process.stdout.write(JSON.stringify({query:process.env.MARKER}))")
search_response=$(curl -fsS --max-time 10 -H "Cookie: voiceflow_session=$session_id" -H 'Content-Type: application/json' -X POST "$base_url/api/v1/obsidian/search" --data-binary "$search_payload") || fail 'obsidian-search-failed'
printf '%s' "$search_response" | NOTE_FILE="$note_file" node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const d=JSON.parse(s);if(!d.ok||!Array.isArray(d.data)||!d.data.some(x=>x.file===process.env.NOTE_FILE))process.exit(2)})" || fail 'obsidian-search-evidence-missing'

JOB_ID="$job_id" NOTE_FILE="$note_file" APPROVED_SHA="$approved_sha" MARKER="$marker" node -e "console.log(JSON.stringify({status:'E2E_PASS',approved_sha:process.env.APPROVED_SHA,hermes:{queued:true,processing:true,completed:true,result_file:'results/'+process.env.JOB_ID+'.result.json',job_id:process.env.JOB_ID},obsidian:{written:true,searchable:true,file:process.env.NOTE_FILE},marker:process.env.MARKER},null,2))"
