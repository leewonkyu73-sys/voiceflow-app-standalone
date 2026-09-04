import assert from 'node:assert/strict';

import {
  SPEECH_PROVIDER_CANDIDATES,
  SPEECH_PROVIDER_KIND,
  SPEECH_SESSION_STATE,
  createExclusiveSpeechProviderSession,
  createSpeechProviderDescriptor,
  createTranscriptionRequest,
} from '../packages/speech-provider-contract/index.mjs';

const google=SPEECH_PROVIDER_CANDIDATES.find(provider=>provider.id==='google-chirp-3');
const chrome=SPEECH_PROVIDER_CANDIDATES.find(provider=>provider.id==='chrome-browser');
assert.ok(google);
assert.ok(chrome);
assert.equal(google.uploadsAudio,true);
assert.equal(google.requiresConsent,true);
assert.equal(chrome.uploadsAudio,false);

assert.throws(()=>createSpeechProviderDescriptor({
  id:'unsafe-api',kind:SPEECH_PROVIDER_KIND.API,uploadsAudio:true,requiresConsent:false,
}),/speech_provider_audio_consent_contract_required/);

assert.throws(()=>createTranscriptionRequest({
  provider:google,sessionId:'session-001',utteranceId:'utterance-001',sourceLanguage:'ko-KR',
}),/speech_audio_consent_required/);

assert.throws(()=>createTranscriptionRequest({
  provider:chrome,sessionId:'session-001',utteranceId:'utterance-001',sourceLanguage:'ko-KR',targetLanguage:'vi-VN',
}),/speech_request_must_not_translate/);

const request=createTranscriptionRequest({
  provider:google,sessionId:'session-001',utteranceId:'utterance-001',sourceLanguage:'ko-KR',audioConsent:'session',
});
assert.deepEqual(request,{
  providerId:'google-chirp-3',sessionId:'session-001',utteranceId:'utterance-001',sourceLanguage:'ko-KR',sequence:0,audioConsent:'session',
});
assert.equal('targetLanguage'in request,false);

const session=createExclusiveSpeechProviderSession({provider:google,sessionId:'session-001',audioConsent:'session'});
session.beginUtterance({utteranceId:'utterance-001',sourceLanguage:'ko-KR'});
assert.equal(session.getSnapshot().state,SPEECH_SESSION_STATE.LISTENING);
assert.deepEqual(session.acceptResult({
  providerId:'google-chirp-3',sessionId:'session-001',utteranceId:'utterance-001',sequence:0,isFinal:false,text:'오늘 회의',
}),{accepted:false,reason:'interim'});

const raw=' 오늘 회의를 시작합니다. ';
const accepted=session.acceptResult({
  providerId:'google-chirp-3',sessionId:'session-001',utteranceId:'utterance-001',sequence:1,isFinal:true,text:raw,confidence:0.97,
});
assert.equal(accepted.accepted,true);
assert.equal(accepted.final.originalText,raw,'STT final text must be preserved without rewriting');
assert.equal(session.getSnapshot().state,SPEECH_SESSION_STATE.READY);

session.beginUtterance({utteranceId:'utterance-002',sourceLanguage:'ko-KR'});
assert.throws(()=>session.acceptResult({
  providerId:'deepgram-nova-3',sessionId:'session-001',utteranceId:'utterance-002',sequence:0,isFinal:true,text:'다른 Provider',
}),/speech_provider_mismatch/);
assert.throws(()=>session.acceptResult({
  providerId:'google-chirp-3',sessionId:'session-001',utteranceId:'utterance-002',sequence:0,isFinal:false,text:'중간',
})&&session.acceptResult({
  providerId:'google-chirp-3',sessionId:'session-001',utteranceId:'utterance-002',sequence:0,isFinal:true,text:'오래된 결과',
}),/speech_result_stale/);
const ignored=session.acceptResult({
  providerId:'google-chirp-3',sessionId:'session-001',utteranceId:'utterance-002',sequence:1,isFinal:true,text:'',noSpeech:true,
});
assert.equal(ignored.accepted,false);
assert.equal(ignored.reason,'no_speech');

session.end();
assert.equal(session.getSnapshot().state,SPEECH_SESSION_STATE.ENDED);
assert.throws(()=>session.beginUtterance({utteranceId:'utterance-003',sourceLanguage:'ko-KR'}),/speech_session_ended/);

console.log('VOICEFLOW_V4_PHASE5_SPEECH_PROVIDER_CONTRACT_PASS');
