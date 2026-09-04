import crypto from 'node:crypto';

export const VOICE_CLONE_MODULE_ID='F-VOICE-CLONE-001';
export const PROVIDERS=Object.freeze({
  cosyvoice_3:{id:'cosyvoice_3',kind:'clone',license:'Apache-2.0',commercial:true,local:true,requires_gpu:true,languages:['zh-CN','en-US','ja-JP','ko-KR','de-DE','es-ES','fr-FR','it-IT','ru-RU']},
  openvoice_v2:{id:'openvoice_v2',kind:'clone',license:'MIT',commercial:true,local:true,requires_gpu:false,languages:['en-US','es-ES','fr-FR','zh-CN','ja-JP','ko-KR']},
  supertonic_3:{id:'supertonic_3',kind:'synthesis',license:'OpenRAIL-M',commercial:'review-model-license',local:true,requires_gpu:false,languages:['ko-KR','vi-VN','en-US','ja-JP','zh-CN']},
  f5_tts_official:{id:'f5_tts_official',kind:'experimental',license:'CC-BY-NC',commercial:false,local:true,requires_gpu:true,languages:['zh-CN','en-US']},
  external_tts:{id:'external_tts',kind:'fallback',license:'provider',commercial:'provider-terms',local:false,requires_gpu:false,languages:['*']}
});
const allowedPurposes=new Set(['meeting_playback','accessibility','sns_content','training_content','brand_content']);

function required(value,name){if(value===undefined||value===null||value==='')throw new Error(`voice_clone_invalid_${name}`);return value}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`}
function supports(provider,language){return provider.languages.includes('*')||provider.languages.includes(language)}

export function selectVoiceProvider(profile,input,runtime={}){
  const mode=input.voice_mode||'clone';
  const commercial=input.commercial_use!==false;
  const gpu=runtime.gpu_available===true;
  const preferred=input.provider_id||profile.provider_id||null;
  const candidateIds=preferred?[preferred]:mode==='clone'
    ?(gpu?['cosyvoice_3','openvoice_v2','external_tts']:['openvoice_v2','external_tts'])
    :['supertonic_3','external_tts'];
  for(const providerId of candidateIds){
    const provider=PROVIDERS[providerId];
    if(!provider)continue;
    if(commercial&&provider.commercial===false)continue;
    if(provider.requires_gpu&&!gpu)continue;
    if(!supports(provider,input.language))continue;
    if(mode==='clone'&&!['clone','fallback'].includes(provider.kind))continue;
    return {provider_id:provider.id,license:provider.license,requires_gpu:provider.requires_gpu,mode,fallback:provider.kind==='fallback'};
  }
  throw new Error('voice_clone_no_eligible_provider');
}

export function createVoiceProfile(input,actor){
  required(actor?.actor_id,'actor_id');required(input?.organization_id,'organization_id');required(input?.display_name,'display_name');
  if(input.owner_actor_id!==actor.actor_id&&!actor.permissions?.includes('voice_profile.manage_org'))throw new Error('voice_clone_forbidden_owner');
  if(input.consent?.confirmed!==true||!input.consent?.recorded_at||!input.consent?.scope)throw new Error('voice_clone_consent_required');
  const purposes=[...new Set(input.consent.scope)].filter(x=>allowedPurposes.has(x));
  if(!purposes.length)throw new Error('voice_clone_consent_scope_required');
  const allowed_apps=[...new Set(input.allowed_apps||['voiceflow'])];
  return {
    voice_profile_id:id('voice'),module_id:VOICE_CLONE_MODULE_ID,organization_id:input.organization_id,
    owner_actor_id:input.owner_actor_id,display_name:input.display_name,provider_id:input.provider_id||null,
    synthesis_provider_id:input.synthesis_provider_id||'supertonic_3',integration_id:input.integration_id||null,
    reference_asset_id:required(input.reference_asset_id,'reference_asset_id'),style_asset_id:null,
    languages:[...new Set(input.languages||['ko-KR','vi-VN'])],allowed_apps,status:'pending_quality_check',
    consent:{confirmed:true,recorded_at:input.consent.recorded_at,expires_at:input.consent.expires_at||null,scope:purposes,proof_asset_id:input.consent.proof_asset_id||null},
    created_by:actor.actor_id,created_at:new Date().toISOString(),version:1
  };
}

export function approveVoiceProfile(profile,quality,actor){
  if(!actor?.permissions?.includes('voice_profile.approve'))throw new Error('voice_clone_approval_required');
  if(!quality||quality.snr_db<18||quality.clipping_ratio>0.01||quality.speech_seconds<8)throw new Error('voice_clone_quality_failed');
  return {...profile,status:'active',quality,approved_by:actor.actor_id,approved_at:new Date().toISOString(),version:profile.version+1};
}

export function assertVoiceProfileUse(profile,request,actor){
  if(profile.status!=='active')throw new Error('voice_clone_profile_not_active');
  if(profile.organization_id!==request.organization_id&&!actor?.permissions?.includes('voice_profile.use_cross_org'))throw new Error('voice_clone_cross_org_forbidden');
  if(!profile.allowed_apps.includes(request.app_id))throw new Error('voice_clone_app_not_allowed');
  if(!profile.consent.scope.includes(request.purpose))throw new Error('voice_clone_purpose_not_consented');
  if(profile.consent.expires_at&&Date.parse(profile.consent.expires_at)<=Date.now())throw new Error('voice_clone_consent_expired');
  if(!profile.languages.includes(request.language))throw new Error('voice_clone_language_not_allowed');
  return true;
}

export function createVoiceRenderJob(profile,input,actor,runtime={}){
  required(input?.app_id,'app_id');required(input?.organization_id,'organization_id');required(input?.text,'text');
  required(input?.language,'language');required(input?.purpose,'purpose');assertVoiceProfileUse(profile,input,actor);
  const sns=input.app_id==='sns-automation';
  const provider=selectVoiceProvider(profile,input,runtime);
  return {
    voice_job_id:id('voicejob'),module_id:VOICE_CLONE_MODULE_ID,voice_profile_id:profile.voice_profile_id,
    organization_id:input.organization_id,actor_id:actor.actor_id,app_id:input.app_id,purpose:input.purpose,
    source:{content_id:input.content_id||null,text:input.text,language:input.language},
    provider,
    controls:{speed:input.speed??1,volume_db:input.volume_db??0,emotion:input.emotion||'neutral',noise_reduction:input.noise_reduction!==false,normalize_lufs:input.normalize_lufs??-16},
    output:{format:input.format||'wav',target:sns?'content_asset':'voice_preview',asset_id:null},
    disclosure:{synthetic_voice:true,label:input.disclosure_label||'AI 생성 음성'},
    status:'queued',created_at:new Date().toISOString()
  };
}

export function createSnsVoiceRequest({voice_profile_id,organization_id,content_id,script,language='ko-KR',...controls}){
  return {voice_profile_id,organization_id,app_id:'sns-automation',purpose:'sns_content',content_id,text:script,language,commercial_use:true,...controls};
}
