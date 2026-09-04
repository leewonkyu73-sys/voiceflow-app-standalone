import {CAPTION_STATUS} from '/v4/mobile/modules/meeting-contracts/index.mjs';
import {createMeetingApiAdapter} from '/v4/mobile/modules/meeting-api-adapter/index.mjs';
import {createMobileCaptionSession} from '/v4/mobile/modules/mobile-caption-session/index.mjs';
import {
  MOBILE_BROWSER_SPEECH_STATE,
  createMobileBrowserSpeechSession,
  prepareOnDeviceBrowserSpeech,
  supportsGoldenBrowserSpeech,
} from '/v4/mobile/modules/mobile-browser-speech-session/index.mjs';

const byId=id=>document.getElementById(id);
const meetingId=new URL(location.href).searchParams.get('meeting')||'';
const status=byId('status');
const form=byId('composer');
const input=byId('captionText');
const sendButton=byId('sendCaption');
const captions=byId('captions');
const mediaStatus=byId('mediaStatus');
const startMicrophone=byId('startMicrophone');
const stopMicrophone=byId('stopMicrophone');
const speechStatus=byId('speechStatus');
const startSpeech=byId('startSpeech');
const finishSpeech=byId('finishSpeech');
let session=null;
const BrowserSpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const goldenBrowserMode=supportsGoldenBrowserSpeech({
  userAgent:navigator.userAgent,
  recognitionConstructor:BrowserSpeechRecognition,
});

function setStatus(message,kind=''){
  status.textContent=message;
  status.dataset.kind=kind;
}

function addText(parent,tag,className,text){
  const node=document.createElement(tag);
  node.className=className;
  node.textContent=text;
  parent.append(node);
  return node;
}

let speechSession=null;
let unsubscribeSpeech=null;
let speechState=MOBILE_BROWSER_SPEECH_STATE.IDLE;
let goldenMicrophoneReady=false;

async function verifyMicrophoneAccess(){
  if(!navigator.mediaDevices?.getUserMedia){
    throw Object.assign(new Error('media_devices_unsupported'),{name:'NotSupportedError'});
  }
  let stream=null;
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    const tracks=typeof stream?.getAudioTracks==='function'?stream.getAudioTracks():[];
    if(!tracks.some(track=>track?.readyState!=='ended'))throw new Error('audio_track_missing');
  }finally{
    const tracks=typeof stream?.getTracks==='function'?stream.getTracks():[];
    for(const track of tracks)track?.stop?.();
  }
}

function updateSpeechActions(){
  const busy=[
    MOBILE_BROWSER_SPEECH_STATE.PREPARING,
    MOBILE_BROWSER_SPEECH_STATE.LISTENING,
    MOBILE_BROWSER_SPEECH_STATE.COMMITTING,
  ].includes(speechState);
  startMicrophone.disabled=!goldenBrowserMode||goldenMicrophoneReady||busy;
  stopMicrophone.disabled=!goldenBrowserMode||!goldenMicrophoneReady;
  startSpeech.disabled=!session||!goldenBrowserMode||busy||!goldenMicrophoneReady;
  finishSpeech.disabled=speechState!==MOBILE_BROWSER_SPEECH_STATE.LISTENING;
}

