import fs from 'node:fs';

const appFile=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(appFile,'utf8');
const replaceOnce=(text,from,to,label)=>{const at=text.indexOf(from);if(at<0)throw new Error('v370_anchor_missing:'+label);if(text.indexOf(from,at+from.length)>=0)throw new Error('v370_anchor_duplicate:'+label);return text.slice(0,at)+to+text.slice(at+from.length)};

source=replaceOnce(
  source,
  "setSpeechSignal('connecting','준비 중입니다. 잠시 기다려 주세요.');try{r.start()}",
  "if(mobileBrowserSpeech)startServerSpeechFallback();setSpeechSignal('connecting','준비 중입니다. 잠시 기다려 주세요.');try{r.start()}",
  'android-buffer-before-browser-start'
);

const previousEnd="r.onend=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;if(!state.media.recording)updateInterimText('');const mobileIncompleteCycle=mobileSpeech&&!mobileBrowserSpeech&&!recognitionCycle.final;if(mobileIncompleteCycle&&state.media.recording){state.media.sttError=recognitionCycle.error||'ended-without-final';updateInterimText('');clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';return}if(state.meeting&&state.media.recording&&!state.media.paused&&!['unsupported','denied'].includes(state.media.stt)){setSpeechSignal('connecting','다시 준비 중입니다.');setTimeout(startSpeech,state.media.stt==='error'?1200:350)}};";
const fallbackEnd="r.onend=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;if(!state.media.recording)updateInterimText('');const mobileIncompleteCycle=mobileSpeech&&!recognitionCycle.final;if(mobileIncompleteCycle&&state.media.recording){state.media.sttError=recognitionCycle.error||'ended-without-final';updateInterimText('');clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFallbackTimer=null;state._mobileSpeechFastFallback=true;state.media.stt='server';setSpeechSignal('processing','음성을 서버에서 원문으로 변환 중입니다.');const recorder=state._serverSttRecorder;clearTimeout(state._serverSttTimer);state._serverSttTimer=null;try{if(recorder&&recorder.state!=='inactive')recorder.stop();else startServerSpeechFallback()}catch{startServerSpeechFallback()}return}if(state.meeting&&state.media.recording&&!state.media.paused&&!['unsupported','denied'].includes(state.media.stt)){setSpeechSignal('connecting','다시 준비 중입니다.');setTimeout(startSpeech,state.media.stt==='error'?1200:350)}};";
source=replaceOnce(source,previousEnd,fallbackEnd,'android-ended-without-final-handoff');

source=replaceOnce(source,"const APP_VERSION='3.5.21'","const APP_VERSION='3.5.22'",'app-version');

for(const marker of [
  "if(mobileBrowserSpeech)startServerSpeechFallback();setSpeechSignal('connecting'",
  "const mobileIncompleteCycle=mobileSpeech&&!recognitionCycle.final",
  "setSpeechSignal('processing','음성을 서버에서 원문으로 변환 중입니다.')",
  "if(recorder&&recorder.state!=='inactive')recorder.stop()",
  "if(finals.length&&mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);stopServerSpeechFallback()}",
  "const APP_VERSION='3.5.22'"
])if(!source.includes(marker))throw new Error('v370_contract_missing:'+marker);

if(source.includes("const mobileIncompleteCycle=mobileSpeech&&!mobileBrowserSpeech&&!recognitionCycle.final"))throw new Error('v370_android_handoff_disabled');

fs.writeFileSync(appFile,source);

const indexFile=new URL('../public/index.html',import.meta.url);
let index=fs.readFileSync(indexFile,'utf8');
index=replaceOnce(index,'app.js?v=3.5.21','app.js?v=3.5.22','index-version');
fs.writeFileSync(indexFile,index);

const swFile=new URL('../public/sw.js',import.meta.url);
let sw=fs.readFileSync(swFile,'utf8');
sw=replaceOnce(sw,'voiceflow-shell-v347','voiceflow-shell-v348','pwa-cache');
fs.writeFileSync(swFile,sw);

console.log('VoiceFlow Android Chrome browser-final to VPS STT handoff v3.5.22 applied');
