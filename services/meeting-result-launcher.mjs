import {getIntegrationSecret,getIntegrationConfig} from '../lib/integration-secrets.mjs';

const cfg=await getIntegrationConfig();
const setIf=(k,v)=>{if(!process.env[k]&&v!==undefined&&v!==null&&String(v)!=='')process.env[k]=String(v)};

setIf('GOOGLE_DRIVE_CLIENT_ID',cfg.GOOGLE_DRIVE_CLIENT_ID);
setIf('GOOGLE_DRIVE_CLIENT_SECRET',await getIntegrationSecret('GOOGLE_DRIVE_CLIENT_SECRET'));
setIf('GOOGLE_DRIVE_REDIRECT_URI',cfg.GOOGLE_DRIVE_REDIRECT_URI||'https://voice.star45.net/api/v1/meeting-results/oauth/callback');
setIf('GOOGLE_DRIVE_ROOT_FOLDER_ID',cfg.GOOGLE_DRIVE_ROOT_FOLDER_ID);
setIf('MEETING_DRIVE_TENANT_NAME',cfg.MEETING_DRIVE_TENANT_NAME||'STAR45');
setIf('GOOGLE_DRIVE_TOKEN_SECRET',process.env.INTEGRATION_SECRET_KEY);

await import('./meeting-result-drive-service.mjs');
