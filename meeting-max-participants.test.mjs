import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const port=47000+(process.pid%1000);
const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-meeting-eight-'));
const base=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let output='';
const child=spawn(process.execPath,['server-v2.mjs'],{
  cwd:new URL('.',import.meta.url),
  env:{...process.env,PORT:String(port),DATA_DIR:dataDir,INTEGRATION_DATA_DIR:dataDir},
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
async function post(pathname,body){
  const response=await fetch(`${base}${pathname}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  });
  return {status:response.status,payload:await response.json()};
}

try{
  await waitForServer();
  const deployedUiPatch=await fs.readFile(new URL('./scripts/patch-voiceflow-planned-v314.mjs',import.meta.url),'utf8');
  assert.match(deployedUiPatch,/참여 \$\{people\.length\|\|1\}명/);
  assert.match(deployedUiPatch,/esc\(c\.speaker\|\|'Participant'\)/);

  const created=await post('/api/v1/meetings',{
    title:'8명 동시 대화방',
    peer_id:'peer-1',
    name:'참가자 1',
    language:'ko-KR',
  });
  assert.equal(created.status,201);
  const meeting=created.payload.data;
  assert.equal(meeting.max_participants,8);
  assert.equal(meeting.participants.length,1);

  const joins=await Promise.all(
    Array.from({length:8},(_,index)=>post(`/api/v1/meetings/${meeting.id}/join`,{
      peer_id:`peer-${index+2}`,
      name:`참가자 ${index+2}`,
      language:index%2?'vi-VN':'ko-KR',
    })),
  );
  assert.equal(joins.filter(result=>result.status===200).length,7);
  assert.equal(joins.filter(result=>result.status===409).length,1);
  assert.equal(joins.find(result=>result.status===409)?.payload.error,'meeting_full');

  const current=await fetch(`${base}/api/v1/meetings/${meeting.id}`).then(response=>response.json());
  assert.equal(current.data.participants.length,8);
  assert.equal(new Set(current.data.participants.map(item=>item.peer_id)).size,8);

  const returning=current.data.participants.at(-1);
  const rejoin=await post(`/api/v1/meetings/${meeting.id}/join`,{
    peer_id:returning.peer_id,
    name:`${returning.name} 재접속`,
    language:returning.language,
  });
  assert.equal(rejoin.status,200);
  assert.equal(rejoin.payload.data.participants.length,8);
  assert.equal(rejoin.payload.data.participants.at(-1).name,`${returning.name} 재접속`);

  for(const [index,participant] of rejoin.payload.data.participants.entries()){
    const caption=await post(`/api/v1/meetings/${meeting.id}/captions`,{
      client_id:`eight-speaker-${index+1}`,
      peer_id:participant.peer_id,
      speaker:participant.name,
      language:'ko-KR',
      target_language:'vi-VN',
      text:`참가자 ${index+1} 테스트 문장`,
    });
    assert.equal(caption.status,201);
  }

  const captions=await fetch(`${base}/api/v1/meetings/${meeting.id}/captions?since=0&target=vi-VN`).then(response=>response.json());
  assert.equal(captions.data.length,8);
  assert.equal(new Set(captions.data.map(item=>item.peer_id)).size,8);
  assert.equal(new Set(captions.data.map(item=>item.speaker)).size,8);
  assert.equal(captions.data.every(item=>Object.hasOwn(item.translations,'vi-VN')),true);

  const signals=await fetch(`${base}/api/v1/meetings/${meeting.id}/signals?since=0`).then(response=>response.json());
  assert.equal(signals.data.filter(item=>item.type==='participant-joined').length,7);

  console.log('VOICEFLOW_MEETING_MAX_EIGHT_PASS');
}finally{
  if(child.exitCode===null)child.kill('SIGTERM');
  await sleep(150);
  await fs.rm(dataDir,{recursive:true,force:true});
}
