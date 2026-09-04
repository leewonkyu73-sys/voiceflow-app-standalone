import fs from 'node:fs';

const APP_VERSION='3.4.5';

const file=new URL('../public/app.js',import.meta.url);
const lines=fs.readFileSync(file,'utf8').split('\n');

function nav(){const items=[['home','⌂','홈','nav'],['__calendar','▣','일정','href'],['work','✓','업무','nav'],['__board','□','자료','href'],[state.user?.role==='admin'?'admin':'account','•••','더보기','nav']];return `<nav class="bottom-nav cols-5 vf-global-nav" aria-label="전체 메뉴">${items.map(([v,i,l,k])=>`<button ${k==='href'?`data-href="${v==='__calendar'?'/work-calendar.html':'/board.html'}"`:`data-nav="${v}"`} class="${state.view===v?'active':''}"><b aria-hidden="true">${i}</b><span>${l}</span></button>`).join('')}</nav>`}

function shell(body,{compact=false}={}){const m=state.meeting,people=m?.participants||[];const title=state.view==='room'?(people.length>1?`공동 대화방 · ${people.length}명`:'음성메모 · 기본 대화방'):state.view==='work'?'업무':state.view==='account'?(state.user?'설정':'로그인 · 회원가입'):'홈 · 음성메모';return `<div class="shell ${compact?'compact-shell':''}"><header class="vf-plan-header"><strong>${title}</strong><label class="vf-global-language"><span>언어</span><select id="globalUiLanguage" aria-label="앱 언어"><option value="ko">한국어</option><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="zh">中文</option></select></label><button data-nav="account" class="vf-account-button">${state.user?`${esc(state.user.name)} · 계정`:'알림 · 계정'}</button></header><main>${body}</main>${(state.view==='account'||state.view==='admin')?`<div class="vf-app-version">앱 버전 v${APP_VERSION}</div>`:''}${nav()}</div>`}

function home(){return shell(`${ongoing()}<section class="vf-home"><div class="vf-home-mic" aria-hidden="true">🎙</div><h1>음성메모를 시작하세요</h1><p>개인 기록에서 시작해 초대·화상·정리·저장·공유까지 같은 방에서 이어집니다.</p><button id="quickAudioStart" class="vf-start-button">음성 시작</button></section><section class="vf-voice-command"><b>음성으로 바로 실행</b><span>“김팀장 초대해줘” · “카메라 켜줘” · “내일 일정 등록” · “이 내용을 업무로 만들어줘”</span></section>`)}

function room(){const m=state.meeting;if(!m)return home();const capture=state.media.videoRecording?'녹화 중':state.media.recording?'녹음 중':'준비';const people=m.participants||[];const videoOn=Boolean(people.length>1||m.meeting_mode==='video'||state.video.enabledByOption||state.video.incoming||state.video._cameraStream||state.video.status&&state.video.status!=='off');const sourceLanguage=localStorage.sourceLanguage==='en-US'?'English':localStorage.sourceLanguage==='vi-VN'?'Tiếng Việt':localStorage.sourceLanguage==='zh-CN'?'中文':'한국어';const speechStatus=state.media.paused?'일시정지':state.media.stt==='unsupported'?'음성인식 미지원':state.media.stt==='denied'?'권한 확인':state.media.sttFallback==='error'?'서버 확인':state.media.sttFallback==='uploading'?'변환 중':state.media.stt==='server'?'인식 중':state.media.stt==='error'?'연결 확인':state.media.recording?'듣는 중':'대기';return shell(`<section class="vf-chat-toolbar" aria-label="채팅 녹음 상태"><span class="vf-toolbar-language vf-source-language"><small>시작</small><b>${sourceLanguage}</b></span><label class="vf-toolbar-language vf-target-language"><small>번역</small><select id="liveTargetLang" aria-label="번역 언어"><option value="vi-VN">Tiếng Việt</option><option value="ko-KR">한국어</option><option value="en-US">English</option><option value="zh-CN">中文</option></select></label><span class="vf-participant-count">참여 ${people.length||1}명</span><span class="vf-toolbar-recording ${state.media.recording||state.media.videoRecording?'active':''}"><i></i><b>${capture}</b><time id="recordTime">${fmt(state.media.elapsed)}</time><small id="speechState">${speechStatus}</small></span><button id="pauseCapture" class="vf-toolbar-pause" type="button" aria-label="${!state.media.recording?'녹음 시작':state.media.paused?'녹음 계속':'일시정지'}" title="${!state.media.recording?'녹음 시작':state.media.paused?'녹음 계속':'일시정지'}">${!state.media.recording?'▶':state.media.paused?'▶':'Ⅱ'}<span>${!state.media.recording?'시작':state.media.paused?'계속':'일시정지'}</span></button><button id="stopCapture" class="vf-toolbar-complete danger" type="button">완료</button></section>${videoOn?`<section class="vf-video-grid" data-count="${Math.max(people.length,1)}">${people.length?people.map((p,i)=>`<article class="${i===0?'active-speaker':''}">${p.peer_id===m._peer&&state.video._cameraStream?'<video id="localVideoPreview" autoplay muted playsinline></video>':`<div class="vf-video-avatar">${esc((p.name||'참여자').slice(0,1))}</div>`}<small>${esc(p.name||'참여자')}${i===0?' · 발언 중':''}</small></article>`).join(''):`<article class="active-speaker"><video id="localVideoPreview" autoplay muted playsinline></video><small>${esc(localStorage.displayName||state.user?.name||'나')} · 발언 중</small></article>`}</section>`:''}<section id="liveChatStream" class="live-chat-stream vf-transcript" aria-live="polite">${state.captions.slice(-80).map(captionCard).join('')||'<div class="empty premium-empty"><b>말을 시작하세요</b><span>원문·번역·화자·시간이 같은 대화방에 기록됩니다.</span></div>'}<article id="interimBubble" class="chat-msg mine interim ${state.interimText?'show':''}"><div class="chat-meta"><b>${esc(localStorage.displayName||state.user?.name||'나')}</b><span>인식 중</span></div><div class="chat-bubble"><p id="interimText">${esc(state.interimText||'')}</p><div class="chat-translation waiting"><small>번역</small><p>문장 확정 후 번역됩니다…</p></div></div></article></section><section id="vfCoreActions" class="vf-core-actions"><button id="inviteInline" type="button">♙ 초대</button><button id="videoRequest" type="button">▣ 화상</button><button type="button" data-href="/board.html">□ 자료</button><button id="vfChair" type="button">♛ 의장모드</button></section><section id="liveComposer" class="chat-compose-row vf-composer"><textarea id="chatText" rows="3" placeholder="말하거나 메시지 입력">${esc(state.chatDraft||'')}</textarea><button id="sendChat" class="vf-send-icon" type="button" aria-label="전송·실행" title="전송·실행">➤</button></section>`)}
function account(){if(!state.user)return shell(`<section class="page-head"><div><small>SECURE ACCOUNT</small><h1>로그인 / 회원가입</h1></div></section><section class="auth-grid"><form id="loginForm" class="panel elevated"><h2>로그인</h2><input id="loginEmail" type="email" placeholder="이메일" required><input id="loginPw" type="password" placeholder="비밀번호" required><button class="primary">로그인</button></form><form id="joinForm" class="panel elevated"><h2>회원가입</h2><input id="joinName" placeholder="이름" required><input id="joinEmail" type="email" placeholder="이메일" required><input id="joinPw" type="password" minlength="8" placeholder="비밀번호 8자 이상" required><label class="check"><input id="agreeTerms" type="checkbox" required><span><a href="/terms" target="_blank">이용약관</a> 동의 <b>필수</b></span></label><label class="check"><input id="agreePrivacy" type="checkbox" required><span><a href="/privacy" target="_blank">개인정보처리방침</a> 동의 <b>필수</b></span></label><label class="check"><input id="agreeMarketing" type="checkbox"><span>마케팅 정보 수신 <em>선택</em></span></label><button class="primary">회원가입</button></form></section>`);const adminSettings=state.user.role==='admin'?`<article class="panel admin-settings-hub"><h2>관리자 설정</h2><p class="small">조직·연결·모듈·UI 스킨·진단을 한곳에서 관리합니다.</p><button data-nav="admin" class="settings-link">사용자·조직 관리</button><a class="settings-link" href="/admin-integrations.html">앱 기본 연결 · Provider</a><a class="settings-link" href="/ai-meeting-lab.html">모듈 작동 · 연결성장 테스트</a><label>UI 스킨 확인<select id="adminSkin"><option value="current">현재 기본 UI</option><option value="dark">다크 UI</option><option value="contrast">고대비 UI</option></select></label></article>`:'';return shell(`<section class="page-head"><div><small>SETTINGS</small><h1>설정</h1></div></section><section class="settings-grid"><article class="panel account-card"><div class="account-avatar">${esc(state.user.name.slice(0,1))}</div><h2>${esc(state.user.name)}</h2><p>${esc(state.user.email)}</p><span>${esc(state.user.role)}</span><button id="logout">로그아웃</button></article><article class="panel"><h2>개인 설정</h2><label>화면 언어<select id="settingUiLanguage"><option value="ko">한국어</option><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="zh">中文</option></select></label><label>기본 말하기 언어 <small>회의 중에는 고정됩니다</small><select id="settingSourceLanguage"><option value="ko-KR">한국어</option><option value="vi-VN">Tiếng Việt</option><option value="en-US">English</option><option value="zh-CN">中文</option></select></label><label>기본 번역 언어<select id="settingTargetLanguage"><option value="ko-KR">한국어</option><option value="vi-VN">Tiếng Việt</option><option value="en-US">English</option><option value="zh-CN">中文</option></select></label><label class="check"><input id="settingDarkMode" type="checkbox"><span>다크 모드</span></label><a class="settings-link" href="/privacy" target="_blank">개인정보·동의 관리</a><a class="settings-link" href="/account-delete" target="_blank">계정 삭제 안내</a><button id="settingsDeviceTest">음질·마이크 확인</button><p id="settingsDeviceResult" class="small">테스트 전</p><a class="settings-link" href="/ai-meeting-lab.html?mode=translation-selftest">번역 확인</a></article>${adminSettings}</section><section class="panel danger-zone"><button id="deleteAccount" class="danger">계정 삭제</button></section>`)}

