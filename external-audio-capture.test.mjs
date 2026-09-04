import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const admin=await fs.readFile(new URL('./scripts/patch-admin-drive-v262.mjs',import.meta.url),'utf8');
const index=await fs.readFile(new URL('./public/index.html',import.meta.url),'utf8');
const ci=await fs.readFile(new URL('./.github/workflows/ci.yml',import.meta.url),'utf8');
const deploy=await fs.readFile(new URL('./deploy/complete-to-100-v262.sh',import.meta.url),'utf8');

assert.doesNotMatch(admin,/patch-external-audio-v363\.mjs/);
assert.doesNotMatch(index,/external-audio-capture-v363\.css/);
assert.match(ci,/! grep -q 'id="externalAudioStart"' public\/app\.js/);
assert.match(ci,/! grep -q 'id="externalAudioToggle"' public\/app\.js/);
assert.match(ci,/! grep -q "postCaption\(text,'external-audio'\)" public\/app\.js/);
assert.match(deploy,/external audio action returned after rollback/);
assert.match(deploy,/const APP_VERSION='3\.5\.21'/);
console.log('VoiceFlow pre-external-audio rollback contract passed');
