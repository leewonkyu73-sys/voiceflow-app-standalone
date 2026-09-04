import {createSpeechProviderDescriptor,SPEECH_PROVIDER_KIND} from '../frontend-v4/packages/speech-provider-contract/index.mjs';

function required(value,code){
  const text=String(value||'').trim();
  if(!text)throw new TypeError(code);
  return text;
}

async function responseJson(response,providerId){
  let payload={};
  try{payload=await response.json()}catch{}
  if(!response?.ok){
    const status=Number(response?.status||0);
    const detail=String(payload?.error?.message||payload?.message||payload?.err_msg||`http_${status}`);
    const error=new Error(`${providerId}_request_failed:${detail}`);
    error.code=`${providerId}_request_failed`;
    error.status=status;
    throw error;
  }
  return payload;
}

function assertRequest(request,providerId){
  if(String(request?.providerId||'')!==providerId)throw new TypeError('speech_quality_provider_request_mismatch');
  if(request?.audioConsent!=='session')throw new TypeError('speech_audio_consent_required');
  if('targetLanguage'in(request||{})||'translation'in(request||{}))throw new TypeError('speech_request_must_not_translate');
  required(request?.sourceLanguage,'speech_source_language_invalid');
  return request;
}

function contentType(audio,fallback='audio/webm'){
  const value=String(audio?.type||fallback).split(';')[0];
  return value.startsWith('audio/')?value:fallback;
}

function audioBytes(audio){
  if(Buffer.isBuffer(audio))return audio;
  if(audio instanceof Uint8Array)return Buffer.from(audio.buffer,audio.byteOffset,audio.byteLength);
  if(audio instanceof ArrayBuffer)return Buffer.from(audio);
  throw new TypeError('speech_audio_bytes_required');
}

function audioBlob(audio,type){
  if(typeof Blob!=='function')throw new TypeError('speech_audio_blob_unavailable');
  if(audio instanceof Blob)return audio;
  return new Blob([audioBytes(audio)],{type});
}

function average(values){
  const finite=values.map(Number).filter(Number.isFinite).filter(value=>value>0);
  return finite.length?finite.reduce((sum,value)=>sum+value,0)/finite.length:null;
}

export function createDeepgramNova3Adapter({apiKey,transport=fetch,model='nova-3',smartFormat=true}={}){
  const secret=required(apiKey,'deepgram_api_key_required');
  if(typeof transport!=='function')throw new TypeError('speech_provider_transport_required');
  const provider=createSpeechProviderDescriptor({
    id:'deepgram-nova-3',label:'Deepgram Nova-3',kind:SPEECH_PROVIDER_KIND.API,model,
    uploadsAudio:true,requiresConsent:true,supportsStreaming:true,sourceLanguages:['ko-KR','vi-VN','en-US'],
  });
  return Object.freeze({
    provider,
    async transcribe({audio,request,mimeType='audio/webm'}={}){
      const contract=assertRequest(request,provider.id);
      const url=new URL('https://api.deepgram.com/v1/listen');
      url.searchParams.set('model',model);
      url.searchParams.set('language',contract.sourceLanguage);
      url.searchParams.set('smart_format',smartFormat?'true':'false');
      const payload=await responseJson(await transport(url,{method:'POST',headers:{authorization:`Token ${secret}`,'content-type':contentType(audio,mimeType)},body:audio}),provider.id);
      const alternative=payload?.results?.channels?.[0]?.alternatives?.[0]||{};
      return Object.freeze({
        text:String(alternative.transcript??''),
        confidence:Number.isFinite(Number(alternative.confidence))?Number(alternative.confidence):null,
        providerId:provider.id,
        model,
        noSpeech:!String(alternative.transcript??'').trim(),
      });
    },
  });
}

export function createOpenAITranscribeAdapter({apiKey,transport=fetch,model='gpt-transcribe'}={}){
  const secret=required(apiKey,'openai_api_key_required');
  if(typeof transport!=='function')throw new TypeError('speech_provider_transport_required');
  const provider=createSpeechProviderDescriptor({
    id:'openai-transcribe',label:'OpenAI Transcribe',kind:SPEECH_PROVIDER_KIND.API,model,
    uploadsAudio:true,requiresConsent:true,supportsStreaming:true,sourceLanguages:['ko-KR','vi-VN','en-US'],
  });
  return Object.freeze({
    provider,
    async transcribe({audio,request,mimeType='audio/webm'}={}){
      const contract=assertRequest(request,provider.id),type=contentType(audio,mimeType);
      const extension=type.includes('mp4')?'m4a':type.includes('mpeg')?'mp3':type.includes('wav')?'wav':'webm';
      const form=new FormData();
      form.set('file',audioBlob(audio,type),`quality-sample.${extension}`);
      form.set('model',model);
      form.set('language',contract.sourceLanguage.split('-')[0]);
      const payload=await responseJson(await transport('https://api.openai.com/v1/audio/transcriptions',{
        method:'POST',headers:{authorization:`Bearer ${secret}`},body:form,
      }),provider.id);
      const text=String(payload?.text??'');
      return Object.freeze({text,confidence:null,providerId:provider.id,model,noSpeech:!text.trim()});
    },
  });
}

export function createGoogleChirp3Adapter({
  projectId,
  accessToken,
  getAccessToken,
  transport=fetch,
  location='global',
  recognizer='_',
  model='chirp_3',
}={}){
  const project=required(projectId,'google_speech_project_required');
  const tokenProvider=typeof getAccessToken==='function'?getAccessToken:async()=>required(accessToken,'google_speech_access_token_required');
  if(typeof transport!=='function')throw new TypeError('speech_provider_transport_required');
  const provider=createSpeechProviderDescriptor({
    id:'google-chirp-3',label:'Google Chirp 3',kind:SPEECH_PROVIDER_KIND.API,model,
    uploadsAudio:true,requiresConsent:true,supportsStreaming:true,sourceLanguages:['ko-KR','vi-VN','en-US'],
  });
  return Object.freeze({
    provider,
    async transcribe({audio,request}={}){
      const contract=assertRequest(request,provider.id);
      const token=required(await tokenProvider(),'google_speech_access_token_required');
      const name=`projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/recognizers/${encodeURIComponent(recognizer)}`;
      const url=`https://speech.googleapis.com/v2/${name}:recognize`;
      const payload=await responseJson(await transport(url,{
        method:'POST',
        headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
        body:JSON.stringify({
          config:{autoDecodingConfig:{},languageCodes:[contract.sourceLanguage],model,features:{enableAutomaticPunctuation:true}},
          content:audioBytes(audio).toString('base64'),
        }),
      }),provider.id);
      const alternatives=(payload?.results||[]).map(result=>result?.alternatives?.[0]).filter(Boolean);
      const text=alternatives.map(alternative=>String(alternative.transcript??'')).join('');
      return Object.freeze({
        text,
        confidence:average(alternatives.map(alternative=>alternative.confidence)),
        providerId:provider.id,
        model,
        noSpeech:!text.trim(),
      });
    },
  });
}
