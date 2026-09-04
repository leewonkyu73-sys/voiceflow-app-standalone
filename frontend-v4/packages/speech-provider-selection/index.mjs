import {createSpeechProviderDescriptor,SPEECH_PROVIDER_KIND} from '../speech-provider-contract/index.mjs';

export const SPEECH_ROUTE_PREFERENCE=Object.freeze({
  AUTO:'auto',
  QUALITY:'quality',
  ECONOMY:'economy',
  TEXT:'text',
});

function metric(value,fallback=Number.POSITIVE_INFINITY){
  if(value===null||value===undefined||value==='')return fallback;
  const number=Number(value);
  return Number.isFinite(number)&&number>=0?number:fallback;
}

function reportByProvider(report){
  return new Map((report?.providers||[]).map(result=>[result.providerId,result]));
}

function candidate(input,result,{online,audioConsent,maxCostPerAudioHourUsd}){
  const provider=createSpeechProviderDescriptor(input.provider||input);
  const configuredCost=metric(input.costPerAudioHourUsd,null);
  const measuredCost=metric(result?.estimatedCostPerAudioHourUsd,null);
  const costPerAudioHourUsd=configuredCost??measuredCost;
  const available=input.enabled!==false
    &&result?.status==='PASS'
    &&(!provider.uploadsAudio||(online&&audioConsent==='session'))
    &&(maxCostPerAudioHourUsd===null||costPerAudioHourUsd===null||costPerAudioHourUsd<=maxCostPerAudioHourUsd);
  return Object.freeze({
    provider,
    result,
    available,
    costPerAudioHourUsd,
    meanCer:metric(result?.meanCer),
    p95LatencyMs:metric(result?.p95LatencyMs),
  });
}

function qualityOrder(left,right){
  return (left.meanCer-right.meanCer)||(left.p95LatencyMs-right.p95LatencyMs)||left.provider.id.localeCompare(right.provider.id);
}

function economyOrder(left,right){
  const leftCost=left.provider.kind===SPEECH_PROVIDER_KIND.BROWSER?0:metric(left.costPerAudioHourUsd);
  const rightCost=right.provider.kind===SPEECH_PROVIDER_KIND.BROWSER?0:metric(right.costPerAudioHourUsd);
  return (leftCost-rightCost)||qualityOrder(left,right);
}

export function selectSpeechProviderRoute({
  preference=SPEECH_ROUTE_PREFERENCE.AUTO,
  providers=[],
  qualityReport,
  online=true,
  audioConsent='',
  maxCostPerAudioHourUsd=null,
}={}){
  const selectedPreference=Object.values(SPEECH_ROUTE_PREFERENCE).includes(preference)?preference:SPEECH_ROUTE_PREFERENCE.AUTO;
  const text=providers.map(entry=>createSpeechProviderDescriptor(entry.provider||entry)).find(provider=>provider.kind===SPEECH_PROVIDER_KIND.TEXT)||null;
  if(selectedPreference===SPEECH_ROUTE_PREFERENCE.TEXT){
    return Object.freeze({mode:'text',provider:text,reason:'text_requested'});
  }

  const reports=reportByProvider(qualityReport);
  const ceiling=maxCostPerAudioHourUsd!==null&&maxCostPerAudioHourUsd!==undefined&&maxCostPerAudioHourUsd!==''
    &&Number.isFinite(Number(maxCostPerAudioHourUsd))&&Number(maxCostPerAudioHourUsd)>=0
    ?Number(maxCostPerAudioHourUsd):null;
  const eligible=providers
    .map(entry=>candidate(entry,reports.get((entry.provider||entry).id),{online:Boolean(online),audioConsent,maxCostPerAudioHourUsd:ceiling}))
    .filter(entry=>entry.provider.kind!==SPEECH_PROVIDER_KIND.TEXT&&entry.available);
  if(!eligible.length)return Object.freeze({mode:'text',provider:text,reason:'no_verified_provider'});

  if(selectedPreference===SPEECH_ROUTE_PREFERENCE.ECONOMY)eligible.sort(economyOrder);
  else eligible.sort(qualityOrder);
  const winner=eligible[0];
  return Object.freeze({
    mode:'speech',
    provider:winner.provider,
    reason:selectedPreference===SPEECH_ROUTE_PREFERENCE.ECONOMY?'lowest_verified_cost':'best_verified_quality',
    quality:winner.result,
    costPerAudioHourUsd:winner.costPerAudioHourUsd,
  });
}
