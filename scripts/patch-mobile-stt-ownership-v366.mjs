import fs from 'node:fs';

const appFile=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(appFile,'utf8');
const replaceOnce=(text,from,to,label)=>{const at=text.indexOf(from);if(at<0)throw new Error(`v366_anchor_missing:${label}`);if(text.indexOf(from,at+from.length)>=0)throw new Error(`v366_anchor_duplicate:${label}`);return text.slice(0,at)+to+text.slice(at+from.length)};

const stopStart=source.indexOf('function stopServerSpeechFallback(){');
const speechStart=source.indexOf('function startSpeech(){',stopStart);
if(stopStart<0||speechStart<=stopStart)throw new Error('v366_anchor_missing:server-stt-functions');

const serverFallback=`function stopServerSpeechFallback(){clearTimeout(state._serverSttTimer);state._serverSttTimer=null;const recorder=state._serverSttRecorder,request=state._serverSttAbort;state._serverSttGeneration=(state._serverSttGeneration||0)+1;state._serverSttActive=false;state._serverSttRecorder=null;state._serverSttAbort=null;try{request?.abort?.()}catch{}try{if(recorder&&recorder.state!=='inactive')recorder.stop()}catch{}}
function showSpeechLatency(mode,startedAt){const start=Number(startedAt||0);if(!start)return;const ms=Math.max(0,Math.round(performance.now()-start));state.media.sttLatencyMs=ms;state.media.sttLatencyMode=mode;const el=document.querySelector('#speechLatency');if(el)el.textContent=(mode==='server'?'서버 확정 ':'문장 확정 ')+(ms/1000).toFixed(1)+'초'}
function extendServerSpeechFallback(){const recorder=state._serverSttRecorder,generation=state._serverSttGeneration;if(!state._serverSttActive||!recorder||recorder.state==='inactive')return;clearTimeout(state._serverSttTimer);const segmentMs=6500;state._serverSttTimer=setTimeout(()=>{if(!state._serverSttActive||state._serverSttGeneration!==generation||state._serverSttRecorder!==recorder)return;try{if(recorder.state!=='inactive')recorder.stop()}catch{}},segmentMs)}
function startServerSpeechFallback(){if(state._serverSttActive||!state.media.stream||!window.MediaRecorder||!state.meeting)return;const generation=(state._serverSttGeneration||0)+1;state._serverSttGeneration=generation;state._serverSttActive=true;const owns=()=>state._serverSttActive&&state._serverSttGeneration===generation;const cycle=()=>{if(!owns())return;if(!state.meeting||!state.media.recording){stopServerSpeechFallback();return}if(state.media.paused){state._serverSttTimer=setTimeout(cycle,700);return}let chunks=[];let recorder;try{const preferred=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported?.(x));recorder=new MediaRecorder(state.media.stream,preferred?{mimeType:preferred}:undefined)}catch{if(owns()){state._serverSttActive=false;state.media.sttFallback='unsupported'}return}if(!owns())return;state._serverSttRecorder=recorder;recorder.ondataavailable=e=>{if(owns()&&e.data?.size)chunks.push(e.data)};recorder.onstop=async()=>{if(!owns())return;const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});chunks=[];if(blob.size>900&&!state.media.paused&&state.meeting){const request=new AbortController();state._serverSttAbort=request;try{state.media.sttFallback='uploading';const lang=localStorage.sourceLanguage||state.meeting?.language||locale[state.lang]||'ko-KR';const response=await fetch('/api/v1/meetings/'+encodeURIComponent(state.meeting.id)+'/transcribe',{method:'POST',headers:{'content-type':blob.type||'audio/webm','x-voice-language':lang},body:blob,signal:request.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||('HTTP '+response.status));if(!owns())return;const text=String(data.text||'').trim();if(text){state.media.stt='server';state.media.sttFallback='ok';state._lastServerSpeechAt=Date.now();showSpeechLatency('server',state.media.serverSttStartedAt);updateInterimText('');if(!owns())return;await postCaption(text,'server')}}catch(e){if(owns()&&e?.name!=='AbortError'){state.media.sttFallback='error';state.media.sttError=String(e?.message||e)}}finally{if(state._serverSttAbort===request)state._serverSttAbort=null}}if(owns()&&state.meeting&&state.media.recording)state._serverSttTimer=setTimeout(cycle,250);else if(owns())stopServerSpeechFallback()};try{state.media.serverSttStartedAt=performance.now();recorder.start();extendServerSpeechFallback()}catch{if(owns())state._serverSttActive=false}};cycle()}
`;
source=source.slice(0,stopStart)+serverFallback+source.slice(speechStart);

const onStart="r.onstart=()=>{if(generation!==state._speechGeneration)return;state._speechStarting=false;state.media.stt='listening';state.media.sttError='';state.media.recognitionStartedAt=performance.now();updateInterimText(state.interimText||'')};";
if(!source.includes(onStart))throw new Error('v366_anchor_missing:browser-shadow-start');

const speechDetected="const latency=document.querySelector('#speechLatency');if(latency)latency.textContent='문장 확정 측정 중'";
const speechBoundary="const latency=document.querySelector('#speechLatency');if(latency)latency.textContent='문장 확정 측정 중';if(mobileBrowserSpeech)extendServerSpeechFallback()";
if(!source.includes(speechDetected))throw new Error('v366_anchor_missing:speech-boundary');
source=source.replace(speechDetected,speechBoundary);

