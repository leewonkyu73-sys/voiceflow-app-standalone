import {CAPTION_STATUS} from '/v4/local-stt-test/modules/meeting-contracts/index.mjs';
import {createMeetingApiAdapter} from '/v4/local-stt-test/modules/meeting-api-adapter/index.mjs';
import {createMobileCaptionSession} from '/v4/local-stt-test/modules/mobile-caption-session/index.mjs';
import {
  LOCAL_WHISPER_PACK,
  MOBILE_INPUT_MODE,
  assessMobileInputPolicy,
  chooseSafeMobileInputMode,
} from '/v4/local-stt-test/modules/mobile-input-policy/index.mjs';
import {LOCAL_WHISPER_STATE,createLocalWhisperClient} from '/v4/local-stt-test/modules/mobile-local-whisper/index.mjs';
import {MOBILE_MEDIA_STATE,createMobileMediaSession} from '/v4/local-stt-test/modules/mobile-media-session/index.mjs';
import {
  MOBILE_SPEECH_STATE,
  createMobileSpeechSession,
  createMobileTranscriptionAdapter,
} from '/v4/local-stt-test/modules/mobile-speech-session/index.mjs';
import {
  MOBILE_BROWSER_SPEECH_STATE,
  createMobileBrowserSpeechSession,
  prepareOnDeviceBrowserSpeech,
  supportsGoldenBrowserSpeech,
} from '/v4/local-stt-test/modules/mobile-browser-speech-session/index.mjs';

const MODE_STORAGE_KEY='voiceflow.mobileInputMode.v1';
const SERVER_CONSENT_KEY='voiceflow.serverSpeechConsent.v1';
const CLIENT_ID='v4-local-stt-test';
const byId=id=>document.getElementById(id);
let meetingId=new URL(location.href).searchParams.get('meeting')||'';
const BrowserSpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const AudioContextConstructor=window.AudioContext||window.webkitAudioContext;
const standalone=navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true;
const isiOS=/iPad|iPhone|iPod/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&Number(navigator.maxTouchPoints)>1;

const elements=Object.freeze({
  gate:byId('consentGate'),app:byId('meetingApp'),registration:byId('registrationForm'),loginPanel:document.querySelector('.login-panel'),login:byId('loginForm'),authStatus:byId('authStatus'),
  installPwa:byId('installPwa'),capabilitySummary:byId('capabilitySummary'),recommendation:byId('recommendation'),inputModes:byId('inputModes'),
  modelPanel:byId('modelPanel'),modelProgress:byId('modelProgress'),modelStatus:byId('modelStatus'),installModel:byId('installModel'),removeModel:byId('removeModel'),
  serverConsent:byId('serverConsent'),serverConsentRow:byId('serverConsentRow'),sourceLanguage:byId('sourceLanguage'),targetLanguage:byId('targetLanguage'),
  mediaStatus:byId('mediaStatus'),startMicrophone:byId('startMicrophone'),stopMicrophone:byId('stopMicrophone'),speechStatus:byId('speechStatus'),
  startSpeech:byId('startSpeech'),finishSpeech:byId('finishSpeech'),status:byId('status'),captions:byId('captions'),form:byId('composer'),
  input:byId('captionText'),sendButton:byId('sendCaption'),
});

let authenticated=false;
let installPrompt=null;
let captionSession=null;
let assessment=null;
let activeMode=MOBILE_INPUT_MODE.TEXT;
let mediaSession=null;
let speechSession=null;
let speechUnsubscribe=null;
let browserMicrophoneReady=false;

function safeStorage(storage,action,key,value=''){
  try{
    if(action==='get')return storage.getItem(key)||'';
    if(action==='set')storage.setItem(key,value);
    if(action==='remove')storage.removeItem(key);
  }catch{}
  return '';
}

function setAuthStatus(message,kind=''){
  elements.authStatus.textContent=message;
  elements.authStatus.dataset.kind=kind;
}

