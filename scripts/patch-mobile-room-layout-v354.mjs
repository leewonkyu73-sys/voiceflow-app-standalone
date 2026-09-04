import fs from 'node:fs';

const file=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const replaceOnce=(from,to,label)=>{
  if(!source.includes(from))throw new Error(`v354_anchor_missing:${label}`);
  source=source.replace(from,to);
};

replaceOnce(
  '<section id="vfCoreActions" class="vf-core-actions">',
  '<div id="vfRoomDock" class="vf-room-dock"><section id="vfCoreActions" class="vf-core-actions">',
  'dock-open'
);

replaceOnce(
  '<button id="sendChat" class="vf-send-icon" type="button" aria-label="전송·실행" title="전송·실행">➤</button></section>${state.resultModal?resultModalV347():\'\'}',
  '<button id="sendChat" class="vf-send-icon" type="button" aria-label="전송·실행" title="전송·실행">➤</button></section></div>${state.resultModal?resultModalV347():\'\'}',
  'dock-close'
);

replaceOnce(
  "r.onstart=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;state.media.stt='listening';state.media.sttError='';updateInterimText(state.interimText||'')};r.onspeechstart=",
  "r.onstart=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;state.media.stt='listening';state.media.sttError='';state.media.recognitionStartedAt=performance.now();updateInterimText(state.interimText||'')};r.onspeechstart=",
  'recognition-start-time'
);

replaceOnce(
  "if(state.media.speechDetectedAt){showSpeechLatency('browser',state.media.speechDetectedAt);state.media.speechDetectedAt=0}",
  "const latencyStart=state.media.speechDetectedAt||state.media.recognitionStartedAt;if(latencyStart){showSpeechLatency('browser',latencyStart);state.media.speechDetectedAt=0;state.media.recognitionStartedAt=0}",
  'recognition-result-time'
);

replaceOnce("const APP_VERSION='3.5.3'","const APP_VERSION='3.5.4'",'app-version');

for(const marker of [
  'id="vfRoomDock"','recognitionStartedAt','const latencyStart=',
  'state._lastChatScrollKey','latest.getBoundingClientRect()','data-original-save',
  'data-translation-save','state.resultSaveNotice','libraryMeta',
  "await postCaption(text,'browser')","const APP_VERSION='3.5.4'"
])if(!source.includes(marker))throw new Error(`v354_contract_missing:${marker}`);

fs.writeFileSync(file,source);
console.log('VoiceFlow unified mobile room dock and reliable latency display v3.5.4 applied');

