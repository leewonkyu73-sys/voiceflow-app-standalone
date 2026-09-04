import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const port=46000+(process.pid%1000);
const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-caption-idempotency-'));
const base=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let output='';
const child=spawn(process.execPath,['server-v2.mjs'],{
  cwd:new URL('.',import.meta.url),
  env:{...process.env,PORT:String(port),DATA_DIR:dataDir},
  stdio:['ignore','pipe','pipe'],
});
child.stdout.on('data',chunk=>{output+=chunk.toString()});
child.stderr.on('data',chunk=>{output+=chunk.toString()});

async function waitForServer(){
  for(let attempt=0;attempt<50;attempt+=1){
    if(child.exitCode!==null)throw new Error(`test_server_exited_${child.exitCode}: ${output}`);
    try{
      const response=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(500)});
      if(response.ok)return;
    }catch{}
    await sleep(100);
  }
  throw new Error(`test_server_not_ready: ${output}`);
}

async function postCaption(meetingId,payload){
  const response=await fetch(`${base}/api/v1/meetings/${meetingId}/captions`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload),
  });
  return {status:response.status,payload:await response.json()};
}

try{
  await waitForServer();
  const meetingResponse=await fetch(`${base}/api/v1/meetings`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({title:'v4 caption contract',peer_id:'host',name:'Host',language:'ko-KR'}),
  });
  assert.equal(meetingResponse.status,201);
  const meeting=(await meetingResponse.json()).data;

  const request={
    client_id:'client-sequential-1',
    peer_id:'host',
    speaker:'Host',
    language:'ko-KR',
    target_language:'vi-VN',
    text:'재접속에도 한 번만 저장됩니다',
  };
  const first=await postCaption(meeting.id,request);
  assert.equal(first.status,201);
  assert.equal(first.payload.data.client_id,request.client_id);

  const replay=await postCaption(meeting.id,request);
  assert.equal(replay.status,200,'same client_id and text must replay instead of creating a duplicate');
  assert.equal(replay.payload.replayed,true);
  assert.equal(replay.payload.data.id,first.payload.data.id);

  const conflict=await postCaption(meeting.id,{...request,text:'같은 키의 다른 원문'});
  assert.equal(conflict.status,409);
  assert.equal(conflict.payload.error,'caption_idempotency_conflict');

  const concurrentRequest={...request,client_id:'client-concurrent-1',text:'동시 재전송도 한 번만 저장됩니다'};
  const concurrent=await Promise.all([
    postCaption(meeting.id,concurrentRequest),
    postCaption(meeting.id,concurrentRequest),
  ]);
  assert.equal(concurrent.every(result=>[200,201,202].includes(result.status)),true);

  const storedResponse=await fetch(`${base}/api/v1/meetings/${meeting.id}/captions?since=0&target=vi-VN`);
  const stored=(await storedResponse.json()).data;
  assert.equal(stored.filter(item=>item.client_id===request.client_id).length,1);
  assert.equal(stored.filter(item=>item.client_id===concurrentRequest.client_id).length,1);

  const legacy={peer_id:'host',speaker:'Host',language:'ko-KR',target_language:'vi-VN',text:'기존 v3 요청'};
  const legacyWrites=await Promise.all([postCaption(meeting.id,legacy),postCaption(meeting.id,legacy)]);
  assert.equal(legacyWrites.every(result=>result.status===201),true);
  const afterLegacy=(await fetch(`${base}/api/v1/meetings/${meeting.id}/captions?since=0`).then(response=>response.json())).data;
  assert.equal(afterLegacy.filter(item=>item.text===legacy.text).length,2,'requests without client_id must retain v3 behavior');

  console.log('VOICEFLOW_V4_CAPTION_API_IDEMPOTENCY_PASS');
}finally{
  if(child.exitCode===null)child.kill('SIGTERM');
  await sleep(150);
  await fs.rm(dataDir,{recursive:true,force:true});
}