function showExistingLogin(email){
  const loginEmail=elements.login.elements.namedItem('email');
  const loginPassword=elements.login.elements.namedItem('password');
  elements.loginPanel.open=true;
  if(loginEmail)loginEmail.value=email;
  setAuthStatus('이미 가입된 이메일입니다. 비밀번호를 입력해 로그인해 주세요.','error');
  elements.loginPanel.scrollIntoView?.({behavior:'smooth',block:'center'});
  loginPassword?.focus?.({preventScroll:true});
}

function setStatus(message,kind=''){
  elements.status.textContent=message;
  elements.status.dataset.kind=kind;
}

function addText(parent,tag,className,text){
  const node=document.createElement(tag);
  node.className=className;
  node.textContent=text;
  parent.append(node);
  return node;
}

async function responseJson(response){
  let payload={};
  try{payload=await response.json()}catch{}
  if(!response.ok)throw new Error(String(payload.error||`http_${response.status}`));
  return payload;
}

async function authRequest(url,body){
  return responseJson(await fetch(url,{
    method:'POST',
    credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  }));
}

function updateInstallButton(){
  elements.installPwa.hidden=!authenticated||standalone||(!installPrompt&&!isiOS);
  elements.installPwa.textContent=installPrompt?'앱 설치':isiOS?'iPhone 설치 방법':'앱 설치';
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  updateInstallButton();
});

window.addEventListener('appinstalled',()=>{
  installPrompt=null;
  updateInstallButton();
  setStatus('앱 설치 완료','ok');
});

elements.installPwa.addEventListener('click',async()=>{
  if(!authenticated||standalone)return;
  if(!installPrompt&&isiOS){
    setStatus('iPhone Safari: 공유 버튼(□↑) → 홈 화면에 추가 → 추가를 누르세요. 설치 후 다시 열어도 가입 확인이 유지됩니다.','ok');
    elements.status.scrollIntoView?.({behavior:'smooth',block:'center'});
    return;
  }
  if(!installPrompt)return;
  const prompt=installPrompt;
  installPrompt=null;
  updateInstallButton();
  await prompt.prompt();
  const choice=await prompt.userChoice;
  setStatus(choice?.outcome==='accepted'?'앱 설치를 시작했습니다.':'앱 설치를 취소했습니다.',choice?.outcome==='accepted'?'ok':'warn');
});

function candidateTransport(url,options={}){
  const headers=new Headers(options.headers||{});
  headers.set('x-voice-client',CLIENT_ID);
  return fetch(url,{credentials:'same-origin',...options,headers});
}

function mixAndResample(buffer,targetRate=16000){
  const channels=Math.max(1,buffer.numberOfChannels||1);
  const mixed=new Float32Array(buffer.length);
  for(let channel=0;channel<channels;channel+=1){
    const samples=buffer.getChannelData(channel);
    for(let index=0;index<samples.length;index+=1)mixed[index]+=samples[index]/channels;
  }
  if(buffer.sampleRate===targetRate)return mixed;
  const targetLength=Math.max(1,Math.round(mixed.length*targetRate/buffer.sampleRate));
  const output=new Float32Array(targetLength);
  const ratio=buffer.sampleRate/targetRate;
  for(let index=0;index<targetLength;index+=1){
    const position=index*ratio;
    const left=Math.floor(position);
    const right=Math.min(mixed.length-1,left+1);
    const fraction=position-left;
    output[index]=mixed[left]*(1-fraction)+mixed[right]*fraction;
  }
  return output;
}

async function decodeAudioBlob(blob){
  if(!AudioContextConstructor)throw new Error('audio_decoder_unavailable');
  const context=new AudioContextConstructor({sampleRate:16000});
  try{
    const bytes=await blob.arrayBuffer();
    const decoded=await context.decodeAudioData(bytes.slice(0));
    return mixAndResample(decoded,16000);
  }finally{
    await context.close?.();
  }
}

