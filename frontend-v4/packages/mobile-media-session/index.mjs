export const MOBILE_MEDIA_STATE=Object.freeze({
  IDLE:'idle',
  REQUESTING:'requesting',
  ACTIVE:'active',
  SUSPENDED:'suspended',
  RECOVERABLE_ERROR:'recoverable_error',
  FATAL_ERROR:'fatal_error',
  STOPPED:'stopped',
});

function sessionError(message){
  return new Error(message);
}

function stopStream(stream){
  const tracks=typeof stream?.getTracks==='function'?stream.getTracks():[];
  for(const track of new Set(tracks)){
    if(track?.readyState!=='ended'&&typeof track?.stop==='function')track.stop();
  }
}

function classifyStartError(error){
  if(error?.message==='audio_track_missing'){
    return {state:MOBILE_MEDIA_STATE.FATAL_ERROR,code:'audio_track_missing'};
  }
  if(error?.name==='NotAllowedError'||error?.name==='SecurityError'){
    return {state:MOBILE_MEDIA_STATE.FATAL_ERROR,code:'permission_denied'};
  }
  if(error?.name==='NotFoundError'||error?.name==='OverconstrainedError'){
    return {state:MOBILE_MEDIA_STATE.FATAL_ERROR,code:'audio_input_not_found'};
  }
  if(error?.name==='NotReadableError'||error?.name==='AbortError'){
    return {state:MOBILE_MEDIA_STATE.RECOVERABLE_ERROR,code:'audio_input_unavailable'};
  }
  return {state:MOBILE_MEDIA_STATE.RECOVERABLE_ERROR,code:'media_start_failed'};
}

export function createMobileMediaSession({
  requestStream,
  constraints={audio:true,video:false},
}={}){
  if(typeof requestStream!=='function')throw new TypeError('mobile_media_request_stream_required');

  const listeners=new Set();
  let state=MOBILE_MEDIA_STATE.IDLE;
  let error=null;
  let stream=null;
  let audioTracks=[];
  let visibility='visible';
  let permissionRequests=0;
  let permissionAttempted=false;
  let stopped=false;
  let startPromise=null;

  const snapshot=()=>Object.freeze({
    state,
    error,
    hasStream:Boolean(stream),
    permissionRequests,
  });
  const publish=()=>{
    const value=snapshot();
    for(const listener of listeners)listener(value);
  };
  const setTrackEnabled=enabled=>{
    for(const track of audioTracks){
      if(track.readyState!=='ended')track.enabled=enabled;
    }
  };
  const markTrackEnded=()=>{
    if(stopped||state===MOBILE_MEDIA_STATE.FATAL_ERROR)return;
    if(audioTracks.some(track=>track.readyState!=='ended'))return;
    error='audio_track_ended';
    state=MOBILE_MEDIA_STATE.RECOVERABLE_ERROR;
    publish();
  };

  const api={
    getSnapshot:snapshot,
    getStream:()=>stream,
    subscribe(listener){
      if(typeof listener!=='function')throw new TypeError('mobile_media_listener_required');
      listeners.add(listener);
      listener(snapshot());
      return ()=>listeners.delete(listener);
    },
    start(){
      if(state===MOBILE_MEDIA_STATE.ACTIVE||state===MOBILE_MEDIA_STATE.SUSPENDED){
        return Promise.resolve(stream);
      }
      if(state===MOBILE_MEDIA_STATE.REQUESTING)return startPromise;
      if(permissionAttempted||stopped){
        return Promise.reject(sessionError('mobile_media_session_not_restartable'));
      }

      permissionAttempted=true;
      permissionRequests+=1;
      state=MOBILE_MEDIA_STATE.REQUESTING;
      error=null;
      publish();

      startPromise=(async()=>{
        try{
          const candidate=await requestStream(constraints);
          if(stopped){
            stopStream(candidate);
            throw sessionError('mobile_media_session_stopped');
          }
          const tracks=typeof candidate?.getAudioTracks==='function'?candidate.getAudioTracks():[];
          audioTracks=tracks.filter(track=>track&&track.readyState!=='ended');
          if(!audioTracks.length){
            stopStream(candidate);
            throw sessionError('audio_track_missing');
          }
          stream=candidate;
          for(const track of audioTracks){
            track.addEventListener?.('ended',markTrackEnded,{once:true});
          }
          if(visibility==='hidden'){
            setTrackEnabled(false);
            state=MOBILE_MEDIA_STATE.SUSPENDED;
          }else{
            state=MOBILE_MEDIA_STATE.ACTIVE;
          }
          publish();
          return stream;
        }catch(cause){
          if(stopped)throw cause;
          const failure=classifyStartError(cause);
          state=failure.state;
          error=failure.code;
          publish();
          throw cause;
        }
      })();
      return startPromise;
    },
    setVisibility(nextVisibility){
      visibility=nextVisibility==='hidden'?'hidden':'visible';
      if(state===MOBILE_MEDIA_STATE.ACTIVE&&visibility==='hidden'){
        setTrackEnabled(false);
        state=MOBILE_MEDIA_STATE.SUSPENDED;
        publish();
      }else if(state===MOBILE_MEDIA_STATE.SUSPENDED&&visibility==='visible'){
        if(!audioTracks.some(track=>track.readyState!=='ended')){
          markTrackEnded();
          return snapshot();
        }
        setTrackEnabled(true);
        state=MOBILE_MEDIA_STATE.ACTIVE;
        publish();
      }
      return snapshot();
    },
    stop(){
      if(stopped)return snapshot();
      stopped=true;
      setTrackEnabled(false);
      stopStream(stream);
      state=MOBILE_MEDIA_STATE.STOPPED;
      error=null;
      publish();
      return snapshot();
    },
  };

  return Object.freeze(api);
}
