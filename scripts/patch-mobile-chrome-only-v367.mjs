import fs from 'node:fs';

const appFile=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(appFile,'utf8');
const replaceOnce=(text,from,to,label)=>{const at=text.indexOf(from);if(at<0)throw new Error(`v367_anchor_missing:${label}`);if(text.indexOf(from,at+from.length)>=0)throw new Error(`v367_anchor_duplicate:${label}`);return text.slice(0,at)+to+text.slice(at+from.length)};

source=replaceOnce(
  source,
  "if(mobileBrowserSpeech)startServerSpeechFallback();try{r.start()}",
  "try{r.start()}",
  'remove-android-chrome-shadow-start'
);

source=replaceOnce(
  source,
  "const latency=document.querySelector('#speechLatency');if(latency)latency.textContent='문장 확정 측정 중';if(mobileBrowserSpeech)extendServerSpeechFallback()",
  "const latency=document.querySelector('#speechLatency');if(latency)latency.textContent='문장 확정 측정 중'",
  'remove-android-chrome-shadow-extension'
);

const serverHandoffWatchdog="if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);const watchedGeneration=generation;state._mobileSpeechFallbackTimer=setTimeout(()=>{if(watchedGeneration!==state._speechGeneration||!state.meeting||!state.media.recording||state.media.paused||recognitionCycle.final)return;state._speechGeneration=generation+1;state._speechStarting=false;try{r.abort()}catch{}state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';state.media.sttError='browser-no-result-timeout'},1500)}";
const browserOnlyOwnership="if(mobileBrowserSpeech){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFallbackTimer=null}";
source=replaceOnce(source,serverHandoffWatchdog,browserOnlyOwnership,'remove-android-chrome-watchdog-handoff');

source=replaceOnce(
  source,
  "const mobileIncompleteCycle=mobileSpeech&&!recognitionCycle.final;",
  "const mobileIncompleteCycle=mobileSpeech&&!mobileBrowserSpeech&&!recognitionCycle.final;",
  'remove-android-chrome-end-handoff'
);

source=replaceOnce(source,"const APP_VERSION='3.5.18'","const APP_VERSION='3.5.19'",'app-version');

for(const marker of [
  "const mobileBrowserSpeech=",
  "if(mobileSpeech&&!mobileBrowserSpeech)",
  browserOnlyOwnership,
  "const mobileIncompleteCycle=mobileSpeech&&!mobileBrowserSpeech&&!recognitionCycle.final;",
  "await postCaption(text,'browser')",
  "const APP_VERSION='3.5.19'"
])if(!source.includes(marker))throw new Error(`v367_contract_missing:${marker}`);

for(const forbidden of [
  "if(mobileBrowserSpeech)startServerSpeechFallback()",
  "if(mobileBrowserSpeech)extendServerSpeechFallback()",
  "browser-no-result-timeout'},1500)",
  "state._speechGeneration=generation+1;state._speechStarting=false;try{r.abort()}catch{}"
])if(source.includes(forbidden))throw new Error(`v367_android_chrome_server_handoff_remaining:${forbidden}`);

fs.writeFileSync(appFile,source);

const indexFile=new URL('../public/index.html',import.meta.url);
let index=fs.readFileSync(indexFile,'utf8');
index=replaceOnce(index,'app.js?v=3.5.18','app.js?v=3.5.19','index-version');
fs.writeFileSync(indexFile,index);

const swFile=new URL('../public/sw.js',import.meta.url);
let sw=fs.readFileSync(swFile,'utf8');
sw=replaceOnce(sw,"voiceflow-shell-v344","voiceflow-shell-v345",'pwa-cache');
fs.writeFileSync(swFile,sw);

console.log('VoiceFlow Android Chrome browser-only STT v3.5.19 applied');