function renderSpeech(snapshot){
  speechState=snapshot.state;
  const quality=snapshot.quality==='conversation'?'회의용 고정밀':snapshot.quality==='dictation'?'받아쓰기 고정밀':'기기 내 모델';
  const errorMessages={
    on_device_speech_unsupported:'Android Chrome 150 이상이 필요합니다. 음성은 서버로 보내지 않았습니다.',
    on_device_speech_required:'휴대폰 내부 처리 강제를 확인하지 못했습니다. 음성은 서버로 보내지 않았습니다.',
    on_device_quality_unavailable:'고정밀 휴대폰 음성모델을 사용할 수 없습니다. Chrome을 업데이트해 주세요.',
    on_device_language_unavailable:'이 휴대폰에서 선택 언어의 기기 내 음성팩을 사용할 수 없습니다. 서버 우회는 하지 않습니다.',
    on_device_language_install_failed:'기기 내 음성팩 설치에 실패했습니다. 네트워크 확인 후 다시 눌러 주세요.',
    on_device_speech_check_failed:'기기 내 음성팩 확인에 실패했습니다. Chrome을 다시 열어 주세요.',
    'language-not-supported':'선택 언어의 기기 내 음성팩이 없습니다. 서버 우회는 하지 않습니다.',
  };
  const messages={
    [MOBILE_BROWSER_SPEECH_STATE.IDLE]:'음성 원문 시작을 누르면 휴대폰 내부에서만 인식합니다.',
    [MOBILE_BROWSER_SPEECH_STATE.PREPARING]:snapshot.eventTrace?.includes('start')?'실제 마이크 오디오 시작 확인 중':'휴대폰 음성팩 확인·설치 중 · 최초 1회만 시간이 걸릴 수 있습니다.',
    [MOBILE_BROWSER_SPEECH_STATE.LISTENING]:snapshot.utteranceCount?`최근 원문 ${(Number(snapshot.recognitionLatencyMs||0)/1000).toFixed(1)}초 · 번역 ${(Number(snapshot.translationLatencyMs||0)/1000).toFixed(1)}초 · 휴대폰 내부 ${quality} · ${snapshot.utteranceCount}문장`:`휴대폰 내부 ${quality}로 듣는 중 · 여러 문장을 말한 뒤 말하기 완료를 누르세요.`,
    [MOBILE_BROWSER_SPEECH_STATE.COMMITTING]:`듣기 종료 중 · ${Number(snapshot.pendingCommits||0)}개 원문 저장·번역 확인`,
    [MOBILE_BROWSER_SPEECH_STATE.COMPLETED]:`휴대폰 내부 인식 완료 · ${Number(snapshot.utteranceCount||0)}문장 · 최근 원문 ${(Number(snapshot.recognitionLatencyMs||0)/1000).toFixed(1)}초 · 번역 완료 ${(Number(snapshot.translationLatencyMs||0)/1000).toFixed(1)}초 · ${quality}`,
    [MOBILE_BROWSER_SPEECH_STATE.RECOVERABLE_ERROR]:snapshot.error==='page_hidden'?'화면 이동으로 인식을 중단했습니다. 자동 재시작하지 않습니다.':(errorMessages[snapshot.error]||'기기 내 음성 처리 실패 · 버튼을 눌러 다시 시작할 수 있습니다.'),
    [MOBILE_BROWSER_SPEECH_STATE.FATAL_ERROR]:errorMessages[snapshot.error]||'마이크 권한 또는 Android Chrome 기기 내 음성인식을 확인해 주세요.',
    [MOBILE_BROWSER_SPEECH_STATE.STOPPED]:'음성 세션 종료됨',
  };
  const diagnostic=snapshot.eventTrace?` · 진단 ${snapshot.eventTrace}`:'';
  speechStatus.textContent=(messages[snapshot.state]||'음성 상태 확인 필요')+diagnostic;
  speechStatus.dataset.state=snapshot.state;
  updateSpeechActions();
}

function newSpeechSession(){
  if(!session||!goldenBrowserMode)return null;
  speechSession?.stop();
  unsubscribeSpeech?.();
  speechSession=createMobileBrowserSpeechSession({
    meetingId,
    captionSession:session,
    createRecognition:()=>new BrowserSpeechRecognition(),
    prepareRecognition:(recognition,options)=>prepareOnDeviceBrowserSpeech({
      recognitionConstructor:BrowserSpeechRecognition,
      recognition,
      language:options.sourceLanguage,
      qualities:['conversation','dictation'],
    }),
  });
  unsubscribeSpeech=speechSession.subscribe(renderSpeech);
  return speechSession;
}

startMicrophone.addEventListener('click',async()=>{
  if(!goldenBrowserMode)return;
  startMicrophone.disabled=true;
  mediaStatus.textContent='마이크 권한·입력 장치 확인 중';
  mediaStatus.dataset.state='requesting';
  try{
    await verifyMicrophoneAccess();
    goldenMicrophoneReady=true;
    mediaStatus.textContent='실제 마이크 확인 완료 · 음성 원문 시작을 누르세요.';
    mediaStatus.dataset.state='active';
  }catch{
    goldenMicrophoneReady=false;
    mediaStatus.textContent='마이크를 확인하지 못했습니다. Chrome 사이트 권한에서 마이크를 허용해 주세요.';
    mediaStatus.dataset.state='fatal_error';
  }finally{
    updateSpeechActions();
  }
});

