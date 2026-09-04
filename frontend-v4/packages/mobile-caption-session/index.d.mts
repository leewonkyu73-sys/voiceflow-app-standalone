import type {CaptionStore} from '../caption-store/index.mjs';
import type {CaptionApiRequest,CaptionApiRecord} from '../meeting-api-adapter/index.mjs';

export interface MobileCaptionApi {
  postCaption(request:CaptionApiRequest):Promise<{data:CaptionApiRecord;replayed?:boolean;pending?:boolean}>;
  listCaptions(input:{meetingId:string;targetLanguage?:string;since?:number}):Promise<CaptionApiRecord[]>;
}

export interface SubmitOptions {
  sourceLanguage?:string;
  targetLanguage?:string;
  inputMode?:'manual'|'speech';
}

export function createMobileCaptionSession(input:{
  meetingId:string;
  api:MobileCaptionApi;
  sourceLanguage?:string;
  targetLanguage?:string;
  createClientId?:()=>string;
}):Readonly<{
  getSnapshot():Readonly<CaptionStore>;
  subscribe(listener:(snapshot:Readonly<CaptionStore>)=>void):()=>boolean;
  submit(text:string,options?:SubmitOptions):Promise<Readonly<CaptionStore>>;
  retry(clientId:string):Promise<Readonly<CaptionStore>>;
  reconnect(options?:{targetLanguage?:string}):Promise<Readonly<CaptionStore>>;
}>;
