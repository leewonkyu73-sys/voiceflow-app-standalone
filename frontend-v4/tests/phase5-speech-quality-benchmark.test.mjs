import assert from 'node:assert/strict';

import {SPEECH_PROVIDER_CANDIDATES} from '../packages/speech-provider-contract/index.mjs';
import {runSpeechQualityBenchmark,runSpeechQualitySuite} from '../packages/speech-quality-benchmark/index.mjs';
import {rankPassingSpeechProviders} from '../packages/speech-quality-evaluator/index.mjs';

const google=SPEECH_PROVIDER_CANDIDATES.find(provider=>provider.id==='google-chirp-3');
const deepgram=SPEECH_PROVIDER_CANDIDATES.find(provider=>provider.id==='deepgram-nova-3');
const sharedAudio=Object.freeze({fixture:'same-samsung-recording'});
const callOrder=[];
let active=0,maxActive=0,clock=0;
const provider=(descriptor,text,costUsd)=>({
  provider:descriptor,
  async transcribe({audio,request}){
    active+=1;
    maxActive=Math.max(maxActive,active);
    callOrder.push(`${request.providerId}:start`);
    assert.equal(audio,sharedAudio,'every provider must receive the exact same recording object');
    assert.equal('targetLanguage'in request,false,'STT benchmark must not request translation');
    await Promise.resolve();
    callOrder.push(`${request.providerId}:end`);
    active-=1;
    return {text,sequence:3,costUsd};
  },
});

const sample={
  sampleId:'samsung-001',sessionId:'qa-session-001',utteranceId:'qa-utterance-001',sourceLanguage:'ko-KR',
  kind:'speech',reference:'내일 오전 10시에 다시 만나요.',keywords:['내일','다시'],expectedSequence:3,audioDurationMs:5000,audio:sharedAudio,
};

await assert.rejects(()=>runSpeechQualityBenchmark({
  sample,providers:[provider(google,sample.reference,0.001)],now:()=>clock+=100,
}),/speech_audio_consent_required/);

const benchmark=await runSpeechQualityBenchmark({
  sample,
  providers:[
    provider(google,sample.reference,0.001),
    provider(deepgram,'내일 오전 11시에 다시 만나요.',0.0008),
  ],
  audioConsent:'session',
  now:()=>clock+=100,
});
assert.equal(maxActive,1,'provider comparison must run sequentially');
assert.deepEqual(callOrder,[
  'google-chirp-3:start','google-chirp-3:end','deepgram-nova-3:start','deepgram-nova-3:end',
]);
assert.equal(benchmark.results.length,2);
assert.equal(benchmark.results[0].transcript,sample.reference);
assert.equal(benchmark.results[1].numberMatch,false);

const suite=await runSpeechQualitySuite({
  samples:[sample],
  providers:[provider(google,sample.reference,0.001)],
  audioConsent:'session',
  gate:{minSpeechSamples:1,minSilenceSamples:0},
  now:()=>clock+=100,
});
assert.deepEqual(rankPassingSpeechProviders(suite),['google-chirp-3']);
const result=suite.providers[0];
assert.equal(result.status,'PASS');
assert.equal(result.costUsd,0.001);
assert.equal(result.estimatedCostPerAudioHourUsd,0.72);

const failed=await runSpeechQualitySuite({
  samples:[sample],
  providers:[{provider:deepgram,transcribe:async()=>{throw new Error('provider_unavailable')}}],
  audioConsent:'session',
  now:()=>clock+=100,
});
assert.equal(failed.providers[0].status,'FAIL');
assert.equal(failed.providers[0].emptySpeech,1);
assert.equal(failed.providers[0].errors,1);
assert.ok(failed.providers[0].failures.includes('provider_error'));

console.log('VOICEFLOW_V4_PHASE5_SPEECH_QUALITY_BENCHMARK_PASS');
