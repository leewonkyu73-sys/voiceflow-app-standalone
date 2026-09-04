import fs from 'node:fs';
import crypto from 'node:crypto';

const appFile=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(appFile,'utf8');
const replaceOnce=(text,from,to,label)=>{const at=text.indexOf(from);if(at<0)throw new Error('v369_anchor_missing:'+label);if(text.indexOf(from,at+from.length)>=0)throw new Error('v369_anchor_duplicate:'+label);return text.slice(0,at)+to+text.slice(at+from.length)};

source=replaceOnce(
  source,
  '<small id="speechState">${speechStatus}</small>',
  '<small id="speechState" class="vf-speech-signal" data-speech-signal="${state.media.paused||!state.media.recording?\'idle\':state.media.stt===\'error\'||state.media.stt===\'denied\'||state.media.stt===\'unsupported\'?\'error\':state.media.stt===\'speaking\'?\'ready\':state.media.stt===\'listening\'?\'ready\':\'connecting\'}" role="status">${speechStatus}</small>',
  'speech-signal-markup'
);

const signalHelpers=`function ensureSpeechSignalStyles(){if(document.querySelector('#vfSpeechSignalStyles'))return;const style=document.createElement('style');style.id='vfSpeechSignalStyles';style.textContent='.vf-speech-signal{display:inline-flex;align-items:center;gap:6px;font-weight:800}.vf-speech-signal::before{content:"";width:10px;height:10px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 3px rgba(148,163,184,.18)}.vf-speech-signal[data-speech-signal="connecting"]::before{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.2)}.vf-speech-signal[data-speech-signal="ready"]::before{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.22),0 0 12px rgba(34,197,94,.72)}.vf-speech-signal[data-speech-signal="processing"]::before{background:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.2)}.vf-speech-signal[data-speech-signal="error"]::before{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.2)}';document.head.appendChild(style)}
function setSpeechSignal(signal,text){ensureSpeechSignalStyles();const el=document.querySelector('#speechState');if(!el)return;el.classList.add('vf-speech-signal');el.dataset.speechSignal=signal;if(text)el.textContent=text}
`;
source=replaceOnce(source,'function startSpeech(){',signalHelpers+'function startSpeech(){','speech-signal-helpers');
source=replaceOnce(source,"function startSpeech(){const mobileSpeech=","function startSpeech(){setSpeechSignal('connecting','준비 중입니다. 잠시 기다려 주세요.');const mobileSpeech=",'speech-signal-connecting');

const onStart="r.onstart=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;state.media.stt='listening';state.media.sttError='';state.media.recognitionStartedAt=performance.now();updateInterimText(state.interimText||'')};";
const readyEvents="let speechRecognitionStarted=false,speechAudioStarted=false;const markSpeechReady=()=>{if(speechRecognitionStarted&&speechAudioStarted)setSpeechSignal('ready','지금 말씀하세요.')};r.onstart=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;state.media.stt='listening';state.media.sttError='';state.media.recognitionStartedAt=performance.now();speechRecognitionStarted=true;markSpeechReady();updateInterimText(state.interimText||'')};r.onaudiostart=()=>{if(generation!==state._speechGeneration)return;speechAudioStarted=true;markSpeechReady()};";
source=replaceOnce(source,onStart,readyEvents,'speech-signal-ready-events');

source=replaceOnce(
  source,
  "r.onspeechstart=()=>{if(generation===state._speechGeneration){state.media.speechDetectedAt=performance.now();",
  "r.onspeechstart=()=>{if(generation===state._speechGeneration){setSpeechSignal('ready','지금 말씀하세요.');state.media.speechDetectedAt=performance.now();",
  'speech-signal-speaking'
);

source=replaceOnce(
  source,
  "r.onspeechend=()=>{if(generation!==state._speechGeneration)return;state.media.speechEndedAt=performance.now();if(mobileBrowserSpeech)try{r.stop()}catch{}};",
  "r.onspeechend=()=>{if(generation!==state._speechGeneration)return;state.media.speechEndedAt=performance.now();setSpeechSignal('processing','음성을 원문으로 변환 중입니다.');if(mobileBrowserSpeech)try{r.stop()}catch{}};",
  'speech-signal-processing'
);

