import './patch-app-v25.mjs';
import fs from 'node:fs/promises';

const file=new URL('../public/app.js',import.meta.url);
let s=await fs.readFile(file,'utf8');
const must=(re,repl,label)=>{if(!re.test(s))throw new Error(`patch_missing:${label}`);s=s.replace(re,repl)};

must(/admin:\{settings:null,diag:null,users:\[\]\},joinId:/,
"admin:{settings:null,diag:null,users:[]},meetingResult:null,lastMeetingId:null,joinId:",'meeting-result-state');

must(/function nav\(\)\{.*?\}\nfunction shell/s,
`function nav(){const items=[['home','⌂','회의 홈'],['meeting','●','회의'],['__calendar','▣','일정'],['work','✓','업무'],['__board','□','자료']];if(state.user?.role==='admin')items.push(['admin','⚙','더보기']);else items.push(['account','⋯','더보기']);return \`<nav class="bottom-nav cols-\${items.length}">\${items.map(([v,i,l])=>v.startsWith('__')?\`<button data-href="\${v==='__calendar'?'/work-calendar.html':'/board.html'}"><b>\${i}</b><span>\${l}</span></button>\`:\`<button data-nav="\${v}" class="\${state.view===v?'active':''}"><b>\${i}</b><span>\${l}</span></button>\`).join('')}</nav>\`}
function shell`,'meeting-first-nav');

must(/function home\(\)\{.*?\}\nfunction work/s,
`function home(){return shell(\`\${ongoing()}<section class="hero premium-hero"><div class="eyebrow">STAR45 AI MEETING WORKSPACE</div><h1>무엇을 시작할까요?</h1><p>말하면 회의가 정리되고, 결정하면 업무가 실행됩니다.</p></section><section class="cards premium-cards meeting-home"><button class="card work-card" data-nav="meeting"><span class="card-kicker">FAST</span><div class="glyph">●</div><h2>빠른 회의 시작</h2><p>음성 중심 · 장치점검 후 입장</p><small>입장 후 녹음은 자동 시작하지 않습니다.</small></button><button class="card" data-nav="client"><div class="glyph">◇</div><h2>고객 · 협력사 회의</h2><p>실시간 번역 · Translation Assurance</p><small>화상은 동의 후 선택</small></button><button class="card" data-href="/ai-meeting-lab.html"><div class="glyph">AI</div><h2>AI 직원 회의</h2><p>전략 · 운영 · 검증 AI 참여</p><small>의견 · 반론 · 업무 제안</small></button><button class="card" data-href="/work-calendar.html"><div class="glyph">▣</div><h2>오늘 일정</h2><p>회의와 후속업무를 확인합니다.</p><small>현재 업무 \${state.tasks.length}건</small></button></section><section class="panel"><div class="panel-title"><div><small>MEETING FLOW</small><h2>회의가 끝나면 자동으로</h2></div></div><div class="module-grid"><div class="module-item"><div><b>1. AI 회의결과</b><small>요약 · 결정 · 리스크 · Action Item</small></div></div><div class="module-item"><div><b>2. 사람 검토/승인</b><small>승인 전에는 공식 데이터로 확정하지 않음</small></div></div><div class="module-item"><div><b>3. Google Drive 저장</b><small>승인된 회의결과의 공식 원본</small></div></div><div class="module-item"><div><b>4. 후속 모듈</b><small>업무 · 일정 · ERP · Hermes · Discord</small></div></div></div></section>\`)}
function work`,'meeting-first-home');

