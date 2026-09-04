export const MOBILE_INPUT_MODE=Object.freeze({
  LOCAL_MODEL:'local-model',
  BROWSER:'browser',
  SERVER:'server',
  TEXT:'text',
});

export const LOCAL_WHISPER_PACK=Object.freeze({
  modelId:'onnx-community/whisper-small',
  revision:'36050c46d777d46dc4b5f43f6d90574fc38f8732',
  cacheKey:'voiceflow-local-stt-whisper-small-fp32-q4-v2',
  approximateBytes:600*1024*1024,
  reserveBytes:128*1024*1024,
  dtype:Object.freeze({
    encoder_model:'fp32',
    decoder_model_merged:'q4',
  }),
});

function finiteOrNull(value){
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)&&number>=0?number:null;
}

function mode(available,{activatable=available,reason=''}={}){
  return Object.freeze({available:Boolean(available),activatable:Boolean(activatable),reason:String(reason||'')});
}

export function assessMobileInputPolicy(input={}){
  const capabilities=Object.freeze({
    webgpu:Boolean(input.webgpu),
    mediaRecorder:Boolean(input.mediaRecorder),
    audioDecoder:Boolean(input.audioDecoder),
    browserSpeech:Boolean(input.browserSpeech),
    online:input.online!==false,
    deviceMemory:finiteOrNull(input.deviceMemory),
    hardwareConcurrency:finiteOrNull(input.hardwareConcurrency),
    storageQuota:finiteOrNull(input.storageQuota),
    storageUsage:finiteOrNull(input.storageUsage),
    serverConsent:Boolean(input.serverConsent),
  });

  const freeBytes=capabilities.storageQuota===null||capabilities.storageUsage===null
    ?null
    :Math.max(0,capabilities.storageQuota-capabilities.storageUsage);
  const insufficientStorage=freeBytes!==null&&freeBytes<LOCAL_WHISPER_PACK.approximateBytes+LOCAL_WHISPER_PACK.reserveBytes;
  const lowMemory=capabilities.deviceMemory!==null&&capabilities.deviceMemory<4;
  const lowCpu=capabilities.hardwareConcurrency!==null&&capabilities.hardwareConcurrency<4;
  const localReason=!capabilities.webgpu?'webgpu_unavailable'
    :!capabilities.mediaRecorder?'recorder_unavailable'
      :!capabilities.audioDecoder?'audio_decoder_unavailable'
        :insufficientStorage?'storage_insufficient'
          :lowMemory?'memory_low'
            :lowCpu?'cpu_low':'';
  const localAvailable=!localReason;
  const serverAvailable=capabilities.online&&capabilities.mediaRecorder;
  const serverReason=!capabilities.online?'offline':!capabilities.mediaRecorder?'recorder_unavailable':capabilities.serverConsent?'':'consent_required';

  const modes=Object.freeze({
    [MOBILE_INPUT_MODE.LOCAL_MODEL]:mode(localAvailable,{reason:localReason}),
    [MOBILE_INPUT_MODE.BROWSER]:mode(capabilities.browserSpeech,{reason:capabilities.browserSpeech?'':'browser_speech_unavailable'}),
    [MOBILE_INPUT_MODE.SERVER]:mode(serverAvailable,{activatable:serverAvailable&&capabilities.serverConsent,reason:serverReason}),
    [MOBILE_INPUT_MODE.TEXT]:mode(true),
  });
  const recommended=modes[MOBILE_INPUT_MODE.LOCAL_MODEL].activatable?MOBILE_INPUT_MODE.LOCAL_MODEL
    :modes[MOBILE_INPUT_MODE.BROWSER].activatable?MOBILE_INPUT_MODE.BROWSER
      :modes[MOBILE_INPUT_MODE.SERVER].activatable?MOBILE_INPUT_MODE.SERVER
        :MOBILE_INPUT_MODE.TEXT;

  return Object.freeze({capabilities,modes,recommended,freeBytes});
}

export function chooseSafeMobileInputMode(requested,assessment){
  const value=Object.values(MOBILE_INPUT_MODE).includes(requested)?requested:MOBILE_INPUT_MODE.TEXT;
  return assessment?.modes?.[value]?.activatable?value:MOBILE_INPUT_MODE.TEXT;
}
