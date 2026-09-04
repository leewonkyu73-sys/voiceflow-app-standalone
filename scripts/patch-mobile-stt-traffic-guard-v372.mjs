import fs from 'node:fs';

const appFile=new URL('../public/app.js',import.meta.url);
const serverFile=new URL('../server-v2.mjs',import.meta.url);
let app=fs.readFileSync(appFile,'utf8');
let server=fs.readFileSync(serverFile,'utf8');
const replaceOnce=(text,from,to,label)=>{const at=text.indexOf(from);if(at<0)throw new Error('v372_anchor_missing:'+label);if(text.indexOf(from,at+from.length)>=0)throw new Error('v372_anchor_duplicate:'+label);return text.slice(0,at)+to+text.slice(at+from.length)};

server=replaceOnce(server,
  'const transcribe=u.pathname.match(',
  `const STT_TRAFFIC_WINDOW_MS=60000,STT_SESSION_REQUEST_LIMIT=10,STT_MEETING_REQUEST_LIMIT=80,STT_ACTIVE_LIMIT=Math.max(1,Math.min(2,Number(process.env.VOICEFLOW_STT_MAX_CONCURRENCY||1)));const sttTrafficBuckets=new Map();let sttActiveRequests=0;function sttTrafficRow(key,limit,at){let row=sttTrafficBuckets.get(key);if(!row||at-row.started_at>=STT_TRAFFIC_WINDOW_MS){row={started_at:at,count:0};sttTrafficBuckets.set(key,row)}return{key,row,limit}}function claimSttTraffic(meetingId,sessionId){const at=Date.now();if(sttTrafficBuckets.size>2000)for(const [key,row] of sttTrafficBuckets)if(at-row.started_at>STT_TRAFFIC_WINDOW_MS*2)sttTrafficBuckets.delete(key);const session=String(sessionId||'anonymous').replace(/[^A-Za-z0-9_-]/g,'').slice(0,80)||'anonymous',checks=[sttTrafficRow('meeting:'+meetingId,STT_MEETING_REQUEST_LIMIT,at),sttTrafficRow('session:'+meetingId+':'+session,STT_SESSION_REQUEST_LIMIT,at)],blocked=checks.find(x=>x.row.count>=x.limit);if(blocked)return{allowed:false,error:'stt_rate_limited',retryAfterMs:Math.max(1000,STT_TRAFFIC_WINDOW_MS-(at-blocked.row.started_at))};if(sttActiveRequests>=STT_ACTIVE_LIMIT)return{allowed:false,error:'stt_busy',retryAfterMs:2000};for(const item of checks)item.row.count+=1;sttActiveRequests+=1;let released=false;return{allowed:true,release(){if(released)return;released=true;sttActiveRequests=Math.max(0,sttActiveRequests-1)}}}
const transcribe=u.pathname.match(`,
  'server-traffic-guard');

const timingOld="const language=String(req.headers['x-voice-language']||'ko-KR'),usageStarted=Date.now(),durationSeconds=Math.max(0,Math.min(3600,Number(req.headers['x-voice-duration-ms']||0)/1000||5)),result=await transcribeExternal(audio,{language,mimeType:mime,useRuntimeRouting:['v4-mobile','v4-local-stt-test'].includes(voiceClient)}),text=typeof result==='string'?result:String(result?.text||''),target=String(req.headers['x-voice-target']||''),settings=await rd(files.settings);";
const timingNew="const language=String(req.headers['x-voice-language']||'ko-KR'),usageStarted=Date.now(),durationSeconds=Math.max(0,Math.min(3600,Number(req.headers['x-voice-duration-ms']||0)/1000||5)),traffic=claimSttTraffic(transcribe[1],String(req.headers['x-voice-session-id']||voiceClient||'anonymous'));if(!traffic.allowed)return json(res,429,{ok:false,error:traffic.error,retry_after_ms:traffic.retryAfterMs});let result;try{result=await transcribeExternal(audio,{language,mimeType:mime,useRuntimeRouting:['v4-mobile','v4-local-stt-test'].includes(voiceClient)})}finally{traffic.release()}const text=typeof result==='string'?result:String(result?.text||''),target=String(req.headers['x-voice-target']||''),settings=await rd(files.settings);";
server=replaceOnce(server,timingOld,timingNew,'server-transcribe-claim');

const usageOld="async function recordSttUsage(row){const rows=await rd(files.usage);rows.unshift({id:id('use'),kind:'stt',created_at:now(),...row});await wr(files.usage,rows.slice(0,50000))}";
const usageNew="const STT_USAGE_MAX_ROWS=10000,STT_USAGE_BATCH_SIZE=10,STT_USAGE_FLUSH_MS=5000;let sttUsageBuffer=[],sttUsageFlushTimer=null,sttUsageFlushPromise=null;function scheduleSttUsageFlush(){if(sttUsageFlushTimer||!sttUsageBuffer.length)return;sttUsageFlushTimer=setTimeout(()=>{sttUsageFlushTimer=null;flushSttUsage().catch(error=>console.warn('STT_USAGE_FLUSH_FAILED',String(error?.message||error)))},STT_USAGE_FLUSH_MS);sttUsageFlushTimer.unref?.()}async function flushSttUsage(){if(sttUsageFlushPromise)return sttUsageFlushPromise;if(sttUsageFlushTimer){clearTimeout(sttUsageFlushTimer);sttUsageFlushTimer=null}const batch=sttUsageBuffer.splice(0);if(!batch.length)return;sttUsageFlushPromise=(async()=>{const rows=await rd(files.usage);await wr(files.usage,[...[...batch].reverse(),...rows].slice(0,STT_USAGE_MAX_ROWS))})();try{await sttUsageFlushPromise}catch(error){sttUsageBuffer.unshift(...batch);throw error}finally{sttUsageFlushPromise=null;scheduleSttUsageFlush()}}async function recordSttUsage(row){sttUsageBuffer.push({id:id('use'),kind:'stt',created_at:now(),...row});if(sttUsageBuffer.length>=STT_USAGE_BATCH_SIZE)return flushSttUsage();scheduleSttUsageFlush()}";
server=replaceOnce(server,usageOld,usageNew,'usage-batch');

