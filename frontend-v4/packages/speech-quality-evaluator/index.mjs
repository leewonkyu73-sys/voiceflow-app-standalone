export const SPEECH_SAMPLE_KIND=Object.freeze({
  SPEECH:'speech',
  SILENCE:'silence',
});

export const DEFAULT_SPEECH_QUALITY_GATE=Object.freeze({
  minSpeechSamples:4,
  minSilenceSamples:1,
  maxHallucinations:0,
  maxEmptySpeech:0,
  maxSequenceErrors:0,
  maxNumberErrors:0,
  maxMeanCer:0.12,
  minKeywordRecall:0.95,
  maxP95LatencyMs:2500,
});

function asFinite(value){
  const number=Number(value);
  return Number.isFinite(number)&&number>=0?number:null;
}

export function normalizeTranscript(value){
  return String(value??'')
    .normalize('NFKC')
    .toLocaleLowerCase('und')
    .replace(/[^\p{L}\p{N}]+/gu,'');
}

function editDistance(left,right){
  const a=[...left],b=[...right];
  if(!a.length)return b.length;
  if(!b.length)return a.length;
  let previous=Array.from({length:b.length+1},(_,index)=>index);
  for(let row=1;row<=a.length;row+=1){
    const current=[row];
    for(let column=1;column<=b.length;column+=1){
      current[column]=Math.min(
        current[column-1]+1,
        previous[column]+1,
        previous[column-1]+(a[row-1]===b[column-1]?0:1),
      );
    }
    previous=current;
  }
  return previous[b.length];
}

export function characterErrorRate(reference,hypothesis){
  const expected=normalizeTranscript(reference),actual=normalizeTranscript(hypothesis);
  if(!expected)return actual?1:0;
  return editDistance(expected,actual)/[...expected].length;
}

function numberTokens(value){
  return String(value??'').normalize('NFKC').match(/\p{N}+(?:[.,:/-]\p{N}+)*/gu)||[];
}

function sameList(left,right){
  return left.length===right.length&&left.every((value,index)=>value===right[index]);
}

export function evaluateSpeechSample(input={}){
  const kind=String(input.kind||'');
  if(!Object.values(SPEECH_SAMPLE_KIND).includes(kind))throw new TypeError('speech_sample_kind_invalid');
  const providerId=String(input.providerId||'').trim();
  const sampleId=String(input.sampleId||'').trim();
  if(!providerId)throw new TypeError('speech_sample_provider_required');
  if(!sampleId)throw new TypeError('speech_sample_id_required');

  const reference=String(input.reference??'');
  const transcript=String(input.transcript??'');
  const normalizedTranscript=normalizeTranscript(transcript);
  const hallucination=kind===SPEECH_SAMPLE_KIND.SILENCE&&Boolean(normalizedTranscript);
  const emptySpeech=kind===SPEECH_SAMPLE_KIND.SPEECH&&!normalizedTranscript;
  const keywords=[...new Set((input.keywords||[]).map(normalizeTranscript).filter(Boolean))];
  const keywordHits=keywords.filter(keyword=>normalizedTranscript.includes(keyword)).length;
  const expectedNumbers=numberTokens(reference),actualNumbers=numberTokens(transcript);
  const numberMatch=sameList(expectedNumbers,actualNumbers);
  const expectedSequence=asFinite(input.expectedSequence),actualSequence=asFinite(input.actualSequence);
  const sequenceMatch=expectedSequence===null||actualSequence===null||expectedSequence===actualSequence;

  return Object.freeze({
    providerId,
    sampleId,
    kind,
    reference,
    transcript,
    cer:kind===SPEECH_SAMPLE_KIND.SPEECH?characterErrorRate(reference,transcript):null,
    hallucination,
    emptySpeech,
    keywordHits,
    keywordTotal:keywords.length,
    numberMatch,
    expectedNumbers:Object.freeze(expectedNumbers),
    actualNumbers:Object.freeze(actualNumbers),
    sequenceMatch,
    latencyMs:asFinite(input.latencyMs),
    audioDurationMs:asFinite(input.audioDurationMs),
    costUsd:asFinite(input.costUsd),
    error:String(input.error||''),
  });
}

function percentile(values,fraction){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const index=Math.max(0,Math.ceil(sorted.length*fraction)-1);
  return sorted[index];
}

function round(value,digits=4){
  if(value===null)return null;
  const factor=10**digits;
  return Math.round(value*factor)/factor;
}

