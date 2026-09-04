import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const dataDir=process.env.MEETING_RESULT_DATA_DIR||'/opt/star45/voiceflow-data';
const oauthFile=path.join(dataDir,'google-drive-oauth.json');
const configFile=path.join(dataDir,'google-drive-storage-config.json');
const clientId=process.env.GOOGLE_DRIVE_CLIENT_ID||'';
const clientSecret=process.env.GOOGLE_DRIVE_CLIENT_SECRET||'';
const tokenSecret=process.env.GOOGLE_DRIVE_TOKEN_SECRET||'';
if(!clientId||!clientSecret||!tokenSecret) throw new Error('missing_google_drive_oauth_env');

const oauth=JSON.parse(await fs.readFile(oauthFile,'utf8'));
const cfg=JSON.parse(await fs.readFile(configFile,'utf8').catch(()=> '{}'));
if(!oauth.refresh_token_encrypted) throw new Error('google_drive_oauth_not_connected');
function dec(x){const key=crypto.createHash('sha256').update(tokenSecret).digest(),iv=Buffer.from(x.iv,'base64'),tag=Buffer.from(x.tag,'base64'),cipher=crypto.createDecipheriv('aes-256-gcm',key,iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(Buffer.from(x.data,'base64')),cipher.final()]).toString('utf8')}
const refresh=dec(oauth.refresh_token_encrypted);
const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:'refresh_token'})});
const td=await tr.json();if(!tr.ok||!td.access_token)throw new Error(td.error_description||td.error||`token_http_${tr.status}`);
const token=td.access_token;
let root=cfg.root_folder_id||process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID||'';
if(!root){const q=encodeURIComponent("name='STAR45 Meeting' and mimeType='application/vnd.google-apps.folder' and trashed=false");const lr=await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`,{headers:{authorization:`Bearer ${token}`}});const ld=await lr.json();if(!lr.ok)throw new Error(ld?.error?.message||`list_http_${lr.status}`);root=ld.files?.[0]?.id||''}
if(!root)throw new Error('star45_meeting_root_missing');
const boundary=`e2e_${Date.now()}`;const name=`STAR45-live-verification-${Date.now()}.txt`;const metadata={name,parents:[root]};const content=`STAR45 AI Meeting v2.6.1 live Drive verification ${new Date().toISOString()}`;const multipart=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
const ur=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,parents,webViewLink',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':`multipart/related; boundary=${boundary}`},body:multipart});const ud=await ur.json();if(!ur.ok||!ud.id)throw new Error(ud?.error?.message||`upload_http_${ur.status}`);
const gr=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(ud.id)}?fields=id,name,parents,trashed`,{headers:{authorization:`Bearer ${token}`}});const gd=await gr.json();if(!gr.ok||gd.id!==ud.id)throw new Error(gd?.error?.message||`verify_http_${gr.status}`);
const dr=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(ud.id)}`,{method:'DELETE',headers:{authorization:`Bearer ${token}`}});if(!dr.ok&&dr.status!==204)throw new Error(`delete_http_${dr.status}`);
console.log(JSON.stringify({ok:true,provider:'google-drive',root_folder_id:root,test_file_created:ud.id,test_file_name:ud.name,verified:true,cleanup_deleted:true,checked_at:new Date().toISOString()}));
