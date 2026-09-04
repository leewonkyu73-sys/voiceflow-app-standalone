import fs from 'node:fs';

const file=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(file,'utf8');

const replaceOnce=(from,to,label)=>{
  if(!source.includes(from))throw new Error(`v352_anchor_missing:${label}`);
  source=source.replace(from,to);
};

replaceOnce(
  '<small id="speechState">${speechStatus}</small>',
  '<small id="speechState">${speechStatus}</small><small id="speechLatency" class="vf-speech-latency">${state.media.sttLatencyMs?`${state.media.sttLatencyMode===\'server\'?\'서버 반응\':\'인식 반응\'} ${(state.media.sttLatencyMs/1000).toFixed(1)}초`:\'인식 반응 측정 중\'}</small>',
  'latency-indicator'
);

replaceOnce(
  "const moveOnce=Boolean(forceBottom&&nearBottom&&!editorOpen&&tailKey&&state._lastChatScrollKey!==tailKey);",
  "const moveOnce=Boolean(forceBottom&&!editorOpen&&tailKey&&state._lastChatScrollKey!==tailKey);",
  'latest-message-policy'
);

replaceOnce(
  'if(next)next.scrollTop=moveOnce?next.scrollHeight:oldTop;',
  "if(next){if(moveOnce){const rows=next.querySelectorAll('.chat-msg:not(.interim)'),latest=rows[rows.length-1];if(latest){const top=latest.getBoundingClientRect().top-next.getBoundingClientRect().top+next.scrollTop;next.scrollTop=Math.max(0,top-8)}}else next.scrollTop=oldTop}",
  'latest-message-top'
);

replaceOnce(
  'function startServerSpeechFallback(){',
  "function showSpeechLatency(mode,startedAt){const start=Number(startedAt||0);if(!start)return;const ms=Math.max(0,Math.round(performance.now()-start));state.media.sttLatencyMs=ms;state.media.sttLatencyMode=mode;const el=document.querySelector('#speechLatency');if(el)el.textContent=(mode==='server'?'서버 반응 ':'인식 반응 ')+(ms/1000).toFixed(1)+'초'}\nfunction startServerSpeechFallback(){",
  'latency-helper'
);

replaceOnce(
  "if(text){state.media.stt='server';state.media.sttFallback='ok';state._lastServerSpeechAt=Date.now();",
  "if(text){state.media.stt='server';state.media.sttFallback='ok';state._lastServerSpeechAt=Date.now();showSpeechLatency('server',state.media.serverSttStartedAt);",
  'server-result-latency'
);

replaceOnce(
  "try{recorder.start();state._serverSttTimer=setTimeout(()=>{try{if(recorder.state!=='inactive')recorder.stop()}catch{}},6500)",
  "try{state.media.serverSttStartedAt=performance.now();recorder.start();state._serverSttTimer=setTimeout(()=>{try{if(recorder.state!=='inactive')recorder.stop()}catch{}},state._mobileSpeechFastFallback?2200:6500)",
  'mobile-server-window'
);

replaceOnce(
  "if(mobileSpeech&&!mobileBrowserSpeech){startServerSpeechFallback();",
  "if(mobileSpeech&&!mobileBrowserSpeech){state._mobileSpeechFastFallback=true;startServerSpeechFallback();",
  'mobile-direct-fallback'
);

replaceOnce(
  "r.onstart=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;state.media.stt='listening';state.media.sttError='';updateInterimText(state.interimText||'')};r.onresult=async e=>{if(generation!==state._speechGeneration)return;",
  "r.onstart=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;state.media.stt='listening';state.media.sttError='';updateInterimText(state.interimText||'')};r.onspeechstart=()=>{if(generation===state._speechGeneration)state.media.speechDetectedAt=performance.now()};r.onresult=async e=>{if(generation!==state._speechGeneration)return;if(state.media.speechDetectedAt){showSpeechLatency('browser',state.media.speechDetectedAt);state.media.speechDetectedAt=0}",
  'browser-first-result-latency'
);

replaceOnce(
  "if(mobileSpeech&&code!=='no-speech'){clearTimeout(state._mobileSpeechFallbackTimer);startServerSpeechFallback();",
  "if(mobileSpeech&&code!=='no-speech'){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFastFallback=true;startServerSpeechFallback();",
  'mobile-error-fallback'
);

replaceOnce(
  "if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);startServerSpeechFallback();state.media.stt='server'}",
  "if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server'}",
  'mobile-catch-fallback'
);

replaceOnce(
  "return;startServerSpeechFallback();state.media.stt='server';const status=document.querySelector('#speechState');if(status)status.textContent='모바일 음성 인식 중'},3500)",
  "return;state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';const status=document.querySelector('#speechState');if(status)status.textContent='모바일 음성 인식 중'},1500)",
  'mobile-watchdog'
);

replaceOnce("const APP_VERSION='3.5.1'","const APP_VERSION='3.5.2'",'app-version');

for(const marker of [
  'state._lastChatScrollKey','moveOnce','data-original-save','data-translation-save',
  'watchedGeneration',"await postCaption(text,'browser')","if(e.message!=='not_found')throw e",
  'id="speechLatency"','showSpeechLatency','latest.getBoundingClientRect()',
  'state._mobileSpeechFastFallback?2200:6500'
])if(!source.includes(marker))throw new Error(`v352_contract_missing:${marker}`);

fs.writeFileSync(file,source);
console.log('VoiceFlow latest-message top anchor and measured STT latency v3.5.2 applied');

