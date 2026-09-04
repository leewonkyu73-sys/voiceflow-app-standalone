export const MOBILE_MEDIA_STATE: Readonly<{
  IDLE:'idle';
  REQUESTING:'requesting';
  ACTIVE:'active';
  SUSPENDED:'suspended';
  RECOVERABLE_ERROR:'recoverable_error';
  FATAL_ERROR:'fatal_error';
  STOPPED:'stopped';
}>;

export type MobileMediaState=typeof MOBILE_MEDIA_STATE[keyof typeof MOBILE_MEDIA_STATE];

export interface MobileMediaSnapshot {
  readonly state:MobileMediaState;
  readonly error:string|null;
  readonly hasStream:boolean;
  readonly permissionRequests:number;
}

export interface MobileMediaSession {
  getSnapshot():MobileMediaSnapshot;
  getStream():MediaStream|null;
  subscribe(listener:(snapshot:MobileMediaSnapshot)=>void):()=>boolean;
  start():Promise<MediaStream>;
  setVisibility(visibility:string):MobileMediaSnapshot;
  stop():MobileMediaSnapshot;
}

export function createMobileMediaSession(options:{
  requestStream:(constraints:MediaStreamConstraints)=>Promise<MediaStream>;
  constraints?:MediaStreamConstraints;
}):MobileMediaSession;
