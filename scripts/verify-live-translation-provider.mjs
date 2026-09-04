import {getIntegrationSecret} from '../lib/integration-secrets.mjs';
import {translateExternal} from '../lib/provider-adapters.mjs';
import {hydrateSharedHubProviders} from '../lib/shared-hub-provider.mjs';
const sample='안녕하세요. 오늘 회의를 시작합니다.';
const target='vi-VN';
const candidates=[
  ['gemini','GEMINI_API_KEY'],
  ['openai','OPENAI_API_KEY'],
  ['deepl','DEEPL_API_KEY']
];
const errors=[];
await hydrateSharedHubProviders();
for(const [provider,secretName] of candidates){
  const secret=(await getIntegrationSecret(secretName))||String(process.env[secretName]||'').trim();
  if(!secret){errors.push(provider+':not-configured');continue}
  try{
    const translated=String(await translateExternal(provider,sample,target)||'').trim();
    if(translated&&translated!==sample){
      console.log(JSON.stringify({ok:true,provider,target,translated:true}));
      process.exit(0);
    }
    errors.push(provider+':empty-or-identical');
  }catch(error){errors.push(provider+':'+String(error?.message||error).slice(0,180))}
}
console.error(JSON.stringify({ok:false,error:'no-working-translation-provider',providers:errors}));
process.exit(1);
