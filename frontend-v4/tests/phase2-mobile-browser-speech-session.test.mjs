import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MOBILE_BROWSER_SPEECH_STATE,
  createMobileBrowserSpeechSession,
  prepareOnDeviceBrowserSpeech,
  supportsGoldenBrowserSpeech,
} from '../packages/mobile-browser-speech-session/index.mjs';

function fakeRecognition(){
  return {
    continuous:false,
    interimResults:false,
    processLocally:false,
    lang:'',
    starts:0,
    stops:0,
    aborts:0,
    start(){this.starts+=1;},
    stop(){this.stops+=1;},
    abort(){this.aborts+=1;},
    emitAudioStart(){return this.onaudiostart?.();},
    emitAudioEnd(){return this.onaudioend?.();},
    emitSpeechStart(){return this.onspeechstart?.();},
    emitSpeechEnd(){return this.onspeechend?.();},
    emitResult(results,resultIndex=0){return this.onresult?.({results,resultIndex});},
    emitEnd(){return this.onend?.();},
    emitError(error){return this.onerror?.({error});},
  };
}
const result=(text,isFinal)=>({0:{transcript:text},length:1,isFinal});
const prepareRecognition=async recognition=>{
  recognition.processLocally=true;
  return {quality:'conversation'};
};

function recognitionConstructor({available='available',installed=true}={}){
  const calls=[];
  function OnDeviceRecognition(){}
  OnDeviceRecognition.available=async options=>{
    calls.push({type:'available',options});
    return typeof available==='function'?available(options,calls):available;
  };
  OnDeviceRecognition.install=async options=>{
    calls.push({type:'install',options});
    return installed;
  };
  return {constructor:OnDeviceRecognition,calls};
}

const supportedRecognition=recognitionConstructor();
assert.equal(supportsGoldenBrowserSpeech({
  userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/151.0 Mobile Safari/537.36',
  recognitionConstructor:supportedRecognition.constructor,
}),true);
assert.equal(supportsGoldenBrowserSpeech({
  userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/149.0 Mobile Safari/537.36',
  recognitionConstructor:supportedRecognition.constructor,
}),false,'Chrome before quality-aware on-device recognition must not silently use a lower-quality model');
assert.equal(supportsGoldenBrowserSpeech({
  userAgent:'Mozilla/5.0 (Linux; Android 15) SamsungBrowser/28.0 Chrome/151.0',
  recognitionConstructor:supportedRecognition.constructor,
}),false);
assert.equal(supportsGoldenBrowserSpeech({userAgent:'Mozilla/5.0 (iPhone)',recognitionConstructor:function(){}}),false);

{
  const local=recognitionConstructor();
  const recognition=fakeRecognition();
  const prepared=await prepareOnDeviceBrowserSpeech({
    recognitionConstructor:local.constructor,
    recognition,
    language:'ko-KR',
  });
  assert.equal(recognition.processLocally,true);
  assert.equal(prepared.quality,'conversation');
  assert.equal(prepared.installed,false);
  assert.deepEqual(local.calls,[{
    type:'available',
    options:{langs:['ko-KR'],processLocally:true,quality:'conversation'},
  }]);
}

{
  let checks=0;
  const local=recognitionConstructor({
    available:()=>checks++===0?'downloadable':'available',
  });
  const recognition=fakeRecognition();
  const prepared=await prepareOnDeviceBrowserSpeech({
    recognitionConstructor:local.constructor,
    recognition,
    language:'ko-KR',
  });
  assert.equal(prepared.quality,'conversation');
  assert.equal(prepared.installed,true);
  assert.deepEqual(local.calls.map(call=>call.type),['available','install','available']);
  assert.ok(local.calls.every(call=>call.options.processLocally===true));
}