source=replaceOnce(
  source,
  "if(finals.length&&mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);stopServerSpeechFallback()}updateInterimText(interim);",
  "if(finals.length)setSpeechSignal('processing','음성을 원문으로 변환 중입니다.');if(finals.length&&mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);stopServerSpeechFallback()}updateInterimText(interim);",
  'speech-signal-final-result'
);

source=replaceOnce(
  source,
  "const code=e.error||'error';recognitionCycle.error=code;state.media.sttError=code;",
  "const code=e.error||'error';recognitionCycle.error=code;state.media.sttError=code;setSpeechSignal(code==='no-speech'?'connecting':'error',code==='no-speech'?'다시 준비 중입니다.':'음성 연결을 확인해 주세요.');",
  'speech-signal-error'
);

source=replaceOnce(
  source,
  "if(state.meeting&&state.media.recording&&!state.media.paused&&!['unsupported','denied'].includes(state.media.stt))setTimeout(startSpeech,state.media.stt==='error'?1200:350)",
  "if(state.meeting&&state.media.recording&&!state.media.paused&&!['unsupported','denied'].includes(state.media.stt)){setSpeechSignal('connecting','다시 준비 중입니다.');setTimeout(startSpeech,state.media.stt==='error'?1200:350)}",
  'speech-signal-restart'
);

source=replaceOnce(
  source,
  "try{r.start()}catch(e){state._speechStarting=false;",
  "setSpeechSignal('connecting','준비 중입니다. 잠시 기다려 주세요.');try{r.start()}catch(e){state._speechStarting=false;setSpeechSignal('error','음성 연결을 확인해 주세요.');",
  'speech-signal-start-error'
);

source=replaceOnce(source,"const APP_VERSION='3.5.20'","const APP_VERSION='3.5.21'",'app-version');

for(const marker of [
  'class="vf-speech-signal"','data-speech-signal=',
  'function setSpeechSignal(signal,text)','r.onaudiostart=',
  "setSpeechSignal('ready','지금 말씀하세요.')",
  "setSpeechSignal('processing','음성을 원문으로 변환 중입니다.')",
  "setSpeechSignal('error','음성 연결을 확인해 주세요.')",
  'r.continuous=!mobileBrowserSpeech;r.interimResults=true;',
  'if(mobileBrowserSpeech)try{r.stop()}catch{}',
  "const APP_VERSION='3.5.21'"
])if(!source.includes(marker))throw new Error('v369_contract_missing:'+marker);

for(const forbidden of [
  'if(mobileBrowserSpeech)startServerSpeechFallback()',
  'if(mobileBrowserSpeech)extendServerSpeechFallback()',
  "browser-no-result-timeout'},1500)",
  'state._speechGeneration=generation+1;state._speechStarting=false;try{r.abort()}catch{}'
])if(source.includes(forbidden))throw new Error('v369_protected_stt_changed:'+forbidden);

fs.writeFileSync(appFile,source);

const indexFile=new URL('../public/index.html',import.meta.url);
let index=fs.readFileSync(indexFile,'utf8');
index=replaceOnce(index,'app.js?v=3.5.20','app.js?v=3.5.21','index-version');
fs.writeFileSync(indexFile,index);

const swFile=new URL('../public/sw.js',import.meta.url);
let sw=fs.readFileSync(swFile,'utf8');
sw=replaceOnce(sw,'voiceflow-shell-v346','voiceflow-shell-v347','pwa-cache');
fs.writeFileSync(swFile,sw);

const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
console.log('V369_ARTIFACT_SHA256 '+JSON.stringify({'public/app.js':sha256(appFile),'public/index.html':sha256(indexFile),'public/sw.js':sha256(swFile)}));
console.log('VoiceFlow speech readiness signal v3.5.21 applied');
