export type MeetingPhase='idle'|'preparing'|'ready'|'live'|'paused'|'finalizing'|'ended';
export type CaptionStatus='pending'|'committed'|'failed';
export type CaptionInputMode='manual'|'speech';

export interface CaptionRequest {
  meeting_id:string;
  client_id:string;
  text:string;
  language:string;
  detected_language:string;
  target_language:string;
  input_mode:CaptionInputMode;
  final:true;
}

export const MEETING_PHASE:Readonly<Record<string,MeetingPhase>>;
export const CAPTION_STATUS:Readonly<Record<string,CaptionStatus>>;
export const MEETING_EVENT:Readonly<Record<string,string>>;
export function assertMeetingId(value:unknown):string;
export function createCaptionRequest(input:{
  meetingId:string;
  clientId:string;
  text:string;
  sourceLanguage:string;
  targetLanguage:string;
  inputMode:CaptionInputMode;
}):Readonly<CaptionRequest>;
