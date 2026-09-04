import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const baseline=JSON.parse(await fs.readFile(new URL('../baselines/v3.5.24-artifacts.json',import.meta.url),'utf8'));
const repositoryRoot=new URL('../../',import.meta.url);
for(const [relative,expected] of Object.entries(baseline.sha256)){
  const bytes=await fs.readFile(new URL(relative,repositoryRoot));
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(actual,expected,relative+' changed from frozen v3.5.24 operating artifact');
}

console.log('VOICEFLOW_V3_5_24_ARTIFACTS_UNCHANGED');