app=replaceOnce(app,'function startServerSpeechFallback(){',"const SERVER_STT_SEGMENT_MS=6500,SERVER_STT_REQUEST_TIMEOUT_MS=20000;\nfunction startServerSpeechFallback(){",'client-constants');
app=replaceOnce(app,'const segmentMs=6500','const segmentMs=SERVER_STT_SEGMENT_MS','client-segment');
app=replaceOnce(app,'state._serverSttActive=true;const owns=','state._serverSttActive=true;state._serverSttBackoffMs=0;const owns=','client-backoff-state');
app=replaceOnce(app,"const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});chunks=[];if(blob.size>900","const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});chunks=[];let nextDelay=250;if(blob.size>900",'client-next-delay-scope');
app=replaceOnce(app,'const request=new AbortController();state._serverSttAbort=request;try{','const request=new AbortController();state._serverSttAbort=request;const requestTimeout=setTimeout(()=>request.abort(),SERVER_STT_REQUEST_TIMEOUT_MS);try{','client-request-timeout');
app=replaceOnce(app,
  "headers:{'content-type':blob.type||'audio/webm','x-voice-language':lang}",
  "headers:{'content-type':blob.type||'audio/webm','x-voice-language':lang,'x-voice-client':'v4-mobile','x-voice-duration-ms':String(SERVER_STT_SEGMENT_MS),'x-voice-session-id':String(state.meeting?._peer||'mobile').slice(0,80)}",
  'client-traffic-headers');
app=replaceOnce(app,
  "const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||('HTTP '+response.status));if(!owns())return;const text=String(data.text||'').trim();if(text){state.media.stt='server';",
  "const data=await response.json().catch(()=>({}));if(!response.ok){if(response.status===429)nextDelay=Math.max(nextDelay,Math.min(30000,Number(data.retry_after_ms||2000)));throw new Error(data.error||('HTTP '+response.status))}if(!owns())return;const text=String(data.text||'').trim();if(text){state._serverSttBackoffMs=0;state.media.stt='server';",
  'client-response');
app=replaceOnce(app,
  "await postCaption(text,'server')}}catch(e){if(owns()&&e?.name!=='AbortError'){state.media.sttFallback='error';state.media.sttError=String(e?.message||e)}}finally{if(state._serverSttAbort===request)state._serverSttAbort=null}",
  "await postCaption(text,'server')}else{const emptyDelay=Math.min(6000,Math.max(1500,(state._serverSttBackoffMs||0)*2||1500));state._serverSttBackoffMs=emptyDelay;nextDelay=emptyDelay}}catch(e){if(owns()){const errorDelay=Math.min(30000,Math.max(2000,(state._serverSttBackoffMs||0)*2||2000));nextDelay=Math.max(nextDelay,errorDelay);state._serverSttBackoffMs=nextDelay;state.media.sttFallback=e?.name==='AbortError'?'timeout':'error';state.media.sttError=String(e?.message||e)}}finally{clearTimeout(requestTimeout);if(state._serverSttAbort===request)state._serverSttAbort=null}",
  'client-backoff');
app=replaceOnce(app,'state._serverSttTimer=setTimeout(cycle,250);else if(owns())stopServerSpeechFallback()','state._serverSttTimer=setTimeout(cycle,nextDelay);else if(owns())stopServerSpeechFallback()','client-next-cycle');

app=replaceOnce(app,"const APP_VERSION='3.5.23'","const APP_VERSION='3.5.24'",'app-version');

const indexFile=new URL('../public/index.html',import.meta.url);
let index=fs.readFileSync(indexFile,'utf8');
index=replaceOnce(index,'app.js?v=3.5.23','app.js?v=3.5.24','index-version');

const swFile=new URL('../public/sw.js',import.meta.url);
let sw=fs.readFileSync(swFile,'utf8');
sw=replaceOnce(sw,'voiceflow-shell-v349','voiceflow-shell-v350','pwa-cache');

for(const marker of [
  "const APP_VERSION='3.5.24'",
  "'x-voice-client':'v4-mobile'",
  'SERVER_STT_REQUEST_TIMEOUT_MS=20000',
  'state._serverSttTimer=setTimeout(cycle,nextDelay)',
  'STT_MEETING_REQUEST_LIMIT=80',
  'STT_ACTIVE_LIMIT=',
  'STT_USAGE_BATCH_SIZE=10',
  'rows].slice(0,STT_USAGE_MAX_ROWS)'
])if(!app.includes(marker)&&!server.includes(marker))throw new Error('v372_contract_missing:'+marker);

fs.writeFileSync(appFile,app);
fs.writeFileSync(serverFile,server);
fs.writeFileSync(indexFile,index);
fs.writeFileSync(swFile,sw);
console.log('VoiceFlow STT traffic and VPS CPU guard v3.5.24 applied');
