export const MOBILE_SPEECH_STATE:Readonly<{
  IDLE:'idle';
  RECORDING:'recording';
  TRANSCRIBING:'transcribing';
  COMMITTING:'committing';
  COMPLETED:'completed';
  RECOVERABLE_ERROR:'recoverable_error';
  FATAL_ERROR:'fatal_error';
  STOPPED:'stopped';
}>;

export type MobileSpeechState=typeof MOBILE_SPEECH_STATE[keyof typeof MOBILE_SPEECH_STATE];
export interface MobileSpeechSnapshot {
  readonly state:MobileSpeechState;
  readonly error:string|null;
  readonly lastText:string;
  readonly provider:string;
  readonly model:string;
  readonly latencyMs:number;
}

export interface MobileSpeechRecorder {
  readonly mimeType:string;
  readonly state:string;
  addEventListener(name:string,listener:(event:any)=>void):void;
  start():void;
  stop():void;
}

export class MobileTranscriptionError extends Error {
  readonly code:string;
  readonly status:number;
  readonly retryable:boolean;
  readonly payload:unknown;
}

export function createMobileTranscriptionAdapter(options:{transport:(url:string,options:Record<string,unknown>)=>Promise<Response>}):{
  transcribe(options:{meetingId:string;audio:Blob;mimeType?:string;language?:string}):Promise<{text:string;provider:string;model:string;language:string}>;
};

export function createMobileSpeechSession(options:{
  meetingId:string;
  mediaSession:{getSnapshot():{state:string};getStream():MediaStream|null};
  captionSession:{submit(text:string,options:Record<string,string>):Promise<unknown>};
  transcribe(options:Record<string,unknown>):Promise<Record<string,unknown>>;
  createRecorder(stream:MediaStream):MobileSpeechRecorder;
  createAudioBlob(parts:BlobPart[],options:{type:string}):Blob;
  minBytes?:number;
  now?:()=>number;
}):{
  getSnapshot():MobileSpeechSnapshot;
  subscribe(listener:(snapshot:MobileSpeechSnapshot)=>void):()=>boolean;
  startCapture(options?:{sourceLanguage?:string;targetLanguage?:string}):MobileSpeechSnapshot;
  finishCapture():Promise<MobileSpeechSnapshot>;
  cancelCapture(reason?:string):MobileSpeechSnapshot;
  stop():MobileSpeechSnapshot;
};
