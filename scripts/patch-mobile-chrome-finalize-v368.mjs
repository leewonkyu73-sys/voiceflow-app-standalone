import fs from 'node:fs';

const appFile=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(appFile,'utf8');
const replaceOnce=(text,from,to,label)=>{const at=text.indexOf(from);if(at<0)throw new Error(`v368_anchor_missing:${label}`);if(text.indexOf(from,at+from.length)>=0)throw new Error(`v368_anchor_duplicate:${label}`);return text.slice(0,at)+to+text.slice(at+from.length)};

source=replaceOnce(
  source,
  'r.continuous=true;r.interimResults=true;',
  'r.continuous=!mobileBrowserSpeech;r.interimResults=true;',
  'android-chrome-single-utterance'
);

source=replaceOnce(
  source,
  'r.onspeechend=()=>{if(generation===state._speechGeneration)state.media.speechEndedAt=performance.now()};',
  'r.onspeechend=()=>{if(generation!==state._speechGeneration)return;state.media.speechEndedAt=performance.now();if(mobileBrowserSpeech)try{r.stop()}catch{}};',
  'android-chrome-finalize-on-speech-end'
);

source=replaceOnce(source,"const APP_VERSION='3.5.19'","const APP_VERSION='3.5.20'",'app-version');

for(const marker of [
  'r.continuous=!mobileBrowserSpeech;r.interimResults=true;',
  'if(mobileBrowserSpeech)try{r.stop()}catch{}',
  "await postCaption(text,'browser')",
  'if(mobileBrowserSpeech){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFallbackTimer=null}',
  "const APP_VERSION='3.5.20'"
])if(!source.includes(marker))throw new Error(`v368_contract_missing:${marker}`);

for(const forbidden of [
  'if(mobileBrowserSpeech)startServerSpeechFallback()',
  'if(mobileBrowserSpeech)extendServerSpeechFallback()',
  "browser-no-result-timeout'},1500)",
  'state._speechGeneration=generation+1;state._speechStarting=false;try{r.abort()}catch{}'
])if(source.includes(forbidden))throw new Error(`v368_android_chrome_server_handoff_remaining:${forbidden}`);

fs.writeFileSync(appFile,source);

const indexFile=new URL('../public/index.html',import.meta.url);
let index=fs.readFileSync(indexFile,'utf8');
index=replaceOnce(index,'app.js?v=3.5.19','app.js?v=3.5.20','index-version');
fs.writeFileSync(indexFile,index);

const swFile=new URL('../public/sw.js',import.meta.url);
let sw=fs.readFileSync(swFile,'utf8');
sw=replaceOnce(sw,'voiceflow-shell-v345','voiceflow-shell-v346','pwa-cache');
fs.writeFileSync(swFile,sw);

console.log('VoiceFlow Android Chrome single-utterance finalization v3.5.20 applied');
