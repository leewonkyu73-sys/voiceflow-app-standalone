export const SPEECH_PROVIDER_KIND=Object.freeze({
  BROWSER:'browser',
  API:'api',
  SELF_HOSTED:'self-hosted',
  TEXT:'text',
});

export const SPEECH_SESSION_STATE=Object.freeze({
  READY:'ready',
  LISTENING:'listening',
  ENDED:'ended',
});

const PROVIDER_ID=/^[a-z0-9][a-z0-9-]{1,63}$/;
const SESSION_ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$/;
const UTTERANCE_ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$/;
const LANGUAGE=/^[a-z]{2,3}(?:-[A-Z][A-Za-z0-9]{1,7})?$/;

function required(value,pattern,code){
  const text=String(value||'');
  if(!pattern.test(text))throw new TypeError(code);
  return text;
}

function immutableStrings(values=[]){
  return Object.freeze([...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))]);
}

export function createSpeechProviderDescriptor(input={}){
  const id=required(input.id,PROVIDER_ID,'speech_provider_id_invalid');
  const kind=String(input.kind||'');
  if(!Object.values(SPEECH_PROVIDER_KIND).includes(kind))throw new TypeError('speech_provider_kind_invalid');
  const uploadsAudio=Boolean(input.uploadsAudio);
  const requiresConsent=Boolean(input.requiresConsent);
  if(uploadsAudio&&!requiresConsent)throw new TypeError('speech_provider_audio_consent_contract_required');
  if(kind===SPEECH_PROVIDER_KIND.TEXT&&uploadsAudio)throw new TypeError('text_provider_cannot_upload_audio');
  return Object.freeze({
    id,
    label:String(input.label||id),
    kind,
    model:String(input.model||''),
    uploadsAudio,
    requiresConsent,
    supportsStreaming:Boolean(input.supportsStreaming),
    sourceLanguages:immutableStrings(input.sourceLanguages),
  });
}

export const SPEECH_PROVIDER_CANDIDATES=Object.freeze([
  createSpeechProviderDescriptor({
    id:'chrome-browser',label:'Chrome 브라우저 인식',kind:SPEECH_PROVIDER_KIND.BROWSER,
    uploadsAudio:false,requiresConsent:false,supportsStreaming:true,sourceLanguages:['ko-KR','vi-VN','en-US'],
  }),
  createSpeechProviderDescriptor({
    id:'google-chirp-3',label:'Google Chirp 3',kind:SPEECH_PROVIDER_KIND.API,model:'chirp_3',
    uploadsAudio:true,requiresConsent:true,supportsStreaming:true,sourceLanguages:['ko-KR','vi-VN','en-US'],
  }),
  createSpeechProviderDescriptor({
    id:'deepgram-nova-3',label:'Deepgram Nova-3',kind:SPEECH_PROVIDER_KIND.API,model:'nova-3',
    uploadsAudio:true,requiresConsent:true,supportsStreaming:true,sourceLanguages:['ko-KR','vi-VN','en-US'],
  }),
  createSpeechProviderDescriptor({
    id:'openai-transcribe',label:'OpenAI Transcribe',kind:SPEECH_PROVIDER_KIND.API,model:'gpt-transcribe',
    uploadsAudio:true,requiresConsent:true,supportsStreaming:true,sourceLanguages:['ko-KR','vi-VN','en-US'],
  }),
  createSpeechProviderDescriptor({
    id:'azure-speech',label:'Azure Speech',kind:SPEECH_PROVIDER_KIND.API,
    uploadsAudio:true,requiresConsent:true,supportsStreaming:true,sourceLanguages:['ko-KR','vi-VN','en-US'],
  }),
  createSpeechProviderDescriptor({
    id:'faster-whisper',label:'자가호스팅 faster-whisper',kind:SPEECH_PROVIDER_KIND.SELF_HOSTED,model:'large-v3',
    uploadsAudio:true,requiresConsent:true,supportsStreaming:false,sourceLanguages:['ko-KR','vi-VN','en-US'],
  }),
  createSpeechProviderDescriptor({
    id:'text-only',label:'텍스트 전용',kind:SPEECH_PROVIDER_KIND.TEXT,
    uploadsAudio:false,requiresConsent:false,supportsStreaming:false,sourceLanguages:['ko-KR','vi-VN','en-US'],
  }),
]);