async function deleteModelCache(key){
  if(!globalThis.caches)return false;
  const names=await caches.keys();
  const targets=names.filter(name=>name===key||name.startsWith(`${key}-`));
  const results=await Promise.all(targets.map(name=>caches.delete(name)));
  return results.some(Boolean);
}

const localWhisper=createLocalWhisperClient({
  createWorker:()=>new Worker('/v4/local-stt-test/local-whisper-worker.mjs',{type:'module',name:'voiceflow-local-whisper'}),
  decodeAudio:decodeAudioBlob,
  requestPersistentStorage:()=>navigator.storage?.persist?.()??Promise.resolve(false),
  deleteCache:deleteModelCache,
});

function localModelErrorMessage(error){
  const detail=String(error?.message||error||'');
  if(/could not locate file|404|not found/i.test(detail))return '모델 파일을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.';
  if(/quota|storage|space/i.test(detail))return '저장 공간이 부족합니다. 공간을 확보한 뒤 다시 시도해 주세요.';
  if(/network|fetch|load failed|internet/i.test(detail))return '네트워크 연결을 확인하고 Wi-Fi에서 다시 시도해 주세요.';
  return '모델 준비에 실패했습니다. Wi-Fi와 저장 공간을 확인한 뒤 다시 시도해 주세요.';
}

function renderModel(snapshot){
  elements.modelProgress.value=Math.round(snapshot.progress||0);
  elements.installModel.disabled=[LOCAL_WHISPER_STATE.DOWNLOADING,LOCAL_WHISPER_STATE.TRANSCRIBING].includes(snapshot.state);
  elements.removeModel.disabled=snapshot.state===LOCAL_WHISPER_STATE.ABSENT||snapshot.state===LOCAL_WHISPER_STATE.DOWNLOADING;
  const messages={
    [LOCAL_WHISPER_STATE.ABSENT]:'모델을 다운로드하면 음성 원본을 서버에 보내지 않고 인식합니다.',
    [LOCAL_WHISPER_STATE.DOWNLOADING]:`모델 다운로드·준비 중 ${Math.round(snapshot.progress||0)}% · 화면을 닫지 마세요.`,
    [LOCAL_WHISPER_STATE.READY]:'Whisper Small 고품질 모델 준비 완료 · 음성은 휴대폰 안에서 처리됩니다.',
    [LOCAL_WHISPER_STATE.TRANSCRIBING]:'휴대폰에서 음성을 인식하고 있습니다.',
    [LOCAL_WHISPER_STATE.ERROR]:`로컬 모델 오류: ${localModelErrorMessage(snapshot.error)}`,
    [LOCAL_WHISPER_STATE.STOPPED]:'로컬 모델 세션이 종료되었습니다.',
  };
  elements.modelStatus.textContent=messages[snapshot.state]||'모델 상태 확인 필요';
  updateAudioActions();
}
localWhisper.subscribe(renderModel);

function selectedRadio(){
  return elements.inputModes.querySelector('input[name="inputMode"]:checked')?.value||MOBILE_INPUT_MODE.TEXT;
}

function selectRadio(value){
  const input=elements.inputModes.querySelector(`input[name="inputMode"][value="${value}"]`);
  if(input)input.checked=true;
}

function stopAudioSessions(reason='mode_changed'){
  if(speechSession){
    const state=speechSession.getSnapshot?.().state;
    if(state===MOBILE_BROWSER_SPEECH_STATE.LISTENING)speechSession.cancelListening?.(reason);
    if(state===MOBILE_SPEECH_STATE.RECORDING)speechSession.cancelCapture?.(reason);
    speechSession.stop?.();
  }
  speechUnsubscribe?.();
  speechUnsubscribe=null;
  speechSession=null;
  mediaSession?.stop?.();
  mediaSession=null;
  browserMicrophoneReady=false;
}

