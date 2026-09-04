import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  LOCAL_WHISPER_PACK,
  MOBILE_INPUT_MODE,
  assessMobileInputPolicy,
  chooseSafeMobileInputMode,
} from '../packages/mobile-input-policy/index.mjs';
import {
  LOCAL_WHISPER_STATE,
  createLocalWhisperClient,
} from '../packages/mobile-local-whisper/index.mjs';
import {createMobileTranscriptionAdapter} from '../packages/mobile-speech-session/index.mjs';

{
  assert.deepEqual(Object.values(MOBILE_INPUT_MODE),['local-model','browser','server','text']);
  assert.equal(LOCAL_WHISPER_PACK.modelId,'onnx-community/whisper-small');
  assert.equal(LOCAL_WHISPER_PACK.revision,'36050c46d777d46dc4b5f43f6d90574fc38f8732');
  assert.equal(LOCAL_WHISPER_PACK.cacheKey,'voiceflow-local-stt-whisper-small-fp32-q4-v2');
  assert.equal(LOCAL_WHISPER_PACK.approximateBytes,600*1024*1024);
  assert.equal(LOCAL_WHISPER_PACK.dtype.encoder_model,'fp32');
  assert.equal(LOCAL_WHISPER_PACK.dtype.decoder_model_merged,'q4');

  const capable=assessMobileInputPolicy({
    webgpu:true,
    mediaRecorder:true,
    audioDecoder:true,
    browserSpeech:true,
    online:true,
    deviceMemory:8,
    hardwareConcurrency:8,
    storageQuota:1024*1024*1024,
    storageUsage:100*1024*1024,
    serverConsent:false,
  });
  assert.equal(capable.modes['local-model'].available,true);
  assert.equal(capable.recommended,'local-model');
  assert.equal(capable.modes.server.activatable,false,'server audio must require explicit consent');

  const constrained=assessMobileInputPolicy({
    webgpu:false,
    mediaRecorder:true,
    audioDecoder:true,
    browserSpeech:false,
    online:true,
    deviceMemory:2,
    hardwareConcurrency:2,
    storageQuota:300*1024*1024,
    storageUsage:100*1024*1024,
    serverConsent:false,
  });
  assert.equal(constrained.modes['local-model'].available,false);
  assert.equal(constrained.recommended,'text');
  assert.equal(chooseSafeMobileInputMode('server',constrained),'text');

  const consented=assessMobileInputPolicy({...constrained.capabilities,serverConsent:true});
  assert.equal(consented.modes.server.activatable,true);
  assert.equal(chooseSafeMobileInputMode('server',consented),'server');
}

{
  let sent=null;
  const adapter=createMobileTranscriptionAdapter({
    client:'v4-local-stt-test',
    audioConsent:'session',
    transport:async(url,options)=>{
      sent={url,options};
      return {ok:true,status:200,json:async()=>({text:'동의된 서버 인식',provider:'test'})};
    },
  });
  await adapter.transcribe({meetingId:'mtg_consent_contract',audio:{size:900,type:'audio/webm'},language:'ko-KR'});
  assert.equal(sent.options.headers['x-voice-client'],'v4-local-stt-test');
  assert.equal(sent.options.headers['x-voice-audio-consent'],'session');
}

class FakeWorker{
  constructor(){this.listeners=new Set();this.messages=[];}
  addEventListener(type,listener){if(type==='message')this.listeners.add(listener)}
  removeEventListener(type,listener){if(type==='message')this.listeners.delete(listener)}
  postMessage(message){this.messages.push(message)}
  emit(data){for(const listener of this.listeners)listener({data})}
  terminate(){this.terminated=true}
}

