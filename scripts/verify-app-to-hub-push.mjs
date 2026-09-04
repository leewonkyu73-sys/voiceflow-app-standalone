import crypto from 'node:crypto';
import {getIntegrationSecret,getIntegrationConfig,secretConfigured} from '../lib/integration-secrets.mjs';

const id=String(process.argv[2]||'deepl').trim();
const catalog={
  openai:{secret:['OPENAI_API_KEY'],config:['OPENAI_TEXT_MODEL']},
  gemini:{secret:['GEMINI_API_KEY'],config:['GEMINI_TEXT_MODEL']},
  claude:{secret:['ANTHROPIC_API_KEY'],config:['ANTHROPIC_TEXT_MODEL']},
  deepl:{secret:['DEEPL_API_KEY'],config:['DEEPL_API_URL']}
};
if(!catalog[id]){console.error('FAIL unsupported integration:',id);process.exit(2)}
const def=catalog[id];
const cfg=await getIntegrationConfig();
const base=String(cfg.INTEGRATION_HUB_BASE_URL||'').replace(/\/$/,'');
const project=String(cfg.INTEGRATION_HUB_PROJECT_ID||'star45-meeting');
const tenant=String(cfg.INTEGRATION_HUB_TENANT_ID||'STAR45');
const token=await getIntegrationSecret('INTEGRATION_HUB_TOKEN');
if(!base||!token){console.error('FAIL hub_not_configured');process.exit(3)}
if(!/^https:\/\//i.test(base)&&!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base)){console.error('FAIL hub_https_required');process.exit(4)}

const config={};for(const k of def.config)config[k]=cfg[k]??process.env[k]??'';
const secret_status={},secret_values={};
for(const k of def.secret){secret_status[k]=await secretConfigured(k);if(secret_status[k])secret_values[k]=await getIntegrationSecret(k)}
if(def.secret.length&&!Object.values(secret_status).every(Boolean)){console.error(`FAIL ${id}_secret_missing`);process.exit(5)}
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fingerprint=hash({id,config,secret_status,secret_values});
const record={id,config,secret_status,secret_values,fingerprint,updated_at:cfg.updated_at||new Date().toISOString()};
const headers={'content-type':'application/json','authorization':`Bearer ${token}`,'x-star45-project-id':project,'x-star45-tenant-id':tenant};
const request=async(url,opt={})=>{const r=await fetch(url,{...opt,headers:{...headers,...(opt.headers||{})},signal:AbortSignal.timeout(12000)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||d.message||`HTTP_${r.status}`);return d};

console.log(`TEST integration=${id} project=${project} tenant=${tenant}`);
await request(`${base}/health`);
console.log('HUB HEALTH PASS');
const pushed=await request(`${base}/api/v1/integration-hub/projects/${encodeURIComponent(project)}/integrations/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({tenant_id:tenant,project_id:project,integration:record,source:'star45-meeting'})});
console.log('APP -> HUB PUT PASS', pushed.data?.version||pushed.version||'version-ok');
const snap=await request(`${base}/api/v1/integration-hub/projects/${encodeURIComponent(project)}/snapshot`);
const remote=(snap.data?.integrations||snap.integrations||{})[id];
if(!remote){console.error('FAIL hub_snapshot_missing_record');process.exit(6)}
if(remote.fingerprint!==fingerprint){console.error('FAIL fingerprint_mismatch');process.exit(7)}
console.log('HUB READBACK PASS');
console.log('FINGERPRINT MATCH PASS');
console.log('APP_TO_HUB VERIFIED PASS');
