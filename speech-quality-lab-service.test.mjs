import assert from 'node:assert/strict';

import {
  createSpeechQualityAdapter,
  createSpeechQualityQuota,
  speechQualityLabFlags,
  speechQualityProviderStatus,
  transcribeSpeechQualitySample,
} from './lib/speech-quality-lab-service.mjs';

assert.deepEqual(speechQualityLabFlags({}),{labEnabled:false,apiEnabled:false});

{
  const env={
    VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED:'1',
    VOICEFLOW_SPEECH_QUALITY_API_ENABLED:'0',
    VOICEFLOW_SPEECH_QUALITY_PROVIDER_ALLOWLIST:'deepgram-nova-3',
    DEEPGRAM_API_KEY:'must-not-appear',
  };
  const deepgram=speechQualityProviderStatus(env).find(provider=>provider.id==='deepgram-nova-3');
  assert.equal(deepgram.configured,true);
  assert.equal(deepgram.enabled,false);
  assert.equal(deepgram.reason,'api_disabled');
  assert.doesNotMatch(JSON.stringify(deepgram),/must-not-appear/);
}

const enabledEnv={
  VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED:'1',
  VOICEFLOW_SPEECH_QUALITY_API_ENABLED:'1',
  VOICEFLOW_SPEECH_QUALITY_PROVIDER_ALLOWLIST:'deepgram-nova-3',
  DEEPGRAM_API_KEY:'test-deepgram-key',
  VOICEFLOW_DEEPGRAM_NOVA3_USD_PER_MINUTE:'0.01',
};

{
  const statuses=speechQualityProviderStatus(enabledEnv);
  assert.equal(statuses.find(provider=>provider.id==='deepgram-nova-3').enabled,true);
  assert.equal(statuses.find(provider=>provider.id==='openai-transcribe').enabled,false);
  assert.equal(statuses.find(provider=>provider.id==='openai-transcribe').reason,'not_allowlisted');
  assert.equal(statuses.find(provider=>provider.id==='azure-speech').reason,'implementation_pending');
  assert.throws(()=>createSpeechQualityAdapter('unknown-provider',{env:enabledEnv}),/speech_quality_provider_unknown/);
}

{
  let sent=null,clock=100;
  const result=await transcribeSpeechQualitySample({
    providerId:'deepgram-nova-3',audio:new Uint8Array([1,2,3,4]),mimeType:'audio/mp4',
    sourceLanguage:'ko-KR',sessionId:'lab-session-001',utteranceId:'lab-utterance-001',
    sequence:7,audioConsent:'session',audioDurationMs:6000,env:enabledEnv,now:()=>{clock+=125;return clock},
    transport:async(url,options)=>{
      sent={url:String(url),options};
      return {ok:true,status:200,json:async()=>({results:{channels:[{alternatives:[{transcript:'원문 그대로',confidence:.91}]}]}})};
    },
  });
  assert.match(sent.url,/model=nova-3/);
  assert.equal(sent.options.headers['content-type'],'audio/mp4');
  assert.equal(result.originalText,'원문 그대로');
  assert.equal(result.sessionId,'lab-session-001');
  assert.equal(result.utteranceId,'lab-utterance-001');
  assert.equal(result.sequence,7);
  assert.equal(result.isFinal,true);
  assert.equal(result.latencyMs,125);
  assert.equal(result.costUsd,0.001);
}

await assert.rejects(()=>transcribeSpeechQualitySample({
  providerId:'deepgram-nova-3',audio:new Uint8Array([1,2,3,4]),sourceLanguage:'ko-KR',
  sessionId:'lab-session-001',utteranceId:'lab-utterance-002',audioConsent:'',env:enabledEnv,
}),/speech_audio_consent_required/);

{
  let clock=0;const quota=createSpeechQualityQuota({limit:2,windowMs:1000,now:()=>clock});
  assert.deepEqual(quota.claim('user-1'),{allowed:true,remaining:1,retryAfterMs:0});
  assert.deepEqual(quota.claim('user-1'),{allowed:true,remaining:0,retryAfterMs:0});
  assert.deepEqual(quota.claim('user-1'),{allowed:false,remaining:0,retryAfterMs:1000});
  clock=1001;assert.deepEqual(quota.claim('user-1'),{allowed:true,remaining:1,retryAfterMs:0});
}

console.log('VOICEFLOW_SPEECH_QUALITY_LAB_SERVICE_PASS');
