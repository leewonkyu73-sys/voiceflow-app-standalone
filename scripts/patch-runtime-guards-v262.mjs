import fs from 'node:fs/promises';

const appFile=new URL('../public/app.js',import.meta.url);
const audioFile=new URL('../public/audio-monitor.js',import.meta.url);
const captionFile=new URL('../public/caption-language.js',import.meta.url);

async function patchApp(){
  let s=await fs.readFile(appFile,'utf8');
  const replaceAll=(from,to)=>{s=s.split(from).join(to)};

  replaceAll("const $$=s=>[...document.querySelectorAll(s)];","const $$=s=>Array.from(document.querySelectorAll(s));");
  replaceAll("const $$=s=>Array.from(document.querySelectorAll?.(s)||[]);","const $$=s=>Array.from(document.querySelectorAll(s));");

  const collectionSelectors=['[data-href]','[data-lang]','[data-nav]','[data-task]','[data-user-status]'];
  for(const sel of collectionSelectors){
    replaceAll(`$$('${sel}').forEach(`,`document.querySelectorAll('${sel}').forEach(`);
    replaceAll(`$$('${sel}')?.forEach(`,`document.querySelectorAll('${sel}').forEach(`);
    replaceAll(`$('${sel}').forEach(`,`document.querySelectorAll('${sel}').forEach(`);
    replaceAll(`$('${sel}')?.forEach(`,`document.querySelectorAll('${sel}').forEach(`);
  }

  replaceAll("state.media.stream?.getTracks().forEach(x=>x.stop())","(state.media.stream?.getTracks?.()||[]).forEach(x=>x.stop())");
  replaceAll("state.video._cameraStream?.getTracks().forEach(x=>x.stop())","(state.video._cameraStream?.getTracks?.()||[]).forEach(x=>x.stop())");
  replaceAll("audio?.getTracks().forEach(x=>x.stop())","(audio?.getTracks?.()||[]).forEach(x=>x.stop())");
  replaceAll("cam.getTracks().forEach(x=>x.stop())","(cam?.getTracks?.()||[]).forEach(x=>x.stop())");
  replaceAll("v.getTracks().forEach(x=>x.stop())","(v?.getTracks?.()||[]).forEach(x=>x.stop())");

  for(const sel of collectionSelectors){
    if(s.includes(`$$('${sel}').forEach(`)||s.includes(`$$('${sel}')?.forEach(`)||s.includes(`$('${sel}').forEach(`)||s.includes(`$('${sel}')?.forEach(`)){
      throw new Error(`unsafe_selector_binding_remaining:${sel}`);
    }
  }

  if(!s.includes("state.meeting={id:null,type,title,status:'creating'")) throw new Error('optimistic_meeting_entry_missing');
  if(!s.includes("void checkDevices(mode==='video').catch(()=>{})")) throw new Error('async_device_preflight_missing');

  s=s.replace(/window\.__VOICEFLOW_RUNTIME_GUARD__='[^']*';?\n?/g,'');
  s=s.replace(/window\.__VOICEFLOW_MEETING_ENTRY__='[^']*';?\n?/g,'');
  s += "\nwindow.__VOICEFLOW_RUNTIME_GUARD__='2.6.2-r4';\nwindow.__VOICEFLOW_MEETING_ENTRY__='optimistic-v1';\n";
  new Function(s);
  await fs.writeFile(appFile,s,'utf8');
}

async function patchAudio(){
  let s=await fs.readFile(audioFile,'utf8');
  s=s.replace("stream.getAudioTracks().forEach(t=>t.addEventListener('ended',stopMonitor,{once:true}))","(stream?.getAudioTracks?.()||[]).forEach(t=>t.addEventListener('ended',stopMonitor,{once:true}))");
  new Function(s);
  await fs.writeFile(audioFile,s,'utf8');
}

async function validateCaption(){
  const s=await fs.readFile(captionFile,'utf8');
  new Function(s);
}

await patchApp();
await patchAudio();
await validateCaption();
await import('./patch-result-review-v268.mjs');
await import('./patch-live-chat-v269.mjs');
console.log('VoiceFlow v2.6.2 runtime guard r4 + result verification + realtime chat applied');
