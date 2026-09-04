import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function startSpeech(){');
const end=source.indexOf('\nfunction speechMatchesFixedLanguage',start);
assert.ok(start>=0&&end>start,'generated startSpeech function missing');
const functionSource=source.slice(start,end);

function createHarness({userAgent}){
  let serverStarts=0;
  const events=[],signals=[],committed=[];
  class MockSpeechRecognition{
    start(){events.push('recognition-start');this.onstart?.();this.onaudiostart?.()}
    stop(){events.push('recognition-stop')}
  }
  const state={lang:'ko',meeting:{id:'meeting-1',language:'ko-KR'},media:{recording:true,paused:false,stt:'idle',stream:{}},_speechGeneration:0};
  const context=vm.createContext({
    state,navigator:{userAgent},window:{webkitSpeechRecognition:MockSpeechRecognition},
    localStorage:{sourceLanguage:'ko-KR'},locale:{ko:'ko-KR'},performance:{now:()=>100},document:{querySelector:()=>null},
    clearTimeout:()=>{},setTimeout:()=>1,updateInterimText:()=>{},
    startServerSpeechFallback:()=>{serverStarts++;events.push('server-start')},
    stopServerSpeechFallback:()=>{},extendServerSpeechFallback:()=>{},showSpeechLatency:()=>{},
    setSpeechSignal:(signal,text)=>signals.push({signal,text}),postCaption:async(text,origin)=>committed.push({text,origin})
  });
  vm.runInContext(functionSource+';startSpeech()',context);
  return {state,events,signals,committed,serverStarts};
}

for(const userAgent of [
  'Mozilla/5.0 (Linux; Android 16; SM-F956N) AppleWebKit/537.36 Chrome/150.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1'
]){
  const h=createHarness({userAgent});
  assert.deepEqual(h.events,['server-start'],'mobile must use only the VPS STT path');
  assert.equal(h.serverStarts,1);
  assert.equal(h.state.media.stt,'server');
  assert.equal(h.state._speech,undefined,'mobile must not create browser SpeechRecognition');
}

{
  const h=createHarness({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150.0 Safari/537.36'});
  assert.deepEqual(h.events,['recognition-start'],'PC browser speech must remain unchanged');
  assert.equal(h.serverStarts,0);
  assert.equal(h.state._speech.continuous,true);
  const finalResult={0:{transcript:'PC 정상'},isFinal:true};
  await h.state._speech.onresult({resultIndex:0,results:[finalResult]});
  assert.deepEqual(h.committed,[{text:'PC 정상',origin:'browser'}]);
}

console.log('MOBILE_SERVER_PRIMARY_AND_PC_BROWSER_PASS');
