import fs from 'node:fs';

const file=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const lines=source.split('\n');
const speechIndex=lines.findIndex(line=>line.startsWith('function startSpeech(){'));
if(speechIndex<0)throw new Error('mobile_chrome_watchdog_anchor_missing:startSpeech');
const originalSpeech=lines[speechIndex];
let speech=originalSpeech;

const resultAnchor="updateInterimText(interim);for(const text of finals)await postCaption(text,'browser')}";
const resultNext="if((interim||finals.length)&&mobileSpeech)clearTimeout(state._mobileSpeechFallbackTimer);updateInterimText(interim);if(finals.length&&mobileSpeech)stopServerSpeechFallback();for(const text of finals)await postCaption(text,'browser')}";
if(!speech.includes(resultAnchor))throw new Error('mobile_chrome_watchdog_anchor_missing:result');
speech=speech.replace(resultAnchor,resultNext);

const errorAnchor="updateInterimText('')};r.onend=";
const errorNext="updateInterimText('');if(mobileSpeech&&code!=='no-speech'){clearTimeout(state._mobileSpeechFallbackTimer);startServerSpeechFallback();state.media.stt='server'}};r.onend=";
if(!speech.includes(errorAnchor))throw new Error('mobile_chrome_watchdog_anchor_missing:error');
speech=speech.replace(errorAnchor,errorNext);

const startAnchor="try{r.start()}catch(e){state._speechStarting=false;state.media.stt='error';state.media.sttError=String(e?.message||e);updateInterimText('')}}";
const startNext="if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);const watchedGeneration=generation;state._mobileSpeechFallbackTimer=setTimeout(()=>{if(watchedGeneration!==state._speechGeneration||!state.meeting||!state.media.recording||state.media.paused)return;startServerSpeechFallback();state.media.stt='server';const status=document.querySelector('#speechState');if(status)status.textContent='모바일 음성 인식 중'},3500)}try{r.start()}catch(e){state._speechStarting=false;state.media.stt='error';state.media.sttError=String(e?.message||e);updateInterimText('');if(mobileSpeech){clearTimeout(state._mobileSpeechFallbackTimer);startServerSpeechFallback();state.media.stt='server'}}}";
if(!speech.includes(startAnchor))throw new Error('mobile_chrome_watchdog_anchor_missing:start');
speech=speech.replace(startAnchor,startNext);
lines[speechIndex]=speech;
source=lines.join('\n');

const saveAnchor="const draft=await api('/api/v1/meeting-results/'+encodeURIComponent(state.lastMeetingId)+'/draft',{method:'PATCH',body:JSON.stringify({language:state.resultLanguage||localStorage.targetLanguage||'ko-KR',summary,decisions,risks,actions:actionRows.map(text=>({text}))})});\n      state.meetingResult={...(state.meetingResult||{}),...(draft.data?.result||{})};";
const saveNext="let draft=null;try{draft=await api('/api/v1/meeting-results/'+encodeURIComponent(state.lastMeetingId)+'/draft',{method:'PATCH',body:JSON.stringify({language:state.resultLanguage||localStorage.targetLanguage||'ko-KR',summary,decisions,risks,actions:actionRows.map(text=>({text}))})})}catch(e){if(e.message!=='not_found')throw e}\n      if(draft)state.meetingResult={...(state.meetingResult||{}),...(draft.data?.result||{})};";
if(!source.includes(saveAnchor))throw new Error('result_save_anchor_missing:draft');
source=source.replace(saveAnchor,saveNext);

const savingAnchor="save.disabled=true;const msg=document.querySelector('#resultLibraryMessage');";
const savingNext="save.disabled=true;const msg=document.querySelector('#resultLibraryMessage');if(msg)msg.classList.remove('is-error');";
if(!source.includes(savingAnchor))throw new Error('result_save_anchor_missing:message');
source=source.replace(savingAnchor,savingNext);

const failureAnchor="}catch(e){if(msg)msg.textContent='저장 실패: '+e.message;save.disabled=false}";
const failureNext="}catch(e){if(msg){msg.textContent='저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';msg.classList.add('is-error')}save.disabled=false}";
if(!source.includes(failureAnchor))throw new Error('result_save_anchor_missing:failure');
source=source.replace(failureAnchor,failureNext);

source=source.replace("const APP_VERSION='3.4.4'","const APP_VERSION='3.5.1'");

source=source
  .replace('id="replayResult" type="button" ${url?\'\':\'disabled\'}>▶ 다시 듣기','id="replayResult" type="button" ${url?\'\':\'disabled\'}>다시 듣기')
  .replace('id="homeAfterResult" type="button">홈</button>','id="homeAfterResult" type="button">홈으로</button>')
  .replace('id="closeResultModal2" type="button">취소</button>','id="closeResultModal2" type="button">닫기</button>');

if(lines[speechIndex]===originalSpeech)throw new Error('mobile_chrome_watchdog_not_applied');
if(!source.includes("watchedGeneration")||!source.includes("if(e.message!=='not_found')throw e")||!source.includes("classList.add('is-error')"))throw new Error('v351_contract_missing');
if(!source.includes('state._lastChatScrollKey')||!source.includes('moveOnce'))throw new Error('protected_scroll_contract_changed');
if(!source.includes('data-original-save')||!source.includes('data-translation-save'))throw new Error('protected_editor_contract_changed');
fs.writeFileSync(file,source);
console.log('VoiceFlow Android Chrome STT watchdog and result save UI v3.5.1 applied');

