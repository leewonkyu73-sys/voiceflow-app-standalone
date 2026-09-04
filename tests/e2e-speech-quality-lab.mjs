import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const baseUrl=String(process.env.E2E_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const candidateUrl=String(process.env.E2E_SPEECH_QUALITY_LAB_URL||`${baseUrl}/v4/speech-quality-lab/`);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.message||error)));

try{
  const providerStatus=page.waitForResponse(response=>response.url().endsWith('/api/v1/speech-quality/providers'));
  await page.goto(candidateUrl,{waitUntil:'networkidle'});
  assert.equal((await providerStatus).status(),401,'anonymous quality lab must not reveal configured providers');

  const viewport=await page.locator('meta[name=viewport]').getAttribute('content');
  assert.match(viewport||'',/minimum-scale=0\.5/);assert.match(viewport||'',/maximum-scale=5/);assert.match(viewport||'',/user-scalable=yes/);
  await page.getByRole('heading',{name:'스마트폰 Chrome 음성 품질 비교'}).waitFor();
  await page.getByText('로그인 필요',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'말하기 시작'}).isEnabled(),true,'recording UI must remain testable before API setup');
  assert.equal(await page.getByRole('button',{name:'같은 녹음으로 비교 실행'}).isDisabled(),true,'external API run must stay disabled without auth/provider/consent');
  assert.equal(await page.locator('[data-provider]').count(),0,'anonymous users must not receive provider configuration');

  const layout=await page.evaluate(()=>({
    rootOverflowY:getComputedStyle(document.documentElement).overflowY,
    bodyOverflowY:getComputedStyle(document.body).overflowY,
    rootScrollWidth:document.documentElement.scrollWidth,
    rootClientWidth:document.documentElement.clientWidth,
    scrollHeight:document.scrollingElement?.scrollHeight||0,
    clientHeight:document.scrollingElement?.clientHeight||0,
    tableScroll:getComputedStyle(document.querySelector('.table-scroll')).overflowX,
  }));
  assert.notEqual(layout.rootOverflowY,'hidden');assert.notEqual(layout.bodyOverflowY,'hidden');
  assert.ok(layout.scrollHeight>layout.clientHeight,'mobile page must scroll vertically');
  assert.ok(layout.rootScrollWidth<=layout.rootClientWidth+1,'result table must not widen the document root');
  assert.ok(['auto','scroll'].includes(layout.tableScroll),'wide result table must scroll inside its own region');
  await page.evaluate(()=>window.scrollTo(0,document.scrollingElement.scrollHeight));
  await page.getByRole('heading',{name:'원문·정확도·속도'}).waitFor();

  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
  await page.waitForFunction(()=>Number(visualViewport?.scale||1)>=1.9);
  assert.ok(await page.evaluate(()=>Number(visualViewport?.scale||1))>=1.9,'page zoom must be available');
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});

  await page.waitForFunction(async()=>Boolean(await navigator.serviceWorker.getRegistration('/v4/speech-quality-lab/')));
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  const cacheEvidence=await page.evaluate(async()=>({keys:await caches.keys(),apiCached:Boolean(await caches.match('/api/v1/speech-quality/providers'))}));
  assert.ok(cacheEvidence.keys.includes('voiceflow-speech-quality-lab-v1'));
  assert.equal(cacheEvidence.apiCached,false,'private provider API must not enter Cache Storage');
  assert.deepEqual(errors,[]);
  console.log(`VOICEFLOW_SPEECH_QUALITY_LAB_LAYOUT_EVIDENCE ${JSON.stringify(layout)}`);
  console.log('VOICEFLOW_SPEECH_QUALITY_LAB_BROWSER_E2E_PASS');
}finally{
  await context.close();await browser.close();
}
