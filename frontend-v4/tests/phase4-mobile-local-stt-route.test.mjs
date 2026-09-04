import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const projectRoot=new URL('../../',import.meta.url);

async function startServer({localEnabled,index}){
  const port=49500+(process.pid%300)+(index*400);
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-v4-local-stt-route-'));
  let output='';
  const child=spawn(process.execPath,['server-v2.mjs'],{
    cwd:projectRoot,
    env:{
      ...process.env,
      PORT:String(port),
      DATA_DIR:dataDir,
      VOICEFLOW_V4_MOBILE_ENABLED:'1',
      VOICEFLOW_V4_LOCAL_STT_ENABLED:localEnabled?'1':'0',
    },
    stdio:['ignore','pipe','pipe'],
  });
  child.stdout.on('data',chunk=>{output+=chunk.toString()});
  child.stderr.on('data',chunk=>{output+=chunk.toString()});
  const base=`http://127.0.0.1:${port}`;
  for(let attempt=0;attempt<50;attempt+=1){
    if(child.exitCode!==null)throw new Error(`test_server_exited_${child.exitCode}: ${output}`);
    try{
      const response=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(500)});
      if(response.ok)return {base,child,dataDir};
    }catch{}
    await sleep(100);
  }
  child.kill('SIGTERM');
  throw new Error(`test_server_not_ready: ${output}`);
}

async function stopServer(server){
  if(server.child.exitCode===null)server.child.kill('SIGTERM');
  await sleep(120);
  await fs.rm(server.dataDir,{recursive:true,force:true});
}

{
  const server=await startServer({localEnabled:false,index:0});
  try{
    const response=await fetch(`${server.base}/v4/local-stt-test?meeting=mtg_local_route`);
    assert.equal(response.status,404);
    assert.equal((await response.json()).error,'v4_local_stt_disabled');

    const current=await fetch(`${server.base}/v4/mobile?meeting=mtg_current_route`);
    assert.equal(current.status,200);
    assert.match(await current.text(),/data-v4-mobile="phase2-browser-speech"/);
  }finally{await stopServer(server)}
}

{
  const server=await startServer({localEnabled:true,index:1});
  try{
    const page=await fetch(`${server.base}/v4/local-stt-test?meeting=mtg_local_route`);
    assert.equal(page.status,200);
    assert.match(page.headers.get('x-voiceflow-v4')||'',/local-stt-pwa-canary-v1/);
    assert.match(await page.text(),/data-v4-mobile="local-stt-pwa-canary-v1"/);

    for(const [asset,pattern] of [
      ['app.mjs',/createLocalWhisperClient/],
      ['local-whisper-worker.mjs',/automatic-speech-recognition/],
      ['local-sw.js',/voiceflow-local-stt-shell-v4/],
      ['styles.css',/\.input-mode-panel/],
      ['manifest.webmanifest',/"start_url": "\/v4\/local-stt-test\/"/],
      ['base.css',/\.mobile-shell/],
      ['modules/mobile-input-policy/index.mjs',/assessMobileInputPolicy/],
      ['modules/mobile-local-whisper/index.mjs',/createLocalWhisperClient/],
    ]){
      const response=await fetch(`${server.base}/v4/local-stt-test/${asset}`);
      assert.equal(response.status,200,asset);
      assert.match(await response.text(),pattern,asset);
    }
    const unknown=await fetch(`${server.base}/v4/local-stt-test/unknown.js`);
    assert.equal(unknown.status,404);

    const unauthenticated=await fetch(`${server.base}/api/v1/meetings/mtg_local_route/captions`,{headers:{'x-voice-client':'v4-local-stt-test'}});
    assert.equal(unauthenticated.status,401);
    assert.equal((await unauthenticated.json()).error,'signup_consent_required');
    const unauthenticatedCreate=await fetch(`${server.base}/api/v1/meetings`,{method:'POST',headers:{'content-type':'application/json','x-voice-client':'v4-local-stt-test'},body:'{}'});
    assert.equal(unauthenticatedCreate.status,401);

    const refused=await fetch(`${server.base}/api/v1/auth/register`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({name:'초대 손님',email:'invite-refused@example.com',password:'password1',termsAccepted:true,privacyAccepted:false}),
    });
    assert.equal(refused.status,400);
    assert.equal((await refused.json()).error,'consent_required');

    const registered=await fetch(`${server.base}/api/v1/auth/register`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({name:'초대 손님',email:'invite-ok@example.com',password:'password1',termsAccepted:true,privacyAccepted:true}),
    });
    assert.equal(registered.status,201);
    const cookie=String(registered.headers.get('set-cookie')||'').split(';')[0];
    assert.match(cookie,/^voiceflow_session=/);

    const createdMeeting=await fetch(`${server.base}/api/v1/meetings`,{
      method:'POST',headers:{cookie,'content-type':'application/json','x-voice-client':'v4-local-stt-test'},
      body:JSON.stringify({title:'설치 후 새 회의',type:'internal'}),
    });
    assert.equal(createdMeeting.status,201);
    const createdMeetingId=String((await createdMeeting.json()).data?.id||'');
    assert.match(createdMeetingId,/^mtg_/);

    const audioWithoutConsent=await fetch(`${server.base}/api/v1/meetings/${createdMeetingId}/transcribe`,{
      method:'POST',headers:{cookie,'content-type':'audio/webm','x-voice-client':'v4-local-stt-test'},body:new Uint8Array(900),
    });
    assert.equal(audioWithoutConsent.status,403);
    assert.equal((await audioWithoutConsent.json()).error,'server_audio_consent_required');

    const consentedShortAudio=await fetch(`${server.base}/api/v1/meetings/${createdMeetingId}/transcribe`,{
      method:'POST',headers:{cookie,'content-type':'audio/webm','x-voice-client':'v4-local-stt-test','x-voice-audio-consent':'session'},body:new Uint8Array(100),
    });
    assert.equal(consentedShortAudio.status,400);
    assert.equal((await consentedShortAudio.json()).error,'audio_empty');

    const authenticated=await fetch(`${server.base}/api/v1/meetings/mtg_local_route/captions`,{headers:{cookie,'x-voice-client':'v4-local-stt-test'}});
    assert.equal(authenticated.status,200);
    assert.deepEqual((await authenticated.json()).data,[]);
  }finally{await stopServer(server)}
}

console.log('VOICEFLOW_V4_PHASE4_MOBILE_LOCAL_STT_ROUTE_PASS');
