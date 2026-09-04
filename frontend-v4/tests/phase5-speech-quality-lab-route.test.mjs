import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const projectRoot=new URL('../../',import.meta.url);

async function startServer({enabled,index}){
  const port=50500+(process.pid%300)+(index*400);
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-speech-quality-lab-'));
  let output='';
  const child=spawn(process.execPath,['server-v2.mjs'],{
    cwd:projectRoot,
    env:{...process.env,PORT:String(port),DATA_DIR:dataDir,VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED:enabled?'1':'0',VOICEFLOW_SPEECH_QUALITY_API_ENABLED:'0'},
    stdio:['ignore','pipe','pipe'],
  });
  child.stdout.on('data',chunk=>{output+=chunk.toString()});child.stderr.on('data',chunk=>{output+=chunk.toString()});
  const base=`http://127.0.0.1:${port}`;
  for(let attempt=0;attempt<50;attempt+=1){
    if(child.exitCode!==null)throw new Error(`test_server_exited_${child.exitCode}: ${output}`);
    try{const response=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(500)});if(response.ok)return{base,child,dataDir}}catch{}
    await sleep(100);
  }
  child.kill('SIGTERM');throw new Error(`test_server_not_ready: ${output}`);
}

async function stopServer(server){
  if(server.child.exitCode===null)server.child.kill('SIGTERM');await sleep(120);await fs.rm(server.dataDir,{recursive:true,force:true});
}

{
  const server=await startServer({enabled:false,index:0});
  try{
    const page=await fetch(`${server.base}/v4/speech-quality-lab/`);
    assert.equal(page.status,404);assert.equal((await page.json()).error,'speech_quality_lab_disabled');
    const api=await fetch(`${server.base}/api/v1/speech-quality/providers`);
    assert.equal(api.status,404);assert.equal((await api.json()).error,'speech_quality_lab_disabled');
  }finally{await stopServer(server)}
}

{
  const server=await startServer({enabled:true,index:1});
  try{
    const page=await fetch(`${server.base}/v4/speech-quality-lab`);
    assert.equal(page.status,200);assert.match(page.headers.get('x-voiceflow-v4')||'',/speech-quality-lab-v1/);
    const html=await page.text();assert.match(html,/user-scalable=yes/);assert.match(html,/같은 음원을 선택한 STT 제공자에 순서대로/);
    const assets=new Map();
    for(const [asset,pattern] of [
      ['app.mjs',/body:recording\.blob/],['styles.css',/overflow-y:auto/],['sw.js',/voiceflow-speech-quality-lab-v1/],
      ['manifest.webmanifest',/"start_url": "\/v4\/speech-quality-lab\/"/],
      ['modules/speech-quality-evaluator/index.mjs',/minSilenceSamples/],
    ]){
      const response=await fetch(`${server.base}/v4/speech-quality-lab/${asset}`);
      assert.equal(response.status,200,asset);const content=await response.text();assets.set(asset,content);assert.match(content,pattern,asset);
    }
    assert.match(assets.get('app.mjs'),/for\(let index=0;index<providers\.length;index\+=1\)/,'providers must run sequentially');
    assert.doesNotMatch(assets.get('app.mjs'),/\/captions|targetLanguage|translateExternal/,'quality lab must not call caption or translation paths');
    assert.doesNotMatch(assets.get('app.mjs'),/localStorage|indexedDB/,'audio and consent must not persist');
    assert.match(assets.get('sw.js'),/url\.pathname\.startsWith\('\/api\/'\)\)return/,'service worker must bypass API requests');
    const manifest=JSON.parse(assets.get('manifest.webmanifest'));
    assert.equal(manifest.display,'standalone');assert.equal(manifest.lang,'ko-KR');assert.equal(manifest.orientation,'any');
    assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
    const unknown=await fetch(`${server.base}/v4/speech-quality-lab/unknown.js`);assert.equal(unknown.status,404);

    const anonymous=await fetch(`${server.base}/api/v1/speech-quality/providers`);
    assert.equal(anonymous.status,401);assert.equal((await anonymous.json()).error,'login_required');

    const registered=await fetch(`${server.base}/api/v1/auth/register`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({name:'품질 시험자',email:'quality-lab@example.com',password:'password1',termsAccepted:true,privacyAccepted:true}),
    });
    assert.equal(registered.status,201);const cookie=String(registered.headers.get('set-cookie')||'').split(';')[0];
    const providers=await fetch(`${server.base}/api/v1/speech-quality/providers`,{headers:{cookie}});
    assert.equal(providers.status,200);const providerPayload=await providers.json();
    assert.ok(providerPayload.data.providers.length>=5);assert.ok(providerPayload.data.providers.every(provider=>provider.enabled===false));
    assert.ok(providerPayload.data.providers.every(provider=>provider.reason==='api_disabled'));

    const noConsent=await fetch(`${server.base}/api/v1/speech-quality/transcribe/deepgram-nova-3`,{
      method:'POST',headers:{cookie,'content-type':'audio/webm','x-voice-client':'v4-speech-quality-lab'},body:new Uint8Array(900),
    });
    assert.equal(noConsent.status,403);assert.equal((await noConsent.json()).error,'speech_audio_consent_required');

    const locked=await fetch(`${server.base}/api/v1/speech-quality/transcribe/deepgram-nova-3`,{
      method:'POST',headers:{cookie,'content-type':'audio/webm','x-voice-client':'v4-speech-quality-lab','x-voice-audio-consent':'session','x-voice-language':'ko-KR','x-voice-session-id':'lab-session-001','x-voice-utterance-id':'lab-utterance-001'},body:new Uint8Array(900),
    });
    assert.equal(locked.status,503);const lockedPayload=await locked.json();assert.equal(lockedPayload.error,'speech_quality_provider_unavailable');assert.equal(lockedPayload.reason,'api_disabled');
  }finally{await stopServer(server)}
}

console.log('VOICEFLOW_V4_PHASE5_SPEECH_QUALITY_LAB_ROUTE_PASS');
