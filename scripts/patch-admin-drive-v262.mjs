import './patch-simple-session-v263.mjs';
import fs from 'node:fs/promises';

const file=new URL('../public/app.js',import.meta.url);
let s=await fs.readFile(file,'utf8');
const must=(re,repl,label)=>{if(!re.test(s))throw new Error(`patch_missing:${label}`);s=s.replace(re,repl)};

must(/return shell\(`<section class="page-head"><div><small>SYSTEM CONTROL<\/small><h1>관리자 Control Center<\/h1><\/div><span class="health-score">\$\{d\.overall\|\|'-'\}<small>\/100<\/small><\/span><\/section><section class="admin-grid">/,
`return shell(\`<section class="page-head"><div><small>SYSTEM CONTROL</small><h1>관리자 Control Center</h1></div><span class="health-score">\${d.overall||'-'}<small>/100</small></span></section><section class="panel elevated"><div class="panel-title"><div><small>API & INTEGRATION</small><h2>통합 API · 연동 관리</h2></div><span class="status ok">ADMIN</span></div><p>OpenAI · Gemini · Claude · DeepL · Google · Microsoft 365 · Discord · Hermes · Obsidian · Total ERP를 한 곳에서 설정·저장·테스트합니다.</p><div class="actions"><button id="openIntegrationCenter" class="primary">API & Integration Center 열기</button><button id="refreshIntegrationSummary">전체 연결상태 확인</button></div><p id="integrationSummary" class="small">연결 상태 확인 전</p></section><section class="panel elevated" id="driveAdminCard"><div class="panel-title"><div><small>OFFICIAL MEETING STORAGE</small><h2>Google Drive 공식저장</h2></div><span id="driveAdminBadge" class="status">확인 중</span></div><div class="module-grid"><div class="module-item"><div><b>연결 상태</b><small id="driveAdminStatus">Google Drive 상태 확인 중</small></div></div><div class="module-item"><div><b>연결 계정</b><small id="driveAdminAccount">-</small></div></div><div class="module-item"><div><b>루트 폴더</b><small id="driveAdminFolder">STAR45 Meeting</small></div></div><div class="module-item"><div><b>저장 정책</b><small>승인된 회의결과만 공식 저장</small></div></div></div><div class="actions" style="margin-top:14px"><button id="openDriveSettings" class="primary compact">Google Drive 연결 / 설정</button><button id="testDriveStorage">연결 테스트</button><button id="refreshDriveStatus">상태 새로고침</button></div><p id="driveAdminMessage" class="small">회의 결과 원본은 Google Drive에 저장하고 DB에는 파일 ID와 URL만 기록합니다.</p></section><section class="admin-grid">`,'admin-integration-drive-cards');

must(/async function loadAdmin\(\)\{.*?\}\nasync function addTask/s,
`async function loadAdmin(){if(state.user?.role!=='admin')return;try{state.admin.settings=(await api('/api/v1/admin/settings')).data;state.admin.diag=(await api('/api/v1/admin/diagnostics')).data;state.admin.users=(await api('/api/v1/admin/users')).data||[]}catch{}}\nasync function loadIntegrationSummary(){if(state.user?.role!=='admin')return;const el=$('#integrationSummary');if(!el)return;try{const d=(await api('/api/v1/admin/integrations')).data||{};const all=Object.values(d),ok=all.filter(x=>x.configured).length;el.textContent=\`설정됨 \${ok}/\${all.length} · AI/API/Connector 상세설정은 Integration Center에서 관리\`}catch(e){el.textContent='연결상태 확인 실패: '+e.message}}\nasync function loadDriveAdminCard(){if(state.user?.role!=='admin')return;const statusEl=$('#driveAdminStatus'),accountEl=$('#driveAdminAccount'),folderEl=$('#driveAdminFolder'),badge=$('#driveAdminBadge'),msg=$('#driveAdminMessage');if(!statusEl)return;try{const d=(await api('/api/v1/meeting-results/storage/status')).data||{};statusEl.textContent=d.connected?'연결됨':'연결 필요';accountEl.textContent=d.account_email||'-';folderEl.textContent=d.root_folder_name||d.root_folder_id||'STAR45 Meeting';badge.textContent=d.connected?'● 연결됨':'○ 설정 필요';badge.className='status '+(d.connected?'ok':'warn');if(msg)msg.textContent=d.connected?'Google Drive 공식 저장소가 정상 연결되어 있습니다.':'Google Drive 연결 후 승인된 회의결과가 자동 저장됩니다.'}catch(e){statusEl.textContent='상태 확인 실패';badge.textContent='확인 실패';badge.className='status warn';if(msg)msg.textContent=e.message}}\nasync function addTask`,'admin-integration-loaders');

must(/  \$\('#refreshDiag'\)\?\.addEventListener\('click',async\(\)=>\{await loadAdmin\(\);render\(\)\}\);/,
`  $('#refreshDiag')?.addEventListener('click',async()=>{await loadAdmin();render()});\n  $('#openIntegrationCenter')?.addEventListener('click',()=>{location.href='/admin-integrations.html'});\n  $('#refreshIntegrationSummary')?.addEventListener('click',loadIntegrationSummary);\n  $('#openDriveSettings')?.addEventListener('click',()=>{location.href='/drive-connect.html'});\n  $('#refreshDriveStatus')?.addEventListener('click',loadDriveAdminCard);\n  $('#testDriveStorage')?.addEventListener('click',async()=>{const msg=$('#driveAdminMessage');try{if(msg)msg.textContent='Google Drive 테스트 파일 저장 중...';const d=await api('/api/v1/meeting-results/storage/test',{method:'POST',body:'{}'});if(msg)msg.textContent='연결 테스트 성공: '+(d.data?.file_name||'테스트 파일 저장 완료');await loadDriveAdminCard()}catch(e){if(msg)msg.textContent='연결 테스트 실패: '+e.message}});`,'admin-integration-bind');

must(/function render\(\)\{if\(!state\.lang\).*?\$\('#app'\)\.innerHTML=html;bind\(\)\}/s,
(match)=>match.replace("$('#app').innerHTML=html;bind()","$('#app').innerHTML=html;bind();if(state.view==='admin'){loadIntegrationSummary();loadDriveAdminCard()}"),'admin-integration-render-load');

await fs.writeFile(file,s,'utf8');
await import('./patch-runtime-guards-v262.mjs');
await import('./patch-voiceflow-ui-v300.mjs');
await import('./patch-voiceflow-planned-v314.mjs');
await import('./patch-in-room-result-v347.mjs');
await import('./patch-chat-scroll-v348.mjs');
await import('./patch-mobile-browser-first-v349.mjs');
await import('./patch-mobile-speech-result-ui-v351.mjs');
await import('./patch-chat-top-latency-v352.mjs');
await import('./patch-result-ready-library-v353.mjs');
await import('./patch-mobile-room-layout-v354.mjs');
await import('./patch-mobile-stt-latency-v355.mjs');
await import('./patch-mobile-live-interim-v357.mjs');
await import('./patch-immediate-original-v358.mjs');
await import('./patch-stt-usage-v364.mjs');
await import('./patch-mobile-stt-ownership-v366.mjs');
await import('./patch-mobile-chrome-only-v367.mjs');
await import('./patch-mobile-chrome-finalize-v368.mjs');
await import('./patch-speech-signal-v369.mjs');
await import('./patch-mobile-server-primary-v371.mjs');
await import('./patch-mobile-stt-traffic-guard-v372.mjs');
console.log('VoiceFlow admin patched with simple capture UX + unified Integration Center + planned voice-first UI v3.1.4');