{
  const local=recognitionConstructor({available:options=>options.quality==='dictation'?'available':'unavailable'});
  const prepared=await prepareOnDeviceBrowserSpeech({
    recognitionConstructor:local.constructor,
    recognition:fakeRecognition(),
    language:'ko-KR',
  });
  assert.equal(prepared.quality,'dictation','dictation must remain an on-device-only fallback when conversation quality is unavailable');
  assert.deepEqual(local.calls.map(call=>call.options.quality),['conversation','dictation']);
}

{
  const local=recognitionConstructor({available:'unavailable'});
  await assert.rejects(
    prepareOnDeviceBrowserSpeech({
      recognitionConstructor:local.constructor,
      recognition:fakeRecognition(),
      language:'ko-KR',
    }),
    error=>error?.code==='on_device_language_unavailable',
  );
  assert.equal(local.calls.some(call=>call.type==='install'),false);
}

{
  const recognitions=[];
  const captions=[];
  const states=[];
  const session=createMobileBrowserSpeechSession({
    meetingId:'mtg_browser_continuous',
    captionSession:{submit:async(text,options)=>{captions.push({text,options});}},
    createRecognition:()=>{const recognition=fakeRecognition();recognitions.push(recognition);return recognition;},
    prepareRecognition,
    now:(()=>{let value=1000;return()=>value+=100})(),
  });
  session.subscribe(snapshot=>states.push(snapshot.state));
  await session.startListening({sourceLanguage:'ko-KR',targetLanguage:'vi-VN'});
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.PREPARING,'recognition.start alone must not claim that microphone audio is flowing');
  recognitions[0].emitAudioStart();
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.LISTENING);
  assert.equal(recognitions.length,1);
  assert.equal(recognitions[0].continuous,true,'one user start must keep one continuous browser recognition');
  assert.equal(recognitions[0].interimResults,true);
  assert.equal(recognitions[0].lang,'ko-KR');
  assert.equal(recognitions[0].processLocally,true);
  assert.equal(recognitions[0].starts,1);
  assert.equal(session.getSnapshot().eventTrace,'prepare > ready:conversation > start > audiostart');
  assert.equal(session.getSnapshot().processingMode,'on-device');
  assert.equal(session.getSnapshot().quality,'conversation');

  await recognitions[0].emitResult([result('중간 문장',false)]);
  assert.equal(captions.length,0);
  recognitions[0].emitSpeechStart();
  recognitions[0].emitSpeechEnd();
  assert.equal(recognitions[0].stops,0,'speech end must not stop a continuous meeting session');
  await recognitions[0].emitResult([result('첫 번째 문장',true)]);
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.LISTENING,'translation must not stop listening');
  assert.equal(session.getSnapshot().lastText,'첫 번째 문장');
  assert.equal(session.getSnapshot().utteranceCount,1);
  assert.match(session.getSnapshot().eventTrace,/speechstart > speechend > final$/);

  recognitions[0].emitSpeechStart();
  recognitions[0].emitSpeechEnd();
  await recognitions[0].emitResult([
    result('첫 번째 문장',true),
    result('두 번째 문장',true),
  ],1);
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.LISTENING);
  assert.equal(session.getSnapshot().lastText,'두 번째 문장');
  assert.equal(session.getSnapshot().utteranceCount,2);
  assert.equal(recognitions.length,1,'multiple final results must use the same recognition instance');
  assert.equal(recognitions[0].starts,1,'continuous listening must not restart recognition');
  assert.equal(recognitions[0].stops,0);
  assert.deepEqual(captions,[
    {
      text:'첫 번째 문장',
      options:{sourceLanguage:'ko-KR',targetLanguage:'vi-VN',inputMode:'speech'},
    },
    {
      text:'두 번째 문장',
      options:{sourceLanguage:'ko-KR',targetLanguage:'vi-VN',inputMode:'speech'},
    },
  ]);

  session.finishListening();
  session.finishListening();
  assert.equal(recognitions[0].stops,1,'manual finish must be the only idempotent recognition stop');
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.COMMITTING);
  await recognitions[0].emitEnd();
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.COMPLETED);
  assert.equal(session.getSnapshot().provider,'on-device-web-speech');
  assert.ok(states.includes(MOBILE_BROWSER_SPEECH_STATE.PREPARING));
  assert.ok(states.includes(MOBILE_BROWSER_SPEECH_STATE.LISTENING));
  assert.ok(states.includes(MOBILE_BROWSER_SPEECH_STATE.COMMITTING));
  assert.ok(states.includes(MOBILE_BROWSER_SPEECH_STATE.COMPLETED));
}

