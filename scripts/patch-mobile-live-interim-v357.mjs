import fs from 'node:fs';

const file=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const replaceOnce=(from,to,label)=>{
  if(!source.includes(from))throw new Error('v357_anchor_missing:'+label);
  source=source.replace(from,to);
};

const competingWatchdog="if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);const watchedGeneration=generation;state._mobileSpeechFallbackTimer=setTimeout(()=>{if(watchedGeneration!==state._speechGeneration||!state.meeting||!state.media.recording||state.media.paused)return;state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';const status=document.querySelector('#speechState');if(status)status.textContent='모바일 음성 인식 중'},1500)}";
const browserSingleOwner="if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFallbackTimer=null}";
const competingErrorFallback="if(mobileSpeech&&code!=='no-speech'){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server'}";
const browserOnlyError="if(mobileSpeech&&!mobileBrowserSpeech&&code!=='no-speech'){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server'}";
const competingStartFallback="if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server'}";
const browserOnlyStart="if(mobileSpeech&&!mobileBrowserSpeech){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server'}";

for(const [marker,label] of [
  ['r.continuous=true;r.interimResults=true;','golden-continuous-mode'],
  [competingWatchdog,'competing-recognition-watchdog'],
  [competingErrorFallback,'competing-error-fallback'],
  [competingStartFallback,'competing-start-fallback'],
  ["setTimeout(startSpeech,state.media.stt==='error'?1200:350)",'golden-restart-delay']
])if(!source.includes(marker))throw new Error('v357_anchor_missing:'+label);

replaceOnce(competingWatchdog,browserSingleOwner,'mobile-browser-single-owner');
replaceOnce(competingErrorFallback,browserOnlyError,'mobile-browser-error-owner');
replaceOnce(competingStartFallback,browserOnlyStart,'mobile-browser-start-owner');
replaceOnce("const APP_VERSION='3.5.6'","const APP_VERSION='3.5.7'",'app-version');

for(const marker of [
  'r.continuous=true;r.interimResults=true',browserSingleOwner,browserOnlyError,browserOnlyStart,
  "updateInterimText(interim)","await postCaption(text,'browser')",
  "setTimeout(startSpeech,state.media.stt==='error'?1200:350)","const APP_VERSION='3.5.7'",
  'state._lastChatScrollKey','data-original-save','data-translation-save',
  'state.resultSaveNotice','libraryMeta','id="vfRoomDock"'
])if(!source.includes(marker))throw new Error('v357_contract_missing:'+marker);

for(const marker of [competingWatchdog,competingErrorFallback,competingStartFallback])
  if(source.includes(marker))throw new Error('v357_competing_mobile_stt_owner_remaining');

if(source.includes('r.continuous=!mobileSpeech')||source.includes('mobileSpeech?80:350'))throw new Error('v357_mobile_restart_regression');

fs.writeFileSync(file,source);
console.log('VoiceFlow Android Chrome browser STT single-owner v3.5.7 applied');
