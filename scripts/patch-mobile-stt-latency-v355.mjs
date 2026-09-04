import fs from 'node:fs';

const file=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const replaceOnce=(from,to,label)=>{
  if(!source.includes(from))throw new Error(`v355_anchor_missing:${label}`);
  source=source.replace(from,to);
};

replaceOnce(
  "state.media.sttLatencyMode==='server'?'서버 반응':'인식 반응'",
  "state.media.sttLatencyMode==='server'?'서버 확정':'문장 확정'",
  'latency-label'
);

replaceOnce(
  "(mode==='server'?'서버 반응 ':'인식 반응 ')",
  "(mode==='server'?'서버 확정 ':'문장 확정 ')",
  'latency-live-label'
);

replaceOnce(
  "r.onspeechstart=()=>{if(generation===state._speechGeneration)state.media.speechDetectedAt=performance.now()};r.onresult=async e=>{if(generation!==state._speechGeneration)return;const latencyStart=state.media.speechDetectedAt||state.media.recognitionStartedAt;if(latencyStart){showSpeechLatency('browser',latencyStart);state.media.speechDetectedAt=0;state.media.recognitionStartedAt=0}",
  "r.onspeechstart=()=>{if(generation===state._speechGeneration){state.media.speechDetectedAt=performance.now();state.media.speechEndedAt=0;state.media.sttLatencyMs=0;state.media.sttLatencyMode='';const latency=document.querySelector('#speechLatency');if(latency)latency.textContent='문장 확정 측정 중'}};r.onspeechend=()=>{if(generation===state._speechGeneration)state.media.speechEndedAt=performance.now()};r.onresult=async e=>{if(generation!==state._speechGeneration)return;const latencyStart=state.media.speechEndedAt;if(latencyStart){showSpeechLatency('browser-final',latencyStart);state.media.speechDetectedAt=0;state.media.speechEndedAt=0;state.media.recognitionStartedAt=0}",
  'finalization-latency'
);

replaceOnce(
  "try{r.start()}catch(e){state._speechStarting=false;",
  "const fixedSourceLanguage=localStorage.sourceLanguage||state.meeting?.language||localStorage.language||locale[state.lang]||'ko-KR';if(['ko-KR','vi-VN','en-US','zh-CN','ja-JP'].includes(fixedSourceLanguage))r.lang=fixedSourceLanguage;try{r.start()}catch(e){state._speechStarting=false;",
  'fixed-source-language'
);

replaceOnce("const APP_VERSION='3.5.4'","const APP_VERSION='3.5.6'",'app-version');

for(const marker of [
  'id="vfRoomDock"','r.onspeechend=','state.media.speechEndedAt',
  "showSpeechLatency('browser-final'",'fixedSourceLanguage',
  'state._lastChatScrollKey','latest.getBoundingClientRect()','data-original-save',
  'data-translation-save','state.resultSaveNotice','libraryMeta',
  "await postCaption(text,'browser')","const APP_VERSION='3.5.6'"
])if(!source.includes(marker))throw new Error(`v355_contract_missing:${marker}`);

if(source.includes("state.media.speechDetectedAt||state.media.recognitionStartedAt"))throw new Error('v355_misleading_latency_remaining');

fs.writeFileSync(file,source);
console.log('VoiceFlow finalization latency and fixed source language v3.5.6 applied');

