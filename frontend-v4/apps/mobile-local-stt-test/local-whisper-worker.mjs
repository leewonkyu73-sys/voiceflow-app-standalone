import {env,pipeline} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';

const MODEL_ID='onnx-community/whisper-small';
const MODEL_REVISION='36050c46d777d46dc4b5f43f6d90574fc38f8732';
const CACHE_KEY='voiceflow-local-stt-whisper-small-fp32-q4-v2';
const MODEL_OPTIONS=Object.freeze({
  device:'webgpu',
  dtype:{encoder_model:'fp32',decoder_model_merged:'q4'},
  revision:MODEL_REVISION,
});

env.allowLocalModels=false;
env.allowRemoteModels=true;
env.useBrowserCache=true;
env.cacheKey=CACHE_KEY;

let transcriberPromise=null;
const progressByFile=new Map();

function reportProgress(update={}){
  const file=String(update.file||update.name||'model');
  if(update.status==='progress'){
    progressByFile.set(file,{loaded:Number(update.loaded)||0,total:Number(update.total)||0});
  }else if(update.status==='done'){
    const previous=progressByFile.get(file)||{};
    progressByFile.set(file,{loaded:Number(previous.total||previous.loaded)||1,total:Number(previous.total)||1});
  }
  const entries=[...progressByFile.values()];
  const loaded=entries.reduce((sum,item)=>sum+item.loaded,0);
  const total=entries.reduce((sum,item)=>sum+item.total,0);
  self.postMessage({type:'progress',loaded,total,progress:total?Math.min(100,loaded/total*100):0,file,status:update.status||''});
}

function getTranscriber(){
  if(!transcriberPromise){
    transcriberPromise=pipeline('automatic-speech-recognition',MODEL_ID,{
      ...MODEL_OPTIONS,
      progress_callback:reportProgress,
    });
  }
  return transcriberPromise;
}

function hasSpeech(audio){
  if(!(audio instanceof Float32Array)||audio.length<1600)return false;
  let energy=0,peak=0;
  for(let index=0;index<audio.length;index+=1){
    const value=Math.abs(audio[index]);
    energy+=value*value;
    if(value>peak)peak=value;
  }
  return peak>=0.006&&Math.sqrt(energy/audio.length)>=0.0015;
}

self.addEventListener('message',async event=>{
  const message=event.data||{};
  try{
    if(message.type==='load'){
      await getTranscriber();
      self.postMessage({type:'ready',requestId:message.requestId,modelId:MODEL_ID,revision:MODEL_REVISION,cacheKey:CACHE_KEY});
      return;
    }
    if(message.type==='transcribe'){
      const audio=message.audio;
      if(!hasSpeech(audio))throw new Error('speech_not_detected');
      const transcriber=await getTranscriber();
      const language=String(message.language||'ko-KR').split('-')[0];
      const result=await transcriber(audio,{
        language,
        task:'transcribe',
        chunk_length_s:30,
        stride_length_s:5,
        return_timestamps:false,
      });
      self.postMessage({
        type:'result',
        requestId:message.requestId,
        text:String(result?.text||'').trim(),
        provider:'local-whisper-small',
        model:MODEL_ID,
        language:message.language||'',
      });
    }
  }catch(error){
    if(message.type==='load')transcriberPromise=null;
    self.postMessage({type:'error',requestId:message.requestId,error:String(error?.message||error||'local_whisper_failed')});
  }
});
