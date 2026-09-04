import {
  SPEECH_PROVIDER_CANDIDATES,
  SPEECH_PROVIDER_KIND,
  createTranscriptionRequest,
} from '../frontend-v4/packages/speech-provider-contract/index.mjs';
import {
  createDeepgramNova3Adapter,
  createGoogleChirp3Adapter,
  createOpenAITranscribeAdapter,
} from './speech-quality-provider-adapters.mjs';

const IMPLEMENTED_PROVIDER_IDS=Object.freeze([
  'google-chirp-3',
  'deepgram-nova-3',
  'openai-transcribe',
]);

const PROVIDER_ENV=Object.freeze({
  'google-chirp-3':Object.freeze({
    required:['GOOGLE_SPEECH_PROJECT_ID','GOOGLE_SPEECH_ACCESS_TOKEN'],
    price:'VOICEFLOW_GOOGLE_CHIRP3_USD_PER_MINUTE',
  }),
  'deepgram-nova-3':Object.freeze({
    required:['DEEPGRAM_API_KEY'],
    price:'VOICEFLOW_DEEPGRAM_NOVA3_USD_PER_MINUTE',
  }),
  'openai-transcribe':Object.freeze({
    required:['OPENAI_API_KEY'],
    price:'VOICEFLOW_OPENAI_TRANSCRIBE_USD_PER_MINUTE',
  }),
  'azure-speech':Object.freeze({
    required:['AZURE_SPEECH_KEY','AZURE_SPEECH_REGION'],
    price:'VOICEFLOW_AZURE_SPEECH_USD_PER_MINUTE',
  }),
  'faster-whisper':Object.freeze({
    required:['FASTER_WHISPER_BASE_URL'],
    price:'VOICEFLOW_FASTER_WHISPER_USD_PER_MINUTE',
  }),
});

const PROVIDERS=new Map(SPEECH_PROVIDER_CANDIDATES
  .filter(provider=>provider.kind===SPEECH_PROVIDER_KIND.API||provider.kind===SPEECH_PROVIDER_KIND.SELF_HOSTED)
  .map(provider=>[provider.id,provider]));

function value(env,key){
  return String(env?.[key]||'').trim();
}

function allowlist(env){
  return new Set(value(env,'VOICEFLOW_SPEECH_QUALITY_PROVIDER_ALLOWLIST')
    .split(',').map(item=>item.trim()).filter(Boolean));
}

function nonNegative(valueInput){
  if(valueInput===null||valueInput===undefined||valueInput==='')return null;
  const parsed=Number(valueInput);
  return Number.isFinite(parsed)&&parsed>=0?parsed:null;
}

function descriptor(providerId){
  const provider=PROVIDERS.get(String(providerId||''));
  if(!provider){
    const error=new Error('speech_quality_provider_unknown');
    error.code='speech_quality_provider_unknown';
    throw error;
  }
  return provider;
}

function configuration(providerId,env){
  const setup=PROVIDER_ENV[providerId]||{required:[],price:''};
  const missing=setup.required.filter(key=>!value(env,key));
  return Object.freeze({
    configured:missing.length===0,
    missing:Object.freeze(missing),
    costPerMinuteUsd:nonNegative(value(env,setup.price)),
  });
}

export function speechQualityLabFlags(env=process.env){
  return Object.freeze({
    labEnabled:value(env,'VOICEFLOW_SPEECH_QUALITY_LAB_ENABLED')==='1',
    apiEnabled:value(env,'VOICEFLOW_SPEECH_QUALITY_API_ENABLED')==='1',
  });
}

export function speechQualityProviderStatus(env=process.env){
  const flags=speechQualityLabFlags(env),allowed=allowlist(env);
  return Object.freeze([...PROVIDERS.values()].map(provider=>{
    const implemented=IMPLEMENTED_PROVIDER_IDS.includes(provider.id);
    const setup=configuration(provider.id,env);
    const allowlisted=allowed.has(provider.id);
    const enabled=flags.labEnabled&&flags.apiEnabled&&implemented&&setup.configured&&allowlisted;
    const reason=!flags.labEnabled?'lab_disabled'
      :!flags.apiEnabled?'api_disabled'
        :!implemented?'implementation_pending'
          :!allowlisted?'not_allowlisted'
            :!setup.configured?'setup_required':'ready';
    return Object.freeze({
      id:provider.id,
      label:provider.label,
      model:provider.model,
      kind:provider.kind,
      sourceLanguages:provider.sourceLanguages,
      implemented,
      configured:setup.configured,
      allowlisted,
      enabled,
      reason,
      costPerMinuteUsd:setup.costPerMinuteUsd,
    });
  }));
}

