import {MEETING_PHASE,assertMeetingId} from '../meeting-contracts/index.mjs';

const ALLOWED=Object.freeze({
  [MEETING_PHASE.IDLE]:Object.freeze([MEETING_PHASE.PREPARING]),
  [MEETING_PHASE.PREPARING]:Object.freeze([MEETING_PHASE.READY,MEETING_PHASE.IDLE]),
  [MEETING_PHASE.READY]:Object.freeze([MEETING_PHASE.LIVE,MEETING_PHASE.IDLE]),
  [MEETING_PHASE.LIVE]:Object.freeze([MEETING_PHASE.PAUSED,MEETING_PHASE.FINALIZING]),
  [MEETING_PHASE.PAUSED]:Object.freeze([MEETING_PHASE.LIVE,MEETING_PHASE.FINALIZING]),
  [MEETING_PHASE.FINALIZING]:Object.freeze([MEETING_PHASE.ENDED,MEETING_PHASE.LIVE]),
  [MEETING_PHASE.ENDED]:Object.freeze([]),
});

function freezeSession(value){return Object.freeze({...value})}

export function createMeetingSession(){
  return freezeSession({
    meetingId:null,
    phase:MEETING_PHASE.IDLE,
    generation:0,
    error:null,
    changedAt:0,
  });
}

export function bindMeeting(session,meetingId,{changedAt=Date.now()}={}){
  const id=assertMeetingId(meetingId);
  if(session?.meetingId===id&&session.phase===MEETING_PHASE.ENDED)throw new Error('ended_meeting_cannot_reopen');
  if(session?.meetingId===id&&session.phase!==MEETING_PHASE.ENDED)return session;
  return freezeSession({
    meetingId:id,
    phase:MEETING_PHASE.PREPARING,
    generation:Number(session?.generation||0)+1,
    error:null,
    changedAt,
  });
}

export function transitionMeeting(session,nextPhase,{error=null,changedAt=Date.now()}={}){
  if(!session||!Object.values(MEETING_PHASE).includes(session.phase))throw new Error('invalid_meeting_session');
  if(!Object.values(MEETING_PHASE).includes(nextPhase))throw new Error('invalid_meeting_phase');
  if(!ALLOWED[session.phase].includes(nextPhase)){
    throw new Error(`invalid_meeting_transition:${session.phase}->${nextPhase}`);
  }
  return freezeSession({...session,phase:nextPhase,error,changedAt});
}
