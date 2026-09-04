import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MOBILE_MEDIA_STATE,
  createMobileMediaSession,
} from '../packages/mobile-media-session/index.mjs';

function deferred(){
  let resolve;
  let reject;
  const promise=new Promise((ok,fail)=>{
    resolve=ok;
    reject=fail;
  });
  return {promise,resolve,reject};
}

function fakeTrack(){
  const listeners=new Map();
  return {
    enabled:true,
    readyState:'live',
    stopCalls:0,
    addEventListener(name,listener){listeners.set(name,listener);},
    stop(){
      if(this.readyState==='ended')return;
      this.stopCalls+=1;
      this.readyState='ended';
    },
    end(){
      this.readyState='ended';
      listeners.get('ended')?.();
    },
  };
}

function fakeStream(track=fakeTrack()){
  return {
    track,
    getAudioTracks:()=>[track],
    getTracks:()=>[track],
  };
}

{
  const gate=deferred();
  const stream=fakeStream();
  let requests=0;
  const session=createMobileMediaSession({
    requestStream:async constraints=>{
      requests+=1;
      assert.deepEqual(constraints,{audio:true,video:false});
      return gate.promise;
    },
  });
  const states=[];
  session.subscribe(snapshot=>states.push(snapshot.state));

  const first=session.start();
  const second=session.start();
  assert.equal(requests,1,'concurrent start must share one permission request');
  assert.equal(first,second,'concurrent start must share one promise');
  gate.resolve(stream);
  assert.equal(await first,stream);
  assert.equal(await second,stream);
  assert.equal(session.getSnapshot().state,MOBILE_MEDIA_STATE.ACTIVE);
  assert.equal(session.getSnapshot().permissionRequests,1);

  session.setVisibility('hidden');
  assert.equal(session.getSnapshot().state,MOBILE_MEDIA_STATE.SUSPENDED);
  assert.equal(stream.track.enabled,false);
  session.setVisibility('visible');
  assert.equal(session.getSnapshot().state,MOBILE_MEDIA_STATE.ACTIVE);
  assert.equal(stream.track.enabled,true);
  assert.equal(requests,1,'foreground return must reuse the existing stream');
  assert.deepEqual(states.slice(0,3),['idle','requesting','active']);

  stream.track.end();
  assert.equal(session.getSnapshot().state,MOBILE_MEDIA_STATE.RECOVERABLE_ERROR);
  assert.equal(session.getSnapshot().error,'audio_track_ended');
  await assert.rejects(()=>session.start(),/mobile_media_session_not_restartable/);
  assert.equal(requests,1,'track end must never trigger automatic reacquisition');
}

{
  const stream=fakeStream();
  const session=createMobileMediaSession({requestStream:async()=>stream});
  await session.start();
  session.stop();
  session.stop();
  assert.equal(stream.track.stopCalls,1,'stop must be idempotent');
  assert.equal(session.getSnapshot().state,MOBILE_MEDIA_STATE.STOPPED);
}

{
  let requests=0;
  const denied=Object.assign(new Error('denied'),{name:'NotAllowedError'});
  const session=createMobileMediaSession({requestStream:async()=>{
    requests+=1;
    throw denied;
  }});
  await assert.rejects(()=>session.start(),error=>error===denied);
  assert.equal(session.getSnapshot().state,MOBILE_MEDIA_STATE.FATAL_ERROR);
  assert.equal(session.getSnapshot().error,'permission_denied');
  await assert.rejects(()=>session.start(),/mobile_media_session_not_restartable/);
  assert.equal(requests,1,'permission failure must not loop or prompt again');
}

{
  const stream={getAudioTracks:()=>[],getTracks:()=>[]};
  const session=createMobileMediaSession({requestStream:async()=>stream});
  await assert.rejects(()=>session.start(),/audio_track_missing/);
  assert.equal(session.getSnapshot().state,MOBILE_MEDIA_STATE.FATAL_ERROR);
  assert.equal(session.getSnapshot().error,'audio_track_missing');
}

{
  const gate=deferred();
  const stream=fakeStream();
  const session=createMobileMediaSession({requestStream:()=>gate.promise});
  const pending=session.start();
  session.stop();
  gate.resolve(stream);
  await assert.rejects(()=>pending,/mobile_media_session_stopped/);
  assert.equal(stream.track.stopCalls,1,'a late stream must be released after stop');
  assert.equal(session.getSnapshot().state,MOBILE_MEDIA_STATE.STOPPED);
}

{
  const app=await fs.readFile(new URL('../apps/mobile-pwa/app.mjs',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../apps/mobile-pwa/index.html',import.meta.url),'utf8');
  const mediaModule=await fs.readFile(new URL('../packages/mobile-media-session/index.mjs',import.meta.url),'utf8');
  assert.match(app,/startMicrophone\.addEventListener\('click'/);
  assert.match(app,/visibilitychange/);
  assert.match(app,/MOBILE_BROWSER_SPEECH_STATE\.PREPARING/);
  assert.match(app,/navigator\.mediaDevices\.getUserMedia/,'the microphone button must verify real browser microphone access');
  assert.match(app,/track\?\.stop\?\.\(\)/,'the microphone probe stream must be released before browser recognition owns audio');
  assert.doesNotMatch(app,/createMobileMediaSession|mobile-media-session|mediaSession\?\.setVisibility/,'the Chrome on-device route must not keep a parallel media stream');
  assert.doesNotMatch(mediaModule,/setTimeout|setInterval|SpeechRecognition/,'mobile media module must not add timers or browser STT owners');
  assert.doesNotMatch(app,/setTimeout|setInterval/,'the composed mobile app must not add automatic cycles');
  assert.match(html,/id="startMicrophone"/);
  assert.match(html,/id="stopMicrophone"/);
  assert.doesNotMatch(html,/aria-live/,'media state must not create repeated accessibility announcements');
}

console.log('VOICEFLOW_V4_PHASE2_MOBILE_MEDIA_SESSION_PASS');
console.log('VOICEFLOW_V4_ON_DEVICE_MICROPHONE_PROBE_PASS');