function providerReport(providerId,records,gate){
  const speech=records.filter(record=>record.kind===SPEECH_SAMPLE_KIND.SPEECH);
  const silence=records.filter(record=>record.kind===SPEECH_SAMPLE_KIND.SILENCE);
  const latencies=records.map(record=>record.latencyMs).filter(value=>value!==null);
  const audioDurationMs=records.reduce((sum,record)=>sum+(record.audioDurationMs||0),0);
  const knownCosts=records.map(record=>record.costUsd).filter(value=>value!==null);
  const costUsd=knownCosts.length?knownCosts.reduce((sum,value)=>sum+value,0):null;
  const keywordHits=records.reduce((sum,record)=>sum+record.keywordHits,0);
  const keywordTotal=records.reduce((sum,record)=>sum+record.keywordTotal,0);
  const hallucinations=records.filter(record=>record.hallucination).length;
  const emptySpeech=records.filter(record=>record.emptySpeech).length;
  const sequenceErrors=records.filter(record=>!record.sequenceMatch).length;
  const numberErrors=speech.filter(record=>!record.numberMatch).length;
  const meanCer=speech.length?speech.reduce((sum,record)=>sum+record.cer,0)/speech.length:null;
  const keywordRecall=keywordTotal?keywordHits/keywordTotal:null;
  const p95LatencyMs=percentile(latencies,0.95);
  const failures=[];
  if(records.some(record=>record.error))failures.push('provider_error');
  if(hallucinations>gate.maxHallucinations)failures.push('hallucination');
  if(emptySpeech>gate.maxEmptySpeech)failures.push('empty_speech');
  if(sequenceErrors>gate.maxSequenceErrors)failures.push('sequence');
  if(numberErrors>gate.maxNumberErrors)failures.push('numbers');
  if(meanCer!==null&&meanCer>gate.maxMeanCer)failures.push('cer');
  if(keywordRecall!==null&&keywordRecall<gate.minKeywordRecall)failures.push('keywords');
  if(p95LatencyMs!==null&&p95LatencyMs>gate.maxP95LatencyMs)failures.push('latency');
  const coverageFailures=[];
  if(speech.length<gate.minSpeechSamples)coverageFailures.push('speech_samples');
  if(silence.length<gate.minSilenceSamples)coverageFailures.push('silence_samples');
  const verified=coverageFailures.length===0&&latencies.length===records.length;
  return Object.freeze({
    providerId,
    status:failures.length?'FAIL':verified?'PASS':'UNVERIFIED',
    samples:records.length,
    speechSamples:speech.length,
    silenceSamples:silence.length,
    hallucinations,
    emptySpeech,
    sequenceErrors,
    numberErrors,
    meanCer:round(meanCer),
    keywordRecall:round(keywordRecall),
    p50LatencyMs:percentile(latencies,0.5),
    p95LatencyMs,
    audioDurationMs,
    costUsd:round(costUsd,6),
    estimatedCostPerAudioHourUsd:costUsd!==null&&audioDurationMs>0?round(costUsd/(audioDurationMs/3600000),4):null,
    errors:records.filter(record=>record.error).length,
    coverageFailures:Object.freeze(coverageFailures),
    failures:Object.freeze(failures),
  });
}

export function createSpeechQualityReport(samples=[],gateOverrides={}){
  const gate=Object.freeze({...DEFAULT_SPEECH_QUALITY_GATE,...gateOverrides});
  const evaluated=samples.map(sample=>Object.isFrozen(sample)&&'cer'in sample?sample:evaluateSpeechSample(sample));
  const grouped=new Map();
  for(const sample of evaluated){
    const group=grouped.get(sample.providerId)||[];
    group.push(sample);
    grouped.set(sample.providerId,group);
  }
  const providers=[...grouped.entries()]
    .map(([providerId,records])=>providerReport(providerId,records,gate))
    .sort((left,right)=>left.providerId.localeCompare(right.providerId));
  return Object.freeze({gate,providers:Object.freeze(providers),samples:Object.freeze(evaluated)});
}

export function rankPassingSpeechProviders(report){
  return Object.freeze((report?.providers||[])
    .filter(provider=>provider.status==='PASS')
    .sort((left,right)=>(left.meanCer-right.meanCer)||(left.p95LatencyMs-right.p95LatencyMs)||left.providerId.localeCompare(right.providerId))
    .map(provider=>provider.providerId));
}
