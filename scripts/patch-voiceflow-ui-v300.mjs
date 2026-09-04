import fs from 'node:fs/promises';

const file=new URL('../public/app.js',import.meta.url);
let s=await fs.readFile(file,'utf8');
const must=(re,repl,label)=>{if(!re.test(s))throw new Error('patch_missing:'+label);s=s.replace(re,repl)};

must(/<div class="chat-status-row">[\s\S]*?<\/div><\/section><section id="videoPreviewPanel"/,
`<div class="chat-status-row"><span class="live-dot">● <span id="captureStatusText">\${state.media.paused?'일시정지':'녹음 중'} \${fmt(state.media.elapsed)}</span></span><span id="speechState">\${state.media.paused?'녹음이 일시정지되었습니다':state.media.recording?'듣는 중':'대기'}</span><span id="captureModeLabel">\${(state.meeting?.participants?.length||0)>1?'회의·상담':'개인 녹음'}</span><span id="vfQualityState" class="vf-quality" data-quality="checking"><span id="vfQualityLabel">입력 확인 중</span> <span class="vf-quality-bars"><i></i><i></i><i></i></span></span></div></section><section id="videoPreviewPanel"`,
'compact-live-status');

must(/<section id="liveComposer" class="chat-compose-row">[\s\S]*?<\/section><section id="liveTestRow" class="chat-test-row">/,
`<section id="liveComposer" class="chat-compose-row"><div class="record-mini"><span class="record-orb \${state.media.recording||state.media.videoRecording?'active':''}"><i></i></span><div><small>REC</small><b id="recordTime">\${fmt(state.media.elapsed)}</b></div></div><button id="pauseCapture" type="button" aria-label="\${state.media.paused?'계속 녹음':'녹음 일시정지'}">\${state.media.paused?'▶':'Ⅱ'} <span class="vf-label">\${state.media.paused?'계속':'일시정지'}</span></button><input id="chatText" placeholder="메시지 입력"><button id="inviteInline" type="button" aria-label="참여자 초대">♙+ <span class="vf-label">초대</span></button><button id="sendChat">전송</button><button id="stopCapture" class="danger">종료</button></section><section id="liveTestRow" class="chat-test-row">`,
'composer-controls');

must(/async function postCaption/,
`function toggleRecordingPause(){if(!state.meeting||!state.media.recording)return;const recorder=state.media.videoRecorder||state.media.recorder;if(!state.media.paused){state.media.paused=true;state.media.pausedAt=Date.now();try{if(recorder?.state==='recording')recorder.pause()}catch{}try{state._speech?.stop()}catch{}}else{const pausedFor=Date.now()-Number(state.media.pausedAt||Date.now());state.media.startedAt+=pausedFor;state.media.paused=false;state.media.pausedAt=0;try{if(recorder?.state==='paused')recorder.resume()}catch{}setTimeout(startSpeech,100)}render()}\nasync function postCaption`,
'pause-runtime');

must(/  \$\('#openAiSelfTest'\)\?\.addEventListener\('click',[^\n]+\);/,
match=>match+`\n  $('#pauseCapture')?.addEventListener('click',toggleRecordingPause);\n  $('#inviteInline')?.addEventListener('click',()=>window.VoiceFlowMeetingCollab?.open?.());\n  document.querySelectorAll('[data-session-panel]').forEach(b=>b.onclick=()=>{const p=b.dataset.sessionPanel;if(p==='__board')location.href='/board.html';else if(p==='__people')window.VoiceFlowMeetingCollab?.open?.();else if(p==='__more')window.VoiceFlowMeetingCollab?.open?.()});`,
'pause-invite-bind');

must(/function nav\(\)\{[\s\S]*?\}\nfunction shell/,
`function nav(){if(state.view==='room'){const items=[['room','◌','채팅'],['__board','□','자료'],['__people','♙','참여자'],['__more','•••','더보기']];return \`<nav class="bottom-nav cols-4">\${items.map(([v,i,l])=>\`<button \${v==='room'?'data-nav="room"':\`data-session-panel="\${v}"\`} class="\${v==='room'?'active':''}"><b>\${i}</b><span>\${l}</span></button>\`).join('')}</nav>\`}const items=[['home','⌂','회의 홈'],['meeting','●','회의'],['__calendar','▣','일정'],['work','✓','업무'],['__board','□','자료']];if(state.user?.role==='admin')items.push(['admin','⚙','더보기']);else items.push(['account','⋯','더보기']);return \`<nav class="bottom-nav cols-\${items.length}">\${items.map(([v,i,l])=>v.startsWith('__')?\`<button data-href="\${v==='__calendar'?'/work-calendar.html':'/board.html'}"><b>\${i}</b><span>\${l}</span></button>\`:\`<button data-nav="\${v}" class="\${state.view===v?'active':''}"><b>\${i}</b><span>\${l}</span></button>\`).join('')}</nav>\`}\nfunction shell`,
'room-nav-four');



await fs.writeFile(file,s,'utf8');
new Function(s);
await import('./patch-task-intake-v301.mjs');
console.log('VoiceFlow UI v3.0 chat focus, pause/resume, invite, four-menu navigation and AI task intake applied');
