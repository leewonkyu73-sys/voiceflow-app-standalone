import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadApprovedSkill,skillDistributionStatus} from '../lib/skill-distribution.mjs';
import {overlayHermesJobs} from '../lib/hermes-job-state.mjs';

const port=Number(process.env.CONNECTOR_PORT||4178);
const dataDir=process.env.CONNECTOR_DATA_DIR||'./data';
const usersFile=path.join(dataDir,'users.json');
const sessionsFile=path.join(dataDir,'sessions.json');
const auditFile=path.join(dataDir,'connector-v6-audit.json');
const hermesJobsFile=path.join(dataDir,'hermes-jobs.json');
const configFile=path.join(dataDir,'connector-v6-config.json');
const vaultPath=process.env.OBSIDIAN_VAULT_PATH||'';
await fs.mkdir(dataDir,{recursive:true});
for(const f of [auditFile,hermesJobsFile]){try{await fs.access(f)}catch{await fs.writeFile(f,'[]')}}
try{await fs.access(configFile)}catch{await fs.writeFile(configFile,JSON.stringify({discord:{}},null,2))}

const rd=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const wr=(f,d)=>fs.writeFile(f,JSON.stringify(d,null,2));
const now=()=>new Date().toISOString();
const uid=p=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload))};
const body=async req=>{let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}};
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));