const replace={nav,shell,home,room,account};
for(let i=0;i<lines.length;i++)for(const [name,fn] of Object.entries(replace))if(lines[i].startsWith(`function ${name}(`))lines[i]=fn.toString();

function captionCardV332(c){const source=c.display_source_language||c.detected_language||c.language||'ko-KR';const target=localStorage.targetLanguage||c.display_target_language||locale[state.lang]||'en-US';const light=c.validation?.light||'yellow',score=c.validation?.score??0;const mine=(c.peer_id&&state.meeting?._peer&&c.peer_id===state.meeting._peer)||c.speaker===(localStorage.displayName||state.user?.name);const canManage=mine||state.user?.role==='admin'||(state.meeting?.host_peer_id&&state.meeting.host_peer_id===state.meeting?._peer);const translated=String(c.translations?.[target]||c.translation||'').trim(),original=String(c.text||'').trim();const changed=translated&&translated!==original;return `<article class="chat-msg ${mine?'mine':'other'}" data-caption-id="${esc(c.id||'')}"><div class="chat-meta"><b>${esc(c.speaker||'Participant')}</b><span>${langLabel(source)} · ${new Date(c.created_at||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div><div class="chat-bubble"><div class="caption-copy-row"><p class="chat-original">${esc(original)}</p>${mine?`<button type="button" class="caption-pencil" data-original-edit="${esc(c.id||'')}" aria-label="음성인식 원문 수정" title="음성인식 원문 수정">✎</button>`:''}${canManage?`<button type="button" class="caption-delete-icon" data-caption-delete="${esc(c.id||'')}" aria-label="채팅 삭제" title="채팅 삭제">×</button>`:''}</div>${mine?`<div class="caption-edit-panel" data-original-panel="${esc(c.id||'')}" hidden><textarea data-original-input="${esc(c.id||'')}" aria-label="음성인식 원문 수정">${esc(original)}</textarea><button type="button" data-original-save="${esc(c.id||'')}" data-target="${esc(target)}">저장</button><button type="button" data-original-cancel="${esc(c.id||'')}">취소</button></div>`:''}<div class="chat-translation ${changed?'':'waiting'}"><small>${langLabel(target)} 번역</small><div class="caption-copy-row"><p class="translation-display" data-translation-display="${esc(c.id||'')}">${esc(changed?translated:'번역 처리 중')}</p>${mine?`<button type="button" class="caption-pencil" data-translation-edit="${esc(c.id||'')}" aria-label="번역 수정" title="번역 수정">✎</button>`:''}</div>${mine?`<div class="translation-edit-panel" data-translation-panel="${esc(c.id||'')}" hidden><textarea class="translation-inline-edit" data-translation-input="${esc(c.id||'')}" data-target="${esc(target)}" aria-label="번역문 수정">${esc(changed?translated:'')}</textarea><button type="button" class="translation-save" data-translation-save="${esc(c.id||'')}" data-target="${esc(target)}">저장</button><button type="button" class="translation-cancel" data-translation-cancel="${esc(c.id||'')}">취소</button></div>`:''}</div></div><div class="chat-assurance ${changed?light:'yellow'}">${changed?'번역 품질 '+score+'%':'번역 처리 중'}</div></article>`}

