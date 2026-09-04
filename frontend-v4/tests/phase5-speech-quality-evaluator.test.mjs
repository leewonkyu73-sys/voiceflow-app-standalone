import assert from 'node:assert/strict';

import {
  SPEECH_SAMPLE_KIND,
  characterErrorRate,
  createSpeechQualityReport,
  evaluateSpeechSample,
  normalizeTranscript,
  rankPassingSpeechProviders,
} from '../packages/speech-quality-evaluator/index.mjs';

assert.equal(normalizeTranscript(' 오늘, 회의! '),'오늘회의');
assert.equal(characterErrorRate('오늘 회의를 시작합니다','오늘 회의를 시작합니다'),0);
assert.ok(characterErrorRate('오늘 회의를 시작합니다','내일 회의를 시작합니다')>0);

const samples=[
  {
    providerId:'quality-a',sampleId:'speech-1',kind:SPEECH_SAMPLE_KIND.SPEECH,
    reference:'오늘 회의를 시작합니다.',transcript:'오늘 회의를 시작합니다.',keywords:['회의'],latencyMs:820,expectedSequence:1,actualSequence:1,
  },
  {
    providerId:'quality-a',sampleId:'speech-2',kind:SPEECH_SAMPLE_KIND.SPEECH,
    reference:'내일 오전 10시에 다시 만나요.',transcript:'내일 오전 10시에 다시 만나요.',keywords:['내일','다시'],latencyMs:1100,expectedSequence:2,actualSequence:2,
  },
  {
    providerId:'quality-a',sampleId:'speech-3',kind:SPEECH_SAMPLE_KIND.SPEECH,
    reference:'발주 수량은 250개입니다.',transcript:'발주 수량은 250개입니다.',keywords:['발주','수량'],latencyMs:900,expectedSequence:3,actualSequence:3,
  },
  {
    providerId:'quality-a',sampleId:'speech-4',kind:SPEECH_SAMPLE_KIND.SPEECH,
    reference:'배송은 다음 주 월요일입니다.',transcript:'배송은 다음 주 월요일입니다.',keywords:['배송','월요일'],latencyMs:1000,expectedSequence:4,actualSequence:4,
  },
  {
    providerId:'quality-a',sampleId:'silence-1',kind:SPEECH_SAMPLE_KIND.SILENCE,
    reference:'',transcript:'',latencyMs:500,
  },
  {
    providerId:'hallucinating-b',sampleId:'speech-1',kind:SPEECH_SAMPLE_KIND.SPEECH,
    reference:'오늘 회의를 시작합니다.',transcript:'오늘 회의를 시작합니다.',keywords:['회의'],latencyMs:700,
  },
  {
    providerId:'hallucinating-b',sampleId:'silence-1',kind:SPEECH_SAMPLE_KIND.SILENCE,
    reference:'',transcript:'수고하셨습니다.',latencyMs:400,
  },
];

const silenceFailure=evaluateSpeechSample(samples.at(-1));
assert.equal(silenceFailure.hallucination,true);

const report=createSpeechQualityReport(samples);
const quality=report.providers.find(provider=>provider.providerId==='quality-a');
const hallucinating=report.providers.find(provider=>provider.providerId==='hallucinating-b');
assert.equal(quality.status,'PASS');
assert.equal(quality.hallucinations,0);
assert.equal(quality.numberErrors,0);
assert.equal(quality.meanCer,0);
assert.equal(quality.keywordRecall,1);
assert.equal(quality.p95LatencyMs,1100);
assert.equal(hallucinating.status,'FAIL');
assert.deepEqual(hallucinating.failures,['hallucination']);
assert.deepEqual(rankPassingSpeechProviders(report),['quality-a']);

const unverified=createSpeechQualityReport([{
  providerId:'silence-only',sampleId:'silence-1',kind:SPEECH_SAMPLE_KIND.SILENCE,reference:'',transcript:'',latencyMs:100,
}]);
assert.equal(unverified.providers[0].status,'UNVERIFIED');
assert.deepEqual(unverified.providers[0].coverageFailures,['speech_samples']);

const numberFailure=createSpeechQualityReport([{
  providerId:'number-bad',sampleId:'speech-1',kind:SPEECH_SAMPLE_KIND.SPEECH,
  reference:'내일 오전 10시에 250만 원을 송금합니다.',transcript:'내일 오전 11시에 250만 원을 송금합니다.',latencyMs:1000,
}]);
assert.equal(numberFailure.providers[0].status,'FAIL');
assert.ok(numberFailure.providers[0].failures.includes('numbers'));

console.log('VOICEFLOW_V4_PHASE5_SPEECH_QUALITY_EVALUATOR_PASS');
