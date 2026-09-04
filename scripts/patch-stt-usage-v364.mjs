import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverFile = path.join(__dirname, '../server-v2.mjs');
const appFile = path.join(__dirname, '../public/app.js');
const usageFile = path.join(__dirname, '../data/usage.json');

let server = fs.readFileSync(serverFile, 'utf8');
let app = fs.readFileSync(appFile, 'utf8');

// 1. data/usage.json 자동생성 - 다음부터 echo 불필요
if(!fs.existsSync(usageFile)){
  fs.mkdirSync(path.dirname(usageFile), {recursive:true});
  fs.writeFileSync(usageFile, '[]');
  console.log('usage.json auto-created');
}

const replace=(source,from,to,label)=>{if(!source.includes(from))throw new Error(`stt_usage_anchor_missing:${label}`);return source.replace(from,()=>to)};

// 2. server-v2.mjs 시작시 자동생성 가드 - 이미 있으면 중복 추가 안 함
if(!server.includes('existsSync(files.usage)')){
  server = server.replace(
    /const files=\{[^}]+\};/,
    (m)=> m + "\ntry{if(!fs.existsSync(files.usage)) fs.writeFileSync(files.usage,'[]');}catch(e){console.error('usage auto-create failed',e.message)}\n"
  );
}

if(!server.includes("'usage'")){
server=replace(server,
  "const names=['tasks','meetings','captions','events','users','sessions','consents','results'];",
  "const names=['tasks','meetings','captions','events','users','sessions','consents','results','usage'];",
  'usage-store');
}

server=replace(server,
  "const detect=t=>",
  "const STT_USD_PER_MIN={openai:0.006,google:0.006,azure:0.016,unknown:0};const usageCost=(provider,seconds)=>Number(((Number(seconds||0)/60)*(STT_USD_PER_MIN[String(provider||'unknown').toLowerCase()]||0)).toFixed(6));async function recordSttUsage(row){const rows=await rd(files.usage);rows.unshift({id:id('use'),kind:'stt',created_at:now(),...row});await wr(files.usage,rows.slice(0,50000))}function usageSummary(rows,from){const selected=rows.filter(x=>!from||Date.parse(x.created_at)>=from),byProvider={};for(const x of selected){const key=x.provider||'unknown',item=byProvider[key]||{provider:key,seconds:0,requests:0,success:0,failed:0,estimated_usd:0};item.seconds+=Number(x.duration_seconds||0);item.requests++;item.success+=x.ok?1:0;item.failed+=x.ok?0:1;item.estimated_usd+=Number(x.estimated_usd||0);byProvider[key]=item}const total=Object.values(byProvider).reduce((a,x)=>({seconds:a.seconds+x.seconds,requests:a.requests+x.requests,success:a.success+x.success,failed:a.failed+x.failed,estimated_usd:a.estimated_usd+x.estimated_usd}),{seconds:0,requests:0,success:0,failed:0,estimated_usd:0});return{total:{...total,estimated_usd:Number(total.estimated_usd.toFixed(6))},providers:Object.values(byProvider).map(x=>({...x,estimated_usd:Number(x.estimated_usd.toFixed(6))}))}}\nconst detect=t=>",
  'usage-helpers');

const candidateTiming="const language=String(req.headers['x-voice-language']||'ko-KR'),result=await transcribeExternal(audio,{language,mimeType:mime,useRuntimeRouting:['v4-mobile','v4-local-stt-test'].includes(voiceClient)}),text=typeof result==='string'?result:String(result?.text||''),target=String(req.headers['x-voice-target']||''),settings=await rd(files.settings);";
if(server.includes(candidateTiming)){
  server=replace(server,
    candidateTiming,
    "const language=String(req.headers['x-voice-language']||'ko-KR'),usageStarted=Date.now(),durationSeconds=Math.max(0,Math.min(3600,Number(req.headers['x-voice-duration-ms']||0)/1000||5)),result=await transcribeExternal(audio,{language,mimeType:mime,useRuntimeRouting:['v4-mobile','v4-local-stt-test'].includes(voiceClient)}),text=typeof result==='string'?result:String(result?.text||''),target=String(req.headers['x-voice-target']||''),settings=await rd(files.settings);",
    'transcribe-timing-candidate');
}else{
  server=replace(server,
    "const language=String(req.headers['x-voice-language']||'ko-KR'),voiceClient=String(req.headers['x-voice-client']||'');const result=await transcribeExternal(audio,{language,mimeType:mime,useRuntimeRouting:voiceClient==='v4-mobile'}),text=typeof result==='string'?result:String(result?.text||''),target=String(req.headers['x-voice-target']||''),settings=await rd(files.settings);",
    "const language=String(req.headers['x-voice-language']||'ko-KR'),voiceClient=String(req.headers['x-voice-client']||''),usageStarted=Date.now(),durationSeconds=Math.max(0,Math.min(3600,Number(req.headers['x-voice-duration-ms']||0)/1000||5));const result=await transcribeExternal(audio,{language,mimeType:mime,useRuntimeRouting:voiceClient==='v4-mobile'}),text=typeof result==='string'?result:String(result?.text||''),target=String(req.headers['x-voice-target']||''),settings=await rd(files.settings);",
    'transcribe-timing');
}

