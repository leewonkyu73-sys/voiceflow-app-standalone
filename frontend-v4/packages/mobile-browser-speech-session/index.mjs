export const MOBILE_BROWSER_SPEECH_STATE=Object.freeze({
  IDLE:'idle',
  PREPARING:'preparing',
  LISTENING:'listening',
  COMMITTING:'committing',
  COMPLETED:'completed',
  RECOVERABLE_ERROR:'recoverable_error',
  FATAL_ERROR:'fatal_error',
  STOPPED:'stopped',
});

function assertMeetingId(value){
  const id=String(value||'');
  if(!/^mtg_[A-Za-z0-9_]+$/.test(id))throw new Error('invalid_meeting_id');
  return id;
}

function recognitionErrorCode(error){
  return String(error?.error||error?.code||error?.message||error||'browser_speech_failed');
}

function onDeviceSpeechError(code,cause=null){
  const error=new Error(String(code||'on_device_speech_failed'));
  error.code=String(code||'on_device_speech_failed');
  if(cause)error.cause=cause;
  return error;
}

function chromeMajorVersion(userAgent){
  const match=String(userAgent||'').match(/(?:Chrome|Chromium)\/(\d+)/i);
  return match?Number(match[1]):0;
}

export async function prepareOnDeviceBrowserSpeech({
  recognitionConstructor,
  recognition,
  language='ko-KR',
  qualities=['conversation','dictation'],
}={}){
  if(typeof recognitionConstructor?.available!=='function'||typeof recognitionConstructor?.install!=='function'){
    throw onDeviceSpeechError('on_device_speech_unsupported');
  }
  if(!recognition||typeof recognition!=='object')throw new TypeError('on_device_speech_recognition_required');
  const lang=String(language||'ko-KR');
  const requestedQualities=[...new Set(qualities.map(value=>String(value||'')).filter(value=>['conversation','dictation'].includes(value)))];
  if(!requestedQualities.length)throw onDeviceSpeechError('on_device_quality_unavailable');
  recognition.processLocally=true;

  for(const quality of requestedQualities){
    const options={langs:[lang],processLocally:true,quality};
    let availability;
    try{
      availability=String(await recognitionConstructor.available(options));
    }catch(cause){
      throw onDeviceSpeechError('on_device_speech_check_failed',cause);
    }
    if(availability==='available')return Object.freeze({availability,quality,installed:false});
    if(!['downloadable','downloading'].includes(availability))continue;
    let installed=false;
    try{
      installed=await recognitionConstructor.install(options);
    }catch(cause){
      throw onDeviceSpeechError('on_device_language_install_failed',cause);
    }
    if(!installed)continue;
    try{
      availability=String(await recognitionConstructor.available(options));
    }catch(cause){
      throw onDeviceSpeechError('on_device_speech_check_failed',cause);
    }
    if(availability==='available')return Object.freeze({availability,quality,installed:true});
  }
  throw onDeviceSpeechError('on_device_language_unavailable');
}

export function supportsGoldenBrowserSpeech({
  userAgent='',
  recognitionConstructor=null,
}={}){
  const ua=String(userAgent||'');
  return /Android/i.test(ua)
    &&/(Chrome|Chromium)\//i.test(ua)
    &&!/(SamsungBrowser|EdgA|OPR)\//i.test(ua)
    &&chromeMajorVersion(ua)>=150
    &&typeof recognitionConstructor==='function'
    &&typeof recognitionConstructor.available==='function'
    &&typeof recognitionConstructor.install==='function';
}

