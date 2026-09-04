import fs from 'node:fs';
const file=new URL('../public/app.js',import.meta.url);
let s=fs.readFileSync(file,'utf8');
const must=(from,to,label)=>{if(!s.includes(from))throw new Error('in_room_result_anchor_missing:'+label);s=s.replace(from,to)};
function completedBarV347(){
  if(!state.lastMeetingId)return '';
  const url=state.media.lastVideoUrl||state.media.lastAudioUrl||'';
  return `<section class="vf-completed-tools" aria-label="저장 완료 도구"><b>✓ 저장 완료</b><button id="replayResult" type="button" ${url?'':'disabled'}>▶ 다시 듣기</button><button id="openResultSummary" class="primary" type="button">✨ 음성·텍스트 정리</button><button id="homeAfterResult" type="button">홈</button>${url?`<${state.media.lastVideoUrl?'video':'audio'} id="resultReplayMedia" src="${url}" preload="metadata" playsinline hidden></${state.media.lastVideoUrl?'video':'audio'}>`:''}</section>`;
}
function resultModalV347(){
  const r=state.meetingResult||{},lang=state.resultLanguage||localStorage.targetLanguage||'ko-KR',localized=r.localized_results?.[lang]||r;
  const rows=v=>(Array.isArray(v)?v:[]).map(x=>typeof x==='string'?x:(x?.text||'')).filter(Boolean).join('\n');
  const started=new Date(r.started_at||state.media.startedAt||r.created_at||Date.now()),ended=new Date(r.ended_at||Date.now());
  const mode=state.resultContentType||((r.participants||[]).length>1?'minutes':'voice-memo');
  const summary=String(localized.summary||'').trim()||'정리할 내용 없음';
  return `<section id="vfResultModal" class="vf-result-modal" role="dialog" aria-modal="true" aria-labelledby="vfResultModalTitle"><div class="vf-result-modal-card"><header><div><small>AI CONTENT REVIEW</small><h2 id="vfResultModalTitle">음성·텍스트 내용 정리</h2></div><button id="closeResultModal" type="button" aria-label="닫기">×</button></header><div class="vf-result-meta"><span><b>일자·시작</b>${started.toLocaleString('ko-KR')}</span><span><b>종료</b>${ended.toLocaleString('ko-KR')}</span><span><b>진행시간</b>${fmt(Number(r.duration_seconds)||state.media.elapsed||0)}</span></div><label>자료 유형<select id="resultContentType"><option value="voice-memo">메모</option><option value="minutes">회의</option><option value="consultation">상담</option></select></label><label>제목<input id="resultLibraryTitle" value="${esc((state.meeting?.title||'음성 기록')+' · '+started.toLocaleDateString('ko-KR'))}"></label><label>상세 내용<textarea id="resultSummaryEdit" rows="7">${esc(summary)}</textarea></label><div class="vf-result-list-grid"><label>결정사항<textarea id="resultDecisionsEdit" rows="4" placeholder="내용이 없으면 비워두세요">${esc(rows(localized.decisions))}</textarea></label><label>확인사항<textarea id="resultRisksEdit" rows="4" placeholder="내용이 없으면 비워두세요">${esc(rows(localized.risks))}</textarea></label></div><label>실행사항<textarea id="resultActionsEdit" rows="4" placeholder="내용이 없으면 비워두세요">${esc(rows(localized.actions))}</textarea></label><p id="resultLibraryMessage" class="small">실제 대화 내용을 바탕으로 자동 정리했습니다. 수정 후 자료실에 저장하세요.</p><footer><button id="closeResultModal2" type="button">취소</button><button id="saveResultLibrary" class="primary" type="button">확인 · 자료실 저장</button></footer></div></section>`;
}
function bindResultRoomV347(){
  const replay=document.querySelector('#replayResult');
  if(replay)replay.onclick=async()=>{const media=document.querySelector('#resultReplayMedia');if(!media)return;try{if(media.paused){await media.play();replay.textContent='Ⅱ 듣기 정지'}else{media.pause();replay.textContent='▶ 다시 듣기'}}catch{alert('이 기기에서 원본 재생 파일을 열 수 없습니다.')}};
  const open=document.querySelector('#openResultSummary');
  if(open)open.onclick=()=>{state.resultModal=true;render()};
  const close=()=>{state.resultModal=false;render()};
  const c1=document.querySelector('#closeResultModal'),c2=document.querySelector('#closeResultModal2');
  if(c1)c1.onclick=close;if(c2)c2.onclick=close;
  const type=document.querySelector('#resultContentType');
  if(type){type.value=state.resultContentType||((state.meetingResult?.participants||[]).length>1?'minutes':'voice-memo');type.onchange=()=>{state.resultContentType=type.value}};
  const home=document.querySelector('#homeAfterResult');
  if(home)home.onclick=()=>{state.meeting=null;state.view='home';state.resultModal=false;render()};
  const save=document.querySelector('#saveResultLibrary');
  if(save)save.onclick=async()=>{
    if(!state.user){alert('자료실 저장을 위해 로그인해주세요.');return}
    save.disabled=true;const msg=document.querySelector('#resultLibraryMessage');
    const rows=id=>(document.querySelector('#'+id)?.value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const summary=(document.querySelector('#resultSummaryEdit')?.value||'').trim()||'정리할 내용 없음';
    const decisions=rows('resultDecisionsEdit'),risks=rows('resultRisksEdit'),actionRows=rows('resultActionsEdit');
    const contentType=document.querySelector('#resultContentType')?.value||'voice-memo';
    const title=(document.querySelector('#resultLibraryTitle')?.value||'음성 기록').trim();
    const started=new Date(state.meetingResult?.started_at||state.media.startedAt||Date.now());
    const body=['일자·시간: '+started.toLocaleString('ko-KR'),'유형: '+(contentType==='voice-memo'?'메모':contentType==='consultation'?'상담':'회의'),'','상세 내용',summary,'','결정사항',...(decisions.length?decisions.map(x=>'• '+x):['없음']),'','확인사항',...(risks.length?risks.map(x=>'• '+x):['없음']),'','실행사항',...(actionRows.length?actionRows.map(x=>'• '+x):['없음'])].join('\n');
    try{
      if(msg)msg.textContent='정리 내용을 저장 중입니다…';
      const draft=await api('/api/v1/meeting-results/'+encodeURIComponent(state.lastMeetingId)+'/draft',{method:'PATCH',body:JSON.stringify({language:state.resultLanguage||localStorage.targetLanguage||'ko-KR',summary,decisions,risks,actions:actionRows.map(text=>({text}))})});
      state.meetingResult={...(state.meetingResult||{}),...(draft.data?.result||{})};
      const payload={board_type:'library',title,body,category:contentType==='voice-memo'?'voice-memo':'minutes',scope:contentType==='voice-memo'?'personal':'work',visibility:contentType==='voice-memo'?'private':'staff',tags:[contentType,'meeting:'+state.lastMeetingId],attachments:[{kind:'meeting-result',meeting_id:state.lastMeetingId,media_available:Boolean(state.media.lastAudioUrl||state.media.lastVideoUrl)}]};
      const saved=await api('/api/v1/board/posts',{method:'POST',body:JSON.stringify(payload)});
      state.resultBoardPost=saved.data||null;state.resultModal=false;render();
    }catch(e){if(msg)msg.textContent='저장 실패: '+e.message;save.disabled=false}
  };
}
must('function room(){',completedBarV347.toString()+'\n'+resultModalV347.toString()+'\nfunction room(){','helpers');
let lines=s.split('\n');
const roomIndex=lines.findIndex(x=>x.startsWith('function room(){'));if(roomIndex<0)throw new Error('in_room_result_anchor_missing:room');
lines[roomIndex]=lines[roomIndex].replace('return shell(`<section class="vf-chat-toolbar"','return shell(`${completedBarV347()}<section class="vf-chat-toolbar"').replace('</section>`)}','</section>${state.resultModal?resultModalV347():\'\'}`)}');
s=lines.join('\n');
must('state.meeting=null;state.view=\'result-review\';render()','state.meeting={...state.meeting,status:\'ended\'};state.resultModal=true;render()','finish-in-room');
must('function bind(){','function bind(){setTimeout(bindResultRoomV347,0);','bind');
s=s.replace('function bind(){setTimeout(bindResultRoomV347,0);',bindResultRoomV347.toString()+'\nfunction bind(){setTimeout(bindResultRoomV347,0);');
if(!s.includes('saveResultLibrary')||!s.includes("board_type:'library'")||!s.includes('completedBarV347()'))throw new Error('in_room_result_contract_missing');
fs.writeFileSync(file,s);
console.log('VoiceFlow in-room replay and library result v3.4.7 applied');