for(let i=0;i<lines.length;i++){
  if(lines[i].startsWith('const LANG='))lines[i]="const APP_VERSION='3.4.4';"+lines[i];
  if(lines[i].startsWith('function captionCard('))lines[i]=captionCardV332.toString().replace('captionCardV332','captionCard');
  if(lines[i].startsWith('function admin()')){const statusKey='data-user-status="${u.id}"',keyAt=lines[i].indexOf(statusKey),buttonStart=lines[i].lastIndexOf('<button',keyAt),buttonEnd=lines[i].indexOf('</button>',keyAt);if(keyAt<0||buttonStart<0||buttonEnd<0)throw new Error('admin_member_delete_anchor_missing');const statusButton=lines[i].slice(buttonStart,buttonEnd+9),controls='<div class="member-actions">'+statusButton+'<button data-user-delete="${u.id}" data-user-name="${esc(u.name)}" class="danger">삭제</button></div>';lines[i]=lines[i].slice(0,buttonStart)+controls+lines[i].slice(buttonEnd+9)}
  if(lines[i].includes("document.querySelectorAll('[data-user-status]')"))lines[i]+="\n  document.querySelectorAll('[data-caption-delete]').forEach(button=>button.onclick=async()=>{const id=button.dataset.captionDelete;if(!confirm('이 채팅 내용을 삭제할까요? 원문과 번역이 함께 삭제됩니다.'))return;button.disabled=true;try{await api('/api/v1/meetings/'+encodeURIComponent(captionMeetingId(id))+'/captions/'+encodeURIComponent(id),{method:'DELETE',body:JSON.stringify({peer_id:state.meeting?._peer||''})});state.captions=state.captions.filter(x=>x.id!==id);render()}catch(e){button.disabled=false;alert(e.message==='caption_delete_forbidden'?'삭제 권한이 없습니다.':'채팅 삭제 실패: '+e.message)}});document.querySelectorAll('[data-original-edit]').forEach(button=>button.onclick=()=>{const id=button.dataset.originalEdit,panel=[...document.querySelectorAll('[data-original-panel]')].find(x=>x.dataset.originalPanel===id);if(panel){panel.hidden=false;button.hidden=true;panel.querySelector('textarea')?.focus()}});document.querySelectorAll('[data-original-cancel]').forEach(button=>button.onclick=()=>{const id=button.dataset.originalCancel,panel=[...document.querySelectorAll('[data-original-panel]')].find(x=>x.dataset.originalPanel===id),edit=[...document.querySelectorAll('[data-original-edit]')].find(x=>x.dataset.originalEdit===id);if(panel)panel.hidden=true;if(edit)edit.hidden=false});document.querySelectorAll('[data-original-save]').forEach(button=>button.onclick=async()=>{const id=button.dataset.originalSave,target=button.dataset.target,input=[...document.querySelectorAll('[data-original-input]')].find(x=>x.dataset.originalInput===id),text=input?.value?.trim()||'';if(!text)return alert('수정할 원문을 입력하세요.');button.disabled=true;button.textContent='번역 중…';try{const d=await api('/api/v1/meetings/'+encodeURIComponent(captionMeetingId(id))+'/captions/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({peer_id:state.meeting?._peer||'',target,text})});const i=state.captions.findIndex(x=>x.id===id);if(i>=0)state.captions[i]={...state.captions[i],...(d.data||{})};render()}catch(e){button.disabled=false;button.textContent='저장';alert('원문 수정 실패: '+e.message)}});document.querySelectorAll('[data-translation-edit]').forEach(button=>button.onclick=()=>{const panel=[...document.querySelectorAll('[data-translation-panel]')].find(x=>x.dataset.translationPanel===button.dataset.translationEdit);if(panel){panel.hidden=false;button.hidden=true;panel.querySelector('textarea')?.focus()}});document.querySelectorAll('[data-translation-cancel]').forEach(button=>button.onclick=()=>{const id=button.dataset.translationCancel,panel=[...document.querySelectorAll('[data-translation-panel]')].find(x=>x.dataset.translationPanel===id),edit=[...document.querySelectorAll('[data-translation-edit]')].find(x=>x.dataset.translationEdit===id);if(panel)panel.hidden=true;if(edit)edit.hidden=false});document.querySelectorAll('[data-translation-save]').forEach(button=>button.onclick=async()=>{const id=button.dataset.translationSave,target=button.dataset.target,input=document.querySelector('[data-translation-input=\\\"'+CSS.escape(id)+'\\\"][data-target=\\\"'+CSS.escape(target)+'\\\"]'),translation=input?.value?.trim()||'';if(!translation)return alert('수정할 번역문을 입력하세요.');try{const d=await api('/api/v1/meetings/'+encodeURIComponent(captionMeetingId(id))+'/captions/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({peer_id:state.meeting?._peer||'',target,translation})});const i=state.captions.findIndex(x=>x.id===id);if(i>=0)state.captions[i]={...state.captions[i],...(d.data||{})};render()}catch(e){alert('번역 저장 실패: '+e.message)}});";
  if(lines[i].includes("document.querySelectorAll('[data-user-status]')"))lines[i]+="\n  document.querySelectorAll('[data-user-delete]').forEach(b=>b.onclick=async()=>{const name=b.dataset.userName||'이 회원';if(!confirm(name+' 회원을 삭제할까요? 로그인 세션이 종료되며 목록에서 제거됩니다.'))return;try{await api('/api/v1/admin/users/'+encodeURIComponent(b.dataset.userDelete),{method:'DELETE'});await loadAdmin();render()}catch(e){alert(e.message==='self_delete_forbidden'?'현재 로그인한 관리자 계정은 삭제할 수 없습니다.':e.message==='last_admin_delete_forbidden'?'마지막 관리자 계정은 삭제할 수 없습니다.':'회원 삭제 실패: '+e.message)}});";
  if(lines[i].startsWith('function toggleRecordingPause()')){if(!lines[i].includes("if(!state.meeting||!state.media.recording)return;"))throw new Error('recording_retry_function_anchor_missing');lines[i]=lines[i].replace("if(!state.meeting||!state.media.recording)return;","if(!state.meeting)return;if(!state.media.recording){void startRecording();return}")}
  if(lines[i].startsWith('async function syncMeetingCreate(')){if(!lines[i].includes('render();pollCaptions();pollSignals()}catch'))throw new Error('meeting_owner_auto_start_anchor_missing');lines[i]=lines[i].replace('render();pollCaptions();pollSignals()}catch','render();pollCaptions();pollSignals();pollRoomState();await startRecording()}catch')}
  if(lines[i].startsWith('async function syncQuickJoin(')){if(!lines[i].includes('render();pollCaptions();pollSignals()}catch'))throw new Error('meeting_guest_auto_start_anchor_missing');lines[i]=lines[i].replace('render();pollCaptions();pollSignals()}catch','render();pollCaptions();pollSignals();pollRoomState();await startRecording()}catch')}
  if(lines[i].startsWith('function quickJoin(){')){if(!lines[i].includes("setTimeout(()=>{void checkDevices(false).catch(()=>{})},0)"))throw new Error('guest_parallel_device_check_anchor_missing');lines[i]=lines[i].replace("state.media.recording=false;render();setTimeout(()=>{void syncQuickJoin({name,language})},0);setTimeout(()=>{void checkDevices(false).catch(()=>{})},0)","state.media.recording=false;state.captionSince=0;state.signalSince=0;state.captions=[];render();setTimeout(()=>{void syncQuickJoin({name,language})},0)")}
  if(lines[i].startsWith('async function syncQuickJoin(')){if(!lines[i].includes("localStorage.language=language;"))throw new Error('guest_caption_reset_anchor_missing');lines[i]=lines[i].replace("localStorage.language=language;","state.captionSince=0;state.signalSince=0;state.captions=[];localStorage.language=language;")}
  if(lines[i].startsWith('function pollCaptions(){')){if(!lines[i].includes('setInterval(tick,1100)')||!lines[i].includes('since=${state.captionSince}'))throw new Error('caption_poll_interval_anchor_missing');lines[i]=lines[i].replace('setInterval(tick,1100)','setInterval(tick,400)').replace('since=${state.captionSince}','since=${Math.max(0,state.captionSince-5000)}')}
  if(lines[i].startsWith('function pollSignals(){')){if(!lines[i].includes('state.signalPoll=setInterval(async()=>{')||!lines[i].includes('},1200)'))throw new Error('signal_poll_interval_anchor_missing');lines[i]=lines[i].replace('state.signalPoll=setInterval(async()=>{','const tick=async()=>{').replace('},1200)','};void tick();state.signalPoll=setInterval(tick,450)')}
  if(lines[i].startsWith('async function checkDevices(')){if(!lines[i].includes("try{const cam=await withTimeout(navigator.mediaDevices.getUserMedia({video:true,audio:false}),7000,'camera_timeout');"))throw new Error('guest_camera_permission_anchor_missing');lines[i]=lines[i].replace("state.media.camera='checking';","state.media.camera=keepVideo?'checking':'idle';").replace("try{const cam=await withTimeout(navigator.mediaDevices.getUserMedia({video:true,audio:false}),7000,'camera_timeout');state.media.camera=cam.getVideoTracks()[0]?.readyState==='live'?'ok':'error';if(keepVideo){state.video._cameraStream=cam;state.video.status='카메라 준비'}else (cam?.getTracks?.()||[]).forEach(x=>x.stop())}catch{state.media.camera='error';state.video.status='카메라 연결 실패'}","if(keepVideo){try{const cam=await withTimeout(navigator.mediaDevices.getUserMedia({video:true,audio:false}),7000,'camera_timeout');state.media.camera=cam.getVideoTracks()[0]?.readyState==='live'?'ok':'error';state.video._cameraStream=cam;state.video.status='카메라 준비'}catch{state.media.camera='error';state.video.status='카메라 연결 실패'}}")}

  if(lines[i].includes("if(s.type==='video-response')state.video.status="))lines[i]=lines[i].replace("if(s.type==='video-response')state.video.status=s.payload?.accepted?'상대방 수락':'상대방 거절'","if(s.type==='video-response'){state.video.status=s.payload?.accepted?'상대방 수락':'상대방 거절';if(s.payload?.accepted&&!state.video._cameraStream)await enableCamera()}");
  if(lines[i].includes("$('#inviteInline')?.addEventListener"))lines[i]+="\n  $('#vfChair')?.addEventListener('click',()=>window.VoiceFlowUnified?.openChair?.());$('#vfQualityState')?.addEventListener('click',openDeviceDiagnostics);$('#openChromeStt')?.addEventListener('click',()=>{const target=location.href.replace(/^https?:\\/\\//,'');location.href='intent://'+target+'#Intent;scheme=https;package=com.android.chrome;end'});";
  if(lines[i].includes("$('#deviceTest')?.addEventListener"))lines[i]+="\n  $('#settingsDeviceTest')?.addEventListener('click',async()=>{const o=$('#settingsDeviceResult');if(o)o.textContent='장치 확인 중...';try{const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:true});if(o)o.textContent='마이크·카메라 정상';s.getTracks().forEach(t=>t.stop())}catch(e){if(o)o.textContent='권한 또는 장치를 확인하세요'}});const sui=$('#settingUiLanguage');if(sui){sui.value=state.lang||'ko';sui.onchange=()=>{state.lang=sui.value;localStorage.uiLanguage=sui.value;render()}}const ssl=$('#settingSourceLanguage');if(ssl){ssl.value=localStorage.sourceLanguage||locale[state.lang]||'ko-KR';ssl.onchange=()=>{localStorage.sourceLanguage=ssl.value}}const stl=$('#settingTargetLanguage');if(stl){stl.value=localStorage.targetLanguage||'vi-VN';stl.onchange=()=>localStorage.targetLanguage=stl.value}const dark=$('#settingDarkMode');if(dark){dark.checked=localStorage.voiceflowDark==='1';dark.onchange=()=>{localStorage.voiceflowDark=dark.checked?'1':'0';document.documentElement.classList.toggle('voiceflow-dark',dark.checked)}}";
  if(lines[i].startsWith('function bind(){'))lines[i]+="\n  const globalUiLanguage=$('#globalUiLanguage');if(globalUiLanguage){globalUiLanguage.value=state.lang||localStorage.uiLanguage||'ko';globalUiLanguage.onchange=()=>{state.lang=globalUiLanguage.value;localStorage.uiLanguage=globalUiLanguage.value;render()}}";
  if(lines[i].startsWith('function bind(){'))lines[i]+="\n  const skin=$('#adminSkin');if(skin){skin.value=localStorage.voiceflowAdminSkin||'current';skin.onchange=()=>{localStorage.voiceflowAdminSkin=skin.value;document.documentElement.dataset.voiceflowSkin=skin.value}}";
  if(lines[i].includes("$('#videoRequest')?.addEventListener('click',requestVideo)"))lines[i]=lines[i].replace("$('#videoRequest')?.addEventListener('click',requestVideo)","$('#videoRequest')?.addEventListener('click',openVideoSetup)");
  if(lines[i].includes("p.peer_id===m._peer&&state.video._cameraStream"))lines[i]=lines[i].replace("p.peer_id===m._peer&&state.video._cameraStream","(p.peer_id===m._peer||p.name===(localStorage.displayName||state.user?.name))&&state.video._cameraStream");
  if(lines[i].includes("$('#app').innerHTML=html;bind()"))lines[i]=lines[i].replace("$('#app').innerHTML=html;bind()","$('#app').innerHTML=html;bind();attachLocalVideoPreview()");
  if(lines[i].includes("state.media.stream?.getTracks().forEach(x=>x.stop())"))lines[i]=lines[i].replace("state.media.stream?.getTracks().forEach(x=>x.stop())","state.media.stream?.getTracks().forEach(x=>x.stop());stopVideoPreview()");
  if(lines[i].startsWith('async function startRecording()'))lines[i]=lines[i].replace("state.media.recording=true;state.media.startedAt=Date.now()-state.media.elapsed*1000;","state.media.recording=true;state.media.startedAt=Date.now()-state.media.elapsed*1000;if(window.MediaRecorder&&state.media.stream){try{const chunks=[],preferred=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported?.(x)),recorder=new MediaRecorder(state.media.stream,preferred?{mimeType:preferred}:undefined);state.media.recorder=recorder;recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});state.media.lastMediaBlob=blob;if(state.media.lastAudioUrl?.startsWith('blob:'))URL.revokeObjectURL(state.media.lastAudioUrl);state.media.lastAudioUrl=blob.size?URL.createObjectURL(blob):''};recorder.start(1000)}catch(e){state.media.recordingError=String(e?.message||e)}};")
  if(lines[i].startsWith('function stopRecording()'))lines[i]=lines[i].replace('function stopRecording()','async function stopRecording()').replace("try{state.media.videoRecorder?.state!=='inactive'&&state.media.videoRecorder?.stop()}catch{}","const recorders=[state.media.videoRecorder,state.media.recorder].filter(Boolean);await Promise.all(recorders.map(recorder=>recorder.state==='inactive'?Promise.resolve():new Promise(resolve=>{recorder.addEventListener?.('stop',resolve,{once:true});try{recorder.stop()}catch{resolve()}setTimeout(resolve,2500)})));" )
  if(lines[i].startsWith('async function endMeeting()'))lines[i]=lines[i].replace('stopRecording();clearInterval(state.poll)','await stopRecording();clearInterval(state.poll)')
  if(lines[i].startsWith('function startSpeech()'))lines[i]=lines[i].replace("updateInterimText('')};r.onresult","updateInterimText(state.interimText||'')};r.onresult")
  if(lines[i].includes("'x-voice-language':'auto'"))lines[i]=lines[i].replaceAll("'x-voice-language':'auto'","'x-voice-language':lang")
  if(lines[i].includes("const chatBox=$('#chatText');if(chatBox){"))lines[i]=lines[i].replace("const chatBox=$('#chatText');if(chatBox){","const chatBox=$('#chatText');if(chatBox){chatBox.addEventListener('input',()=>{state.chatDraft=chatBox.value});")
  if(lines[i].startsWith('async function sendChat()'))lines[i]=lines[i].replace("if(el)el.value='';await postCaption(text)","if(el)el.value='';state.chatDraft='';await postCaption(text)")
}

