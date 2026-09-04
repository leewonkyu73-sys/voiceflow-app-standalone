export const MOBILE_SPEECH_STATE=Object.freeze({
  IDLE:'idle',
  RECORDING:'recording',
  TRANSCRIBING:'transcribing',
  COMMITTING:'committing',
  COMPLETED:'completed',
  RECOVERABLE_ERROR:'recoverable_error',
  FATAL_ERROR:'fatal_error',
  STOPPED:'stopped',
});

export class MobileTranscriptionError extends Error{
  constructor(code,{status=0,retryable=false,payload=null}={}){
    super(code);
    this.name='MobileTranscriptionError';
    this.code=code;
    this.status=status;
    this.retryable=retryable;
    this.payload=payload;
  }
}

function assertMeetingId(value){
  const id=String(value||'');
  if(!/^mtg_[A-Za-z0-9_]+$/.test(id))throw new MobileTranscriptionError('invalid_meeting_id');
  return id;
}

async function decode(response){
  const status=Number(response?.status||0);
  let payload;
  try{payload=await response.json()}catch{
    throw new MobileTranscriptionError('invalid_transcription_response',{status,retryable:status>=500});
  }
  if(!response.ok){
    const code=String(payload?.error||payload?.detail||`transcription_http_${status}`);
    throw new MobileTranscriptionError(code,{status,retryable:status===408||status===429||status>=500,payload});
  }
  return payload;
}

export function createMobileTranscriptionAdapter({transport,client='v4-mobile',audioConsent=''}={}){
  if(typeof transport!=='function')throw new TypeError('mobile_transcription_transport_required');
  return Object.freeze({
    async transcribe({meetingId,audio,mimeType='audio/webm',language='ko-KR'}={}){
      const id=assertMeetingId(meetingId),type=String(mimeType||audio?.type||'audio/webm').split(';')[0];
      if(!type.startsWith('audio/'))throw new MobileTranscriptionError('audio_required');
      if(!audio||Number(audio.size||0)<=0)throw new MobileTranscriptionError('audio_empty');
      const headers={'content-type':type,'x-voice-language':String(language||'ko-KR'),'x-voice-client':String(client||'v4-mobile')};
      if(audioConsent)headers['x-voice-audio-consent']=String(audioConsent);
      const payload=await decode(await transport(`/api/v1/meetings/${id}/transcribe`,{
        method:'POST',
        headers,
        body:audio,
      }));
      return Object.freeze({
        text:String(payload.text||'').trim(),
        provider:String(payload.provider||'unknown'),
        model:String(payload.model||''),
        language:String(payload.language||language||'ko-KR'),
      });
    },
  });
}

function errorCode(error){
  return String(error?.code||error?.message||error||'speech_session_failed');
}

