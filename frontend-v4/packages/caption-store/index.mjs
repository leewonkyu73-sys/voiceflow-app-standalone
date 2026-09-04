import {CAPTION_STATUS,assertMeetingId} from '../meeting-contracts/index.mjs';

function freezeItem(item){
  return Object.freeze({
    ...item,
    translations:Object.freeze({...item.translations}),
    translationState:Object.freeze({...item.translationState}),
  });
}

function freezeStore(store){
  return Object.freeze({...store,items:Object.freeze(store.items.map(freezeItem))});
}

function cursorOf(value){
  const numeric=Number(value);
  if(Number.isFinite(numeric))return numeric;
  const parsed=Date.parse(String(value||''));
  return Number.isFinite(parsed)?parsed:0;
}

function translationState(translations={},previous={}){
  const next={...previous};
  for(const language of Object.keys(translations)){
    next[language]=Object.freeze({status:'completed',error:null});
  }
  return next;
}

function normalizeServerCaption(row,previous={}){
  const translations={...(previous.translations||{}),...(row.translations||{})};
  return {
    ...previous,
    ...row,
    id:String(row.id||previous.id||''),
    clientId:String(row.client_id||previous.clientId||''),
    meetingId:String(row.meeting_id||previous.meetingId||''),
    text:String(row.text??previous.text??''),
    translations,
    translationState:translationState(translations,previous.translationState),
    status:CAPTION_STATUS.COMMITTED,
    error:null,
    createdAt:cursorOf(row.created_at||previous.createdAt),
  };
}

export function createCaptionStore(meetingId){
  return freezeStore({
    meetingId:assertMeetingId(meetingId),
    items:[],
    draft:'',
    cursor:0,
  });
}

export function beginCaption(store,request){
  if(request.meeting_id!==store.meetingId)throw new Error('caption_meeting_mismatch');
  const existing=store.items.find(row=>row.clientId===request.client_id);
  if(existing){
    if(existing.text!==request.text)throw new Error('caption_idempotency_conflict');
    return store;
  }
  const item={
    id:'',
    clientId:request.client_id,
    meetingId:store.meetingId,
    text:request.text,
    sourceLanguage:request.language,
    targetLanguage:request.target_language,
    inputMode:request.input_mode,
    translations:{},
    translationState:{},
    status:CAPTION_STATUS.PENDING,
    error:null,
    createdAt:0,
  };
  return freezeStore({...store,items:[...store.items,item],draft:request.text});
}

export function failCaption(store,clientId,error){
  let found=false;
  const items=store.items.map(row=>{
    if(row.clientId!==clientId)return row;
    found=true;
    return {...row,status:CAPTION_STATUS.FAILED,error:String(error||'caption_failed')};
  });
  if(!found)throw new Error('caption_client_id_not_found');
  const failed=items.find(row=>row.clientId===clientId);
  return freezeStore({...store,items,draft:store.draft||failed.text});
}

export function commitCaption(store,clientId,serverCaption){
  if(String(serverCaption?.meeting_id||store.meetingId)!==store.meetingId)throw new Error('caption_meeting_mismatch');
  let found=false,committedText='';
  const items=store.items.map(row=>{
    if(row.clientId!==clientId)return row;
    found=true;
    const next=normalizeServerCaption({...serverCaption,client_id:serverCaption.client_id||clientId},row);
    committedText=next.text;
    return next;
  });
  if(!found)throw new Error('caption_client_id_not_found');
  const cursor=Math.max(store.cursor,cursorOf(serverCaption.created_at));
  const draft=store.draft===committedText?'':store.draft;
  return freezeStore({...store,items,draft,cursor});
}

export function setCaptionTranslation(store,captionKey,{targetLanguage,status,text='',error=null}={}){
  const language=String(targetLanguage||'').trim();
  if(!language)throw new Error('missing_target_language');
  let found=false;
  const items=store.items.map(row=>{
    if(row.id!==captionKey&&row.clientId!==captionKey)return row;
    found=true;
    const translations={...row.translations};
    if(status==='completed')translations[language]=String(text);
    return {
      ...row,
      translations,
      translationState:{
        ...row.translationState,
        [language]:Object.freeze({status:String(status||'pending'),error:error?String(error):null}),
      },
    };
  });
  if(!found)throw new Error('caption_not_found');
  return freezeStore({...store,items});
}

export function mergeServerCaptions(store,rows=[]){
  const items=[...store.items];
  let cursor=store.cursor;
  for(const row of rows){
    if(String(row?.meeting_id||'')!==store.meetingId)continue;
    const id=String(row.id||''),clientId=String(row.client_id||'');
    const index=items.findIndex(item=>(id&&item.id===id)||(clientId&&item.clientId===clientId));
    if(index>=0)items[index]=normalizeServerCaption(row,items[index]);
    else items.push(normalizeServerCaption(row));
    cursor=Math.max(cursor,cursorOf(row.created_at));
  }
  items.sort((a,b)=>a.createdAt-b.createdAt);
  return freezeStore({...store,items,cursor});
}