const deviceDiagnosticsHelpers=`
function openDeviceDiagnostics(){
  document.querySelector('#vfDeviceDiagnostics')?.remove();
  let cameraTestStream=null,micTestStream=null,timer=0;
  document.body.insertAdjacentHTML('beforeend',\`<section id="vfDeviceDiagnostics" class="vf-device-check" role="dialog" aria-modal="true" aria-labelledby="vfDeviceCheckTitle"><div class="vf-device-check-card"><div class="vf-device-check-head"><div><small>DEVICE CHECK</small><h2 id="vfDeviceCheckTitle">마이크 · 카메라 확인</h2></div><button id="deviceCheckClose" type="button" aria-label="닫기">×</button></div><section class="vf-device-mic"><b>마이크 입력</b><div class="vf-device-meter"><i id="deviceMeterBar"></i></div><p id="deviceMicState">입력 상태 확인 중</p><button id="deviceMicTest" type="button">마이크 다시 확인</button><button id="deviceSpeechTest" class="primary" type="button">5초 음성→텍스트·번역 테스트</button><div id="deviceSpeechResult" class="vf-device-speech-result">테스트 전</div></section><section class="vf-device-camera"><b>카메라 화면</b><div class="vf-device-preview"><video id="deviceCameraPreview" autoplay muted playsinline></video><span id="deviceCameraState">확인 전 · 송출되지 않음</span></div><button id="deviceCameraTest" type="button">카메라 확인</button></section><p class="vf-device-note">이 진단 화면의 카메라는 다른 참가자에게 송출되지 않습니다.</p></div></section>\`);
  const status=()=>{const data=window.VoiceFlowAudioMonitor?.status||{};const label=document.querySelector('#vfQualityLabel')?.textContent||'확인 중';const text=document.querySelector('#deviceMicState'),bar=document.querySelector('#deviceMeterBar');if(text)text.textContent=label+(Number.isFinite(data.level)?\` · 입력 \${data.level}%\`:'');if(bar)bar.style.width=Math.max(2,Math.min(100,data.level||0))+'%'};
  const close=()=>{clearInterval(timer);cameraTestStream?.getTracks().forEach(t=>t.stop());micTestStream?.getTracks().forEach(t=>t.stop());document.querySelector('#vfDeviceDiagnostics')?.remove()};
  document.querySelector('#deviceCheckClose').onclick=close;
  document.querySelector('#vfDeviceDiagnostics').onclick=e=>{if(e.target.id==='vfDeviceDiagnostics')close()};
  document.querySelector('#deviceMicTest').onclick=async()=>{const out=document.querySelector('#deviceMicState');try{micTestStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});if(out)out.textContent='마이크 권한 정상 · 말해보세요';setTimeout(status,300)}catch(e){if(out)out.textContent='마이크 권한을 허용해주세요'}};
  document.querySelector('#deviceSpeechTest').onclick=async()=>{const button=document.querySelector('#deviceSpeechTest'),out=document.querySelector('#deviceSpeechResult');button.disabled=true;out.textContent='5초 동안 말씀하세요…';let testStream=null;try{testStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});const chunks=[],preferred=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(x=>MediaRecorder.isTypeSupported?.(x)),recorder=new MediaRecorder(testStream,preferred?{mimeType:preferred}:undefined);recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.start();await new Promise(r=>setTimeout(r,5000));await new Promise(r=>{recorder.onstop=r;recorder.stop()});out.textContent='음성을 텍스트로 변환 중…';const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'}),lang=localStorage.sourceLanguage||state.meeting?.language||locale[state.lang]||'ko-KR',target=localStorage.targetLanguage||'vi-VN',response=await fetch('/api/v1/meetings/'+encodeURIComponent(state.meeting.id)+'/transcribe',{method:'POST',headers:{'content-type':blob.type||'audio/webm','x-voice-language':'auto','x-voice-target':target},body:blob}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||data.error||('HTTP '+response.status));const text=String(data.text||'').trim();if(!text){out.textContent='음성을 찾지 못했습니다. 마이크 가까이에서 다시 말해 주세요.';return}out.textContent='원문: '+text+(data.translation?' / 번역: '+data.translation:' / 번역 결과 없음')+' · '+(data.provider||'STT')}catch(e){out.textContent='실패: '+String(e?.message||e)}finally{testStream?.getTracks().forEach(t=>t.stop());button.disabled=false}};
  document.querySelector('#deviceCameraTest').onclick=async()=>{const out=document.querySelector('#deviceCameraState'),video=document.querySelector('#deviceCameraPreview');try{cameraTestStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});video.srcObject=cameraTestStream;await video.play().catch(()=>{});if(out)out.textContent='카메라 정상 · 아직 송출되지 않음'}catch(e){if(out)out.textContent='카메라 권한 또는 장치를 확인하세요'}};
  status();timer=setInterval(status,180);
}
`;
lines.push(deviceDiagnosticsHelpers);