must(/function joinPage\(\)/,
`function resultReview(){const r=state.meetingResult||{},mid=state.lastMeetingId,actions=r.actions||[],decisions=r.decisions||[],risks=r.risks||[],storage=r._storage||null;return shell(\`<section class="page-head"><div><small>MEETING RESULT REVIEW</small><h1>회의결과 검토</h1></div><span class="health-score">\${storage?'✓':'검토'}<small>\${storage?'Drive 저장됨':'승인 전'}</small></span></section><section class="panel elevated"><div class="panel-title"><div><small>SUMMARY</small><h2>회의 요약</h2></div></div><p>\${esc(r.summary||'요약 내용이 없습니다.')}</p></section><section class="admin-grid"><section class="panel"><h2>결정사항</h2>\${decisions.length?decisions.map(x=>\`<article class="diag"><p>\${esc(typeof x==='string'?x:JSON.stringify(x))}</p></article>\`).join(''):'<p class="empty">결정사항 없음</p>'}</section><section class="panel"><h2>리스크 · 확인사항</h2>\${risks.length?risks.map(x=>\`<article class="diag"><p>\${esc(typeof x==='string'?x:JSON.stringify(x))}</p></article>\`).join(''):'<p class="empty">리스크 없음</p>'}</section></section><section class="panel"><div class="panel-title"><h2>Action Items</h2><span>\${actions.length}</span></div>\${actions.length?actions.map((a,i)=>\`<article class="task"><div><b>\${i+1}. \${esc(typeof a==='string'?a:(a.text||''))}</b><small>담당 \${esc(a.owner||'미지정')} · 기한 \${esc(a.deadline||'미정')}</small></div></article>\`).join(''):'<p class="empty">추출된 업무 없음</p>'}</section><section class="panel elevated"><h2>공식 저장</h2><p>승인된 회의결과만 Google Drive에 공식 원본으로 저장됩니다. ERP/DB에는 Drive 파일 ID와 URL만 참조합니다.</p>\${storage?\`<div class="actions"><button id="openDrive" class="primary">Google Drive에서 열기</button><button data-nav="home">완료</button></div>\`:\`<div class="actions"><button id="approveResult" class="primary">✓ 승인 · Drive 저장</button><button id="rejectResult" class="danger">수정 필요 / 거절</button><button data-nav="home">나중에 검토</button></div>\`}<p class="small">Meeting ID: \${esc(mid||'')}</p></section>\`)}
function joinPage()`,'result-review-ui');

must(/async function endMeeting\(\)\{.*?\}\nfunction bind/s,
`async function endMeeting(){if(!state.meeting)return;const mid=state.meeting.id;try{stopRecording();clearInterval(state.poll);clearInterval(state.signalPoll);try{state.media.stream?.getTracks().forEach(x=>x.stop());state.video._cameraStream?.getTracks().forEach(x=>x.stop());window.VoiceFlowAudioMonitor?.stop?.()}catch{}const fin=await api(\`/api/v1/meetings/\${mid}/finalize\`,{method:'POST',body:'{}'});state.meetingResult=fin.data||{};state.lastMeetingId=mid;state.meeting=null;state.view='result-review';render()}catch(err){alert(\`회의 종료 실패: \${err.message}\`)}}
function bind`,'result-review-end-flow');

must(/function bind\(\)\{\n/,
`function bind(){\n  $$('[data-href]').forEach(b=>b.onclick=()=>{location.href=b.dataset.href});\n`,'href-bind');

must(/  \$\('#endMeeting'\)\?\.addEventListener\('click',endMeeting\);/,
`  $('#endMeeting')?.addEventListener('click',endMeeting);
  $('#approveResult')?.addEventListener('click',async()=>{if(!state.lastMeetingId)return;try{const d=await api(\`/api/v1/meeting-results/\${state.lastMeetingId}/approve\`,{method:'POST',body:'{}'});state.meetingResult={...(state.meetingResult||{}),_storage:d.data?.drive||null};render()}catch(e){alert(e.message==='google_drive_not_configured'?'Google Drive 연결 설정이 필요합니다. 관리자에서 Drive Connector를 연결해주세요.':'회의결과 저장 실패: '+e.message)}});
  $('#rejectResult')?.addEventListener('click',async()=>{if(!state.lastMeetingId)return;try{await api(\`/api/v1/meeting-results/\${state.lastMeetingId}/reject\`,{method:'POST',body:'{}'});state.view='home';render()}catch(e){alert('처리 실패: '+e.message)}});
  $('#openDrive')?.addEventListener('click',()=>{const u=state.meetingResult?._storage?.drive_url;if(u)window.open(u,'_blank','noopener')});`,'result-review-bind');

must(/else if\(state\.view==='join'\)html=joinPage\(\);else html=home\(\);/,
"else if(state.view==='join')html=joinPage();else if(state.view==='result-review')html=resultReview();else html=home();",'result-review-render');

await fs.writeFile(file,s,'utf8');
console.log('VoiceFlow app.js patched for v2.6 meeting-first UX and Drive approval');
