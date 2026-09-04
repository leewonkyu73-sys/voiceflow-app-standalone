import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {ensureIntegrationStore,getIntegrationSecret,setIntegrationSecret,getIntegrationConfig,setIntegrationConfig,secretConfigured} from '../lib/integration-secrets.mjs';

const port=Number(process.env.ADMIN_INTEGRATION_PORT||4181);
const dataDir=process.env.INTEGRATION_DATA_DIR||'./data';
const usersFile=path.join(dataDir,'users.json'),sessionsFile=path.join(dataDir,'sessions.json');
await ensureIntegrationStore();
const rd=async(f,d=[])=>{try{return JSON.parse(await fs.readFile(f,'utf8'))}catch{return d}};
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload))};
const body=async req=>{let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}};
const cookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
async function currentUser(req){try{const sid=cookies(req).voiceflow_session;if(!sid)return null;const ss=await rd(sessionsFile),s=ss.find(x=>x.id===sid&&Date.parse(x.expires_at)>Date.now());if(!s)return null;const us=await rd(usersFile);return us.find(x=>x.id===s.user_id&&!x.deleted_at&&x.status==='active')||null}catch{return null}}
const admin=async req=>{const u=await currentUser(req);return u?.role==='admin'?u:null};

const registry={
 openai:{label:'OpenAI',secret:['OPENAI_API_KEY'],config:['OPENAI_TEXT_MODEL'],category:'AI'},
 gemini:{label:'Google Gemini',secret:['GEMINI_API_KEY'],config:['GEMINI_TEXT_MODEL','GEMINI_STT_MODEL'],category:'AI'},
 claude:{label:'Anthropic Claude',secret:['ANTHROPIC_API_KEY'],config:['ANTHROPIC_TEXT_MODEL'],category:'AI'},
 deepl:{label:'DeepL',secret:['DEEPL_API_KEY'],config:['DEEPL_API_URL'],category:'Translation'},
 google_drive:{label:'Google Drive',secret:['GOOGLE_DRIVE_CLIENT_SECRET'],config:['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_REDIRECT_URI','GOOGLE_DRIVE_ROOT_FOLDER_ID','MEETING_DRIVE_TENANT_NAME'],category:'Google',oauth:true},
 google_calendar:{label:'Google Calendar / Workspace',secret:['GOOGLE_CLIENT_SECRET'],config:['GOOGLE_CLIENT_ID'],category:'Google',oauth_prepared:true},
 microsoft365:{label:'Microsoft 365 / Outlook',secret:['MS_CLIENT_SECRET'],config:['MS_CLIENT_ID'],category:'Microsoft',oauth_prepared:true},
 discord:{label:'Discord',secret:['DISCORD_BOT_TOKEN'],config:['DISCORD_GUILD_ID','DISCORD_NOTICE_CHANNEL_ID','DISCORD_TASK_CHANNEL_ID','DISCORD_VOICE_CHANNEL_ID','DISCORD_ACTIVITY_APP_ID'],category:'Communication'},
 hermes:{label:'Hermes',secret:[],config:['HERMES_ENABLED','HERMES_BRIDGE_DIR'],category:'Agent'},
 obsidian:{label:'Obsidian',secret:[],config:['OBSIDIAN_VAULT_PATH'],category:'Knowledge'},
 total_erp:{label:'Total ERP',secret:['ERP_API_TOKEN'],config:['ERP_API_BASE'],category:'ERP'},
 device_tapjoin:{label:'BLE/Nearby · NFC TapJoin',secret:[],config:['DEVICE_NEARBY_ENABLED','NFC_TAPJOIN_ENABLED','TAPJOIN_TTL_MINUTES','TAPJOIN_CARD_MODE','DEVICE_NATIVE_BRIDGE_SCHEME'],category:'Device'}
};

const parseProviderError=async(r,prefix)=>{let detail='';try{const d=await r.json();detail=d?.error?.message||d?.message||d?.error||''}catch{}const suffix=detail?`:${String(detail).slice(0,240)}`:'';throw new Error(`${prefix}_http_${r.status}${suffix}`)};

