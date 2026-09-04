import type {MeetingPhase} from '../meeting-contracts/index.mjs';

export interface MeetingSession {
  meetingId:string|null;
  phase:MeetingPhase;
  generation:number;
  error:string|null;
  changedAt:number;
}

export function createMeetingSession():Readonly<MeetingSession>;
export function bindMeeting(
  session:Readonly<MeetingSession>,
  meetingId:string,
  options?:{changedAt?:number},
):Readonly<MeetingSession>;
export function transitionMeeting(
  session:Readonly<MeetingSession>,
  nextPhase:MeetingPhase,
  options?:{error?:string|null;changedAt?:number},
):Readonly<MeetingSession>;
