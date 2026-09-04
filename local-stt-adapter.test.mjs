import assert from 'node:assert/strict';

const previous={
  enabled:process.env.LOCAL_STT_ENABLED,
  url:process.env.LOCAL_STT_URL,
  model:process.env.LOCAL_STT_MODEL,
  exclusive:process.env.LOCAL_STT_EXCLUSIVE,
};
const originalFetch=globalThis.fetch;
const calls=[];
let failLocal=false;

try{
  process.env.LOCAL_STT_ENABLED='1';
  process.env.LOCAL_STT_URL='http://127.0.0.1:4186/inference';
  process.env.LOCAL_STT_MODEL='tiny';
  process.env.LOCAL_STT_EXCLUSIVE='1';

  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    assert.equal(String(url),'http://127.0.0.1:4186/inference');
    assert.equal(options.method,'POST');
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('language'),'ko');
    assert.equal(options.body.get('response_format'),'json');
    assert.equal(options.body.get('temperature'),'0');
    assert.equal(options.body.get('vad'),'true');
    assert.equal(options.body.get('vad_threshold'),'0.50');
    assert.equal(options.body.get('vad_min_speech_duration_ms'),'250');
    assert.equal(options.body.get('vad_min_silence_duration_ms'),'100');
    assert.equal(options.body.get('vad_speech_pad_ms'),'30');
    const file=options.body.get('file');
    assert.ok(file instanceof Blob);
    assert.equal(file.type,'audio/webm');
    if(failLocal)return Response.json({message:'local-sidecar-offline'},{status:503});
    return Response.json({text:'여러 문장을 계속 인식합니다'});
  };

  const {configured,transcribeExternal}=await import(`./lib/provider-adapters.mjs?local-stt-test=${Date.now()}`);
  assert.equal(configured().local,true);
  const result=await transcribeExternal(Buffer.from('voice-segment'),{
    language:'ko-KR',
    mimeType:'audio/webm',
    useRuntimeRouting:true,
  });

  assert.equal(result.text,'여러 문장을 계속 인식합니다');
  assert.equal(result.provider,'local-whisper');
  assert.equal(result.model,'tiny');
  assert.equal(result.transport,'localhost_http');
  assert.equal(result.routing_source,'local_feature_flag');
  assert.equal(calls.length,1,'enabled local STT must run before paid providers');

  failLocal=true;
  await assert.rejects(
    ()=>transcribeExternal(Buffer.from('voice-segment'),{language:'ko-KR',mimeType:'audio/webm',useRuntimeRouting:true}),
    /STT_all_providers_failed:local:local-sidecar-offline/,
  );
  assert.equal(calls.length,2,'exclusive local STT failure must not call OpenAI or Gemini');

  console.log('VOICEFLOW_LOCAL_STT_ADAPTER_PASS');
}finally{
  globalThis.fetch=originalFetch;
  for(const [name,value] of Object.entries({
    LOCAL_STT_ENABLED:previous.enabled,
    LOCAL_STT_URL:previous.url,
    LOCAL_STT_MODEL:previous.model,
    LOCAL_STT_EXCLUSIVE:previous.exclusive,
  })){
    if(value===undefined)delete process.env[name];else process.env[name]=value;
  }
}
