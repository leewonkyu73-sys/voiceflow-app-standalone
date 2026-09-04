import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const emit=process.argv.includes('--emit');
const projectRoot=process.env.VOICEFLOW_RECOVERY_PROJECT_ROOT||'/opt/star45/voiceflow-smart-workspace';
const dataDir=process.env.INTEGRATION_DATA_DIR||'/opt/star45/voiceflow-data';
const candidates=[];
const keySources=[];
const sourceCategories=new Set();

function clean(value){
  const raw=String(value||'').trim();
  if((raw.startsWith('"')&&raw.endsWith('"'))||(raw.startsWith("'")&&raw.endsWith("'")))return raw.slice(1,-1);
  return raw;
}
function addKeySource(category,value){
  const v=clean(value);
  if(!v)return;
  keySources.push(v);
  sourceCategories.add(category);
}
function addDeepL(category,value){
  const v=clean(value);
  if(!v)return;
  candidates.push(v);
  sourceCategories.add(category);
}
function parseEnv(lines,category){
  for(const line of String(lines||'').split(/\r?\n/)){
    const match=line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
    if(!match)continue;
    const [,name,value]=match;
    if(name==='DEEPL_API_KEY')addDeepL(category,value);
    if(name==='INTEGRATION_SECRET_KEY'||name==='GOOGLE_DRIVE_TOKEN_SECRET')addKeySource(category,value);
  }
}

addDeepL('process-env',process.env.DEEPL_API_KEY);
addKeySource('process-env',process.env.INTEGRATION_SECRET_KEY);
addKeySource('process-env',process.env.GOOGLE_DRIVE_TOKEN_SECRET);

try{
  for(const name of fs.readdirSync(projectRoot)){
    if(name!=='.env'&&!/^\.env[.-]/.test(name))continue;
    const file=path.join(projectRoot,name);
    if(!fs.statSync(file).isFile())continue;
    parseEnv(fs.readFileSync(file,'utf8'),'project-env-file');
  }
}catch{}

if(process.env.VOICEFLOW_RECOVERY_SKIP_DOCKER!=='1'){
  try{
    const names=execFileSync('docker',['ps','-a','--format','{{.Names}}'],{encoding:'utf8',stdio:['ignore','pipe','ignore']})
      .split(/\r?\n/).map(x=>x.trim()).filter(x=>/^voiceflow-/.test(x));
    for(const name of names){
      try{
        const raw=execFileSync('docker',['inspect','--format','{{json .Config.Env}}',name],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
        const env=JSON.parse(raw);
        parseEnv((env||[]).join('\n'),'voiceflow-container-env');
      }catch{}
    }
  }catch{}
}

try{
  const store=JSON.parse(fs.readFileSync(path.join(dataDir,'integration-secrets.json'),'utf8'));
  const encrypted=store?.DEEPL_API_KEY;
  if(encrypted?.iv&&encrypted?.tag&&encrypted?.data){
    for(const source of [...new Set(keySources)]){
      try{
        const key=crypto.createHash('sha256').update(source).digest();
        const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(encrypted.iv,'base64'));
        decipher.setAuthTag(Buffer.from(encrypted.tag,'base64'));
        const value=Buffer.concat([
          decipher.update(Buffer.from(encrypted.data,'base64')),
          decipher.final()
        ]).toString('utf8');
        addDeepL('encrypted-store-decrypted',value);
      }catch{}
    }
  }
}catch{}

const unique=[...new Set(candidates)];
if(emit){
  if(unique.length!==1)process.exit(unique.length?3:2);
  process.stdout.write(unique[0]);
}else{
  console.log(JSON.stringify({
    ok:unique.length===1,
    reason:unique.length===1?'unique-existing-key':unique.length?'ambiguous-existing-keys':'existing-key-not-recoverable',
    candidateCount:unique.length,
    sourceCategories:[...sourceCategories].sort()
  }));
}
