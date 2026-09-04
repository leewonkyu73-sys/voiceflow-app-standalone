export const MEETING_PHASE=Object.freeze({
  IDLE:'idle',
  PREPARING:'preparing',
  READY:'ready',
  LIVE:'live',
  PAUSED:'paused',
  FINALIZING:'finalizing',
  ENDED:'ended',
});

export const CAPTION_STATUS=Object.freeze({
  PENDING:'pending',
  COMMITTED:'committed',
  FAILED:'failed',
});

export const MEETING_EVENT=Object.freeze({
  CREATED:'meeting.created',
  PREFLIGHT_COMPLETED:'meeting.preflight.completed',
  JOINED:'meeting.joined',
  RECORDING_STARTED:'meeting.recording.started',
  RECORDING_STOPPED:'meeting.recording.stopped',
  CAPTION_FINAL:'meeting.caption.final',
  FINALIZED:'meeting.finalized',
  RESULT_REVIEWED:'meeting.result.reviewed',
  RESULT_APPROVED:'meeting.result.approved',
  RESULT_REJECTED:'meeting.result.rejected',
});

export function assertMeetingId(value){
  const id=String(value||'');
  if(!/^mtg_[A-Za-z0-9_]+$/.test(id))throw new Error('invalid_meeting_id');
  return id;
}

function required(value,name){
  const text=String(value||'').trim();
  if(!text)throw new Error(`missing_${name}`);
  return text;
}

export function createCaptionRequest(input={}){
  const meetingId=assertMeetingId(input.meetingId);
  const clientId=required(input.clientId,'client_id');
  const text=required(input.text,'caption_text');
  const sourceLanguage=required(input.sourceLanguage,'source_language');
  const targetLanguage=required(input.targetLanguage,'target_language');
  const inputMode=required(input.inputMode,'input_mode');
  if(!['manual','speech'].includes(inputMode))throw new Error('invalid_input_mode');
  return Object.freeze({
    meeting_id:meetingId,
    client_id:clientId,
    text,
    language:sourceLanguage,
    detected_language:sourceLanguage,
    target_language:targetLanguage,
    input_mode:inputMode,
    final:true,
  });
}
