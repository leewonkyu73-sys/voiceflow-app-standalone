import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {normalizeEmployee,buildMeetingPrompt,chooseTurn,learningCandidate,meetingLabPlan} from '../lib/ai-employee-engine.mjs';
import {configured,openaiText,geminiText} from '../lib/provider-adapters.mjs';

const port=Number(process.env.AI_EMPLOYEE_PORT||4177);
const dataDir=process.env.AI_EMPLOYEE_DATA_DIR||'./data';
const employeesFile=path.join(dataDir,'ai-employees.json');
const memoryFile=path.join(dataDir,'ai-memory-candidates.json');
const auditFile=path.join(dataDir,'ai-tool-audit.json');
const usersFile=path.join(dataDir,'users.json');
const sessionsFile=path.join(dataDir,'sessions.json');
await fs.mkdir(dataDir,{recursive:true});
for(const f of [employeesFile,memoryFile,auditFile]){try{await fs.access(f)}catch{await fs.writeFile(f,'[]')}}
const rd=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const wr=(f,d)=>fs.writeFile(f,JSON.stringify(d,null,2));
const now=()=>new Date().toISOString();
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
const body=async req=>{let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}};
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
async function currentUser(req){try{const sid=cookies(req).voiceflow_session;if(!sid)return null;const sessions=await rd(sessionsFile),session=sessions.find(x=>x.id===sid&&Date.parse(x.expires_at)>Date.now());if(!session)return null;const users=await rd(usersFile);return users.find(x=>x.id===session.user_id&&!x.deleted_at&&x.status==='active')||null}catch{return null}}
const safeUser=u=>u&&({id:u.id,name:u.name,email:u.email,role:u.role,status:u.status});
const providerState=()=>({...configured(),claude:!!process.env.ANTHROPIC_API_KEY});
async function claudeText(instruction,input,model=''){
  if(!process.env.ANTHROPIC_API_KEY)throw new Error('provider_not_configured:claude');
  const r=await fetch(process.env.ANTHROPIC_API_URL||'https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:model||process.env.ANTHROPIC_TEXT_MODEL||'claude-sonnet-4-20250514',max_tokens:900,system:instruction,messages:[{role:'user',content:input}]})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`HTTP ${r.status}`);return String((d.content||[]).filter(x=>x.type==='text').map(x=>x.text||'').join('\n')).trim();
}
function localReply(employee,ctx={}){const role=employee.role||'advisor',topic=ctx.topic||'회의 안건',latest=ctx.latest||'';const prefix=role==='validator'?'검증 관점':role==='operations'?'실행 관점':role==='strategy'?'전략 관점':'담당 관점';return `${prefix}에서 ${topic}을 검토하면, 현재 확인된 정보만으로는 ${latest?'“'+latest.slice(0,80)+'”에 대한':'해당 안건에 대한'} 근거·담당자·기한을 명확히 하는 것이 우선입니다. 필요한 수치나 외부 사실은 조사 후 확정하고, 실행 작업은 승인 후 등록하겠습니다.`}
async function invokeEmployee(employee,ctx={}){
  const prompt=buildMeetingPrompt(employee,ctx),state=providerState();let provider=String(employee.model_provider||'auto').toLowerCase();
  if(provider==='anthropic')provider='claude';
  if(provider==='auto')provider=state.openai?'openai':state.gemini?'gemini':state.claude?'claude':'local';
  try{
    if(provider==='openai'&&state.openai)return{provider,text:await openaiText(prompt,ctx.latest||ctx.topic||'의견을 제시하세요.')};
    if(provider==='gemini'&&state.gemini)return{provider,text:await geminiText(prompt,ctx.latest||ctx.topic||'의견을 제시하세요.')};
    if(provider==='claude'&&state.claude)return{provider,text:await claudeText(prompt,ctx.latest||ctx.topic||'의견을 제시하세요.',employee.model_id||'')};
  }catch(e){return{provider:'local-fallback',text:localReply(employee,ctx),warning:e.message}}
  return{provider:'local-safe',text:localReply(employee,ctx)};
}
async function seedEmployees(){const a=await rd(employeesFile);if(a.length)return a;const seed=[
  normalizeEmployee({display_name:'전략이사 AI',title:'전략기획 이사',role:'strategy',mission:'사업전략, 투자효율, 수익성과 리스크를 검토하고 대안을 제시한다.',persona:{tone:'professional',decision_style:'evidence_first',expertise:['사업전략','투자분석','손익','시장조사'],challenge_level:'balanced'},search_policy:'web_allowed',skills:['market-research','pnl-analysis','meeting-challenge'],tool_permissions:['tasks.read','tasks.propose'],autonomy:'advise'}),
  normalizeEmployee({display_name:'운영팀장 AI',title:'운영팀장',role:'operations',mission:'실행 일정, 담당자, 현장 리스크를 구조화한다.',persona:{tone:'concise',decision_style:'execution_first',expertise:['운영','일정','현장'],challenge_level:'balanced'},skills:['schedule','operations','task-planning'],tool_permissions:['tasks.read','tasks.propose'],autonomy:'execute_with_approval'}),
  normalizeEmployee({display_name:'검증담당 AI',title:'검증실장',role:'validator',mission:'숫자, 전제, 계약조건과 누락된 근거를 검증한다.',persona:{tone:'critical',decision_style:'evidence_first',expertise:['검증','계약','리스크'],challenge_level:'high'},skills:['verification','risk-review'],tool_permissions:['tasks.read'],autonomy:'advise'})
];await wr(employeesFile,seed);return seed}
await seedEmployees();

const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
  if(u.pathname==='/health')return json(res,200,{ok:true,service:'voiceflow-ai-employee',version:'1.0.0',providers:providerState()});
  if(u.pathname==='/api/v1/ai-employees/providers/status')return json(res,200,{ok:true,data:providerState()});
  if(u.pathname==='/api/v1/ai-employees'&&req.method==='GET'){const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});return json(res,200,{ok:true,data:await rd(employeesFile),user:safeUser(user)})}
  if(u.pathname==='/api/v1/ai-employees'&&req.method==='POST'){const user=await currentUser(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});const b=await body(req),a=await rd(employeesFile),row=normalizeEmployee({...b,created_by:user.id});a.push(row);await wr(employeesFile,a);return json(res,201,{ok:true,data:row})}
  const emp=u.pathname.match(/^\/api\/v1\/ai-employees\/(aie_[A-Za-z0-9_]+)$/);if(emp&&req.method==='PATCH'){const user=await currentUser(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});const b=await body(req),a=await rd(employeesFile),i=a.findIndex(x=>x.employee_id===emp[1]);if(i<0)return json(res,404,{ok:false,error:'not_found'});a[i]=normalizeEmployee({...a[i],...b,employee_id:a[i].employee_id,created_at:a[i].created_at});await wr(employeesFile,a);return json(res,200,{ok:true,data:a[i]})}
  if(emp&&req.method==='DELETE'){const user=await currentUser(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});const a=await rd(employeesFile),i=a.findIndex(x=>x.employee_id===emp[1]);if(i<0)return json(res,404,{ok:false,error:'not_found'});a[i]={...a[i],status:'disabled',updated_at:now()};await wr(employeesFile,a);return json(res,200,{ok:true,data:a[i]})}
  const test=u.pathname.match(/^\/api\/v1\/ai-employees\/(aie_[A-Za-z0-9_]+)\/test$/);if(test&&req.method==='POST'){const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const employee=(await rd(employeesFile)).find(x=>x.employee_id===test[1]);if(!employee)return json(res,404,{ok:false,error:'not_found'});const b=await body(req),out=await invokeEmployee(employee,{topic:b.topic||'테스트 대화',latest:b.message||'현재 역할에서 필요한 의견을 제시하세요.',memories:[]});return json(res,200,{ok:true,data:{employee_id:employee.employee_id,name:employee.display_name,provider:out.provider,text:out.text,warning:out.warning||null}})}
  if(u.pathname==='/api/v1/ai-meeting/run'&&req.method==='POST'){const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const b=await body(req),all=await rd(employeesFile),selected=(Array.isArray(b.employee_ids)&&b.employee_ids.length?all.filter(x=>b.employee_ids.includes(x.employee_id)):all.filter(x=>x.status==='active')).slice(0,5),rounds=Math.max(1,Math.min(5,Number(b.rounds||2))),plan=meetingLabPlan({topic:b.topic,employees:selected,rounds});const transcript=[];let latest=String(b.opening||b.topic||'안건을 검토해 주세요.');let last=null;for(let r=1;r<=rounds;r++){for(let n=0;n<selected.length;n++){const employee=chooseTurn(selected,{last_speaker_id:last});if(!employee)break;const out=await invokeEmployee(employee,{topic:b.topic,latest,memories:transcript.slice(-4).map(x=>`${x.name}: ${x.text}`)});const row={round:r,employee_id:employee.employee_id,name:employee.display_name,title:employee.title,role:employee.role,provider:out.provider,text:out.text,warning:out.warning||null};transcript.push(row);latest=out.text;last=employee.employee_id;selected.push(selected.shift())}}
    const actions=transcript.filter(x=>/담당|기한|일정|실행|확인|조사/.test(x.text)).slice(0,8).map((x,i)=>({proposal_id:`prop_${Date.now().toString(36)}_${i}`,text:x.text.slice(0,180),owner:x.name,status:'awaiting_approval',source_employee_id:x.employee_id}));
    const result={plan,topic:b.topic||'AI 회의',transcript,actions,mode:'approval-gated',created_at:now()};return json(res,200,{ok:true,data:result})}
  if(u.pathname==='/api/v1/ai-memory/candidates'&&req.method==='GET'){const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});return json(res,200,{ok:true,data:await rd(memoryFile)})}
  if(u.pathname==='/api/v1/ai-memory/candidates'&&req.method==='POST'){const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const b=await body(req),employee=(await rd(employeesFile)).find(x=>x.employee_id===b.employee_id);if(!employee)return json(res,404,{ok:false,error:'not_found'});const c=learningCandidate(employee,b.meeting_result||{}),a=await rd(memoryFile);a.unshift(c);await wr(memoryFile,a.slice(0,1000));return json(res,201,{ok:true,data:c})}
  if(u.pathname==='/api/v1/ai-actions/propose'&&req.method==='POST'){const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const b=await body(req),row={audit_id:`aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,actor_id:user.id,employee_id:b.employee_id||'',action_type:b.action_type||'task.create',payload:b.payload||{},status:'awaiting_approval',created_at:now()},a=await rd(auditFile);a.unshift(row);await wr(auditFile,a.slice(0,2000));return json(res,201,{ok:true,data:row})}
  return json(res,404,{ok:false,error:'not_found'})
}catch(e){console.error(e);return json(res,500,{ok:false,error:'server_error',message:e.message})}});
server.listen(port,()=>console.log(`VoiceFlow AI Employee Service :${port}`));
