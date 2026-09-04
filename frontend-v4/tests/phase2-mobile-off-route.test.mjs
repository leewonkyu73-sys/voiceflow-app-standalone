import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const projectRoot=new URL('../../',import.meta.url);

async function startServer({enabled,index}){
  const port=47000+(process.pid%700)+(index*1000);
  const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-v4-mobile-route-'));
  let output='';
  const child=spawn(process.execPath,['server-v2.mjs'],{
    cwd:projectRoot,
    env:{
      ...process.env,
      PORT:String(port),
      DATA_DIR:dataDir,
      VOICEFLOW_V4_MOBILE_ENABLED:enabled?'1':'0',
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
  const server=await startServer({enabled:false,index:0});
  try{
    const response=await fetch(`${server.base}/v4/mobile?meeting=mtg_mobile_route`);
    assert.equal(response.status,404);
    assert.equal((await response.json()).error,'v4_mobile_disabled');
  }finally{
    await stopServer(server);
  }
}

{
  const server=await startServer({enabled:true,index:1});
  try{
    const page=await fetch(`${server.base}/v4/mobile?meeting=mtg_mobile_route`);
    assert.equal(page.status,200);
    assert.match(page.headers.get('content-type')||'',/^text\/html/);
    assert.match(await page.text(),/data-v4-mobile="phase2-browser-speech"/);

    const app=await fetch(`${server.base}/v4/mobile/app.mjs`);
    assert.equal(app.status,200);
    assert.match(app.headers.get('content-type')||'',/^text\/javascript/);

    const shared=await fetch(`${server.base}/v4/mobile/modules/mobile-caption-session/index.mjs`);
    assert.equal(shared.status,200);
    assert.match(await shared.text(),/createMobileCaptionSession/);

    const media=await fetch(`${server.base}/v4/mobile/modules/mobile-media-session/index.mjs`);
    assert.equal(media.status,200);
    assert.match(await media.text(),/createMobileMediaSession/);

    const speech=await fetch(`${server.base}/v4/mobile/modules/mobile-speech-session/index.mjs`);
    assert.equal(speech.status,200);
    assert.match(await speech.text(),/createMobileSpeechSession/);

    const browserSpeech=await fetch(`${server.base}/v4/mobile/modules/mobile-browser-speech-session/index.mjs`);
    assert.equal(browserSpeech.status,200);
    assert.match(await browserSpeech.text(),/createMobileBrowserSpeechSession/);

    const legacy=await fetch(`${server.base}/`);
    assert.equal(legacy.status,200);
    assert.doesNotMatch(await legacy.text(),/data-v4-mobile="phase2-browser-speech"/);

    const unknown=await fetch(`${server.base}/v4/mobile/modules/unknown/file.mjs`);
    assert.equal(unknown.status,404);
  }finally{
    await stopServer(server);
  }
}

console.log('VOICEFLOW_V4_PHASE2_MOBILE_OFF_ROUTE_PASS');