const videoSetupHelpers=`
function stopVideoPreview(){
  const streams=[state.video._previewStream,state.video._cameraStream].filter(Boolean);
  for(const stream of new Set(streams))stream.getTracks().forEach(track=>track.stop());
  state.video._previewStream=null;
  state.video._cameraStream=null;
  state.video._track=null;
  document.querySelector('#vfVideoSetup')?.remove();
}
function videoTrackIsLive(stream){
  const track=stream?.getVideoTracks?.()[0];
  return !!(stream?.active&&track&&track.readyState==='live'&&track.enabled);
}
function attachLocalVideoPreview(){
  const video=document.querySelector('#localVideoPreview');
  const stream=state.video._cameraStream||state.video._previewStream;
  if(!video||!videoTrackIsLive(stream))return false;
  if(video.srcObject!==stream)video.srcObject=stream;
  video.muted=true;
  video.play().catch(()=>{});
  return true;
}
function videoBrowserCompatibility(){
  const ua=navigator.userAgent||'',android=/Android/i.test(ua),ios=/iPhone|iPad|iPod/i.test(ua),edge=/Edg|EdgA|EdgiOS/i.test(ua),chrome=/Chrome|CriOS/i.test(ua)&&!/EdgA|EdgiOS|OPR|SamsungBrowser/i.test(ua);
  const mediaSupported=!!(window.isSecureContext&&navigator.mediaDevices?.getUserMedia&&window.RTCPeerConnection);
  return {android,ios,edge,chrome,mediaSupported,supported:chrome&&mediaSupported};
}
function openCurrentInChrome(){
  const compat=videoBrowserCompatibility();
  if(!compat.android)return;
  const target=location.href.replace(/^https?:\\/\\//,'');
  location.href='intent://'+target+'#Intent;scheme=https;package=com.android.chrome;end';
}
async function openVideoSetup(){
  document.querySelector('#vfVideoSetup')?.remove();
  const compat=videoBrowserCompatibility();
  if(!compat.supported){
    state.video.status=compat.edge?'Edge에서는 화상송출이 정상 표시되지 않습니다':'현재 브라우저에서는 카메라 영상송출을 사용할 수 없습니다';
    if(compat.android&&confirm(state.video.status+'\\nChrome에서 다시 열까요?'))openCurrentInChrome();else alert(state.video.status+'\\n음성·채팅은 계속 사용할 수 있습니다. 화상은 최신 Chrome에서 실행해 주세요.');
    return;
  }
  let stream=state.video._previewStream;
  try{
    if(!videoTrackIsLive(stream))stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
    if(!videoTrackIsLive(stream))throw new Error('camera_track_not_live');
    state.video._previewStream=stream;
  }catch{
    state.video.status='카메라 권한 또는 장치를 확인하세요';
    alert(state.video.status);
    return;
  }
  const name=esc(localStorage.displayName||state.user?.name||'나'),browserTitle=compat.chrome?'Chrome 영상송출 확인':'현재 브라우저 기능 확인',browserText=compat.chrome?'현재 검증된 권장 환경입니다.':'영상송출은 가능하지만 Chrome 사용을 권장합니다.';
  document.body.insertAdjacentHTML('beforeend',\`<section id="vfVideoSetup" class="vf-video-setup" role="dialog" aria-modal="true" aria-labelledby="vfVideoSetupTitle"><div class="vf-video-setup-card"><div class="vf-video-setup-head"><div><small>LOCAL PREVIEW</small><h2 id="vfVideoSetupTitle">먼저 내 얼굴을 확인하세요</h2></div><button id="videoSetupClose" type="button" aria-label="닫기">×</button></div><div class="vf-video-browser-note \${compat.chrome?'verified':'recommend'}"><div><b>\${browserTitle}</b><span>\${browserText}</span></div>\${compat.android&&!compat.chrome?'<button id="videoOpenChrome" type="button">Chrome에서 열기</button>':''}</div><div class="vf-video-preview-wrap"><video id="videoSetupPreview" autoplay muted playsinline></video><span>\${name} · 아직 송출되지 않음</span></div><p>이 화면은 내 기기에서만 보입니다. 아래에서 참여 방식을 선택하기 전에는 다른 참가자에게 영상이 전송되지 않습니다.</p><div class="vf-video-choice"><button id="videoSendReject" type="button">송출 거부</button><button id="videoNameplateOnly" type="button">이름표로 참여</button><button id="videoSendApprove" class="primary" type="button">영상 송출</button></div></div></section>\`);
  const preview=document.querySelector('#videoSetupPreview');
  preview.srcObject=stream;
  preview.play().catch(()=>{});
  document.querySelector('#videoOpenChrome')?.addEventListener('click',()=>{stopVideoPreview();openCurrentInChrome()});
  document.querySelector('#videoSetupClose').onclick=()=>{stopVideoPreview();state.video.status='off';};
  document.querySelector('#videoSendReject').onclick=()=>{stopVideoPreview();state.video._shareMode='off';state.video.status='영상 송출 거부';render();};
  document.querySelector('#videoNameplateOnly').onclick=()=>{stopVideoPreview();state.video._shareMode='nameplate';state.video.status='이름표로 참여';render();};
  document.querySelector('#videoSendApprove').onclick=async()=>{
    if(!videoTrackIsLive(stream)){state.video.status='카메라 연결이 끊겼습니다 · 다시 확인하세요';alert(state.video.status);return;}
    const track=stream.getVideoTracks()[0];
    state.video._cameraStream=stream;state.video._track=track;state.video._previewStream=null;state.video._shareMode='camera';state.video.status='영상 송출 선택';
    track.onended=()=>{if(state.video._track!==track)return;state.video._cameraStream=null;state.video._track=null;state.video._shareMode='off';state.video.status='카메라 연결이 종료되었습니다';render();};
    document.querySelector('#vfVideoSetup')?.remove();render();await requestVideo();
    requestAnimationFrame(()=>attachLocalVideoPreview());
    setTimeout(()=>attachLocalVideoPreview(),150);
  };
}
`;
lines.push(videoSetupHelpers);

