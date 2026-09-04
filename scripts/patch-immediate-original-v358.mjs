import fs from 'node:fs';

const file=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(file,'utf8');

const goldenCaptionCommit="state.captions.push(temp);try{";
if(!source.includes(goldenCaptionCommit))throw new Error('v358_anchor_missing:Golden-caption-commit');
const optimisticCaptionCommit="state.captions.push(temp);"+"if(state.view==='room')renderRoomStable(true);try{";
source=source.replace(goldenCaptionCommit,optimisticCaptionCommit);

if(!source.includes("const APP_VERSION='3.5.7'"))throw new Error('v358_anchor_missing:app-version');
source=source.replace("const APP_VERSION='3.5.7'","const APP_VERSION='3.5.17'");


const completedBarAnchor="function completedBarV347(){\n  if(!state.lastMeetingId)return '';",completedBarNext="function completedBarV347(){\n  if(!state.lastMeetingId||state.meeting?.status!=='ended')return '';";
if(!source.includes(completedBarAnchor))throw new Error('v3517_anchor_missing:completed-bar');
source=source.replace(completedBarAnchor,completedBarNext);
const launchAnchor="function launchSimpleSession(kind){const type='internal',name=",launchNext="function launchSimpleSession(kind){state.lastMeetingId=null;state.meetingResult=null;state.resultModal=false;state.resultSaveNotice='';state.resultBoardPost=null;state.captionSince=0;state.signalSince=0;state.chatDraft='';state.interimText='';state._lastSpeechCommit=null;const type='internal',name=";
if(!source.includes(launchAnchor))throw new Error('v3517_anchor_missing:new-session-reset');
source=source.replace(launchAnchor,launchNext);
const sendAnchor="$('#sendChat')?.addEventListener('click',async()=>{const e=$('#chatText');if(e?.value.trim()){const text=e.value.trim();state.chatDraft='';e.value='';await postCaption(text)}});",sendNext="$('#sendChat')?.addEventListener('click',async()=>{const e=$('#chatText'),text=e?.value.trim();if(!text)return;state.chatDraft=text;try{const sent=await postCaption(text);if(sent){state.chatDraft='';const current=$('#chatText');if(current)current.value=''}}catch(error){state.chatDraft=text;const current=$('#chatText');if(current)current.value=text;alert('메시지 전송 실패: '+String(error?.message||error))}});";
if(!source.includes(sendAnchor))throw new Error('v3517_anchor_missing:chat-send');
source=source.replace(sendAnchor,sendNext);
const stopAnchor="<button id=\"stopCapture\" class=\"vf-toolbar-complete danger\" type=\"button\">완료</button>",stopNext="<button id=\"stopCapture\" class=\"vf-toolbar-complete danger\" type=\"button\" aria-label=\"${videoOn?'화상 종료':'녹음 완료'}\">${videoOn?'화상 종료':'완료'}</button>";
if(!source.includes(stopAnchor))throw new Error('v3517_anchor_missing:video-stop-label');
source=source.replace(stopAnchor,stopNext);

const sessionStart="state.media.videoRecording=false;render();setTimeout(()=>{void syncSimpleSession({type,title,name,language,kind})},0)";
if(!source.includes(sessionStart))throw new Error('v358_anchor_missing:Golden-session-start');

const speechStart="try{r.start()}catch(e){";
if(!source.includes(speechStart))throw new Error('v358_anchor_missing:Golden-speech-start');

const generationStart='const generation=(state._speechGeneration||0)+1;state._speechGeneration=generation;';
const trackedGeneration="const generation=(state._speechGeneration||0)+1,recognitionCycle={result:false,error:''};state._speechGeneration=generation;";
if(!source.includes(generationStart))throw new Error('v3514_anchor_missing:recognition-cycle');
source=source.replace(generationStart,trackedGeneration);

const resultStart='r.onresult=async e=>{if(generation!==state._speechGeneration)return;';
const trackedResult='r.onresult=async e=>{if(generation!==state._speechGeneration)return;recognitionCycle.result=true;';
if(!source.includes(resultStart))throw new Error('v3514_anchor_missing:recognition-result');
source=source.replace(resultStart,trackedResult);

