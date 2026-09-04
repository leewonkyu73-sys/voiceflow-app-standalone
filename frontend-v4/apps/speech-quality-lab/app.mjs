import {
  SPEECH_SAMPLE_KIND,
  createSpeechQualityReport,
  evaluateSpeechSample,
} from '/v4/speech-quality-lab/modules/speech-quality-evaluator/index.mjs';

const CLIENT_ID='v4-speech-quality-lab';
const SESSION_ID=`lab-session-${crypto.randomUUID()}`;
const PRESETS=Object.freeze({
  meeting:Object.freeze({kind:'speech',language:'ko-KR',reference:'오늘 회의는 오전 10시 30분에 시작합니다.',keywords:['회의','오전','시작']}),
  numbers:Object.freeze({kind:'speech',language:'ko-KR',reference:'발주 수량은 250개이고 금액은 1,350,000원입니다.',keywords:['발주','수량','금액']}),
  names:Object.freeze({kind:'speech',language:'ko-KR',reference:'응우옌 민 아인 담당자와 ANBINH FOODS 일정을 확인합니다.',keywords:['응우옌 민 아인','ANBINH FOODS','일정']}),
  sentences:Object.freeze({kind:'speech',language:'ko-KR',reference:'배송은 다음 주 월요일부터 시작합니다. 변경 사항은 오후 3시에 공유합니다.',keywords:['배송','월요일','변경','오후']}),
  silence:Object.freeze({kind:'silence',language:'ko-KR',reference:'',keywords:[]}),
});

const $=selector=>document.querySelector(selector);
const elements=Object.freeze({
  installPwa:$('#installPwa'),iosInstallHint:$('#iosInstallHint'),loginState:$('#loginState'),providerList:$('#providerList'),
  presetList:$('#presetList'),sourceLanguage:$('#sourceLanguage'),sampleKind:$('#sampleKind'),
  referenceText:$('#referenceText'),keywords:$('#keywords'),coverageState:$('#coverageState'),
  startRecording:$('#startRecording'),stopRecording:$('#stopRecording'),discardRecording:$('#discardRecording'),
  recordingState:$('#recordingState'),recordingInfo:$('#recordingInfo'),audioPreview:$('#audioPreview'),
  audioConsent:$('#audioConsent'),runBenchmark:$('#runBenchmark'),runStatus:$('#runStatus'),
  resultRows:$('#resultRows'),resetResults:$('#resetResults'),
});

const state={
  providers:[],recorder:null,stream:null,chunks:[],startedAt:0,captureSample:null,recording:null,previewUrl:'',
  runBusy:false,records:[],sampleKinds:new Map(),deferredInstall:null,autoStopTimer:0,sequence:0,
};

const REASONS=Object.freeze({
  ready:'준비됨',api_disabled:'API 시험 잠금',lab_disabled:'시험 화면 잠금',
  implementation_pending:'연결 구현 대기',not_allowlisted:'관리자 허용 필요',setup_required:'키 설정 필요',
});

function setStatus(element,message,kind=''){
  element.textContent=message;
  if(kind)element.dataset.kind=kind;else delete element.dataset.kind;
}

function setBadge(element,label,kind='neutral'){
  element.textContent=label;
  element.className=`badge ${kind}`;
}

function selectedProviders(){
  return [...elements.providerList.querySelectorAll('input[data-provider]:checked')]
    .map(input=>state.providers.find(provider=>provider.id===input.dataset.provider))
    .filter(provider=>provider?.enabled);
}

function updateRunAvailability(){
  const available=Boolean(state.recording)&&selectedProviders().length>0&&elements.audioConsent.checked&&!state.runBusy;
  elements.runBenchmark.disabled=!available;
  elements.startRecording.disabled=Boolean(state.recorder)||state.runBusy;
  elements.stopRecording.disabled=!state.recorder;
  elements.discardRecording.disabled=!state.recording||Boolean(state.recorder)||state.runBusy;
}

