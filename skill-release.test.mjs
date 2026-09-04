import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSkillRelease} from './scripts/create-skill-release.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'star45-skill-release-test-'));
const skillDir=path.join(root,'skills','example-skill');
await fs.mkdir(path.join(skillDir,'references'),{recursive:true});
await fs.writeFile(path.join(skillDir,'SKILL.md'),'---\nname: example-skill\ndescription: test\n---\n','utf8');
await fs.writeFile(path.join(skillDir,'references','guide.md'),'guide\n','utf8');
const configPath=path.join(root,'release.json');
await fs.writeFile(configPath,JSON.stringify({
  schema_version:1,
  release_tag:'skills-v1.0.0',
  skills:['example-skill'],
  targets:[
    {repository:'owner/deployment-center',branch:'main',install_root:'skills'},
    {repository:'owner/hermes',branch:'master',install_root:'skills'},
  ],
}), 'utf8');
const outputPath=path.join(root,'dist','manifest.json');
const commit='10f96d57e5bdd1267160e6aca26010b5a219345f';
const first=await buildSkillRelease({sourceRoot:path.join(root,'skills'),commitSha:commit,configPath,outputPath,generatedAt:'2026-08-28T00:00:00.000Z'});
assert.equal(first.release_tag,'skills-v1.0.0');
assert.equal(first.commit_sha,commit);
assert.deepEqual(first.skills[0].files.map(x=>x.path),['references/guide.md','SKILL.md']);
assert.match(first.skills[0].sha256,/^[0-9a-f]{64}$/);
assert.deepEqual(JSON.parse(await fs.readFile(outputPath,'utf8')),first);

const originalDigest=first.skills[0].sha256;
await fs.writeFile(path.join(skillDir,'references','guide.md'),'changed\n','utf8');
const changed=await buildSkillRelease({sourceRoot:path.join(root,'skills'),commitSha:commit,configPath,outputPath,generatedAt:'2026-08-28T00:00:00.000Z'});
assert.notEqual(changed.skills[0].sha256,originalDigest);

await assert.rejects(buildSkillRelease({sourceRoot:path.join(root,'skills'),commitSha:'bad',configPath,outputPath}),/release_commit_invalid/);
const invalidConfig=JSON.parse(await fs.readFile(configPath,'utf8'));
invalidConfig.release_tag='latest';
await fs.writeFile(configPath,JSON.stringify(invalidConfig),'utf8');
await assert.rejects(buildSkillRelease({sourceRoot:path.join(root,'skills'),commitSha:commit,configPath,outputPath}),/release_tag_invalid/);
invalidConfig.release_tag='skills-v1.0.0';
invalidConfig.targets[0].install_root='../escape';
await fs.writeFile(configPath,JSON.stringify(invalidConfig),'utf8');
await assert.rejects(buildSkillRelease({sourceRoot:path.join(root,'skills'),commitSha:commit,configPath,outputPath}),/release_target_invalid/);

await fs.rm(root,{recursive:true,force:true});
console.log('SKILL_RELEASE_PASS');