function updateAudioActions(){
  if(!assessment)return;
  const text=activeMode===MOBILE_INPUT_MODE.TEXT;
  const localBlocked=activeMode===MOBILE_INPUT_MODE.LOCAL_MODEL&&localWhisper.getSnapshot().state!==LOCAL_WHISPER_STATE.READY;
  const serverBlocked=activeMode===MOBILE_INPUT_MODE.SERVER&&!assessment.modes.server.activatable;
  const modeBlocked=!assessment.modes[activeMode]?.activatable;
  const connected=browserMicrophoneReady||[MOBILE_MEDIA_STATE.ACTIVE,MOBILE_MEDIA_STATE.SUSPENDED].includes(mediaSession?.getSnapshot?.().state);
  const speechState=speechSession?.getSnapshot?.().state||'';
  const busy=[
    MOBILE_BROWSER_SPEECH_STATE.PREPARING,MOBILE_BROWSER_SPEECH_STATE.LISTENING,MOBILE_BROWSER_SPEECH_STATE.COMMITTING,
    MOBILE_SPEECH_STATE.RECORDING,MOBILE_SPEECH_STATE.TRANSCRIBING,MOBILE_SPEECH_STATE.COMMITTING,
  ].includes(speechState);
  elements.startMicrophone.disabled=text||localBlocked||serverBlocked||modeBlocked||connected||busy;
  elements.stopMicrophone.disabled=!connected;
  elements.startSpeech.disabled=text||!connected||busy;
  elements.finishSpeech.disabled=![MOBILE_BROWSER_SPEECH_STATE.LISTENING,MOBILE_SPEECH_STATE.RECORDING].includes(speechState);
}

function modeLabel(mode){
  return ({
    [MOBILE_INPUT_MODE.LOCAL_MODEL]:'다운로드 모델',
    [MOBILE_INPUT_MODE.BROWSER]:'기존 브라우저 인식',
    [MOBILE_INPUT_MODE.SERVER]:'서버 인식',
    [MOBILE_INPUT_MODE.TEXT]:'텍스트 전용',
  })[mode]||'텍스트 전용';
}

function renderPolicy(){
  if(!assessment)return;
  for(const input of elements.inputModes.querySelectorAll('input[name="inputMode"]')){
    const details=assessment.modes[input.value];
    input.disabled=!details?.available;
    input.closest('label').title=details?.reason||'';
  }
  const {capabilities}=assessment;
  const storage=assessment.freeBytes===null?'저장공간 미확인':`여유 ${Math.max(0,assessment.freeBytes/1024/1024).toFixed(0)}MB`;
  elements.capabilitySummary.textContent=`WebGPU ${capabilities.webgpu?'가능':'불가'} · 메모리 ${capabilities.deviceMemory??'미확인'}GB · CPU ${capabilities.hardwareConcurrency??'미확인'}코어 · ${storage}`;
  elements.recommendation.textContent=`권장: ${modeLabel(assessment.recommended)}`;
  elements.modelPanel.hidden=activeMode!==MOBILE_INPUT_MODE.LOCAL_MODEL;
  elements.serverConsentRow.hidden=!assessment.modes.server.available;
  updateAudioActions();
}

async function readAssessment(){
  let storage={};
  try{storage=await navigator.storage?.estimate?.()||{}}catch{}
  const serverConsent=safeStorage(sessionStorage,'get',SERVER_CONSENT_KEY)==='yes';
  assessment=assessMobileInputPolicy({
    webgpu:Boolean(navigator.gpu),
    mediaRecorder:typeof window.MediaRecorder==='function',
    audioDecoder:typeof AudioContextConstructor==='function',
    browserSpeech:supportsGoldenBrowserSpeech({userAgent:navigator.userAgent,recognitionConstructor:BrowserSpeechRecognition}),
    online:navigator.onLine,
    deviceMemory:navigator.deviceMemory,
    hardwareConcurrency:navigator.hardwareConcurrency,
    storageQuota:storage.quota,
    storageUsage:storage.usage,
    serverConsent,
  });
  elements.serverConsent.checked=serverConsent;
  return assessment;
}

