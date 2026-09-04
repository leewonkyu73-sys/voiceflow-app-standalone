import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MOBILE_SPEECH_STATE,
  createMobileSpeechSession,
  createMobileTranscriptionAdapter,
} from '../packages/mobile-speech-session/index.mjs';

function fakeRecorder({chunks=[{size:1200}],mimeType='audio/webm'}={}){
  const listeners=new Map();
  return {
    mimeType,
    state:'inactive',
    starts:0,
    stops:0,
    startArgument:null,
    addEventListener(name,listener){listeners.set(name,listener);},
    start(value){
      this.startArgument=value;
      this.starts+=1;
      this.state='recording';
    },
    stop(){
      if(this.state==='inactive')return;
      this.stops+=1;
      this.state='inactive';
      for(const data of chunks)listeners.get('dataavailable')?.({data});
      listeners.get('stop')?.();
    },
    emitTimedChunk(data=chunks[0]){
      listeners.get('dataavailable')?.({data});
    },
    fail(error=new Error('recorder_failed')){
      listeners.get('error')?.({error});
    },
  };
}

const stream={getAudioTracks:()=>[{readyState:'live'}]};
const mediaSession={
  getSnapshot:()=>({state:'active'}),
  getStream:()=>stream,
};
const createAudioBlob=(parts,{type})=>({parts,size:parts.reduce((sum,part)=>sum+part.size,0),type});

{
  const recorders=[];
  const transcriptions=[];
  const captions=[];
  const states=[];
  const session=createMobileSpeechSession({
    meetingId:'mtg_mobile_speech',
    mediaSession,
    captionSession:{submit:async(text,options)=>{captions.push({text,options});return {}}},
    transcribe:async request=>{
      transcriptions.push(request);
      return {text:'모바일 음성 원문입니다',provider:'openai',model:'existing-stt'};
    },
    createRecorder:()=>{
      const recorder=fakeRecorder();
      recorders.push(recorder);
      return recorder;
    },
    createAudioBlob,
    now:(()=>{let value=1000;return()=>value+=500})(),
  });
  session.subscribe(snapshot=>states.push(snapshot.state));

  session.startCapture({sourceLanguage:'ko-KR',targetLanguage:'vi-VN'});
  assert.equal(session.getSnapshot().state,MOBILE_SPEECH_STATE.RECORDING);
  assert.equal(recorders[0].starts,1);
  assert.equal(recorders[0].startArgument,6000);
  const completed=await session.finishCapture();
  assert.equal(completed.state,MOBILE_SPEECH_STATE.COMPLETED);
  assert.equal(completed.lastText,'모바일 음성 원문입니다');
  assert.equal(completed.provider,'openai');
  assert.equal(transcriptions.length,1);
  assert.equal(transcriptions[0].meetingId,'mtg_mobile_speech');
  assert.equal(transcriptions[0].language,'ko-KR');
  assert.equal(transcriptions[0].audio.size,1200);
  assert.deepEqual(captions,[{
    text:'모바일 음성 원문입니다',
    options:{sourceLanguage:'ko-KR',targetLanguage:'vi-VN',inputMode:'speech'},
  }]);
  assert.deepEqual(states.slice(0,5),['idle','recording','transcribing','committing','completed']);

  session.startCapture({sourceLanguage:'ko-KR',targetLanguage:'vi-VN'});
  await session.finishCapture();
  assert.equal(recorders.length,2,'a new clip may reuse the same media stream without a new permission request');
  assert.equal(mediaSession.getStream(),stream);
}

{
  const recorder=fakeRecorder();
  const captions=[];
  const session=createMobileSpeechSession({
    meetingId:'mtg_auto_finalize',
    mediaSession,
    captionSession:{submit:async text=>captions.push(text)},
    transcribe:async()=>({text:'버튼 한 번으로 입력된 음성',provider:'local-whisper-small'}),
    createRecorder:()=>recorder,
    createAudioBlob,
  });
  const completed=new Promise(resolve=>session.subscribe(snapshot=>{
    if(snapshot.state===MOBILE_SPEECH_STATE.COMPLETED)resolve(snapshot);
  }));
  session.startCapture();
  recorder.emitTimedChunk();
  const snapshot=await completed;
  assert.equal(recorder.stops,1,'first timed chunk must finalize without a second button');
  assert.equal(snapshot.lastText,'버튼 한 번으로 입력된 음성');
  assert.deepEqual(captions,['버튼 한 번으로 입력된 음성']);
}

