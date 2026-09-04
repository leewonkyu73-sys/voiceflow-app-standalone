import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../server-v2.mjs',import.meta.url),'utf8');
const start=source.indexOf('const STT_TRAFFIC_WINDOW_MS=');
const end=source.indexOf('const transcribe=u.pathname.match',start);
assert.ok(start>=0&&end>start,'generated STT traffic guard missing');

const guardSource=source.slice(start,end);
assert.match(guardSource,/STT_SESSION_REQUEST_LIMIT=10/);
assert.match(guardSource,/STT_MEETING_REQUEST_LIMIT=80/);
assert.match(guardSource,/VOICEFLOW_STT_MAX_CONCURRENCY\|\|1/);
assert.match(source,/STT_USAGE_BATCH_SIZE=10/);
assert.match(source,/STT_USAGE_FLUSH_MS=5000/);
assert.match(source,/STT_USAGE_MAX_ROWS=10000/);
assert.doesNotMatch(source,/rows\.slice\(0,50000\)/);

let now=1000;
const context=vm.createContext({
  Map,Math,Number,String,
  process:{env:{}},
  Date:{now:()=>now}
});
vm.runInContext(`${guardSource}
globalThis.claimSttTrafficForTest=claimSttTraffic;`,context);
const claim=(meeting,session)=>context.claimSttTrafficForTest(meeting,session);

{
  const first=claim('meeting-active','session-a');
  assert.equal(first.allowed,true);
  const busy=claim('meeting-active','session-b');
  assert.equal(busy.allowed,false);
  assert.equal(busy.error,'stt_busy');
  assert.equal(busy.retryAfterMs,2000);
  first.release();
  first.release();
  const afterRelease=claim('meeting-active','session-b');
  assert.equal(afterRelease.allowed,true,'released capacity must be reusable');
  afterRelease.release();
}

{
  for(let i=0;i<10;i++){
    const accepted=claim('meeting-session-rate','same-session');
    assert.equal(accepted.allowed,true,`session request ${i+1} should fit the one-minute budget`);
    accepted.release();
  }
  const blocked=claim('meeting-session-rate','same-session');
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.error,'stt_rate_limited');
}

{
  for(let session=0;session<8;session++){
    for(let request=0;request<10;request++){
      const accepted=claim('meeting-eight-participants',`session-${session}`);
      assert.equal(accepted.allowed,true,`eight-participant budget rejected session ${session} request ${request}`);
      accepted.release();
    }
  }
  const blocked=claim('meeting-eight-participants','session-overflow');
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.error,'stt_rate_limited');
}

now+=60000;
{
  const afterWindow=claim('meeting-session-rate','same-session');
  assert.equal(afterWindow.allowed,true,'rate budget must reset after one minute');
  afterWindow.release();
}

console.log('STT_TRAFFIC_GUARD_PASS');
