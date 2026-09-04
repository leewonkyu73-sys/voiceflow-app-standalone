import fs from 'node:fs/promises';

const file=new URL('../public/app.js',import.meta.url);
let s=await fs.readFile(file,'utf8');
const must=(re,repl,label)=>{if(!re.test(s))throw new Error('patch_missing:'+label);s=s.replace(re,repl)};

must(/function work\(\)\{[\s\S]*?\}\nfunction meetingStart/,
`function taskDraftRow(x,i){const people=(x.assignees||[]).map(p=>p.name).join(', ')||x.owner||'담당자 확인';const when=x.start_at||([x.deadline,x.time].filter(Boolean).join(' '))||'일시 확인';const repeat=x.recurrence&&x.recurrence!=='none'?x.recurrence:'반복 안 함';return \`<article class="ai-task-step" data-draft="\${i}"><span class="ai-task-number">\${i+1}</span><div class="ai-task-body"><div class="ai-task-title"><input data-draft-field="title" value="\${esc(x.title||'새 업무')}" aria-label="업무 제목"><button type="button" data-draft-toggle="\${i}" aria-label="상세 열기">⌄</button></div><div class="ai-task-field"><span>담당자</span><input data-draft-field="owner" value="\${esc(people)}"></div><div class="ai-task-field \${x.deadline?'':'needs-review'}"><span>일시</span><input data-draft-field="start_at" value="\${esc(when)}"></div><div class="ai-task-field"><span>반복</span><input data-draft-field="recurrence" value="\${esc(repeat)}"></div><div class="ai-task-field"><span>통보</span><label class="notify-check"><input type="checkbox" data-draft-field="notify_assignees" \${x.notify_assignees?'checked':''}> \${x.notify_assignees?'담당자에게 통보':'통보 안 함'}</label></div>\${x.deadline?'':\`<div class="ai-task-question">날짜를 정확히 확인해 주세요.<button type="button" data-focus-date="\${i}">날짜 입력</button></div>\`}</div></article>\`}
function work(){const drafts=state.taskDrafts||[];return shell(\`<section class="ai-task-header"><div><small>AI WORK</small><h1>AI 업무 등록</h1></div><button type="button" id="taskHelp" aria-label="도움말">?</button></section><section class="ai-task-command"><textarea id="taskText" placeholder="예: 김대리에게 내일 오후 3시 재고회의 등록하고 매주 월요일 반복해. 등록되면 알려줘.">\${esc(state.taskSourceText||'')}</textarea><div class="ai-task-command-actions"><button type="button" id="taskVoice" class="task-voice">음성 입력</button><button type="button" id="taskInterpret" class="primary">내용 정리</button></div></section><p class="ai-task-hint">한 번에 여러 업무를 말해도 됩니다.</p>\${drafts.length?\`<section class="ai-task-review"><div class="ai-task-review-head"><h2>등록 전 확인</h2><span>\${drafts.length}개 업무</span></div><div class="ai-task-timeline">\${drafts.map(taskDraftRow).join('')}</div><div class="ai-task-summary"><b>\${drafts.length}개 업무</b><span>·</span><b>담당자 \${new Set(drafts.flatMap(x=>(x.assignees||[]).map(p=>p.id||p.name)).filter(Boolean)).size||drafts.filter(x=>x.owner&&x.owner!=='미지정').length}명</b><span>·</span><b>알림 \${drafts.filter(x=>x.notify_assignees).length}건</b></div><button type="button" id="taskBatchSave" class="primary ai-task-save">모두 확인하고 등록</button><button type="button" id="taskReset" class="text-action">음성 다시 입력</button></section>\`:\`<section class="panel"><div class="panel-title"><h2>업무 목록</h2><span>\${state.tasks.length}</span></div>\${state.tasks.length?state.tasks.map(x=>\`<article class="task \${x.status==='done'?'done':''}"><button data-task="\${x.id}">\${x.status==='done'?'✓':'○'}</button><div><b>\${esc(x.title)}</b><small>\${esc(x.owner||'미지정')} · \${esc(x.deadline||'기한 없음')}</small></div></article>\`).join(''):'<p class="empty">등록된 업무가 없습니다.</p>'}</section>\`}\`)}
function meetingStart`,
'task-screen');