{
  const worker=new FakeWorker();
  let persisted=0;
  let deleted=0;
  const client=createLocalWhisperClient({
    createWorker:()=>worker,
    decodeAudio:async()=>new Float32Array([0.1,0.2,0.3]),
    requestPersistentStorage:async()=>{persisted+=1;return true},
    deleteCache:async key=>{assert.equal(key,LOCAL_WHISPER_PACK.cacheKey);deleted+=1;return true},
  });
  const install=client.install();
  assert.equal(worker.messages[0].type,'load');
  worker.emit({type:'progress',loaded:100,total:200,progress:50});
  assert.equal(client.getSnapshot().progress,50);
  worker.emit({type:'ready',requestId:worker.messages[0].requestId,modelId:LOCAL_WHISPER_PACK.modelId});
  await install;
  assert.equal(client.getSnapshot().state,LOCAL_WHISPER_STATE.READY);
  assert.equal(persisted,1);

  const transcription=client.transcribe({audio:{size:123},language:'ko-KR'});
  await Promise.resolve();
  const sent=worker.messages.at(-1);
  assert.equal(sent.type,'transcribe');
  assert.ok(sent.audio instanceof Float32Array);
  worker.emit({type:'result',requestId:sent.requestId,text:'회의를 시작합니다',provider:'local-whisper-small'});
  assert.equal((await transcription).text,'회의를 시작합니다');

  const noSpeech=client.transcribe({audio:{size:123},language:'ko-KR'});
  await Promise.resolve();
  const noSpeechRequest=worker.messages.at(-1);
  worker.emit({type:'error',requestId:noSpeechRequest.requestId,error:'speech_not_detected'});
  await assert.rejects(noSpeech,/speech_not_detected/);
  assert.equal(client.getSnapshot().state,LOCAL_WHISPER_STATE.READY,'a bad clip must not unload the downloaded model');

  await client.remove();
  assert.equal(deleted,1);
  assert.equal(client.getSnapshot().state,LOCAL_WHISPER_STATE.ABSENT);
}