server=replace(server,
  "if(text&&target&&target!==language){const tr=await translate(text,target,settings);translation=tr.text;translationProvider=tr.provider}return json(res,200,{ok:true,text,provider:result?.provider||'unknown',model:result?.model||'',language,target,translation,translation_provider:translationProvider})",
  "if(text&&target&&target!==language){const tr=await translate(text,target,settings);translation=tr.text;translationProvider=tr.provider}const usageProvider=result?.provider||'unknown',usageModel=result?.model||'';await recordSttUsage({meeting_id:transcribe[1],source:String(req.headers['x-voice-source']||'server'),provider:usageProvider,model:usageModel,duration_seconds:durationSeconds,bytes:audio.length,latency_ms:Date.now()-usageStarted,ok:true,estimated_usd:usageCost(usageProvider,durationSeconds)});return json(res,200,{ok:true,text,provider:usageProvider,model:usageModel,language,target,translation,translation_provider:translationProvider})",
  'transcribe-usage');

server=replace(server,
  "if(u.pathname==='/api/v1/admin/providers/status')return json(res,200",
  "if(u.pathname==='/api/v1/admin/usage'&&req.method==='GET'){const user=await me(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});const period=String(u.searchParams.get('period')||'month'),d=new Date(),from=period==='today'?new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime():period==='all'?0:new Date(d.getFullYear(),d.getMonth(),1).getTime();return json(res,200,{ok:true,data:{period,currency:'USD',krw_rate:Number(process.env.USD_KRW_RATE||1400),rates:STT_USD_PER_MIN,...usageSummary(await rd(files.usage),from)}})}\nif(u.pathname==='/api/v1/admin/providers/status')return json(res,200",
  'usage-api');

app=replace(app,
  '<section class="panel elevated"><div class="panel-title"><div><small>API & INTEGRATION</small>',
  '<section class="panel elevated" id="sttUsageCard"><div class="panel-title"><div><small>AI API USAGE</small><h2>STT 사용시간 · 예상비용</h2></div><span id="sttUsageBadge" class="status">집계 중</span></div><div class="module-grid"><div class="module-item"><div><b>이번 달 과금시간</b><small id="sttUsageTime">-</small></div></div><div class="module-item"><div><b>예상비용</b><small id="sttUsageCost">-</small></div></div><div class="module-item"><div><b>요청 성공 / 실패</b><small id="sttUsageRequests">-</small></div></div><div class="module-item"><div><b>집계 기준</b><small>서버 STT 실제 전송시간</small></div></div></div><div class="actions" style="margin-top:14px"><button id="refreshSttUsage">사용량 새로고침</button></div><div id="sttUsageProviders" class="small" style="margin-top:12px">공급자별 사용량을 불러오는 중입니다.</div></section><section class="panel elevated"><div class="panel-title"><div><small>API & INTEGRATION</small>',
  'admin-card');

app=replace(app,
  'async function loadIntegrationSummary(){',
  "async function loadSttUsage(){if(state.user?.role!=='admin')return;const time=$('#sttUsageTime'),cost=$('#sttUsageCost'),requests=$('#sttUsageRequests'),providers=$('#sttUsageProviders'),badge=$('#sttUsageBadge');if(!time)return;try{const d=(await api('/api/v1/admin/usage?period=month')).data||{},t=d.total||{},rate=Number(d.krw_rate||1400);time.textContent=((Number(t.seconds||0)/3600).toFixed(2))+'시간';cost.textContent='$'+Number(t.estimated_usd||0).toFixed(2)+' · 약 '+Math.round(Number(t.estimated_usd||0)*rate).toLocaleString()+'원';requests.textContent=(t.success||0)+' / '+(t.failed||0);providers.innerHTML=(d.providers||[]).map(x=>'<div>'+esc(x.provider)+' · '+(Number(x.seconds||0)/60).toFixed(1)+'분 · $'+Number(x.estimated_usd||0).toFixed(3)+'</div>').join('')||'아직 서버 STT 사용 기록이 없습니다.';badge.textContent='● 집계 정상';badge.className='status ok'}catch(e){badge.textContent='집계 실패';badge.className='status warn';providers.textContent='사용량 확인 실패: '+e.message}}\nasync function loadIntegrationSummary(){",
  'usage-loader');

app=replace(app,
  "$('#refreshIntegrationSummary')?.addEventListener('click',loadIntegrationSummary);",
  "$('#refreshIntegrationSummary')?.addEventListener('click',loadIntegrationSummary);\n  $('#refreshSttUsage')?.addEventListener('click',loadSttUsage);",
  'usage-bind');

app=replace(app,
  "if(state.view==='admin'){loadIntegrationSummary();loadDriveAdminCard()}",
  "if(state.view==='admin'){loadIntegrationSummary();loadDriveAdminCard();loadSttUsage()}",
  'usage-load');

fs.writeFileSync(serverFile,server);
fs.writeFileSync(appFile,app);
console.log('VoiceFlow STT usage v3.6.4 + auto-create v3.6.5 applied');
