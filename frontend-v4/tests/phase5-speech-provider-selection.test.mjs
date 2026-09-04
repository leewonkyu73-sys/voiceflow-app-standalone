import assert from 'node:assert/strict';

import {SPEECH_PROVIDER_CANDIDATES} from '../packages/speech-provider-contract/index.mjs';
import {SPEECH_ROUTE_PREFERENCE,selectSpeechProviderRoute} from '../packages/speech-provider-selection/index.mjs';

const byId=id=>SPEECH_PROVIDER_CANDIDATES.find(provider=>provider.id===id);
const providers=[
  {provider:byId('chrome-browser'),enabled:true,costPerAudioHourUsd:0},
  {provider:byId('google-chirp-3'),enabled:true,costPerAudioHourUsd:1.2},
  {provider:byId('deepgram-nova-3'),enabled:true,costPerAudioHourUsd:0.6},
  {provider:byId('text-only'),enabled:true,costPerAudioHourUsd:0},
];
const qualityReport={providers:[
  {providerId:'chrome-browser',status:'PASS',meanCer:0.1,p95LatencyMs:700,estimatedCostPerAudioHourUsd:0},
  {providerId:'google-chirp-3',status:'PASS',meanCer:0.03,p95LatencyMs:1000,estimatedCostPerAudioHourUsd:1.2},
  {providerId:'deepgram-nova-3',status:'PASS',meanCer:0.05,p95LatencyMs:500,estimatedCostPerAudioHourUsd:0.6},
]};

const quality=selectSpeechProviderRoute({
  preference:SPEECH_ROUTE_PREFERENCE.QUALITY,providers,qualityReport,audioConsent:'session',online:true,
});
assert.equal(quality.mode,'speech');
assert.equal(quality.provider.id,'google-chirp-3');
assert.equal(quality.reason,'best_verified_quality');

const economy=selectSpeechProviderRoute({
  preference:SPEECH_ROUTE_PREFERENCE.ECONOMY,providers,qualityReport,audioConsent:'session',online:true,
});
assert.equal(economy.provider.id,'chrome-browser');

const noConsent=selectSpeechProviderRoute({
  preference:SPEECH_ROUTE_PREFERENCE.QUALITY,
  providers:providers.filter(entry=>entry.provider.id!=='chrome-browser'),
  qualityReport,
  audioConsent:'',
  online:true,
});
assert.equal(noConsent.mode,'text');
assert.equal(noConsent.reason,'no_verified_provider');

const costCeiling=selectSpeechProviderRoute({
  preference:SPEECH_ROUTE_PREFERENCE.QUALITY,providers,qualityReport,audioConsent:'session',online:true,maxCostPerAudioHourUsd:0.7,
});
assert.equal(costCeiling.provider.id,'deepgram-nova-3');

const unverified=selectSpeechProviderRoute({
  preference:SPEECH_ROUTE_PREFERENCE.AUTO,
  providers,
  qualityReport:{providers:[{providerId:'google-chirp-3',status:'UNVERIFIED'}]},
  audioConsent:'session',
});
assert.equal(unverified.mode,'text','an unverified provider must never become the automatic default');

const text=selectSpeechProviderRoute({preference:SPEECH_ROUTE_PREFERENCE.TEXT,providers,qualityReport});
assert.equal(text.mode,'text');
assert.equal(text.provider.id,'text-only');

console.log('VOICEFLOW_V4_PHASE5_SPEECH_PROVIDER_SELECTION_PASS');