function renderProviders(){
  elements.providerList.replaceChildren();
  if(!state.providers.length){
    const empty=document.createElement('p');empty.className='empty';empty.textContent='사용 가능한 제공자 정보가 없습니다.';
    elements.providerList.append(empty);updateRunAvailability();return;
  }
  for(const provider of state.providers){
    const label=document.createElement('label');label.className='provider-option';label.dataset.enabled=String(provider.enabled);
    const input=document.createElement('input');input.type='checkbox';input.dataset.provider=provider.id;
    input.disabled=!provider.enabled;input.checked=provider.enabled;input.addEventListener('change',updateRunAvailability);
    const copy=document.createElement('span');
    const title=document.createElement('b');title.textContent=provider.label;
    const model=document.createElement('small');model.textContent=provider.model||provider.kind;
    const status=document.createElement('em');status.textContent=REASONS[provider.reason]||provider.reason;
    copy.append(title,model,status);label.append(input,copy);elements.providerList.append(label);
  }
  updateRunAvailability();
}

async function loadProviders(){
  try{
    const response=await fetch('/api/v1/speech-quality/providers',{credentials:'same-origin',cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if(response.status===401){
      setBadge(elements.loginState,'로그인 필요','fail');
      setStatus(elements.runStatus,'PC 기준 홈에서 로그인한 뒤 이 화면으로 돌아오세요.','error');
      state.providers=[];renderProviders();return;
    }
    if(!response.ok)throw new Error(payload.error||`http_${response.status}`);
    state.providers=Array.isArray(payload.data?.providers)?payload.data.providers:[];
    setBadge(elements.loginState,payload.data?.user?.name?`${payload.data.user.name} 로그인`:'로그인됨','ready');
    renderProviders();
    if(!state.providers.some(provider=>provider.enabled)){
      setStatus(elements.runStatus,'아직 관리자가 허용한 API가 없습니다. 녹음·화면 시험은 가능하지만 외부 전송은 차단됩니다.');
    }
  }catch(error){
    state.providers=[];renderProviders();
    setBadge(elements.loginState,'상태 확인 실패','fail');
    setStatus(elements.runStatus,`제공자 상태를 읽지 못했습니다: ${error.message}`,'error');
  }
}

function applyPreset(id){
  const preset=PRESETS[id];if(!preset)return;
  elements.sourceLanguage.value=preset.language;
  elements.sampleKind.value=preset.kind;
  elements.referenceText.value=preset.reference;
  elements.referenceText.disabled=preset.kind==='silence';
  elements.keywords.value=preset.keywords.join(', ');
  elements.keywords.disabled=preset.kind==='silence';
  for(const button of elements.presetList.querySelectorAll('[data-preset]'))button.setAttribute('aria-pressed',String(button.dataset.preset===id));
  setStatus(elements.recordingInfo,preset.kind==='silence'?'말하지 말고 5초 동안 주변 소리만 녹음하세요.':'마이크 권한을 허용한 뒤 기준 문장을 그대로 말하세요.');
}

function currentSample(){
  const kind=elements.sampleKind.value===SPEECH_SAMPLE_KIND.SILENCE?SPEECH_SAMPLE_KIND.SILENCE:SPEECH_SAMPLE_KIND.SPEECH;
  const reference=kind===SPEECH_SAMPLE_KIND.SILENCE?'':elements.referenceText.value.trim();
  if(kind===SPEECH_SAMPLE_KIND.SPEECH&&!reference)throw new Error('기준 원문을 입력하세요.');
  return Object.freeze({
    kind,reference,sourceLanguage:elements.sourceLanguage.value,
    keywords:kind===SPEECH_SAMPLE_KIND.SILENCE?[]:elements.keywords.value.split(',').map(value=>value.trim()).filter(Boolean),
  });
}

function supportedMimeType(){
  if(typeof MediaRecorder!=='function')return'';
  return ['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type))||'';
}

function stopTracks(){
  for(const track of state.stream?.getTracks?.()||[])track.stop();
  state.stream=null;
}

function clearAutoStop(){
  if(state.autoStopTimer)window.clearTimeout(state.autoStopTimer);
  state.autoStopTimer=0;
}

function finishRecorder(){
  clearAutoStop();
  const recorder=state.recorder,mimeType=recorder?.mimeType||supportedMimeType()||'audio/webm';
  const durationMs=Math.max(0,performance.now()-state.startedAt);
  const blob=new Blob(state.chunks,{type:mimeType});
  state.recorder=null;state.chunks=[];stopTracks();
  if(blob.size<800){
    state.recording=null;setBadge(elements.recordingState,'실패','fail');
    setStatus(elements.recordingInfo,'녹음 데이터가 너무 짧습니다. 다시 녹음하세요.','error');updateRunAvailability();return;
  }
  const sample=state.captureSample||currentSample();state.captureSample=null;
  state.recording=Object.freeze({
    blob,durationMs,mimeType:blob.type||mimeType,sampleId:`sample-${crypto.randomUUID()}`,
    utteranceId:`lab-utterance-${crypto.randomUUID()}`,...sample,
  });
  if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
  state.previewUrl=URL.createObjectURL(blob);elements.audioPreview.src=state.previewUrl;elements.audioPreview.hidden=false;
  setBadge(elements.recordingState,'녹음 준비','ready');
  setStatus(elements.recordingInfo,`${(durationMs/1000).toFixed(1)}초 · ${(blob.size/1024).toFixed(1)}KB · ${state.recording.mimeType}`,'ok');
  updateRunAvailability();
}

async function startRecording(){
  try{
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder!=='function')throw new Error('이 Chrome에서는 녹음을 지원하지 않습니다.');
    const sample=currentSample();
    if(state.recording)discardRecording();
    state.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    const mimeType=supportedMimeType();
    const recorder=new MediaRecorder(state.stream,mimeType?{mimeType}:undefined);state.captureSample=sample;
    state.recorder=recorder;state.chunks=[];state.startedAt=performance.now();
    recorder.addEventListener('dataavailable',event=>{if(event.data?.size)state.chunks.push(event.data)});
    recorder.addEventListener('stop',finishRecorder,{once:true});
    recorder.addEventListener('error',event=>{
      setStatus(elements.recordingInfo,`녹음 오류: ${event.error?.message||'unknown'}`,'error');
      state.recorder=null;state.captureSample=null;clearAutoStop();stopTracks();updateRunAvailability();
    },{once:true});
    recorder.start(250);
    setBadge(elements.recordingState,sample.kind===SPEECH_SAMPLE_KIND.SILENCE?'5초 무음 녹음':'녹음 중','warning');
    setStatus(elements.recordingInfo,sample.kind===SPEECH_SAMPLE_KIND.SILENCE?'말하지 마세요. 5초 뒤 자동으로 끝납니다.':'기준 문장을 말한 뒤 “말하기 완료”를 누르세요.');
    if(sample.kind===SPEECH_SAMPLE_KIND.SILENCE)state.autoStopTimer=window.setTimeout(stopRecording,5000);
    updateRunAvailability();
  }catch(error){
    state.recorder=null;stopTracks();setBadge(elements.recordingState,'권한/지원 확인','fail');
    setStatus(elements.recordingInfo,`마이크를 시작하지 못했습니다: ${error.message}`,'error');updateRunAvailability();
  }
}

function stopRecording(){
  clearAutoStop();
  if(state.recorder?.state==='recording'){
    state.recorder.stop();setBadge(elements.recordingState,'녹음 정리 중','warning');
    elements.stopRecording.disabled=true;
  }
}

function discardRecording(){
  if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
  state.previewUrl='';state.recording=null;elements.audioPreview.removeAttribute('src');elements.audioPreview.hidden=true;
  setBadge(elements.recordingState,'대기','neutral');setStatus(elements.recordingInfo,'마이크 권한을 허용한 뒤 기준 문장을 그대로 말하세요.');updateRunAvailability();
}

function parseKeywords(){
  return state.recording?.keywords||[];
}

async function providerRequest(provider,recording,sequence){
  const started=performance.now();
  const response=await fetch(`/api/v1/speech-quality/transcribe/${encodeURIComponent(provider.id)}`,{
    method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{
      'content-type':recording.mimeType,'x-voice-client':CLIENT_ID,'x-voice-audio-consent':'session',
      'x-voice-language':recording.sourceLanguage,'x-voice-session-id':SESSION_ID,
      'x-voice-utterance-id':recording.utteranceId,'x-voice-sequence':String(sequence),
      'x-voice-audio-duration-ms':String(Math.round(recording.durationMs)),
    },
    body:recording.blob,
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload.error||`http_${response.status}`);error.status=response.status;throw error;
  }
  return Object.freeze({...payload.data,clientLatencyMs:Math.max(0,performance.now()-started)});
}

function errorRecord(provider,recording,sequence,error,latencyMs){
  return evaluateSpeechSample({
    providerId:provider.id,sampleId:recording.sampleId,kind:recording.kind,reference:recording.reference,
    transcript:'',keywords:parseKeywords(),latencyMs,audioDurationMs:recording.durationMs,
    expectedSequence:sequence,actualSequence:sequence,error:String(error?.message||error||'provider_failed'),
  });
}

function upsertRecord(record){
  const index=state.records.findIndex(item=>item.providerId===record.providerId&&item.sampleId===record.sampleId);
  if(index>=0)state.records[index]=record;else state.records.push(record);
}

async function runBenchmark(){
  const recording=state.recording,providers=selectedProviders();
  if(!recording||!providers.length||!elements.audioConsent.checked||state.runBusy)return;
  state.runBusy=true;elements.runBenchmark.dataset.busy='true';elements.runBenchmark.textContent='순차 비교 중';updateRunAvailability();
  const sequence=++state.sequence;
  for(let index=0;index<providers.length;index+=1){
    const provider=providers[index];
    setStatus(elements.runStatus,`${index+1}/${providers.length} · ${provider.label} 인식 중…`);
    const started=performance.now();
    try{
      const response=await providerRequest(provider,recording,sequence);
      const result=evaluateSpeechSample({
        providerId:provider.id,sampleId:recording.sampleId,kind:recording.kind,reference:recording.reference,
        transcript:response.originalText,keywords:parseKeywords(),latencyMs:response.clientLatencyMs,
        audioDurationMs:recording.durationMs,costUsd:response.costUsd,
        expectedSequence:sequence,actualSequence:response.sequence,
      });
      upsertRecord(result);
    }catch(error){
      upsertRecord(errorRecord(provider,recording,sequence,error,performance.now()-started));
    }
    renderResults();
  }
  state.sampleKinds.set(recording.sampleId,recording.kind);
  state.runBusy=false;delete elements.runBenchmark.dataset.busy;elements.runBenchmark.textContent='같은 녹음으로 비교 실행';
  setStatus(elements.runStatus,'선택한 제공자의 순차 비교가 끝났습니다. 다음 기준 문장을 녹음하세요.','ok');
  updateCoverage();updateRunAvailability();
}

function format(value,digits=1,suffix=''){
  return value===null||value===undefined?'미확인':`${Number(value).toFixed(digits)}${suffix}`;
}

function statusBadge(status){
  const span=document.createElement('span');span.className=`badge ${String(status).toLowerCase()}`;span.textContent=status;return span;
}

function renderResults(){
  elements.resultRows.replaceChildren();
  if(!state.records.length){
    const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=8;cell.className='empty';cell.textContent='아직 실행한 결과가 없습니다.';row.append(cell);elements.resultRows.append(row);return;
  }
  const report=createSpeechQualityReport(state.records);
  for(const provider of report.providers){
    const latest=[...state.records].reverse().find(record=>record.providerId===provider.providerId);
    const row=document.createElement('tr');
    const name=document.createElement('td');name.textContent=state.providers.find(item=>item.id===provider.providerId)?.label||provider.providerId;
    const status=document.createElement('td');status.append(statusBadge(provider.status));
    const transcript=document.createElement('td');transcript.className='transcript';transcript.textContent=latest?.error?`오류: ${latest.error}`:latest?.transcript||'(빈 원문)';
    const cer=document.createElement('td');cer.textContent=format(provider.meanCer===null?null:provider.meanCer*100,1,'%');cer.className=provider.meanCer!==null&&provider.meanCer<=.12?'metric-good':'metric-bad';
    const numbers=document.createElement('td');numbers.textContent=provider.numberErrors===0?'일치':`${provider.numberErrors}건 오류`;numbers.className=provider.numberErrors===0?'metric-good':'metric-bad';
    const keywords=document.createElement('td');keywords.textContent=format(provider.keywordRecall===null?null:provider.keywordRecall*100,0,'%');keywords.className=provider.keywordRecall===null||provider.keywordRecall>=.95?'metric-good':'metric-bad';
    const latency=document.createElement('td');latency.textContent=format(provider.p95LatencyMs,0,'ms');latency.className=provider.p95LatencyMs!==null&&provider.p95LatencyMs<=2500?'metric-good':'metric-bad';
    const cost=document.createElement('td');cost.textContent=provider.costUsd===null?'미확인':`$${provider.costUsd.toFixed(6)}`;
    row.append(name,status,transcript,cer,numbers,keywords,latency,cost);elements.resultRows.append(row);
  }
}

function updateCoverage(){
  const speech=[...state.sampleKinds.values()].filter(kind=>kind===SPEECH_SAMPLE_KIND.SPEECH).length;
  const silence=[...state.sampleKinds.values()].filter(kind=>kind===SPEECH_SAMPLE_KIND.SILENCE).length;
  const complete=speech>=4&&silence>=1;
  setBadge(elements.coverageState,`발화 ${speech}/4 · 무음 ${silence}/1`,complete?'ready':'neutral');
}

function resetResults(){
  state.records=[];state.sampleKinds.clear();renderResults();updateCoverage();setStatus(elements.runStatus,'측정 결과를 초기화했습니다. 녹음 파일은 그대로 유지됩니다.');
}

elements.presetList.addEventListener('click',event=>{const button=event.target.closest('[data-preset]');if(button)applyPreset(button.dataset.preset)});
elements.sampleKind.addEventListener('change',()=>{
  const silence=elements.sampleKind.value===SPEECH_SAMPLE_KIND.SILENCE;elements.referenceText.disabled=silence;elements.keywords.disabled=silence;
});
elements.startRecording.addEventListener('click',startRecording);
elements.stopRecording.addEventListener('click',stopRecording);
elements.discardRecording.addEventListener('click',discardRecording);
elements.audioConsent.addEventListener('change',updateRunAvailability);
elements.runBenchmark.addEventListener('click',runBenchmark);
elements.resetResults.addEventListener('click',resetResults);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();state.deferredInstall=event;elements.installPwa.hidden=false});
elements.installPwa.addEventListener('click',async()=>{
  if(!state.deferredInstall){elements.iosInstallHint.hidden=false;return}
  state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;elements.installPwa.hidden=true;
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.recorder)stopRecording()});
window.addEventListener('beforeunload',()=>{clearAutoStop();stopTracks();if(state.previewUrl)URL.revokeObjectURL(state.previewUrl)});

const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if(ios&&!standalone){elements.installPwa.hidden=false;elements.installPwa.textContent='iPhone 설치 방법'}
if(standalone)elements.installPwa.hidden=true;
applyPreset('meeting');renderResults();updateCoverage();updateRunAvailability();void loadProviders();
if('serviceWorker'in navigator)void navigator.serviceWorker.register('/v4/speech-quality-lab/sw.js',{scope:'/v4/speech-quality-lab/',updateViaCache:'none'}).catch(()=>{});
