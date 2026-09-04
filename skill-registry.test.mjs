import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSkillRegistry,updateSkillDistributionEnv} from './scripts/create-skill-registry.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'star45-registry-test-'));
const skillDir=path.join(root,'skills','example-skill');
await fs.mkdir(skillDir,{recursive:true});
await fs.writeFile(path.join(skillDir,'SKILL.md'),'---\nname: example-skill\ndescription: test\n---\n','utf8');
const commit='ec6d9a01ea3657b5dafaa99c7e3d6ff210ad2bc2';
const output=path.join(root,'data','registry.json');
const registry=await buildSkillRegistry({sourceRoot:path.join(root,'skills'),commitSha:commit,skills:['example-skill'],outputPath:output});
assert.equal(registry.commit_sha,commit);
assert.match(registry.skills['example-skill'].sha256,/^[0-9a-f]{64}$/);
assert.deepEqual(JSON.parse(await fs.readFile(output,'utf8')),registry);

const envFile=path.join(root,'.env');
await fs.writeFile(envFile,'NODE_ENV=production\nUNRELATED=value\nSKILL_DISTRIBUTION_ENABLED=false\n','utf8');
await updateSkillDistributionEnv({envFile,enabled:true,commitSha:commit});
const enabled=await fs.readFile(envFile,'utf8');
assert.match(enabled,/SKILL_DISTRIBUTION_ENABLED=true/);
assert.match(enabled,new RegExp(`SKILL_APPROVED_COMMIT_SHA=${commit}`));
assert.match(enabled,/UNRELATED=value/);
await updateSkillDistributionEnv({envFile,enabled:false});
const disabled=await fs.readFile(envFile,'utf8');
assert.match(disabled,/SKILL_DISTRIBUTION_ENABLED=false/);
assert.match(disabled,/SKILL_APPROVED_COMMIT_SHA=\n/);

await assert.rejects(buildSkillRegistry({sourceRoot:path.join(root,'skills'),commitSha:'bad',skills:['example-skill'],outputPath:output}),/approved_commit_invalid/);
await fs.rm(root,{recursive:true,force:true});
console.log('SKILL_REGISTRY_PASS');
