import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const baseUrl=String(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
let candidateUrl=String(process.env.E2E_LOCAL_STT_URL||'');
if(!candidateUrl){
  const created=await fetch(`${baseUrl}/api/v1/meetings`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({title:'Local STT browser E2E',type:'internal',demo_tag:'demo-v4-local-stt-e2e'}),
  });
  assert.equal(created.status,201);
  const meetingId=String((await created.json()).data?.id||'');
  assert.match(meetingId,/^mtg_/);
  candidateUrl=`${baseUrl}/v4/local-stt-test/?meeting=${encodeURIComponent(meetingId)}`;
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:360,height:640},
  deviceScaleFactor:2,
  isMobile:true,
  hasTouch:true,
});
const page=await context.newPage();
const errors=[];
let accountRegistered=false;
let persistedText='';
let accountEmail='';
const accountPassword='voiceflow-e2e-2026';
page.on('pageerror',error=>errors.push(String(error?.message||error)));

try{
  await page.goto(candidateUrl,{waitUntil:'networkidle'});
  const viewportContract=await page.locator('meta[name=viewport]').getAttribute('content');
  assert.match(viewportContract||'',/minimum-scale=0\.5/);
  assert.match(viewportContract||'',/maximum-scale=5/);
  assert.match(viewportContract||'',/user-scalable=yes/);
  await page.locator('#consentGate').waitFor({state:'visible'});
  assert.equal(await page.locator('#meetingApp').isVisible(),false);
  assert.equal(await page.locator('#installPwa').isVisible(),false,'install action must stay behind signup consent');
  const gateScroll=await page.evaluate(()=>({
    rootOverflowY:getComputedStyle(document.documentElement).overflowY,
    bodyOverflowY:getComputedStyle(document.body).overflowY,
    scrollHeight:document.scrollingElement?.scrollHeight||0,
    clientHeight:document.scrollingElement?.clientHeight||0,
  }));
  assert.notEqual(gateScroll.rootOverflowY,'hidden','mobile signup must allow finger scrolling on the document root');
  assert.notEqual(gateScroll.bodyOverflowY,'hidden','mobile signup must allow finger scrolling on the body');
  assert.ok(gateScroll.scrollHeight>gateScroll.clientHeight,'mobile signup must expose a vertically scrollable document');
  console.log(`VOICEFLOW_V4_MOBILE_SCROLL_EVIDENCE ${JSON.stringify(gateScroll)}`);

  accountEmail=`voiceflow-local-stt-${Date.now()}-${Math.random().toString(36).slice(2,8)}@example.com`;
  await page.locator('#registrationForm input[name=name]').fill('Local STT E2E');
  await page.locator('#registrationForm input[name=email]').fill(accountEmail);
  await page.locator('#registrationForm input[name=password]').fill(accountPassword);
  await page.locator('#registrationForm input[name=termsAccepted]').check();
  await page.locator('#registrationForm input[name=privacyAccepted]').check();
  const registration=page.waitForResponse(response=>response.url().endsWith('/api/v1/auth/register'));
  await page.locator('#registrationForm button[type=submit]').click();
  assert.equal((await registration).status(),201);
  accountRegistered=true;
  await page.locator('#meetingApp').waitFor({state:'visible'});
  assert.equal(await page.locator('#consentGate').isVisible(),false);
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
  await page.waitForFunction(()=>Number(visualViewport?.scale||1)>=1.9);
  const zoomedScale=await page.evaluate(()=>Number(visualViewport?.scale||1));
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
  await page.waitForFunction(()=>Number(visualViewport?.scale||1)<=1.1);
  const responsiveLayout=await page.evaluate(measuredZoomedScale=>{
    const status=document.querySelector('#status');
    const original=status.textContent;
    document.documentElement.style.fontSize='175%';
    status.textContent=`모델 준비 실패 · https://huggingface.co/onnx-community/whisper-small/resolve/${'a'.repeat(80)}/onnx/encoder_model.onnx`;
    const evidence={
      rootScrollWidth:document.documentElement.scrollWidth,
      rootClientWidth:document.documentElement.clientWidth,
      bodyScrollWidth:document.body.scrollWidth,
      bodyClientWidth:document.body.clientWidth,
      textSizeAdjust:getComputedStyle(document.documentElement).webkitTextSizeAdjust,
      zoomedScale:measuredZoomedScale,
      overflowing:[...document.body.querySelectorAll('*')].map(node=>{
        const rect=node.getBoundingClientRect();
        return {tag:node.tagName,id:node.id,className:String(node.className||''),left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width)};
      }).filter(item=>item.left<-1||item.right>document.body.clientWidth+1).slice(0,12),
    };
    status.textContent=original;
    document.documentElement.style.fontSize='';
    return evidence;
  },zoomedScale);
  console.log(`VOICEFLOW_V4_MOBILE_SCALE_EVIDENCE ${JSON.stringify(responsiveLayout)}`);
  assert.ok(responsiveLayout.rootScrollWidth<=responsiveLayout.rootClientWidth+1,'large Android text must not widen the document root');
  assert.ok(responsiveLayout.bodyScrollWidth<=responsiveLayout.bodyClientWidth+1,'long model errors must wrap inside the mobile body');
  assert.equal(responsiveLayout.textSizeAdjust,'100%');

  await context.clearCookies();
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#consentGate').waitFor({state:'visible'});
  await page.locator('.login-panel summary').click();
  assert.equal(await page.locator('.login-panel').getAttribute('open'),'');
  await page.locator('.login-panel summary').click();
  await page.locator('#registrationForm input[name=name]').fill('Existing Local STT E2E');
  await page.locator('#registrationForm input[name=email]').fill(accountEmail);
  await page.locator('#registrationForm input[name=password]').fill(accountPassword);
  await page.locator('#registrationForm input[name=termsAccepted]').check();
  await page.locator('#registrationForm input[name=privacyAccepted]').check();
  const duplicateRegistration=page.waitForResponse(response=>response.url().endsWith('/api/v1/auth/register'));
  await page.locator('#registrationForm button[type=submit]').click();
  assert.equal((await duplicateRegistration).status(),409,'an existing email must be routed to login');
  assert.equal(await page.locator('.login-panel').getAttribute('open'),'');
  assert.equal(await page.locator('#loginForm input[name=email]').inputValue(),accountEmail);
  await page.locator('#authStatus').getByText('이미 가입된 이메일입니다.').waitFor();
  await page.locator('#loginForm input[name=password]').fill(accountPassword);
  const login=page.waitForResponse(response=>response.url().endsWith('/api/v1/auth/login'));
  await page.locator('#loginForm button[type=submit]').click();
  assert.equal((await login).status(),200,'an existing account must be able to log in');
  await page.locator('#meetingApp').waitFor({state:'visible'});
  assert.equal(await page.locator('#consentGate').isVisible(),false);
  console.log('VOICEFLOW_V4_MOBILE_SCROLL_LOGIN_PASS');

  const modeValues=await page.locator('input[name=inputMode]').evaluateAll(nodes=>nodes.map(node=>node.value));
  assert.deepEqual(modeValues,['local-model','browser','server','text']);
  const automaticSpeechEvidence=await page.evaluate(async()=>{
    const {MOBILE_SPEECH_STATE,createMobileSpeechSession}=await import('/v4/local-stt-test/modules/mobile-speech-session/index.mjs');
    const listeners=new Map();
    const recorder={
      mimeType:'audio/webm',state:'inactive',startArgument:null,stopCalls:0,
      addEventListener(name,listener){listeners.set(name,listener)},
      start(value){this.startArgument=value;this.state='recording'},
      stop(){if(this.state==='inactive')return;this.stopCalls+=1;this.state='inactive';listeners.get('stop')?.()},
      emit(){listeners.get('dataavailable')?.({data:{size:1600}})},
    };
    const captions=[];
    const session=createMobileSpeechSession({
      meetingId:'mtg_browser_auto_finalize',
      mediaSession:{getSnapshot:()=>({state:'active'}),getStream:()=>({getAudioTracks:()=>[{readyState:'live'}]})},
      captionSession:{submit:async text=>captions.push(text)},
      transcribe:async()=>({text:'브라우저 자동 음성 입력',provider:'local-whisper-small'}),
      createRecorder:()=>recorder,
      createAudioBlob:(parts,{type})=>({size:parts.reduce((sum,part)=>sum+part.size,0),type}),
    });
    const completed=new Promise(resolve=>session.subscribe(snapshot=>{
      if(snapshot.state===MOBILE_SPEECH_STATE.COMPLETED)resolve(snapshot);
    }));
    session.startCapture();
    recorder.emit();
    const snapshot=await completed;
    return {startArgument:recorder.startArgument,stopCalls:recorder.stopCalls,state:snapshot.state,lastText:snapshot.lastText,captions};
  });
  console.log(`VOICEFLOW_V4_MOBILE_AUTO_FINALIZE_EVIDENCE ${JSON.stringify(automaticSpeechEvidence)}`);
  assert.deepEqual(automaticSpeechEvidence,{startArgument:6000,stopCalls:1,state:'completed',lastText:'브라우저 자동 음성 입력',captions:['브라우저 자동 음성 입력']});
  await page.locator('input[name=inputMode][value=server]').click();
  assert.equal(await page.locator('input[name=inputMode]:checked').getAttribute('value'),'text','server mode must not activate before session consent');
  await page.locator('#serverConsent').check();
  await page.locator('input[name=inputMode][value=server]').check();
  assert.equal(await page.locator('input[name=inputMode]:checked').getAttribute('value'),'server');
  await page.locator('input[name=inputMode][value=text]').check();
  assert.equal(await page.locator('#startMicrophone').isDisabled(),true,'text-only mode must keep microphone disabled');

  if(process.env.E2E_WRITE_SAMPLE==='1'){
    persistedText=`회의 정리 계약 ${Date.now()}`;
    await page.locator('#captionText').fill(persistedText);
    const caption=page.waitForResponse(response=>response.url().includes('/captions')&&response.request().method()==='POST');
    await page.locator('#sendCaption').click();
    assert.equal((await caption).status(),201);
    await page.locator('.caption-card .original',{hasText:persistedText}).waitFor();

    await page.reload({waitUntil:'networkidle'});
    await page.locator('#meetingApp').waitFor({state:'visible'});
    assert.equal(await page.locator('#consentGate').isVisible(),false,'signup session must survive reload');
    assert.equal(await page.locator('input[name=inputMode]:checked').getAttribute('value'),'text','per-device input mode must survive reload');
    await page.locator('.caption-card .original',{hasText:persistedText}).waitFor();
  }

  await page.waitForFunction(async()=>Boolean(await navigator.serviceWorker.getRegistration('/v4/local-stt-test/')));
  const cacheEvidence=await page.evaluate(async()=>({
    keys:await caches.keys(),
    apiCached:Boolean(await caches.match('/api/v1/auth/me')),
  }));
  assert.equal(cacheEvidence.apiCached,false,'private API responses must not enter PWA caches');
  assert.ok(cacheEvidence.keys.includes('voiceflow-local-stt-shell-v4'));
  assert.deepEqual(errors,[]);

  console.log('VOICEFLOW_V4_LOCAL_STT_BROWSER_E2E_PASS');
}finally{
  if(accountRegistered){
    await page.evaluate(()=>fetch('/api/v1/account/delete',{method:'POST',credentials:'same-origin'})).catch(()=>{});
  }
  await context.close();
  await browser.close();
}