{
  const recognitions=[];
  const session=createMobileBrowserSpeechSession({
    meetingId:'mtg_browser_unexpected_end',
    captionSession:{submit:async()=>{}},
    createRecognition:()=>{const recognition=fakeRecognition();recognitions.push(recognition);return recognition;},
    prepareRecognition,
  });
  await session.startListening();
  await recognitions[0].emitEnd();
  assert.match(session.getSnapshot().eventTrace,/start > end$/);
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.RECOVERABLE_ERROR);
  assert.equal(session.getSnapshot().error,'speech_session_ended');
  assert.equal(recognitions.length,1,'unexpected recognition end must never auto-restart');
  assert.equal(recognitions[0].starts,1);
}

{
  const recognitions=[];
  const session=createMobileBrowserSpeechSession({
    meetingId:'mtg_browser_no_speech',
    captionSession:{submit:async()=>{}},
    createRecognition:()=>{const recognition=fakeRecognition();recognitions.push(recognition);return recognition;},
    prepareRecognition,
  });
  await session.startListening();
  await recognitions[0].emitError('no-speech');
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.RECOVERABLE_ERROR);
  assert.equal(session.getSnapshot().error,'no-speech');
  assert.equal(recognitions.length,1,'errors must never start a fallback or restart timer');
}

{
  const recognition=fakeRecognition();
  const session=createMobileBrowserSpeechSession({
    meetingId:'mtg_browser_permission',
    captionSession:{submit:async()=>{}},
    createRecognition:()=>recognition,
    prepareRecognition,
  });
  await session.startListening();
  await recognition.emitError('not-allowed');
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.FATAL_ERROR);
  assert.equal(session.getSnapshot().error,'not-allowed');
}

{
  const recognition=fakeRecognition();
  const session=createMobileBrowserSpeechSession({
    meetingId:'mtg_browser_hidden',
    captionSession:{submit:async()=>{}},
    createRecognition:()=>recognition,
    prepareRecognition,
  });
  await session.startListening();
  session.cancelListening('page_hidden');
  assert.equal(recognition.aborts,1);
  assert.equal(session.getSnapshot().state,MOBILE_BROWSER_SPEECH_STATE.RECOVERABLE_ERROR);
  assert.equal(session.getSnapshot().error,'page_hidden');
  assert.equal(recognition.starts,1);
}

{
  const recognition=fakeRecognition();
  const session=createMobileBrowserSpeechSession({
    meetingId:'mtg_browser_local_unavailable',
    captionSession:{submit:async()=>{}},
    createRecognition:()=>recognition,
    prepareRecognition:async()=>{
      const error=new Error('on_device_language_unavailable');
      error.code='on_device_language_unavailable';
      throw error;
    },
  });
  const snapshot=await session.startListening();
  assert.equal(snapshot.state,MOBILE_BROWSER_SPEECH_STATE.FATAL_ERROR);
  assert.equal(snapshot.error,'on_device_language_unavailable');
  assert.equal(recognition.starts,0,'recognition must never start before strict on-device readiness passes');
  assert.equal(recognition.processLocally,true);
}

