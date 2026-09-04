import fs from 'node:fs';

const file=new URL('../public/app.js',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const replaceOnce=(from,to,label)=>{
  if(!source.includes(from))throw new Error(`v353_anchor_missing:${label}`);
  source=source.replace(from,to);
};

replaceOnce(
  'return `<section class="vf-completed-tools" aria-label="저장 완료 도구"><b>✓ 저장 완료</b><button id="replayResult" type="button" ${url?\'\':\'disabled\'}>다시 듣기</button><button id="openResultSummary" class="primary" type="button">✨ 음성·텍스트 정리</button><button id="homeAfterResult" type="button">홈으로</button>${url?`<${state.media.lastVideoUrl?\'video\':\'audio\'} id="resultReplayMedia" src="${url}" preload="metadata" playsinline hidden></${state.media.lastVideoUrl?\'video\':\'audio\'}>`:\'\'}</section>`;',
  'return `<section class="vf-completed-tools" aria-label="저장 완료 도구"><b>✓ 저장 완료</b><button id="replayResult" type="button" ${url?\'\':\'disabled\'}>다시 듣기</button><button id="openResultSummary" class="primary" type="button">✨ 음성·텍스트 정리</button>${state.resultSaveNotice?`<span class="vf-save-success" role="status">✓ ${esc(state.resultSaveNotice)}</span><button id="openSavedLibrary" type="button">자료실 확인</button>`:\'\'}<button id="homeAfterResult" type="button">홈으로</button>${url?`<${state.media.lastVideoUrl?\'video\':\'audio\'} id="resultReplayMedia" src="${url}" preload="metadata" playsinline hidden></${state.media.lastVideoUrl?\'video\':\'audio\'}>`:\'\'}</section>`;',
  'completed-save-notice'
);

const oldEnd="async function endMeeting(){closeRtcPeersV343();if(!state.meeting)return;const mid=state.meeting.id;try{await stopRecording();clearInterval(state.poll);clearInterval(state.signalPoll);try{(state.media.stream?.getTracks?.()||[]).forEach(x=>x.stop());(state.video._cameraStream?.getTracks?.()||[]).forEach(x=>x.stop());window.VoiceFlowAudioMonitor?.stop?.()}catch{}const fin=await api(`/api/v1/meetings/${mid}/finalize`,{method:'POST',body:'{}'});state.meetingResult=fin.data||{};state.lastMeetingId=mid;state.meeting={...state.meeting,status:'ended'};state.resultModal=true;render()}catch(err){alert(`회의 종료 실패: ${err.message}`)}}";
const newEnd="async function endMeeting(){closeRtcPeersV343();if(!state.meeting)return;const mid=state.meeting.id;try{await stopRecording();clearInterval(state.poll);clearInterval(state.signalPoll);try{(state.media.stream?.getTracks?.()||[]).forEach(x=>x.stop());(state.video._cameraStream?.getTracks?.()||[]).forEach(x=>x.stop());window.VoiceFlowAudioMonitor?.stop?.()}catch{}const transcript=state.captions.map(c=>{const text=String(c.text||'').trim();return text?String(c.speaker||'참여자')+': '+text:''}).filter(Boolean).join('\\n'),participants=[...new Set(state.captions.map(c=>String(c.speaker||'').trim()).filter(Boolean))];state.meetingResult={started_at:state.media.startedAt||Date.now(),ended_at:Date.now(),duration_seconds:state.media.elapsed||0,participants,summary:transcript||'정리할 내용 없음',decisions:[],risks:[],actions:[],_preparing:true};state.lastMeetingId=mid;state.meeting={...state.meeting,status:'ended'};state.resultModal=true;state.resultSaveNotice='';render();try{const fin=await api(`/api/v1/meetings/${mid}/finalize`,{method:'POST',body:'{}'});state.meetingResult={...(fin.data||state.meetingResult),_preparing:false};if(!state.resultModal)render()}catch(finalizeError){state.meetingResult={...state.meetingResult,_preparing:false,_finalizeError:String(finalizeError?.message||finalizeError)};if(!state.resultModal)render()}}catch(err){alert(`회의 종료 실패: ${err.message}`)}}";
replaceOnce(oldEnd,newEnd,'fast-completed-tools');

replaceOnce(
  "const payload={board_type:'library',title,body,category:contentType==='voice-memo'?'voice-memo':'minutes',scope:contentType==='voice-memo'?'personal':'work',visibility:contentType==='voice-memo'?'private':'staff',tags:[contentType,'meeting:'+state.lastMeetingId],attachments:[{kind:'meeting-result',meeting_id:state.lastMeetingId,media_available:Boolean(state.media.lastAudioUrl||state.media.lastVideoUrl)}]};",
  "const libraryMeta=contentType==='voice-memo'?{category:'voice-memo',scope:'personal',visibility:'private',label:'음성메모 · 개인 · 비공개'}:contentType==='consultation'?{category:'minutes',scope:'work',visibility:'staff',label:'회의록(상담) · 업무 · 직원공개'}:{category:'minutes',scope:'work',visibility:'staff',label:'회의록 · 업무 · 직원공개'},payload={board_type:'library',title,body,category:libraryMeta.category,scope:libraryMeta.scope,visibility:libraryMeta.visibility,tags:[contentType,'meeting:'+state.lastMeetingId],attachments:[{kind:'meeting-result',meeting_id:state.lastMeetingId,media_available:Boolean(state.media.lastAudioUrl||state.media.lastVideoUrl)}]};",
  'library-classification'
);

replaceOnce(
  'state.resultBoardPost=saved.data||null;state.resultModal=false;render();',
  "state.resultBoardPost=saved.data||null;state.resultSaveNotice='자료실에 '+libraryMeta.label+'로 저장되었습니다.';state.resultModal=false;render();",
  'library-success-message'
);

replaceOnce(
  "const home=document.querySelector('#homeAfterResult');",
  "const library=document.querySelector('#openSavedLibrary');if(library)library.onclick=()=>{location.href='/board.html'};\n  const home=document.querySelector('#homeAfterResult');",
  'library-open-action'
);

replaceOnce("const APP_VERSION='3.5.2'","const APP_VERSION='3.5.3'",'app-version');

for(const marker of [
  'state._lastChatScrollKey','latest.getBoundingClientRect()','id="speechLatency"',
  'data-original-save','data-translation-save',"await postCaption(text,'browser')",
  'state.resultSaveNotice','libraryMeta','_preparing:true','id="openSavedLibrary"',
  "const APP_VERSION='3.5.3'"
])if(!source.includes(marker))throw new Error(`v353_contract_missing:${marker}`);

fs.writeFileSync(file,source);
console.log('VoiceFlow immediate completion tools and classified library confirmation v3.5.3 applied');