export function createTranscriptionRequest({
  provider,
  sessionId,
  utteranceId,
  sourceLanguage,
  sequence=0,
  audioConsent='',
  ...unsupported
}={}){
  const descriptor=createSpeechProviderDescriptor(provider);
  if('targetLanguage'in unsupported||'translate'in unsupported||'translation'in unsupported){
    throw new TypeError('speech_request_must_not_translate');
  }
  if(descriptor.uploadsAudio&&audioConsent!=='session')throw new TypeError('speech_audio_consent_required');
  const parsedSequence=Number(sequence);
  if(!Number.isSafeInteger(parsedSequence)||parsedSequence<0)throw new TypeError('speech_sequence_invalid');
  return Object.freeze({
    providerId:descriptor.id,
    sessionId:required(sessionId,SESSION_ID,'speech_session_id_invalid'),
    utteranceId:required(utteranceId,UTTERANCE_ID,'speech_utterance_id_invalid'),
    sourceLanguage:required(sourceLanguage,LANGUAGE,'speech_source_language_invalid'),
    sequence:parsedSequence,
    audioConsent:descriptor.uploadsAudio?'session':'',
  });
}

export function createExclusiveSpeechProviderSession({provider,sessionId,audioConsent=''}={}){
  const descriptor=createSpeechProviderDescriptor(provider);
  const id=required(sessionId,SESSION_ID,'speech_session_id_invalid');
  if(descriptor.uploadsAudio&&audioConsent!=='session')throw new TypeError('speech_audio_consent_required');

  let state=SPEECH_SESSION_STATE.READY;
  let activeUtterance=null;
  let lastFinal=null;

  const snapshot=()=>Object.freeze({
    state,
    sessionId:id,
    providerId:descriptor.id,
    activeUtteranceId:activeUtterance?.utteranceId||'',
    lastFinal,
  });

  return Object.freeze({
    getSnapshot:snapshot,
    beginUtterance({utteranceId,sourceLanguage}={}){
      if(state===SPEECH_SESSION_STATE.ENDED)throw new Error('speech_session_ended');
      if(activeUtterance)throw new Error('speech_utterance_already_active');
      const request=createTranscriptionRequest({
        provider:descriptor,
        sessionId:id,
        utteranceId,
        sourceLanguage,
        sequence:0,
        audioConsent:descriptor.uploadsAudio?'session':'',
      });
      activeUtterance={...request,lastSequence:-1};
      state=SPEECH_SESSION_STATE.LISTENING;
      return request;
    },
    acceptResult(result={}){
      if(!activeUtterance)throw new Error('speech_utterance_not_active');
      if(String(result.providerId||'')!==descriptor.id)throw new Error('speech_provider_mismatch');
      if(String(result.sessionId||'')!==id)throw new Error('speech_session_mismatch');
      if(String(result.utteranceId||'')!==activeUtterance.utteranceId)throw new Error('speech_utterance_mismatch');
      const sequence=Number(result.sequence);
      if(!Number.isSafeInteger(sequence)||sequence<=activeUtterance.lastSequence)throw new Error('speech_result_stale');
      activeUtterance.lastSequence=sequence;
      if(result.isFinal!==true)return Object.freeze({accepted:false,reason:'interim'});

      const originalText=String(result.text??'');
      const noSpeech=Boolean(result.noSpeech);
      if(!noSpeech&&!originalText.trim())throw new Error('speech_final_text_empty');
      const final=Object.freeze({
        providerId:descriptor.id,
        sessionId:id,
        utteranceId:activeUtterance.utteranceId,
        sourceLanguage:activeUtterance.sourceLanguage,
        sequence,
        originalText,
        noSpeech,
        confidence:Number.isFinite(Number(result.confidence))?Number(result.confidence):null,
      });
      lastFinal=final;
      activeUtterance=null;
      state=SPEECH_SESSION_STATE.READY;
      return Object.freeze({accepted:!noSpeech,reason:noSpeech?'no_speech':'final',final});
    },
    cancelUtterance(reason='cancelled'){
      if(!activeUtterance)return snapshot();
      activeUtterance=null;
      state=SPEECH_SESSION_STATE.READY;
      return Object.freeze({...snapshot(),cancelReason:String(reason||'cancelled')});
    },
    end(){
      activeUtterance=null;
      state=SPEECH_SESSION_STATE.ENDED;
      return snapshot();
    },
  });
}
