import assert from 'node:assert/strict';

import {createTranscriptionRequest} from './frontend-v4/packages/speech-provider-contract/index.mjs';
import {
  createDeepgramNova3Adapter,
  createGoogleChirp3Adapter,
  createOpenAITranscribeAdapter,
} from './lib/speech-quality-provider-adapters.mjs';

const audio=new Uint8Array([1,2,3,4]);

{
  let sent=null;
  const adapter=createDeepgramNova3Adapter({
    apiKey:'test-deepgram-key',
    transport:async(url,options)=>{
      sent={url:String(url),options};
      return {ok:true,status:200,json:async()=>({results:{channels:[{alternatives:[{transcript:'오늘 회의',confidence:0.96}]}]}})};
    },
  });
  const request=createTranscriptionRequest({provider:adapter.provider,sessionId:'qa-session-001',utteranceId:'qa-utterance-001',sourceLanguage:'ko-KR',audioConsent:'session'});
  const result=await adapter.transcribe({audio,request});
  assert.match(sent.url,/model=nova-3/);
  assert.match(sent.url,/language=ko-KR/);
  assert.equal(sent.options.headers.authorization,'Token test-deepgram-key');
  assert.equal(sent.options.body,audio);
  assert.equal(result.text,'오늘 회의');
  assert.equal(result.confidence,0.96);
}

{
  let sent=null;
  const adapter=createOpenAITranscribeAdapter({
    apiKey:'test-openai-key',
    transport:async(url,options)=>{
      sent={url,options};
      return {ok:true,status:200,json:async()=>({text:' 내일 회의 '})};
    },
  });
  const request=createTranscriptionRequest({provider:adapter.provider,sessionId:'qa-session-001',utteranceId:'qa-utterance-002',sourceLanguage:'ko-KR',audioConsent:'session'});
  const result=await adapter.transcribe({audio,request});
  assert.equal(sent.url,'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(sent.options.headers.authorization,'Bearer test-openai-key');
  assert.equal(sent.options.body.get('model'),'gpt-transcribe');
  assert.equal(sent.options.body.get('language'),'ko');
  assert.equal(result.text,' 내일 회의 ','adapter must preserve provider transcript text');
}

{
  let sent=null,tokenCalls=0;
  const adapter=createGoogleChirp3Adapter({
    projectId:'star45-test',
    getAccessToken:async()=>{tokenCalls+=1;return'test-google-token'},
    transport:async(url,options)=>{
      sent={url,options};
      return {ok:true,status:200,json:async()=>({results:[
        {alternatives:[{transcript:'오늘 회의를 ',confidence:0.9}]},
        {alternatives:[{transcript:'시작합니다.',confidence:0.8}]},
      ]})};
    },
  });
  const request=createTranscriptionRequest({provider:adapter.provider,sessionId:'qa-session-001',utteranceId:'qa-utterance-003',sourceLanguage:'ko-KR',audioConsent:'session'});
  const result=await adapter.transcribe({audio,request});
  assert.equal(tokenCalls,1);
  assert.equal(sent.url,'https://speech.googleapis.com/v2/projects/star45-test/locations/global/recognizers/_:recognize');
  assert.equal(sent.options.headers.authorization,'Bearer test-google-token');
  const payload=JSON.parse(sent.options.body);
  assert.equal(payload.config.model,'chirp_3');
  assert.deepEqual(payload.config.languageCodes,['ko-KR']);
  assert.equal(payload.content,Buffer.from(audio).toString('base64'));
  assert.equal(result.text,'오늘 회의를 시작합니다.');
  assert.ok(Math.abs(result.confidence-0.85)<1e-9);
}

{
  const adapter=createDeepgramNova3Adapter({
    apiKey:'never-print-this-key',
    transport:async()=>({ok:false,status:401,json:async()=>({message:'unauthorized'})}),
  });
  const request=createTranscriptionRequest({provider:adapter.provider,sessionId:'qa-session-001',utteranceId:'qa-utterance-004',sourceLanguage:'ko-KR',audioConsent:'session'});
  await assert.rejects(()=>adapter.transcribe({audio,request}),error=>{
    assert.equal(error.status,401);
    assert.doesNotMatch(error.message,/never-print-this-key/);
    return true;
  });
}

console.log('VOICEFLOW_SPEECH_QUALITY_PROVIDER_ADAPTERS_PASS');