const roomPresenceHelpers=`
function pollRoomState(){
  clearInterval(state.roomPoll);
  const tick=async()=>{
    if(!state.meeting?.id)return;
    try{
      const response=await api('/api/v1/meetings/'+encodeURIComponent(state.meeting.id));
      const meeting=response.data||response;
      const current=JSON.stringify((state.meeting.participants||[]).map(x=>[x.peer_id,x.name,x.language]));
      const next=JSON.stringify((meeting.participants||[]).map(x=>[x.peer_id,x.name,x.language]));
      if(current!==next){state.meeting={...state.meeting,...meeting,_peer:state.meeting._peer};if(state.view==='room')renderRoomStable(false);}
    }catch{}
  };
  void tick();
  state.roomPoll=setInterval(tick,800);
}
`;
lines.push(roomPresenceHelpers);

for(let i=0;i<lines.length;i++){
  if(lines[i].startsWith('function startSpeech()')){if(!lines[i].includes('function startSpeech(){startServerSpeechFallback();'))throw new Error('mobile_speech_permission_anchor_missing');lines[i]=lines[i].replace('function startSpeech(){startServerSpeechFallback();',"function startSpeech(){startServerSpeechFallback();const mobileSpeech=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');if(mobileSpeech){state.media.stt='server';state.media.sttError='';return}")}
  if(lines[i].startsWith('async function syncMeetingCreate('))lines[i]=lines[i].replace('render();pollCaptions();pollSignals();pollRoomState();await startRecording()',"rememberMeeting(state.meeting,'host');render();pollCaptions();pollSignals();pollRoomState();await startRecording()")
  if(lines[i].startsWith('async function syncQuickJoin('))lines[i]=lines[i].replace('render();pollCaptions();pollSignals();pollRoomState();await startRecording()',"rememberMeeting(state.meeting,'guest');render();pollCaptions();pollSignals();pollRoomState();await startRecording()")
  if(lines[i].startsWith('function home(){'))lines[i]=lines[i].replace('</section>`)','</section>${recentMeetings()}`)')
  if(lines[i].startsWith('function bind(){'))lines[i]+="\n  document.querySelectorAll('[data-rejoin-meeting]').forEach(button=>button.onclick=()=>{const id=button.dataset.rejoinMeeting;if(id)location.href=location.origin+'/?session_id='+encodeURIComponent(id)});"
}

const recentMeetingHelpers=`
function readRecentMeetings(){try{return JSON.parse(localStorage.voiceflowRecentMeetings||'[]').filter(x=>x?.id).slice(0,8)}catch{return[]}}
function rememberMeeting(meeting,role){if(!meeting?.id)return;const rows=readRecentMeetings().filter(x=>x.id!==meeting.id);rows.unshift({id:meeting.id,title:meeting.title||'회의',role,updated_at:Date.now()});localStorage.voiceflowRecentMeetings=JSON.stringify(rows.slice(0,8))}
function recentMeetings(){const rows=readRecentMeetings();if(!rows.length)return'';return '<section class="panel vf-recent-meetings"><div class="panel-title"><h2>진행 중·최근 회의</h2><span>'+rows.length+'</span></div>'+rows.map(x=>'<article class="task"><div><b>'+esc(x.title||'회의')+'</b><small>'+new Date(x.updated_at||Date.now()).toLocaleString()+' · '+(x.role==='host'?'호스트':'게스트')+'</small></div><button type="button" data-rejoin-meeting="'+esc(x.id)+'">재입장</button></article>').join('')+'</section>'}
`;
lines.push(recentMeetingHelpers);

