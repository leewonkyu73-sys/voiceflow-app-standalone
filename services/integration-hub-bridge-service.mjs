import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {ensureIntegrationStore,getIntegrationSecret,setIntegrationSecret,getIntegrationConfig,setIntegrationConfig,secretConfigured} from '../lib/integration-secrets.mjs';

const port=Number(process.env.INTEGRATION_HUB_BRIDGE_PORT||4182);
const dataDir=process.env.INTEGRATION_DATA_DIR||'./data';
const usersFile=path.join(dataDir,'users.json'),sessionsFile=path.join(dataDir,'sessions.json');
const syncFile=path.join(dataDir,'integration-hub-sync.json');
await ensureIntegrationStore();
try{await fs.access(syncFile)}catch{await fs.writeFile(syncFile,JSON.stringify({history:[],states:{}},null,2))}

const catalog={
 openai:{secret:['OPENAI_API_KEY'],config:['OPENAI_TEXT_MODEL']},
 gemini:{secret:['GEMINI_API_KEY'],config:['GEMINI_TEXT_MODEL']},
 claude:{secret:['ANTHROPIC_API_KEY'],config:['ANTHROPIC_TEXT_MODEL']},
 deepl:{secret:['DEEPL_API_KEY'],config:['DEEPL_API_URL']},
 google_drive:{secret:['GOOGLE_DRIVE_CLIENT_SECRET'],config:['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_REDIRECT_URI','GOOGLE_DRIVE_ROOT_FOLDER_ID','MEETING_DRIVE_TENANT_NAME']},
 google_calendar:{secret:['GOOGLE_CLIENT_SECRET'],config:['GOOGLE_CLIENT_ID']},
 microsoft365:{secret:['MS_CLIENT_SECRET'],config:['MS_CLIENT_ID']},
 discord:{secret:['DISCORD_BOT_TOKEN'],config:['DISCORD_GUILD_ID','DISCORD_NOTICE_CHANNEL_ID','DISCORD_TASK_CHANNEL_ID','DISCORD_VOICE_CHANNEL_ID','DISCORD_ACTIVITY_APP_ID']},
 hermes:{secret:[],config:['HERMES_ENABLED','HERMES_BRIDGE_DIR']},
 obsidian:{secret:[],config:['OBSIDIAN_VAULT_PATH']},
 total_erp:{secret:['ERP_API_TOKEN'],config:['ERP_API_BASE']}
};

const rd=async(f,d)=>{try{return JSON.parse(await fs.readFile(f,'utf8'))}catch{return d}};
const wr=(f,d)=>fs.writeFile(f,JSON.stringify(d,null,2));
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload))};
const body=async req=>{let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}};
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
async function currentUser(req){try{const sid=cookies(req).voiceflow_session;if(!sid)return null;const ss=await rd(sessionsFile,[]),s=ss.find(x=>x.id===sid&&Date.parse(x.expires_at)>Date.now());if(!s)return null;const us=await rd(usersFile,[]);return us.find(x=>x.id===s.user_id&&!x.deleted_at&&x.status==='active')||null}catch{return null}}
const admin=async req=>{const u=await currentUser(req);return u?.role==='admin'?u:null};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

