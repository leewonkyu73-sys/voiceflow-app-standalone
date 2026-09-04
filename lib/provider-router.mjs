import fs from 'node:fs';
import path from 'node:path';
const norm=s=>String(s||'').trim().toLowerCase();
const dataDir=process.env.INTEGRATION_DATA_DIR||process.env.CONNECTOR_DATA_DIR||process.env.AI_EMPLOYEE_DATA_DIR||process.env.MEETING_RESULT_DATA_DIR||'./data';
const secretFile=path.join(dataDir,'integration-secrets.json');
function runtimeSecretConfigured(name){if(process.env[name])return true;try{const d=JSON.parse(fs.readFileSync(secretFile,'utf8'));return!!d?.[name]}catch{return false}}
const providers={
  stt:{browser:{env:null,label:'Browser STT'},openai:{env:'OPENAI_API_KEY',label:'OpenAI STT'},google:{env:'GOOGLE_CLOUD_API_KEY',label:'Google STT'},azure:{env:'AZURE_SPEECH_KEY',label:'Azure Speech'}},
  translation:{prototype:{env:null,label:'Prototype'},openai:{env:'OPENAI_API_KEY',label:'OpenAI'},gemini:{env:'GEMINI_API_KEY',label:'Gemini'},google:{env:'GOOGLE_CLOUD_API_KEY',label:'Google Translate'},azure:{env:'AZURE_TRANSLATOR_KEY',label:'Azure Translator'},deepl:{env:'DEEPL_API_KEY',label:'DeepL'}},
  validator:{local:{env:null,label:'Local Validator'},openai:{env:'OPENAI_API_KEY',label:'OpenAI Validator'},gemini:{env:'GEMINI_API_KEY',label:'Gemini Validator'}}
};
export function providerStatus(){const out={};for(const [kind,map] of Object.entries(providers)){out[kind]=Object.entries(map).map(([id,p])=>({id,label:p.label,configured:!p.env||runtimeSecretConfigured(p.env),env:p.env||null}))}return out}
export function chooseProvider(kind,preferred,fallback=[]){const map=providers[kind]||{};const order=[preferred,...fallback].map(norm).filter(Boolean);for(const id of order){const p=map[id];if(p&&(!p.env||runtimeSecretConfigured(p.env)))return{id,...p,mode:p.env?'external':'local'}}const local=Object.entries(map).find(([,p])=>!p.env);return local?{id:local[0],...local[1],mode:'local'}:null}
export function buildFallbackPlan(settings={}){return{
  stt:chooseProvider('stt',settings.providers?.stt,['openai','google','azure','browser']),
  translation:chooseProvider('translation',settings.providers?.translation,['openai','gemini','google','deepl','azure','prototype']),
  validator:chooseProvider('validator',settings.providers?.validator,['openai','gemini','local'])
}}
export function summarizeCaptions(captions=[]){const lines=captions.map(c=>String(c.text||'').trim()).filter(Boolean);const decisions=lines.filter(x=>/결정|확정|합의|진행하기로|승인|agree|decide|confirmed|thống nhất|quyết định/i.test(x));const actions=lines.filter(x=>/해야|하겠습니다|부탁|정리|확인|체크|보내|등록|추진|follow up|send|check|confirm|làm|gửi|kiểm tra/i.test(x)).slice(0,12).map((text,i)=>({id:`action_${i+1}`,text,owner:'미지정',deadline:''}));const risks=lines.filter(x=>/문제|위험|리스크|지연|불가|어렵|risk|delay|issue|khó|rủi ro/i.test(x)).slice(0,8);return{summary:lines.length?lines.slice(-12).join(' '):'정리할 회의 내용 없음',decisions:decisions.slice(0,10),actions,risks,source_count:lines.length}}