async function statuses(){const cfg=await getIntegrationConfig();const out={};for(const [id,r] of Object.entries(registry)){const sec={};for(const k of r.secret)sec[k]=await secretConfigured(k);const c={};for(const k of r.config)c[k]=cfg[k]??process.env[k]??'';out[id]={id,label:r.label,category:r.category,configured:r.secret.length?Object.values(sec).every(Boolean)&&Object.values(c).some(Boolean):id==='device_tapjoin'?String(c.DEVICE_NEARBY_ENABLED||'true')!=='false':Object.values(c).some(Boolean)||!!r.oauth,secret_status:sec,config:c,oauth:!!r.oauth,oauth_prepared:!!r.oauth_prepared};}return out}

async function test(id){const cfg=await getIntegrationConfig();
if(id==='openai'){
 const k=await getIntegrationSecret('OPENAI_API_KEY');if(!k)throw new Error('api_key_missing');
 const configuredModel=String(cfg.OPENAI_TEXT_MODEL||process.env.OPENAI_TEXT_MODEL||'gpt-5'),model=configuredModel==='gpt-5.6-sol'?'gpt-5':configuredModel;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${k}`,'content-type':'application/json'},body:JSON.stringify({model,input:'Reply with OK only.',max_output_tokens:16,store:false}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)await parseProviderError(r,'openai');const d=await r.json();return{ok:true,message:`OpenAI 실제 모델 응답 정상 · ${d.model||model}`,model:d.model||model,verified:'inference'}
}
if(id==='gemini'){
 const k=await getIntegrationSecret('GEMINI_API_KEY');if(!k)throw new Error('api_key_missing');
 const model=cfg.GEMINI_TEXT_MODEL||process.env.GEMINI_TEXT_MODEL||'gemini-3.7-flash';
 const sttModel=cfg.GEMINI_STT_MODEL||process.env.GEMINI_STT_MODEL||'gemini-3.5-transcribe';
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'x-goog-api-key':k,'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'Reply with OK only.'}]}],generationConfig:{maxOutputTokens:20}}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)await parseProviderError(r,'gemini');const d=await r.json();return{ok:true,message:`Gemini API 인증 정상 · Text ${d.modelVersion||model} · STT ${sttModel} 선택됨`,model:d.modelVersion||model,stt_model:sttModel,stt_verified:'selection_only',verified:'inference'}
}
if(id==='claude'){
 const k=await getIntegrationSecret('ANTHROPIC_API_KEY');if(!k)throw new Error('api_key_missing');
 const model=cfg.ANTHROPIC_TEXT_MODEL||process.env.ANTHROPIC_TEXT_MODEL||'claude-opus-5';
 const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':k,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model,max_tokens:8,messages:[{role:'user',content:'Reply with OK only.'}]}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)await parseProviderError(r,'claude');const d=await r.json();return{ok:true,message:`Claude 실제 모델 응답 정상 · ${d.model||model}`,model:d.model||model,verified:'inference'}
}
if(id==='deepl'){const k=await getIntegrationSecret('DEEPL_API_KEY');if(!k)throw new Error('api_key_missing');const base=cfg.DEEPL_API_URL||process.env.DEEPL_API_URL||'https://api-free.deepl.com';const r=await fetch(`${base.replace(/\/v2\/translate$/,'')}/v2/usage`,{headers:{authorization:`DeepL-Auth-Key ${k}`},signal:AbortSignal.timeout(10000)});if(!r.ok)await parseProviderError(r,'deepl');return{ok:true,message:'DeepL API 인증 및 사용량 조회 정상'}}
if(id==='discord'){const k=await getIntegrationSecret('DISCORD_BOT_TOKEN');if(!k)throw new Error('bot_token_missing');const r=await fetch('https://discord.com/api/v10/users/@me',{headers:{authorization:`Bot ${k}`},signal:AbortSignal.timeout(10000)});if(!r.ok)await parseProviderError(r,'discord');const d=await r.json();return{ok:true,message:`Discord Bot 정상: ${d.username||d.id}`}}
if(id==='hermes'){const dir=cfg.HERMES_BRIDGE_DIR||process.env.HERMES_BRIDGE_DIR||'';if(!dir)throw new Error('bridge_dir_missing');await fs.mkdir(dir,{recursive:true});return{ok:true,message:`Hermes Bridge 접근 정상: ${dir}`}}
if(id==='obsidian'){const dir=cfg.OBSIDIAN_VAULT_PATH||process.env.OBSIDIAN_VAULT_PATH||'';if(!dir)throw new Error('vault_path_missing');await fs.access(dir);return{ok:true,message:`Obsidian Vault 접근 정상: ${dir}`}}
if(id==='total_erp'){const base=cfg.ERP_API_BASE||process.env.ERP_API_BASE||'';if(!base)throw new Error('erp_base_missing');const tok=await getIntegrationSecret('ERP_API_TOKEN');const r=await fetch(`${base.replace(/\/$/,'')}/health`,{headers:tok?{authorization:`Bearer ${tok}`}:{},signal:AbortSignal.timeout(10000)});if(!r.ok)await parseProviderError(r,'erp');return{ok:true,message:'Total ERP API 정상'}}
if(id==='google_drive'){const cid=cfg.GOOGLE_DRIVE_CLIENT_ID||process.env.GOOGLE_DRIVE_CLIENT_ID||'';const sec=await getIntegrationSecret('GOOGLE_DRIVE_CLIENT_SECRET');if(!cid||!sec)throw new Error('google_drive_oauth_client_missing');return{ok:true,message:'Google Drive OAuth Client 설정 정상. 연결 버튼에서 Google 계정 승인을 진행하세요.',action:'/drive-connect.html'}}
if(id==='google_calendar'||id==='microsoft365')return{ok:true,message:'OAuth Client 설정 저장됨. OAuth 연결 모듈 고도화 대상.',prepared:true};
if(id==='device_tapjoin'){const r=await fetch('http://127.0.0.1:4183/health',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`tapjoin_http_${r.status}`);const d=await r.json();return{ok:true,message:'BLE/Nearby · NFC TapJoin 서비스 정상',module:d.module||'C-DEVICE-TAPJOIN-01',native_bridge:cfg.DEVICE_NATIVE_BRIDGE_SCHEME||'not_configured'}}
throw new Error('unknown_integration')}

const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,PATCH,DELETE,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
if(u.pathname==='/health')return json(res,200,{ok:true,service:'admin-integration-center',version:'1.3.1'});
if(u.pathname==='/api/v1/admin/integrations'&&req.method==='GET'){if(!await admin(req))return json(res,403,{ok:false,error:'admin_required'});return json(res,200,{ok:true,data:await statuses()})}
const m=u.pathname.match(/^\/api\/v1\/admin\/integrations\/([a-z0-9_-]+)$/);
if(m&&req.method==='PATCH'){if(!await admin(req))return json(res,403,{ok:false,error:'admin_required'});const id=m[1],r=registry[id];if(!r)return json(res,404,{ok:false,error:'unknown_integration'});const b=await body(req),cfg={};for(const k of r.config)if(k in b)cfg[k]=String(b[k]??'');if(Object.keys(cfg).length)await setIntegrationConfig(cfg);for(const k of r.secret)if(k in b&&String(b[k]||'').trim())await setIntegrationSecret(k,String(b[k]).trim());return json(res,200,{ok:true,data:(await statuses())[id]})}
if(m&&req.method==='DELETE'){if(!await admin(req))return json(res,403,{ok:false,error:'admin_required'});const id=m[1],r=registry[id];if(!r)return json(res,404,{ok:false,error:'unknown_integration'});const cfg={};for(const k of r.config)cfg[k]='';if(Object.keys(cfg).length)await setIntegrationConfig(cfg);for(const k of r.secret)await setIntegrationSecret(k,'');return json(res,200,{ok:true,data:(await statuses())[id]})}
if(m&&req.method==='POST'&&u.searchParams.get('action')==='test'){if(!await admin(req))return json(res,403,{ok:false,error:'admin_required'});try{return json(res,200,{ok:true,data:await test(m[1])})}catch(e){return json(res,409,{ok:false,error:e.message})}}
return json(res,404,{ok:false,error:'not_found'});}catch(e){console.error(e);return json(res,500,{ok:false,error:'server_error',message:e.message})}});
server.listen(port,()=>console.log(`Admin Integration Center :${port}`));
