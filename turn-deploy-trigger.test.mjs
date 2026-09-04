import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source=await fs.readFile(new URL('./.github/workflows/deploy-webrtc-turn-v343.yml',import.meta.url),'utf8');
const start=source.indexOf('\non:');
const end=source.indexOf('\nconcurrency:');
assert.ok(start>=0&&end>start,'TURN workflow trigger block is missing');
const trigger=source.slice(start,end);

assert.match(trigger,/\n  workflow_dispatch:/,'TURN deployment must keep an explicit manual trigger');
assert.doesNotMatch(trigger,/\n  (?:push|pull_request|schedule|repository_dispatch):/,'TURN deployment must not run from repository events');
assert.match(source,/runs-on: \[self-hosted, voiceflow, vps\]/,'TURN deployment must keep the protected runner labels');
assert.match(source,/sh deploy\/deploy-webrtc-turn-v343\.sh/,'TURN workflow must keep the verified deployment entrypoint');

console.log('VOICEFLOW_TURN_MANUAL_DEPLOY_GUARD_PASS');
