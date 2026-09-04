import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const runtime=await fs.readFile(new URL('./scripts/patch-runtime-guards-v262.mjs',import.meta.url),'utf8');
const deploy=await fs.readFile(new URL('./deploy/complete-to-100-v262.sh',import.meta.url),'utf8');
const marker=runtime.match(/__VOICEFLOW_RUNTIME_GUARD__='([^']+)'/)?.[1];
assert.ok(marker,'runtime guard marker missing');
assert.ok(deploy.includes(marker),'deploy script must validate the current runtime guard');
assert.doesNotMatch(deploy,/runtime guard r3/);
assert.match(deploy,/VOICEFLOW_DEPLOY_REFRESHED/);
const workflow=await fs.readFile(new URL('./.github/workflows/ci.yml',import.meta.url),'utf8');
assert.match(workflow,/test:\n    runs-on: ubuntu-latest/);
assert.match(workflow,/if: github\.event_name == 'workflow_dispatch' && inputs\.run_vps_docker == true && inputs\.deploy_production == true/);
assert.doesNotMatch(workflow,/if: github\.event_name == 'push' && contains\(github\.event\.head_commit\.message, '\[deploy-production\]'\)/);
assert.match(workflow,/prepare-ui-artifact:/);
assert.match(workflow,/deploy-ui:/);
assert.match(workflow,/\[v4-mobile-server-stt\]/);
assert.match(workflow,/VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED:/);
assert.match(workflow,/needs: docker/);
assert.match(workflow,/VOICEFLOW_DEPLOY_REFRESHED=1 sh deploy\/complete-to-100-v262\.sh/);
assert.match(deploy,/voiceflow-runtime-public/);
assert.match(deploy,/external audio action returned after rollback/);
assert.match(deploy,/voiceflow-ai-v26/);
assert.match(deploy,/voiceflow-admin-integrations-v26/);
assert.match(deploy,/INTEGRATION_SECRET_KEY OPENAI_API_KEY/);
assert.match(deploy,/DEEPL_API_KEY DEEPL_API_URL/);
assert.match(deploy,/docker inspect --format/);
assert.match(deploy,/unset PROVIDER_VALUE/);
assert.match(deploy,/resolve-existing-deepl\.mjs --emit/);
assert.match(deploy,/unset EXISTING_DEEPL_KEY/);
assert.match(deploy,/Existing VoiceFlow DeepL Secret recovered/);
assert.match(deploy,/VOICEFLOW_DEPLOY_REQUESTED_LOCAL_STT=\$\{LOCAL_STT_ENABLED:-0\}/);
assert.match(deploy,/export LOCAL_STT_ENABLED="\$VOICEFLOW_DEPLOY_REQUESTED_LOCAL_STT"/);
assert.match(deploy,/Local STT VAD preflight deferred until sidecar reconcile/);
assert.ok(
  deploy.includes("docker inspect voiceflow-local-stt --format '{{json .Config.Cmd}}' 2>/dev/null | grep -q -- '--vad-model' && curl -fsS http://127.0.0.1:4186/ >/dev/null 2>&1"),
  'preflight must not probe an old local STT sidecar without the VAD model'
);
assert.match(deploy,/INTEGRATION_DATA_DIR=\/opt\/star45\/voiceflow-data node scripts\/verify-live-stt-provider\.mjs/);
assert.match(deploy,/reconciled local STT speech probe failed/);
assert.match(deploy,/core local STT exclusive flag missing/);
assert.ok(
  deploy.indexOf("curl -fsS http://127.0.0.1:4186/ >/dev/null || fail 'local STT service unavailable'")<
  deploy.indexOf("reconciled local STT speech probe failed"),
  'reconciled local STT must be healthy before the positive speech probe'
);
assert.match(deploy,/node services\/integration-env-launcher\.mjs \.\.\/scripts\/verify-live-stt-provider\.mjs/);
assert.ok(
  deploy.indexOf('VOICEFLOW_DEPLOY_REQUESTED_LOCAL_STT=')<deploy.indexOf('. ./.env')&&
  deploy.indexOf('export LOCAL_STT_ENABLED=')>deploy.indexOf('. ./.env'),
  'workflow local STT intent must survive .env sourcing'
);
assert.ok(deploy.indexOf('verify-live-stt-provider.mjs')<deploy.indexOf('Build exact production frontend artifact once'),'live STT probe must run before production artifact replacement');
assert.doesNotMatch(deploy,/star45-deployment-center/);
assert.doesNotMatch(deploy,/set -x/);
assert.ok(
  deploy.indexOf('Restore the actual Golden provider handoff')<
  deploy.indexOf('verify-live-translation-provider.mjs'),
  'Golden provider handoff must run before the live translation gate'
);
const providers=await fs.readFile(new URL('./lib/provider-adapters.mjs',import.meta.url),'utf8');
const compose=await fs.readFile(new URL('./deploy/docker-compose.v23.yml',import.meta.url),'utf8');
assert.match(providers,/p==='local'&&process\.env\.LOCAL_STT_EXCLUSIVE==='1'/);
assert.match(compose,/LOCAL_STT_EXCLUSIVE: '1'/);
const liveSttProbe=await fs.readFile(new URL('./scripts/verify-live-stt-provider.mjs',import.meta.url),'utf8');
assert.match(liveSttProbe,/process\.env\.LOCAL_STT_ENABLED==='1'\?\['local-whisper'\]:\['openai','gemini'\]/);
assert.match(liveSttProbe,/if\(!text\)throw new Error\('stt_probe_transcript_empty'\)/);
const gateway=await fs.readFile(new URL('./deploy/gateway.mjs',import.meta.url),'utf8');
assert.match(gateway,/identityPort}\/health/);
assert.doesNotMatch(gateway,/identityPort}\/api\/health/);
console.log('VoiceFlow deploy/runtime guard contract passed:',marker);