async function currentUser(req){try{const sid=cookies(req).voiceflow_session;if(!sid)return null;const ss=await rd(sessionsFile),s=ss.find(x=>x.id===sid&&Date.parse(x.expires_at)>Date.now());if(!s)return null;const us=await rd(usersFile);return us.find(x=>x.id===s.user_id&&!x.deleted_at&&x.status==='active')||null}catch{return null}}
async function audit(user,type,payload={}){const a=await rd(auditFile),row={id:uid('cva'),user_id:user?.id||'',type,payload,created_at:now()};a.unshift(row);await wr(auditFile,a.slice(0,3000));return row}
function cleanSegment(s=''){return String(s).replace(/[\\/:*?"<>|]/g,'-').replace(/\.\./g,'').trim().slice(0,120)||'Untitled'}
function safeVaultFile(folder,name){if(!vaultPath)throw new Error('obsidian_not_configured');const base=path.resolve(vaultPath),target=path.resolve(base,cleanSegment(folder),`${cleanSegment(name)}.md`);if(!target.startsWith(base+path.sep))throw new Error('invalid_vault_path');return target}
async function discordApi(endpoint,opt={}){const token=process.env.DISCORD_BOT_TOKEN;if(!token)throw new Error('discord_not_configured');const r=await fetch(`https://discord.com/api/v10${endpoint}`,{...opt,headers:{'authorization':`Bot ${token}`,'content-type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(12000)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||`discord_http_${r.status}`);return d}
async function connectorConfig(){const c=await rd(configFile).catch(()=>({discord:{}}));return{discord:c.discord||{}}}
async function discordResolved(){const c=(await connectorConfig()).discord||{};return{guild_id:c.guild_id||process.env.DISCORD_GUILD_ID||'',notice_channel:c.notice_channel||process.env.DISCORD_NOTICE_CHANNEL_ID||'',task_channel:c.task_channel||process.env.DISCORD_TASK_CHANNEL_ID||'',voice_channel:c.voice_channel||process.env.DISCORD_VOICE_CHANNEL_ID||'',activity_app_id:c.activity_app_id||process.env.DISCORD_ACTIVITY_APP_ID||''}}
async function discordStatus(){const d=await discordResolved();return{configured:!!process.env.DISCORD_BOT_TOKEN&&!!d.guild_id,bot_token_configured:!!process.env.DISCORD_BOT_TOKEN,...d}}
function obsidianStatus(){return{configured:!!vaultPath,vault_path:vaultPath?path.basename(vaultPath):'',folders:['Meetings','Tasks','Projects','SOP','Research','AI-Employees','Company-Knowledge']}}
function hermesStatus(){return{configured:!!process.env.HERMES_BRIDGE_DIR||!!process.env.HERMES_ENABLED,mode:process.env.HERMES_BRIDGE_DIR?'file-queue':'prepared',bridge_dir:process.env.HERMES_BRIDGE_DIR?path.basename(process.env.HERMES_BRIDGE_DIR):'',worker_state:process.env.HERMES_BRIDGE_DIR?'result-overlay':'unconfigured',skill_distribution:skillDistributionStatus()}}
async function writeHermesBridgeJob(row){if(!process.env.HERMES_BRIDGE_DIR)return;const dir=path.resolve(process.env.HERMES_BRIDGE_DIR);await fs.mkdir(dir,{recursive:true});const target=path.join(dir,`${row.job_id}.json`),tmp=path.join(dir,`.${row.job_id}.${process.pid}.${Date.now()}.tmp`);await fs.writeFile(tmp,JSON.stringify(row,null,2));await fs.rename(tmp,target)}

const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
  if(u.pathname==='/health')return json(res,200,{ok:true,service:'voiceflow-connectors-v6',version:'1.2.0',hermes:hermesStatus(),obsidian:obsidianStatus(),discord:await discordStatus()});
  if(u.pathname==='/api/v1/connectors/v6/status'&&req.method==='GET'){const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});return json(res,200,{ok:true,data:{hermes:hermesStatus(),obsidian:obsidianStatus(),discord:await discordStatus()}})}
  if(u.pathname==='/api/v1/connectors/v6/config'&&req.method==='GET'){const user=await currentUser(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});return json(res,200,{ok:true,data:await connectorConfig()})}
  if(u.pathname==='/api/v1/connectors/v6/config'&&req.method==='PATCH'){const user=await currentUser(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});const b=await body(req),current=await connectorConfig(),d=b.discord||{},next={discord:{...current.discord,...Object.fromEntries(Object.entries({guild_id:d.guild_id,notice_channel:d.notice_channel,task_channel:d.task_channel,voice_channel:d.voice_channel,activity_app_id:d.activity_app_id}).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v||'')]))},updated_at:now(),updated_by:user.id};await wr(configFile,next);await audit(user,'connector.config.updated',{sections:['discord']});return json(res,200,{ok:true,data:next})}

  if(u.pathname==='/api/v1/discord/setup-check'&&req.method==='GET'){
    const user=await currentUser(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});if(!process.env.DISCORD_BOT_TOKEN)return json(res,409,{ok:false,error:'discord_bot_token_missing'});const resolved=await discordResolved();const bot=await discordApi('/users/@me');let guild=null,channels=[];if(resolved.guild_id){guild=await discordApi(`/guilds/${encodeURIComponent(resolved.guild_id)}`);channels=await discordApi(`/guilds/${encodeURIComponent(resolved.guild_id)}/channels`)}const byId=id=>channels.find(x=>x.id===id)||null;return json(res,200,{ok:true,data:{bot:{id:bot.id,username:bot.username,global_name:bot.global_name||''},guild:guild?{id:guild.id,name:guild.name}:null,selected:{notice:byId(resolved.notice_channel),task:byId(resolved.task_channel),voice:byId(resolved.voice_channel)},checks:{bot_auth:true,guild_access:!!guild,notice_channel:!!byId(resolved.notice_channel),task_channel:!!byId(resolved.task_channel),voice_channel:!!byId(resolved.voice_channel)}}})
  }
  if(u.pathname==='/api/v1/discord/guilds'&&req.method==='GET'){
    const user=await currentUser(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});const guilds=await discordApi('/users/@me/guilds');return json(res,200,{ok:true,data:guilds.map(g=>({id:g.id,name:g.name,owner:!!g.owner,permissions:g.permissions}))})
  }
  if(u.pathname==='/api/v1/discord/channels'&&req.method==='GET'){
    const user=await currentUser(req);if(!user||user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});const guild=String(u.searchParams.get('guild_id')||(await discordResolved()).guild_id||'');if(!guild)return json(res,400,{ok:false,error:'guild_id_required'});const channels=await discordApi(`/guilds/${encodeURIComponent(guild)}/channels`);return json(res,200,{ok:true,data:channels.filter(c=>[0,2,5,13,15,16].includes(c.type)).map(c=>({id:c.id,name:c.name,type:c.type,parent_id:c.parent_id||null,position:c.position||0})).sort((a,b)=>a.position-b.position)})
  }

  if(u.pathname==='/api/v1/obsidian/notes'&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const b=await body(req),folder=cleanSegment(b.folder||'Meetings'),title=cleanSegment(b.title||'Untitled'),file=safeVaultFile(folder,title);await fs.mkdir(path.dirname(file),{recursive:true});const front=[`---`,`title: ${JSON.stringify(title)}`,`source: VoiceFlow`,`created_at: ${now()}`,`created_by: ${JSON.stringify(user.name||user.id)}`,`---`,``,`# ${title}`,``].join('\n');const content=front+String(b.content||'');await fs.writeFile(file,content,'utf8');await audit(user,'obsidian.note.created',{folder,title});return json(res,201,{ok:true,data:{folder,title,file:path.relative(vaultPath,file)}})
  }
  if(u.pathname==='/api/v1/obsidian/search'&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});if(!vaultPath)return json(res,409,{ok:false,error:'obsidian_not_configured'});const b=await body(req),q=String(b.query||'').toLowerCase().trim();if(!q)return json(res,400,{ok:false,error:'query_required'});const out=[];async function walk(dir,depth=0){if(depth>4||out.length>=50)return;for(const e of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p,depth+1);else if(e.isFile()&&e.name.endsWith('.md')){const txt=await fs.readFile(p,'utf8').catch(()=> '');if(e.name.toLowerCase().includes(q)||txt.toLowerCase().includes(q))out.push({file:path.relative(vaultPath,p),preview:txt.replace(/\s+/g,' ').slice(0,240)})}}}await walk(path.resolve(vaultPath));await audit(user,'obsidian.search',{query:q,count:out.length});return json(res,200,{ok:true,data:out})
  }

  if(u.pathname==='/api/v1/hermes/jobs'&&req.method==='GET'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const jobs=(await rd(hermesJobsFile)).slice(0,100);return json(res,200,{ok:true,data:await overlayHermesJobs(jobs)})
  }
  if(u.pathname==='/api/v1/hermes/jobs'&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const b=await body(req);let skill_snapshot=null;if(b.skill){if(user.role!=='admin')return json(res,403,{ok:false,error:'admin_required'});try{skill_snapshot=await loadApprovedSkill(b.skill)}catch(e){return json(res,409,{ok:false,error:e.message})}}const row={job_id:uid('hrm'),type:String(b.type||'knowledge-task'),instruction:String(b.instruction||'').slice(0,4000),context:b.context||{},...(skill_snapshot?{skill_snapshot}:{}),status:'pending',requested_by:user.id,created_at:now()};if(!row.instruction)return json(res,400,{ok:false,error:'instruction_required'});const a=await rd(hermesJobsFile);a.unshift(row);await wr(hermesJobsFile,a.slice(0,2000));await writeHermesBridgeJob(row);await audit(user,'hermes.job.queued',{job_id:row.job_id,type:row.type,skill:skill_snapshot?{name:skill_snapshot.name,commit_sha:skill_snapshot.commit_sha,sha256:skill_snapshot.sha256}:null});return json(res,201,{ok:true,data:row})
  }

  if(u.pathname==='/api/v1/discord/messages'&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const b=await body(req),resolved=await discordResolved(),channel=String(b.channel_id||resolved.notice_channel||'');if(!channel)return json(res,409,{ok:false,error:'discord_channel_not_configured'});const d=await discordApi(`/channels/${encodeURIComponent(channel)}/messages`,{method:'POST',body:JSON.stringify({content:String(b.content||'').slice(0,1900)})});await audit(user,'discord.message.sent',{channel_id:channel,message_id:d.id});return json(res,201,{ok:true,data:{id:d.id,channel_id:d.channel_id}})
  }
  if(u.pathname==='/api/v1/discord/events'&&req.method==='POST'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const b=await body(req),resolved=await discordResolved(),guild=String(b.guild_id||resolved.guild_id||''),voice=String(b.voice_channel_id||resolved.voice_channel||''),start=new Date(b.start_at||Date.now()+3600000),end=new Date(b.end_at||start.getTime()+3600000);if(!guild)return json(res,409,{ok:false,error:'discord_guild_not_configured'});const payload=voice?{name:String(b.name||'VoiceFlow Meeting').slice(0,100),description:String(b.description||'').slice(0,1000),privacy_level:2,entity_type:2,channel_id:voice,scheduled_start_time:start.toISOString(),scheduled_end_time:end.toISOString()}:{name:String(b.name||'VoiceFlow Meeting').slice(0,100),description:String(b.description||'').slice(0,1000),privacy_level:2,entity_type:3,channel_id:null,entity_metadata:{location:String(b.location||'VoiceFlow').slice(0,100)},scheduled_start_time:start.toISOString(),scheduled_end_time:end.toISOString()};const d=await discordApi(`/guilds/${encodeURIComponent(guild)}/scheduled-events`,{method:'POST',body:JSON.stringify(payload)});await audit(user,'discord.event.created',{event_id:d.id,guild_id:guild,voice_channel_id:voice});return json(res,201,{ok:true,data:{id:d.id,name:d.name,status:d.status,entity_type:d.entity_type,channel_id:d.channel_id||null,join_url:voice?`https://discord.com/channels/${guild}/${voice}`:null}})
  }
  if(u.pathname==='/api/v1/discord/meeting-capabilities'&&req.method==='GET'){
    const user=await currentUser(req);if(!user)return json(res,401,{ok:false,error:'login_required'});const d=await discordStatus();return json(res,200,{ok:true,data:{scheduled_events:true,voice_channel_link:!!d.voice_channel,video_meeting_link:!!d.voice_channel,direct_camera_control:false,activity_embed:!!d.activity_app_id,voice_state_events:true,speaking_events:true,required_voice_event_permissions:['CREATE_EVENTS','VIEW_CHANNEL','CONNECT']}})
  }

  return json(res,404,{ok:false,error:'not_found'});
}catch(e){console.error(e);return json(res,500,{ok:false,error:'server_error',message:e.message})}});
server.listen(port,()=>console.log(`VoiceFlow Hermes/Obsidian/Discord Connector :${port}`));
