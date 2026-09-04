import type {CaptionRequest,CaptionStatus} from '../meeting-contracts/index.mjs';

export interface CaptionItem {
  id:string;
  clientId:string;
  meetingId:string;
  text:string;
  translations:Readonly<Record<string,string>>;
  translationState:Readonly<Record<string,{status:string;error:string|null}>>;
  status:CaptionStatus;
  error:string|null;
  createdAt:number;
}

export interface CaptionStore {
  meetingId:string;
  items:ReadonlyArray<Readonly<CaptionItem>>;
  draft:string;
  cursor:number;
}

export function createCaptionStore(meetingId:string):Readonly<CaptionStore>;
export function beginCaption(store:Readonly<CaptionStore>,request:Readonly<CaptionRequest>):Readonly<CaptionStore>;
export function failCaption(store:Readonly<CaptionStore>,clientId:string,error:unknown):Readonly<CaptionStore>;
export function commitCaption(store:Readonly<CaptionStore>,clientId:string,serverCaption:Record<string,unknown>):Readonly<CaptionStore>;
export function setCaptionTranslation(store:Readonly<CaptionStore>,captionKey:string,input:{targetLanguage:string;status:string;text?:string;error?:unknown}):Readonly<CaptionStore>;
export function mergeServerCaptions(store:Readonly<CaptionStore>,rows?:Array<Record<string,unknown>>):Readonly<CaptionStore>;
