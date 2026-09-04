import {createTranscriptionRequest} from '../speech-provider-contract/index.mjs';
import {createSpeechQualityReport,evaluateSpeechSample} from '../speech-quality-evaluator/index.mjs';

function requiredText(value,code){
  const text=String(value||'').trim();
  if(!text)throw new TypeError(code);
  return text;
}

function providerAdapter(entry={}){
  if(!entry.provider)throw new TypeError('speech_benchmark_provider_required');
  if(typeof entry.transcribe!=='function')throw new TypeError('speech_benchmark_transcribe_required');
  return Object.freeze({provider:entry.provider,transcribe:entry.transcribe});
}

function errorCode(error){
  return String(error?.code||error?.message||error||'speech_benchmark_provider_failed');
}

export function createSpeechBenchmarkSample(input={}){
  const sampleId=requiredText(input.sampleId,'speech_benchmark_sample_id_required');
  const sessionId=requiredText(input.sessionId,'speech_benchmark_session_id_required');
  const utteranceId=requiredText(input.utteranceId,'speech_benchmark_utterance_id_required');
  const sourceLanguage=requiredText(input.sourceLanguage,'speech_benchmark_source_language_required');
  if(input.audio===null||input.audio===undefined)throw new TypeError('speech_benchmark_audio_required');
  return Object.freeze({
    sampleId,
    sessionId,
    utteranceId,
    sourceLanguage,
    kind:String(input.kind||'speech'),
    reference:String(input.reference??''),
    keywords:Object.freeze([...(input.keywords||[])]),
    expectedSequence:Number.isSafeInteger(Number(input.expectedSequence))?Number(input.expectedSequence):0,
    audioDurationMs:Number.isFinite(Number(input.audioDurationMs))?Math.max(0,Number(input.audioDurationMs)):null,
    audio:input.audio,
  });
}

export async function runSpeechQualityBenchmark({
  sample:sampleInput,
  providers:providerInputs=[],
  audioConsent='',
  now=()=>performance.now(),
}={}){
  const sample=createSpeechBenchmarkSample(sampleInput);
  const providers=providerInputs.map(providerAdapter);
  if(!providers.length)throw new TypeError('speech_benchmark_providers_required');
  const results=[];

  for(let index=0;index<providers.length;index+=1){
    const entry=providers[index];
    const request=createTranscriptionRequest({
      provider:entry.provider,
      sessionId:sample.sessionId,
      utteranceId:sample.utteranceId,
      sourceLanguage:sample.sourceLanguage,
      sequence:sample.expectedSequence,
      audioConsent,
    });
    const started=Number(now());
    try{
      const response=await entry.transcribe(Object.freeze({audio:sample.audio,request}));
      const finished=Number(now());
      results.push(evaluateSpeechSample({
        providerId:request.providerId,
        sampleId:sample.sampleId,
        kind:sample.kind,
        reference:sample.reference,
        transcript:String(response?.text??''),
        keywords:sample.keywords,
        latencyMs:Math.max(0,finished-started),
        audioDurationMs:sample.audioDurationMs,
        costUsd:response?.costUsd,
        expectedSequence:sample.expectedSequence,
        actualSequence:Number.isSafeInteger(Number(response?.sequence))?Number(response.sequence):sample.expectedSequence,
      }));
    }catch(error){
      const finished=Number(now());
      results.push(evaluateSpeechSample({
        providerId:request.providerId,
        sampleId:sample.sampleId,
        kind:sample.kind,
        reference:sample.reference,
        transcript:'',
        keywords:sample.keywords,
        latencyMs:Math.max(0,finished-started),
        audioDurationMs:sample.audioDurationMs,
        expectedSequence:sample.expectedSequence,
        actualSequence:sample.expectedSequence,
        error:errorCode(error),
      }));
    }
  }

  return Object.freeze({sample,results:Object.freeze(results)});
}

export async function runSpeechQualitySuite({
  samples=[],
  providers=[],
  audioConsent='',
  gate={},
  now,
}={}){
  const results=[];
  for(const sample of samples){
    const benchmark=await runSpeechQualityBenchmark({sample,providers,audioConsent,now});
    results.push(...benchmark.results);
  }
  return createSpeechQualityReport(results,gate);
}
