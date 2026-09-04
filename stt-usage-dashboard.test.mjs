import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const patch=await fs.readFile(new URL('./scripts/patch-stt-usage-v364.mjs',import.meta.url),'utf8');
for(const marker of ["'usage'",'recordSttUsage','/api/v1/admin/usage','x-voice-duration-ms','STT 사용시간 · 예상비용','loadSttUsage'])assert.ok(patch.includes(marker),`missing ${marker}`);
assert.match(patch,/role!=='admin'/);
assert.match(patch,/estimated_usd/);
console.log('VoiceFlow STT usage dashboard contract passed');