function applyMode(requested,{announce=true}={}){
  if(!assessment)return;
  stopAudioSessions();
  const safeMode=chooseSafeMobileInputMode(requested,assessment);
  activeMode=safeMode;
  selectRadio(safeMode);
  safeStorage(localStorage,'set',MODE_STORAGE_KEY,safeMode);
  renderPolicy();
  if(safeMode!==requested){
    const reason=requested===MOBILE_INPUT_MODE.SERVER?'서버 음성인식 동의가 없어 텍스트 전용으로 유지합니다.':'이 휴대폰의 성능·기능 제약으로 텍스트 전용을 선택했습니다.';
    elements.mediaStatus.textContent=reason;
    elements.mediaStatus.dataset.state='unsupported';
  }else{
    const messages={
      [MOBILE_INPUT_MODE.LOCAL_MODEL]:'모델 준비 후 마이크를 연결하세요. 음성은 서버로 보내지 않습니다.',
      [MOBILE_INPUT_MODE.BROWSER]:'Chrome 기기 내 음성팩을 사용합니다. 음성은 서버로 보내지 않습니다.',
      [MOBILE_INPUT_MODE.SERVER]:'이번 세션의 동의가 확인되었습니다. 음성 조각을 서버로 전송합니다.',
      [MOBILE_INPUT_MODE.TEXT]:'텍스트 입력만 사용합니다. 번역·저장·회의정리는 그대로 유지됩니다.',
    };
    elements.mediaStatus.textContent=messages[safeMode];
    elements.mediaStatus.dataset.state=safeMode===MOBILE_INPUT_MODE.TEXT?'idle':'active';
  }
  elements.speechStatus.textContent=activeMode===MOBILE_INPUT_MODE.TEXT?'마이크가 꺼져 있습니다. 아래 입력창을 사용하세요.':'마이크 연결 후 음성 원문 시작을 누르세요.';
  elements.speechStatus.dataset.state='idle';
  if(announce)setStatus(`${modeLabel(activeMode)} 방식으로 변경했습니다.`,'ok');
  updateAudioActions();
}

function renderSpeech(snapshot){
  const messages={
    idle:'음성 원문 시작을 누르세요.',preparing:'기기 내 음성팩을 확인하고 있습니다.',listening:'듣는 중 · 여러 문장을 말한 뒤 말하기 완료를 누르세요.',
    recording:'녹음 중 · 약 6초 후 자동 입력됩니다. 바로 끝내려면 말하기 완료를 누르세요.',transcribing:activeMode===MOBILE_INPUT_MODE.LOCAL_MODEL?'휴대폰에서 인식 중입니다.':'서버에서 인식 중입니다.',
    committing:'원문 저장·번역 중입니다.',completed:`인식·번역 완료${snapshot.lastText?` · ${snapshot.lastText}`:''}`,recoverable_error:`다시 시도할 수 있습니다 · ${snapshot.error||'인식 실패'}`,
    fatal_error:`마이크 또는 음성인식을 사용할 수 없습니다 · ${snapshot.error||''}`,stopped:'음성 세션 종료됨',
  };
  elements.speechStatus.textContent=messages[snapshot.state]||'음성 상태 확인 필요';
  elements.speechStatus.dataset.state=snapshot.state||'idle';
  updateAudioActions();
}

function recorderFactory(stream){
  const candidates=['audio/webm;codecs=opus','audio/mp4;codecs=mp4a.40.2','audio/mp4'];
  const mimeType=candidates.find(type=>MediaRecorder.isTypeSupported?.(type));
  return mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
}

function createRecordedSpeechSession(){
  const adapter=activeMode===MOBILE_INPUT_MODE.SERVER
    ?createMobileTranscriptionAdapter({transport:candidateTransport,client:CLIENT_ID,audioConsent:'session'})
    :null;
  speechSession=createMobileSpeechSession({
    meetingId,
    mediaSession,
    captionSession,
    transcribe:activeMode===MOBILE_INPUT_MODE.LOCAL_MODEL
      ?options=>localWhisper.transcribe(options)
      :options=>adapter.transcribe(options),
    createRecorder:recorderFactory,
    createAudioBlob:(parts,options)=>new Blob(parts,options),
  });
  speechUnsubscribe=speechSession.subscribe(renderSpeech);
}

