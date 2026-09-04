import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const previous={
  dataDir:process.env.DATA_DIR,
  integrationDataDir:process.env.INTEGRATION_DATA_DIR,
  openaiKey:process.env.OPENAI_API_KEY,
  geminiKey:process.env.GEMINI_API_KEY,
};
const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-stt-routing-'));
const integrationDataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-stt-secrets-'));
const calls=[];
const originalFetch=globalThis.fetch;

try{
  process.env.DATA_DIR=dataDir;
  process.env.INTEGRATION_DATA_DIR=integrationDataDir;
  process.env.OPENAI_API_KEY='test-openai-key';
  process.env.GEMINI_API_KEY='test-gemini-key';
  await fs.writeFile(path.join(dataDir,'settings.json'),JSON.stringify({
    functionRouting:{
      stt_realtime:{
        primary:'gemini',
        model:'gemini-3.5-transcribe',
        fallback:'openai',
      },
    },
  }));

  globalThis.fetch=async(url,options={})=>{
    const href=String(url);
    calls.push({url:href,method:options.method||'GET'});

    if(href==='https://api.openai.com/v1/audio/transcriptions'){
      return Response.json({text:'v3-openai'});
    }
    if(href==='https://generativelanguage.googleapis.com/upload/v1beta/files'){
      return new Response(null,{status:200,headers:{'x-goog-upload-url':'https://upload.example.test/v4-routing'}});
    }
    if(href==='https://upload.example.test/v4-routing'){
      return Response.json({file:{name:'files/voice-v4',uri:'https://files.example.test/voice-v4',mimeType:'audio/webm'}});
    }
    if(href==='https://generativelanguage.googleapis.com/v1beta/interactions'){
      return Response.json({outputs:[{type:'text',text:'v4-gemini'}]});
    }
    if(href==='https://generativelanguage.googleapis.com/v1beta/files/voice-v4'&&options.method==='DELETE'){
      return new Response(null,{status:204});
    }
    throw new Error(`unexpected_fetch:${href}`);
  };

  const {transcribeExternal}=await import(`./lib/provider-adapters.mjs?stt-routing-test=${Date.now()}`);
  const audio=Buffer.from('voice-segment');

  const existing=await transcribeExternal(audio,{language:'ko-KR',mimeType:'audio/webm'});
  assert.equal(existing.text,'v3-openai');
  assert.equal(existing.provider,'openai');
  assert.equal(existing.routing_source,'adapter_default');
  assert.equal(calls.filter(call=>call.url.endsWith('/v1beta/interactions')).length,0,'existing v3/server fallback must ignore v4 function routing');

  const mobile=await transcribeExternal(audio,{language:'ko-KR',mimeType:'audio/webm',useRuntimeRouting:true});
  assert.equal(mobile.text,'v4-gemini');
  assert.equal(mobile.provider,'gemini');
  assert.equal(mobile.model,'gemini-3.5-transcribe');
  assert.equal(mobile.routing_source,'functionRouting');
  assert.equal(calls.filter(call=>call.url.endsWith('/v1beta/interactions')).length,1,'v4 mobile must use configured runtime routing');

  console.log('VOICEFLOW_STT_RUNTIME_ROUTING_ISOLATION_PASS');
}finally{
  globalThis.fetch=originalFetch;
  for(const [name,value] of Object.entries({
    DATA_DIR:previous.dataDir,
    INTEGRATION_DATA_DIR:previous.integrationDataDir,
    OPENAI_API_KEY:previous.openaiKey,
    GEMINI_API_KEY:previous.geminiKey,
  })){
    if(value===undefined)delete process.env[name];else process.env[name]=value;
  }
  await fs.rm(dataDir,{recursive:true,force:true});
  await fs.rm(integrationDataDir,{recursive:true,force:true});
}
