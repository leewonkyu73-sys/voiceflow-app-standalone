import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const port=Number(process.env.TASK_PORT||4176);
const dataDir=process.env.TASK_DATA_DIR||'./data';
const taskFile=path.join(dataDir,'tasks.json');
const userFile=path.join(dataDir,'users.json');
const sessionFile=path.join(dataDir,'sessions.json');
await fs.mkdir(dataDir,{recursive:true});
for(const f of [taskFile,userFile,sessionFile]){try{await fs.access(f)}catch{await fs.writeFile(f,'[]')}}

const rd=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const wr=(f,d)=>fs.writeFile(f,JSON.stringify(d,null,2));
const now=()=>new Date().toISOString();
const id=()=>`tsk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload))};
const body=async req=>{let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}};
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));

async function currentUser(req){const sid=cookies(req).voiceflow_session;if(!sid)return null;const sessions=await rd(sessionFile);const s=sessions.find(x=>x.id===sid&&Date.parse(x.expires_at)>Date.now());if(!s)return null;const users=await rd(userFile);return users.find(x=>x.id===s.user_id&&!x.deleted_at&&x.status==='active')||null}

function normalizeTask(b={},existing={}){const allowedStatus=['todo','doing','done','hold'];const allowedPriority=['low','normal','high','urgent'];const sync={google:existing.calendar_sync?.google||'idle',outlook:existing.calendar_sync?.outlook||'idle',discord:existing.calendar_sync?.discord||'idle',...(b.calendar_sync||{})};const discordRequested=b.discord_sync_requested===undefined?!!existing.discord_sync_requested:!!b.discord_sync_requested;if(discordRequested&&!existing.discord_event_id&&sync.discord==='idle')sync.discord='pending';return{
  ...existing,
  id:existing.id||id(),
  title:String(b.title??existing.title??'새 업무').trim().slice(0,200),
  description:String(b.description??existing.description??''),
  owner:String(b.owner??existing.owner??'미지정'),
  owner_id:String(b.owner_id??existing.owner_id??''),
  department:String(b.department??existing.department??''),
  work_type:['task','schedule'].includes(b.work_type)?b.work_type:(existing.work_type||'task'),
  visibility:['private_personal','individual_company','shared_company'].includes(b.visibility)?b.visibility:(existing.visibility||(b.scope==='company'?'shared_company':b.scope==='department'?'individual_company':'private_personal')),
  scope:['personal','department','company'].includes(b.scope)?b.scope:(existing.scope||'personal'),
  deadline:String(b.deadline??existing.deadline??''),
  start_at:String(b.start_at??existing.start_at??''),
  time:String(b.time??existing.time??''),
  duration_minutes:Math.max(15,Math.min(1440,Number(b.duration_minutes??existing.duration_minutes??60))),
  status:allowedStatus.includes(b.status)?b.status:(existing.status||'todo'),
  priority:allowedPriority.includes(b.priority)?b.priority:(existing.priority||'normal'),
  progress:Math.max(0,Math.min(100,Number(b.progress??existing.progress??0))),
  discord_sync_requested:discordRequested,
  discord_event_id:String(existing.discord_event_id||b.discord_event_id||''),
  calendar_sync:sync,
  assignees:Array.isArray(b.assignees)?b.assignees.slice(0,30).map(x=>({id:String(x.id||''),name:String(x.name||'').slice(0,80)})):(existing.assignees||[]),
  recurrence:String(b.recurrence??existing.recurrence??'none'),
  notify_assignees:b.notify_assignees===undefined?!!existing.notify_assignees:!!b.notify_assignees,
  notification_status:String(b.notification_status??existing.notification_status??'none'),
  source_text:String(b.source_text??existing.source_text??'').slice(0,4000),
  source_meeting_id:String(b.source_meeting_id??existing.source_meeting_id??''),
  source_result_id:String(b.source_result_id??existing.source_result_id??''),
  decision_index:Number.isInteger(Number(b.decision_index))?Number(b.decision_index):(existing.decision_index??null),
  updated_at:now(),
  created_at:existing.created_at||now()
}}

function localDate(base=new Date()){return new Date(base.toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh'}))}
function isoDay(d){return d.toISOString().slice(0,10)}
function parseClock(text=''){const m=String(text).match(/(오전|오후)?\s*(\d{1,2})(?:시|:)(?:\s*(\d{1,2})분?)?/);if(!m)return'';let h=Number(m[2]),min=Number(m[3]||0);if(m[1]==='오후'&&h<12)h+=12;if(m[1]==='오전'&&h===12)h=0;return String(h).padStart(2,'0')+':'+String(min).padStart(2,'0')}
function parseDay(text='',base=localDate()){const explicit=String(text).match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);if(explicit)return explicit[1]+'-'+String(explicit[2]).padStart(2,'0')+'-'+String(explicit[3]).padStart(2,'0');const d=new Date(base);if(/모레/.test(text))d.setDate(d.getDate()+2);else if(/내일/.test(text))d.setDate(d.getDate()+1);else if(/오늘/.test(text)){}else{const names=['일','월','화','수','목','금','토'];const w=String(text).match(/(?:이번|다음)?\s*([일월화수목금토])요일/);if(w){let add=(names.indexOf(w[1])-d.getDay()+7)%7;if(/다음/.test(w[0]))add+=7;if(add===0)add=7;d.setDate(d.getDate()+add)}else return''}return isoDay(d)}
function parseRecurrence(text=''){if(/매일|매일마다/.test(text))return'daily';const w=String(text).match(/매주\s*([일월화수목금토])요일?/);if(w)return'weekly:'+w[1];if(/매주/.test(text))return'weekly';if(/매월|매달/.test(text))return'monthly';if(/매년/.test(text))return'yearly';return'none'}
function taskDrafts(text='',users=[]){const raw=String(text).trim();if(!raw)return[];let parts=raw.split(/\n+|[;；]+|(?:\s+(?:그리고|또한)\s+)(?=(?:[^,.]{0,40})(?:에게|담당|까지|오전|오후|\d{1,2}시))/).map(x=>x.trim()).filter(Boolean);if(parts.length===1){const numbered=raw.split(/(?:^|\s)(?:\d+[.)]|첫째|둘째|셋째)\s*/).map(x=>x.trim()).filter(Boolean);if(numbered.length>1)parts=numbered}return parts.slice(0,20).map((part,i)=>{const found=users.filter(u=>u?.name&&part.includes(u.name)).map(u=>({id:u.id,name:u.name}));const day=parseDay(part),time=parseClock(part);const duration=Number(part.match(/(\d+)\s*(?:분|시간)/)?.[1]||60)*(part.includes('시간')?60:1);const title=part.replace(/(?:오늘|내일|모레|이번|다음|매일|매주|매월|매달)[^,，.]{0,18}/g,'').replace(/(오전|오후)?\s*\d{1,2}(?:시|:)(?:\s*\d{1,2}분?)?/g,'').replace(/\s+/g,' ').trim()||('새 업무 '+(i+1));const workType=/(회의|미팅|방문|예약|상담|촬영|교육|행사|출발|도착|오전|오후|\d{1,2}시)/.test(part)?'schedule':'task',shared=/(우리|함께|공동|전사|전체|팀|부서)/.test(part)||found.length>1,privatePersonal=/(개인적으로|사적으로|개인 일정|내 개인)/.test(part);const visibility=privatePersonal?'private_personal':shared?'shared_company':'individual_company',missing=[];if(!found.length)missing.push('assignees');if(workType==='schedule'&&!day)missing.push('date');return{title,description:part,source_text:part,work_type:workType,visibility,assignees:found,owner:found[0]?.name||'미지정',owner_id:found[0]?.id||'',deadline:day,start_at:day&&time?day+'T'+time+':00':day,time,duration_minutes:Math.max(15,Math.min(1440,duration)),recurrence:parseRecurrence(part),notify_assignees:/알려|통보|공지|알림/.test(part),scope:visibility==='shared_company'?'company':visibility==='individual_company'?'department':'personal',priority:/긴급|급하게|최우선/.test(part)?'urgent':'normal',missing_fields:missing,ready:missing.length===0}})}

const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
  if(u.pathname==='/health'||u.pathname==='/api/v1/tasks/health')return json(res,200,{ok:true,service:'voiceflow-task-calendar',version:'1.1.0',discord_sync:!!process.env.DISCORD_BOT_TOKEN});
  if(u.pathname==='/api/v1/tasks/interpret'&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});
    const b=await body(req),users=await rd(userFile),drafts=taskDrafts(b.text,users.filter(x=>!x.deleted_at&&x.status==='active'));
    return json(res,200,{ok:true,data:{drafts,requires_confirmation:true,reference_timezone:'Asia/Ho_Chi_Minh'}});
  }
  if(u.pathname==='/api/v1/tasks/batch'&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});
    const b=await body(req);if(b.confirmed!==true)return json(res,400,{ok:false,error:'confirmation_required'});
    const items=Array.isArray(b.tasks)?b.tasks.slice(0,20):[];if(!items.length)return json(res,400,{ok:false,error:'tasks_required'});const incomplete=items.map((x,index)=>({index,missing:[...(!(x.assignees||[]).length?['assignees']:[]),...(x.work_type==='schedule'&&!String(x.start_at||x.deadline||'').trim()?['date']:[])]})).filter(x=>x.missing.length);if(incomplete.length)return json(res,400,{ok:false,error:'required_fields_missing',details:incomplete});
    const all=await rd(taskFile),created=items.map(x=>normalizeTask({...x,owner:x.owner||user.name,owner_id:x.owner_id||user.id,notification_status:x.notify_assignees?'pending':'none',discord_sync_requested:!!x.notify_assignees}));
    all.unshift(...created);await wr(taskFile,all);return json(res,201,{ok:true,data:created,notifications:{requested:created.filter(x=>x.notify_assignees).length,status:'pending'}});
  }
  if(u.pathname==='/api/v1/tasks'&&req.method==='GET'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});
    const owner=u.searchParams.get('owner'),status=u.searchParams.get('status'),scope=u.searchParams.get('scope');
    let all=await rd(taskFile);all=all.filter(x=>{const assigned=(x.assignees||[]).some(a=>a.id===user.id)||x.owner_id===user.id;if(x.visibility==='private_personal'&&!assigned)return false;if(x.visibility==='individual_company'&&!assigned&&user.role!=='admin')return false;return(!owner||x.owner===owner)&&(!status||x.status===status)&&(!scope||x.scope===scope)});
    return json(res,200,{ok:true,data:all});
  }
  if(u.pathname==='/api/v1/tasks'&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});
    const b=await body(req),all=await rd(taskFile);const row=normalizeTask({...b,owner:b.owner||user.name,owner_id:b.owner_id||user.id});all.unshift(row);await wr(taskFile,all);return json(res,201,{ok:true,data:row});
  }
  const m=u.pathname.match(/^\/api\/v1\/tasks\/(tsk_[A-Za-z0-9_]+)$/);
  if(m&&req.method==='PATCH'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});
    const b=await body(req),all=await rd(taskFile),i=all.findIndex(x=>x.id===m[1]);if(i<0)return json(res,404,{ok:false,error:'not_found'});
    const canEdit=user.role==='admin'||all[i].owner_id===user.id||!all[i].owner_id;if(!canEdit)return json(res,403,{ok:false,error:'forbidden'});
    const resetDiscord=!!b.discord_sync_requested&&!all[i].discord_sync_requested;all[i]=normalizeTask(b,all[i]);if(resetDiscord){all[i].discord_event_id='';all[i].calendar_sync={...(all[i].calendar_sync||{}),discord:'pending'}}await wr(taskFile,all);return json(res,200,{ok:true,data:all[i]});
  }
  const syncDiscord=u.pathname.match(/^\/api\/v1\/tasks\/(tsk_[A-Za-z0-9_]+)\/sync-discord$/);
  if(syncDiscord&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const all=await rd(taskFile),i=all.findIndex(x=>x.id===syncDiscord[1]);if(i<0)return json(res,404,{ok:false,error:'not_found'});const canEdit=user.role==='admin'||all[i].owner_id===user.id||!all[i].owner_id;if(!canEdit)return json(res,403,{ok:false,error:'forbidden'});all[i]={...all[i],discord_sync_requested:true,discord_event_id:'',calendar_sync:{...(all[i].calendar_sync||{}),discord:'pending'},updated_at:now()};await wr(taskFile,all);return json(res,202,{ok:true,data:all[i]})
  }
  if(m&&req.method==='DELETE'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});
    const all=await rd(taskFile),row=all.find(x=>x.id===m[1]);if(!row)return json(res,404,{ok:false,error:'not_found'});if(user.role!=='admin'&&row.owner_id&&row.owner_id!==user.id)return json(res,403,{ok:false,error:'forbidden'});
    await wr(taskFile,all.filter(x=>x.id!==m[1]));return json(res,200,{ok:true});
  }
  if(u.pathname==='/api/v1/tasks/sync/status'&&req.method==='GET'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});
    return json(res,200,{ok:true,data:{google:{configured:!!process.env.GOOGLE_CLIENT_ID,mode:'prepared'},outlook:{configured:!!process.env.MS_CLIENT_ID,mode:'prepared'},discord:{configured:!!process.env.DISCORD_BOT_TOKEN&&!!process.env.DISCORD_GUILD_ID&&!!process.env.DISCORD_VOICE_CHANNEL_ID,mode:'worker-sync'}}});
  }
  return json(res,404,{ok:false,error:'not_found'});
}catch(e){console.error(e);return json(res,500,{ok:false,error:'server_error',message:e.message})}});
server.listen(port,()=>console.log(`VoiceFlow Task Calendar API :${port}`));