for(let i=0;i<lines.length;i++){
  if(lines[i].startsWith('function pollCaptions(){'))lines[i]="function captionVisibleKey(c,target){return JSON.stringify([c.id,c.text,c.translations?.[target]||c.translation||'',c.assurance?.[target]?.score||c.validation?.score||0,c.assurance?.[target]?.light||c.validation?.light||'',c.pending_translation||false,c.send_error||'',c.updated_at||''])}\nfunction hasOpenCaptionEditor(){return !!document.querySelector('[data-original-panel]:not([hidden]),[data-translation-panel]:not([hidden])')}\nfunction captionMeetingId(id){return state.captions.find(x=>x.id===id)?.meeting_id||state.meeting?.id||state.lastMeetingId}\nfunction pollCaptions(){clearInterval(state.poll);const tick=async()=>{if(!state.meeting)return;try{const target=localStorage.targetLanguage||'en-US',since=Math.max(0,state.captionSince-5000),r=await api('/api/v1/meetings/'+encodeURIComponent(state.meeting.id)+'/captions?target='+encodeURIComponent(target)+'&since='+since);let changed=false,added=false;for(const c of r.data||[]){state.captionSince=Math.max(state.captionSince,Number(c.created_at)||0,Date.parse(c.updated_at||'')||0);const mapped={...c,display_target_language:target,translation:c.translations?.[target]||c.translation||'',validation:c.assurance?.[target]||c.validation||null},i=state.captions.findIndex(x=>x.id===c.id);if(i<0){state.captions.push(mapped);changed=true;added=true}else if(captionVisibleKey(state.captions[i],target)!==captionVisibleKey(mapped,target)){state.captions[i]={...state.captions[i],...mapped};changed=true}}if(changed&&state.view==='room'&&!hasOpenCaptionEditor())renderRoomStable(added)}catch(e){const st=document.querySelector('#speechState');if(st)st.textContent='번역 연결 확인 필요'}};void tick();state.poll=setInterval(tick,400)}";
  if(lines[i].includes("$('#sendChat')?.addEventListener('click',async()=>{const e=$('#chatText');if(e?.value.trim()){await postCaption(e.value);e.value=''}});"))lines[i]=lines[i].replace("if(e?.value.trim()){await postCaption(e.value);e.value=''}","if(e?.value.trim()){const text=e.value.trim();state.chatDraft='';e.value='';await postCaption(text)}")
  if(lines[i].includes("button.disabled=true;button.textContent='번역 중…';try{const d=await api"))lines[i]=lines[i].replace("button.disabled=true;button.textContent='번역 중…';try{const d=await api","button.disabled=true;button.textContent='번역 중…';const localIndex=state.captions.findIndex(x=>x.id===id);if(localIndex>=0)state.captions[localIndex]={...state.captions[localIndex],text,pending_translation:true};renderRoomStable(false);try{const d=await api")
  if(lines[i].startsWith('(async()=>')){if(!lines[i].includes("if(state.joinId&&state.lang)state.view='join'"))throw new Error('invite_entry_anchor_missing');lines[i]=lines[i].replace("if(state.joinId&&state.lang)state.view='join'","if(state.joinId)state.view='join'")}
}


const webrtcHelpersV343=`
async function getRtcIceServersV343(){
  const cached=state.video._iceConfig;
  if(cached&&cached.expiresAt>Date.now()+60000)return cached.iceServers;
  const response=await api('/api/v1/webrtc/config');
  const data=response.data||response;
  state.video._iceConfig={iceServers:data.iceServers||[],expiresAt:Date.now()+Math.max(60,Number(data.ttl_seconds||600)-30)*1000};
  return state.video._iceConfig.iceServers;
}
async function sendRtcSignalV343(to,type,payload){
  return api('/api/v1/meetings/'+encodeURIComponent(state.meeting.id)+'/signals',{method:'POST',body:JSON.stringify({from:state.meeting._peer,to,type,payload})});
}
function attachRemoteVideosV343(){
  for(const [peer,stream] of (state.video._remoteStreams||new Map())){
    let video=document.querySelector('[data-remote-peer="'+CSS.escape(peer)+'"]');
    if(!video){const people=state.meeting?.participants||[],index=people.findIndex(x=>x.peer_id===peer),article=document.querySelector('.vf-video-grid')?.children?.[index];if(article){video=document.createElement('video');video.className='vf-remote-video';video.dataset.remotePeer=peer;video.autoplay=true;video.playsInline=true;article.prepend(video)}}
    if(!video||!stream?.active)continue;
    if(video.srcObject!==stream)video.srcObject=stream;
    video.play().catch(()=>{});
    video.closest('article')?.classList.add('remote-connected');
  }
}
async function ensureRtcPeerV343(peer){
  state.video._peers=state.video._peers||new Map();
  if(state.video._peers.has(peer))return state.video._peers.get(peer);
  const pc=new RTCPeerConnection({iceServers:await getRtcIceServersV343()});
  const entry={pc,pending:[]};state.video._peers.set(peer,entry);
  const streams=[state.video._cameraStream,state.media?.stream].filter(Boolean),seen=new Set();
  for(const stream of streams)for(const track of stream.getTracks()){if(seen.has(track.id))continue;seen.add(track.id);pc.addTrack(track,stream)}
  pc.onicecandidate=e=>{if(e.candidate)void sendRtcSignalV343(peer,'webrtc-ice',{candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate})};
  pc.ontrack=e=>{const stream=e.streams?.[0]||new MediaStream([e.track]);state.video._remoteStreams=state.video._remoteStreams||new Map();state.video._remoteStreams.set(peer,stream);state.video.status='화상 연결됨';if(state.view==='room')renderRoomStable(false);requestAnimationFrame(attachRemoteVideosV343)};
  pc.onconnectionstatechange=()=>{const status=pc.connectionState;if(status==='connected'){state.video.status='화상 연결됨';attachRemoteVideosV343()}else if(status==='failed'||status==='closed'){state.video.status='화상 연결 확인 필요';state.video._peers.delete(peer);state.video._remoteStreams?.delete(peer);if(state.view==='room')renderRoomStable(false)}};
  return entry;
}
async function startRtcOfferV343(peer){
  const entry=await ensureRtcPeerV343(peer),offer=await entry.pc.createOffer();
  await entry.pc.setLocalDescription(offer);
  await sendRtcSignalV343(peer,'webrtc-offer',{description:entry.pc.localDescription});
  state.video.status='화상 연결 중';
}
async function handleRtcSignalV343(signal){
  const peer=signal.from,payload=signal.payload||{},entry=await ensureRtcPeerV343(peer),pc=entry.pc;
  if(signal.type==='webrtc-offer'){await pc.setRemoteDescription(payload.description);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await sendRtcSignalV343(peer,'webrtc-answer',{description:pc.localDescription})}
  else if(signal.type==='webrtc-answer'){if(!pc.currentRemoteDescription)await pc.setRemoteDescription(payload.description)}
  else if(signal.type==='webrtc-ice'){if(payload.candidate){if(pc.remoteDescription)await pc.addIceCandidate(payload.candidate);else entry.pending.push(payload.candidate)}}
  if(pc.remoteDescription&&entry.pending.length){for(const candidate of entry.pending.splice(0))await pc.addIceCandidate(candidate)}
}
function closeRtcPeersV343(){
  for(const entry of (state.video._peers||new Map()).values())try{entry.pc.close()}catch{}
  state.video._peers=new Map();state.video._remoteStreams=new Map();
}
`;
lines.push(webrtcHelpersV343);
for(let i=0;i<lines.length;i++){
  if(lines[i].startsWith('async function requestVideo(){'))lines[i]=lines[i].replace('async function requestVideo(){',"async function requestVideo(){try{const fresh=await api('/api/v1/meetings/'+encodeURIComponent(state.meeting.id));if(fresh?.data?.participants)state.meeting.participants=fresh.data.participants}catch{};");
  if(lines[i].startsWith('function attachLocalVideoPreview(){'))lines[i]=lines[i].replace('function attachLocalVideoPreview(){','function attachLocalVideoPreview(){attachRemoteVideosV343();');
  if(lines[i].startsWith('function pollSignals(){'))lines[i]="function pollSignals(){clearInterval(state.signalPoll);const tick=async()=>{if(!state.meeting?.id)return;try{const r=await api('/api/v1/meetings/'+encodeURIComponent(state.meeting.id)+'/signals?peer='+encodeURIComponent(state.meeting._peer||'')+'&since='+state.signalSince);let structural=false;for(const s of r.data||[]){state.signalSince=Math.max(state.signalSince,s.created_at||0);if(s.type==='participant-joined'){const p=s.payload||{};if(p.peer_id&&p.peer_id!==state.meeting._peer){state.meeting.participants=[...(state.meeting.participants||[]).filter(x=>x.peer_id!==p.peer_id),{...p,joined_at:new Date(s.created_at||Date.now()).toISOString()}];structural=true}}else if(s.type==='video-request'){state.video.incoming=s;structural=true}else if(s.type==='video-response'){state.video.status=s.payload?.accepted?'상대방 수락':'상대방 거절';if(s.payload?.accepted){if(!state.video._cameraStream)await enableCamera();await startRtcOfferV343(s.from)}structural=true}else if(s.type==='webrtc-offer'||s.type==='webrtc-answer'||s.type==='webrtc-ice'){try{await handleRtcSignalV343(s)}catch(e){state.video.status='화상 연결 재시도 필요'}}}if(structural&&state.view==='room')renderRoomStable(false)}catch{}};void tick();state.signalPoll=setInterval(tick,450)}";
  if(lines[i].startsWith('async function endMeeting()'))lines[i]=lines[i].replace('{','{closeRtcPeersV343();');
}


