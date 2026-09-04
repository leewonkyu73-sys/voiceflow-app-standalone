import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const COMMIT_RE=/^[0-9a-f]{40}$/i;
const NAME_RE=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MANAGED_ENV_KEYS=['SKILL_DISTRIBUTION_ENABLED','SKILL_SOURCE_ROOT','SKILL_REGISTRY_PATH','SKILL_APPROVED_COMMIT_SHA'];

async function atomicWrite(file,content){
  const target=path.resolve(file),temp=`${target}.tmp-${process.pid}`;
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(temp,content,'utf8');
  await fs.rename(temp,target);
}

export async function buildSkillRegistry({sourceRoot,commitSha,skills,outputPath}){
  if(!COMMIT_RE.test(String(commitSha||'')))throw new Error('approved_commit_invalid');
  const names=[...new Set((skills||[]).map(String))];
  if(!names.length||names.some(name=>!NAME_RE.test(name)))throw new Error('approved_skills_invalid');
  const root=path.resolve(sourceRoot),approved={};
  for(const name of names){
    const file=path.resolve(root,name,'SKILL.md');
    if(!file.startsWith(`${root}${path.sep}`))throw new Error('skill_path_invalid');
    const content=await fs.readFile(file,'utf8');
    const declared=content.match(/^---\s*\n[\s\S]*?^name:\s*([^\s]+)\s*$/m)?.[1];
    if(declared!==name)throw new Error(`skill_manifest_name_mismatch:${name}`);
    approved[name]={sha256:createHash('sha256').update(content).digest('hex')};
  }
  const registry={schema_version:1,commit_sha:commitSha,generated_at:new Date().toISOString(),skills:approved};
  await atomicWrite(outputPath,`${JSON.stringify(registry,null,2)}\n`);
  return registry;
}

export async function updateSkillDistributionEnv({envFile,enabled,commitSha='',sourceRoot='/app/.codex/skills',registryPath='/app/data/skill-registry.json'}){
  if(enabled&&!COMMIT_RE.test(String(commitSha||'')))throw new Error('approved_commit_invalid');
  const entries={
    SKILL_DISTRIBUTION_ENABLED:enabled?'true':'false',
    SKILL_SOURCE_ROOT:sourceRoot,
    SKILL_REGISTRY_PATH:registryPath,
    SKILL_APPROVED_COMMIT_SHA:enabled?commitSha:'',
  };
  const original=await fs.readFile(envFile,'utf8').catch(()=> '');
  const seen=new Set(),lines=original.split(/\r?\n/).filter((line,index,array)=>!(index===array.length-1&&line==='')).map(line=>{
    const key=MANAGED_ENV_KEYS.find(candidate=>line.startsWith(`${candidate}=`));
    if(!key)return line;
    seen.add(key);return`${key}=${entries[key]}`;
  });
  for(const key of MANAGED_ENV_KEYS)if(!seen.has(key))lines.push(`${key}=${entries[key]}`);
  await atomicWrite(envFile,`${lines.join('\n')}\n`);
  return entries;
}

function parseArgs(argv){const out={};for(let i=0;i<argv.length;i++){const key=argv[i];if(!key.startsWith('--'))continue;out[key.slice(2)]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true}return out}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args['disable-env']){await updateSkillDistributionEnv({envFile:args['disable-env'],enabled:false});console.log('SKILL_DISTRIBUTION_DISABLED');return}
  const skills=String(args.skills||'').split(',').map(x=>x.trim()).filter(Boolean);
  const registry=await buildSkillRegistry({sourceRoot:args['source-root']||'.codex/skills',commitSha:args.commit,skills,outputPath:args.output});
  if(args['enable-env'])await updateSkillDistributionEnv({envFile:args['enable-env'],enabled:true,commitSha:args.commit,sourceRoot:args['container-source-root']||'/app/.codex/skills',registryPath:args['container-registry-path']||'/app/data/skill-registry.json'});
  console.log(JSON.stringify({ok:true,commit_sha:registry.commit_sha,skills:Object.keys(registry.skills)},null,2));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(`SKILL_REGISTRY_FAIL:${e.message}`);process.exit(1)});
