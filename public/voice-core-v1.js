const $=selector=>document.querySelector(selector);
const state={meeting:null,peer:'core_'+crypto.randomUUID(),stream:null,recorder:null,timer:0,running:false,busy:false,captions:[],since:0,audioContext:null,analyser:null,meterTimer:0};

function status(text,kind=''){const el=$('#coreStatus');el.textContent=text;el.dataset.kind=kind}
async function request(path,options={}){const response=await fetch(path,{headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})},...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||data.error||('HTTP '+response.status));return data}
function source(){return $('#sourceLanguage').value}
function target(){return $('#targetLanguage').value}
function translationOf(row){return String(row.translation||row.translations?.[target()]||'').trim()}
function renderMessages(){
  const box=$('#messages');
  box.innerHTML=state.captions.map(row=>{const translated=translationOf(row),original=String(row.text||'').trim(),ok=translated&&translated!==original;return '<article class="message"><div class="meta"><b>'+escapeHtml(row.speaker||'나')+'</b><span>'+new Date(row.created_at||Date.now()).toLocaleTimeString()+'</span></div><p class="original">'+escapeHtml(original)+'</p><p class="translation '+(ok?'':'error')+'">'+escapeHtml(ok?translated:(row.pending_translation?'번역 처리 중':'번역 응답 없음'))+'</p></article>'}).join('')||'<div class="empty">말하거나 아래 입력창에 문장을 입력하세요.</div>';
  box.scrollTop=box.scrollHeight;
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
async function ensureMeeting(){
  if(state.meeting)return state.meeting;
  const result=await request('/api/v1/meetings',{method:'POST',body:JSON.stringify({type:'internal',title:'음성·번역 안정화 테스트',peer_id:state.peer,name:'테스트 사용자',language:source(),demo_tag:'demo-voice-core-v1'})});
  state.meeting=result.data||result;
  return state.meeting;
}
async function postCaption(text,mode){
  const clean=String(text||'').trim();if(!clean)return;
  const meeting=await ensureMeeting();
  status(mode==='speech'?'음성을 번역하는 중':'입력을 번역하는 중');
  const result=await request('/api/v1/meetings/'+encodeURIComponent(meeting.id)+'/captions',{method:'POST',body:JSON.stringify({peer_id:state.peer,speaker:'테스트 사용자',language:source(),detected_language:source(),target_language:target(),text:clean,input_mode:mode,final:true})});
  const row=result.data||result;
  const i=state.captions.findIndex(x=>x.id===row.id);if(i>=0)state.captions[i]=row;else state.captions.push(row);
  state.since=Math.max(state.since,Number(row.created_at)||0);renderMessages();
  const translated=translationOf(row);
  status(translated&&translated!==clean?'원문·번역 완료':'번역 응답을 받지 못했습니다',translated&&translated!==clean?'ok':'error');
}
async function submitAudio(blob){
  if(!blob||blob.size<900||state.busy||!state.running)return;
  state.busy=true;status('서버 음성인식 중');
  try{
    const meeting=await ensureMeeting();
    const response=await fetch('/api/v1/meetings/'+encodeURIComponent(meeting.id)+'/transcribe',{method:'POST',headers:{'content-type':blob.type||'audio/webm','x-voice-language':source(),'x-voice-target':target()},body:blob});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.detail||data.error||('HTTP '+response.status));
    const text=String(data.text||'').trim();
    if(text)await postCaption(text,'speech');else status('음성이 감지되지 않았습니다','warn');
  }catch(error){status('음성인식 실패: '+String(error.message||error),'error')}
  finally{state.busy=false}
}
function mimeType(){return ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported?.(type))||''}
function recordSegment(){
  if(!state.running||state.recorder||state.busy)return void setTimeout(recordSegment,250);
  const chunks=[],type=mimeType();
  try{state.recorder=new MediaRecorder(state.stream,type?{mimeType:type}:undefined)}catch(error){status('이 브라우저의 녹음 형식을 지원하지 않습니다','error');return stop()}
  const recorder=state.recorder;
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
  recorder.onstop=async()=>{state.recorder=null;clearTimeout(state.timer);if(!state.running)return;await submitAudio(new Blob(chunks,{type:recorder.mimeType||type||'audio/webm'}));if(state.running)setTimeout(recordSegment,180)};
  recorder.onerror=()=>status('마이크 녹음 오류','error');
  recorder.start(500);
  state.timer=setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop()},4000);
}
function startMeter(){
  try{state.audioContext=new (window.AudioContext||window.webkitAudioContext)();const src=state.audioContext.createMediaStreamSource(state.stream);state.analyser=state.audioContext.createAnalyser();state.analyser.fftSize=256;src.connect(state.analyser);const data=new Uint8Array(state.analyser.fftSize);state.meterTimer=setInterval(()=>{state.analyser.getByteTimeDomainData(data);let sum=0;for(const x of data){const v=(x-128)/128;sum+=v*v}$('#meterBar').style.width=Math.min(100,Math.round(Math.sqrt(sum/data.length)*400))+'%'},120)}catch{}
}
async function start(){
  if(state.running)return;
  try{
    status('마이크 권한 확인 중');
    await ensureMeeting();
    state.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    state.running=true;$('#startVoice').disabled=true;$('#stopVoice').disabled=false;startMeter();status('듣는 중');recordSegment();
  }catch(error){status('마이크 시작 실패: '+String(error.message||error),'error')}
}
function stop(){
  state.running=false;clearTimeout(state.timer);clearInterval(state.meterTimer);
  try{if(state.recorder&&state.recorder.state!=='inactive')state.recorder.stop()}catch{}
  state.recorder=null;state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;
  try{state.audioContext?.close()}catch{}state.audioContext=null;$('#meterBar').style.width='0';$('#startVoice').disabled=false;$('#stopVoice').disabled=true;status('중지됨');
}
async function poll(){
  if(!state.meeting)return;
  try{const result=await request('/api/v1/meetings/'+encodeURIComponent(state.meeting.id)+'/captions?target='+encodeURIComponent(target())+'&since='+Math.max(0,state.since-1000));let changed=false;for(const row of result.data||[]){state.since=Math.max(state.since,Number(row.created_at)||0);const i=state.captions.findIndex(x=>x.id===row.id);if(i>=0){state.captions[i]={...state.captions[i],...row};changed=true}else{state.captions.push(row);changed=true}}if(changed)renderMessages()}catch{}
}
$('#startVoice').addEventListener('click',start);
$('#stopVoice').addEventListener('click',stop);
$('#chatForm').addEventListener('submit',async event=>{event.preventDefault();const text=$('#chatText').value.trim();if(!text)return;$('#chatText').value='';try{await postCaption(text,'manual')}catch(error){status('번역 실패: '+String(error.message||error),'error')}});
$('#targetLanguage').addEventListener('change',()=>{state.since=0;state.captions=[];renderMessages();void poll()});
window.addEventListener('beforeunload',stop);
setInterval(poll,1200);
