import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const port=Number(process.env.ORIGINAL_MEDIA_PORT||4184);
const dataDir=process.env.ORIGINAL_MEDIA_DATA_DIR||process.env.MEETING_RESULT_DATA_DIR||'./data';
const recordingsDir=path.join(dataDir,'recordings');
const indexFile=path.join(dataDir,'meeting-media-index.json');
const oauthFile=path.join(dataDir,'google-drive-oauth.json');
const storageConfigFile=path.join(dataDir,'google-drive-storage-config.json');
await fs.mkdir(recordingsDir,{recursive:true});
try{await fs.access(indexFile)}catch{await fs.writeFile(indexFile,'[]')}

const rd=async(f,d)=>{try{return JSON.parse(await fs.readFile(f,'utf8'))}catch{return d}};
const wr=(f,d)=>fs.writeFile(f,JSON.stringify(d,null,2));
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload))};
const clean=s=>String(s||'').replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,120)||'unknown';
const tokenSecret=()=>process.env.GOOGLE_DRIVE_TOKEN_SECRET||'';
function dec(x){if(!x||!tokenSecret())return'';const key=crypto.createHash('sha256').update(tokenSecret()).digest(),iv=Buffer.from(x.iv,'base64'),tag=Buffer.from(x.tag,'base64'),cipher=crypto.createDecipheriv('aes-256-gcm',key,iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(Buffer.from(x.data,'base64')),cipher.final()]).toString('utf8')}
async function refreshToken(){if(process.env.GOOGLE_DRIVE_REFRESH_TOKEN)return process.env.GOOGLE_DRIVE_REFRESH_TOKEN;const saved=await rd(oauthFile,{});try{return saved.refresh_token_encrypted?dec(saved.refresh_token_encrypted):''}catch{return''}}
const clientConfigured=()=>!!(process.env.GOOGLE_DRIVE_CLIENT_ID&&process.env.GOOGLE_DRIVE_CLIENT_SECRET);
let tokenCache={token:'',expires:0};
async function accessToken(){if(tokenCache.token&&tokenCache.expires>Date.now()+60000)return tokenCache.token;const refresh=await refreshToken();if(!clientConfigured()||!refresh)throw new Error('google_drive_not_configured');const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_DRIVE_CLIENT_ID,client_secret:process.env.GOOGLE_DRIVE_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.access_token)throw new Error(d.error_description||d.error||`google_oauth_${r.status}`);tokenCache={token:d.access_token,expires:Date.now()+Number(d.expires_in||3600)*1000};return tokenCache.token}
async function driveJson(endpoint,opt={}){const token=await accessToken();const r=await fetch(`https://www.googleapis.com/drive/v3${endpoint}`,{...opt,headers:{authorization:`Bearer ${token}`,...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`drive_http_${r.status}`);return d}
const q=s=>String(s).replace(/'/g,"\\'");
async function ensureFolder(name,parentId=''){const clauses=[`name='${q(name)}'`,`mimeType='application/vnd.google-apps.folder'`,`trashed=false`];if(parentId)clauses.push(`'${q(parentId)}' in parents`);const list=await driveJson(`/files?q=${encodeURIComponent(clauses.join(' and '))}&fields=files(id,name)&pageSize=10`);if(list.files?.[0])return list.files[0].id;const payload={name,mimeType:'application/vnd.google-apps.folder'};if(parentId)payload.parents=[parentId];return (await driveJson('/files?fields=id,name',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})).id}
async function rootFolder(){const cfg=await rd(storageConfigFile,{});if(cfg.root_folder_id)return cfg.root_folder_id;return ensureFolder('STAR45 Meeting')}
async function uploadBinary(name,mime,buf,parentId){const token=await accessToken(),boundary=`vf_${crypto.randomBytes(8).toString('hex')}`,meta=Buffer.from(JSON.stringify({name,parents:[parentId]})),head1=Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),head2=Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),tail=Buffer.from(`\r\n--${boundary}--`),body=Buffer.concat([head1,meta,head2,buf,tail]);const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':`multipart/related; boundary=${boundary}`},body});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`drive_upload_${r.status}`);return d}
async function driveConfigured(){return clientConfigured()&&!!(await refreshToken())}
async function appendIndex(row){const a=await rd(indexFile,[]);a.unshift(row);await wr(indexFile,a.slice(0,5000));return row}
async function readBuffer(req,max=1024*1024*500){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>max)throw new Error('media_too_large');chunks.push(c)}return Buffer.concat(chunks)}
async function saveLocal(mid,fileName,buf){const dir=path.join(recordingsDir,clean(mid));await fs.mkdir(dir,{recursive:true});const file=path.join(dir,clean(fileName));await fs.writeFile(file,buf);return file}
async function driveMeetingFolder(mid,createdAt){const root=await rootFolder(),d=new Date(createdAt||Date.now()),year=String(d.getUTCFullYear()),month=String(d.getUTCMonth()+1).padStart(2,'0');const y=await ensureFolder(year,root),m=await ensureFolder(month,y);return ensureFolder(clean(mid),m)}

const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-file-name,x-media-kind'});return res.end()}
  if(u.pathname==='/health'){return json(res,200,{ok:true,service:'original-media-storage',version:'1.0.0',drive_connected:await driveConfigured(),local_dir:recordingsDir})}
  const upload=u.pathname.match(/^\/api\/v1\/meeting-media\/([^/]+)$/);
  if(upload&&req.method==='POST'){const mid=clean(decodeURIComponent(upload[1])),kind=clean(u.searchParams.get('kind')||req.headers['x-media-kind']||'audio'),ext=kind==='video'?'webm':'webm',mime=String(req.headers['content-type']|| (kind==='video'?'video/webm':'audio/webm')).split(';')[0],stamp=new Date().toISOString().replace(/[:.]/g,'-'),fileName=clean(req.headers['x-file-name']||`original-${kind}-${stamp}.${ext}`),buf=await readBuffer(req);if(!buf.length)return json(res,400,{ok:false,error:'empty_media'});const localPath=await saveLocal(mid,fileName,buf);let storage='vps-pending-drive',driveFile=null,driveError='';if(await driveConfigured()){try{const folder=await driveMeetingFolder(mid,new Date());driveFile=await uploadBinary(fileName,mime,buf,folder);storage='google-drive';try{await fs.unlink(localPath)}catch{}}catch(e){driveError=e.message}}
    const row=await appendIndex({meeting_id:mid,kind,file_name:fileName,mime_type:mime,size:buf.length,storage,local_path:storage==='google-drive'?'':localPath,drive_file_id:driveFile?.id||'',drive_web_view_link:driveFile?.webViewLink||'',drive_error:driveError,created_at:new Date().toISOString()});return json(res,201,{ok:true,data:row})}
  const list=u.pathname.match(/^\/api\/v1\/meeting-media\/([^/]+)\/status$/);if(list&&req.method==='GET'){const mid=clean(decodeURIComponent(list[1])),a=await rd(indexFile,[]);return json(res,200,{ok:true,data:a.filter(x=>x.meeting_id===mid)})}
  return json(res,404,{ok:false,error:'not_found'});
}catch(e){return json(res,e.message==='media_too_large'?413:500,{ok:false,error:e.message||'internal_error'})}});
server.listen(port,'0.0.0.0',()=>console.log(`Original Media Storage :${port}`));