const recognitionStart="if(['ko-KR','vi-VN','en-US','zh-CN','ja-JP'].includes(fixedSourceLanguage))r.lang=fixedSourceLanguage;try{r.start()}";
const bufferedRecognitionStart="if(['ko-KR','vi-VN','en-US','zh-CN','ja-JP'].includes(fixedSourceLanguage))r.lang=fixedSourceLanguage;if(mobileBrowserSpeech)startServerSpeechFallback();try{r.start()}";
if(!source.includes(recognitionStart))throw new Error('v366_anchor_missing:pre-recognition-shadow');
source=source.replace(recognitionStart,bufferedRecognitionStart);

const cycleTracking="recognitionCycle={result:false,error:''}";
const finalTracking="recognitionCycle={result:false,final:false,error:''}";
if(!source.includes(cycleTracking))throw new Error('v366_anchor_missing:final-cycle-tracking');
source=source.replace(cycleTracking,finalTracking);

const finalResult="if(e.results[i].isFinal){state._lastBrowserPreviewAt=Date.now();";
const trackedFinalResult="if(e.results[i].isFinal){recognitionCycle.final=true;state._lastBrowserPreviewAt=Date.now();";
if(!source.includes(finalResult))throw new Error('v366_anchor_missing:final-result-tracking');
source=source.replace(finalResult,trackedFinalResult);

const browserResultOwnership="if((interim||finals.length)&&mobileSpeech)clearTimeout(state._mobileSpeechFallbackTimer);updateInterimText(interim);if(finals.length&&mobileSpeech)stopServerSpeechFallback();";
const browserResultOwns="if(finals.length&&mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);stopServerSpeechFallback()}updateInterimText(interim);";
if(!source.includes(browserResultOwnership))throw new Error('v366_anchor_missing:browser-result-ownership');
source=source.replace(browserResultOwnership,browserResultOwns);

const resultWatchdog="||recognitionCycle.result)return;";
const finalWatchdog="||recognitionCycle.final)return;";
if(!source.includes(resultWatchdog))throw new Error('v366_anchor_missing:final-watchdog');
source=source.replace(resultWatchdog,finalWatchdog);

const emptyCycle="const mobileEmptyCycle=mobileSpeech&&!recognitionCycle.result;if(mobileEmptyCycle&&state.media.recording)";
const incompleteCycle="const mobileIncompleteCycle=mobileSpeech&&!recognitionCycle.final;if(mobileIncompleteCycle&&state.media.recording)";
if(!source.includes(emptyCycle))throw new Error('v366_anchor_missing:incomplete-cycle');
source=source.replace(emptyCycle,incompleteCycle);
source=replaceOnce(source,"recognitionCycle.error||'ended-without-result'","recognitionCycle.error||'ended-without-final'",'incomplete-cycle-error');

const watchdogHandoff="state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';state.media.sttError='browser-no-result-timeout'";
const exclusiveWatchdogHandoff="state._speechGeneration=generation+1;state._speechStarting=false;try{r.abort()}catch{}state._mobileSpeechFastFallback=true;startServerSpeechFallback();state.media.stt='server';state.media.sttError='browser-no-result-timeout'";
if(!source.includes(watchdogHandoff))throw new Error('v366_anchor_missing:exclusive-watchdog-handoff');
source=source.replace(watchdogHandoff,exclusiveWatchdogHandoff);

source=replaceOnce(source,"const APP_VERSION='3.5.17'","const APP_VERSION='3.5.18'",'app-version');

for(const marker of [
  'state._serverSttGeneration=(state._serverSttGeneration||0)+1',
  'request?.abort?.()',
  "const owns=()=>state._serverSttActive&&state._serverSttGeneration===generation",
  'if(!owns())return;const blob=',
  'signal:request.signal',
  'const segmentMs=6500',
  'if(mobileBrowserSpeech)startServerSpeechFallback()',
  'if(mobileBrowserSpeech)extendServerSpeechFallback()',
  'recognitionCycle={result:false,final:false,error:',
  'recognitionCycle.final=true',
  'if(finals.length&&mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);stopServerSpeechFallback()}',
  'recognitionCycle.final)return',
  'mobileIncompleteCycle=mobileSpeech&&!recognitionCycle.final',
  "recognitionCycle.error||'ended-without-final'",
  'state._speechGeneration=generation+1;state._speechStarting=false;try{r.abort()}catch{}',
  "const APP_VERSION='3.5.18'"
])if(!source.includes(marker))throw new Error(`v366_contract_missing:${marker}`);
if(source.includes('state._mobileSpeechFastFallback?2200:6500'))throw new Error('v366_contract_failed:truncated-fast-segment');
fs.writeFileSync(appFile,source);

const indexFile=new URL('../public/index.html',import.meta.url);
let index=fs.readFileSync(indexFile,'utf8');
index=replaceOnce(index,'app.js?v=3.5.17','app.js?v=3.5.18','index-version');
fs.writeFileSync(indexFile,index);

const swFile=new URL('../public/sw.js',import.meta.url);
let sw=fs.readFileSync(swFile,'utf8');
sw=replaceOnce(sw,"voiceflow-shell-v343","voiceflow-shell-v344",'pwa-cache');
fs.writeFileSync(swFile,sw);

console.log('VoiceFlow Samsung speech-boundary ownership v3.5.18 applied');
