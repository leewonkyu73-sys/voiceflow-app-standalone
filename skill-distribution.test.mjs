import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadApprovedSkill, skillDistributionStatus } from './lib/skill-distribution.mjs';

const commit='07ae8a3ea5f8a1a540c94dd15b16933227c42915';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'star45-skill-test-'));
const skillDir=path.join(root,'voiceflow-change-ledger');
await fs.mkdir(skillDir,{recursive:true});
const content='---\nname: voiceflow-change-ledger\ndescription: test\n---\n\n# Guard\n';
await fs.writeFile(path.join(skillDir,'SKILL.md'),content,'utf8');
const sha256=createHash('sha256').update(content).digest('hex');
const registry=path.join(root,'registry.json');
await fs.writeFile(registry,JSON.stringify({commit_sha:commit,skills:{'voiceflow-change-ledger':{sha256}}}), 'utf8');

assert.deepEqual(skillDistributionStatus({}),{
  enabled:false,
  configured:false,
  reason:'disabled',
});

const env={
  SKILL_DISTRIBUTION_ENABLED:'true',
  SKILL_SOURCE_ROOT:root,
  SKILL_REGISTRY_PATH:registry,
  SKILL_APPROVED_COMMIT_SHA:commit,
};
assert.equal(skillDistributionStatus(env).configured,true);

const snapshot=await loadApprovedSkill({
  name:'voiceflow-change-ledger',
  commit_sha:commit,
},{env});
assert.equal(snapshot.name,'voiceflow-change-ledger');
assert.equal(snapshot.commit_sha,commit);
assert.equal(snapshot.sha256,sha256);
assert.equal(snapshot.content,content);

await assert.rejects(
  loadApprovedSkill({name:'voiceflow-change-ledger',commit_sha:'1'.repeat(40)},{env}),
  /skill_commit_not_approved/,
);
await fs.writeFile(registry,JSON.stringify({commit_sha:commit,skills:{'voiceflow-change-ledger':{sha256:'0'.repeat(64)}}}), 'utf8');
await assert.rejects(
  loadApprovedSkill({name:'voiceflow-change-ledger',commit_sha:commit},{env}),
  /skill_checksum_mismatch/,
);
await assert.rejects(
  loadApprovedSkill({name:'../escape',commit_sha:commit},{env}),
  /skill_name_invalid/,
);

await fs.rm(root,{recursive:true,force:true});
console.log('SKILL_DISTRIBUTION_PASS');