/* v3.4.6: commit browser-final speech once; server STT is fallback/mobile only. */
for(let i=0;i<lines.length;i++){
  if(!lines[i].startsWith('function startSpeech(){'))continue;
  lines[i]=lines[i].replace('function startSpeech(){startServerSpeechFallback();','function startSpeech(){');
  lines[i]=lines[i].replace("if(mobileSpeech){state.media.stt='server';state.media.sttError='';return}","if(mobileSpeech){startServerSpeechFallback();state.media.stt='server';state.media.sttError='';return}");
  lines[i]=lines[i].replace("if(!SR){state.media.stt='unsupported'","if(!SR){startServerSpeechFallback();state.media.stt='unsupported'");
  const oldResult="r.onresult=async e=>{if(generation!==state._speechGeneration)return;let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const text=e.results[i][0].transcript.trim();if(!text)continue;if(e.results[i].isFinal){state._lastBrowserPreviewAt=Date.now();state.media.stt='speaking';interim+=(interim?' ':'')+text}else{state._lastBrowserInterimAt=Date.now();state.media.stt='speaking';interim+=(interim?' ':'')+text}}if(interim)updateInterimText(interim)}";
  const newResult="r.onresult=async e=>{if(generation!==state._speechGeneration)return;let interim='';const finals=[];for(let i=e.resultIndex;i<e.results.length;i++){const text=e.results[i][0].transcript.trim();if(!text)continue;if(e.results[i].isFinal){state._lastBrowserPreviewAt=Date.now();state.media.stt='speaking';finals.push(text)}else{state._lastBrowserInterimAt=Date.now();state.media.stt='speaking';interim+=(interim?' ':'')+text}}updateInterimText(interim);for(const text of finals)await postCaption(text,'browser')}";
  if(!lines[i].includes(oldResult))throw new Error('browser_final_speech_anchor_missing');
  lines[i]=lines[i].replace(oldResult,newResult);
}

const output=lines.join('\n');
fs.writeFileSync(file,output);
if(!output.includes("const APP_VERSION='3.4.4'"))throw new Error('app_version_missing');
if(!output.includes("c.translations?.[target]||c.translation"))throw new Error('fresh_translation_precedence_missing');
if(!output.includes('data-caption-delete')||!output.includes("method:'DELETE'")||!output.includes('원문과 번역이 함께 삭제'))throw new Error('caption_delete_ui_missing');
if(!output.includes('data-original-edit')||!output.includes('data-original-save')||!output.includes('data-translation-edit')||!output.includes('data-translation-save')||!output.includes('caption-pencil'))throw new Error('caption_editors_missing');
if(!output.includes('state.media.lastAudioUrl=blob.size'))throw new Error('audio_original_missing');
if(!output.includes('class="bottom-nav cols-5 vf-global-nav"')||output.includes("if(state.view==='room'){const items="))throw new Error('global_navigation_contract_failed');
if(!output.includes('data-user-delete')||!output.includes("method:'DELETE'"))throw new Error('admin_member_delete_contract_failed');
if(!output.includes('<textarea id="chatText"'))throw new Error('chat_textarea_missing');
if(!output.includes("if(!state.media.recording){void startRecording();return}"))throw new Error('recording_retry_button_missing');
if(!output.includes('deviceSpeechTest')||!output.includes('5초 음성→텍스트·번역 테스트'))throw new Error('speech_test_ui_missing');
if(!output.includes('class="vf-chat-toolbar"')||!output.includes('class="vf-send-icon"')||!output.includes('aria-label="전송·실행"'))throw new Error('simple_chat_toolbar_contract_failed');
if(output.includes('<button id="micCheck"')||output.includes('<button id="openAiSelfTest"')||output.includes('class="vf-language-controls'))throw new Error('chat_diagnostics_controls_present');
if(!output.includes('id="settingSourceLanguage"')||!output.includes('ai-meeting-lab.html?mode=translation-selftest'))throw new Error('settings_only_controls_missing');
if(!output.includes("'x-voice-target':target")||output.includes('const row=await postCaption(text)'))throw new Error('speech_test_persistence_guard_missing');
if((output.match(/await startRecording\(\)/g)||[]).length<3)throw new Error('multi_participant_auto_microphone_missing');
if(output.includes('void checkDevices(false).catch')||!output.includes('state.captionSince=0;state.signalSince=0;state.captions=[]')||!output.includes("state.media.camera=keepVideo?'checking':'idle'"))throw new Error('guest_single_permission_caption_sync_missing');
if(!output.includes('setInterval(tick,400)')||!output.includes('setInterval(tick,450)')||!output.includes('void tick();state.signalPoll'))throw new Error('realtime_polling_latency_missing');
if(!output.includes('Math.max(0,state.captionSince-5000)')||!output.includes('function pollRoomState()')||!output.includes('vf-participant-count')||!output.includes("state.roomPoll=setInterval(tick,800)"))throw new Error('bidirectional_caption_presence_missing');
if(!output.includes('const mobileSpeech=/Android|iPhone|iPad|iPod/i')||!output.includes('function recentMeetings()')||!output.includes('data-rejoin-meeting')||!output.includes("rememberMeeting(state.meeting,'guest')"))throw new Error('mobile_single_mic_recent_meetings_missing');
if(!output.includes('captionMeetingId(id)')||!output.includes('hasOpenCaptionEditor()')||!output.includes("if(state.joinId)state.view='join'"))throw new Error('room_regression_guards_missing');
if(!output.includes('function captionVisibleKey(')||!output.includes("state.chatDraft='';e.value='';await postCaption(text)")||!output.includes('pending_translation:true'))throw new Error('stable_chat_immediate_feedback_missing');
if(!output.includes('videoBrowserCompatibility')||!output.includes('Chrome에서 열기')||!output.includes('window.isSecureContext')||!output.includes('현재 브라우저에서는 카메라 영상송출을 사용할 수 없습니다')||!output.includes('Edge에서는 화상송출이 정상 표시되지 않습니다')||!output.includes('supported:chrome&&mediaSupported'))throw new Error('video_browser_compatibility_missing');
if(!output.includes('videoTrackIsLive')||!output.includes("track.readyState==='live'")||!output.includes('카메라 연결이 종료되었습니다')||!output.includes('requestAnimationFrame(()=>attachLocalVideoPreview())'))throw new Error('video_live_track_guard_missing');
if(!output.includes('function ensureRtcPeerV343(')||!output.includes("'webrtc-offer'")||!output.includes('dataset.remotePeer'))throw new Error('webrtc_peer_media_missing');
if(!output.includes("finals.push(text)")||!output.includes("await postCaption(text,'browser')")||output.includes('function startSpeech(){startServerSpeechFallback();'))throw new Error('final_speech_single_commit_missing');
console.log('VoiceFlow planned voice-first UI v3.4.6 applied');
