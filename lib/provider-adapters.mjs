import fs from 'node:fs/promises';
import path from 'node:path';
import {getIntegrationSecret,getIntegrationConfig} from './integration-secrets.mjs';
const providerCredential=async name=>(await getIntegrationSecret(name))||String(process.env[name]||'').trim();
const timeout=(ms=12000)=>AbortSignal.timeout?AbortSignal.timeout(ms):undefined;
const j=async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||d?.message||`HTTP ${r.status}`);return d};
export const configured=()=>({local:process.env.LOCAL_STT_ENABLED==='1',openai:!!process.env.OPENAI_API_KEY,gemini:!!process.env.GEMINI_API_KEY,deepl:!!process.env.DEEPL_API_KEY,google:!!process.env.GOOGLE_CLOUD_API_KEY,azureSpeech:!!process.env.AZURE_SPEECH_KEY,azureTranslator:!!process.env.AZURE_TRANSLATOR_KEY});
export function extractOpenAIText(d={}){const direct=String(d.output_text||'').trim();if(direct)return direct;return (d.output||[]).flatMap(x=>x?.content||[]).filter(x=>x?.type==='output_text'||typeof x?.text==='string').map(x=>String(x.text||'')).join('').trim()}
export async function openaiText(instruction,input){const apiKey=await providerCredential('OPENAI_API_KEY');if(!apiKey)throw new Error('OPENAI_API_KEY_missing');const cfg=await getIntegrationConfig(),configuredModel=String(cfg.OPENAI_TEXT_MODEL||process.env.OPENAI_TEXT_MODEL||'gpt-5'),model=configuredModel==='gpt-5.6-sol'?'gpt-5':configuredModel;const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${apiKey}`},body:JSON.stringify({model,instructions:instruction,input}),signal:timeout()});const d=await j(r),out=extractOpenAIText(d);if(!out)throw new Error('OPENAI_empty_response');return out}
async function geminiRequest(apiKey,model,instruction,input){const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({system_instruction:{parts:[{text:instruction}]},contents:[{role:'user',parts:[{text:input}]}]}),signal:timeout()});const d=await j(r);return String(d.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'').trim()}
export async function geminiText(instruction,input){const apiKey=await providerCredential('GEMINI_API_KEY');if(!apiKey)throw new Error('GEMINI_API_KEY_missing');const cfg=await getIntegrationConfig();const configuredModel=String(cfg.GEMINI_TEXT_MODEL||process.env.GEMINI_TEXT_MODEL||'gemini-3.7-flash');const models=[configuredModel,'gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash'].filter((x,i,a)=>x&&a.indexOf(x)===i);const errors=[];for(const model of models){try{const out=await geminiRequest(apiKey,model,instruction,input);if(out)return out}catch(e){errors.push(`${model}:${e?.message||'error'}`)}}throw new Error(`GEMINI_models_failed:${errors.join(' | ')}`)}
export function deepLApiUrl(apiKey,cfg={}){return cfg.DEEPL_API_URL||process.env.DEEPL_API_URL||(String(apiKey).endsWith(':fx')?'https://api-free.deepl.com/v2/translate':'https://api.deepl.com/v2/translate')}
export async function deeplTranslate(text,target){const apiKey=await providerCredential('DEEPL_API_KEY');if(!apiKey)throw new Error('DEEPL_API_KEY_missing');const cfg=await getIntegrationConfig();const map={'ko-KR':'KO','vi-VN':'VI','en-US':'EN','zh-CN':'ZH-HANS','ja-JP':'JA'};const r=await fetch(deepLApiUrl(apiKey,cfg),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','authorization':`DeepL-Auth-Key ${apiKey}`},body:new URLSearchParams({text,target_lang:map[target]||'EN'}),signal:timeout()});const d=await j(r);return String(d.translations?.[0]?.text||'').trim()}
export async function translateExternal(provider,text,target){const instruction=`Translate the user's text to ${target}. Preserve numbers, amounts, dates, VAT/MOQ, product names, negation, and business meaning. Return translation only.`;if(provider==='openai')return openaiText(instruction,text);if(provider==='gemini')return geminiText(instruction,text);if(provider==='deepl')return deeplTranslate(text,target);throw new Error(`provider_not_configured:${provider}`)}
const parseJson=s=>{try{return JSON.parse(String(s).replace(/^```json\s*|\s*```$/g,''))}catch{return null}};
export async function validateExternal(provider,original,translated,source,target){const instruction='You are a strict bilingual translation QA engine. Return JSON only: {"score":0-100,"issues":["..."],"semantic":0-100,"numbers":0-100,"negation":0-100}. Penalize missing numbers, currency, VAT/MOQ, negation, dates, names, and changed business meaning.';const input=JSON.stringify({source,target,original,translated});let raw;if(provider==='openai')raw=await openaiText(instruction,input);else if(provider==='gemini')raw=await geminiText(instruction,input);else throw new Error(`validator_not_configured:${provider}`);return parseJson(raw)||{score:70,issues:['validator_parse_error'],semantic:70,numbers:70,negation:70}}
export async function summarizeExternal(provider,captions){const instruction='Create a concise business meeting result as JSON only with keys summary, decisions[], actions[{text,owner,deadline}], risks[]. Do not invent facts. Preserve names, numbers and dates.';const input=captions.map(c=>`${c.speaker||'Participant'}: ${c.text||''}`).join('\n');let raw;if(provider==='openai')raw=await openaiText(instruction,input);else if(provider==='gemini')raw=await geminiText(instruction,input);else throw new Error(`summary_provider_not_configured:${provider}`);return parseJson(raw)}

function geminiInteractionText(data={}){
  const direct=String(data.output_text||'').trim();if(direct)return direct;
  return [...(data.outputs||[]),...(data.output||[])].flatMap(item=>item?.content||item).map(item=>String(item?.text||'')).join('').trim();
}

async function geminiTranscribeInteraction(audio,{apiKey,language='ko-KR',mimeType='audio/webm',model='gemini-3.5-transcribe'}={}){
  const bytes=Buffer.isBuffer(audio)?audio:Buffer.from(audio);
  const uploadStart=await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files',{method:'POST',headers:{'x-goog-api-key':apiKey,'x-goog-upload-protocol':'resumable','x-goog-upload-command':'start','x-goog-upload-header-content-length':String(bytes.length),'x-goog-upload-header-content-type':mimeType,'content-type':'application/json'},body:JSON.stringify({file:{display_name:'voice-segment'}}),signal:timeout(45000)});
  if(!uploadStart.ok)await j(uploadStart);
  const uploadUrl=String(uploadStart.headers.get('x-goog-upload-url')||'');if(!uploadUrl)throw new Error('GEMINI_upload_url_missing');
  const uploaded=await fetch(uploadUrl,{method:'POST',headers:{'content-length':String(bytes.length),'x-goog-upload-offset':'0','x-goog-upload-command':'upload, finalize','content-type':mimeType},body:bytes,signal:timeout(45000)});
  const fileData=await j(uploaded),file=fileData.file||{},fileName=String(file.name||''),fileUri=String(file.uri||'');
  if(!fileName||!fileUri)throw new Error('GEMINI_uploaded_file_missing');
  try{
    const languageCodes=language==='auto'?[]:[String(language||'').trim()].filter(Boolean);
    const interaction=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':apiKey,'content-type':'application/json'},body:JSON.stringify({model,input:[{type:'audio',uri:fileUri,mime_type:String(file.mimeType||file.mime_type||mimeType)}],generation_config:{transcription_config:{language_codes:languageCodes}}}),signal:timeout(45000)});
    const data=await j(interaction),text=geminiInteractionText(data);if(!text)throw new Error('GEMINI_empty_transcript');
    return{text,provider:'gemini',model,transport:'interactions_file'};
  }finally{
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`,{method:'DELETE',headers:{'x-goog-api-key':apiKey},signal:timeout(12000)}).catch(()=>{});
  }
}

async function geminiAudioTranscribe(audio,{language='ko-KR',mimeType='audio/webm',model=''}={}){
  const apiKey=await providerCredential('GEMINI_API_KEY');if(!apiKey)throw new Error('GEMINI_API_KEY_missing');
  const cfg=await getIntegrationConfig();
  const requestedModel=String(model||cfg.GEMINI_STT_MODEL||process.env.GEMINI_STT_MODEL||'gemini-3.5-transcribe');
  const configuredModel=requestedModel==='gemini-3.5-transcribe-live'?'gemini-3.5-transcribe':requestedModel;
  const models=[configuredModel,'gemini-3.5-transcribe','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash'].filter((x,i,a)=>x&&a.indexOf(x)===i),errors=[];
  const prompt=language==='auto'?'Detect the spoken language automatically and transcribe the audio accurately. Return only the transcript. If there is no intelligible speech, return an empty string.':`Transcribe the spoken audio accurately in ${language}. Return only the transcript. If there is no intelligible speech, return an empty string.`;
  for(const activeModel of models){try{
    if(activeModel==='gemini-3.5-transcribe'){const out=await geminiTranscribeInteraction(audio,{apiKey,language,mimeType,model:activeModel});return{...out,requested_model:requestedModel}}
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},{inline_data:{mime_type:mimeType,data:Buffer.from(audio).toString('base64')}}]}]}),signal:timeout(45000)});const data=await j(r),text=String(data.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'').trim();return{text,provider:'gemini',model:activeModel,requested_model:requestedModel,transport:'segment_generate_content'}
  }catch(e){errors.push(`${activeModel}:${e?.message||'error'}`)}}throw new Error(`GEMINI_audio_failed:${errors.join(' | ')}`)
}

async function openaiAudioTranscribe(audio,{language='ko-KR',mimeType='audio/webm',model=''}={}){
  const cfg=await getIntegrationConfig(),openaiKey=await providerCredential('OPENAI_API_KEY');if(!openaiKey)throw new Error('OPENAI_API_KEY_missing');
  const activeModel=model||cfg.OPENAI_STT_MODEL||process.env.OPENAI_STT_MODEL||'gpt-4o-mini-transcribe';
  const form=new FormData(),ext=mimeType.includes('ogg')?'ogg':mimeType.includes('mp4')?'m4a':'webm';form.set('file',new Blob([audio],{type:mimeType}),`voice-segment.${ext}`);form.set('model',activeModel);form.set('temperature','0');const lang=String(language||'').split('-')[0];if(lang&&lang!=='auto')form.set('language',lang);const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{authorization:`Bearer ${openaiKey}`},body:form,signal:timeout(45000)});const data=await j(r);return{text:String(data.text||'').trim(),provider:'openai',model:activeModel}
}

async function localWhisperTranscribe(audio,{language='ko-KR',mimeType='audio/webm'}={}){
  if(process.env.LOCAL_STT_ENABLED!=='1')throw new Error('LOCAL_STT_disabled');
  const endpoint=String(process.env.LOCAL_STT_URL||'http://127.0.0.1:4186/inference').trim();
  const bytes=Buffer.isBuffer(audio)?audio:Buffer.from(audio),ext=mimeType.includes('ogg')?'ogg':mimeType.includes('mp4')?'m4a':mimeType.includes('wav')?'wav':'webm';
  const form=new FormData();form.set('file',new Blob([bytes],{type:mimeType}),`voice-segment.${ext}`);form.set('response_format','json');form.set('temperature','0');form.set('vad','true');form.set('vad_threshold','0.50');form.set('vad_min_speech_duration_ms','250');form.set('vad_min_silence_duration_ms','100');form.set('vad_speech_pad_ms','30');
  const lang=String(language||'').split('-')[0];if(lang&&lang!=='auto')form.set('language',lang);
  const response=await fetch(endpoint,{method:'POST',body:form,signal:timeout(45000)}),data=await j(response),text=String(data?.text||'').trim();
  return{text,provider:'local-whisper',model:String(process.env.LOCAL_STT_MODEL||'tiny'),transport:'localhost_http'};
}

async function runtimeSttRouting(){
  try{
    const dataDir=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.resolve('./data');
    const settings=JSON.parse(await fs.readFile(path.join(dataDir,'settings.json'),'utf8'));
    const route=settings?.functionRouting?.stt_realtime||{};
    const primary=['openai','gemini'].includes(String(route.primary||''))?String(route.primary):'';
    const fallback=['openai','gemini'].includes(String(route.fallback||''))?String(route.fallback):'';
    return {primary,model:String(route.model||''),fallback};
  }catch{return {primary:'',model:'',fallback:''}}
}

export async function transcribeExternal(audio,{language='ko-KR',mimeType='audio/webm',provider='auto',model='',fallbackProvider='auto',useRuntimeRouting=false}={}){
  const saved=provider==='auto'&&useRuntimeRouting?await runtimeSttRouting():{primary:'',model:'',fallback:''};
  const preferred=String(saved.primary||provider||'auto').toLowerCase(),selectedModel=String(saved.model||model||''),fallback=String(saved.fallback||fallbackProvider||'auto').toLowerCase(),errors=[];
  const order=[];
  if(process.env.LOCAL_STT_ENABLED==='1')order.push('local');
  if(preferred==='gemini')order.push('gemini');else if(preferred==='openai')order.push('openai');else order.push('openai','gemini');
  if(fallback==='gemini')order.push('gemini');else if(fallback==='openai')order.push('openai');else if(preferred!=='auto')order.push(preferred==='gemini'?'openai':'gemini');
  for(const p of [...new Set(order)]){
    try{
      if(p==='local'){const out=await localWhisperTranscribe(audio,{language,mimeType});return {...out,routing_source:'local_feature_flag'}}
      if(p==='gemini'){const out=await geminiAudioTranscribe(audio,{language,mimeType,model:preferred==='gemini'?selectedModel:''});return {...out,routing_source:saved.primary?'functionRouting':'adapter_default'}}
      if(p==='openai'){const out=await openaiAudioTranscribe(audio,{language,mimeType,model:preferred==='openai'?selectedModel:''});return {...out,routing_source:saved.primary?'functionRouting':'adapter_default'}}
    }catch(e){errors.push(`${p}:${e?.message||'error'}`);if(p==='local'&&process.env.LOCAL_STT_EXCLUSIVE==='1')break}
  }
  throw new Error(`STT_all_providers_failed:${errors.join(' | ')}`)
}
