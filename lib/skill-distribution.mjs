import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const COMMIT_RE=/^[0-9a-f]{40}$/i;
const SHA256_RE=/^[0-9a-f]{64}$/i;
const SKILL_NAME_RE=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function skillDistributionStatus(env=process.env){
  if(String(env.SKILL_DISTRIBUTION_ENABLED||'').toLowerCase()!=='true')return{enabled:false,configured:false,reason:'disabled'};
  const root=String(env.SKILL_SOURCE_ROOT||'').trim();
  const registry=String(env.SKILL_REGISTRY_PATH||'').trim();
  const commit=String(env.SKILL_APPROVED_COMMIT_SHA||'').trim();
  if(!root)return{enabled:true,configured:false,reason:'skill_source_root_missing'};
  if(!registry)return{enabled:true,configured:false,reason:'skill_registry_path_missing'};
  if(!COMMIT_RE.test(commit))return{enabled:true,configured:false,reason:'approved_commit_missing'};
  return{enabled:true,configured:true,approved_commit_sha:commit,source_root:path.basename(path.resolve(root))};
}

export async function loadApprovedSkill(request={},options={}){
  const env=options.env||process.env;
  const status=skillDistributionStatus(env);
  if(!status.enabled)throw new Error('skill_distribution_disabled');
  if(!status.configured)throw new Error(status.reason);
  const name=String(request.name||'');
  const commit=String(request.commit_sha||'');
  if(!SKILL_NAME_RE.test(name))throw new Error('skill_name_invalid');
  if(!COMMIT_RE.test(commit)||commit!==status.approved_commit_sha)throw new Error('skill_commit_not_approved');
  const root=path.resolve(env.SKILL_SOURCE_ROOT);
  const file=path.resolve(root,name,'SKILL.md');
  if(!file.startsWith(`${root}${path.sep}`))throw new Error('skill_path_invalid');
  const registry=JSON.parse(await (options.readFile||fs.readFile)(path.resolve(env.SKILL_REGISTRY_PATH),'utf8'));
  if(registry.commit_sha!==commit)throw new Error('skill_registry_commit_mismatch');
  const expected=String(registry.skills?.[name]?.sha256||'').toLowerCase();
  if(!SHA256_RE.test(expected))throw new Error('skill_not_approved');
  const content=await (options.readFile||fs.readFile)(file,'utf8');
  const declared=content.match(/^---\s*\n[\s\S]*?^name:\s*([^\s]+)\s*$/m)?.[1];
  if(declared!==name)throw new Error('skill_manifest_name_mismatch');
  const actual=createHash('sha256').update(content).digest('hex');
  if(actual!==expected)throw new Error('skill_checksum_mismatch');
  return{name,commit_sha:commit,sha256:actual,content};
}