{
  const app=await fs.readFile(new URL('../apps/mobile-pwa/app.mjs',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../apps/mobile-pwa/index.html',import.meta.url),'utf8');
  const css=await fs.readFile(new URL('../apps/mobile-pwa/styles.css',import.meta.url),'utf8');
  const module=await fs.readFile(new URL('../packages/mobile-browser-speech-session/index.mjs',import.meta.url),'utf8');
  const deploy=await fs.readFile(new URL('../../deploy/complete-to-100-v262.sh',import.meta.url),'utf8');
  assert.match(app,/createMobileBrowserSpeechSession/);
  assert.match(app,/prepareOnDeviceBrowserSpeech/);
  assert.match(app,/supportsGoldenBrowserSpeech/);
  assert.match(app,/goldenBrowserMode/);
  assert.match(app,/휴대폰 내부에서만 인식합니다/);
  assert.match(app,/최근 원문.*휴대폰 내부/);
  assert.match(app,/번역 완료/);
  assert.match(app,/진단 \$\{snapshot\.eventTrace\}/);
  assert.match(app,/qualities:\['conversation','dictation'\]/);
  assert.match(app,/서버 STT로 우회하지 않습니다/);
  assert.match(module,/eventTrace:eventTrace\.join/);
  assert.match(module,/processLocally=true/);
  assert.match(module,/recognitionConstructor\.available/);
  assert.match(module,/recognitionConstructor\.install/);
  assert.match(module,/provider='on-device-web-speech'/);
  assert.match(html,/data-v4-mobile="phase2-browser-speech"/);
  assert.match(html,/data-v4-speech="on-device-browser-speech-v1"/);
  assert.match(html,/data-v4-ui="pc-aligned-mobile-v1"/);
  assert.match(html,/data-v4-controls="pc-four-control-mobile-v1"/);
  assert.match(html,/<h1>음성메모 · 기본 대화방<\/h1>/);
  assert.match(html,/class="room-toolbar"/);
  assert.match(html,/class="conversation-shell"/);
  assert.match(html,/class="composer"/);
  for(const id of ['sourceLanguage','targetLanguage','mediaStatus','startMicrophone','stopMicrophone','startSpeech','finishSpeech','speechStatus','status','captions','composer','captionText','sendCaption']){
    assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} must remain unique`);
  }
  assert.match(css,/html,body\{height:100%;overflow:hidden\}/);
  assert.match(css,/grid-template-rows:auto auto auto minmax\(0,1fr\) auto/);
  assert.match(css,/\.captions\{[\s\S]*?overflow:auto/);
  assert.match(css,/\.composer\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css,/@media \(max-width:700px\)/);
  assert.doesNotMatch(app,/startMicrophone\.hidden=true|stopMicrophone\.hidden=true/);
  assert.match(app,/let goldenMicrophoneReady=false/);
  assert.match(app,/휴대폰 내부 음성인식 연결 전/);
  assert.match(app,/실제 마이크 확인 완료/);
  assert.match(deploy,/data-v4-controls="pc-four-control-mobile-v1"/);
  assert.match(deploy,/on-device-browser-speech-v1/);
  assert.match(deploy,/processLocally/);
  assert.match(deploy,/prepareOnDeviceBrowserSpeech/);
  assert.match(module,/continuous=true/);
  assert.match(module,/onaudiostart/);
  assert.match(module,/onspeechend/);
  assert.doesNotMatch(module,/setTimeout|setInterval|MediaRecorder|getUserMedia/);
  assert.doesNotMatch(app,/setTimeout|setInterval/);
  assert.match(app,/navigator\.mediaDevices\.getUserMedia/);
  assert.match(app,/track\?\.stop\?\.\(\)/);
  assert.doesNotMatch(app,/createMobileTranscriptionAdapter|createMobileSpeechSession|MediaRecorder|\/transcribe/);
  assert.doesNotMatch(app,/mobile-speech-session|mobile-media-session/);
}

console.log('VOICEFLOW_V4_PHASE3_CONTINUOUS_BROWSER_SPEECH_RED_GREEN_PASS');
console.log('VOICEFLOW_V4_PHASE4_PC_FOUR_CONTROL_MOBILE_RED_GREEN_PASS');
console.log('VOICEFLOW_V4_ON_DEVICE_CHROME_SPEECH_PASS');