export function createSpeechQualityAdapter(providerId,{env=process.env,transport=fetch}={}){
  const provider=descriptor(providerId);
  const status=speechQualityProviderStatus(env).find(item=>item.id===provider.id);
  if(!status?.enabled){
    const error=new Error(`speech_quality_provider_unavailable:${status?.reason||'unknown'}`);
    error.code='speech_quality_provider_unavailable';
    error.reason=status?.reason||'unknown';
    throw error;
  }
  if(provider.id==='google-chirp-3')return createGoogleChirp3Adapter({
    projectId:value(env,'GOOGLE_SPEECH_PROJECT_ID'),
    accessToken:value(env,'GOOGLE_SPEECH_ACCESS_TOKEN'),
    location:value(env,'GOOGLE_SPEECH_LOCATION')||'global',
    recognizer:value(env,'GOOGLE_SPEECH_RECOGNIZER')||'_',
    transport,
  });
  if(provider.id==='deepgram-nova-3')return createDeepgramNova3Adapter({
    apiKey:value(env,'DEEPGRAM_API_KEY'),transport,
  });
  if(provider.id==='openai-transcribe')return createOpenAITranscribeAdapter({
    apiKey:value(env,'OPENAI_API_KEY'),transport,
  });
  const error=new Error('speech_quality_provider_not_implemented');
  error.code='speech_quality_provider_not_implemented';
  throw error;
}

export async function transcribeSpeechQualitySample({
  providerId,
  audio,
  mimeType='audio/webm',
  sourceLanguage='ko-KR',
  sessionId,
  utteranceId,
  sequence=0,
  audioConsent='',
  audioDurationMs=null,
  env=process.env,
  transport=fetch,
  now=()=>performance.now(),
}={}){
  const adapter=createSpeechQualityAdapter(providerId,{env,transport});
  const request=createTranscriptionRequest({
    provider:adapter.provider,
    sessionId,
    utteranceId,
    sourceLanguage,
    sequence,
    audioConsent,
  });
  const started=Number(now());
  const result=await adapter.transcribe({audio,mimeType,request});
  const latencyMs=Math.max(0,Number(now())-started);
  const duration=nonNegative(audioDurationMs);
  const rate=speechQualityProviderStatus(env).find(item=>item.id===adapter.provider.id)?.costPerMinuteUsd??null;
  const costUsd=rate!==null&&duration!==null?rate*(duration/60000):null;
  return Object.freeze({
    providerId:adapter.provider.id,
    model:adapter.provider.model,
    sessionId:request.sessionId,
    utteranceId:request.utteranceId,
    sequence:request.sequence,
    sourceLanguage:request.sourceLanguage,
    isFinal:true,
    originalText:String(result?.text??''),
    confidence:Number.isFinite(Number(result?.confidence))?Number(result.confidence):null,
    noSpeech:Boolean(result?.noSpeech),
    latencyMs,
    costUsd,
  });
}

export function createSpeechQualityQuota({limit=30,windowMs=60*60*1000,now=Date.now}={}){
  const maximum=Math.max(1,Math.min(300,Number(limit)||30));
  const period=Math.max(1000,Number(windowMs)||60*60*1000);
  const buckets=new Map();
  return Object.freeze({
    claim(key){
      const id=String(key||'anonymous'),timestamp=Number(now());
      const current=buckets.get(id);
      const bucket=!current||timestamp-current.startedAt>=period?{startedAt:timestamp,count:0}:current;
      if(bucket.count>=maximum){
        return Object.freeze({allowed:false,remaining:0,retryAfterMs:Math.max(0,period-(timestamp-bucket.startedAt))});
      }
      bucket.count+=1;
      buckets.set(id,bucket);
      return Object.freeze({allowed:true,remaining:maximum-bucket.count,retryAfterMs:0});
    },
  });
}
