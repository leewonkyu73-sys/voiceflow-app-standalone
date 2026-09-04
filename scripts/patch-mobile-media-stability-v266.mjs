import fs from 'node:fs/promises';
const file=new URL('../public/app.js',import.meta.url);
let s=await fs.readFile(file,'utf8');
function replaceFunction(name,replacement){const am=`async function ${name}(`,pm=`function ${name}(`;let start=s.indexOf(am);if(start<0)start=s.indexOf(pm);if(start<0)throw new Error(`function_missing:${name}`);const brace=s.indexOf('{',start);let depth=0,end=-1,quote='',esc=false;for(let i=brace;i<s.length;i++){const c=s[i];if(quote){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===quote)quote='';continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c==='{')depth++;else if(c==='}'){depth--;if(depth===0){end=i+1;break}}}if(end<0)throw new Error(`function_unclosed:${name}`);s=s.slice(0,start)+replacement+s.slice(end)}
replaceFunction('launchSoloSessionV264',`async function launchSoloSessionV264(kind){
  if(state._mobileStartLock)return;
  state._mobileStartLock=true;
  const type='internal',name=state.user?.name||localStorage.displayName||'Host',language=localStorage.sourceLanguage||localStorage.language||locale[state.lang]||'ko-KR',title=kind==='memo'?'Voice Memo':kind==='video'?'Video Meeting':'Voice Meeting';
  const constraints=kind==='video'?{video:{facingMode:'user'},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}:{video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}};
  let mediaPromise;
  try{mediaPromise=navigator.mediaDevices.getUserMedia(constraints)}catch(e){state._mobileStartLock=false;return}
  state.sessionNotes=[];state.sessionKind=kind;state.tapJoin=null;state.meeting={id:null,type,title,status:'creating',participants:[{name,role:'host'}],language,meeting_mode:kind==='video'?'video':'voice',_creating:true};state.view='room';state.captions=[];state.media.elapsed=0;state.media.recording=false;state.media.videoRecording=false;state.media.originalStorage='pending';
  render();
  try{
    const stream=await withTimeout(mediaPromise,8000,kind==='video'?'video_capture_timeout':'audio_capture_timeout');
    if(kind==='video')mobileAttachVideoV266(stream);else mobileAttachAudioV266(stream);
    state._mobileStartLock=false;
    setTimeout(()=>{void mobileServerSyncV266({type,title,name,language,kind})},80);
  }catch(e){
    state._mobileStartLock=false;state.media.recording=false;state.media.videoRecording=false;state.media.mic='error';if(kind==='video')state.media.camera='error';
    const sync=document.querySelector('#meetingSyncState');if(sync)sync.textContent='마이크/카메라 권한을 확인해주세요';
    const h=document.querySelector('.record-panel h2');if(h)h.textContent='시작 실패';
  }
}`);
const inject=`
async function uploadOriginalMediaV267(blob,kind){
  try{
    let mid=state.meeting?.id||'';
    for(let i=0;!mid&&i<40;i++){await new Promise(r=>setTimeout(r,250));mid=state.meeting?.id||''}
    if(!mid){state.media.originalStorage='waiting-for-meeting-id';return null}
    const mime=blob.type||(kind==='video'?'video/webm':'audio/webm');
    const name='original-'+kind+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.webm';
    const r=await fetch('/api/v1/meeting-media/'+encodeURIComponent(mid)+'?kind='+encodeURIComponent(kind),{method:'POST',headers:{'content-type':mime,'x-file-name':name,'x-media-kind':kind},body:blob,credentials:'same-origin'});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('media_upload_'+r.status));state.media.originalStorage=d.data?.storage||'saved';state.media.originalStorageInfo=d.data||{};return d.data||null;
  }catch(e){state.media.originalStorage='upload-error';state.media.originalStorageError=e.message;return null}
}
function mobileAttachAudioV266(stream){state.media.stream=stream;state.media.mic='ok';state.media.recording=true;state.media.videoRecording=false;state.media.startedAt=Date.now();state.media.elapsed=0;clearInterval(state.media.timer);state.media.timer=setInterval(()=>{state.media.elapsed=Math.floor((Date.now()-state.media.startedAt)/1000);const e=document.querySelector('#recordTime');if(e)e.textContent=fmt(state.media.elapsed)},500);if(window.MediaRecorder){const chunks=[];const mr=new MediaRecorder(stream);state.media.audioRecorder=mr;mr.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};mr.onstop=()=>{if(chunks.length){const blob=new Blob(chunks,{type:chunks[0]?.type||'audio/webm'});state.media.lastAudioUrl=URL.createObjectURL(blob);state.media.originalUploadPromise=uploadOriginalMediaV267(blob,'audio')}};mr.start(1000)}mobileCaptureUiV266(state.sessionKind==='memo'?'음성메모 녹음 중':'음성 녹음 중')}
function mobileAttachVideoV266(stream){state.video._cameraStream=stream;state.media.stream=stream;state.media.mic='ok';state.media.camera='ok';state.media.videoRecording=true;state.media.recording=true;state.media.startedAt=Date.now();state.media.elapsed=0;const vp=document.querySelector('#localVideoPreview');if(vp){vp.srcObject=stream;vp.play?.().catch(()=>{})}document.querySelector('#videoPreviewPanel')?.classList.add('show');clearInterval(state.media.timer);state.media.timer=setInterval(()=>{state.media.elapsed=Math.floor((Date.now()-state.media.startedAt)/1000);const e=document.querySelector('#recordTime');if(e)e.textContent=fmt(state.media.elapsed)},500);if(window.MediaRecorder){const chunks=[];const mr=new MediaRecorder(stream);state.media.videoRecorder=mr;mr.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};mr.onstop=()=>{if(chunks.length){const blob=new Blob(chunks,{type:chunks[0]?.type||'video/webm'});state.media.lastVideoUrl=URL.createObjectURL(blob);state.media.originalUploadPromise=uploadOriginalMediaV267(blob,'video')}};mr.start(1000)}mobileCaptureUiV266('영상 녹화 중')}
function mobileCaptureUiV266(label){const h=document.querySelector('.record-panel h2');if(h)h.textContent=label;const badge=document.querySelector('.live-badge');if(badge)badge.innerHTML='<span></span>'+label;document.querySelector('.record-orb')?.classList.add('active');const sync=document.querySelector('#meetingSyncState');if(sync)sync.textContent='녹음 시작됨 · 서버 연결 중'}
async function mobileServerSyncV266({type,title,name,language,kind}){try{const peer='peer_'+crypto.randomUUID().slice(0,8);const created=await withTimeout(api('/api/v1/meetings',{method:'POST',body:JSON.stringify({type,title,peer_id:peer,name,language,meeting_mode:kind==='video'?'video':'voice'})}),8000,'meeting_create_timeout');if(!state.meeting)return;state.meeting={...(created.data||{}),_peer:peer,language,meeting_mode:kind==='video'?'video':'voice',_creating:false};const sync=document.querySelector('#meetingSyncState');if(sync)sync.textContent='연결됨 · 혼자 사용 가능';setTimeout(()=>{try{pollCaptions()}catch{}try{pollSignals()}catch{}},200);setTimeout(()=>{try{startSpeech()}catch{}},450);if(kind!=='memo')setTimeout(async()=>{await activateTapJoinV264(state.meeting);const t=document.querySelector('#tapJoinState');if(t)t.textContent=state.tapJoin?.active?'Nearby · NFC 참가 활성':'TapJoin 연결 확인 필요'},700)}catch(e){if(state.meeting){state.meeting={...state.meeting,_creating:false,_createError:e.message};const sync=document.querySelector('#meetingSyncState');if(sync)sync.textContent='녹음 중 · 서버 연결 확인 필요'}}}
`;
if(!s.includes('function mobileAttachAudioV266(')){const anchor=s.indexOf('const withTimeout=');if(anchor<0)throw new Error('withTimeout_anchor_missing');s=s.slice(0,anchor)+inject+s.slice(anchor)}
s += `\nwindow.__VOICEFLOW_MOBILE_MEDIA__='stable-v266';\nwindow.__VOICEFLOW_ORIGINAL_MEDIA__='drive-v267';\n`;
await fs.writeFile(file,s,'utf8');
console.log('Mobile media stability v2.6.7 + original persistent storage applied');