async function hubConfig(){const c=await getIntegrationConfig();return{base_url:String(c.INTEGRATION_HUB_BASE_URL||'').replace(/\/$/,''),project_id:String(c.INTEGRATION_HUB_PROJECT_ID||'star45-meeting'),tenant_id:String(c.INTEGRATION_HUB_TENANT_ID||'STAR45'),conflict_policy:String(c.INTEGRATION_HUB_CONFLICT_POLICY||'manual')}}
async function hubToken(){return getIntegrationSecret('INTEGRATION_HUB_TOKEN')}
function requireSecure(base){if(!base)throw new Error('integration_hub_not_configured');if(!/^https:\/\//i.test(base)&&!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base))throw new Error('integration_hub_https_required')}
async function hubFetch(endpoint,opt={}){const cfg=await hubConfig();requireSecure(cfg.base_url);const tok=await hubToken();if(!tok)throw new Error('integration_hub_token_missing');const r=await fetch(`${cfg.base_url}${endpoint}`,{...opt,headers:{'content-type':'application/json','authorization':`Bearer ${tok}`,'x-star45-project-id':cfg.project_id,'x-star45-tenant-id':cfg.tenant_id,...(opt.headers||{})},signal:AbortSignal.timeout(12000)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||d.message||`hub_http_${r.status}`);return d}

async function localRecord(id,includeSecrets=false){const def=catalog[id];if(!def)throw new Error('unknown_integration');const cfg=await getIntegrationConfig(),config={};for(const k of def.config)config[k]=cfg[k]??process.env[k]??'';const secret_status={},secret_values={};for(const k of def.secret){secret_status[k]=await secretConfigured(k);if(includeSecrets&&secret_status[k])secret_values[k]=await getIntegrationSecret(k)}const fingerprint=hash({id,config,secret_status,secret_values:includeSecrets?secret_values:Object.keys(secret_status).filter(k=>secret_status[k])});return{id,config,secret_status,...(includeSecrets?{secret_values}:{}),fingerprint,updated_at:cfg.updated_at||null}}
async function saveRemoteRecord(id,record){const def=catalog[id];if(!def)throw new Error('unknown_integration');const c={};for(const k of def.config)if(record.config&&k in record.config)c[k]=String(record.config[k]??'');if(Object.keys(c).length)await setIntegrationConfig(c);for(const k of def.secret)if(record.secret_values&&k in record.secret_values&&String(record.secret_values[k]||''))await setIntegrationSecret(k,String(record.secret_values[k]));return localRecord(id,false)}
async function audit(action,id,result,user,extra={}){const s=await rd(syncFile,{history:[],states:{}}),row={at:new Date().toISOString(),action,integration_id:id||'*',result,user_id:user?.id||'',user_name:user?.name||'',...extra};s.history.unshift(row);s.history=s.history.slice(0,1000);if(id&&id!=='*')s.states[id]={...(s.states[id]||{}),last_action:action,last_result:result,last_at:row.at,...extra};await wr(syncFile,s);return row}

async function status(){const cfg=await hubConfig(),tok=await hubToken(),s=await rd(syncFile,{history:[],states:{}});return{configured:!!(cfg.base_url&&tok),base_url:cfg.base_url,project_id:cfg.project_id,tenant_id:cfg.tenant_id,conflict_policy:cfg.conflict_policy,token_configured:!!tok,states:s.states,history:s.history.slice(0,50)}}
async function compareAll(){const cfg=await hubConfig();const remote=await hubFetch(`/api/v1/integration-hub/projects/${encodeURIComponent(cfg.project_id)}/snapshot`);const rmap=remote.data?.integrations||remote.integrations||{};const out={};for(const id of Object.keys(catalog)){const l=await localRecord(id,false),r=rmap[id]||null;out[id]={local_fingerprint:l.fingerprint,remote_fingerprint:r?.fingerprint||'',status:!r?'local_only':r.fingerprint===l.fingerprint?'same':'different',remote_version:r?.version||null,remote_updated_at:r?.updated_at||null}}return out}
async function pushOne(id,user){const cfg=await hubConfig(),record=await localRecord(id,true);const d=await hubFetch(`/api/v1/integration-hub/projects/${encodeURIComponent(cfg.project_id)}/integrations/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({tenant_id:cfg.tenant_id,project_id:cfg.project_id,integration:record,source:'star45-meeting'})});await audit('push',id,'success',user,{remote_version:d.data?.version||d.version||null});return d}
async function pullOne(id,user,force=false){const cfg=await hubConfig(),remote=await hubFetch(`/api/v1/integration-hub/projects/${encodeURIComponent(cfg.project_id)}/integrations/${encodeURIComponent(id)}?include_secrets=1`);const rec=remote.data?.integration||remote.integration||remote.data||remote;if(!rec||!rec.id)rec.id=id;const local=await localRecord(id,false);const s=await rd(syncFile,{history:[],states:{}}),last=s.states?.[id];if(!force&&cfg.conflict_policy==='manual'&&last?.last_local_fingerprint&&last.last_local_fingerprint!==local.fingerprint&&rec.fingerprint&&last.last_remote_fingerprint&&last.last_remote_fingerprint!==rec.fingerprint){await audit('pull',id,'conflict',user,{local_fingerprint:local.fingerprint,remote_fingerprint:rec.fingerprint});throw new Error('integration_sync_conflict')}const saved=await saveRemoteRecord(id,rec);await audit('pull',id,'success',user,{last_local_fingerprint:saved.fingerprint,last_remote_fingerprint:rec.fingerprint||''});return saved}

const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,PATCH,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}if(u.pathname==='/health')return json(res,200,{ok:true,service:'integration-hub-bridge',version:'1.0.0'});const user=await admin(req);if(!user)return json(res,403,{ok:false,error:'admin_required'});
if(u.pathname==='/api/v1/admin/integration-hub/status'&&req.method==='GET')return json(res,200,{ok:true,data:await status()});
if(u.pathname==='/api/v1/admin/integration-hub/config'&&req.method==='PATCH'){const b=await body(req),c={};for(const k of ['INTEGRATION_HUB_BASE_URL','INTEGRATION_HUB_PROJECT_ID','INTEGRATION_HUB_TENANT_ID','INTEGRATION_HUB_CONFLICT_POLICY'])if(k in b)c[k]=String(b[k]??'');if(Object.keys(c).length)await setIntegrationConfig(c);if(String(b.INTEGRATION_HUB_TOKEN||'').trim())await setIntegrationSecret('INTEGRATION_HUB_TOKEN',String(b.INTEGRATION_HUB_TOKEN).trim());await audit('config','*','success',user);return json(res,200,{ok:true,data:await status()})}
if(u.pathname==='/api/v1/admin/integration-hub/test'&&req.method==='POST'){const d=await hubFetch('/health');await audit('test','*','success',user);return json(res,200,{ok:true,data:d})}
if(u.pathname==='/api/v1/admin/integration-hub/compare'&&req.method==='GET')return json(res,200,{ok:true,data:await compareAll()});
let m=u.pathname.match(/^\/api\/v1\/admin\/integration-hub\/(push|pull)\/([a-z0-9_-]+)$/);if(m&&req.method==='POST'){const [,action,id]=m;if(!catalog[id])return json(res,404,{ok:false,error:'unknown_integration'});const d=action==='push'?await pushOne(id,user):await pullOne(id,user,u.searchParams.get('force')==='1');return json(res,200,{ok:true,data:d})}
if(u.pathname==='/api/v1/admin/integration-hub/push-all'&&req.method==='POST'){const results={};for(const id of Object.keys(catalog)){try{await pushOne(id,user);results[id]='success'}catch(e){results[id]=`error:${e.message}`}}return json(res,200,{ok:true,data:results})}
if(u.pathname==='/api/v1/admin/integration-hub/pull-all'&&req.method==='POST'){const results={};for(const id of Object.keys(catalog)){try{await pullOne(id,user,u.searchParams.get('force')==='1');results[id]='success'}catch(e){results[id]=`error:${e.message}`}}return json(res,200,{ok:true,data:results})}
return json(res,404,{ok:false,error:'not_found'});}catch(e){console.error(e);return json(res,409,{ok:false,error:e.message||'bridge_error'})}});
server.listen(port,'0.0.0.0',()=>console.log(`Integration Hub Bridge :${port}`));
