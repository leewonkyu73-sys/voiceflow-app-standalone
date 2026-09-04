import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const COMMIT_RE=/^[0-9a-f]{40}$/i;
const TAG_RE=/^skills-v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const NAME_RE=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPO_RE=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ROOT_RE=/^(?:\.?[A-Za-z0-9_-][A-Za-z0-9._-]*)(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

function sha256(value){
  return createHash('sha256').update(value).digest('hex');
}

function assertConfig(config){
  if(config?.schema_version!==1)throw new Error('release_schema_invalid');
  if(!TAG_RE.test(String(config.release_tag||'')))throw new Error('release_tag_invalid');
  if(!Array.isArray(config.skills)||!config.skills.length)throw new Error('release_skills_invalid');
  const skills=[...new Set(config.skills.map(String))];
  if(skills.length!==config.skills.length||skills.some(name=>!NAME_RE.test(name)))throw new Error('release_skills_invalid');
  if(!Array.isArray(config.targets)||!config.targets.length)throw new Error('release_targets_invalid');
  const seen=new Set();
  for(const target of config.targets){
    const key=`${target?.repository}:${target?.branch}`;
    if(!REPO_RE.test(String(target?.repository||''))||!String(target?.branch||'').trim()||!ROOT_RE.test(String(target?.install_root||'')))throw new Error('release_target_invalid');
    if(seen.has(key))throw new Error('release_target_duplicate');
    seen.add(key);
  }
  return {...config,skills};
}

async function listSkillFiles(skillDir,current=skillDir){
  const entries=await fs.readdir(current,{withFileTypes:true});
  const files=[];
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
    const absolute=path.join(current,entry.name);
    if(entry.isSymbolicLink())throw new Error('skill_symlink_forbidden');
    if(entry.isDirectory())files.push(...await listSkillFiles(skillDir,absolute));
    else if(entry.isFile())files.push(path.relative(skillDir,absolute).split(path.sep).join('/'));
  }
  return files;
}

export async function buildSkillRelease({sourceRoot,commitSha,configPath,outputPath,generatedAt=new Date().toISOString()}){
  if(!COMMIT_RE.test(String(commitSha||'')))throw new Error('release_commit_invalid');
  const config=assertConfig(JSON.parse(await fs.readFile(configPath,'utf8')));
  const root=path.resolve(sourceRoot);
  const released=[];
  for(const name of config.skills){
    const skillDir=path.resolve(root,name);
    if(!skillDir.startsWith(`${root}${path.sep}`))throw new Error('skill_path_invalid');
    const skillMd=await fs.readFile(path.join(skillDir,'SKILL.md'),'utf8');
    const declared=skillMd.match(/^---\s*\n[\s\S]*?^name:\s*([^\n]+?)\s*$/m)?.[1];
    if(declared!==name)throw new Error(`skill_manifest_name_mismatch:${name}`);
    const filePaths=await listSkillFiles(skillDir);
    const files=[];
    for(const relativePath of filePaths){
      const content=await fs.readFile(path.join(skillDir,...relativePath.split('/')));
      files.push({path:relativePath,sha256:sha256(content),bytes:content.byteLength});
    }
    const digestInput=files.map(file=>`${file.path}\0${file.sha256}\0${file.bytes}\n`).join('');
    released.push({name,source_path:`.codex/skills/${name}`,sha256:sha256(digestInput),files});
  }
  const manifest={
    schema_version:1,
    release_tag:config.release_tag,
    commit_sha:commitSha,
    generated_at:generatedAt,
    skills:released,
    targets:config.targets,
  };
  const target=path.resolve(outputPath),temp=`${target}.tmp-${process.pid}`;
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(temp,`${JSON.stringify(manifest,null,2)}\n`,'utf8');
  await fs.rename(temp,target);
  return manifest;
}

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(!key.startsWith('--'))continue;
    out[key.slice(2)]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;
  }
  return out;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  const manifest=await buildSkillRelease({
    sourceRoot:args['source-root']||'.codex/skills',
    commitSha:args.commit,
    configPath:args.config||'config/skill-release.json',
    outputPath:args.output||'dist/skill-release.json',
  });
  console.log(JSON.stringify({ok:true,release_tag:manifest.release_tag,commit_sha:manifest.commit_sha,skills:manifest.skills.map(x=>x.name),targets:manifest.targets.map(x=>x.repository)},null,2));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{console.error(`SKILL_RELEASE_FAIL:${error.message}`);process.exit(1)});
}