{
  let transcribeCalls=0;
  const recorder=fakeRecorder({chunks:[{size:200}]});
  const session=createMobileSpeechSession({
    meetingId:'mtg_short_audio',
    mediaSession,
    captionSession:{submit:async()=>{}},
    transcribe:async()=>{transcribeCalls+=1;return {text:'unexpected'}},
    createRecorder:()=>recorder,
    createAudioBlob,
  });
  session.startCapture();
  await assert.rejects(()=>session.finishCapture(),/audio_too_short/);
  assert.equal(session.getSnapshot().state,MOBILE_SPEECH_STATE.RECOVERABLE_ERROR);
  assert.equal(session.getSnapshot().error,'audio_too_short');
  assert.equal(transcribeCalls,0);
}

{
  const recorder=fakeRecorder();
  let transcribeCalls=0;
  const session=createMobileSpeechSession({
    meetingId:'mtg_hidden_audio',
    mediaSession,
    captionSession:{submit:async()=>{}},
    transcribe:async()=>{transcribeCalls+=1;return {text:'unexpected'}},
    createRecorder:()=>recorder,
    createAudioBlob,
  });
  session.startCapture();
  session.cancelCapture('page_hidden');
  assert.equal(recorder.stops,1);
  assert.equal(transcribeCalls,0,'background cancellation must not transcribe or restart');
  assert.equal(session.getSnapshot().state,MOBILE_SPEECH_STATE.RECOVERABLE_ERROR);
  assert.equal(session.getSnapshot().error,'page_hidden');
  session.stop();
  session.stop();
  assert.equal(session.getSnapshot().state,MOBILE_SPEECH_STATE.STOPPED);
}

{
  const session=createMobileSpeechSession({
    meetingId:'mtg_unsupported_recorder',
    mediaSession,
    captionSession:{submit:async()=>{}},
    transcribe:async()=>({text:'unexpected'}),
    createRecorder:()=>{throw new Error('media_recorder_unsupported')},
    createAudioBlob,
  });
  assert.throws(()=>session.startCapture(),/media_recorder_unsupported/);
  assert.equal(session.getSnapshot().state,MOBILE_SPEECH_STATE.FATAL_ERROR);
  assert.equal(session.getSnapshot().error,'media_recorder_unsupported');
}

{
  const audio={size:2048,type:'audio/webm'};
  const calls=[];
  const adapter=createMobileTranscriptionAdapter({transport:async(url,options)=>{
    calls.push({url,options});
    return {
      ok:true,
      status:200,
      json:async()=>({ok:true,text:'테스트 원문',provider:'openai',model:'existing-stt'}),
    };
  }});
  const result=await adapter.transcribe({meetingId:'mtg_adapter_1',audio,mimeType:'audio/webm',language:'ko-KR'});
  assert.equal(result.text,'테스트 원문');
  assert.equal(calls[0].url,'/api/v1/meetings/mtg_adapter_1/transcribe');
  assert.equal(calls[0].options.headers['content-type'],'audio/webm');
  assert.equal(calls[0].options.headers['x-voice-language'],'ko-KR');
  assert.equal(calls[0].options.headers['x-voice-client'],'v4-mobile');
  assert.equal(calls[0].options.headers['x-voice-target'],undefined,'translation must happen only in the shared caption API');
  assert.equal(calls[0].options.body,audio);
}

{
  const app=await fs.readFile(new URL('../apps/mobile-pwa/app.mjs',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../apps/mobile-pwa/index.html',import.meta.url),'utf8');
  const serverSpeechModule=await fs.readFile(new URL('../packages/mobile-speech-session/index.mjs',import.meta.url),'utf8');
  assert.match(app,/createMobileBrowserSpeechSession/);
  assert.match(app,/prepareOnDeviceBrowserSpeech/);
  assert.match(app,/startSpeech\.addEventListener\('click'/);
  assert.match(app,/finishSpeech\.addEventListener\('click'/);
  assert.doesNotMatch(app,/createMobileSpeechSession|createMobileTranscriptionAdapter|new MediaRecorder|\/transcribe|mobile-speech-session/,'the active v4 Chrome route must not upload audio to server STT');
  assert.doesNotMatch(serverSpeechModule,/SpeechRecognition|webkitSpeechRecognition|setInterval|setTimeout/);
  assert.doesNotMatch(app,/setInterval|setTimeout/);
  assert.match(html,/id="startSpeech"/);
  assert.match(html,/id="finishSpeech"/);
  assert.doesNotMatch(html,/aria-live/);
}

console.log('VOICEFLOW_V4_PHASE2_MOBILE_SPEECH_SESSION_PASS');
console.log('VOICEFLOW_V4_ON_DEVICE_SERVER_STT_UNWIRED_PASS');
