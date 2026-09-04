import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function stopServerSpeechFallback(){');
const end=source.indexOf('function startSpeech(){',start);
assert.ok(start>=0&&end>start,'generated server STT functions missing');
const functionSource=source.slice(start,end);
assert.match(functionSource,/SERVER_STT_SEGMENT_MS=6500/,'server STT segment budget missing');
assert.match(functionSource,/SERVER_STT_REQUEST_TIMEOUT_MS=20000/,'server STT timeout missing');
assert.match(functionSource,/'x-voice-client':'v4-mobile'/,'mobile traffic identity header missing');
assert.match(functionSource,/state\._serverSttTimer=setTimeout\(cycle,nextDelay\)/,'bounded retry delay missing');

function createHarness({pendingFetch=false,text='말해볼까',status=200,retryAfterMs=0}={}){
  let nextTimer=0,fetches=0;
  const requests=[];
  const timers=[],recorders=[],captions=[];
  class MockMediaRecorder{
    static isTypeSupported(){return true}
    constructor(stream,options){this.stream=stream;this.mimeType=options?.mimeType||'audio/webm';this.state='inactive';recorders.push(this)}
    start(){this.state='recording'}
    stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob([new Uint8Array(1200)],{type:this.mimeType})});this.stopPromise=Promise.resolve(this.onstop?.())}
  }
  const state={lang:'ko',meeting:{id:'meeting-1',language:'ko-KR'},media:{recording:true,paused:false,stream:{getAudioTracks:()=>[{kind:'audio'}]}}};
  const context=vm.createContext({
    state,Blob,AbortController,Date,encodeURIComponent,
    window:{MediaRecorder:MockMediaRecorder},MediaRecorder:MockMediaRecorder,
    localStorage:{sourceLanguage:'ko-KR'},locale:{ko:'ko-KR'},performance:{now:()=>100},document:{querySelector:()=>null},
    setTimeout:(fn,delay)=>{const timer={id:++nextTimer,fn,delay,cancelled:false};timers.push(timer);return timer.id},
    clearTimeout:id=>{const timer=timers.find(x=>x.id===id);if(timer)timer.cancelled=true},
    fetch:async(url,options)=>{fetches++;requests.push({url,options});if(pendingFetch)return await new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>{const error=new Error('aborted');error.name='AbortError';reject(error)},{once:true})});return {ok:status>=200&&status<300,status,json:async()=>({text,error:status===429?'stt_busy':'failed',retry_after_ms:retryAfterMs})}},
    updateInterimText:()=>{},postCaption:async(text,origin)=>{captions.push({text,origin})}
  });
  vm.runInContext(functionSource,context);
  return {state,context,timers,recorders,captions,requests,active:delay=>timers.filter(x=>!x.cancelled&&(delay===undefined||x.delay===delay)),get fetches(){return fetches}};
}

{
  const h=createHarness();
  vm.runInContext('startServerSpeechFallback()',h.context);
  assert.equal(h.recorders.length,1);
  assert.equal(h.active(6500).length,1,'Samsung shadow segment must retain the complete 6.5s capture window');
  const preRollTimer=h.active(6500)[0];
  vm.runInContext('extendServerSpeechFallback()',h.context);
  assert.equal(preRollTimer.cancelled,true,'speech detection must replace only the stop timer');
  assert.equal(h.active(6500).length,1);
  assert.equal(h.recorders.length,1,'speech detection must preserve pre-roll instead of restarting MediaRecorder');
  vm.runInContext('stopServerSpeechFallback()',h.context);
  await h.recorders[0].stopPromise;
  assert.equal(h.fetches,0,'browser ownership must discard a cancelled partial blob before upload');
  assert.deepEqual(h.captions,[]);
  assert.equal(h.active(250).length,0,'a cancelled recorder must not resurrect the server cycle');
  assert.equal(h.state._serverSttActive,false);
}

{
  const h=createHarness();
  vm.runInContext('startServerSpeechFallback()',h.context);
  h.active(6500)[0].fn();
  await h.recorders[0].stopPromise;
  assert.equal(h.fetches,1);
  assert.deepEqual(h.captions,[{text:'말해볼까',origin:'server'}]);
  assert.equal(h.requests[0].options.headers['x-voice-client'],'v4-mobile');
  assert.equal(h.requests[0].options.headers['x-voice-duration-ms'],'6500');
  assert.equal(h.requests[0].options.headers['x-voice-session-id'],'mobile');
  assert.equal(h.active(250).length,1,'an owned server segment must continue its capture cycle');
}

{
  const h=createHarness({text:''});
  vm.runInContext('startServerSpeechFallback()',h.context);
  h.active(6500)[0].fn();
  await h.recorders[0].stopPromise;
  assert.equal(h.fetches,1);
  assert.deepEqual(h.captions,[]);
  assert.equal(h.active(1500).length,1,'silence must slow the next upload cycle');
}

{
  const h=createHarness({status:429,retryAfterMs:7000});
  vm.runInContext('startServerSpeechFallback()',h.context);
  h.active(6500)[0].fn();
  await h.recorders[0].stopPromise;
  assert.equal(h.fetches,1);
  assert.equal(h.active(7000).length,1,'server retry budget must be honored');
}

{
  const h=createHarness({pendingFetch:true});
  vm.runInContext('startServerSpeechFallback()',h.context);
  h.active(6500)[0].fn();
  await Promise.resolve();
  assert.equal(h.fetches,1);
  const request=h.state._serverSttAbort;
  assert.ok(request,'in-flight fallback request must be tracked');
  vm.runInContext('stopServerSpeechFallback()',h.context);
  await h.recorders[0].stopPromise;
  assert.equal(request.signal.aborted,true,'browser ownership must abort an in-flight server request');
  assert.deepEqual(h.captions,[],'an aborted server request must never append a late caption');
  assert.equal(h.active(250).length,0);
}

console.log('MOBILE_SERVER_STT_OWNERSHIP_PASS');
