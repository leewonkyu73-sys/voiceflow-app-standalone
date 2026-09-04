import assert from 'node:assert/strict';
import {PROVIDERS,createVoiceProfile,approveVoiceProfile,createVoiceRenderJob,createSnsVoiceRequest,assertVoiceProfileUse,selectVoiceProvider} from './index.mjs';

const owner={actor_id:'actor_owner',permissions:[]};
const admin={actor_id:'actor_admin',permissions:['voice_profile.manage_org','voice_profile.approve']};
let profile=createVoiceProfile({
  organization_id:'org_hq',owner_actor_id:'actor_owner',display_name:'대표 음성',
  reference_asset_id:'asset_ref',languages:['ko-KR','vi-VN'],allowed_apps:['voiceflow','sns-automation'],
  consent:{confirmed:true,recorded_at:'2026-08-24T00:00:00Z',scope:['meeting_playback','sns_content'],proof_asset_id:'asset_consent'}
},owner);
assert.equal(profile.status,'pending_quality_check');
assert.throws(()=>createVoiceRenderJob(profile,{app_id:'sns-automation',organization_id:'org_hq',text:'안녕',language:'ko-KR',purpose:'sns_content'},owner),/not_active/);
profile=approveVoiceProfile(profile,{snr_db:24,clipping_ratio:0.001,speech_seconds:12},admin);

const koReq=createSnsVoiceRequest({voice_profile_id:profile.voice_profile_id,organization_id:'org_hq',content_id:'content_ko',script:'오늘의 콘텐츠입니다.',language:'ko-KR'});
assert.equal(selectVoiceProvider(profile,koReq,{gpu_available:true}).provider_id,'cosyvoice_3');
assert.equal(selectVoiceProvider(profile,koReq,{gpu_available:false}).provider_id,'openvoice_v2');

const viReq=createSnsVoiceRequest({voice_profile_id:profile.voice_profile_id,organization_id:'org_hq',content_id:'content_vi',script:'Nội dung hôm nay.',language:'vi-VN',voice_mode:'synthesis'});
assert.equal(assertVoiceProfileUse(profile,viReq,owner),true);
const viJob=createVoiceRenderJob(profile,viReq,owner,{gpu_available:false});
assert.equal(viJob.provider.provider_id,'supertonic_3');
assert.equal(viJob.output.target,'content_asset');
assert.equal(viJob.controls.noise_reduction,true);
assert.equal(viJob.controls.normalize_lufs,-16);
assert.equal(viJob.disclosure.synthetic_voice,true);

assert.equal(PROVIDERS.f5_tts_official.commercial,false);
assert.throws(()=>selectVoiceProvider(profile,{...koReq,provider_id:'f5_tts_official'},{gpu_available:true}),/no_eligible_provider/);
assert.throws(()=>createVoiceRenderJob(profile,{...koReq,app_id:'unknown'},owner),/app_not_allowed/);
assert.throws(()=>createVoiceRenderJob(profile,{...koReq,purpose:'brand_content'},owner),/purpose_not_consented/);
console.log('VOICE CLONE PROVIDER ROUTING PASS');
