import {createCaptionRequest} from '../meeting-contracts/index.mjs';
import {
  beginCaption,
  commitCaption,
  createCaptionStore,
  failCaption,
  mergeServerCaptions,
} from '../caption-store/index.mjs';

function defaultClientId(){
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
}

function errorCode(error){
  return String(error?.code||error?.message||error||'caption_failed');
}

export function createMobileCaptionSession({
  meetingId,
  api,
  sourceLanguage='ko-KR',
  targetLanguage='vi-VN',
  createClientId=defaultClientId,
}={}){
  if(typeof api?.postCaption!=='function'||typeof api?.listCaptions!=='function'){
    throw new TypeError('mobile_caption_api_required');
  }
  if(typeof createClientId!=='function')throw new TypeError('mobile_caption_client_id_factory_required');

  let store=createCaptionStore(meetingId);
  const listeners=new Set();
  const publish=()=>{
    for(const listener of listeners)listener(store);
  };
  const send=async request=>{
    try{
      const response=await api.postCaption(request);
      store=commitCaption(store,request.client_id,response.data);
      publish();
      return store;
    }catch(error){
      store=failCaption(store,request.client_id,errorCode(error));
      publish();
      throw error;
    }
  };

  return Object.freeze({
    getSnapshot:()=>store,
    subscribe(listener){
      if(typeof listener!=='function')throw new TypeError('mobile_caption_listener_required');
      listeners.add(listener);
      listener(store);
      return ()=>listeners.delete(listener);
    },
    submit(text,options={}){
      const request=createCaptionRequest({
        meetingId:store.meetingId,
        clientId:createClientId(),
        text,
        sourceLanguage:options.sourceLanguage||sourceLanguage,
        targetLanguage:options.targetLanguage||targetLanguage,
        inputMode:options.inputMode||'manual',
      });
      store=beginCaption(store,request);
      publish();
      return send(request);
    },
    retry(clientId){
      const item=store.items.find(row=>row.clientId===String(clientId||''));
      if(!item)throw new Error('caption_client_id_not_found');
      const request=createCaptionRequest({
        meetingId:store.meetingId,
        clientId:item.clientId,
        text:item.text,
        sourceLanguage:item.sourceLanguage,
        targetLanguage:item.targetLanguage,
        inputMode:item.inputMode,
      });
      return send(request);
    },
    async reconnect(options={}){
      const rows=await api.listCaptions({
        meetingId:store.meetingId,
        targetLanguage:options.targetLanguage||targetLanguage,
        since:store.cursor,
      });
      store=mergeServerCaptions(store,rows);
      publish();
      return store;
    },
  });
}