stopMicrophone.addEventListener('click',()=>{
  if(!goldenBrowserMode)return;
  if([
    MOBILE_BROWSER_SPEECH_STATE.PREPARING,
    MOBILE_BROWSER_SPEECH_STATE.LISTENING,
    MOBILE_BROWSER_SPEECH_STATE.COMMITTING,
  ].includes(speechSession?.getSnapshot().state)){
    speechSession.cancelListening('microphone_stopped');
  }
  goldenMicrophoneReady=false;
  mediaStatus.textContent='휴대폰 내부 음성인식 연결 전 · 연결 후 음성 원문을 시작하세요.';
  mediaStatus.dataset.state='idle';
  updateSpeechActions();
});
startSpeech.addEventListener('click',async()=>{
  if(!speechSession||!goldenBrowserMode||!goldenMicrophoneReady)return;
  try{
    const speechOptions={
      sourceLanguage:byId('sourceLanguage').value,
      targetLanguage:byId('targetLanguage').value,
    };
    await speechSession.startListening(speechOptions);
  }catch{
    renderSpeech(speechSession.getSnapshot());
  }
});
finishSpeech.addEventListener('click',async()=>{
  if(!speechSession)return;
  finishSpeech.disabled=true;
  try{
    speechSession.finishListening();
  }catch{
    renderSpeech(speechSession.getSnapshot());
  }
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){
    if([
      MOBILE_BROWSER_SPEECH_STATE.PREPARING,
      MOBILE_BROWSER_SPEECH_STATE.LISTENING,
      MOBILE_BROWSER_SPEECH_STATE.COMMITTING,
    ].includes(speechSession?.getSnapshot().state))speechSession.cancelListening('page_hidden');
  }
});
window.addEventListener('beforeunload',()=>{
  speechSession?.stop();
},{once:true});
if(goldenBrowserMode){
  mediaStatus.textContent='휴대폰 내부 음성인식 연결 전 · 오디오는 서버로 보내지 않습니다.';
  mediaStatus.dataset.state='idle';
  updateSpeechActions();
}else{
  mediaStatus.textContent='Android Chrome 150 이상에서만 휴대폰 내부 음성인식을 사용할 수 있습니다.';
  mediaStatus.dataset.state='unsupported';
  speechStatus.textContent='Chrome을 업데이트한 뒤 이 주소를 Chrome에서 다시 여세요. 서버 STT로 우회하지 않습니다.';
  speechStatus.dataset.state='unsupported';
  updateSpeechActions();
}

function render(snapshot,session){
  captions.replaceChildren();
  if(!snapshot.items.length){
    addText(captions,'p','empty','원문을 입력하면 저장 전에 즉시 표시됩니다.');
    return;
  }
  for(const item of snapshot.items){
    const card=document.createElement('article');
    card.className='caption-card';
    card.dataset.status=item.status;
    addText(card,'p','original',item.text);
    const translated=String(item.translations?.[byId('targetLanguage').value]||'').trim();
    addText(
      card,
      'p',
      translated?'translation':'translation muted',
      translated||(item.pending_translation||item.status===CAPTION_STATUS.PENDING?'번역 처리 중':'번역 없음'),
    );
    if(item.status===CAPTION_STATUS.FAILED){
      const retry=document.createElement('button');
      retry.type='button';
      retry.className='retry';
      retry.textContent='다시 저장';
      retry.addEventListener('click',async()=>{
        retry.disabled=true;
        setStatus('원문을 다시 저장하는 중');
        try{
          await session.retry(item.clientId);
          setStatus('원문 저장 완료','ok');
        }catch{
          retry.disabled=false;
          setStatus('저장하지 못했습니다. 원문은 그대로 보존됩니다.','error');
        }
      });
      card.append(retry);
    }
    captions.append(card);
  }
  captions.scrollTop=captions.scrollHeight;
}

try{
  const api=createMeetingApiAdapter({
    transport:(url,options)=>fetch(url,{credentials:'same-origin',...options}),
  });
  session=createMobileCaptionSession({meetingId,api});
  session.subscribe(snapshot=>render(snapshot,session));
  newSpeechSession();
  setStatus('원문 입력 준비 완료','ok');
  void session.reconnect({targetLanguage:byId('targetLanguage').value}).catch(()=>{
    setStatus('재접속 동기화 실패 · 새 원문은 입력할 수 있습니다.','warn');
  });
}catch{
  form.inert=true;
  sendButton.disabled=true;
  setStatus('유효한 회의 링크가 필요합니다.','error');
}

form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!session)return;
  const text=input.value.trim();
  if(!text)return;
  sendButton.disabled=true;
  setStatus('원문을 저장하는 중');
  try{
    await session.submit(text,{
      sourceLanguage:byId('sourceLanguage').value,
      targetLanguage:byId('targetLanguage').value,
    });
    if(input.value.trim()===text)input.value='';
    setStatus('원문 저장 완료','ok');
  }catch{
    setStatus('저장하지 못했습니다. 원문과 입력 내용은 그대로 보존됩니다.','error');
  }finally{
    sendButton.disabled=false;
  }
});

byId('targetLanguage').addEventListener('change',()=>{
  if(!session)return;
  void session.reconnect({targetLanguage:byId('targetLanguage').value}).catch(()=>{
    setStatus('번역 동기화에 실패했습니다. 원문은 유지됩니다.','warn');
  });
});
