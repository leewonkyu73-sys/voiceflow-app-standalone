import fs from 'node:fs';
const file=new URL('../public/app.js',import.meta.url);
let s=fs.readFileSync(file,'utf8');
const oldInterim="if(text){const stream=document.querySelector('#liveChatStream');if(stream)stream.scrollTop=stream.scrollHeight}";
if(!s.includes(oldInterim))throw new Error('chat_scroll_anchor_missing:interim');
s=s.replace(oldInterim,'');
const oldStable="function renderRoomStable(forceBottom=false){const current=document.querySelector('#liveChatStream'),oldTop=current?.scrollTop||0,nearBottom=!current||current.scrollHeight-current.scrollTop-current.clientHeight<90,edit=captureCaptionEditorState();render();restoreCaptionEditorState(edit);const next=document.querySelector('#liveChatStream');if(next)next.scrollTop=(forceBottom||nearBottom)?next.scrollHeight:oldTop}";
const newStable="function renderRoomStable(forceBottom=false){const current=document.querySelector('#liveChatStream'),oldTop=current?.scrollTop||0,nearBottom=!current||current.scrollHeight-current.scrollTop-current.clientHeight<90,editorOpen=hasOpenCaptionEditor(),edit=captureCaptionEditorState();const lastIndex=new Map();state.captions.forEach((c,i)=>{if(c.id)lastIndex.set(c.id,i)});state.captions=state.captions.filter((c,i)=>!c.id||lastIndex.get(c.id)===i);const tail=state.captions[state.captions.length-1],tailKey=tail?String(tail.id||tail.created_at||tail.text||''):'';const moveOnce=Boolean(forceBottom&&nearBottom&&!editorOpen&&tailKey&&state._lastChatScrollKey!==tailKey);render();restoreCaptionEditorState(edit);const next=document.querySelector('#liveChatStream');if(next)next.scrollTop=moveOnce?next.scrollHeight:oldTop;if(moveOnce)state._lastChatScrollKey=tailKey}";
if(!s.includes(oldStable))throw new Error('chat_scroll_anchor_missing:stable-render');
s=s.replace(oldStable,newStable);
if(s.includes('if(text){const stream=document.querySelector(\'#liveChatStream\')'))throw new Error('interim_scroll_still_present');
if(!s.includes('state._lastChatScrollKey')||!s.includes('moveOnce'))throw new Error('single_step_scroll_contract_missing');
fs.writeFileSync(file,s);
console.log('VoiceFlow single-step chat scroll v3.4.8 applied');

