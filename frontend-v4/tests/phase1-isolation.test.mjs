import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../packages');
const forbidden=[
  /public\/app\.js/,
  /scripts\/patch-/,
  /SpeechRecognition|webkitSpeechRecognition/,
  /MediaRecorder/,
  /\bnavigator\b|\bdocument\b|\bwindow\b/,
  /\bfetch\s*\(/,
];

async function files(dir){
  const entries=await fs.readdir(dir,{withFileTypes:true});
  const result=[];
  for(const entry of entries){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())result.push(...await files(full));
    else if(/\.(?:mjs|d\.mts)$/.test(entry.name))result.push(full);
  }
  return result;
}

const sources=await files(root);
assert.ok(sources.length>=3,'v4 shared packages are missing');
for(const file of sources){
  const source=await fs.readFile(file,'utf8');
  for(const pattern of forbidden){
    assert.doesNotMatch(source,pattern,path.relative(root,file)+' must remain platform and v3 independent');
  }
}

console.log('VOICEFLOW_V4_PHASE1_ISOLATION_PASS');
