import {LOCAL_WHISPER_PACK} from '../mobile-input-policy/index.mjs';

export const LOCAL_WHISPER_STATE=Object.freeze({
  ABSENT:'absent',
  DOWNLOADING:'downloading',
  READY:'ready',
  TRANSCRIBING:'transcribing',
  ERROR:'error',
  STOPPED:'stopped',
});

function errorCode(error){
  return String(error?.code||error?.message||error||'local_whisper_failed');
}

export function createLocalWhisperClient({
  createWorker,
  decodeAudio,
  requestPersistentStorage=async()=>false,
  deleteCache=async()=>false,
  createRequestId=()=>`local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`,
}={}){
  if(typeof createWorker!=='function')throw new TypeError('local_whisper_worker_factory_required');
  if(typeof decodeAudio!=='function')throw new TypeError('local_whisper_audio_decoder_required');
  if(typeof requestPersistentStorage!=='function')throw new TypeError('local_whisper_persistence_request_required');
  if(typeof deleteCache!=='function')throw new TypeError('local_whisper_cache_delete_required');

  const listeners=new Set();
  const requests=new Map();
  let state=LOCAL_WHISPER_STATE.ABSENT;
  let progress=0;
  let loaded=0;
  let total=0;
  let error='';
  let worker=null;
  let stopped=false;

  const snapshot=()=>Object.freeze({state,progress,loaded,total,error,modelId:LOCAL_WHISPER_PACK.modelId});
  const publish=()=>{
    const value=snapshot();
    for(const listener of listeners)listener(value);
  };
  const settle=(requestId,kind,value)=>{
    const pending=requests.get(String(requestId||''));
    if(!pending)return;
    requests.delete(String(requestId||''));
    pending[kind](value);
  };
  const failAll=reason=>{
    const cause=reason instanceof Error?reason:new Error(errorCode(reason));
    for(const pending of requests.values())pending.reject(cause);
    requests.clear();
  };
  const onMessage=event=>{
    const message=event?.data||{};
    if(message.type==='progress'){
      loaded=Math.max(0,Number(message.loaded)||0);
      total=Math.max(0,Number(message.total)||0);
      progress=Math.max(0,Math.min(100,Number(message.progress)||(total?loaded/total*100:0)));
      publish();
      return;
    }
    if(message.type==='ready'){
      state=LOCAL_WHISPER_STATE.READY;
      progress=100;
      error='';
      publish();
      settle(message.requestId,'resolve',snapshot());
      return;
    }
    if(message.type==='result'){
      state=LOCAL_WHISPER_STATE.READY;
      error='';
      publish();
      settle(message.requestId,'resolve',Object.freeze({
        text:String(message.text||'').trim(),
        provider:String(message.provider||'local-whisper-small'),
        model:String(message.model||LOCAL_WHISPER_PACK.modelId),
        language:String(message.language||''),
      }));
      return;
    }
    if(message.type==='error'){
      error=errorCode(message.error||message.code);
      const pending=requests.get(String(message.requestId||''));
      state=pending?.operation==='transcribe'?LOCAL_WHISPER_STATE.READY:LOCAL_WHISPER_STATE.ERROR;
      publish();
      settle(message.requestId,'reject',new Error(error));
    }
  };
  const ensureWorker=()=>{
    if(worker)return worker;
    worker=createWorker();
    if(!worker||typeof worker.postMessage!=='function')throw new TypeError('local_whisper_worker_invalid');
    worker.addEventListener?.('message',onMessage);
    return worker;
  };
  const request=(message,transfer=[])=>{
    const requestId=createRequestId();
    const pending=new Promise((resolve,reject)=>requests.set(requestId,{resolve,reject,operation:String(message.type||'')}));
    try{
      const target=ensureWorker();
      if(transfer.length)target.postMessage({...message,requestId},transfer);
      else target.postMessage({...message,requestId});
    }catch(cause){
      settle(requestId,'reject',cause);
    }
    return pending;
  };

  return Object.freeze({
    getSnapshot:snapshot,
    subscribe(listener){
      if(typeof listener!=='function')throw new TypeError('local_whisper_listener_required');
      listeners.add(listener);
      listener(snapshot());
      return ()=>listeners.delete(listener);
    },
    install(){
      if(stopped)return Promise.reject(new Error('local_whisper_stopped'));
      if(state===LOCAL_WHISPER_STATE.READY)return Promise.resolve(snapshot());
      state=LOCAL_WHISPER_STATE.DOWNLOADING;
      progress=0;
      loaded=0;
      total=0;
      error='';
      publish();
      const persistence=Promise.resolve().then(()=>requestPersistentStorage()).catch(()=>false);
      const loading=request({type:'load',config:LOCAL_WHISPER_PACK});
      return Promise.all([loading,persistence]).then(([value])=>value);
    },
    transcribe({audio,language='ko-KR'}={}){
      if(stopped)return Promise.reject(new Error('local_whisper_stopped'));
      if(state!==LOCAL_WHISPER_STATE.READY)return Promise.reject(new Error('local_whisper_not_ready'));
      state=LOCAL_WHISPER_STATE.TRANSCRIBING;
      error='';
      publish();
      return Promise.resolve(decodeAudio(audio)).then(samples=>{
        if(!(samples instanceof Float32Array)||samples.length===0)throw new Error('local_whisper_audio_empty');
        return request({type:'transcribe',audio:samples,language:String(language||'ko-KR')},[samples.buffer]);
      }).catch(cause=>{
        state=LOCAL_WHISPER_STATE.READY;
        error=errorCode(cause);
        publish();
        throw cause;
      });
    },
    async remove(){
      worker?.removeEventListener?.('message',onMessage);
      worker?.terminate?.();
      worker=null;
      failAll(new Error('local_whisper_removed'));
      await deleteCache(LOCAL_WHISPER_PACK.cacheKey);
      state=LOCAL_WHISPER_STATE.ABSENT;
      progress=0;
      loaded=0;
      total=0;
      error='';
      publish();
      return snapshot();
    },
    stop(){
      if(stopped)return snapshot();
      stopped=true;
      worker?.removeEventListener?.('message',onMessage);
      worker?.terminate?.();
      worker=null;
      failAll(new Error('local_whisper_stopped'));
      state=LOCAL_WHISPER_STATE.STOPPED;
      publish();
      return snapshot();
    },
  });
}