export function createMobileSpeechSession({
  meetingId:meetingIdValue,
  mediaSession,
  captionSession,
  transcribe,
  createRecorder,
  createAudioBlob,
  minBytes=800,
  autoFinalizeMs=6000,
  now=()=>Date.now(),
}={}){
  const id=assertMeetingId(meetingIdValue);
  if(typeof mediaSession?.getSnapshot!=='function'||typeof mediaSession?.getStream!=='function')throw new TypeError('mobile_speech_media_session_required');
  if(typeof captionSession?.submit!=='function')throw new TypeError('mobile_speech_caption_session_required');
  if(typeof transcribe!=='function')throw new TypeError('mobile_speech_transcribe_required');
  if(typeof createRecorder!=='function')throw new TypeError('mobile_speech_recorder_factory_required');
  if(typeof createAudioBlob!=='function')throw new TypeError('mobile_speech_audio_blob_factory_required');

  const listeners=new Set();
  let state=MOBILE_SPEECH_STATE.IDLE;
  let error=null;
  let lastText='';
  let provider='';
  let model='';
  let latencyMs=0;
  let recorder=null;
  let parts=[];
  let options={sourceLanguage:'ko-KR',targetLanguage:'vi-VN'};
  let discard=false;
  let stopped=false;
  let cycle=0;
  let finishStartedAt=0;
  let finishPromise=null;
  let finishResolve=null;
  let finishReject=null;
  const automaticChunkMs=Math.max(0,Number(autoFinalizeMs)||0);

  const snapshot=()=>Object.freeze({state,error,lastText,provider,model,latencyMs});
  const publish=()=>{
    const value=snapshot();
    for(const listener of listeners)listener(value);
  };
  const rejectFinish=cause=>{
    const reject=finishReject;
    finishResolve=null;
    finishReject=null;
    finishPromise=null;
    reject?.(cause);
  };
  const resolveFinish=value=>{
    const resolve=finishResolve;
    finishResolve=null;
    finishReject=null;
    finishPromise=null;
    resolve?.(value);
  };
  const fail=(cause,code=errorCode(cause))=>{
    error=code;
    state=MOBILE_SPEECH_STATE.RECOVERABLE_ERROR;
    publish();
    rejectFinish(cause instanceof Error?cause:new Error(code));
  };

  const api={
    getSnapshot:snapshot,
    subscribe(listener){
      if(typeof listener!=='function')throw new TypeError('mobile_speech_listener_required');
      listeners.add(listener);
      listener(snapshot());
      return ()=>listeners.delete(listener);
    },
    startCapture(nextOptions={}){
      if(stopped)throw new Error('mobile_speech_session_stopped');
      if([MOBILE_SPEECH_STATE.RECORDING,MOBILE_SPEECH_STATE.TRANSCRIBING,MOBILE_SPEECH_STATE.COMMITTING].includes(state))throw new Error('mobile_speech_session_busy');
      if(mediaSession.getSnapshot().state!=='active')throw new Error('mobile_media_session_not_active');
      const stream=mediaSession.getStream(),tracks=typeof stream?.getAudioTracks==='function'?stream.getAudioTracks():[];
      if(!tracks.some(track=>track?.readyState!=='ended'))throw new Error('audio_track_missing');

      options={
        sourceLanguage:String(nextOptions.sourceLanguage||'ko-KR'),
        targetLanguage:String(nextOptions.targetLanguage||'vi-VN'),
      };
      const currentCycle=++cycle;
      parts=[];
      discard=false;
      error=null;
      latencyMs=0;
      try{
        recorder=createRecorder(stream);
        if(typeof recorder?.start!=='function'||typeof recorder?.stop!=='function')throw new TypeError('mobile_speech_recorder_invalid');
        recorder.addEventListener?.('dataavailable',event=>{
          if(currentCycle!==cycle||discard||Number(event?.data?.size||0)<=0)return;
          parts.push(event.data);
          if(automaticChunkMs>0&&recorder?.state==='recording')void api.finishCapture().catch(()=>{});
        });
        recorder.addEventListener?.('error',event=>{
          if(currentCycle!==cycle||stopped)return;
          api.cancelCapture(errorCode(event?.error||'recorder_error'));
        });
        recorder.addEventListener?.('stop',async()=>{
          if(currentCycle!==cycle||discard||stopped)return;
          const type=String(recorder?.mimeType||'audio/webm');
          recorder=null;
          try{
            const audio=createAudioBlob(parts,{type});
            if(Number(audio?.size||0)<Number(minBytes))throw new Error('audio_too_short');
            state=MOBILE_SPEECH_STATE.TRANSCRIBING;
            publish();
            const result=await transcribe({meetingId:id,audio,mimeType:type,language:options.sourceLanguage});
            if(currentCycle!==cycle||stopped)return;
            const text=String(result?.text||'').trim();
            if(!text)throw new Error('speech_not_detected');
            state=MOBILE_SPEECH_STATE.COMMITTING;
            publish();
            await captionSession.submit(text,{
              sourceLanguage:options.sourceLanguage,
              targetLanguage:options.targetLanguage,
              inputMode:'speech',
            });
            if(currentCycle!==cycle||stopped)return;
            lastText=text;
            provider=String(result?.provider||'unknown');
            model=String(result?.model||'');
            latencyMs=Math.max(0,Number(now())-finishStartedAt);
            state=MOBILE_SPEECH_STATE.COMPLETED;
            error=null;
            publish();
            resolveFinish(snapshot());
          }catch(cause){
            if(currentCycle===cycle&&!stopped)fail(cause);
          }
        });
        if(automaticChunkMs>0)recorder.start(automaticChunkMs);
        else recorder.start();
        state=MOBILE_SPEECH_STATE.RECORDING;
        publish();
        return snapshot();
      }catch(cause){
        const code=errorCode(cause);
        recorder=null;
        error=code;
        state=['media_recorder_unsupported','mobile_speech_recorder_invalid'].includes(code)
          ?MOBILE_SPEECH_STATE.FATAL_ERROR
          :MOBILE_SPEECH_STATE.RECOVERABLE_ERROR;
        publish();
        throw cause;
      }
    },
    finishCapture(){
      if(state!==MOBILE_SPEECH_STATE.RECORDING||!recorder)return Promise.reject(new Error('mobile_speech_not_recording'));
      if(finishPromise)return finishPromise;
      finishStartedAt=Number(now());
      finishPromise=new Promise((resolve,reject)=>{
        finishResolve=resolve;
        finishReject=reject;
      });
      const pending=finishPromise;
      try{recorder.stop()}catch(cause){fail(cause)}
      return pending;
    },
    cancelCapture(reason='capture_cancelled'){
      if(state!==MOBILE_SPEECH_STATE.RECORDING||!recorder)return snapshot();
      discard=true;
      const current=recorder;
      recorder=null;
      try{if(current.state!=='inactive')current.stop()}catch{}
      error=String(reason||'capture_cancelled');
      state=MOBILE_SPEECH_STATE.RECOVERABLE_ERROR;
      publish();
      rejectFinish(new Error(error));
      return snapshot();
    },
    stop(){
      if(stopped)return snapshot();
      stopped=true;
      cycle+=1;
      discard=true;
      const current=recorder;
      recorder=null;
      try{if(current&&current.state!=='inactive')current.stop()}catch{}
      state=MOBILE_SPEECH_STATE.STOPPED;
      error=null;
      publish();
      rejectFinish(new Error('mobile_speech_session_stopped'));
      return snapshot();
    },
  };

  return Object.freeze(api);
}
