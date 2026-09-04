import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const patch=await fs.readFile(new URL('./scripts/patch-voiceflow-planned-v314.mjs',import.meta.url),'utf8');
const server=await fs.readFile(new URL('./server-v2.mjs',import.meta.url),'utf8');
const scrollPatch=await fs.readFile(new URL('./scripts/patch-chat-scroll-v348.mjs',import.meta.url),'utf8');
const mobileCss=await fs.readFile(new URL('./public/voiceflow-mobile-room-v354.css',import.meta.url),'utf8');

assert.match(server,/type:'participant-joined'/);
assert.match(patch,/s\.type==='participant-joined'/);
assert.match(patch,/state\.meeting\.participants=\[\.\.\.\(state\.meeting\.participants\|\|\[\]\)\.filter/);
assert.match(patch,/const fresh=await api\('\/api\/v1\/meetings\/'/);
assert.match(patch,/await startRtcOfferV343\(s\.from\)/);
assert.match(patch,/pc\.ontrack=/);
console.log('VoiceFlow mobile participant video sync contract passed');
