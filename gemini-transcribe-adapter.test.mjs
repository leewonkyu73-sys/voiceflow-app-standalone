import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const previous={
  dataDir:process.env.INTEGRATION_DATA_DIR,
  apiKey:process.env.GEMINI_API_KEY
};
const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'voiceflow-gemini-transcribe-'));
const calls=[];
const originalFetch=globalThis.fetch;

try{
  process.env.INTEGRATION_DATA_DIR=dataDir;
  process.env.GEMINI_API_KEY='test-gemini-key';

  globalThis.fetch=async(url,options={})=>{
    const href=String(url);
    calls.push({url:href,method:options.method||'GET',headers:options.headers,body:options.body});

    if(href==='https://generativelanguage.googleapis.com/upload/v1beta/files'){
      return new Response(null,{status:200,headers:{'x-goog-upload-url':'https://upload.example.test/session-1'}});
    }
    if(href==='https://upload.example.test/session-1'){
      return Response.json({file:{name:'files/voice-1',uri:'https://files.example.test/voice-1',mimeType:'audio/webm'}});
    }
    if(href==='https://generativelanguage.googleapis.com/v1beta/interactions'){
      return Response.json({outputs:[{type:'text',text:'안녕하세요'}]});
    }
    if(href==='https://generativelanguage.googleapis.com/v1beta/files/voice-1'&&options.method==='DELETE'){
      return new Response(null,{status:204});
    }
    throw new Error(`unexpected_fetch:${href}`);
  };

  const {transcribeExternal}=await import(`./lib/provider-adapters.mjs?gemini-transcribe-test=${Date.now()}`);
  const result=await transcribeExternal(Buffer.from('voice-segment'),{
    provider:'gemini',
    model:'gemini-3.5-transcribe',
    fallbackProvider:'gemini',
    language:'ko-KR',
    mimeType:'audio/webm'
  });

  assert.equal(result.text,'안녕하세요');
  assert.equal(result.provider,'gemini');
  assert.equal(result.model,'gemini-3.5-transcribe');
  assert.equal(result.transport,'interactions_file');
  assert.equal(calls.filter(x=>x.url.includes(':generateContent')).length,0,'dedicated Transcribe must not use generateContent');
  assert.equal(calls.filter(x=>x.url.endsWith('/v1beta/interactions')).length,1);
  assert.equal(calls.filter(x=>x.method==='DELETE').length,1,'uploaded probe audio must be deleted');
  const interaction=JSON.parse(String(calls.find(x=>x.url.endsWith('/v1beta/interactions')).body));
  assert.deepEqual(interaction.generation_config.transcription_config.language_codes,['ko-KR']);
  assert.equal(interaction.input[0].uri,'https://files.example.test/voice-1');

  console.log('GEMINI_3_5_TRANSCRIBE_INTERACTIONS_PASS');
}finally{
  globalThis.fetch=originalFetch;
  if(previous.dataDir===undefined)delete process.env.INTEGRATION_DATA_DIR;else process.env.INTEGRATION_DATA_DIR=previous.dataDir;
  if(previous.apiKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous.apiKey;
  await fs.rm(dataDir,{recursive:true,force:true});
}