function createBrowserSession(){
  speechSession=createMobileBrowserSpeechSession({
    meetingId,
    captionSession,
    createRecognition:()=>new BrowserSpeechRecognition(),
    prepareRecognition:(recognition,options)=>prepareOnDeviceBrowserSpeech({
      recognitionConstructor:BrowserSpeechRecognition,
      recognition,
      language:options.sourceLanguage,
      qualities:['conversation','dictation'],
    }),
  });
  speechUnsubscribe=speechSession.subscribe(renderSpeech);
}

elements.inputModes.addEventListener('change',event=>{
  const requested=event.target?.value;
  if(Object.values(MOBILE_INPUT_MODE).includes(requested))applyMode(requested);
});

elements.serverConsent.addEventListener('change',async()=>{
  if(elements.serverConsent.checked)safeStorage(sessionStorage,'set',SERVER_CONSENT_KEY,'yes');
  else safeStorage(sessionStorage,'remove',SERVER_CONSENT_KEY);
  await readAssessment();
  if(!elements.serverConsent.checked&&activeMode===MOBILE_INPUT_MODE.SERVER)applyMode(MOBILE_INPUT_MODE.TEXT);
  else renderPolicy();
  setStatus(elements.serverConsent.checked?'이번 세션의 서버 음성인식 동의를 확인했습니다.':'서버 음성인식 동의를 해제했습니다.',elements.serverConsent.checked?'ok':'warn');
});

elements.installModel.addEventListener('click',async()=>{
  elements.installModel.disabled=true;
  try{
    await localWhisper.install();
    setStatus('다운로드 모델 준비 완료','ok');
  }catch(error){
    console.error('local_whisper_install_failed',error);
    setStatus(`모델 준비 실패 · ${localModelErrorMessage(error)}`,'error');
  }finally{
    renderModel(localWhisper.getSnapshot());
  }
});

elements.removeModel.addEventListener('click',async()=>{
  stopAudioSessions('model_removed');
  await localWhisper.remove();
  setStatus('휴대폰에서 다운로드 모델 캐시를 삭제했습니다.','ok');
});

elements.startMicrophone.addEventListener('click',async()=>{
  if(!captionSession||activeMode===MOBILE_INPUT_MODE.TEXT)return;
  stopAudioSessions('microphone_reconnect');
  try{
    if(activeMode===MOBILE_INPUT_MODE.BROWSER){
      browserMicrophoneReady=true;
      createBrowserSession();
      elements.mediaStatus.textContent='브라우저 기기 내 음성인식 준비 완료';
    }else{
      mediaSession=createMobileMediaSession({requestStream:constraints=>navigator.mediaDevices.getUserMedia(constraints)});
      mediaSession.subscribe(snapshot=>{
        if(snapshot.error)elements.mediaStatus.textContent=`마이크 오류 · ${snapshot.error}`;
        updateAudioActions();
      });
      await mediaSession.start();
      createRecordedSpeechSession();
      elements.mediaStatus.textContent=activeMode===MOBILE_INPUT_MODE.LOCAL_MODEL?'마이크 연결 완료 · 음성은 휴대폰 안에서 처리':'마이크 연결 완료 · 완료 시 음성 조각을 서버로 전송';
    }
    elements.mediaStatus.dataset.state='active';
  }catch(error){
    elements.mediaStatus.textContent=`마이크 연결 실패 · ${String(error?.name||error?.message||error)}`;
    elements.mediaStatus.dataset.state='error';
  }
  updateAudioActions();
});

