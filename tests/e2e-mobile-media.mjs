import { chromium } from 'playwright';
const base=process.env.E2E_BASE_URL||'https://voice.star45.net';
const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--no-sandbox','--disable-cache']});
const context=await browser.newContext({permissions:['microphone','camera'],serviceWorkers:'block',viewport:{width:390,height:844}});
async function openHome(){const p=await context.newPage();p.setDefaultTimeout(10000);await p.goto(`${base}/?mobileMedia=${Date.now()}`,{waitUntil:'networkidle'});const lang=p.locator('[data-lang="ko"]');if(await lang.count())await lang.click();await p.waitForTimeout(200);return p}
async function run(id,label){const p=await openHome();const b=p.locator(id);await b.waitFor({state:'visible'});await b.click();await p.locator('#stopCapture').waitFor({state:'visible',timeout:3000});await p.waitForFunction(expected=>document.body.innerText.includes(expected),label,{timeout:6000});const marker=await p.evaluate(()=>window.__VOICEFLOW_MOBILE_MEDIA__);if(marker!=='stable-v266')throw new Error(`mobile marker=${marker}`);console.log(`PASS ${id} -> ${label}`);await p.close()}
try{
  await run('#quickMemoStart','음성메모 녹음 중');
  await run('#quickAudioStart','음성 녹음 중');
  await run('#quickVideoStart','영상 녹화 중');
  console.log('MOBILE REAL-CLICK MEDIA E2E PASS');
}finally{await browser.close()}