export function createMobileBrowserSpeechSession({
  meetingId:meetingIdValue,
  captionSession,
  createRecognition,
  prepareRecognition,
  now=()=>Date.now(),
}={}){
  assertMeetingId(meetingIdValue);
  if(typeof captionSession?.submit!=='function')throw new TypeError('mobile_browser_speech_caption_session_required');
  if(typeof createRecognition!=='function')throw new TypeError('mobile_browser_speech_factory_required');
  if(typeof prepareRecognition!=='function')throw new TypeError('mobile_browser_speech_preparer_required');

  const listeners=new Set();
  let state=MOBILE_BROWSER_SPEECH_STATE.IDLE;
  let error=null;
  let lastText='';
  let provider='on-device-web-speech';
  let quality='';
  let latencyMs=0;
  let recognitionLatencyMs=0;
  let translationLatencyMs=0;
  let totalLatencyMs=0;
  let utteranceCount=0;
  let pendingCommits=0;
  let recognition=null;
  let options={sourceLanguage:'ko-KR',targetLanguage:'vi-VN'};
  let stopped=false;
  let generation=0;
  let startedAt=0;
  let utteranceStartedAt=0;
  let speechEndedAt=0;
  let recognitionStopRequested=false;
  let finishRequested=false;
  let recognitionEnded=false;
  let finalResultIndexes=new Set();
  let commitQueue=Promise.resolve();
  let eventTrace=[];

  const recordEvent=name=>{
    eventTrace=[...eventTrace,String(name||'unknown')].slice(-8);
  };
  const snapshot=()=>Object.freeze({
    state,
    error,
    lastText,
    provider,
    processingMode:'on-device',
    quality,
    latencyMs,
    recognitionLatencyMs,
    translationLatencyMs,
    totalLatencyMs,
    utteranceCount,
    pendingCommits,
    eventTrace:eventTrace.join(' > '),
  });
  const publish=()=>{
    const value=snapshot();
    for(const listener of listeners)listener(value);
  };
  const clearRecognition=current=>{
    if(recognition===current)recognition=null;
  };
  const requestRecognitionStop=current=>{
    if(recognitionStopRequested)return;
    recognitionStopRequested=true;
    current.stop?.();
  };
  const fail=(code,{fatal=false,current=null}={})=>{
    if(current&&recognition!==current)return snapshot();
    clearRecognition(current);
    error=String(code||'browser_speech_failed');
    state=fatal?MOBILE_BROWSER_SPEECH_STATE.FATAL_ERROR:MOBILE_BROWSER_SPEECH_STATE.RECOVERABLE_ERROR;
    publish();
    return snapshot();
  };
  const completeIfReady=(current,currentGeneration)=>{
    if(stopped||currentGeneration!==generation||recognition!==current)return snapshot();
    if(!finishRequested||!recognitionEnded||pendingCommits>0)return snapshot();
    clearRecognition(current);
    state=MOBILE_BROWSER_SPEECH_STATE.COMPLETED;
    error=null;
    publish();
    return snapshot();
  };
  const enqueueCommit=(text,current,currentGeneration,resultIndex)=>{
    const original=String(text||'').trim();
    if(!original||stopped||currentGeneration!==generation||recognition!==current)return Promise.resolve(snapshot());
    if(finalResultIndexes.has(resultIndex))return Promise.resolve(snapshot());
    finalResultIndexes.add(resultIndex);
    const recognizedAt=Number(now());
    const utteranceAt=utteranceStartedAt||startedAt;
    recognitionLatencyMs=Math.max(0,recognizedAt-(speechEndedAt||utteranceAt));
    latencyMs=recognitionLatencyMs;
    lastText=original;
    utteranceCount+=1;
    pendingCommits+=1;
    error=null;
    publish();

    const task=commitQueue.then(async()=>{
      try{
        await captionSession.submit(original,{
          sourceLanguage:options.sourceLanguage,
          targetLanguage:options.targetLanguage,
          inputMode:'speech',
        });
        if(stopped||currentGeneration!==generation)return snapshot();
        const completedAt=Number(now());
        translationLatencyMs=Math.max(0,completedAt-recognizedAt);
        totalLatencyMs=Math.max(0,completedAt-utteranceAt);
        error=null;
        return snapshot();
      }catch(cause){
        if(!stopped&&currentGeneration===generation&&recognition===current){
          try{current.abort?.()}catch{}
          return fail(recognitionErrorCode(cause),{current});
        }
        return snapshot();
      }finally{
        if(currentGeneration===generation){
          pendingCommits=Math.max(0,pendingCommits-1);
          if(!stopped&&recognition===current){
            if(finishRequested)state=MOBILE_BROWSER_SPEECH_STATE.COMMITTING;
            publish();
            completeIfReady(current,currentGeneration);
          }else if(!stopped){
            publish();
          }
        }
      }
    });
    commitQueue=task.catch(()=>{});
    return task;
  };

  const api={
    getSnapshot:snapshot,
    subscribe(listener){
      if(typeof listener!=='function')throw new TypeError('mobile_browser_speech_listener_required');
      listeners.add(listener);
      listener(snapshot());
      return ()=>listeners.delete(listener);
    },
    async startListening(nextOptions={}){
      if(stopped)throw new Error('mobile_browser_speech_session_stopped');
      if([MOBILE_BROWSER_SPEECH_STATE.PREPARING,MOBILE_BROWSER_SPEECH_STATE.LISTENING,MOBILE_BROWSER_SPEECH_STATE.COMMITTING].includes(state))throw new Error('mobile_browser_speech_session_busy');
      options={
        sourceLanguage:String(nextOptions.sourceLanguage||'ko-KR'),
        targetLanguage:String(nextOptions.targetLanguage||'vi-VN'),
      };
      const current=createRecognition();
      if(!current||typeof current.start!=='function')throw new TypeError('mobile_browser_speech_recognition_invalid');
      const currentGeneration=++generation;
      recognition=current;
      error=null;
      quality='';
      lastText='';
      latencyMs=0;
      recognitionLatencyMs=0;
      translationLatencyMs=0;
      totalLatencyMs=0;
      utteranceCount=0;
      pendingCommits=0;
      utteranceStartedAt=0;
      speechEndedAt=0;
      recognitionStopRequested=false;
      finishRequested=false;
      recognitionEnded=false;
      finalResultIndexes=new Set();
      commitQueue=Promise.resolve();
      eventTrace=[];
      current.processLocally=true;
      current.continuous=true;
      current.interimResults=true;
      current.lang=options.sourceLanguage;
      current.onaudiostart=()=>{
        if(stopped||currentGeneration!==generation||recognition!==current)return;
        recordEvent('audiostart');
        state=MOBILE_BROWSER_SPEECH_STATE.LISTENING;
        error=null;
        publish();
      };
      current.onaudioend=()=>{
        if(stopped||currentGeneration!==generation||recognition!==current)return;
        recordEvent('audioend');
        publish();
      };
      current.onspeechstart=()=>{
        if(stopped||currentGeneration!==generation||recognition!==current)return;
        recordEvent('speechstart');
        state=MOBILE_BROWSER_SPEECH_STATE.LISTENING;
        utteranceStartedAt=Number(now());
        speechEndedAt=0;
        publish();
      };
      current.onspeechend=()=>{
        if(stopped||currentGeneration!==generation||recognition!==current)return;
        recordEvent('speechend');
        speechEndedAt=Number(now());
        publish();
      };
      current.onresult=event=>{
        if(stopped||currentGeneration!==generation||recognition!==current)return Promise.resolve(snapshot());
        const tasks=[];
        const from=Math.max(0,Number(event?.resultIndex||0));
        const results=event?.results||[];
        let sawInterim=false;
        let sawFinal=false;
        for(let i=from;i<results.length;i+=1){
          const item=results[i];
          const text=String(item?.[0]?.transcript||'').trim();
          if(item?.isFinal&&text){
            sawFinal=true;
            tasks.push(enqueueCommit(text,current,currentGeneration,i));
          }else if(text){
            sawInterim=true;
          }
        }
        if(sawInterim)recordEvent('interim');
        if(sawFinal)recordEvent('final');
        if(sawInterim||sawFinal)publish();
        return Promise.all(tasks).then(()=>snapshot());
      };
      current.onerror=event=>{
        if(stopped||currentGeneration!==generation||recognition!==current)return;
        const code=recognitionErrorCode(event);
        recordEvent(`error:${code}`);
        const fatal=['not-allowed','service-not-allowed','audio-capture'].includes(code);
        fail(code,{fatal,current});
      };
      current.onend=()=>{
        if(stopped||currentGeneration!==generation||recognition!==current)return snapshot();
        recordEvent('end');
        recognitionEnded=true;
        if(!finishRequested)return fail('speech_session_ended',{current});
        state=MOBILE_BROWSER_SPEECH_STATE.COMMITTING;
        publish();
        return completeIfReady(current,currentGeneration);
      };
      state=MOBILE_BROWSER_SPEECH_STATE.PREPARING;
      recordEvent('prepare');
      publish();
      try{
        const prepared=await prepareRecognition(current,Object.freeze({...options}));
        if(stopped||currentGeneration!==generation||recognition!==current)return snapshot();
        if(current.processLocally!==true)throw onDeviceSpeechError('on_device_speech_required');
        quality=String(prepared?.quality||'');
        if(!['conversation','dictation'].includes(quality))throw onDeviceSpeechError('on_device_quality_unavailable');
        recordEvent(`ready:${quality}`);
      }catch(cause){
        if(stopped||currentGeneration!==generation||recognition!==current)return snapshot();
        const code=recognitionErrorCode(cause);
        const fatal=['on_device_speech_unsupported','on_device_speech_required','on_device_quality_unavailable','on_device_language_unavailable'].includes(code);
        return fail(code,{fatal,current});
      }
      startedAt=Number(now());
      try{
        current.start();
        recordEvent('start');
        publish();
        return snapshot();
      }catch(cause){
        const code=recognitionErrorCode(cause);
        fail(code,{fatal:code==='not-allowed',current});
        throw cause;
      }
    },
    finishListening(){
      if(finishRequested)return snapshot();
      if(state!==MOBILE_BROWSER_SPEECH_STATE.LISTENING||!recognition)return snapshot();
      finishRequested=true;
      state=MOBILE_BROWSER_SPEECH_STATE.COMMITTING;
      error=null;
      publish();
      try{requestRecognitionStop(recognition)}catch(cause){return fail(recognitionErrorCode(cause),{current:recognition})}
      return snapshot();
    },
    cancelListening(reason='capture_cancelled'){
      if(![MOBILE_BROWSER_SPEECH_STATE.PREPARING,MOBILE_BROWSER_SPEECH_STATE.LISTENING,MOBILE_BROWSER_SPEECH_STATE.COMMITTING].includes(state)||!recognition)return snapshot();
      const current=recognition;
      generation+=1;
      clearRecognition(current);
      try{current.abort?.()}catch{}
      error=String(reason||'capture_cancelled');
      state=MOBILE_BROWSER_SPEECH_STATE.RECOVERABLE_ERROR;
      publish();
      return snapshot();
    },
    stop(){
      if(stopped)return snapshot();
      stopped=true;
      generation+=1;
      const current=recognition;
      clearRecognition(current);
      try{current?.abort?.()}catch{}
      state=MOBILE_BROWSER_SPEECH_STATE.STOPPED;
      error=null;
      publish();
      return snapshot();
    },
  };

  return Object.freeze(api);
}