elements.stopMicrophone.addEventListener('click',()=>{
  stopAudioSessions('microphone_stopped');
  elements.mediaStatus.textContent='마이크를 중지했습니다. 자동으로 다시 켜지지 않습니다.';
  elements.mediaStatus.dataset.state='idle';
  updateAudioActions();
});

elements.startSpeech.addEventListener('click',async()=>{
  if(!speechSession)return;
  const options={sourceLanguage:elements.sourceLanguage.value,targetLanguage:elements.targetLanguage.value};
  try{
    if(activeMode===MOBILE_INPUT_MODE.BROWSER)await speechSession.startListening(options);
    else speechSession.startCapture(options);
  }catch{renderSpeech(speechSession.getSnapshot())}
});

elements.finishSpeech.addEventListener('click',async()=>{
  if(!speechSession)return;
  elements.finishSpeech.disabled=true;
  try{
    if(activeMode===MOBILE_INPUT_MODE.BROWSER)speechSession.finishListening();
    else await speechSession.finishCapture();
  }catch{renderSpeech(speechSession.getSnapshot())}
});

function renderCaptions(snapshot){
  elements.captions.replaceChildren();
  if(!snapshot.items.length){
    addText(elements.captions,'p','empty','원문을 입력하면 저장 전에 즉시 표시됩니다.');
    return;
  }
  for(const item of snapshot.items){
    const card=document.createElement('article');
    card.className='caption-card';
    card.dataset.status=item.status;
    addText(card,'p','original',item.text);
    const translated=String(item.translations?.[elements.targetLanguage.value]||'').trim();
    addText(card,'p',translated?'translation':'translation muted',translated||(item.pending_translation||item.status===CAPTION_STATUS.PENDING?'번역 처리 중':'번역 없음'));
    if(item.status===CAPTION_STATUS.FAILED){
      const retry=document.createElement('button');
      retry.type='button';
      retry.className='retry';
      retry.textContent='다시 저장';
      retry.addEventListener('click',async()=>{
        retry.disabled=true;
        try{await captionSession.retry(item.clientId);setStatus('원문 저장 완료','ok')}catch{retry.disabled=false;setStatus('저장 실패 · 원문은 보존됩니다.','error')}
      });
      card.append(retry);
    }
    elements.captions.append(card);
  }
  elements.captions.scrollTop=elements.captions.scrollHeight;
}

elements.form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!captionSession)return;
  const text=elements.input.value.trim();
  if(!text)return;
  elements.sendButton.disabled=true;
  try{
    await captionSession.submit(text,{sourceLanguage:elements.sourceLanguage.value,targetLanguage:elements.targetLanguage.value});
    if(elements.input.value.trim()===text)elements.input.value='';
    setStatus('원문 저장·번역 완료','ok');
  }catch{
    setStatus('저장하지 못했습니다. 원문과 입력 내용은 보존됩니다.','error');
  }finally{elements.sendButton.disabled=false}
});

elements.targetLanguage.addEventListener('change',()=>{
  void captionSession?.reconnect({targetLanguage:elements.targetLanguage.value}).catch(()=>setStatus('번역 동기화 실패 · 원문은 유지됩니다.','warn'));
});

document.addEventListener('visibilitychange',()=>{
  mediaSession?.setVisibility?.(document.visibilityState);
  if(document.visibilityState==='hidden'&&speechSession?.getSnapshot?.().state===MOBILE_BROWSER_SPEECH_STATE.LISTENING){
    speechSession.cancelListening?.('page_hidden');
  }
});

window.addEventListener('online',()=>void refreshPolicy());
window.addEventListener('offline',()=>void refreshPolicy());
window.addEventListener('beforeunload',()=>{stopAudioSessions('page_closed');localWhisper.stop()},{once:true});

async function refreshPolicy(){
  await readAssessment();
  const requested=activeMode||safeStorage(localStorage,'get',MODE_STORAGE_KEY)||assessment.recommended;
  applyMode(requested,{announce:false});
}

