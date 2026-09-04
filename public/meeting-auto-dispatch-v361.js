(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
let meetingId=new URL(location.href).searchParams.get('session_id')||'',resultId='',lastSignature='',drafts=[],directory=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const api=async(url,opt={})=>{const r=await nativeFetch(url,{credentials:'same-origin',headers:{'content-type':'application/json',...(opt.headers||{})},...opt}),d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||d.message||`HTTP ${r.status}`);e.data=d;throw e}return d};
const body=init=>{try{return JSON.parse(init?.body||'{}')}catch{return{}}};
window.fetch=async(input,init={})=>{
  const url=String(typeof input==='string'?input:input?.url||''),method=String(init.method||'GET').toUpperCase(),payload=body(init),response=await nativeFetch(input,init);
  if(method==='POST'&&(/\/api\/v1\/meetings(?:\?|$)/.test(url)||/\/join(?:\?|$)/.test(url)))response.clone().json().then(d=>{if(d.data?.id)meetingId=d.data.id}).catch(()=>{});
  if(method==='POST'&&/\/finalize(?:\?|$)/.test(url)){meetingId=url.match(/meetings\/([^/]+)/)?.[1]||meetingId;response.clone().json().then(d=>{resultId=d.data?.id||resultId;queueMount()}).catch(()=>{})}
  return response
};
function sourceRows(){
  const decisions=(document.querySelector('#resultDecisionsEdit')?.value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const actions=(document.querySelector('#resultActionsEdit')?.value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  return [...new Set([...decisions,...actions])]
}
async function loadDirectory(){try{directory=(await api('/api/v1/users/directory')).data||[]}catch{directory=[]}}
function labels(d){return{task:'업무',schedule:'일정',private_personal:'개인 사적',individual_company:'개인 회사',shared_company:'공동 회사'}[d]||d}
function assigneeOptions(selected=[]){const ids=new Set(selected.map(x=>String(x.id)));return directory.map(u=>`<option value="${esc(u.id)}" ${ids.has(String(u.id))?'selected':''}>${esc(u.name)}</option>`).join('')}
function render(){
  const host=document.querySelector('#vfMeetingDispatch');if(!host)return;
  host.innerHTML=`<div class="vf-dispatch-head"><div><small>AUTO DISTRIBUTION</small><h3>업무·일정 자동 배분</h3></div><span>${drafts.length}건</span></div><p>회의 내용에서 담당자·일자·업무 유형을 자동으로 찾았습니다. 주황색 항목만 보완하세요.</p><div class="vf-dispatch-list">${drafts.map((d,i)=>`<article class="${d.missing_fields?.length?'needs-input':'ready'}" data-dispatch-index="${i}"><header><b>${i+1}. ${esc(d.title)}</b><span>${labels(d.work_type)} · ${labels(d.visibility)}</span></header><p>${esc(d.description||d.source_text||'')}</p><div class="vf-dispatch-meta"><span>담당 ${esc((d.assignees||[]).map(x=>x.name).join(', ')||'확인 필요')}</span><span>${d.start_at||d.deadline?esc(d.start_at||d.deadline):d.work_type==='schedule'?'일자 확인 필요':'일자 없음'}</span></div>${d.missing_fields?.includes('assignees')?`<label>담당자 <small>복수 선택 가능</small><select data-dispatch-assignees="${i}" multiple>${assigneeOptions(d.assignees)}</select></label>`:''}${d.missing_fields?.includes('date')?`<label>일자 <input type="date" data-dispatch-date="${i}"></label>`:''}</article>`).join('')}</div><button id="saveMeetingDispatch" class="primary" type="button">확인 · 업무와 일정에 자동 저장</button><p id="vfDispatchStatus" class="small"></p>`;
  host.querySelectorAll('[data-dispatch-assignees]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.dispatchAssignees);drafts[i].assignees=[...el.selectedOptions].map(o=>{const u=directory.find(x=>String(x.id)===o.value);return{id:o.value,name:u?.name||o.textContent}});drafts[i].owner=drafts[i].assignees[0]?.name||'미지정';drafts[i].owner_id=drafts[i].assignees[0]?.id||'';drafts[i].missing_fields=(drafts[i].missing_fields||[]).filter(x=>x!=='assignees');drafts[i].ready=!drafts[i].missing_fields.length});
  host.querySelectorAll('[data-dispatch-date]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.dispatchDate);drafts[i].deadline=el.value;drafts[i].start_at=el.value;drafts[i].missing_fields=(drafts[i].missing_fields||[]).filter(x=>x!=='date');drafts[i].ready=!drafts[i].missing_fields.length});
  host.querySelector('#saveMeetingDispatch').onclick=save
}
async function interpret(){
  const rows=sourceRows(),signature=rows.join('\n');if(!rows.length||signature===lastSignature)return;lastSignature=signature;
  const host=document.querySelector('#vfMeetingDispatch');if(host)host.innerHTML='<p>회의 결정사항을 업무·일정으로 자동 분석 중입니다…</p>';
  try{await loadDirectory();const d=await api('/api/v1/tasks/interpret',{method:'POST',body:JSON.stringify({text:signature,source_meeting_id:meetingId,source_result_id:resultId})});drafts=(d.data?.drafts||[]).map((x,i)=>({...x,source_meeting_id:meetingId,source_result_id:resultId,decision_index:i}));render()}catch(e){if(host)host.innerHTML=`<p class="error">${e.message==='login_required'?'자동 배분 저장을 위해 로그인해주세요.':'자동 분석 실패 · '+esc(e.message)}</p>`}
}
async function save(){
  const status=document.querySelector('#vfDispatchStatus'),missing=drafts.map((d,i)=>({i,missing:[...(!(d.assignees||[]).length?['담당자']:[]),...(d.work_type==='schedule'&&!String(d.start_at||d.deadline||'').trim()?['일자']:[])]})).filter(x=>x.missing.length);
  if(missing.length){status.textContent='주황색 항목의 '+[...new Set(missing.flatMap(x=>x.missing))].join('·')+'를 입력해주세요.';return}
  try{status.textContent='업무와 일정에 배분 저장 중…';const d=await api('/api/v1/tasks/batch',{method:'POST',body:JSON.stringify({confirmed:true,tasks:drafts})});status.textContent=`✓ ${d.data?.length||drafts.length}건을 담당자별 업무·일정에 저장했습니다.`;document.querySelector('#saveMeetingDispatch').disabled=true}catch(e){status.textContent='저장 실패 · '+e.message}
}
function mount(){
  const modal=document.querySelector('#vfResultModal .vf-result-modal-card'),editor=document.querySelector('.vf-result-editor');const target=modal||editor;if(!target)return;
  if(!document.querySelector('#vfMeetingDispatch')){const box=document.createElement('section');box.id='vfMeetingDispatch';box.className='vf-meeting-dispatch';const footer=modal?.querySelector('footer');footer?footer.before(box):target.append(box)}
  interpret()
}
let queued=false;function queueMount(){if(queued)return;queued=true;setTimeout(()=>{queued=false;mount()},80)}
new MutationObserver(queueMount).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('input',e=>{if(e.target?.matches?.('#resultDecisionsEdit,#resultActionsEdit')){lastSignature='';clearTimeout(window.__vfDispatchInputTimer);window.__vfDispatchInputTimer=setTimeout(interpret,500)}});
async function validMeeting(id){if(!id||id==='null'||id==='undefined')throw new Error('회의방이 아직 준비되지 않았습니다. 잠시 후 다시 초대해주세요.');const d=await api('/api/v1/meetings/'+encodeURIComponent(id));if(d.data?.status!=='live')throw new Error('종료되었거나 사용할 수 없는 초대 링크입니다. 새 회의에서 다시 초대해주세요.');return d.data}
document.addEventListener('click',async e=>{
  const join=e.target?.closest?.('#quickJoin');if(join&&!join.dataset.preflightOk){e.preventDefault();e.stopImmediatePropagation();const note=join.parentElement?.querySelector('.vf-invite-error')||document.createElement('p');note.className='vf-invite-error';if(!note.isConnected)join.before(note);note.textContent='초대 링크 확인 중…';try{await validMeeting(meetingId);join.dataset.preflightOk='1';note.textContent='회의방 확인 완료';join.click()}catch(err){note.textContent='입장 불가 · '+err.message}return}
  const invite=e.target?.closest?.('#invite,#inviteInline');if(!invite)return;e.preventDefault();e.stopImmediatePropagation();try{await validMeeting(meetingId);const url=location.origin+'/?session_id='+encodeURIComponent(meetingId),share={title:'VoiceFlow 회의 초대',text:'VoiceFlow 회의에 초대합니다.',url};if(navigator.share)await navigator.share(share);else{await navigator.clipboard.writeText(url);alert('유효한 초대 링크를 복사했습니다.')}}catch(err){alert(err.message)}
},true);
queueMount();
})();