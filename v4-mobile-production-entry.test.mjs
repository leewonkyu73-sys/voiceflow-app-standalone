import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const entry=await fs.readFile(new URL('./public/meeting-auto-dispatch-v361.js',import.meta.url),'utf8');
const e2e=await fs.readFile(new URL('./tests/e2e-meeting.mjs',import.meta.url),'utf8');
const deploy=await fs.readFile(new URL('./deploy/complete-to-100-v262.sh',import.meta.url),'utf8');
const mobileHtml=await fs.readFile(new URL('./frontend-v4/apps/mobile-pwa/index.html',import.meta.url),'utf8');
const serverSttPatch=await fs.readFile(new URL('./scripts/patch-mobile-stt-ownership-v366.mjs',import.meta.url),'utf8');

assert.doesNotMatch(entry,/shouldAutoOpenV4MobileRoot/);
assert.doesNotMatch(entry,/autoOpenV4MobileRoot/);
assert.doesNotMatch(entry,/pwaVoiceStartRequested/);
assert.doesNotMatch(entry,/\/v4\/mobile\?meeting=/);
assert.match(entry,/window\.fetch=async/);
assert.match(entry,/function sourceRows\(\)/);
assert.match(e2e,/Android root keeps PC-style home and starts server-capable room/);
assert.match(e2e,/installed PWA keeps PC-style home and starts server-capable room/);
assert.match(e2e,/#quickAudioStart/);
assert.match(e2e,/#stopCapture/);
assert.match(e2e,/startMicrophone','stopMicrophone','startSpeech','finishSpeech/);
assert.match(serverSttPatch,/function startServerSpeechFallback\(\)/);
assert.match(serverSttPatch,/\/transcribe/);
assert.match(serverSttPatch,/await postCaption\(text,'server'\)/);
assert.match(mobileHtml,/data-v4-pwa-boundary="full-shell-v1"/);
assert.match(deploy,/classic mobile entry regression/);
assert.match(deploy,/live STT Provider unavailable/);

console.log('VOICEFLOW_CLASSIC_MOBILE_SERVER_STT_ENTRY_PASS');
