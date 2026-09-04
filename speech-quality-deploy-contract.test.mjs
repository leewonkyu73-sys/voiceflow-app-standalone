import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [workflow,compose,deploy,e2e]=await Promise.all([
  fs.readFile('.github/workflows/ci.yml','utf8'),
  fs.readFile('deploy/docker-compose.v23.yml','utf8'),
  fs.readFile('deploy/complete-to-100-v262.sh','utf8'),
  fs.readFile('tests/e2e-speech-quality-lab.mjs','utf8'),
]);

assert.match(workflow,/VOICEFLOW_V4_MOBILE_ENABLED: \$\{\{ \(contains\(github\.event\.head_commit\.message, '\[v4-mobile-canary\]'\) \|\| contains\(github\.event\.head_commit\.message, '\[speech-quality-lab\]'\)\) && '1' \|\| '0' \}\}/,'speech quality rollout must preserve the existing Android v4 entry');
assert.match(workflow,/VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED: \$\{\{ contains\(github\.event\.head_commit\.message, '\[speech-quality-lab\]'\) && '1' \|\| '0' \}\}/);
assert.match(workflow,/VOICEFLOW_SPEECH_QUALITY_API_ENABLED: '0'/,'production workflow must keep paid API calls locked');
assert.match(workflow,/speech-quality-browser-e2e:/);
assert.match(workflow,/contains\(github\.event\.pull_request\.title, '\[speech-quality-e2e\]'\)/);
assert.match(compose,/VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED: \$\{VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED:-0\}/);
assert.match(compose,/VOICEFLOW_SPEECH_QUALITY_API_ENABLED: \$\{VOICEFLOW_SPEECH_QUALITY_API_ENABLED:-0\}/);
assert.match(deploy,/VOICEFLOW_DEPLOY_REQUESTED_SPEECH_QUALITY_LAB=/);
assert.match(deploy,/VOICEFLOW_DEPLOY_REQUESTED_SPEECH_QUALITY_API=/);
assert.match(deploy,/VOICEFLOW_SPEECH_QUALITY_API_ENABLED=0/,'live verification must prove the paid API switch is off');
assert.match(deploy,/SPEECH_QUALITY_LAB_URL="https:\/\/voice\.star45\.net\/v4\/speech-quality-lab\/"/);
assert.match(deploy,/node tests\/e2e-speech-quality-lab\.mjs/);
assert.match(e2e,/viewport:\{width:412,height:915\}/);
assert.match(e2e,/anonymous quality lab must not reveal configured providers/);
assert.match(e2e,/private provider API must not enter Cache Storage/);
assert.doesNotMatch(e2e,/auth\/register|account\/delete/,'lab browser E2E must not create or delete production accounts');

console.log('VOICEFLOW_SPEECH_QUALITY_DEPLOY_CONTRACT_PASS');
