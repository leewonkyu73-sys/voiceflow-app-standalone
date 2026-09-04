import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const testPort=45180;
const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-test-'));
const base=`http://127.0.0.1:${testPort}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let childError='';
const child=spawn(process.execPath,['server-v2.mjs'],{
  env:{...process.env,PORT:String(testPort),DATA_DIR:dataDir},
  stdio:['ignore','pipe','pipe']
});
child.stdout.on('data',d=>{childError+=d.toString()});
child.stderr.on('data',d=>{childError+=d.toString()});

async function waitForOwnServer(){
  for(let i=0;i<40;i++){
    if(child.exitCode!==null)throw new Error(`test_server_exited_${child.exitCode}: ${childError}`);
    try{
      const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});
      const d=await r.json();
      if(r.ok&&d.ok===true&&d.version==='2.0.0')return;
    }catch{}
    await sleep(100);
  }
  throw new Error(`test_server_not_ready: ${childError}`);
}

try{
  await waitForOwnServer();
  const collabSource=await fs.readFile(path.join(process.cwd(),'public','meeting-collab.js'),'utf8');
  assert.match(collabSource,/if\(feed\.innerHTML!==html\)feed\.innerHTML=html/,'system message observer must not rewrite identical DOM');
  const mobileSpeechPatch=await fs.readFile(path.join(process.cwd(),'scripts','patch-immediate-original-v358.mjs'),'utf8');
  const mobileLivePatch=await fs.readFile(path.join(process.cwd(),'scripts','patch-mobile-live-interim-v357.mjs'),'utf8');
  assert.match(mobileLivePatch,/state\._mobileSpeechFallbackTimer=null/,'Android Chrome must keep browser STT as the single owner');
  assert.match(mobileLivePatch,/mobileSpeech&&!mobileBrowserSpeech&&code!=='no-speech'/,'server fallback must stay outside the Android Chrome browser path');
  assert.match(mobileLivePatch,/replaceOnce\(competingWatchdog,browserSingleOwner/,'the competing watchdog must be replaced');
  assert.match(mobileLivePatch,/v357_competing_mobile_stt_owner_remaining/,'generation must reject competing STT owners');
  assert.doesNotMatch(mobileSpeechPatch,/void checkDevices\(false\)/,'session start must not reacquire the mobile microphone');
  assert.doesNotMatch(mobileSpeechPatch,/_mobileSpeechStartWatchdog/,'duplicate mobile STT watchdog must not return');
  assert.doesNotMatch(mobileSpeechPatch,/서버 음성 인식으로 전환/,'duplicate server-transition watchdog marker must not return');
  assert.doesNotMatch(mobileSpeechPatch,/speechStartedAt=Date\.now\(\)/,'speech-start server fallback must not return');
  assert.match(mobileSpeechPatch,/const speechStart="try\{r\.start\(\)\}catch\(e\)\{"/,'Samsung Chrome must restore the device-verified Golden start signature');
  assert.doesNotMatch(mobileSpeechPatch,/r\.start\(speechTrack\)/,'failed shared-track candidate must be removed');
  assert.match(mobileSpeechPatch,/mobileEmptyCycle=mobileSpeech&&!recognitionCycle\.result/,'empty mobile recognition cycles must not restart the browser recognizer');
  assert.match(mobileSpeechPatch,/watchedGeneration=generation/,'Samsung silent sessions must have a bounded watchdog');
  assert.match(mobileSpeechPatch,/browser-no-result-timeout'\},1500\)/,'the device-Golden 1.5s server handoff must be restored');
  assert.match(mobileSpeechPatch,/startServerSpeechFallback\(\);state\.media\.stt='server';return/,'empty mobile cycles must hand off once to the existing server STT');
  assert.match(mobileSpeechPatch,/recognitionCycle\.error\|\|'ended-without-result'/,'mobile runtime errors must remain observable');
  assert.match(mobileSpeechPatch,/voiceflow-shell-v343/,'PWA cache must advance for the Samsung Golden handoff fix');
  assert.match(mobileSpeechPatch,/source=source\.replace\(goldenCaptionCommit,optimisticCaptionCommit\)/,'PC manual captions must enable optimistic rendering');
  const health=await fetch(base+'/api/health').then(r=>r.json());
  assert.equal(health.ok,true);
  assert.equal(health.version,'2.0.0');

  const email=`admin${Date.now()}@example.com`;
  let cookie='';
  const regRes=await fetch(base+'/api/v1/auth/register',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({name:'Test Admin',email,password:'password123',termsAccepted:true,privacyAccepted:true,marketingAccepted:false})
  });
  assert.equal(regRes.status,201);
  cookie=regRes.headers.get('set-cookie').split(';')[0];
  const reg=await regRes.json();
  assert.equal(reg.user.role,'admin');

  const me=await fetch(base+'/api/v1/auth/me',{headers:{cookie}}).then(r=>r.json());
  assert.equal(me.user.email,email);

  const diag=await fetch(base+'/api/v1/admin/diagnostics',{headers:{cookie}}).then(r=>r.json());
  assert.equal(diag.ok,true);
  assert.ok(diag.data.providers.length>=3);

  const settings=await fetch(base+'/api/v1/admin/settings',{
    method:'PATCH',
    headers:{'content-type':'application/json',cookie},
    body:JSON.stringify({providers:{stt:'browser',translation:'prototype',validator:'local'}})
  }).then(r=>r.json());
  assert.equal(settings.data.providers.translation,'prototype');

  const demoMeeting=await fetch(base+'/api/v1/meetings',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({title:'Demo reset target',peer_id:'demo-host',name:'Demo Host',language:'ko-KR',demo_tag:'demo-onboarding-v1'})
  }).then(r=>r.json());
  await fetch(`${base}/api/v1/meetings/${demoMeeting.data.id}/captions`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({peer_id:'demo-host',speaker:'Demo Host',text:'초기화 전용 샘플'})
  });
  const demoReset=await fetch(base+'/api/v1/admin/demo-data',{method:'DELETE',headers:{cookie}}).then(r=>r.json());
  assert.deepEqual(demoReset.data,{meetings:1,captions:1,results:0});
  const demoAfterReset=await fetch(`${base}/api/v1/meetings/${demoMeeting.data.id}`);
  assert.equal(demoAfterReset.status,404);

  const users=await fetch(base+'/api/v1/admin/users',{headers:{cookie}}).then(r=>r.json());
  assert.ok(users.data.length>=1);

  const memberEmail=`member${Date.now()}@example.com`;
  const memberRes=await fetch(base+'/api/v1/auth/register',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({name:'Delete Target',email:memberEmail,password:'password123',termsAccepted:true,privacyAccepted:true})
  });
  assert.equal(memberRes.status,201);
  const member=(await memberRes.json()).user;
  const selfDelete=await fetch(base+'/api/v1/admin/users/'+reg.user.id,{method:'DELETE',headers:{cookie}});
  assert.equal(selfDelete.status,409);
  const memberDelete=await fetch(base+'/api/v1/admin/users/'+member.id,{method:'DELETE',headers:{cookie}});
  assert.equal(memberDelete.status,200);
  const usersAfterDelete=await fetch(base+'/api/v1/admin/users',{headers:{cookie}}).then(r=>r.json());
  assert.equal(usersAfterDelete.data.some(x=>x.id===member.id),false);

  const task=await fetch(base+'/api/v1/tasks',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({text:'베트남 냉동면 가격 조사해서 이한에게 금요일까지 정리해줘'})
  }).then(r=>r.json());
  assert.equal(task.data.owner,'이한');

  const meeting=await fetch(base+'/api/v1/meetings',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({type:'client',title:'Translation Test',peer_id:'host',name:'Host',language:'ko-KR'})
  }).then(r=>r.json());
  assert.equal(meeting.ok,true);
  const mid=meeting.data.id;

  const concurrentGuests=['guest-a','guest-b','guest-c'];
  const concurrentJoins=await Promise.all(concurrentGuests.map((peer,index)=>fetch(`${base}/api/v1/meetings/${mid}/join`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({peer_id:peer,name:`Guest ${index+1}`,language:index===0?'vi-VN':index===1?'en-US':'zh-CN'})
  }).then(r=>r.json())));
  assert.equal(concurrentJoins.every(x=>x.ok),true);
  const joinedMeeting=await fetch(`${base}/api/v1/meetings/${mid}`).then(r=>r.json());
  assert.deepEqual(new Set(joinedMeeting.data.participants.map(x=>x.peer_id)),new Set(['host',...concurrentGuests]));
  const joinedSignals=await fetch(`${base}/api/v1/meetings/${mid}/signals?peer=host&since=0`).then(r=>r.json());
  assert.deepEqual(new Set(joinedSignals.data.filter(x=>x.type==='participant-joined').map(x=>x.payload.peer_id)),new Set(concurrentGuests));

  const concurrentCaptions=['동시 채팅 하나','Concurrent chat two','同时聊天三'];
  const captionWrites=await Promise.all(concurrentCaptions.map((text,index)=>fetch(`${base}/api/v1/meetings/${mid}/captions`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({peer_id:concurrentGuests[index],speaker:`Guest ${index+1}`,text,target_language:'vi-VN'})
  }).then(r=>r.json())));
  assert.equal(captionWrites.every(x=>x.ok),true);
  const storedCaptions=await fetch(`${base}/api/v1/meetings/${mid}/captions?since=0&target=vi-VN`).then(r=>r.json());
  assert.deepEqual(new Set(storedCaptions.data.map(x=>x.text)),new Set(concurrentCaptions));

  await fetch(`${base}/api/v1/meetings/${mid}/join`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({peer_id:'guest',name:'Nguyen',language:'vi-VN'})
  });
  const cap=await fetch(`${base}/api/v1/meetings/${mid}/captions`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({speaker:'Nguyen',language:'vi-VN',text:'Giá này đã bao gồm phí vận chuyển.'})
  }).then(r=>r.json());
  assert.equal(cap.ok,true);
  assert.ok(cap.data.assurance?.['ko-KR']);
  const englishCap=await fetch(`${base}/api/v1/meetings/${mid}/captions`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({speaker:'Host',language:'ko-KR',detected_language:'ko-KR',target_language:'en-US',text:'영어 번역 대상 확인'})
  }).then(r=>r.json());
  assert.equal(englishCap.ok,true);
  assert.ok(Object.hasOwn(englishCap.data.translations||{},'en-US'));

  const finalized=await fetch(`${base}/api/v1/meetings/${mid}/finalize`,{method:'POST'}).then(r=>r.json());
  assert.equal(finalized.ok,true);
  assert.ok(finalized.data.started_at);
  assert.ok(finalized.data.ended_at);
  assert.ok(finalized.data.duration_seconds>=0);
  assert.deepEqual(new Set(finalized.data.participants.map(x=>x.name)),new Set(['Host','Guest 1','Guest 2','Guest 3','Nguyen']));

  const privacy=await fetch(base+'/privacy');
  assert.equal(privacy.status,200);
  const deletion=await fetch(base+'/account-delete');
  assert.equal(deletion.status,200);
  console.log('VoiceFlow Meeting Core v2 isolated integration tests passed');
}finally{
  if(child.exitCode===null)child.kill('SIGTERM');
  await sleep(150);
  await fs.rm(dataDir,{recursive:true,force:true});
}