must(/async function loadTasks\(\)/,
`function startTaskVoice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;const out=$('#taskText'),btn=$('#taskVoice');if(!SR){alert('이 브라우저에서는 음성 입력을 지원하지 않습니다. 텍스트로 입력해 주세요.');return}const r=new SR();r.lang=localStorage.uiLanguage==='vi'?'vi-VN':localStorage.uiLanguage==='en'?'en-US':'ko-KR';r.continuous=false;r.interimResults=true;let final='';r.onstart=()=>{if(btn){btn.textContent='듣고 있어요…';btn.classList.add('listening')}};r.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)final+=(final?' ':'')+t;else interim+=t}if(out)out.value=(state.taskSourceText||'')+(state.taskSourceText?' ':'')+final+(interim?' '+interim:'')};r.onerror=e=>alert('음성 입력을 확인해 주세요: '+(e.error||'오류'));r.onend=()=>{if(out){state.taskSourceText=out.value.trim()}if(btn){btn.textContent='음성 입력';btn.classList.remove('listening')}};r.start()}
async function interpretTaskText(){const el=$('#taskText'),text=el?.value.trim();if(!text)return;state.taskSourceText=text;const b=$('#taskInterpret');if(b){b.disabled=true;b.textContent='정리 중…'}try{const r=await api('/api/v1/tasks/interpret',{method:'POST',body:JSON.stringify({text})});state.taskDrafts=r.data?.drafts||[];render()}catch(e){alert('업무 내용을 정리하지 못했습니다: '+e.message);if(b){b.disabled=false;b.textContent='내용 정리'}}}
function updateTaskDraftInput(el){const row=el.closest('[data-draft]'),i=Number(row?.dataset.draft),draft=state.taskDrafts?.[i];if(!draft)return;const field=el.dataset.draftField;if(field==='notify_assignees')draft[field]=el.checked;else if(field==='owner'){draft.owner=el.value;draft.assignees=el.value.split(',').map(name=>({name:name.trim(),id:''})).filter(x=>x.name)}else draft[field]=el.value}
async function saveTaskBatch(){const tasks=state.taskDrafts||[];if(!tasks.length)return;if(tasks.some(x=>!String(x.title||'').trim()))return alert('업무 제목을 확인해 주세요.');const b=$('#taskBatchSave');if(b){b.disabled=true;b.textContent='등록 중…'}try{const r=await api('/api/v1/tasks/batch',{method:'POST',body:JSON.stringify({confirmed:true,tasks})});state.taskDrafts=[];state.taskSourceText='';await loadTasks();alert((r.data?.length||tasks.length)+'개 업무가 등록되었습니다.');render()}catch(e){alert('업무 등록 실패: '+e.message);if(b){b.disabled=false;b.textContent='모두 확인하고 등록'}}}
function resetTaskIntake(){state.taskDrafts=[];state.taskSourceText='';render()}
async function loadTasks()`,
'task-runtime');

must(/  \$\('#taskAdd'\)\?\.addEventListener\('click',addTask\);/,
`  $('#taskAdd')?.addEventListener('click',addTask);
  $('#taskVoice')?.addEventListener('click',startTaskVoice);
  $('#taskInterpret')?.addEventListener('click',interpretTaskText);
  $('#taskBatchSave')?.addEventListener('click',saveTaskBatch);
  $('#taskReset')?.addEventListener('click',resetTaskIntake);
  $('#taskHelp')?.addEventListener('click',()=>alert('업무, 담당자, 날짜, 시간, 기간, 반복주기와 통보 대상을 한 문장으로 말할 수 있습니다.'));
  document.querySelectorAll('[data-draft-field]').forEach(el=>el.addEventListener('change',()=>updateTaskDraftInput(el)));
  document.querySelectorAll('[data-focus-date]').forEach(el=>el.addEventListener('click',()=>el.closest('[data-draft]')?.querySelector('[data-draft-field="start_at"]')?.focus()));`,
'task-bind');

await fs.writeFile(file,s,'utf8');
new Function(s);
console.log('VoiceFlow AI task intake v3.0.1 applied');
