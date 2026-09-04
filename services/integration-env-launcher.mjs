import {getIntegrationSecret,getIntegrationConfig} from '../lib/integration-secrets.mjs';
import {hydrateSharedHubProviders} from '../lib/shared-hub-provider.mjs';

const target=process.argv[2];
if(!target)throw new Error('integration_launcher_target_required');
const secretNames=['OPENAI_API_KEY','GEMINI_API_KEY','ANTHROPIC_API_KEY','DEEPL_API_KEY','GOOGLE_DRIVE_CLIENT_SECRET','GOOGLE_CLIENT_SECRET','MS_CLIENT_SECRET','DISCORD_BOT_TOKEN','ERP_API_TOKEN'];
const fallback={
  GOOGLE_DRIVE_REDIRECT_URI:'https://voice.star45.net/api/v1/meeting-results/oauth/callback',
  MEETING_DRIVE_TENANT_NAME:'STAR45'
};
const modelFallback={
  OPENAI_TEXT_MODEL:'gpt-5',
  GEMINI_TEXT_MODEL:'gemini-3.7-flash',
  ANTHROPIC_TEXT_MODEL:'claude-opus-5'
};
const deprecatedComposeDefaults={
  OPENAI_TEXT_MODEL:new Set(['gpt-5-mini','gpt-5.6-sol']),
  GEMINI_TEXT_MODEL:new Set(['gemini-2.5-flash'])
};
async function hydrate(){
  const cfg=await getIntegrationConfig();
  for(const name of secretNames){const v=await getIntegrationSecret(name);if(v)process.env[name]=String(v)}
  await hydrateSharedHubProviders();
  for(const [k,v] of Object.entries(cfg)){if(v!==undefined&&v!==null&&String(v)!=='')process.env[k]=String(v);else if(k in process.env)delete process.env[k]}
  if(process.env.INTEGRATION_SECRET_KEY)process.env.GOOGLE_DRIVE_TOKEN_SECRET=process.env.INTEGRATION_SECRET_KEY;
  for(const [k,v] of Object.entries(fallback))if(!process.env[k])process.env[k]=v;
  for(const [k,v] of Object.entries(modelFallback)){
    const central=String(cfg[k]??'').trim();
    const current=String(process.env[k]??'').trim();
    if(central&&!deprecatedComposeDefaults[k]?.has(central))process.env[k]=central;
    else if(!current||deprecatedComposeDefaults[k]?.has(current))process.env[k]=v;
  }
}
await hydrate();
setInterval(()=>hydrate().catch(e=>console.error('integration hot-reload',e.message)),2000).unref();
await import(`./${target}`);