{
  const html=await fs.readFile(new URL('../apps/mobile-local-stt-test/index.html',import.meta.url),'utf8');
  const app=await fs.readFile(new URL('../apps/mobile-local-stt-test/app.mjs',import.meta.url),'utf8');
  const css=await fs.readFile(new URL('../apps/mobile-local-stt-test/styles.css',import.meta.url),'utf8');
  const manifest=JSON.parse(await fs.readFile(new URL('../apps/mobile-local-stt-test/manifest.webmanifest',import.meta.url),'utf8'));
  const localServiceWorker=await fs.readFile(new URL('../apps/mobile-local-stt-test/local-sw.js',import.meta.url),'utf8');
  const worker=await fs.readFile(new URL('../apps/mobile-local-stt-test/local-whisper-worker.mjs',import.meta.url),'utf8');
  const server=await fs.readFile(new URL('../../server-v2.mjs',import.meta.url),'utf8');
  const deploy=await fs.readFile(new URL('../../deploy/complete-to-100-v262.sh',import.meta.url),'utf8');
  const usageGenerator=await fs.readFile(new URL('../../scripts/patch-stt-usage-v364.mjs',import.meta.url),'utf8');
  assert.match(html,/value="local-model"/);
  assert.match(html,/value="browser"/);
  assert.match(html,/value="server"/);
  assert.match(html,/value="text"/);
  assert.match(html,/id="serverConsent"/);
  assert.match(html,/id="installModel"/);
  assert.match(html,/id="registrationForm"/);
  assert.match(html,/name="termsAccepted"/);
  assert.match(html,/name="privacyAccepted"/);
  assert.match(html,/id="installPwa"/);
  assert.match(html,/href="\/v4\/local-stt-test\/manifest\.webmanifest"/);
  assert.match(html,/apple-mobile-web-app-capable/);
  assert.match(html,/apple-touch-icon/);
  assert.match(html,/minimum-scale=0\.5/);
  assert.match(html,/maximum-scale=5/);
  assert.match(html,/user-scalable=yes/);
  assert.match(html,/Whisper Small 고품질/);
  assert.match(html,/약 600MB/);
  assert.equal(manifest.id,'/v4/local-stt-test/');
  assert.equal(manifest.start_url,'/v4/local-stt-test/');
  assert.equal(manifest.scope,'/v4/local-stt-test/');
  assert.match(app,/voiceflow\.mobileInputMode\.v1/);
  assert.match(app,/sessionStorage/);
  assert.match(app,/\/api\/v1\/auth\/me/);
  assert.match(app,/\/api\/v1\/auth\/register/);
  assert.match(app,/candidateTransport\('\/api\/v1\/meetings'/);
  assert.match(app,/history\.replaceState/);
  assert.match(app,/termsAccepted/);
  assert.match(app,/privacyAccepted/);
  assert.match(app,/elements\.loginPanel\.open=true/);
  assert.match(app,/이미 가입된 이메일입니다\. 비밀번호를 입력해 로그인해 주세요/);
  assert.match(app,/beforeinstallprompt/);
  assert.match(app,/iPad\|iPhone\|iPod/);
  assert.match(app,/홈 화면에 추가/);
  assert.match(app,/register\('\/v4\/local-stt-test\/local-sw\.js'/);
  assert.match(app,/updateViaCache:'none'/);
  assert.match(app,/localModelErrorMessage/);
  assert.match(app,/createMobileTranscriptionAdapter/);
  assert.match(app,/audioConsent:'session'/);
  assert.match(app,/createLocalWhisperClient/);
  assert.match(worker,/onnx-community\/whisper-small/);
  assert.match(worker,/@huggingface\/transformers@4\.2\.0/);
  assert.match(worker,/device:'webgpu'/);
  assert.match(worker,/MODEL_REVISION='36050c46d777d46dc4b5f43f6d90574fc38f8732'/);
  assert.match(worker,/encoder_model:'fp32'/);
  assert.match(worker,/decoder_model_merged:'q4'/);
  assert.match(worker,/env\.cacheKey=CACHE_KEY/);
  assert.doesNotMatch(worker,/fetch\([^)]*\/transcribe/,'local worker must never upload audio');
  assert.match(server,/VOICEFLOW_V4_LOCAL_STT_ENABLED/);
  assert.match(server,/\/v4\/local-stt-test/);
  assert.match(deploy,/if \[ "\$\{VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED:-0\}" = "1" \]; then/);
  assert.equal(deploy.includes('if { [ "${VOICEFLOW_V4_MOBILE_ENABLED:-0}" = "1" ] && [ "${VOICEFLOW_V4_MOBILE_SERVER_STT_REQUIRED:-0}" = "1" ]; } || [ "${VOICEFLOW_V4_LOCAL_STT_ENABLED:-0}" = "1" ]; then'),false,'optional PWA server mode must not block deployment when the provider is unavailable');
  assert.match(deploy,/Optional server STT gate skipped; browser, downloaded-model and text modes remain available/);
  assert.match(usageGenerator,/transcribe-timing-candidate/);
  assert.match(usageGenerator,/\['v4-mobile','v4-local-stt-test'\]\.includes\(voiceClient\)/);
  assert.match(css,/-webkit-text-size-adjust:100%/);
  assert.match(css,/text-size-adjust:100%/);
  assert.match(css,/html,body\{height:auto;min-height:100%;overflow-x:auto;overflow-y:auto\}/);
  assert.match(css,/\.app-header\{flex-wrap:wrap\}/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(css,/\.media-actions button\{min-width:0;white-space:normal;overflow-wrap:anywhere/);
  assert.match(deploy,/encoder_model:'fp32'/);
  assert.match(deploy,/decoder_model_merged:'q4'/);
  assert.match(localServiceWorker,/voiceflow-local-stt-shell-v4/);
  assert.match(localServiceWorker,/url\.pathname\.startsWith\('\/api\/'\)/);
  assert.doesNotMatch(localServiceWorker,/onnx-community|huggingface\.co/,'the service worker must not pre-cache model weights');
}

console.log('VOICEFLOW_V4_PHASE4_MOBILE_INPUT_MODES_PASS');