const errorStart="const code=e.error||'error';state.media.sttError=code;";
const trackedError="const code=e.error||'error';recognitionCycle.error=code;state.media.sttError=code;";
if(!source.includes(errorStart))throw new Error('v3514_anchor_missing:recognition-error');
source=source.replace(errorStart,trackedError);

const speechEnd="r.onend=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;if(!state.media.recording)updateInterimText('');if(state.meeting&&state.media.recording&&!state.media.paused&&!['unsupported','denied'].includes(state.media.stt))setTimeout(startSpeech,state.media.stt==='error'?1200:350)};";
const guardedSpeechEnd="r.onend=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;if(!state.media.recording)updateInterimText('');const mobileEmptyCycle=mobileSpeech&&!recognitionCycle.result;if(mobileEmptyCycle&&state.media.recording){state.media.sttError=recognitionCycle.error||'ended-without-result';updateInterimText('');clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';return}if(state.meeting&&state.media.recording&&!state.media.paused&&!['unsupported','denied'].includes(state.media.stt))setTimeout(startSpeech,state.media.stt==='error'?1200:350)};";
if(!source.includes(speechEnd))throw new Error('v3514_anchor_missing:recognition-end');
source=source.replace(speechEnd,guardedSpeechEnd);

const silentSessionAnchor="if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);state._mobileSpeechFallbackTimer=null}";
const goldenNoResultWatchdog="if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);const watchedGeneration=generation;state._mobileSpeechFallbackTimer=setTimeout(()=>{if(watchedGeneration!==state._speechGeneration||!state.meeting||!state.media.recording||state.media.paused||recognitionCycle.result)return;state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';state.media.sttError='browser-no-result-timeout'},1500)}";
if(!source.includes(silentSessionAnchor))throw new Error('v3516_anchor_missing:silent-session-watchdog');
source=source.replace(silentSessionAnchor,goldenNoResultWatchdog);

for(const marker of [
  optimisticCaptionCommit,
  "translation:'',validation:null","pending:true",
  "await api(`/api/v1/meetings/${state.meeting.id}/captions`",
  "if(state.view==='room')renderRoomStable(true);return mapped",
  "state._lastChatScrollKey","data-original-save","data-translation-save",
  "const APP_VERSION='3.5.17'",sessionStart,speechStart,
  'recognitionCycle={result:false,error:',"recognitionCycle.result=true",
  'recognitionCycle.error=code','mobileEmptyCycle','watchedGeneration=generation',
  "recognitionCycle.result)return","browser-no-result-timeout'},1500)",
  "startServerSpeechFallback();state.media.stt='server';return",completedBarNext,launchNext,sendNext,stopNext
])if(!source.includes(marker))throw new Error(`v358_contract_missing:${marker}`);

fs.writeFileSync(file,source);
const indexFile=new URL('../public/index.html',import.meta.url);
let index=fs.readFileSync(indexFile,'utf8');
if(!index.includes('app.js?v=3.5.8'))throw new Error('v358_anchor_missing:index-version');
if(!index.includes('pwa-install.js?v=3.6.6'))throw new Error('v358_anchor_missing:pwa-install-version');
if(!index.includes('audio-monitor.js?v=3.6.7'))throw new Error('v358_anchor_missing:audio-monitor-version');
index=index.replace('app.js?v=3.5.8','app.js?v=3.5.17');
fs.writeFileSync(indexFile,index);
const swFile=new URL('../public/sw.js',import.meta.url),sw=fs.readFileSync(swFile,'utf8');
if(!sw.includes("voiceflow-shell-v333"))throw new Error('v358_anchor_missing:pwa-cache');
fs.writeFileSync(swFile,sw.replace("voiceflow-shell-v333","voiceflow-shell-v343"));
console.log('VoiceFlow PC video re-entry and reliable chat v3.5.17 applied');
