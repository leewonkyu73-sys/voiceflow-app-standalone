export interface CaptionApiRecord {
  id:string;
  meeting_id:string;
  client_id?:string;
  text:string;
  translations?:Record<string,string>;
  pending_translation?:boolean;
  [key:string]:unknown;
}

export interface CaptionApiRequest {
  meeting_id:string;
  client_id:string;
  text:string;
  language:string;
  detected_language:string;
  target_language:string;
  input_mode:'manual'|'speech';
  final:true;
  [key:string]:unknown;
}

export interface TransportResponse {
  ok:boolean;
  status:number;
  json():Promise<unknown>;
}

export type MeetingApiTransport=(url:string,options:Record<string,unknown>)=>Promise<TransportResponse>;

export class MeetingApiError extends Error {
  code:string;
  status:number;
  retryable:boolean;
  payload:unknown;
}

export function createMeetingApiAdapter(input:{transport:MeetingApiTransport}):Readonly<{
  postCaption(request:CaptionApiRequest):Promise<{data:CaptionApiRecord;replayed:boolean;pending:boolean}>;
  listCaptions(input:{meetingId:string;targetLanguage?:string;since?:number}):Promise<CaptionApiRecord[]>;
}>;