async function initializeMeeting(){
  if(!/^mtg_[A-Za-z0-9_]+$/.test(meetingId)){
    const created=await responseJson(await candidateTransport('/api/v1/meetings',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({title:'VoiceFlow 휴대폰 음성메모',type:'internal'}),
    }));
    meetingId=String(created.data?.id||'');
    if(!/^mtg_[A-Za-z0-9_]+$/.test(meetingId))throw new Error('meeting_creation_failed');
    const nextUrl=new URL(location.href);
    nextUrl.searchParams.set('meeting',meetingId);
    history.replaceState(null,'',nextUrl);
  }
  const api=createMeetingApiAdapter({transport:candidateTransport});
  captionSession=createMobileCaptionSession({meetingId,api});
  captionSession.subscribe(renderCaptions);
  await readAssessment();
  const saved=safeStorage(localStorage,'get',MODE_STORAGE_KEY);
  applyMode(saved||assessment.recommended,{announce:false});
  setStatus('원문 입력 준비 완료','ok');
  void captionSession.reconnect({targetLanguage:elements.targetLanguage.value}).catch(()=>setStatus('재접속 동기화 실패 · 새 원문은 입력할 수 있습니다.','warn'));
}

async function revealMeeting(user){
  authenticated=true;
  elements.gate.hidden=true;
  elements.app.hidden=false;
  updateInstallButton();
  setAuthStatus(`${user?.name||'사용자'} 님의 가입·동의를 확인했습니다.`,'ok');
  try{
    await initializeMeeting();
    if('serviceWorker'in navigator)void navigator.serviceWorker.register('/v4/local-stt-test/local-sw.js',{scope:'/v4/local-stt-test/',updateViaCache:'none'}).catch(()=>{});
  }catch(error){
    elements.form.inert=true;
    elements.sendButton.disabled=true;
    setStatus(error?.message==='invalid_meeting_id'?'유효한 초대 회의 링크가 필요합니다.':`회의 연결 실패 · ${String(error?.message||error)}`,'error');
  }
}

elements.registration.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(elements.registration);
  const termsAccepted=data.get('termsAccepted')==='on';
  const privacyAccepted=data.get('privacyAccepted')==='on';
  const email=String(data.get('email')||'').trim();
  if(!termsAccepted||!privacyAccepted){setAuthStatus('필수 약관에 모두 동의해 주세요.','error');return}
  setAuthStatus('가입·동의를 저장하고 있습니다.');
  try{
    const payload=await authRequest('/api/v1/auth/register',{
      name:String(data.get('name')||'').trim(),
      email,
      password:String(data.get('password')||''),
      termsAccepted,
      privacyAccepted,
      marketingAccepted:data.get('marketingAccepted')==='on',
    });
    await revealMeeting(payload.user);
  }catch(error){
    if(error?.message==='email_exists'){showExistingLogin(email);return}
    setAuthStatus(`가입 실패 · ${String(error?.message||error)}`,'error');
  }
});

elements.login.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(elements.login);
  setAuthStatus('로그인하고 있습니다.');
  try{
    const payload=await authRequest('/api/v1/auth/login',{email:String(data.get('email')||'').trim(),password:String(data.get('password')||'')});
    await revealMeeting(payload.user);
  }catch(error){setAuthStatus(error?.message==='invalid_login'?'이메일 또는 비밀번호가 맞지 않습니다.':`로그인 실패 · ${String(error?.message||error)}`,'error')}
});

async function checkMembership(){
  try{
    const payload=await responseJson(await fetch('/api/v1/auth/me',{credentials:'same-origin',headers:{'x-voice-client':CLIENT_ID}}));
    if(payload.user){await revealMeeting(payload.user);return}
    setAuthStatus('초대 참여 또는 앱 설치 전에 가입과 필수 동의가 필요합니다.');
  }catch{setAuthStatus('가입 상태를 확인하지 못했습니다. 다시 시도하거나 가입해 주세요.','error')}
}

void checkMembership();
